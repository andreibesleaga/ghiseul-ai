const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth-middleware');
const { reconfigureLogger, triggerLogRollover } = require('../shared-lib');

module.exports = () => {
  /**
   * @swagger
   * /api/logger/configure:
   *   post:
   *     summary: Reconfigure logger settings
   *     description: Updates the application's logging configuration with new settings.
   *     tags: [Logger]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               level:
   *                 type: string
   *                 description: Logging level to apply
   *                 enum: [error, warn, info, debug]
   *               errorMaxSize:
   *                 type: string
   *                 description: Maximum size of error log files before rotation
   *                 example: '10m'
   *                 pattern: '^\d+(k|m|g)$'
   *               combinedMaxSize:
   *                 type: string
   *                 description: Maximum size of combined log files before rotation
   *                 example: '20m'
   *                 pattern: '^\d+(k|m|g)$'
   *               errorMaxFiles:
   *                 type: string
   *                 description: Maximum number of days to keep error log files
   *                 example: '14d'
   *                 pattern: '^\d+d$'
   *               combinedMaxFiles:
   *                 type: string
   *                 description: Maximum number of days to keep combined log files
   *                 example: '7d'
   *                 pattern: '^\d+d$'
   *               zippedArchive:
   *                 type: boolean
   *                 description: Whether to compress rotated log files
   *     responses:
   *       200:
   *         description: Logger configuration updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Logger configuration updated successfully
   *       400:
   *         description: Invalid configuration parameters
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: Invalid log level. Must be one of error, warn, info, debug
   *       401:
   *         description: Unauthorized, authentication required
   *       403:
   *         description: Forbidden, admin privileges required
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: Failed to update logger configuration
   *                 error:
   *                   type: string
   */
  router.post('/configure', authMiddleware.authenticate, authMiddleware.isAdmin, (req, res) => {
    try {
      const { level, errorMaxSize, combinedMaxSize, errorMaxFiles, combinedMaxFiles, zippedArchive } = req.body;

      if (!level && !errorMaxSize && !combinedMaxSize && !errorMaxFiles && !combinedMaxFiles && zippedArchive === undefined) {
        return res.status(400).json({ success: false, message: 'At least one configuration parameter is required' });
      }

      if (level && !['error', 'warn', 'info', 'debug'].includes(level)) {
        return res.status(400).json({ success: false, message: 'Invalid log level. Must be one of: error, warn, info, debug' });
      }

      const sizeRegex = /^\d+(k|m|g)$/;
      const filesRegex = /^\d+d$/;

      if (errorMaxSize && !sizeRegex.test(errorMaxSize)) {
        return res.status(400).json({ success: false, message: 'Invalid errorMaxSize. Must be in format: 10m, 500k, 1g' });
      }
      if (combinedMaxSize && !sizeRegex.test(combinedMaxSize)) {
        return res.status(400).json({ success: false, message: 'Invalid combinedMaxSize. Must be in format: 10m, 500k, 1g' });
      }
      if (errorMaxFiles && !filesRegex.test(errorMaxFiles)) {
        return res.status(400).json({ success: false, message: 'Invalid errorMaxFiles. Must be in format: 30d, 14d' });
      }
      if (combinedMaxFiles && !filesRegex.test(combinedMaxFiles)) {
        return res.status(400).json({ success: false, message: 'Invalid combinedMaxFiles. Must be in format: 30d, 14d' });
      }

      reconfigureLogger({
        level,
        errorMaxSize,
        combinedMaxSize,
        errorMaxFiles,
        combinedMaxFiles,
        zippedArchive,
      });

      res.json({ success: true, message: 'Logger configuration updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update logger configuration', error: error.message });
    }
  });

  /**
   * @swagger
   * /api/logger/rollover:
   *   post:
   *     summary: Trigger log rollover
   *     description: Forces an immediate log rotation regardless of current file sizes
   *     tags: [Logger]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Log rollover triggered successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Log rollover triggered successfully
   *       401:
   *         description: Unauthorized, authentication required
   *       403:
   *         description: Forbidden, admin privileges required
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: Failed to trigger log rollover
   *                 error:
   *                   type: string
   */
  router.post('/rollover', authMiddleware.authenticate, authMiddleware.isAdmin, (req, res) => {
    try {
      triggerLogRollover();
      res.json({ success: true, message: 'Log rollover triggered successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to trigger log rollover', error: error.message });
    }
  });

  return router;
};