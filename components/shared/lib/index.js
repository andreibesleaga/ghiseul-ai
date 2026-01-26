// shared-lib/index.js
const loggerModule = require('./logger'); // Import the module object
const securityHeaders = require('./security-headers');
const SecurityMiddleware = require('./security-middleware');
const dbService = require ('./db-connection-service');

module.exports = {
  logger: loggerModule.logger, // Export the Winston logger instance
  dbService, 
  securityHeaders,
  SecurityMiddleware
};
