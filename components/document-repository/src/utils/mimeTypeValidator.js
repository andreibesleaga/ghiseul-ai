// NOTE: this validation is not used anywhere at the moment
// TODO: [NORMAL] validate file type and content in fileService.js by calling this function
// - all functions here are not tested yet
// - the code's file name should be changed to fileTypeValidator.js?? (not only validate mime type but also file content)

const mime = require('mime-types');
const { fromBuffer } = require('file-type');
const config = require('../config/appConfig');
const { logger } = require('../../shared-lib');

/**
 * Validate file type based on MIME type and extension
 */
const validateFileType = async (file) => {
  logger.debug(`Entering validateFileType for file: ${file.originalname}`);
  try {
    // Check file extension
    logger.debug(`1. Validating file extension for: ${file.originalname}`);
    const extension = getFileExtension(file.originalname);
    if (!config.upload.allowedExtensions.includes(extension)) {
      logger.warn(`Validation failed for ${file.originalname}: File extension ${extension} is not allowed.`);
      return {
        isValid: false,
        error: `File extension ${extension} is not allowed`
      };
    }
    logger.debug(`File extension ${extension} is allowed.`);

    // Check MIME type from multer
    logger.debug(`2. Validating MIME type from multer: ${file.mimetype}`);
    if (!config.upload.allowedMimeTypes.includes(file.mimetype)) {
      logger.warn(`Validation failed for ${file.originalname}: MIME type ${file.mimetype} is not allowed.`);
      return {
        isValid: false,
        error: `MIME type ${file.mimetype} is not allowed`
      };
    }
    logger.debug(`Multer MIME type ${file.mimetype} is allowed.`);

    // Double-check MIME type by reading file buffer
    logger.debug('3. Validating MIME type from file buffer...');
    const detectedType = await fromBuffer(file.buffer);
    logger.debug(`Detected buffer MIME type: ${detectedType ? detectedType.mime : 'unknown'}`);
    
    if (detectedType && !config.upload.allowedMimeTypes.includes(detectedType.mime)) {
      logger.warn(`Validation failed for ${file.originalname}: Detected MIME type ${detectedType.mime} does not match allowed types.`);
      return {
        isValid: false,
        error: `Detected MIME type ${detectedType.mime} does not match allowed types`
      };
    }
    logger.debug('Detected buffer MIME type is allowed.');

    logger.info(`File validation successful for: ${file.originalname}`);
    return { isValid: true };
  } catch (error) {
    logger.error(`Error during validateFileType for ${file.originalname}: ${error.message}`, error);
    return {
      isValid: false,
      error: `Error validating file type: ${error.message}`
    };
  }
};

/**
 * Get file extension from filename
 */
const getFileExtension = (filename) => {
  logger.debug(`Entering getFileExtension for: ${filename}`);
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  logger.debug(`Returning extension: ${extension}`);
  return extension;
};

/**
 * Get MIME type from file extension
 */
const getMimeType = (filename) => {
  logger.debug(`Entering getMimeType for: ${filename}`);
  const mimeType = mime.lookup(filename) || 'application/octet-stream';
  logger.debug(`Resolved MIME type: ${mimeType}`);
  return mimeType;
};

/**
 * Get file category based on MIME type
 */
const getFileCategory = (mimeType) => {
  logger.debug(`Entering getFileCategory for MIME type: ${mimeType}`);
  let category;
  if (mimeType.includes('pdf')) category = 'pdf';
  else if (mimeType.includes('word') || mimeType.includes('document')) category = 'document';
  else if (mimeType.includes('excel') || mimeType.includes('sheet')) category = 'spreadsheet';
  else if (mimeType.includes('markdown')) category = 'markdown';
  else if (mimeType.includes('html')) category = 'html';
  else if (mimeType.includes('text')) category = 'text';
  else category = 'other';
  
  logger.debug(`Returning category: ${category}`);
  return category;
};

/**
 * Check if file type is supported for text extraction
 */
const isTextExtractable = (mimeType) => {
  logger.debug(`Entering isTextExtractable for MIME type: ${mimeType}`);
  const extractableMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'text/html',
    'text/plain'
  ];
  const isExtractable = extractableMimeTypes.includes(mimeType);
  logger.debug(`Is text extractable: ${isExtractable}`);
  return isExtractable;
};

module.exports = {
  validateFileType,
  getFileExtension,
  getMimeType,
  getFileCategory,
  isTextExtractable
};