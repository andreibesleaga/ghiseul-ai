const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth-middleware');
const path = require('path');
const { logger } = require('../shared-lib');
const authController = require('../controllers/authController');
const jwt = require('jsonwebtoken');

module.exports = (authService) => {
  // Validate authService
  if (!authService || !authService.initialized) {
    logger.error('auth-routes: AuthService is null or not initialized');
    return router; // Return empty router to prevent crashes
  }

  // Initialize authController with authService
  const controller = new authController(authService);

  /**
   * @swagger
   * /auth/refresh-token:
   *   post:
   *     summary: Refresh JWT token
   *     description: Generates a new JWT token using a valid refresh token
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refreshToken
   *             properties:
   *               refreshToken:
   *                 type: string
   *     responses:
   *       200:
   *         description: New token generated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 accessToken:
   *                   type: string
   *       401:
   *         description: Invalid refresh token
   *       500:
   *         description: Server error
   */
  router.post('/refresh-token', async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        logger.warn('Refresh token missing');
        return res.status(400).json({ message: 'Refresh token required' });
      }
      logger.info('Processing refresh token request');
      const result = await authService.refreshToken(refreshToken);
      res.json({
        success: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
    } catch (error) {
      logger.error(`Error in refresh-token: ${error.message}`, { stack: error.stack });
      res.status(401).json({ message: 'Invalid refresh token' });
    }
  });

  /**
   * @swagger
   * /auth/register:
   *   post:
   *     summary: Register a new user
   *     description: Creates a new user account
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - loginName
   *               - email
   *               - encPassword
   *             properties:
   *               loginName:
   *                 type: string
   *                 description: Username for login
   *               email:
   *                 type: string
   *                 format: email
   *                 description: User's email address
   *               encPassword:
   *                 type: string
   *                 description: Password (encrypted/hashed from client)
   *               fullName:
   *                 type: string
   *                 description: User's full name (optional)
   *     responses:
   *       201:
   *         description: User registered successfully
   *       400:
   *         description: Missing required fields
   *       409:
   *         description: Username or email already exists
   *       500:
   *         description: Registration failed
   */
  router.post('/register', async (req, res, next) => {
    try {
      logger.info(`Register request for loginName: ${req.body.loginName}, email: ${req.body.email}`);
      await controller.register(req, res);
    } catch (error) {
      logger.error(`Error registering user: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /auth/login:
   *   post:
   *     summary: User login
   *     description: Authenticate user and return access token
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - loginName
   *               - encPassword
   *             properties:
   *               loginName:
   *                 type: string
   *                 description: Username or email for login
   *               encPassword:
   *                 type: string
   *                 description: Password (encrypted/hashed from client)
   *     responses:
   *       200:
   *         description: Login successful
   *       400:
   *         description: Missing required fields
   *       401:
   *         description: Invalid credentials
   *       500:
   *         description: Login failed
   */
  router.post('/login', async (req, res, next) => {
    try {
      logger.info(`Login attempt for loginName: ${req.body.loginName}`);
      await controller.login(req, res);
    } catch (error) {
      logger.error(`Error logging in user: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /auth/logout:
   *   post:
   *     summary: User logout
   *     description: Invalidate user's token
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Logout successful
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Logout failed
   */
  router.post('/logout', authMiddleware.authenticate, async (req, res, next) => {
    try {
      logger.info(`Logout request for user: ${req.user?.loginName || 'unknown'}`);
      await controller.logout(req, res);
    } catch (error) {
      logger.error(`Error logging out user: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /auth/me:
   *   get:
   *     summary: Get current user
   *     description: Return information about the current logged-in user
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User information retrieved successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: User not found
   *       500:
   *         description: Failed to retrieve user information
   */
  router.get('/me', authMiddleware.authenticate, async (req, res, next) => {
    try {
      logger.info(`Fetching current user info for: ${req.user?.loginName || 'unknown'}`);
      await controller.getCurrentUser(req, res);
    } catch (error) {
      logger.error(`Error fetching current user: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /auth/verify-email/{token}:
   *   get:
   *     summary: Verify email
   *     description: Verify user's email address using token
   *     tags: [Authentication]
   *     parameters:
   *       - in: path
   *         name: token
   *         schema:
   *           type: string
   *         required: true
   *         description: Email verification token
   *     responses:
   *       302:
   *         description: Redirects to login page with verification status
   */
  router.get('/verify-email/:token', async (req, res, next) => {
    try {
      logger.info(`Email verification attempt with token: ${req.params.token}`);
      await controller.verifyEmail(req, res);
    } catch (error) {
      logger.error(`Error verifying email: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /auth/verify-email-success:
   *   get:
   *     summary: Email verification result page
   *     description: Displays the result of email verification
   *     tags: [Authentication]
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [success, error]
   *         description: Verification result status
   *     responses:
   *       200:
   *         description: Serves the SPA to handle verification result
   */
  router.get('/verify-email-success', (req, res) => {
    logger.info(`Serving email verification result page with status: ${req.query.status || 'unknown'}`);
    res.sendFile(path.resolve(__dirname, '../../dist/index.html'));
  });

  /**
   * @swagger
   * /auth/resend-verification:
   *   post:
   *     summary: Resend verification email
   *     description: Resend verification email to user
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 description: User's email address
   *     responses:
   *       200:
   *         description: Verification email sent if user exists
   *       400:
   *         description: Missing email
   *       500:
   *         description: Failed to send verification email
   */
  router.post('/resend-verification', async (req, res, next) => {
    try {
      logger.info(`Resend verification email request for: ${req.body.email}`);
      await controller.resendVerificationEmail(req, res);
    } catch (error) {
      logger.error(`Error resending verification email: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /auth/reset-password:
   *   post:
   *     summary: Initiate password reset
   *     description: Send password reset email with token
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 description: User's email address
   *     responses:
   *       200:
   *         description: Reset instructions sent (if email exists)
   *       400:
   *         description: Missing email
   *       500:
   *         description: Password reset initiation failed
   */
  router.post('/reset-password', async (req, res, next) => {
    try {
      logger.info(`Password reset request initiated for: ${req.body.email}`);
      await controller.initiatePasswordReset(req, res);
    } catch (error) {
      logger.error(`Error initiating password reset: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /auth/validate-token:
   *   post:
   *     summary: Validate reset token
   *     description: Check if a password reset token is valid, not expired, and not used
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - token
   *             properties:
   *               token:
   *                 type: string
   *                 description: Password reset token
   *     responses:
   *       200:
   *         description: Token is valid
   *       400:
   *         description: Invalid token
   *       409:
   *         description: Token has been used
   *       410:
   *         description: Token has expired
   *       500:
   *         description: Token validation failed
   */
  router.post('/validate-token', async (req, res, next) => {
    try {
      logger.info(`Validating password reset token: ${req.body.token}`);
      await controller.validateResetToken(req, res);
    } catch (error) {
      logger.error(`Error validating reset token: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /auth/reset-password/confirm:
   *   post:
   *     summary: Reset password
   *     description: Reset password using token
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - token
   *               - newPassword
   *             properties:
   *               token:
   *                 type: string
   *                 description: Password reset token
   *               newPassword:
   *                 type: string
   *                 description: New password (encrypted/hashed from client)
   *     responses:
   *       200:
   *         description: Password reset successful
   *       400:
   *         description: Invalid token or missing fields
   *       409:
   *         description: Token has been used
   *       410:
   *         description: Token has expired
   *       500:
   *         description: Password reset failed
   */
  router.post('/reset-password/confirm', async (req, res, next) => {
    try {
      logger.info(`Confirming password reset with token: ${req.body.token}`);
      await controller.resetPassword(req, res);
    } catch (error) {
      logger.error(`Error resetting password: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /auth/change-password:
   *   post:
   *     summary: Change password
   *     description: Change password for authenticated user
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - currentPassword
   *               - newPassword
   *             properties:
   *               currentPassword:
   *                 type: string
   *                 description: Current password (encrypted/hashed from client)
   *               newPassword:
   *                 type: string
   *                 description: New password (encrypted/hashed from client)
   *     responses:
   *       200:
   *         description: Password changed successfully
   *       400:
   *         description: Missing required fields
   *       401:
   *         description: Unauthorized or current password is incorrect
   *       500:
   *         description: Password change failed
   */
  router.post('/change-password', authMiddleware.authenticate, async (req, res, next) => {
    try {
      logger.info(`Password change request for user: ${req.user?.loginName || 'unknown'}`);
      await controller.changePassword(req, res);
    } catch (error) {
      logger.error(`Error changing password: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  /**
   * @swagger
   * /auth/cleanup-tokens:
   *   post:
   *     summary: Clean up expired tokens
   *     description: Remove expired password reset tokens (admin only)
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Cleanup successful
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Cleanup failed
   */
  router.post('/cleanup-tokens', authMiddleware.authenticate, authMiddleware.isAdmin, async (req, res, next) => {
    try {
      logger.info(`Token cleanup request by admin: ${req.user?.loginName || 'unknown'}`);
      await controller.cleanupExpiredTokens(req, res);
    } catch (error) {
      logger.error(`Error cleaning up tokens: ${error.message}`, { stack: error.stack });
      next(error);
    }
  });

  return router;
};