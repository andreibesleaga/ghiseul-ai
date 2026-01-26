const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../shared-lib');
const zlib = require('zlib');
const util = require('util');

// Promisify zlib methods
const gunzip = util.promisify(zlib.gunzip);

// Set maximum log file size to prevent stack overflow
const MAX_LOG_FILE_SIZE = 20 * 1024 * 1024; // 20MB
// Set maximum number of lines to process at once
const MAX_LINES_TO_PROCESS = 200000;

/**
 * Service for managing system logs
 */
class LogsService {
  constructor() {
    if (LogsService.instance) {
      return LogsService.instance;
    }
    this.initialized = false;
    logger.info('LogsService constructor called');
    LogsService.instance = this;
    return this;
  }

  static getInstance() {
    if (!LogsService.instance) {
      LogsService.instance = new LogsService();
    }
    return LogsService.instance;
  }

  /**
   * Initialize the LogsService
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      logger.debug('LogsService already initialized, skipping');
      return;
    }
    try {
      // Ensure logs directory exists
      const logDir = path.join(__dirname, '../logs');
      await fs.access(logDir).catch(async () => {
        await fs.mkdir(logDir, { recursive: true });
        logger.info(`Created logs directory: ${logDir}`);
      });
      this.initialized = true;
      logger.info('LogsService initialized successfully');
    } catch (error) {
      logger.error(`Error initializing LogsService: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  /**
   * Get a summary of logs grouped by type and service
   */
  async getLogsSummary(options = {}) {
    try {
      logger.info('Getting logs summary with options:', options);
      const date = options.date || new Date().toISOString().split('T')[0];
      logger.info(`Getting summary for date: ${date}`);
  
      // Use same file selection logic as searchLogs
      const logFiles = await this.getLogFilesInRange(date, date, true);
      logger.info(`[SUMMARY-DEBUG] Found ${logFiles.length} files for summary: ${logFiles.join(', ')}`);
  
      if (logFiles.length === 0) {
        logger.warn(`No log files found for date ${date}`);
        return { errors: [], warnings: [], date };
      }
  
      let allParsedLogs = [];
      for (const logFile of logFiles) {
        try {
          const logContent = await this.readLogFile(logFile);
          let logLines = logContent.split('\n').filter(line => line.trim() !== '');
  
          if (logLines.length > MAX_LINES_TO_PROCESS) {
            logger.warn(`Too many log lines in ${logFile}, limiting to ${MAX_LINES_TO_PROCESS}`);
            logLines = logLines.slice(0, MAX_LINES_TO_PROCESS);
          }
  
          // Use same parsing logic as searchLogs
          const isErrorLog = logFile.includes('error');
          const parsedLogs = this.parseLogs(logLines, isErrorLog ? 'ERROR' : null);
          allParsedLogs.push(...parsedLogs);
        } catch (fileError) {
          logger.error(`Error processing file ${logFile} for summary: ${fileError.message}`);
        }
      }
  
      logger.info(`[SUMMARY-DEBUG] Total parsed entries from all files: ${allParsedLogs.length}`);
  
      // Filter logs for the specified date
      const filteredLogs = allParsedLogs.filter(log => log.date === date);
      logger.info(`[SUMMARY-DEBUG] Filtered logs for date ${date}: ${filteredLogs.length}`);
  
      const errorLogs = filteredLogs.filter(log => log.level === 'ERROR');
      const warningLogs = filteredLogs.filter(log => log.level === 'WARN' || log.level === 'WARNING');
      logger.info(`[SUMMARY-DEBUG] Filtered counts: ${errorLogs.length} ERRORs, ${warningLogs.length} WARNs`);
  
      const errorLogsSummary = this.groupLogs(errorLogs);
      const warningLogsSummary = this.groupLogs(warningLogs);
      logger.info(`[SUMMARY-DEBUG] Grouped summary: ${errorLogsSummary.length} error types, ${warningLogsSummary.length} warning types.`);
  
      const finalResult = { errors: errorLogsSummary, warnings: warningLogsSummary, date };
      logger.info(`[SUMMARY-DEBUG] Final summary object:`, JSON.stringify(finalResult, null, 2));
  
      return finalResult;
    } catch (error) {
      logger.error(`Error in getLogsSummary: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  /**
   * Search logs with filtering
   */
  async searchLogs(options = {}) {
    try {
      logger.debug('Searching logs with options:', options);

      if (!this.getDateRange || !this.getLogFilesInRange || !this.readLogFile || !this.parseLogs) {
        logger.error('One or more required methods are undefined in LogsService', {
          getDateRange: !!this.getDateRange,
          getLogFilesInRange: !!this.getLogFilesInRange,
          readLogFile: !!this.readLogFile,
          parseLogs: !!this.parseLogs
        });
        throw new Error('Required methods are undefined');
      }

      let searchParams = options;
      if (options.params && typeof options.params === 'string') {
        try {
          searchParams = JSON.parse(options.params);
          logger.info('Parsed search parameters:', searchParams);
        } catch (e) {
          logger.error('Failed to parse search parameters:', e);
        }
      }

      const { startDate, endDate } = this.getDateRange(searchParams);
      logger.debug(`Using date range: ${startDate} to ${endDate}`);

      const logFiles = await this.getLogFilesInRange(startDate, endDate, searchParams.includeArchived);
      logger.info(`Found ${logFiles.length} log files to search:`, logFiles);

      const allLogs = [];
      let totalLinesProcessed = 0;

      for (const file of logFiles) {
        try {
          logger.debug(`Reading log file: ${file}`);
          const logContent = await this.readLogFile(file);
          let logLines = logContent.split('\n').filter(line => line.trim() !== '');

          totalLinesProcessed += logLines.length;

          if (logLines.length > MAX_LINES_TO_PROCESS) {
            logger.warn(`Too many log lines in ${file} (${logLines.length}), limiting to ${MAX_LINES_TO_PROCESS}`);
            logLines = logLines.slice(0, MAX_LINES_TO_PROCESS);
          }

          logger.debug(`Found ${logLines.length} lines in ${file}`);
          const isErrorLog = file.includes('error');
          const parsedLogs = this.parseLogs(logLines, isErrorLog ? 'ERROR' : null);
          logger.debug(`Parsed ${parsedLogs.length} logs from ${file}`);
          allLogs.push(...parsedLogs);
        } catch (error) {
          logger.error(`Error processing log file ${file}: ${error.message}`);
        }
      }

      logger.info(`Parsed ${allLogs.length} total log entries from ${totalLinesProcessed} lines before filtering`);

      let filteredLogs = allLogs.filter(log => log.date >= startDate && log.date <= endDate);
      logger.debug(`After date filter: ${filteredLogs.length} logs`);

      if (searchParams.level && searchParams.level.trim() !== '') {
        const targetLevel = searchParams.level.toUpperCase();
        filteredLogs = filteredLogs.filter(log =>
          log.level === targetLevel || (targetLevel === 'WARN' && log.level === 'WARNING')
        );
        logger.debug(`After level filter (${targetLevel}): ${filteredLogs.length} logs`);
      }

      if (searchParams.service && searchParams.service.trim() !== '') {
        filteredLogs = filteredLogs.filter(log =>
          log.service && log.service.toLowerCase().includes(searchParams.service.toLowerCase())
        );
        logger.debug(`After service filter (${searchParams.service}): ${filteredLogs.length} logs`);
      }

      if (searchParams.term && searchParams.term.trim() !== '') {
        filteredLogs = filteredLogs.filter(log =>
          log.message && log.message.toLowerCase().includes(searchParams.term.toLowerCase())
        );
        logger.debug(`After term filter (${searchParams.term}): ${filteredLogs.length} logs`);
      }

      filteredLogs.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`);
      });

