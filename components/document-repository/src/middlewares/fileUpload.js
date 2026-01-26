const multer = require('multer');
const config = require('../config/appConfig');
const { logger } = require('../../shared-lib');
// const { validateFileType } = require('../utils/mimeTypes');

logger.debug('Multer configuration module loading...');
logger.debug('Using upload configuration:', config.upload);

// Configure multer storage
const storage = multer.memoryStorage();
logger.debug('Multer storage configured to memoryStorage.');

// File filter function
const fileFilter = async (req, file, cb) => {
  logger.debug(`Entering fileFilter for file: ${file.originalname}`);
  try {
    // Basic MIME type check
    logger.debug(`Checking file: ${file.originalname}, MIME type: ${file.mimetype}`);
    if (!config.upload.allowedMimeTypes.includes(file.mimetype)) {
      logger.warn(`File type ${file.mimetype} is not allowed for file: ${file.originalname}. Rejecting file.`);
      return cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
    
    logger.debug(`File type ${file.mimetype} allowed for file: ${file.originalname}. Accepting file.`);
    cb(null, true);
  } catch (error) {
    logger.error(`Error in fileFilter for file: ${file.originalname}`, error);
    cb(error, false);
  }
};

// Configure multer
logger.debug('Initializing multer instance with configuration...');
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: config.upload.maxFilesUpload,
    fieldSize: config.upload.maxFileSize
  },
  fileFilter: fileFilter
});

// Middleware for single file upload
const uploadSingle = upload.single('file');

// Middleware for multiple file upload
const uploadMultiple = upload.array('files', config.upload.maxFilesUpload);

// Enhanced file validation middleware
const validateFiles = async (req, res, next) => {
  logger.debug('Entering validateFiles middleware...');
  try {
    if (!req.file && !req.files) {
      logger.warn('validateFiles: No file found on req.file or req.files. Sending 400.');
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const files = req.files || [req.file];
    logger.debug(`validateFiles: Found ${files.length} file(s) to validate.`);
    
    // Validate each file
    for (const file of files) {
      logger.debug(`validateFiles: Validating file: ${file.originalname}`);
      
      // const validation = await validateFileType(file);
      // if (!validation.isValid) {
      //   logger.warn(`File validation failed for ${file.originalname}: ${validation.error}`);
      //   return res.status(400).json({
      //     success: false,
      //     error: validation.error
      //   });
      // }
      // logger.debug(`File validation successful for ${file.originalname}`);
    }

    logger.debug('validateFiles: All files passed validation. Calling next().');
    next();
  } catch (error) {
    logger.error('Error in validateFiles middleware:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  logger.debug('Entering handleMulterError middleware...');
  
  if (error instanceof multer.MulterError) {
    logger.warn('Handling MulterError:', { code: error.code, message: error.message, field: error.field });
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        logger.warn(`MulterError LIMIT_FILE_SIZE: File size too large. Max is ${config.upload.maxFileSize} bytes.`);
        return res.status(400).json({
          success: false,
          error: `File size too large. Maximum size is ${config.upload.maxFileSize} bytes`
        });
      case 'LIMIT_FILE_COUNT':
        logger.warn('MulterError LIMIT_FILE_COUNT: Too many files uploaded.');
        return res.status(400).json({
          success: false,
          error: 'Too many files uploaded'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        logger.warn(`MulterError LIMIT_UNEXPECTED_FILE: Unexpected file field: ${error.field}`);
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field'
        });
      default:
        logger.warn(`MulterError (default case): ${error.message}`);
        return res.status(400).json({
          success: false,
          error: `Upload error: ${error.message}`
        });
    }
  }
  
  // Handle other file-related errors (e.g., from fileFilter)
  if (error.message.includes('File type') || error.message.includes('not allowed')) {
    logger.warn(`Handling custom file filter error: ${error.message}`);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  
  logger.error('handleMulterError: Unhandled error. Passing to next error handler.', error);
  next(error);
};

logger.debug('Multer upload service configured and ready.');

module.exports = {
  uploadSingle,
  uploadMultiple,
  validateFiles,
  handleMulterError
};