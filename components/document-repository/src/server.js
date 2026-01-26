require('dotenv').config();
const app = require('./app');
const appConfig = require('./config/appConfig');
const { logger } = require('../shared-lib');

const PORT = appConfig.port || process.env.PORT || 3001;
const HOST = appConfig.host || process.env.HOST || '0.0.0.0';

// Graceful shutdown function
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  server.close(() => {
    logger.info('HTTP server closed.');
    
    // Close database connections if needed
    // Add any cleanup code here
    
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Start server
const server = app.listen(PORT, HOST, () => {
  logger.info(appConfig.getFormattedConfiguration());
  logger.info(`🚀 Document Repository Server is running on http://${HOST}:${PORT}`);
  logger.info(`📂 Upload directory: ${appConfig.upload.uploadDir}`);
  logger.info(`🛡️  Virus scanning: ${appConfig.virusScanning ? 'enabled' : 'disabled'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;