      logger.debug(`Sorting logs by date and time (most recent first)`);

      const limit = searchParams.limit ? parseInt(searchParams.limit, 10) : 1000;
      if (filteredLogs.length > limit) {
        filteredLogs = filteredLogs.slice(0, limit);
        logger.debug(`Limiting logs to ${limit}`);
      }

      const formattedLogs = filteredLogs.map(log => ({
        date: log.date,
        time: log.time,
        level: log.level,
        service: log.service,
        message: log.message,
      }));

      logger.debug(`Log search response: ${formattedLogs.length} logs returned out of ${allLogs.length} total`);

      return {
        logs: formattedLogs,
        total: formattedLogs.length,
      };
    } catch (error) {
      logger.error(`Error in searchLogs: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  /**
   * Check if a file exists
   * @param {string} filePath - Path to the file
   * @returns {Promise<boolean>} Whether the file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.debug(`File does not exist: ${filePath}`);
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Read file content, handling both compressed and uncompressed files
   */
  async readLogFile(filePath) {
    try {
      logger.debug(`Attempting to read file: ${filePath}`);

      // Try to read the file directly first
      try {
        await fs.access(filePath);
        const stats = await fs.stat(filePath);

        if (stats.size > MAX_LOG_FILE_SIZE) {
          logger.warn(`Log file too large (${Math.round(stats.size / 1024 / 1024)}MB), reading first ${Math.round(MAX_LOG_FILE_SIZE / 1024 / 1024)}MB`);
          const fileHandle = await fs.open(filePath, 'r');
          const buffer = Buffer.alloc(MAX_LOG_FILE_SIZE);
          await fileHandle.read(buffer, 0, MAX_LOG_FILE_SIZE, 0);
          await fileHandle.close();
          const content = buffer.toString('utf8');
          logger.debug(`Read large file: ${filePath}`);
          return content;
        }

        if (filePath.endsWith('.gz')) {
          const compressedData = await fs.readFile(filePath);
          const decompressedData = await gunzip(compressedData);
          const content = decompressedData.toString('utf8');
          logger.debug(`Successfully read and decompressed: ${filePath}`);
          return content;
        }

        const content = await fs.readFile(filePath, 'utf8');
        logger.debug(`Read file: ${filePath}`);
        return content;
      } catch (error) {
        logger.error(`Error reading file ${filePath}: ${error.message}`);
        throw error;
      }
    } catch (err) {
      logger.error(`Error reading file ${filePath}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get all log files in the specified date range
   */
  async getLogFilesInRange(startDate, endDate, includeArchived = true) {
    try {
      const logDir = path.join(__dirname, '../logs');
      logger.debug(`Checking logs directory: ${logDir}`);
  
      try {
        await fs.access(logDir);
      } catch (error) {
        logger.error(`Logs directory does not exist: ${logDir}`);
        return [];
      }
  
      const files = await fs.readdir(logDir);
      logger.debug(`Files in logs directory: ${files.join(', ')}`);
      const logFiles = [];
      const today = new Date().toISOString().split('T')[0];
  
      if (new Date(startDate) > new Date(endDate)) {
        logger.error(`Invalid date range: startDate (${startDate}) is after endDate (${endDate})`);
        return [];
      }
  
      if (startDate <= today && today <= endDate) {
        const currentLogs = ['combined.log', 'combined1.log', 'error.log'];
        for (const file of currentLogs) {
          const filePath = path.join(logDir, file);
          try {
            await fs.access(filePath, fs.constants.R_OK);
            logFiles.push(filePath);
            logger.debug(`Added current active log: ${filePath}`);
          } catch (error) {
            logger.debug(`Current log not accessible: ${filePath}, error: ${error.message}`);
          }
        }
      }
  
      if (includeArchived) {
        for (const file of files) {
          const dateMatch = file.match(/^(combined|error)-(\d{4}-\d{2}-\d{2})\.log(?:\.\d+)?(?:\.gz)?$/);
          if (!dateMatch) {
            logger.debug(`File does not match date pattern: ${file}`);
            continue;
          }
  
          const [, logType, fileDate] = dateMatch;
          if (fileDate >= startDate && fileDate <= endDate) {
            const filePath = path.join(logDir, file);
            try {
              await fs.access(filePath, fs.constants.R_OK);
              logFiles.push(filePath);
              logger.debug(`Added dated log file: ${filePath}`);
            } catch (error) {
              logger.debug(`Could not access log file ${filePath}: ${error.message}`);
            }
          } else {
            logger.debug(`File ${file} date ${fileDate} out of range ${startDate} to ${endDate}`);
          }
        }
      }
  
      logFiles.sort((a, b) => {
        const aFile = path.basename(a);
        const bFile = path.basename(b);
  
        if (aFile.startsWith('combined.log') || aFile.startsWith('combined1.log') || aFile.startsWith('error.log')) return -1;
        if (bFile.startsWith('combined.log') || bFile.startsWith('combined1.log') || bFile.startsWith('error.log')) return 1;
  
        const aMatch = aFile.match(/^(combined|error)-(\d{4}-\d{2}-\d{2})\.log(?:\.(\d+))?(?:\.gz)?$/);
        const bMatch = bFile.match(/^(combined|error)-(\d{4}-\d{2}-\d{2})\.log(?:\.(\d+))?(?:\.gz)?$/);
  
        if (!aMatch || !bMatch) return aFile.localeCompare(bFile);
  
        const [, aType, aDate, aSuffix] = aMatch;
        const [, bType, bDate, bSuffix] = bMatch;
  
        if (aDate !== bDate) return bDate.localeCompare(aDate);
        if (aType !== bType) return aType.localeCompare(bType);
  
        const aNum = aSuffix ? parseInt(aSuffix, 10) : 0;
        const bNum = bSuffix ? parseInt(aSuffix, 10) : 0;
        return aNum - bNum;
      });
  
      if (logFiles.length === 0) {
        logger.warn(`No log files found for date range ${startDate} to ${endDate}`);
      } else {
        logger.info(`Found ${logFiles.length} log files in range ${startDate} to ${endDate}: ${logFiles.join(', ')}`);
      }
  
      // Temporary debug: List file sizes
      for (const filePath of logFiles) {
        try {
          const stats = await fs.stat(filePath);
          logger.debug(`File ${filePath}: size=${stats.size} bytes, modified=${stats.mtime}`);
        } catch (error) {
          logger.debug(`Could not stat file ${filePath}: ${error.message}`);
        }
      }
  
      return [...new Set(logFiles)];
    } catch (error) {
      logger.error(`Error getting log files: ${error.message}`, { stack: error.stack });
      return [];
    }
  }

  /**
   * Extract date from a log filename
   * @param {string} filename - Log filename
   * @returns {string|null} Extracted date in yyyy-MM-dd format or null
   */
  extractDateFromFilename(filename) {
    if (!filename) return null;
    const match = filename.match(/(?:combined|error)-(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }

  /**
   * Extract logs of a specific level from log lines
   * @param {Array} logLines - Raw log lines
   * @param {string} level - Log level to extract
   * @returns {Array} Extracted logs
   */
  extractLogs(logLines, level) {
    logger.debug(`Extracting logs with level: ${level}`);

    const logs = logLines
      .filter(line => {
        return line.includes(`[${level}]`) ||
          line.includes(`[${level}]:`) ||
          (level === 'WARN' && (line.includes('[WARNING]') || line.includes('[WARNING]:'))) ||
          (level === 'DEBUG' && (line.includes('[DEBUG]') || line.includes('[DEBUG]:')));
      })
      .map(line => {
        const match = line.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+\[([^\]]+)\]:\s+(.*)/);
        if (!match) return null;

        const [, date, time, logLevel, message] = match;
        let normalizedLevel = logLevel;
        if (normalizedLevel === 'WARNING') {
          normalizedLevel = 'WARN';
        }

        let service = 'System';
        try {
          const serviceMatch = message.match(/\[([^\]]+)\]/);
          if (serviceMatch) {
            service = serviceMatch[1];
          } else if (message.includes('API Gateway')) {
            service = 'API Gateway';
          } // ... more service detections
        } catch (error) {
          logger.warn(`Error detecting service from message: ${error.message}`);
        }

        return { date, time, level: normalizedLevel, message, service };
      })
      .filter(log => log !== null);

    logger.debug(`Extracted ${logs.length} logs with level ${level}`);
    return logs;
  }

  /**
   * Group logs by type and service for summary
   * @param {Array} logs - Parsed log entries
   * @returns {Array} Grouped logs summary
   */
  groupLogs(logs) {
    const groups = {};

    // Define patterns to identify common log types for accurate grouping
    const summaryPatterns = [
      { regex: /connection timeout/i, type: 'Connection Timeout' },
      { regex: /database query failed/i, type: 'Database Query Failed' },
      { regex: /authentication failure/i, type: 'Authentication Failure' },
      { regex: /invalid token/i, type: 'Invalid Token' },
      { regex: /disk space below threshold/i, type: 'Disk Space Below Threshold' },
      { regex: /slow query performance/i, type: 'Slow Query Performance' },
      { regex: /rate limit approaching/i, type: 'Rate Limit Approaching' },
      { regex: /ENOENT: no such file or directory/i, type: 'File Not Found' }
    ];

    logs.forEach(log => {
      try {
        let matchedType = null;
        const service = log.service || 'System';

        // Try to match against known patterns for a clean summary type
        for (const pattern of summaryPatterns) {
          if (log.message && pattern.regex.test(log.message)) {
            matchedType = pattern.type;
            break;
          }
        }

        // If no specific pattern matched, use a generic fallback
        if (!matchedType) {
          if (log.message && log.message.split) {
            matchedType = log.message.split(':')[0] || 'Generic Event';
            // Sanitize long generic types
            if (matchedType.length > 50) {
              matchedType = matchedType.substring(0, 50) + '...';
            }
          } else {
            matchedType = 'Unknown Event';
          }
        }

        const key = `${matchedType}|${service}`;

        if (!groups[key]) {
          groups[key] = {
            type: matchedType,
            typeKey: matchedType.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
            service,
            count: 0
          };
        }
        groups[key].count++;
      } catch (error) {
        logger.warn(`Error grouping log: ${error.message}`);
      }
    });
    return Object.values(groups);
  }

  /**
 * Parse raw log lines into structured log objects
 */
  parseLogs(logLines, defaultLevel = null) {
    try {
      const logs = [];
      const processedLines = new Set();
      let currentLog = null;

      for (let index = 0; index < logLines.length; index++) {
        try {
          const line = logLines[index];
          if (!line || typeof line !== 'string' || line.trim() === '' || processedLines.has(line)) {
            continue;
          }

          processedLines.add(line);
          const trimmedLine = line.trim();

          if (trimmedLine.match(/^={10,}$/)) {
            continue;
          }

          if (trimmedLine.includes('[DEBUG]: Skipping unparseable log line:')) {
            const embeddedMatch = trimmedLine.match(/\[DEBUG\]: Skipping unparseable log line: (.+)/);
            if (embeddedMatch) {
              const embeddedLine = embeddedMatch[1].trim();
              if (embeddedLine && !processedLines.has(embeddedLine)) {
                const embeddedLogs = this.parseLogs([embeddedLine], defaultLevel);
                logs.push(...embeddedLogs);
                processedLines.add(embeddedLine);
              }
            }
            continue;
          }

          if (trimmedLine.startsWith(`${trimmedLine.split(' ')[0]} [DEBUG]:`) && trimmedLine.includes(':')) {
            const messageStart = trimmedLine.indexOf(':') + 1;
            const debugMessage = trimmedLine.slice(messageStart).trim();
            if (debugMessage) {
              const potentialEmbeddedLogs = debugMessage.split(/(?:\n|;|\|)/).map(l => l.trim()).filter(l => l);
              for (const embeddedLine of potentialEmbeddedLogs) {
                if (embeddedLine && !processedLines.has(embeddedLine)) {
                  const embeddedLogs = this.parseLogs([embeddedLine], defaultLevel);
                  logs.push(...embeddedLogs);
                  processedLines.add(embeddedLine);
                }
              }
            }
          }

          const standardMatch = trimmedLine.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+\[([^\]]+)\]:\s*(.*)/);
          if (standardMatch) {
            const [, date, time, level, message] = standardMatch;
            if (!message || message.trim() === '') continue;
            let normalizedLevel = defaultLevel || level.toUpperCase();
            if (normalizedLevel === 'WARNING') normalizedLevel = 'WARN';
            currentLog = { date, time, level: normalizedLevel, message: message.trim(), service: this.detectService(message) };
            logs.push(currentLog);
            continue;
          }

          const altMatch = trimmedLine.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+\[([^\]]+)\]\s+(.*)/);
          if (altMatch) {
            const [, date, time, level, message] = altMatch;
            if (!message || message.trim() === '') continue;
            let normalizedLevel = defaultLevel || level.toUpperCase();
            if (normalizedLevel === 'WARNING') normalizedLevel = 'WARN';
            currentLog = { date, time, level: normalizedLevel, message: message.trim(), service: this.detectService(message) };
            logs.push(currentLog);
            continue;
          }

          const dateTimeOnlyMatch = trimmedLine.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.*)/);
          if (dateTimeOnlyMatch) {
            const [, date, time, message] = dateTimeOnlyMatch;
            if (!message || message.trim() === '') continue;
            let detectedLevel = defaultLevel || this.detectLogLevel(message);
            if (detectedLevel === 'WARNING') detectedLevel = 'WARN';
            currentLog = { date, time, level: detectedLevel, message: message.trim(), service: this.detectService(message) };
            logs.push(currentLog);
            continue;
          }

          if (currentLog && trimmedLine.match(/^(?:[A-Z]+\s+|{|\[|"_id":|"[^"]+":|[^:]+:.*|\s*}\s*$|\s*]\s*$)/)) {
            currentLog.message += `\n${trimmedLine}`;
            continue;
          }

          logger.debug(`Line ${index} does not match any format: "${trimmedLine.substring(0, 100)}..."`);
          currentLog = null;
        } catch (lineError) {
          logger.warn(`Error parsing line ${index}: ${lineError.message}`);
          currentLog = null;
        }
      }

      logger.debug(`Parsed ${logs.length} logs from ${logLines.length} lines`);
      return logs;
    } catch (error) {
      logger.error(`Error in parseLogs: ${error.message}`);
      return [];
    }
  }

  /**
   * Detect log level from message if not explicitly provided
   */
  detectLogLevel(message) {
    try {
      if (!message) return 'INFO';
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('error') || lowerMessage.includes('exception') || lowerMessage.includes('fail')) return 'ERROR';
      if (lowerMessage.includes('warn')) return 'WARN';
      if (lowerMessage.includes('debug')) return 'DEBUG';
      return 'INFO';
    } catch (error) {
      logger.warn(`Error detecting log level: ${error.message}`);
      return 'INFO';
    }
  }

  /**
   * Detect service from message
   */
  detectService(message) {
    try {
      if (!message) return 'System';
      if (message.includes('EmailService')) return 'Email Service';
      if (message.includes('DatabaseService')) return 'Database Service';
      if (message.includes('AuthService')) return 'Auth Service';
      // ... more service detections
      const serviceMatch = message.match(/\[([A-Z]+)\s+DEBUG\]/i);
      if (serviceMatch) {
        const serviceType = serviceMatch[1].toUpperCase();
        switch (serviceType) {
          case 'AUTH': return 'Auth Service';
          case 'ADMIN': return 'Admin Service';
          // ... more cases
          default: return serviceType + ' Service';
        }
      }
      return 'System';
    } catch (error) {
      logger.warn(`Error detecting service: ${error.message}`);
      return 'System';
    }
  }

  /**
   * Get date range based on options
   */
  getDateRange(options) {
    try {
      const now = new Date();
      let startDate, endDate;

      if (options.dateRange === 'custom' && options.startDate && options.endDate) {
        startDate = new Date(options.startDate);
        endDate = new Date(options.endDate);
      } else {
        switch (options.dateRange) {
          case 'yesterday':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            endDate = new Date(now);
            break;
          case 'month':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 30);
            endDate = new Date(now);
            break;
          default:
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
        }
      }

      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      };
    } catch (error) {
      logger.error(`Error getting date range: ${error.message}`);
      const today = new Date().toISOString().split('T')[0];
      return { startDate: today, endDate: today };
    }
  }

  /**
   * Debug function to verify yesterday's logs can be read
   */
  async debugYesterdayLogs() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      logger.info(`Debugging yesterday's logs for date: ${yesterdayStr}`);

      if (!this.getLogFilesInRange || !this.readLogFile) {
        logger.error('One or more required methods are undefined in LogsService', {
          getLogFilesInRange: !!this.getLogFilesInRange,
          readLogFile: !!this.readLogFile
        });
        throw new Error('Required methods are undefined');
      }

      const logFiles = await this.getLogFilesInRange(yesterdayStr, yesterdayStr, true);
      if (logFiles.length === 0) {
        return { success: false, error: 'No log files found for yesterday', alternativeFiles: [] };
      }
      logger.info(`Found ${logFiles.length} files for yesterday: ${logFiles.join(', ')}`);
      try {
        const content = await this.readLogFile(logFiles[0]);
        const lines = content.split('\n').slice(0, 5);
        return { success: true, lines: lines.length, sample: lines, filesFound: logFiles };
      } catch (error) {
        return { success: false, error: error.message, filesFound: logFiles };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

const logsService = LogsService.getInstance();
module.exports = logsService;