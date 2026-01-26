const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const fs = require('fs');
const path = require('path');

// Default log format
const logFormat = format.printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

// Default configuration for the logger
let loggerConfig = {
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    new transports.Console({
      handleExceptions: true,  // Log unhandled exceptions
      json: false,
      colorize: true,          // Colorize output for readability
      stderrLevels: ['error'], // Write error logs to stderr
    }),
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '10m',
      maxFiles: '30d',
      zippedArchive: true,
    }),
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '30d',
      zippedArchive: true,
    }),
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 1,
      tailable: true,   // Recreate log file when max size is reached
      handleExceptions: true,
    }),
  ],
};

// Create the initial logger instance
let logger = createLogger(loggerConfig);

// Store references to the DailyRotateFile transports for manual rotation
let errorTransport = logger.transports.find(
  (transport) => transport instanceof DailyRotateFile && transport.level === 'error'
);
let combinedTransport = logger.transports.find(
  (transport) => transport instanceof DailyRotateFile && !transport.level
);

// Function to reconfigure the logger
const reconfigureLogger = (newConfig) => {
  // Update the configuration with new values (if provided)
  loggerConfig.level = newConfig.level || loggerConfig.level;
  loggerConfig.transports = [
    new transports.Console({
      handleExceptions: true,
      json: false,
      colorize: true,
      stderrLevels: ['error'],
    }),
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: newConfig.errorMaxSize || '10m',
      maxFiles: newConfig.errorMaxFiles || '30d',
      zippedArchive: newConfig.zippedArchive !== undefined ? newConfig.zippedArchive : true,
    }),
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: newConfig.combinedMaxSize || '10m',
      maxFiles: newConfig.combinedMaxFiles || '30d',
      zippedArchive: newConfig.zippedArchive !== undefined ? newConfig.zippedArchive : true,
    }),
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: newConfig.combinedLogMaxSize || 5242880, // 5MB
      maxFiles: newConfig.combinedLogMaxFiles || 1,
      tailable: true,
      handleExceptions: true,
    }),
  ];

  // Clear existing transports
  logger.clear();

  // Apply the new configuration
  logger.configure({
    level: loggerConfig.level,
    format: loggerConfig.format,
    transports: loggerConfig.transports,
  });

  // Update references to the new DailyRotateFile transports
  errorTransport = logger.transports.find(
    (transport) => transport instanceof DailyRotateFile && transport.level === 'error'
  );
  combinedTransport = logger.transports.find(
    (transport) => transport instanceof DailyRotateFile && !transport.level
  );

  logger.info('Logger configuration updated');
};

// Function to trigger an immediate log rollover
const triggerLogRollover = () => {
  try {
    const currentErrorTransport = logger.transports.find(
      (transport) => transport instanceof DailyRotateFile && transport.level === 'error'
    );
    const currentCombinedTransport = logger.transports.find(
      (transport) => transport instanceof DailyRotateFile && !transport.level
    );

    if (currentErrorTransport && typeof currentErrorTransport.rotate === 'function') {
      currentErrorTransport.rotate();
      logger.info('Error log rolled over manually');
    } else {
      logger.warn('Error log transport not found or does not support rotation');
    }

    if (currentCombinedTransport && typeof currentCombinedTransport.rotate === 'function') {
      currentCombinedTransport.rotate();
      logger.info('Combined log rolled over manually');
    } else {
      logger.warn('Combined log transport not found or does not support rotation');
    }

    logger.info('Log rollover operation completed');
  } catch (error) {
    logger.error(`Error during log rollover: ${error.message}`);
    throw error;
  }
};

// Function to clean up the large combined.log file
const cleanupCombinedLog = () => {
  try {
    const combinedLogPath = path.join(process.cwd(), 'logs/combined.log');

    if (fs.existsSync(combinedLogPath)) {
      fs.unlinkSync(combinedLogPath);
      logger.info('Large combined.log file has been removed');
    } else {
      logger.info('combined.log file not found, no cleanup needed');
    }
  } catch (error) {
    logger.error(`Error cleaning up combined.log: ${error.message}`);
    throw error;
  }
};

// Function to flush logs immediately
const flushLogs = () => {
  logger.transports.forEach((transport) => {
    if (transport.flush && typeof transport.flush === 'function') {
      transport.flush();
    }
  });
  logger.info('Logs flushed immediately');
};

// Export the logger and the functions
module.exports = {
  logger,
  reconfigureLogger,
  triggerLogRollover,
  cleanupCombinedLog,
  flushLogs,
};
