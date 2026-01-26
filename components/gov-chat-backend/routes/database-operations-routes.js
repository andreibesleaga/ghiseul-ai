const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth-middleware');
const { logger } = require('../shared-lib');

module.exports = (databaseService) => {
  // Apply authentication middleware to all routes
  router.use(authMiddleware.authenticate);

  /**
   * @swagger
   * /database/reindex:
   *   post:
   *     summary: Reindex Database
   *     description: Drops and recreates indexes for all collections
   *     tags: [Database Operations]
   *     responses:
   *       200:
   *         description: Database reindexed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 results:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       collection:
   *                         type: string
   *                       status:
   *                         type: string
   *       500:
   *         description: Server error
   */
  router.post('/reindex', async (req, res) => {
    try {
      logger.info('Initiating database reindexing via API');
      const result = await databaseService.reindexDatabase();

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      logger.error(`Unexpected error during database reindexing: ${error.message}`, { stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Unexpected error during database reindexing',
        error: error.message
      });
    }
  });

  /**
   * @swagger
   * /database/backup:
   *   post:
   *     summary: Backup Database
   *     description: Creates a full backup of the database
   *     tags: [Database Operations]
   *     responses:
   *       200:
   *         description: Database backed up successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 backupFile:
   *                   type: string
   *                 backupLocation:
   *                   type: string
   *       500:
   *         description: Server error
   */
  router.post('/backup', async (req, res) => {
    try {
      logger.info('Initiating database backup via API');
      const result = await databaseService.backupDatabase();

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      logger.error(`Unexpected error during database backup: ${error.message}`, { stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Unexpected error during database backup',
        error: error.message
      });
    }
  });

  /**
   * @swagger
   * /database/optimize:
   *   post:
   *     summary: Optimize Database
   *     description: Performs database optimization including compacting collections
   *     tags: [Database Operations]
   *     responses:
   *       200:
   *         description: Database optimized successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 results:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       collection:
   *                         type: string
   *                       status:
   *                         type: string
   *                       indexSuggestions:
   *                         type: array
   *       500:
   *         description: Server error
   */
  router.post('/optimize', async (req, res) => {
    try {
      logger.info('Initiating database optimization via API');
      const result = await databaseService.optimizeDatabase();

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      logger.error(`Unexpected error during database optimization: ${error.message}`, { stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Unexpected error during database optimization',
        error: error.message
      });
    }
  });

  /**
   * @swagger
   * /database/stats:
   *   get:
   *     summary: Get Database Statistics
   *     description: Retrieves statistics about the database collections and size
   *     tags: [Database Operations]
   *     responses:
   *       200:
   *         description: Database statistics retrieved successfully
   *       500:
   *         description: Server error
   */
  router.get('/stats', async (req, res) => {
    try {
      logger.info('Fetching database statistics via API');
      const result = await databaseService.getDatabaseStats();

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      logger.error(`Unexpected error fetching database stats: ${error.message}`, { stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Unexpected error fetching database stats',
        error: error.message
      });
    }
  });

  return router;
};