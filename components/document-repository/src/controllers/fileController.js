const fileService = require('../services/fileService');
const metadataService = require('../services/metadataService');
const config = require('../config/appConfig');
const Joi = require('joi');
const path = require('path');
const fs = require('fs').promises;
const { logger } = require('../../shared-lib');
const { log, error } = require('console');
const archiver = require('archiver');
const axios = require('axios');

// Constants
const MAX_FILES_UPLOAD = config.upload.maxFilesUpload; // Maximum number of files that can be uploaded at once

// Schema for file upload validation
const uploadSchema = Joi.object({
  author: Joi.string().max(200).optional(),
  labels: Joi.array().items(Joi.string()).default([]),
  crawlDate: Joi.date().optional(),
  sourceUrl: Joi.string().uri().optional(),
  language: Joi.string().optional().allow('', null) // Allow language to be passed
});

const searchSchema = Joi.object({
  q: Joi.string().min(2).max(100).required(),
  limit: Joi.number().integer().min(1).max(50).default(10),
  category: Joi.string().valid('general', 'data', 'reports', 'documents').optional(),
  mimeType: Joi.string().optional()
});

// UPDATED: Added new statuses to validation
const getFilesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  language: Joi.string().min(2).max(5).optional(),
  mimeType: Joi.string().optional(),
  search: Joi.string().max(100).optional(),
  dataprepStatus: Joi.string().valid('pending', 'ingesting', 'ingested', 'ingested with warnings', 'ingestion error', 'retracted').optional(),
});

const updateFileSchema = Joi.object({
  file_name: Joi.string().max(255).optional(),
  labels: Joi.array().items(Joi.string()).optional(),
  author: Joi.string().max(200).optional(),
  create_date: Joi.date().optional(),
  crawl_date: Joi.date().optional(),
  source_url: Joi.string().uri().optional(),
  language: Joi.string().min(2).max(5).optional()
});

// --- NEW SCHEMAS ADDED ---

// Schema for new log entry
const ingestionLogSchema = Joi.object({
  level: Joi.string().valid('INFO', 'WARN', 'ERROR').required(),
  stage: Joi.string().required(),
  message: Joi.string().required(),
});

// Schema for status update from OPEA
const updateStatusSchema = Joi.object({
  dataprep: Joi.object({
    status: Joi.string().valid('Pending', 'Ingesting', 'Ingested', 'Ingested with Warnings', 'Ingestion Error', 'Retracted').required(),
    ingest_date: Joi.string().isoDate().optional().allow(null, ''),
    retract_date: Joi.string().isoDate().optional().allow(null, ''),
  }).required(),
  chunk_count: Joi.number().integer().min(0).optional(),
});


class FileController {
  constructor() {
    // Bind methods to preserve 'this' context
    this.downloadFile = this.downloadFile.bind(this);
    this.downloadMultipleFiles = this.downloadMultipleFiles.bind(this);
    this.viewFile = this.viewFile.bind(this);
    this.viewFileInBrowser = this.viewFileInBrowser.bind(this);
    this.uploadFile = this.uploadFile.bind(this);
    this.uploadMultipleFiles = this.uploadMultipleFiles.bind(this);
    this.uploadLink = this.uploadLink.bind(this); // <-- ADDED BIND
    this.getFiles = this.getFiles.bind(this);
    this.deleteFile = this.deleteFile.bind(this);
    this.searchFiles = this.searchFiles.bind(this);
    this.updateFile = this.updateFile.bind(this);
    this.searchMetadata = this.searchMetadata.bind(this);
    this.getMetadata = this.getMetadata.bind(this);
    this.ingestFile = this.ingestFile.bind(this);
    this.retractFile = this.retractFile.bind(this);
    this.ingestMultipleFiles = this.ingestMultipleFiles.bind(this);
    this.retractMultipleFiles = this.retractMultipleFiles.bind(this);
    // --- NEW BINDS ---
    this.addIngestionLog = this.addIngestionLog.bind(this);
    this.getIngestionLogs = this.getIngestionLogs.bind(this);
    this.updateFileStatus = this.updateFileStatus.bind(this);
  }

