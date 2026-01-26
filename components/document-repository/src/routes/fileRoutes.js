const express = require('express');
const fileController = require('../controllers/fileController');
const { uploadSingle, uploadMultiple } = require('../middlewares/fileUpload');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

const router = express.Router();

// apply authentication to all endpoints 
router.use(authenticateToken);

/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     summary: Upload a single file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The file to upload
 *               description:
 *                 type: string
 *                 description: File description
 *               category:
 *                 type: string
 *                 enum: [general, data, reports, documents]
 *                 description: File category
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of tags
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 */
router.post('/upload', authorizeRole(['Admin']), uploadSingle, fileController.uploadFile);
// router.post('/upload', uploadSingle, fileController.uploadFile);

/**
 * @swagger
 * /api/files/uploads:
 *   post:
 *     summary: Upload multiple files
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Array of files to upload (max 5)
 *               description:
 *                 type: string
 *                 description: Description for all files
 *               category:
 *                 type: string
 *                 enum: [general, data, reports, documents]
 *                 description: Category for all files
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of tags for all files
 *     responses:
 *       200:
 *         description: Files uploaded successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 */
router.post('/uploads', authorizeRole(['Admin']), uploadMultiple, fileController.uploadMultipleFiles);


/**
 * @swagger
 * /api/files/upload-link:
 *   post:
 *     summary: Upload a link (webpage), crawl the content and save as a file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 description: The URL to crawl and save
 *     responses:
 *       200:
 *         description: Link uploaded and processed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 */
router.post('/upload-link', authorizeRole(['Admin']), fileController.uploadLink);


/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: Get all files with pagination and filtering
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *         description: Items per page
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: mimeType
 *         schema:
 *           type: string
 *         description: Filter by MIME type
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in file names and descriptions
 *     responses:
 *       200:
 *         description: List of files
 *       401:
 *         description: Unauthorized
 */
router.get('/', fileController.getFiles);

/**
 * @swagger
 * /api/files/search:
 *   get:
 *     summary: Search files by metadata
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *         required: true
 *         description: Search query
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *         description: Number of results
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: mimeType
 *         schema:
 *           type: string
 *         description: Filter by MIME type
 *     responses:
 *       200:
 *         description: Search results
 *       401:
 *         description: Unauthorized
 */
router.get('/search', fileController.searchMetadata);

/**
 * @swagger
 * /api/files/{fileId}:
 *   get:
 *     summary: Get file metadata by ID
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         schema:
 *           type: string
 *         required: true
 *         description: File ID
 *     responses:
 *       200:
 *         description: File metadata
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: File not found
 */
router.get('/:fileId', fileController.getMetadata);

/**
 * @swagger
 * /api/files/{fileId}/view:
 *   get:
 *     summary: Get file as base64 for viewing
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         schema:
 *           type: string
 *         required: true
 *         description: File ID
 *     responses:
 *       200:
 *         description: File content in base64
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: File not found
 */
router.get('/:fileId/view', fileController.viewFile);

/**
 * @swagger
 * /api/files/{fileId}/viewbrowser:
 *   get:
 *     summary: View file in browser (if supported)
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         schema:
 *           type: string
 *         required: true
 *         description: File ID
 *     responses:
 *       200:
 *         description: File content for browser viewing
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: File not found
 */
router.get('/:fileId/viewbrowser', fileController.viewFileInBrowser);

/**
 * @swagger
 * /api/files/{fileId}/download:
 *   get:
 *     summary: Download file by ID
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         schema:
 *           type: string
 *         required: true
 *         description: File ID
 *     responses:
 *       200:
 *         description: File downloaded successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: File not found
 */
router.get('/:fileId/download', fileController.downloadFile);

/**
 * @swagger
 * /api/files/downloads:
 *   post:
 *     summary: Download multiple files as a ZIP archive
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileIds
 *             properties:
 *               fileIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of file IDs to download
 *     responses:
 *       200:
 *         description: ZIP archive downloaded successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/downloads', fileController.downloadMultipleFiles);

/**
 * @swagger
 * /api/files/{fileId}:
 *   delete:
 *     summary: Delete file by ID
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         schema:
 *           type: string
 *         required: true
 *         description: File ID
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: File not found
 */
