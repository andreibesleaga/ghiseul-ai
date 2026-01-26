const AdminDashboardService = require('../services/admin-dashboard-service');
const LogsService = require('../services/logs-service');
const { logger, triggerLogRollover } = require('../shared-lib');

const adminController = {
  async getSystemHealth(req, res) {
    try {
      const adminDashboardService = new AdminDashboardService();
      await adminDashboardService.init();
      logger.info('Controller: Fetching system health metrics');
      const healthData = await adminDashboardService.getSystemHealth();
      res.json({ 
        success: true, 
        data: {
          ...healthData,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error(`Error getting system health: ${error.message}`, { stack: error.stack });
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve system health data',
        error: error.message
      });
    }
  },
  
  async getDatabaseStats(req, res) {
    try {
      const adminDashboardService = new AdminDashboardService();
      await adminDashboardService.init();
      logger.info('Controller: Fetching database statistics');
      const dbStats = await adminDashboardService.getDatabaseStats();
      res.json({ 
        success: true, 
        data: {
          ...dbStats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error(`Error getting database stats: ${error.message}`, { stack: error.stack });
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve database statistics',
        error: error.message
      });
    }
  },
  
  async reindexDatabase(req, res) {
    try {
      const databaseOperationsService = new DatabaseOperationsService();
      await databaseOperationsService.init();
      logger.info('Controller: Reindexing database');
      const response = await databaseOperationsService.reindexDatabase();
      res.json(response);
    } catch (error) {
      logger.error(`Error reindexing database: ${error.message}`, { stack: error.stack });
      res.status(500).json({ 
        success: false, 
        message: 'Failed to reindex database',
        error: error.message
      });
    }
  },
  
  async backupDatabase(req, res) {
    try {
      const databaseOperationsService = new DatabaseOperationsService();
      await databaseOperationsService.init();
      logger.info('Controller: Backing up database');
      const response = await databaseOperationsService.backupDatabase();
      res.json(response);
    } catch (error) {
      logger.error(`Error backing up database: ${error.message}`, { stack: error.stack });
      res.status(500).json({ 
        success: false, 
        message: 'Failed to backup database',
        error: error.message
      });
    }
  },
  
  async optimizeDatabase(req, res) {
    try {
      const databaseOperationsService = new DatabaseOperationsService();
      await databaseOperationsService.init();
      logger.info('Controller: Optimizing database');
      const response = await databaseOperationsService.optimizeDatabase();
      res.json(response);
    } catch (error) {
      logger.error(`Error optimizing database: ${error.message}`, { stack: error.stack });
      res.status(500).json({ 
        success: false, 
        message: 'Failed to optimize database',
        error: error.message
      });
    }
  },
  
  async getLogs(req, res) {
    try {
      const adminDashboardService = new AdminDashboardService();
      await adminDashboardService.init();
      logger.info('Controller: Fetching system logs');
      const options = {
        limit: req.query.limit || 100,
        level: req.query.level,
        service: req.query.service
      };
      const logsData = await adminDashboardService.getLogs(options);
      res.json({ 
        success: true, 
        data: logsData
      });
    } catch (error) {
      logger.error(`Error fetching logs: ${error.message}`, { stack: error.stack });
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch logs',
        error: error.message
      });
    }
  },
  
  async getLogsSummary(req, res) {
    try {
      const logsService = new LogsService();
      await logsService.init();
      logger.info('Controller: Fetching logs summary');
      const options = req.query;
      const logsSummary = await logsService.getLogsSummary(options);
      res.json({ 
        success: true, 
        data: logsSummary
      });
    } catch (error) {
      logger.error(`Error fetching logs summary: ${error.message}`, { stack: error.stack });
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch logs summary',
        error: error.message
      });
    }
  },

  async searchLogs(req, res) {
    try {
      const logsService = new LogsService();
      await logsService.init();
      logger.info('Controller: Searching logs');
      const result = await logsService.searchLogs(req.query);
      return res.json(result);
    } catch (error) {
      logger.error(`Error searching logs: ${error.message}`, { stack: error.stack });
      res.status(500).json({ 
        success: false, 
        message: 'Failed to search logs',
        error: error.message
      });
    }
  },
  
  async debugYesterdayLogs(req, res) {
    try {
      const logsService = new LogsService();
      await logsService.init();
      logger.info('Controller: Debugging yesterday logs');
      const result = await logsService.debugYesterdayLogs();
      res.json({ 
        success: true, 
        data: result
      });
    } catch (error) {
      logger.error(`Error debugging yesterday logs: ${error.message}`, { stack: error.stack });
      res.status(500).json({ 
        success: false, 
        message: 'Failed to debug yesterday logs',
        error: error.message
      });
    }
  },
  
  async rolloverLogs(req, res) {
    try {
      logger.info('Controller: Triggering log rollover');
      triggerLogRollover();
      res.json({ 
        success: true, 
        message: 'Logs rolled over successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error rolling over logs: ${error.message}`, { stack: error.stack });
      res.status(500).json({ 
        success: false, 
        message: 'Failed to rollover logs',
        error: error.message
      });
    }
  },
  
  async getUserStats(req, res) {
    try {
      const adminDashboardService = new AdminDashboardService();
      await adminDashboardService.init();
      logger.info('Controller: Fetching user statistics');
      const userStats = await adminDashboardService.getUserStats();
      res.json({ 
        success: true, 
        data: userStats
      });
    } catch (error) {
      logger.error(`Error fetching user stats: ${error.message}`, { stack: error.stack });
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch user statistics',
        error: error.message
      });
    }
  },
  
  async getSecurityMetrics(req, res) {
    try {
      const adminDashboardService = new AdminDashboardService();
      await adminDashboardService.init();
      logger.info('Controller: Fetching security metrics');
      const securityMetrics = await adminDashboardService.getSecurityMetrics();
      res.json({ 
        success: true, 
        data: securityMetrics
      });
    } catch (error) {
      logger.error(`Error fetching security metrics: ${error.message}`, { stack: error.stack });
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch security metrics',
        error: error.message
      });
    }
  },
  
  async runSecurityScan(req, res) {
    try {
      const adminDashboardService = new AdminDashboardService();
      await adminDashboardService.init();
      logger.info('Controller: Running security scan');
      const scanResults = await adminDashboardService.runSecurityScan();
      res.json({ 
        success: true, 
        message: 'Security scan completed',
        data: scanResults
      });
    } catch (error) {
      logger.error(`Error running security scan: ${error.message}`, { stack: error.stack });
      res.status(500).json({ 
        success: false, 
        message: 'Failed to run security scan',
        error: error.message
      });
    }
  },
  
  async runDiagnostics(req, res) {
    try {
      const adminDashboardService = new AdminDashboardService();
      await adminDashboardService.init();
      logger.info('Controller: Running system diagnostics');
      const diagnosticsResults = await adminDashboardService.runDiagnostics();
      res.json({ 
        success: true, 
        message: 'Diagnostics completed successfully',
        data: {
          ...diagnosticsResults,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error(`Error running diagnostics: ${error.message}`, { stack: error.stack });
      res.status(500).json({ 
        success: false, 
        message: 'Failed to run diagnostics',
        error: error.message
      });
    }
  },

  async searchUsers(req, res) {
    try {
      const adminDashboardService = new AdminDashboardService();
      await adminDashboardService.init();
      logger.info('Controller: Searching users');
      const rawLimit = parseInt(req.query.limit || 20);
      const rawOffset = parseInt(req.query.offset || 0);
      const options = {
        term: req.query.term || '',
        field: req.query.field || 'all',
        limit: isNaN(rawLimit) ? 20 : rawLimit,
        offset: isNaN(rawOffset) ? 0 : rawOffset
      };
      logger.debug(`User search options: ${JSON.stringify(options)}`);
      const searchResults = await adminDashboardService.searchUsers(options);
      res.json({
        success: true,
        data: searchResults
      });
    } catch (error) {
      logger.error(`Error searching users: ${error.message}`, { stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Failed to search users',
        error: error.message
      });
    }
  }
};

// Import database operations service for database-related functions
let DatabaseOperationsService;
try {
  DatabaseOperationsService = require('../services/database-operations-service');
} catch (error) {
  logger.warn('Database operations service not found. Database operations will not work.');
  DatabaseOperationsService = {
    reindexDatabase: async () => ({ success: false, message: 'Database operations service not available' }),
    backupDatabase: async () => ({ success: false, message: 'Database operations service not available' }),
    optimizeDatabase: async () => ({ success: false, message: 'Database operations service not available' })
  };
}

module.exports = adminController;