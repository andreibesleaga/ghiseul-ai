const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { logger } = require('../shared-lib');
const { DateTime } = require('luxon');
const axios = require('axios');
const config = require('../config');
const readline = require('readline');
const zlib = require('zlib');
const { exec } = require('child_process');
const util = require('util');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const execPromise = util.promisify(exec);
const TIMEOUT_PERIOD = 200000;
const DAYS_TO_PROCESS = 10;

const securityScanService = {
  async isGzipValid(file) {
    try {
      await execPromise(`gunzip -t "${file}"`);
      return true;
    } catch (err) {
      logger.warn(`Gzip validation failed for ${file}: ${err.message}`);
      return false;
    }
  },

  async getDescriptorCount() {
    try {
      const { stdout } = await execPromise(`lsof -p ${process.pid} | wc -l`);
      return parseInt(stdout.trim(), 10);
    } catch (err) {
      logger.warn(`Error getting descriptor count: ${err.message}`);
      return 0;
    }
  },

  async closeWinstonTransports() {
    try {
      for (const transport of logger.transports) {
        if (transport.close) {
          await new Promise(resolve => transport.close(resolve));
        }
      }
    } catch (err) {
      logger.warn(`Error closing Winston transports: ${err.message}`);
    }
  },

  async reopenWinstonTransports() {
    try {
      // Re-initialization logic for winston transports if needed
    } catch (err) {
      logger.warn(`Error reopening Winston transports: ${err.message}`);
    }
  },

  async checkCachedResults() {
    try {
      const scanResultsFile = '/app/data/security/last-scan-results.json';
      const stats = await fsPromises.stat(scanResultsFile);
      const now = DateTime.now();
      const fileTime = DateTime.fromJSDate(stats.mtime);
      if (now.diff(fileTime, 'hours').hours < 1) {
        const data = await fsPromises.readFile(scanResultsFile, 'utf8');
        logger.info('Returning cached security scan results');
        return JSON.parse(data);
      }
    } catch (err) {
      console.debug('No valid cached results found');
    }
    return null;
  },

  async runSecurityScan(logsService) {
    const startTime = Date.now();
    try {
      logger.info('Running security scan');
      if (!logsService) throw new Error('LogsService is required for security scan');

      const { vulnerabilities, failedLogins, suspiciousActivities } = await this.processLogsInParallel(logsService);

      const scanResult = {
        scanTime: new Date().toISOString(),
        vulnerabilities: {
          critical: vulnerabilities.critical.length,
          medium: vulnerabilities.medium.length,
          low: vulnerabilities.low.length,
          details: [...vulnerabilities.critical, ...vulnerabilities.medium, ...vulnerabilities.low]
        },
        vulnerabilityDetails: vulnerabilities,
        failedLoginDetails: failedLogins,
        suspiciousDetails: suspiciousActivities,
        status: 'completed',
        message: 'Security scan completed successfully'
      };

      await this.saveScanResults(scanResult);
      logger.info(`Security scan completed in ${(Date.now() - startTime) / 1000}s`);
      return scanResult;
    } catch (error) {
      logger.error(`Error in runSecurityScan: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  // OPTIMIZED: Centralized log processing function reads each file only ONCE.
  async processLogsInParallel(logsService) {
    const startTime = Date.now();
    const today = DateTime.now();
    const startDate = today.minus({ days: DAYS_TO_PROCESS }).toFormat('yyyy-MM-dd');
    const endDate = today.toFormat('yyyy-MM-dd');

    const vulnerabilityPatterns = [
      { type: 'token_issue', severity: 'critical', regex: /invalid token/i, description: 'Invalid or expired token usage detected', recommendation: 'Review token expiration policies.', service: 'auth' },
      { type: 'attack_attempt', severity: 'critical', regex: /SQL injection|XSS|CSRF/i, description: 'Potential attack attempt detected', recommendation: 'Implement WAF and input sanitization.', service: 'http' },
      { type: 'command_injection', severity: 'critical', regex: /(sleep\s+\d+|__import__\(\s*['"]subprocess['"]\)|execSync\(\s*['"]sleep\s+\d+['"]\)|%x\(\s*sleep\s+\d+\s*\))/i, description: 'Command injection attempt detected in token or request', recommendation: 'Sanitize all inputs and implement strict validation.', service: 'auth' },
      { type: 'sensitive_file_access', severity: 'medium', regex: /Blocked access to sensitive path:\s*((?:\/api\/)?(?:\.env|\.git\/config|\.gitignore|\.npmrc|node_modules\/\.package-lock\.json|\.well-known\/security\.txt))/i, description: 'Attempt to access sensitive file detected', recommendation: 'Ensure sensitive files are not exposed and access is blocked.', service: 'http' },
      { type: 'ip_blocked', severity: 'medium', regex: /IP Blocked/i, description: 'IP blocked due to suspicious activity', recommendation: 'Review blocked IPs for false positives and enhance rate limiting.', service: 'system' },
      { type: 'auth_failure_401', severity: 'medium', regex: /Authentication Failure - 401/i, description: 'HTTP 401 unauthorized access attempt detected', recommendation: 'Monitor for brute force and review access controls.', service: 'system' },
      { type: 'db_error', severity: 'medium', regex: /collection\.save failed.*expecting both `_from` and `_to` attributes/i, description: 'Database operation failed due to misconfiguration', recommendation: 'Review ArangoDB edge document configuration.', service: 'database' },
      { type: 'non_critical_file_access', severity: 'low', regex: /Blocked access to sensitive path:\s*(\/\.well-known\/appspecific\/com\.chrome\.devtools\.json)/i, description: 'Attempt to access non-critical configuration file detected', recommendation: 'Verify if access to such files should be blocked.', service: 'http' },
      { type: 'unauthorized_access', severity: 'medium', regex: /not authorized/i, description: 'Unauthorized access attempt detected', recommendation: 'Check access control policies.', service: 'auth' },
      { type: 'brute_force', severity: 'medium', regex: /brute force/i, description: 'Brute force attempt detected', recommendation: 'Implement rate limiting.', service: 'auth' },
      { type: 'failed_login', severity: 'low', regex: /Invalid credentials|failed login/i, description: 'Failed login attempt detected', recommendation: 'Monitor for suspicious activity.', service: 'auth' },
      { type: 'not_found_404', severity: 'low', regex: /404 Not Found: (GET|POST|PUT|DELETE)\s+\/api\/api\//i, description: 'Invalid API endpoint access attempt detected', recommendation: 'Review for probing attempts and ensure proper routing.', service: 'http' },
      { type: 'registration_failure', severity: 'low', regex: /(Email|Username) already exists|Registration failed/i, description: 'Registration attempt failed due to existing credentials', recommendation: 'Monitor for automated registration attempts.', service: 'system' },
      { type: 'log_limit_exceeded', severity: 'low', regex: /Too many log lines.*limiting to/i, description: 'Log file exceeds processing limit', recommendation: 'Optimize log rotation or increase scan limits.', service: 'system' },
    ];
    const suspiciousPatterns = [
      /SQL injection|XSS|CSRF|brute force|command injection|threat detection|ip blocked/i
    ];

    try {
      console.log(`Starting unified log scan for period ${startDate} to ${endDate}`);
      const allLogFiles = await logsService.getLogFilesInRange(startDate, endDate, true);
      const validLogFiles = (await Promise.all(allLogFiles.map(async file => {
        if (file.endsWith('.gz') && !(await this.isGzipValid(file))) return null;
        if (!file.match(/(combined|error)-\d{4}-\d{2}-\d{2}\.log(\.gz|\.\d+\.gz)?$/)) return null;
        return file;
      }))).filter(Boolean).sort((a, b) => {
        const aDate = a.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '0000-00-00';
        const bDate = b.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '0000-00-00';
        return bDate.localeCompare(aDate);
      });

      console.log(`Found ${validLogFiles.length} valid log files to scan.`);
      const concurrencyLimit = require('os').cpus().length;
      let totalLinesProcessed = 0;
      let totalLinesSkipped = 0;
      const finalIssueMap = new Map();
      let failedLogins = [];
      let suspiciousActivities = [];

      for (let i = 0; i < validLogFiles.length; i += concurrencyLimit) {
        if (Date.now() - startTime > TIMEOUT_PERIOD) {
          logger.warn('Approaching timeout limit, stopping scan');
          break;
        }
        const batch = validLogFiles.slice(i, i + concurrencyLimit);
        const batchPromises = batch.map(file =>
          this.processFile(file, startTime, { vulnerabilityPatterns, suspiciousPatterns })
            .catch(err => {
              logger.error(`Error processing file ${file} in worker: ${err.message}`);
              return { vulnerabilities: { critical: [], medium: [], low: [] }, failedLogins: [], suspiciousActivities: [], linesProcessed: 0, linesSkipped: 0 };
            })
        );

        const results = await Promise.all(batchPromises);

        for (const result of results) {
          totalLinesProcessed += result.linesProcessed;
          totalLinesSkipped += result.linesSkipped;
          failedLogins.push(...result.failedLogins);
          suspiciousActivities.push(...result.suspiciousActivities);
          for (const severity of ['critical', 'medium', 'low']) {
            for (const vuln of result.vulnerabilities[severity]) {
              const aggregationKey = `${vuln.type}_${vuln.service}_${vuln.matchedTerm}`;
              if (finalIssueMap.has(aggregationKey)) {
                const existingIssue = finalIssueMap.get(aggregationKey);
                existingIssue.instanceCount += vuln.instanceCount;
                if (vuln.lastSeen > existingIssue.lastSeen) existingIssue.lastSeen = vuln.lastSeen;
              } else {
                finalIssueMap.set(aggregationKey, { ...vuln });
              }
            }
          }
        }
        console.debug(`Batch processed. Total lines so far: ${totalLinesProcessed}`);
      }

      console.log(`Total lines processed: ${totalLinesProcessed}, Total lines skipped: ${totalLinesSkipped}, time elapsed: ${(Date.now() - startTime) / 1000}s`);
      const vulnerabilities = { critical: [], medium: [], low: [] };
      for (const issue of finalIssueMap.values()) {
        if (vulnerabilities[issue.severity]) {
          vulnerabilities[issue.severity].push(issue);
        }
      }

      failedLogins = this.removeDuplicateLogEntries(failedLogins);
      suspiciousActivities = this.removeDuplicateLogEntries(suspiciousActivities);

      return { vulnerabilities, failedLogins, suspiciousActivities };
    } catch (error) {
      logger.error(`Error in processLogsInParallel: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  // CORRECTED: Restored original functions for backward compatibility, now implemented efficiently.
  async checkLogsForIssues(logsService) {
    logger.info('Legacy checkLogsForIssues called. Checking cache or running full scan.');
    const cached = await this.checkCachedResults();
    if (cached) return cached.vulnerabilityDetails;
    const results = await this.runSecurityScan(logsService);
    return results.vulnerabilityDetails;
  },
  async checkFailedLogins(logsService) {
    logger.info('Legacy checkFailedLogins called. Checking cache or running full scan.');
    const cached = await this.checkCachedResults();
    if (cached) return cached.failedLoginDetails;
    const results = await this.runSecurityScan(logsService);
    return results.failedLoginDetails;
  },
  async checkSuspiciousActivities(logsService) {
    logger.info('Legacy checkSuspiciousActivities called. Checking cache or running full scan.');
    const cached = await this.checkCachedResults();
    if (cached) return cached.suspiciousDetails;
    const results = await this.runSecurityScan(logsService);
    return results.suspiciousDetails;
  },

  deduplicateVulnerabilities(vulnerabilities) {
    const deduplicated = { critical: [], medium: [], low: [] };
    const seen = new Set();
    for (const severity of ['critical', 'medium', 'low']) {
      for (const vuln of vulnerabilities[severity]) {
        const key = `${vuln.type}_${vuln.service}_${vuln.matchedTerm}_${vuln.timestamp}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduplicated[severity].push(vuln);
        }
      }
    }
    return deduplicated;
  },

  parseLogLine(line, file, lineNumber, invalidLogStream) {
    function extractUrl(message) {
      const urlMatch = message.match(/https?:\/\/[^\s]+|(GET|POST|PUT|DELETE)\s+([^\s]+)/i);
      return urlMatch ? (urlMatch[2] || urlMatch[0]) : 'N/A';
    }
    const standardMatch = line.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+\[(\w+)\]\s+([^\s]+(?:\s+[^\s]+)*)\s+(.+)$/);
    if (standardMatch) {
      const [, date, time, level, service, message] = standardMatch;
      const timestamp = DateTime.fromFormat(`${date} ${time}`, 'yyyy-MM-dd HH:mm:ss', { zone: 'utc' });
      if (!timestamp.isValid) {
        if (invalidLogStream) invalidLogStream.write(`[${DateTime.now().toISO()}] Invalid timestamp in ${file} at line ${lineNumber}: ${line}\n`);
        return null;
      }
      return { timestamp: timestamp.toISO(), level, service, message, url: extractUrl(message) };
    }
    try {
      const jsonLog = JSON.parse(line);
      if (jsonLog.timestamp && jsonLog.level && jsonLog.message) {
        const timestamp = DateTime.fromISO(jsonLog.timestamp, { zone: 'utc' });
        if (!timestamp.isValid) {
          if (invalidLogStream) invalidLogStream.write(`[${DateTime.now().toISO()}] Invalid JSON timestamp in ${file} at line ${lineNumber}: ${line}\n`);
          return null;
        }
        return {
          timestamp: timestamp.toISO(),
          level: jsonLog.level.toUpperCase(),
          service: jsonLog.service || 'unknown',
          message: jsonLog.message,
          url: jsonLog.url || extractUrl(jsonLog.message)
        };
      }
    } catch (e) { }
    const fallbackMatch = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(.+)$/);
    if (fallbackMatch) {
      const [, datetime, message] = fallbackMatch;
      const timestamp = DateTime.fromFormat(datetime, 'yyyy-MM-dd HH:mm:ss', { zone: 'utc' });
      if (!timestamp.isValid) {
        if (invalidLogStream) invalidLogStream.write(`[${DateTime.now().toISO()}] Invalid fallback timestamp in ${file} at line ${lineNumber}: ${line}\n`);
        return null;
      }
      return { timestamp: timestamp.toISO(), level: 'UNKNOWN', service: 'unknown', message, url: extractUrl(message) };
    }
    if (invalidLogStream) invalidLogStream.write(`[${DateTime.now().toISO()}] Unrecognized log format in ${file} at line ${lineNumber}: ${line}\n`);
    return null;
  },

  async processFile(file, startTime, patterns) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { file, startTime, patterns }
      });
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    });
  },

  async getLastScanDetails() {
    try {
      console.log('Fetching last scan details');
      const scanResultsFile = '/app/data/security/last-scan-results.json';
      let scanDetails = {
        lastScan: 'Never',
        vulnerabilities: { critical: 0, medium: 0, low: 0, details: [] },
        vulnerabilityDetails: { critical: [], medium: [], low: [] },
        failedLoginDetails: [],
        suspiciousDetails: []
      };

      try {
        const data = await fsPromises.readFile(scanResultsFile, 'utf8');
        scanDetails = JSON.parse(data);
      } catch (error) {
        logger.warn(`No previous scan results found: ${error.message}`);
      }

      return scanDetails;
    } catch (error) {
      logger.error(`Error in getLastScanDetails: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  async scanForVulnerabilities() {
    const vulnerabilities = { critical: [], medium: [], low: [] };
    try {
      console.log('Starting HTTP header vulnerability scan');
      const response = await axios.get('http://localhost:3000', { validateStatus: () => true });
      const headers = response.headers;
      const headerChecks = [
        { header: 'content-security-policy', type: 'missing_csp', severity: 'medium', description: 'Missing Content-Security-Policy header', recommendation: 'Implement a strict CSP to prevent XSS attacks.' },
        { header: 'strict-transport-security', type: 'missing_hsts', severity: 'medium', description: 'Missing Strict-Transport-Security header', recommendation: 'Enable HSTS to enforce HTTPS.' },
        { header: 'x-frame-options', type: 'missing_frame_options', severity: 'medium', description: 'Missing X-Frame-Options header', recommendation: 'Set X-Frame-Options to prevent clickjacking.' }
      ];

      const now = DateTime.now().toISO();
      headerChecks.forEach(check => {
        if (!headers[check.header]) {
          vulnerabilities[check.severity].push({
            type: check.type,
            severity: check.severity,
            description: check.description,
            recommendation: check.recommendation,
            matchedTerm: check.header,
            timestamp: now,
            service: 'http',
            lineNumber: 0,
            url: 'http://localhost:3000',
            firstSeen: now,
            lastSeen: now,
            instanceCount: 1,
            lineNumbers: [0]
          });
        }
      });

      console.log(`Detected header vulnerabilities: Critical=${vulnerabilities.critical.length}, Medium=${vulnerabilities.medium.length}, Low=${vulnerabilities.low.length}`);
      return vulnerabilities;
    } catch (error) {
      logger.error(`Error in scanForVulnerabilities: ${error.message}`, { stack: error.stack });
      return vulnerabilities;
    }
  },

  async checkSecurityHeaders() {
    try {
      const apiUrl = config.api.baseUrl || config.services.api.url;
      const endpoint = config.api.healthEndpoint || '/api/health';
      const fullUrl = `${apiUrl}${endpoint}`;
      const response = await axios.get(fullUrl);
      const headers = response.headers;
      const missingHeaders = [];

      if (!headers['content-security-policy'])
        missingHeaders.push({
          type: 'content_security_policy_header_missing',
          severity: 'medium',
          description: 'CSP header not set, increasing risk of XSS attacks',
          recommendation: 'Implement CSP header with appropriate directives'
        });

      if (!headers['strict-transport-security'])
        missingHeaders.push({
          type: 'strict_transport_security_header_missing',
          severity: 'medium',
          description: 'HSTS header not set, increasing risk of protocol downgrade attacks',
          recommendation: 'Add Strict-Transport-Security header with appropriate max-age'
        });

      if (!headers['x-content-type-options'])
        missingHeaders.push({
          type: 'x_content_type_options_header_missing',
          severity: 'medium',
          description: 'X-Content-Type-Options header not set, increasing risk of MIME type confusion attacks',
          recommendation: 'Add X-Content-Type-Options: nosniff header'
        });

      if (!headers['x-frame-options'])
        missingHeaders.push({
          type: 'x_frame_options_header_missing',
          severity: 'medium',
          description: 'X-Frame-Options header not set, increasing risk of clickjacking attacks',
          recommendation: 'Add X-Frame-Options: SAMEORIGIN header'
        });

      if (!headers['referrer-policy'])
        missingHeaders.push({
          type: 'referrer_policy_header_missing',
          severity: 'low',
          description: 'Referrer-Policy header not set, potentially leaking referrer information',
          recommendation: 'Add Referrer-Policy: no-referrer-when-downgrade header'
        });

      console.debug(`Missing headers found: ${missingHeaders.length}`);
      return missingHeaders;
    } catch (error) {
      logger.error(`Error checking security headers: ${error.message}`);
      return [];
    }
  },

  async checkServerLeakage() {
    try {
      const apiUrl = config.api.baseUrl || config.services.api.url;
      const endpoint = config.api.healthEndpoint || '/api/health';
      const fullUrl = `${apiUrl}${endpoint}`;
      const response = await axios.get(fullUrl);
      const headers = response.headers;
      const leakageIssues = [];

      if (headers['x-powered-by'])
        leakageIssues.push({
          type: 'server_leaks_x_powered_by',
          severity: 'medium',
          description: `X-Powered-By header reveals server technology: ${headers['x-powered-by']}`,
          recommendation: 'Remove X-Powered-By header in server configuration'
        });

      if (headers['server'] && headers['server'].includes('/'))
        leakageIssues.push({
          type: 'server_leaks_version',
          severity: 'medium',
          description: `Server header reveals version information: ${headers['server']}`,
          recommendation: 'Configure server to remove version information from Server header'
        });

      console.debug(`Server leakage issues found: ${leakageIssues.length}`);
      return leakageIssues;
    } catch (error) {
      logger.error(`Error checking server information leakage: ${error.message}`);
      return [];
    }
  },

  async checkTimestampDisclosure() {
    try {
      const apiUrl = config.api.baseUrl || config.services.api.url;
      const endpointsToCheck = config.api.endpoints || ['/api/users', '/api/logs', '/api/status'];
      const disclosureIssues = [];

      for (const endpoint of endpointsToCheck) {
        try {
          const response = await axios.get(`${apiUrl}${endpoint}`);
          const responseText = JSON.stringify(response.data);
          const timestampRegex = /\b\d{10}\b/g;
          const matches = responseText.match(timestampRegex);
          if (matches && matches.length > 0) {
            disclosureIssues.push({
              type: 'timestamp_disclosure',
              severity: 'medium',
              description: `Unix timestamps exposed in ${endpoint} response`,
              count: matches.length,
              recommendation: 'Format timestamps as ISO strings or human-readable dates before sending to client'
            });
          }
        } catch (err) {
          console.debug(`Skipping timestamp check for ${endpoint}: ${err.message}`);
          continue;
        }
      }

      console.debug(`Timestamp disclosure issues found: ${disclosureIssues.length}`);
      return disclosureIssues;
    } catch (error) {
      logger.error(`Error checking timestamp disclosure: ${error.message}`);
      return [];
    }
  },

  async checkCorsConfiguration() {
    try {
      const apiUrl = config.api.baseUrl || config.services.api.url;
      const endpoint = config.api.healthEndpoint || '/api/health';
      const fullUrl = `${apiUrl}${endpoint}`;
      const response = await axios({
        method: 'options',
        url: fullUrl,
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET'
        }
      });

      const headers = response.headers;
      const corsIssues = [];

      if (headers['access-control-allow-origin'] === '*') {
        corsIssues.push({
          type: 'cross_domain_misconfiguration',
          severity: 'medium',
          description: 'CORS allows requests from any origin (*)',
          recommendation: 'Configure CORS to allow only specific trusted domains'
        });
      }

      console.debug(`CORS issues found: ${corsIssues.length}`);
      return corsIssues;
    } catch (error) {
      logger.error(`Error checking CORS configuration: ${error.message}`);
      return [];
    }
  },

  async checkHiddenFiles() {
    try {
      const apiUrl = config.api.baseUrl || config.services.api.url;
      const hiddenFiles = ['/.env', '/.git/config', '/.gitignore', '/.npmrc', '/node_modules/.package-lock.json', '/.well-known/security.txt', '/.well-known/appspecific/com.chrome.devtools.json'];
      const foundFiles = [];

      for (const file of hiddenFiles) {
        try {
          const response = await axios.get(`${apiUrl}${file}`);
          if (response.status !== 404) {
            foundFiles.push({
              type: 'hidden_file_found',
              severity: 'medium',
              description: `Hidden file accessible: ${file}`,
              recommendation: 'Block access to hidden files and development artifacts'
            });
          }
        } catch (err) {
          if (err.response && err.response.status !== 404) {
            foundFiles.push({
              type: 'potential_hidden_file',
              severity: 'low',
              description: `Unusual response for hidden file: ${file} (${err.response?.status})`,
              recommendation: 'Verify server configuration for handling hidden files'
            });
          }
        }
      }

      console.debug(`Hidden file issues found: ${foundFiles.length}`);
      return foundFiles;
    } catch (error) {
      logger.error(`Error checking hidden files: ${error.message}`);
      return [];
    }
  },

  removeDuplicateLogEntries(logEntries) {
    const seen = new Set();
    logEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return logEntries.filter(entry => {
      const key = `${entry.timestamp}|${entry.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },

  async loginIssues(logsService) {
    if (!logsService) throw new Error('LogsService is required for loginIssues');
    try {
      const loginKeywords = ['login', 'failed', 'unauthorized', 'disabled', 'expired', 'invalid', 'access denied', 'account'];
      const suspiciousKeywords = ['suspicious', 'brute force', 'injection', 'attack', 'breach', 'security', 'vulnerability', 'exploit', 'ip blocked', 'threat detection'];
      const allKeywords = [...new Set([...loginKeywords, ...suspiciousKeywords])];
      console.debug(`Checking logs with keywords: ${allKeywords.join(', ')}`);

      let loginIssues = [];
      let suspiciousIssues = [];

      const today = new Date();
      const daysAgo = new Date(today);
      daysAgo.setDate(today.getDate() - DAYS_TO_PROCESS);

      try {
        const results = await logsService.searchLogs({
          term: allKeywords.join('|'),
          dateRange: 'custom',
          startDate: daysAgo.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
          includeArchived: true
        });
        console.debug(`Found ${results.logs?.length || 0} logs matching keywords`);

        if (results.logs && results.logs.length > 0) {
          for (const log of results.logs) {
            const messageLower = log.message.toLowerCase();
            const timestamp = `${log.date} ${log.time}`;
            const loginMatch = loginKeywords.find(keyword => messageLower.includes(keyword.toLowerCase()));
            const suspiciousMatch = suspiciousKeywords.find(keyword => messageLower.includes(keyword.toLowerCase()));

            if (loginMatch) {
              loginIssues.push({
                timestamp,
                level: log.level,
                message: log.message,
                service: log.service,
                type: 'authentication_issue',
                matchedTerm: loginMatch
              });
            }

            if (suspiciousMatch && !loginMatch) {
              suspiciousIssues.push({
                timestamp,
                level: log.level,
                message: log.message,
                service: log.service,
                type: 'suspicious',
                matchedTerm: suspiciousMatch
              });
            }
          }
        }
      } catch (error) {
        logger.error(`Error searching logs: ${error.message}`, { stack: error.stack });
      }

      const uniqueLoginIssues = this.removeDuplicateLogEntries(loginIssues);
      const uniqueSuspiciousIssues = this.removeDuplicateLogEntries(suspiciousIssues);

      return {
        loginIssues: { count: uniqueLoginIssues.length, details: uniqueLoginIssues },
        suspiciousActivities: { count: uniqueSuspiciousIssues.length, details: uniqueSuspiciousIssues }
      };
    } catch (error) {
      logger.error(`Error checking logs: ${error.message}`, { stack: error.stack });
      return {
        loginIssues: { count: 0, details: [] },
        suspiciousActivities: { count: 0, details: [] }
      };
    }
  },

  generateRecommendations(loginIssues, suspiciousActivities, vulnerabilities) {
    const recommendations = [];

    if (loginIssues.count > 0) {
      const disabledAccountCount = loginIssues.details.filter(issue => issue.message.includes('disabled')).length;
      if (disabledAccountCount > 0) {
        recommendations.push({
          severity: 'medium',
          title: 'Review Disabled Accounts',
          description: `${disabledAccountCount} login attempts to disabled accounts detected`,
          action: 'Review account status in user management and verify if account disabling is legitimate'
        });
      }
      recommendations.push({
        severity: 'medium',
        title: 'Improve Authentication Security',
        description: `${loginIssues.count} authentication issues detected`,
        action: 'Consider implementing account lockout policies and multi-factor authentication'
      });
    }

    if (vulnerabilities.critical.length > 0) {
      recommendations.push({
        severity: 'critical',
        title: 'Fix Critical Server Errors',
        description: `${vulnerabilities.critical.length} critical server errors detected`,
        action: 'Investigate and fix server errors immediately to prevent service disruption and potential security breaches'
      });
    }

    if (vulnerabilities.medium.length > 0) {
      const sensitiveFileAccess = vulnerabilities.medium.filter(v => v.type === 'sensitive_file_access');
      if (sensitiveFileAccess.length > 0) {
        recommendations.push({
          severity: 'medium',
          title: 'Secure Sensitive File Access',
          description: `${sensitiveFileAccess.length} attempts to access sensitive files detected`,
          action: 'Ensure .env, .git, and other sensitive files are not exposed; implement stricter access controls and consider IP blocking for repeated attempts'
        });
      }

      const dbIssues = vulnerabilities.medium.filter(v => v.type.includes('database') || v.type === 'db_error');
      if (dbIssues.length > 0) {
        recommendations.push({
          severity: 'medium',
          title: 'Resolve Database Issues',
          description: `${dbIssues.length} database-related issues detected`,
          action: 'Review database configuration, connections, and query handling'
        });
      }

      const jwtIssues = vulnerabilities.medium.filter(v => v.type.includes('jwt') || v.type === 'token_issue');
      if (jwtIssues.length > 0) {
        recommendations.push({
          severity: 'medium',
          title: 'Fix Authentication Token Issues',
          description: 'JWT token verification failures detected',
          action: 'Review token expiration settings and refresh token implementation'
        });
      }

      const headerIssues = vulnerabilities.medium.filter(v => v.type.includes('header'));
      if (headerIssues.length > 0) {
        recommendations.push({
          severity: 'medium',
          title: 'Implement Security Headers',
          description: `${headerIssues.length} missing security headers detected`,
          action: 'Configure server to add proper security headers for all responses'
        });
      }

      const leakageIssues = vulnerabilities.medium.filter(v => v.type.includes('leaks') || v.type.includes('disclosure'));
      if (leakageIssues.length > 0) {
        recommendations.push({
          severity: 'medium',
          title: 'Prevent Information Leakage',
          description: `${leakageIssues.length} instances of information leakage detected`,
          action: 'Configure server to prevent leaking version information and hide internal details'
        });
      }

      const corsIssues = vulnerabilities.medium.filter(v => v.type.includes('cross_domain'));
      if (corsIssues.length > 0) {
        recommendations.push({
          severity: 'medium',
          title: 'Fix CORS Configuration',
          description: 'Cross-Origin Resource Sharing (CORS) is too permissive',
          action: 'Restrict CORS to only allow trusted domains instead of wildcard (*) origin'
        });
      }

      const ipBlockedIssues = vulnerabilities.medium.filter(v => v.type === 'ip_blocked');
      if (ipBlockedIssues.length > 0) {
        recommendations.push({
          severity: 'medium',
          title: 'Review IP Blocking Events',
          description: `${ipBlockedIssues.length} IP blocking events detected`,
          action: 'Investigate blocked IPs for malicious activity and review rate limiting policies'
        });
      }

      const authFailureIssues = vulnerabilities.medium.filter(v => v.type === 'auth_failure_401');
      if (authFailureIssues.length > 0) {
        recommendations.push({
          severity: 'medium',
          title: 'Address Unauthorized Access Attempts',
          description: `${authFailureIssues.length} 401 unauthorized access attempts detected`,
          action: 'Enhance authentication mechanisms and monitor for brute force attacks'
        });
      }
    }

    if (vulnerabilities.low.length > 0) {
      const nonCriticalFileAccess = vulnerabilities.low.filter(v => v.type === 'non_critical_file_access');
      if (nonCriticalFileAccess.length > 0) {
        recommendations.push({
          severity: 'low',
          title: 'Review Non-Critical File Access',
          description: `${nonCriticalFileAccess.length} attempts to access non-critical configuration files detected`,
          action: 'Verify if these files need to be publicly accessible or should be blocked'
        });
      }

      const missingResources = vulnerabilities.low.filter(v => v.type === 'missing_resource' || v.type === 'not_found_404');
      if (missingResources.length > 0) {
        recommendations.push({
          severity: 'low',
          title: 'Fix Missing Resources',
          description: `${missingResources.length} endpoints returning 404 errors`,
          action: 'Update application to remove references to non-existent endpoints or implement the missing resources'
        });
      }

      const registrationIssues = vulnerabilities.low.filter(v => v.type === 'registration_failure');
      if (registrationIssues.length > 0) {
        recommendations.push({
          severity: 'low',
          title: 'Monitor Registration Attempts',
          description: `${registrationIssues.length} failed registration attempts detected`,
          action: 'Implement CAPTCHA or rate limiting to prevent automated registration abuse'
        });
      }

      const logLimitIssues = vulnerabilities.low.filter(v => v.type === 'log_limit_exceeded');
      if (logLimitIssues.length > 0) {
        recommendations.push({
          severity: 'low',
          title: 'Optimize Log Processing',
          description: `${logLimitIssues.length} log files exceeded processing limits`,
          action: 'Adjust log rotation policies or increase scan capacity'
        });
      }
    }

    recommendations.push({
      severity: 'low',
      title: 'Regular Security Maintenance',
      description: 'Proactive security measures',
      action: 'Implement regular security audits, keep dependencies updated, and consider penetration testing'
    });

    console.debug(`Generated recommendations: ${recommendations.length}`);
    return recommendations;
  },

  async saveScanResults(results) {
    logger.info('*** SAVE_SCAN_RESULTS_START ***');
    try {
      const dataDir = '/app/data/security';
      const resultsPath = path.join(dataDir, 'last-scan-results.json');
      console.log(`Saving scan results to directory: ${dataDir}, file: ${resultsPath}`);
      await fsPromises.mkdir(dataDir, { recursive: true });
      await fsPromises.writeFile(resultsPath, JSON.stringify(results, null, 2), { mode: 0o666 });
      logger.info(`Security scan results saved successfully to ${resultsPath}`);
    } catch (error) {
      logger.error(`Error saving scan results: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }
};

// --- WORKER THREAD LOGIC ---
if (!isMainThread) {
  const { file, startTime, patterns } = workerData;
  const fs = require('fs');
  const readline = require('readline');
  const zlib = require('zlib');
  const { DateTime } = require('luxon');

  const parseLogLine = securityScanService.parseLogLine;

  const results = {
    vulnerabilities: { critical: [], medium: [], low: [] },
    failedLogins: [],
    suspiciousActivities: [],
    linesProcessed: 0,
    linesSkipped: 0
  };
  const issueMap = new Map();
  let invalidLogStream = null;

  try {
    // This stream is for debugging parsing issues, and can be created if needed
  } catch (err) {
    console.error(`Error creating invalid log stream for ${file}: ${err.message}`);
  }

  const processLine = (line, lineNumber) => {
    if (Date.now() - startTime > TIMEOUT_PERIOD) return false;
    results.linesProcessed++;
    const parsedLog = parseLogLine(line, file, lineNumber, invalidLogStream);
    if (!parsedLog) {
      results.linesSkipped++;
      return true;
    }

    const { timestamp, message, url, level } = parsedLog;

    if (/Initiating security scan|Starting comprehensive security scan|Parsed \d+ total log entries|Security scan completed/i.test(message)) {
      results.linesSkipped++;
      return true;
    }

    patterns.vulnerabilityPatterns.forEach(pattern => {
      const match = message.match(pattern.regex);
      if (match) {
        const matchedTerm = match[1] || match[0];
        const aggregationKey = `${pattern.type}_${pattern.service}_${matchedTerm}`;

        if (!issueMap.has(aggregationKey)) {
          const newVuln = {
            type: pattern.type,
            severity: pattern.severity,
            description: pattern.description,
            recommendation: pattern.recommendation,
            matchedTerm,
            timestamp,
            service: pattern.service,
            url,
            firstSeen: timestamp,
            lastSeen: timestamp,
            instanceCount: 1,
          };
          issueMap.set(aggregationKey, newVuln);
          results.vulnerabilities[pattern.severity].push(newVuln);
        } else {
          const issue = issueMap.get(aggregationKey);
          issue.instanceCount++;
          issue.lastSeen = timestamp;
        }
      }
    });

    if (/Invalid credentials|failed login/i.test(message)) {
      results.failedLogins.push({ timestamp, level, message });
    }

    if (patterns.suspiciousPatterns.some(pattern => pattern.test(message))) {
      results.suspiciousActivities.push({ timestamp, level, message });
    }

    return true;
  };

  const stream = fs.createReadStream(file);
  const rl = readline.createInterface({
    input: file.endsWith('.gz') ? stream.pipe(zlib.createGunzip()) : stream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;
  rl.on('line', (line) => {
    lineNumber++;
    if (!processLine(line, lineNumber)) {
      rl.close();
    }
  });

  rl.on('close', () => {
    parentPort.postMessage(results);
    if (invalidLogStream) invalidLogStream.end();
  });

  rl.on('error', (err) => {
    console.error(`Error reading ${file} in worker: ${err.message}`);
    parentPort.postMessage(results);
    if (invalidLogStream) invalidLogStream.end();
  });
}

module.exports = securityScanService;