  /**
   * Process and validate labels from request body
   * @private
   * @param {Object} body - Request body
   * @returns {Array} Processed labels array
   */
  _processLabels(body) {
    if (!body.labels) return [];
    
    try {
      let labels = body.labels;
      
      if (typeof labels === 'string') {
        try {
          labels = JSON.parse(labels);
        } catch (e) {
          labels = labels.split(',').map(label => label.trim());
        }
      }
      
      // Ensure we have an array
      if (!Array.isArray(labels)) {
        labels = [labels];
      }
      
      // Filter out empty labels and ensure all labels are strings
      return labels
        .map(label => String(label).trim())
        .filter(label => label.length > 0);
    } catch (error) {
      logger.error('[FILE-CONTROLLER] Error processing labels:', error);
      return [];
    }
  }

  /**
   * Validate request body against upload schema
   * @private
   * @param {Object} body - Request body
   * @returns {Object} Validation result
   */
  _validateUploadRequest(body) {
    const { error, value } = uploadSchema.validate(body);
    if (error) {
      throw {
        status: 400,
        error: 'Validation error',
        message: error.details[0].message
      };
    }
    return value;
  }

  /**
   * Handle upload errors
   * @private
   * @param {Error} error - Error object
   * @returns {Object} Error response
   */
  _handleUploadError(error) {
    logger.error('Upload error:', error);
    
    if (error.status) {
      return {
        status: error.status,
        response: {
          success: false,
          error: error.error,
          message: error.message
        }
      };
    }
    
    // --- UPDATED: Added specific check for language error ---
    if (error.message.includes('documents are supported for ingestion') || error.message.includes('conflicting languages')) {
      return {
        status: 400,
        response: {
          success: false,
          error: 'Language not supported or conflict',
          message: error.message
        }
      };
    }

    if (error.message.includes('File type') && error.message.includes('not allowed')) {
      return {
        status: 400,
        response: {
          success: false,
          error: 'Invalid file type',
          message: error.message
        }
      };
    }
    
    if (error.message.includes('File size exceeds')) {
      return {
        status: 400,
        response: {
          success: false,
          error: 'File too large',
          message: error.message
        }
      };
    }
    
    if (error.message.includes('virus')) {
      return {
        status: 400,
        response: {
          success: false,
          error: 'Security threat detected',
          message: `File failed security scan. ${error.message}`
        }
      };
    }

    return {
      status: 500,
      response: {
        success: false,
        error: 'Upload failed',
        message: 'An error occurred while uploading the file(s)'
      }
    };
  }

  /**
   * Format file record for response
   * @private
   * @param {Object} fileRecord - File record from service
   * @returns {Object} Formatted file record
   */
  _formatFileRecord(fileRecord) {
    return {
      file_id: fileRecord.file_id,
      file_name: fileRecord.file_name,
      file_size: fileRecord.file_size,
      file_type: fileRecord.file_type,
      storage_path: fileRecord.storage_path,
      file_hash: fileRecord.file_hash,
      labels: fileRecord.labels,
      author: fileRecord.author,
      upload_date: fileRecord.uploade_date,
      create_date: fileRecord.create_date,
      crawl_date: fileRecord.crawl_date,
      source_url: fileRecord.source_url,
      language: fileRecord.language,
      chunk_count: fileRecord.chunk_count,
      dataprep : {
        status: fileRecord.dataprep.status,
        ingest_date: fileRecord.dataprep.ingest_date,
        retract_date: fileRecord.dataprep.retract_date,
      }
    };
  }

  /**
   * Get file record and physical file path
   * @private
   * @param {string} fileId - File ID
   * @returns {Object} Object containing file record and file path
   * @throws {Error} If file not found or invalid fileId
   */
  async _getFileAndPath(fileId) {
    if (!fileId) {
      throw {
        status: 400,
        error: 'Missing file ID',
        message: 'File ID is required'
      };
    }

    // retrieve file from database and search actual file on disk
    const file = await metadataService.getMetadataById(fileId);
    logger.debug(`[FILE-CONTROLLER] Retrieved file: ${JSON.stringify(file, null, 2)}`);
    
    if (!file) {
      throw {
        status: 404,
        error: 'File not found',
        message: 'File metadata not found in database'
      };
    }

    const fileExtension = path.extname(file.file_name).slice(1);
    logger.debug(`[FILE-CONTROLLER] File extension: ${fileExtension}`);
    const fileNameOnDisk = file.file_id + '.' + fileExtension;
    const filePath = file.storage_path || path.join(config.upload.uploadDir, fileNameOnDisk);
    logger.debug(`[FILE-CONTROLLER] filePath: ${filePath}`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      throw {
        status: 404,
        error: 'File not found',
        message: 'The physical file does not exist'
      };
    }
    return { file, filePath };
  }

