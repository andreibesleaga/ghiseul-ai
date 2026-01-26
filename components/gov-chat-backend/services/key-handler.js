// key-handler.js
const { v4: uuidv4 } = require('uuid');

/**
 * Sanitize a key to comply with ArangoDB requirements
 * @param {String} key - The key to sanitize
 * @param {String} prefix - Prefix to use for generated keys
 * @returns {String} Sanitized key
 */
function sanitizeKey(key, prefix = 'doc') {
  // If key is undefined, null, empty, or not a string, generate a new one
  if (!key || typeof key !== 'string' || key.trim() === '') {
    return generateKey(prefix);
  }

  // Remove any leading underscores
  let sanitized = key.replace(/^_+/, '');
  
  // Replace invalid characters with underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9_\-:.@()+,=;$!*'%]/g, '_');
  
  // Ensure key doesn't start with a number (add prefix if it does)
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `${prefix}_${sanitized}`;
  }
  
  // If sanitization results in an empty string, generate a new one
  if (!sanitized || sanitized.trim() === '') {
    return generateKey(prefix);
  }
  
  // Truncate if key is too long (ArangoDB has some internal limits)
  if (sanitized.length > 254) {
    sanitized = sanitized.substring(0, 254);
  }
  
  return sanitized;
}

/**
 * Generate a new document key
 * @param {String} prefix - Prefix for the key
 * @returns {String} Generated key
 */
function generateKey(prefix = 'doc') {
  const timestamp = Date.now();
  const uuid = uuidv4().replace(/-/g, '_');
  return `${prefix}_${timestamp}_${uuid}`;
}

/**
 * Process document data to ensure it has a valid key
 * @param {Object} document - Document to process
 * @param {String} prefix - Prefix for generated keys
 * @returns {Object} The processed document
 */
function processDocument(document, prefix = 'doc') {
  if (!document) {
    throw new Error('Document cannot be null or undefined');
  }
  
  // Make a copy to avoid modifying the original directly
  const processedDoc = {...document};
  
  // Ensure _key is valid
  const originalKey = processedDoc._key;
  processedDoc._key = sanitizeKey(originalKey, prefix);
  
  // Remove potentially problematic system fields
  delete processedDoc._id;
  delete processedDoc._rev;
  
  return processedDoc;
}

module.exports = {
  sanitizeKey,
  generateKey,
  processDocument
};