router.delete('/:fileId', fileController.deleteFile);

/**
 * @swagger
 * /api/files:
 *   delete:
 *     summary: Delete multiple files by IDs
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileIds
 *             properties:
 *               fileIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of file IDs to delete
 *     responses:
 *       200:
 *         description: Files deleted successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/', fileController.deleteMultipleFiles);

/**
 * @swagger
 * /api/files/{fileId}:
 *   patch:
 *     summary: Update file metadata
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         schema:
 *           type: string
 *         required: true
 *         description: File ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               updates:
 *                 type: object
 *                 description: JSON object with the fields to update
 *     responses:
 *       200:
 *         description: File metadata updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: File not found
 */
router.patch('/:fileId', authorizeRole(['Admin']), fileController.updateFile);

// Update file metadata by fileId
// This endpoint has similar functionality to the one above (PATCH /:fileId)
// So this one and related functionalities are commented out and can be modified later if needed
// router.patch('/metadata/:fileId', fileController.updateMetadataController);

/**
 * @swagger
 * /api/files/{fileId}/ingest:
 *   post:
 *     summary: Ingest a file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         schema:
 *           type: string
 *         required: true
 *         description: File ID
 *     responses:
 *       200:
 *         description: File ingested successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: File not found
 */
router.post('/:fileId/ingest', authorizeRole(['Admin']), fileController.ingestFile);

/**
 * @swagger
 * /api/files/{fileId}/retract:
 *   post:
 *     summary: Retract a file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         schema:
 *           type: string
 *         required: true
 *         description: File ID
 *     responses:
 *       200:
 *         description: File retracted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: File not found
 */
router.post('/:fileId/retract', authorizeRole(['Admin']), fileController.retractFile);

/**
 * @swagger
 * /api/files/ingest:
 *   post:
 *     summary: Ingest multiple files
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Files ingested successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 */
router.post('/ingest', authorizeRole(['Admin']), fileController.ingestMultipleFiles);

/**
 * @swagger
 * /api/files/retract:
 *   post:
 *     summary: Retract multiple files
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Files retracted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 */
router.post('/retract', authorizeRole(['Admin']), fileController.retractMultipleFiles);

/**
 * @swagger
 * /api/files/{fileId}/ingestion-log:
 *   post:
 *     summary: Add an ingestion log entry for a file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         schema:
 *           type: string
 *         required: true
 *         description: File ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - level
 *               - message
 *             properties:
 *               level:
 *                 type: string
 *                 enum: [info, warn, error, debug]
 *                 description: Log level
 *               message:
 *                 type: string
 *                 description: The log message
 *               stage:
 *                 type: string
 *                 description: The ingestion stage (e.g., 'dataprep', 'embedding')
 *     responses:
 *       201:
 *         description: Log entry added successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: File not found
 */
router.post('/:fileId/ingestion-log', authorizeRole(['Admin']), fileController.addIngestionLog);

/**
 * @swagger
 * /api/files/{fileId}/ingestion-log:
 *   get:
 *     summary: Get all ingestion log entries for a file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         schema:
 *           type: string
 *         required: true
 *         description: File ID
 *     responses:
 *       200:
 *         description: List of log entries
 *       401:
 *         description: Unauthorized
 */
router.get('/:fileId/ingestion-log', authorizeRole(['Admin']), fileController.getIngestionLogs);

/**
 * @swagger
 * /api/files/{fileId}/status:
 *   patch:
 *     summary: Update file ingestion status and chunk count (for internal/OPEA use)
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         schema:
 *           type: string
 *         required: true
 *         description: File ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dataprep:
 *                 type: object
 *                 properties:
 *                   status:
 *                     type: string
 *                     enum: [Pending, Ingesting, Ingested, Ingested with Warnings, Ingestion Error, Retracted]
 *                   chunk_count:
 *                     type: integer
 *     responses:
 *       200:
 *         description: File status updated successfully
 *       401:
 *         description: Unauthorized
 */
router.patch('/:fileId/status', authorizeRole(['Admin']), fileController.updateFileStatus);

module.exports = router;