  /**
   * Upload a file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  uploadFile = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
          message: 'Please select a file to upload'
        });
      }

      req.body.labels = this._processLabels(req.body);
      const validatedData = this._validateUploadRequest(req.body);
      const fileRecord = await fileService.uploadFile(req.file, validatedData);

      logger.debug(`[FILE-CONTROLLER] fileRecord: ${fileRecord}`);

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: this._formatFileRecord(fileRecord)
      });
    } catch (error) {
      logger.error('[FILE-CONTROLLER] Upload process error:', error);
      const { status, response } = this._handleUploadError(error);
      res.status(status).json(response);
    }
  }

  /**
   * Upload multiple files
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  uploadMultipleFiles = async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded',
          message: 'Please select at least one file to upload'
        });
      }

      if (req.files.length > MAX_FILES_UPLOAD) {
        return res.status(400).json({
          success: false,
          error: 'Too many files',
          message: `Maximum ${MAX_FILES_UPLOAD} files can be uploaded at once`
        });
      }

      req.body.labels = this._processLabels(req.body);
      const validatedData = this._validateUploadRequest(req.body);
      const uploadPromises = req.files.map(file => fileService.uploadFile(file, validatedData));
      const fileRecords = await Promise.all(uploadPromises);

      res.status(201).json({
        success: true,
        message: 'Files uploaded successfully',
        data: fileRecords.map(record => this._formatFileRecord(record))
      });
    } catch (error) {
      const { status, response } = this._handleUploadError(error);
      res.status(status).json(response);
    }
  }


  // --- UPDATED `uploadLink` to use `_handleUploadError` ---
  uploadLink = async (req, res) => {
    try {
      const { url, fileType = 'html' } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
      }

      // Call fileService to handle crawling and saving
      const fileRecord = await fileService.uploadLink(url, fileType);
      
      logger.debug(`[FILE-CONTROLLER] fileRecord: ${fileRecord}`);
      
      res.status(201).json({
        success: true,
        message: 'URL crawled and html file saved successfully',
        data: this._formatFileRecord(fileRecord)
      });
    } catch (error) {
      // **FIX:** Use the standardized error handler
      const { status, response } = this._handleUploadError(error);
      res.status(status).json(response);
    }
  }


  /**
   * Get all files with pagination and filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getFiles(req, res) {
    try {
      // Validate query parameters
      const { error, value } = getFilesSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.details[0].message
        });
      }

      const result = await fileService.getFiles(value);

      res.json({
        success: true,
        message: 'Files retrieved successfully',
        data: result.files,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Get files error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve files',
        message: 'An error occurred while retrieving files'
      });
    }
  }


  /**
   * Download file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async downloadFile(req, res) {
    try {
      const { fileId } = req.params;
      const { file, filePath } = await this._getFileAndPath(fileId);

      // Set appropriate headers, use file_name as the filename
      res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
      res.setHeader('Content-Type', file.file_type);

      // Send file
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      logger.error('Download file error:', error);
      
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.error,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Download failed',
        message: 'An error occurred while downloading the file'
      });
    }
  }

  async downloadMultipleFiles(req, res) {
    try {
    const { fileIds } = req.body;
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No file IDs provided',
        message: 'Please provide an array of file IDs to download'
      });
    }

    // Set response headers for ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="files.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const fileId of fileIds) {
      try {
        const { file, filePath } = await this._getFileAndPath(fileId);
        archive.file(filePath, { name: file.file_name });
      } catch (error) {
        // Optionally, add a text file with error info for missing files
        archive.append(`Error: Could not find file with ID ${fileId}\n`, { name: `ERROR_${fileId}.txt` });
      }
    }

    archive.finalize();
    } catch (error) {
      logger.error('Download multiple files error:', error);
      res.status(500).json({
        success: false,
        error: 'Batch download failed',
        message: 'An error occurred while downloading multiple files'
      });
    }
  }


  async _getFileBase64(fileId) {
    const { file, filePath } = await this._getFileAndPath(fileId);
    const fileBuffer = await fs.readFile(filePath);
    const base64String = fileBuffer.toString('base64');
    return { file, base64String };
  }


  /**
   * Get file as base64
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async viewFile(req, res) {
    try {
      const { fileId } = req.params;
      const { file, base64String } = await this._getFileBase64(fileId);

      // construct response with file information and base64 string
      res.json({
        success: true,
        message: 'File retrieved successfully',
        data: {
          id: file.file_id,
          file_name: file.file_name,
          file_size: file.file_size,
          file_type: file.file_type,
          base64: base64String
        }
      });
    } catch (error) {
      logger.error('Get file as base64 error:', error);
      
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.error,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve file',
        message: 'An error occurred while retrieving the file'
      });
    }
  }

  async viewFileInBrowser(req, res) {
    try {
      const { fileId } = req.params;
      const { file, filePath } = await this._getFileAndPath(fileId);

      // Set appropriate headers for viewing in browser
      res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
      res.setHeader('Content-Type', file.file_type);

      // Send file
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      logger.error('View file in browser error:', error);
      
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.error,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve file',
        message: 'An error occurred while retrieving the file'
      });
    }
  }


  /**
   * Delete file by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteFile(req, res) {
    try {
      const { fileId } = req.params;

      if (!fileId) {
        return res.status(400).json({
          success: false,
          error: 'Missing file ID',
          message: 'File ID is required'
        });
      }

      const deleted = await fileService.deleteFile(fileId);
      if (deleted) {
        res.json({
          success: true,
          message: 'File deleted successfully',
          // TODO: [LOW] return deleted file information
          // data: this._formatFileRecord(deletedFile)
          // Currently page count or word count is also part of metadata for certain file types. 
          // We need to fix the metadata schema so that the deleted metadata can be checked and returned here.
        });
      } else {
        return res.status(404).json({
          success: false,
          error: error.message || 'An error occurred',
        });
      }
    } catch (error) {
      logger.error('Delete file error:', error);
    
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'File not found',
          message: 'The requested file does not exist'
        });
      };

      res.status(500).json({
        success: false,
        error: 'Delete failed',
        message: 'An error occurred while deleting the file'
      })
    }
  }

  /**
   * Delete multiple files
   */
  async deleteMultipleFiles(req, res) {
    try {
      const { fileIds } = req.body;
      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No file IDs provided',
          message: 'Please provide an array of file IDs to delete'
        });
      }

      const results = [];
      for (const fileId of fileIds) {
        try {
          const deleted = await fileService.deleteFile(fileId);
          results.push({ fileId, success: !!deleted });
        } catch (error) {
          results.push({ fileId, success: false, error: error.message });
        }
      }

      res.json({
        message: 'Batch delete completed',
        results
      });
    } catch (error) {
      logger.error('Delete multiple files error:', error);
      res.status(500).json({
        success: false,
        error: 'Batch delete failed',
        message: 'An error occurred while deleting multiple files'
      });
    }
  }


  /**
   * Update file metadata
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateFile(req, res) {
    try {
      const { fileId } = req.params;

      logger.debug(`[FILE-CONTROLLER] Update File Request: ${JSON.stringify(req.body, null, 2)}`);

      if (!fileId) {
        return res.status(400).json({
          success: false,
          error: 'Missing file ID',
          message: 'File ID is required'
        });
      }

      // Validate request body
      const { error, value } = updateFileSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.details[0].message
        });
      }
      logger.debug(`[FILE-CONTROLLER] Update request data: ${JSON.stringify(value, null, 2)}`);

      // Process labels if provided
      if (value.labels) {
        value.labels = this._processLabels({ labels: value.labels });
      }

      // Get current file record
      const currentFile = await metadataService.getMetadataById(fileId);
      if (!currentFile) {
        return res.status(404).json({
          success: false,
          error: 'File not found',
          message: 'The requested file does not exist'
        });
      }

      // Update file record in database
      const db = await fileService.getDb();
      const updatedFile = await db.query(`
        FOR file IN files
        FILTER file.file_id == @fileId
        UPDATE file WITH @updates IN files
        RETURN NEW
      `, { 
        fileId,
        updates: value
      }).then(cursor => cursor.next());

      if (!updatedFile) {
        throw new Error('Failed to update file record');
      }

      res.json({
        success: true,
        message: 'File updated successfully',
        data: this._formatFileRecord(updatedFile)
      });
    } catch (error) {
      logger.error('Update file error:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'File not found',
          message: 'The requested file does not exist'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Update failed',
        message: 'An error occurred while updating the file'
      });
    }
  }


  /**
   * Search files
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async searchFiles(req, res) {
    try {
      // Validate query parameters
      const { error, value } = searchSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.details[0].message
        });
      }

      const { q, ...options } = value;
      const results = await fileService.searchFiles(q, options);

      res.json({
        success: true,
        message: 'Search completed successfully',
        data: results,
        query: q,
        resultCount: results.length
      });
    } catch (error) {
      logger.error('Search files error:', error);
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: 'An error occurred while searching files'
      });
    }
  }


  /**
   * Search file by metadata
   */
  async searchMetadata(req, res) {
    try {
      const {
          file_name,
          file_type,
          upload_date_from,
          upload_date_to,
          create_date_from,
          create_date_to,
          labels,
          author,
          status,
          language
        } = req.query;
      
      const allowedFields = [
        'file_name',
        'file_type',
        'upload_date_from',
        'upload_date_to',
        'create_date_from',
        'create_date_to',
        'labels',
        'author',
        'status',
        'language'
      ];

      const invalidFields = Object.keys(req.query).filter(
        key => !allowedFields.includes(key)
      );
      if (invalidFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          message: `Invalid query parameters: ${invalidFields.join(', ')}`
        });
      }

      // Parse labels if present (comma-separated string to array)
      const labelsArray = labels
        ? Array.isArray(labels)
          ? labels
          : labels.split(',').map(l => l.trim())
        : [];

      const results = await metadataService.searchMetadata(
        file_name,
        file_type,
        upload_date_from,
        upload_date_to,
        create_date_from,
        create_date_to,
        labelsArray,
        author,
        status,
        language
      );

      res.json({
        success: true,
        message: 'Metadata search completed successfully',
        data: results,
        query: req.query,
        resultCount: results.length
      });
    } catch (error) {
      logger.error('Search metadata error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Search failed',
      });
    }
  }


  /**
   * Get file metadata by file_id
   */
  async getMetadata(req, res) {
    try {
      const { fileId } = req.params;

      if (!fileId) {
        return res.status(400).json({
          success: false,
          error: 'Missing file ID',
          message: 'File ID is required'
        });
      }

      const metadata = await metadataService.getMetadataById(fileId);
      if (!metadata) {
        return res.status(404).json({
          success: false,
          error: 'Metadata not found',
          message: 'No metadata found for the specified file ID'
        });
      }

      res.json({
        success: true,
        message: 'Metadata retrieved successfully',
        data: metadata
      });
    } catch (error) {
      logger.error('Get metadata by ID error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to retrieve metadata',
      });
    }
  }


  // --- Helper for ingesting a single file ---

  async _ingestFileById(fileId) {
    const { file, base64String } = await this._getFileBase64(fileId);
    if (file.dataprep && file.dataprep.status === 'ingested') {
      return { success: false, error: 'File has already been ingested' };
    }
    const dataprepUrl = `${config.dataprep.host}:${config.dataprep.port}${config.dataprep.ingestPath}`;
    logger.debug(`[FILE-CONTROLLER] Sending file to dataprep service at ${dataprepUrl}`);
    const response = await axios.post(dataprepUrl, {
      fileId: file.file_id,
      fileName: file.file_name,
      fileType: file.file_type,
      fileLabels:file.labels,
      uploadDate: file.upload_date,
      storagePath: file.storage_path,
      fileBase64: base64String,
    });
    if (response.data.success) {
      await metadataService.updateMetadata(fileId, {
        chunk_count: response.data.chunk_count || file.chunk_count || 0, // Update chunk count if provided
        dataprep: {
          status: 'ingested',
          ingest_date: new Date().toISOString(),
          retract_date: file.dataprep.retract_date || null,
        }
      });
      return { success: true };
    } else {
      return { success: false, error: response.data };
    }
  }

  // --- Single file ingest ---
  async ingestFile(req, res) {
    try {
      const { fileId } = req.params;
      const result = await this._ingestFileById(fileId);
      if (result.success) {
        return res.json({ success: true, message: 'File ingested successfully' });
      } else {
        return res.status(500).json({ success: false, error: 'Data prep failed.', details: result.error });
      }
    } catch (error) {
      logger.error('Ingest file error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // --- Multiple file ingest ---
  async ingestMultipleFiles(req, res) {
    try {
      const { fileIds } = req.body;
      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ success: false, error: 'No file IDs provided' });
      }
      const results = [];
      for (const fileId of fileIds) {
        try {
          const result = await this._ingestFileById(fileId);
          results.push({ fileId, ...result });
        } catch (error) {
          results.push({ fileId, success: false, error: error.message });
        }
      }
      res.json({ success: true, results });
    } catch (error) {
      logger.error('Ingest multiple files error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
  

  // --- Helper for retracting a single file ---
  async _retractFileById(fileId) {
    const file = await metadataService.getMetadataById(fileId);
    if (!file) return { success: false, error: 'File not found' };
    if (!file.dataprep || file.dataprep.status === 'retracted') {
      return { success: false, error: 'File has already been retracted' };
    }
    const dataprepUrl = `${config.dataprep.host}:${config.dataprep.port}${config.dataprep.retractPath}`;
    const response = await axios.post(dataprepUrl, { fileId: file.file_id });
    if (response.data.success) {
      await metadataService.updateMetadata(fileId, {
        chunk_count: 0, // Reset chunk count on retract
        dataprep: {
          status: 'retracted',
          ingest_date: file.dataprep.ingest_date || null,
          retract_date: new Date().toISOString(),
        }
      });
      return { success: true };
    } else {
      return { success: false, error: response.data };
    }
  }

  // --- Single file retract ---
  async retractFile(req, res) {
    try {
      const { fileId } = req.params;
      const result = await this._retractFileById(fileId);
      if (result.success) {
        return res.json({ success: true, message: 'File retracted successfully' });
      } else if (result.error === 'File not found') {
        return res.status(404).json({ success: false, error: 'File not found' });
      } else {
        return res.status(500).json({ success: false, error: 'Dataprep retract failed', details: result.error });
      }
    } catch (error) {
      logger.error('Retract file error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }


  // --- Multiple file retract ---
  async retractMultipleFiles(req, res) {
    try {
      const { fileIds } = req.body;
      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ success: false, error: 'No file IDs provided' });
      }
      const results = [];
      for (const fileId of fileIds) {
        try {
          const result = await this._retractFileById(fileId);
          results.push({ fileId, ...result });
        } catch (error) {
          results.push({ fileId, success: false, error: error.message });
        }
      }
      res.json({ success: true, results });
    } catch (error) {
      logger.error('Retract multiple files error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // --- NEW METHODS ---

  /**
   * Add an ingestion log entry
   */
  async addIngestionLog(req, res) {
    try {
      const { fileId } = req.params;
      const { error, value } = ingestionLogSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.details[0].message
        });
      }

      const logEntry = await fileService.addIngestionLog(fileId, value);
      res.status(201).json({
        success: true,
        message: 'Log entry created',
        data: logEntry
      });

    } catch (error) {
      logger.error('Add ingestion log error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add log entry',
        message: error.message
      });
    }
  }

  /**
   * Get all ingestion logs for a file
   */
  async getIngestionLogs(req, res) {
    try {
      const { fileId } = req.params;
      const logs = await fileService.getIngestionLogs(fileId);
      res.json({
        success: true,
        message: 'Logs retrieved successfully',
        data: logs,
        resultCount: logs.length
      });
    } catch (error) {
      logger.error('Get ingestion logs error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve logs',
        message: error.message
      });
    }
  }

  /**
   * Update file status (called by OPEA service)
   */
  async updateFileStatus(req, res) {
    try {
      const { fileId } = req.params;
      const { error, value } = updateStatusSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.details[0].message
        });
      }
      
      // Use metadataService.updateMetadata to safely update allowed fields
      const updatedFile = await metadataService.updateMetadata(fileId, value);

      res.json({
        success: true,
        message: 'File status updated successfully',
        data: updatedFile
      });

    } catch (error) {
      logger.error('Update file status error:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, error: 'File not found' });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to update file status',
        message: error.message
      });
    }
  }
}


module.exports = new FileController();