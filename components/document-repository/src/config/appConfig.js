/*
 * This object is used to read and load all of the configurations and make them available to the other components
*/
require('dotenv').config();

const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  allowedOrigins: process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3001'],

  // Database configuration
  database: {
    url: process.env.ARANGO_URL || 'http://91.203.132.51:8529',
    username: process.env.ARANGO_USERNAME || 'root',
    password: process.env.ARANGO_PASSWORD || 'test',
    databaseName: process.env.ARANGO_DB_NAME || 'node-services'
  },

  // Dataprep service configuration
  dataprep: {
    host: process.env.DATAPREP_HOST || 'http://91.203.132.198',
    port: process.env.DATAPREP_PORT || '6007',

    // This needs to be changed as it cannot be deployed on Kubernetes like this; David F
    ingestPath: '/v1/dataprep/ingest_file',
    retractPath: '/v1/dataprep/retract_file'
  },

  // File upload configuration
  upload: {
    maxFilesUpload: parseInt(process.env.MAX_FILES_UPLOAD) || 10, // Maximum number of files that can be uploaded at once
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    allowedMimeTypes: [
      'application/pdf',  // pdf files .pdf
      'application/msword', // word files .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // word files .docx
      'application/vnd.ms-excel', // excel files .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // excel files .xlsx
      'text/markdown',  // markdown files .md, .markdown
      'text/html',   // html files .html
      'text/plain',  // text files .txt
      'application/octet-stream' // generic binary files - temporary adding it to solve docx, xlsx, md upload issues
    ],
    allowedExtensions: ['.pdf', '.docx', '.xlsx', '.md', '.html', '.txt'],
    requiredIngestionLanguage: process.env.DOCUMENT_INGESTION_LANGUAGE || 'en' // Added per spec
  },

  //Labeling configuration 
  labels: {
    allowedLevels: ['category', 'service'], // Allowed levels for labels
    allowedStatuses: ['pending', 'active'] // Allowed statuses for labels - not sure what this is for; David F
  },

  // Security configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret',
    jwtExpiration: process.env.JWT_EXPIRATION || '24h',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  },

  //Controls whether or not the clamav service is used for uploaded documents
  virusScanning: process.env.VIRUS_SCANNING === 'true' || false,

  // ClamAV configuration using clamscan library
  clamscan: {
    removeInfected: process.env.CLAMSCAN_REMOVE_INFECTED === 'true' || false,

    // FIX: Check for the string 'false' or use the env var as a path
    quarantineInfected: process.env.CLAMSCAN_QUARANTINE_INFECTED === 'false'
      ? false
      : (process.env.CLAMSCAN_QUARANTINE_INFECTED || false),

    debugMode: process.env.CLAMSCAN_DEBUG_MODE === 'true' || false,

    // FIX: Use a strict === 'true' check, as 'false' string is truthy
    socket: process.env.CLAMSCAN_SOCKET === 'true' || false,

    host: process.env.CLAMSCAN_HOST || '127.0.0.1',

    // FIX: Convert port string to a number
    port: parseInt(process.env.CLAMSCAN_PORT, 10) || 3310,

    // FIX: Convert timeout string to a number
    timeout: parseInt(process.env.CLAMSCAN_TIMEOUT, 10) || 60000,

    localFallback: process.env.CLAMSCAN_LOCAL_FALLBACK === 'true' || true,
    path: process.env.CLAMSCAN_PATH || '/usr/bin/clamdscan',
    active: process.env.CLAMSCAN_ACTIVE === 'true' || true,
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'app.log'
  }
};

/**
 * Returns a formatted string representation of the configuration object for logging.
 * Sensitive keys (like 'password' or 'jwtSecret') are redacted.
 * @returns {string} A formatted string of the loaded configuration.
 */
config.getFormattedConfiguration = function () {
  // Add any other sensitive keys here in lowercase and they will be redacted
  const sensitiveKeys = ['password', 'jwtsecret', 'arango_password'];

  /**
   * Recursively formats an object for logging.
   * @param {object} obj - The object to format.
   * @param {string} indent - The current indentation level.
   * @returns {string} A formatted string representation of the object.
   */
  const formatRecursive = (obj, indent = '  ') => {
    const lines = [];
    for (const [key, value] of Object.entries(obj)) {
      // Skip logging this function itself
      if (key === 'getFormattedConfiguration') {
        continue;
      }

      // 1. Check for sensitive keys (case-insensitive)
      if (sensitiveKeys.includes(key.toLowerCase())) {
        lines.push(`${indent}${key}: [REDACTED]`);
        continue;
      }

      // 2. Handle nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        lines.push(`${indent}${key}:`);
        lines.push(formatRecursive(value, indent + '  '));
      }
      // 3. Handle arrays
      else if (Array.isArray(value)) {
        // Truncate long arrays for readability
        if (value.length > 10) {
          lines.push(`${indent}${key}: [${value.slice(0, 10).join(', ')}... (and ${value.length - 10} more)]`);
        } else {
          lines.push(`${indent}${key}: [${value.join(', ')}]`);
        }
      }
      // 4. Handle primitives (string, number, boolean, null)
      else {
        lines.push(`${indent}${key}: ${value}`);
      }
    }
    return lines.join('\n');
  };

  // Using 'this' refers to the 'config' object itself
  return `\n--- Loaded Environment Configuration ---\n${formatRecursive(this)}\n----------------------------------------`;
};


module.exports = config;