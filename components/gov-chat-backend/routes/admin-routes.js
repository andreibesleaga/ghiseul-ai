// src/routes/admin-routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth-middleware');
const securityScanService = require('../services/security-scan-service');
const { logger } = require('../shared-lib');

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Admin dashboard API endpoints
 */
module.exports = (adminService, logsService) => {
  // Debug: Log adminService initialization
  logger.info('[ADMIN-ROUTES] Initializing admin routes');
  if (!adminService || typeof adminService.getSystemHealth !== 'function') {
    logger.error('[ADMIN-ROUTES] Invalid adminService provided to admin-routes');
    throw new Error('adminService is required with getSystemHealth');
  }
  logger.debug('[ADMIN-ROUTES] admin-routes initialized with adminService', {
    methods: Object.getOwnPropertyNames(Object.getPrototypeOf(adminService)).filter(m => m !== 'constructor')
  });

  // Debug: Log securityScanService availability
  logger.debug('[ADMIN-ROUTES] Checking securityScanService:', {
    hasSecurityScanService: !!securityScanService,
    methods: securityScanService ? Object.getOwnPropertyNames(Object.getPrototypeOf(securityScanService)).filter(m => m !== 'constructor') : 'undefined'
  });

  // Debug: Log request entry before middleware
  router.use((req, res, next) => {
    logger.info(`[ADMIN-ROUTES] Request received: ${req.method} ${req.originalUrl}`, {
      headers: req.headers,
      query: req.query,
      body: req.body
    });
    next();
  });

  router.use(authMiddleware.authenticate);
  router.use(authMiddleware.isAdmin);

  /**
   * @swagger
   * /admin/system-health:
   *   get:
   *     summary: Get system health metrics
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: System health metrics retrieved successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.get('/system-health', async (req, res, next) => {
    logger.info('[ADMIN-ROUTES] Entering /admin/system-health route', {
      user: req.user ? req.user._key : 'unknown'
    });
    try {
      const result = await adminService.getSystemHealth();
      logger.info('[ADMIN-ROUTES] System health retrieved successfully');
      res.json(result);
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error getting system health: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /admin/database/stats:
   *   get:
   *     summary: Get database statistics
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Database statistics retrieved successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.get('/database/stats', async (req, res, next) => {
    try {
      const result = await adminService.getDatabaseStats();
      res.json(result);
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error getting database stats: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /admin/logs:
   *   get:
   *     summary: Get system logs
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Maximum number of logs to return
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *         description: Filter logs by level (INFO, WARNING, ERROR)
   *       - in: query
   *         name: service
   *         schema:
   *           type: string
   *         description: Filter logs by service name
   *     responses:
   *       200:
   *         description: Logs retrieved successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.get('/logs', async (req, res, next) => {
    try {
      const { limit, level, service } = req.query;
      const result = await adminService.getLogs({ limit, level, service });
      res.json(result);
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error getting logs: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /admin/logs/rollover:
   *   post:
   *     summary: Trigger log rollover
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Logs rolled over successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.post('/logs/rollover', async (req, res, next) => {
    try {
      const result = await adminService.rolloverLogs();
      res.json(result);
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error rolling over logs: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /admin/user-stats:
   *   get:
   *     summary: Get user statistics
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User statistics retrieved successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.get('/user-stats', async (req, res, next) => {
    try {
      const result = await adminService.getUserStats();
      res.json(result);
      logger.debug('[ADMIN-ROUTES] User stats response sent to client', { result });
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error getting user stats: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /admin/security-metrics:
   *   get:
   *     summary: Get security metrics
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Security metrics retrieved successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.get('/security-metrics', async (req, res, next) => {
    try {
      logger.info(`[ADMIN-ROUTES] Fetching security metrics for user: ${req.user?.email || 'unknown'}`);
      const lastScan = await securityScanService.getLastScanDetails();

      const metrics = {
        failedLoginAttempts: lastScan.failedLoginDetails?.length || 0,
        suspiciousActivities: lastScan.suspiciousDetails?.length || 0,
        lastSecurityScan: lastScan.scanTime || "Never",
        vulnerabilities: lastScan.vulnerabilities || { critical: 0, medium: 0, low: 0 }
      };

      res.status(200).json({
        success: true,
        data: metrics
      });
      logger.info(`[ADMIN-ROUTES] Security metrics retrieved successfully for user: ${req.user?.email || 'unknown'}`);
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error fetching security metrics: ${error.message}`, { stack: error.stack });
      res.status(500).json({ message: 'Failed to fetch security metrics' });
    }
  });

  /**
   * @swagger
   * /admin/security-scan:
   *   post:
   *     summary: Run security scan
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Security scan completed successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.post('/security-scan', async (req, res, next) => {
    logger.info('[ADMIN-ROUTES] Entering /admin/security-scan route', {
      user: req.user ? req.user._key : 'unknown'
    });
    try {
      logger.info(`[ADMIN-ROUTES] Initiating security scan by user: ${req.user?.email || 'unknown'}`);
      const result = await securityScanService.runSecurityScan(logsService);
      logger.debug(`[ADMIN-ROUTES] Security scan response: ${JSON.stringify(result, null, 2)}`);
      res.status(200).json({ success: true, data: result });
      logger.info(`[ADMIN-ROUTES] Security scan completed successfully by user: ${req.user?.email || 'unknown'}`);
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error running security scan: ${error.message}`, { stack: error.stack });
      res.status(500).json({ success: false, message: 'Failed to run security scan', error: error.message });
    }
  });

  /**
   * @swagger
   * /admin/security/last-scan:
   *   get:
   *     summary: Retrieve the last security scan details
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Last security scan details retrieved successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.get('/security/last-scan', async (req, res, next) => {
    logger.info('[ADMIN-ROUTES] Entering /admin/security/last-scan route', {
      user: req.user ? req.user._key : 'unknown'
    });
    try {
      logger.info(`[ADMIN-ROUTES] Fetching last security scan details for user: ${req.user?.email || 'unknown'}`);
      const scanDetails = await securityScanService.getLastScanDetails();
      logger.info('[ADMIN-ROUTES] Last scan details retrieved successfully');
      res.status(200).json(scanDetails);
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error fetching last scan details: ${error.message}`, { stack: error.stack });
      res.status(500).json({ error: 'Failed to fetch last scan details', message: error.message });
    }
  });

  /**
   * @swagger
   * /admin/diagnostics:
   *   post:
   *     summary: Run system diagnostics
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Diagnostics completed successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.post('/diagnostics', async (req, res, next) => {
    try {
      const result = await adminService.runDiagnostics();
      res.json(result);
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error running diagnostics: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /admin/logs/summary:
   *   get:
   *     summary: Get logs summary by type and service
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: date
   *         schema:
   *           type: string
   *         description: Date for which to get logs (YYYY-MM-DD)
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *         description: Filter by log level
   *     responses:
   *       200:
   *         description: Logs summary retrieved successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.get('/logs/summary', async (req, res, next) => {
    try {
      const { date, level } = req.query;
      const result = await logsService.getLogsSummary({ date, level }); // Changed to logsService
      res.json({ data: result }); // Wrap result in { data: ... } for frontend consistency
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error getting logs summary: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /admin/logs/search:
   *   get:
   *     summary: Search logs with filtering
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: term
   *         schema:
   *           type: string
   *         description: Search term
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *         description: Filter by log level
   *       - in: query
   *         name: service
   *         schema:
   *           type: string
   *         description: Filter by service name
   *       - in: query
   *         name: dateRange
   *         schema:
   *           type: string
   *           enum: [today, yesterday, week, month, custom]
   *         description: Date range preset
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *         description: Custom start date (YYYY-MM-DD)
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *         description: Custom end date (YYYY-MM-DD)
   *     responses:
   *       200:
   *         description: Search completed successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.get('/logs/search', async (req, res, next) => {
    try {
      const { term, level, service, dateRange, startDate, endDate } = req.query;
      const result = await adminService.searchLogs({ term, level, service, dateRange, startDate, endDate });
      res.json(result);
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error searching logs: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /admin/logs/debug-yesterday:
   *   get:
   *     summary: Debug logs for yesterday to diagnose issues
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Debug information retrieved successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.get('/logs/debug-yesterday', async (req, res, next) => {
    try {
      const result = await adminService.debugYesterdayLogs();
      res.json(result);
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error getting debug logs: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /admin/database-operations/reindex:
   *   post:
   *     summary: Reindex database
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Database reindexed successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.post('/database-operations/reindex', async (req, res, next) => {
    try {
      const result = await adminService.reindexDatabase();
      res.json(result);
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error reindexing database: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /admin/database-operations/backup:
   *   post:
   *     summary: Backup database
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Database backed up successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.post('/database-operations/backup', async (req, res, next) => {
    try {
      const result = await adminService.backupDatabase();
      res.json(result);
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error backing up database: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /admin/database-operations/optimize:
   *   post:
   *     summary: Optimize database
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Database optimized successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.post('/database-operations/optimize', async (req, res, next) => {
    try {
      const result = await adminService.optimizeDatabase();
      res.json(result);
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error optimizing database: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /admin/users/search:
   *   get:
   *     summary: Search users with filtering
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: term
   *         schema:
   *           type: string
   *         description: Search term
   *       - in: query
   *         name: field
   *         schema:
   *           type: string
   *           enum: [all, name, email, role]
   *         description: Field to search (all, name, email, role)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Maximum number of users to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *         description: Offset for pagination
   *     responses:
   *       200:
   *         description: Search completed successfully
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Server error
   */
  router.get('/users/search', async (req, res, next) => {
    try {
      logger.info('[ADMIN-ROUTES] Route /api/admin/users/search hit');
      const { term, field, limit, offset } = req.query;
      const result = await adminService.searchUsers({ term, field, limit, offset });
      res.json(result);
    } catch (error) {
      logger.error(`[ADMIN-ROUTES] Error searching users: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  return router;
};