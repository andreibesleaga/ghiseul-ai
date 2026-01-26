const { logger } = require('../shared-lib');

/**
 * Get the frontend URL from environment variable, falling back to request headers
 * if environment variable is not set
 * @param {Object} req - Express request object
 * @returns {string} The frontend URL
 */
function getFrontendUrl(req) {
  const envFrontendUrl = process.env.FRONTEND_URL;
  if (envFrontendUrl) {
    logger.info(`Using environment FRONTEND_URL: ${envFrontendUrl}`);
    return envFrontendUrl;
  }
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  if (origin) {
    logger.info(`Using Origin header for frontend URL: ${origin}`);
    return origin;
  }
  if (referer) {
    try {
      const url = new URL(referer);
      const refererOrigin = `${url.protocol}//${url.host}`;
      logger.info(`Using Referer header for frontend URL: ${refererOrigin}`);
      return refererOrigin;
    } catch (error) {
      logger.warn(`Could not parse referer URL: ${referer}`, { stack: error.stack });
    }
  }
  const fallbackUrl = 'http://localhost:8090';
  logger.info(`Using fallback URL: ${fallbackUrl}`);
  return fallbackUrl;
}

/**
 * Get the backend URL from the request
 * @param {Object} req - Express request object
 * @returns {string} The backend URL
 */
function getBackendUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const backendUrl = `${protocol}://${host}`;
  logger.info(`Backend URL: ${backendUrl}`);
  return backendUrl;
}

/**
 * Controller for authentication-related endpoints
 */
class AuthController {
  constructor(authService) {
    this.authService = authService; // Use provided authService
  }

  async register(req, res) {
    try {
      logger.info('Processing user registration');
      const userData = req.body;
      const frontendUrl = getFrontendUrl(req);
      const backendUrl = getBackendUrl(req);
      logger.info(`Frontend URL for registration: ${frontendUrl}`);
      logger.info(`Backend URL for registration: ${backendUrl}`);
      if (!userData.loginName || !userData.email || !userData.encPassword) {
        logger.warn('Missing required fields: loginName, email, and encPassword are required');
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: loginName, email, and encPassword are required'
        });
      }
      userData.frontendUrl = frontendUrl;
      userData.backendUrl = backendUrl;
      const result = await this.authService.register(userData);
      const { accessToken, ...userWithoutToken } = result;
      logger.info(`User registration successful for email: ${userData.email}`);
      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        user: userWithoutToken
      });
    } catch (error) {
      logger.error(`Registration error: ${error.message}`, { stack: error.stack });
      if (error.message && error.message.includes('already exists')) {
        logger.warn(`Registration failed: ${error.message}`);
        return res.status(409).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: 'Registration failed' });
    }
  }

  async login(req, res) {
    try {
      logger.info('Processing user login');
      const { loginName, encPassword } = req.body;
      if (!loginName || !encPassword) {
        logger.warn('Missing required fields: loginName and encPassword are required');
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: loginName and encPassword are required'
        });
      }
      const result = await this.authService.login(loginName, encPassword);
      logger.info(`User login successful for loginName: ${loginName}`);
      res.json(result);
    } catch (error) {
      logger.error(`Login error: ${error.message}`, { stack: error.stack });
      if (error.message === 'User not found' || error.message === 'Invalid password') {
        logger.warn('Login failed: Invalid credentials');
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      } else if (error.message === 'Email not verified') {
        logger.warn('Login failed: Email not verified');
        return res.status(403).json({
          success: false,
          message: 'Email not verified. Please check your email for verification instructions.',
          requiresVerification: true
        });
      }
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  }

  async logout(req, res) {
    try {
      logger.info('Processing user logout');
      const userId = req.user.userId;
      if (!userId) {
        logger.warn('User ID is required for logout');
        return res.status(400).json({ success: false, message: 'User ID is required' });
      }
      const result = await this.authService.logout(userId);
      logger.info(`User logout successful for userId: ${userId}`);
      res.json(result);
    } catch (error) {
      logger.error(`Logout error: ${error.message}`, { stack: error.stack });
      res.status(500).json({ success: false, message: 'Logout failed' });
    }
  }

  async verifyEmail(req, res) {
    try {
      logger.info('Processing email verification');
      const { token } = req.params;
      const frontendUrl = getFrontendUrl(req);
      logger.info(`Frontend URL for verification redirect: ${frontendUrl}`);
  
      if (!token) {
        logger.warn('Token is required for email verification');
        return res.redirect(`${frontendUrl}/registration-success?status=error&message=${encodeURIComponent('Token is required')}`);
      }
  
      const result = await this.authService.verifyEmail(token);
  
      // Retrieve user email from verificationTokens
      let userEmail = '';
      const tokenDoc = await this.authService.db.collection('verificationTokens').firstExample({ token }).catch(() => null);
      if (tokenDoc) {
        const user = await this.authService.getUserById(tokenDoc.userId.split('/')[1]).catch(() => null);
        if (user) userEmail = user.email;
      }
  
      if (result.success) {
        logger.info('Email verified successfully');
        return res.redirect(`${frontendUrl}/registration-success?email=${encodeURIComponent(userEmail)}`);
      } else {
        let errorMessage = result.message || 'Email verification failed';
        if (result.expired) {
          logger.warn('Email verification failed: Token expired');
          errorMessage = 'Token has expired';
        } else if (result.used) {
          logger.warn('Email verification failed: Token already used');
          errorMessage = 'Token has already been used';
        } else {
          logger.warn('Email verification failed: Invalid token');
          errorMessage = 'Invalid token';
        }
        return res.redirect(`${frontendUrl}/registration-success?status=error&message=${encodeURIComponent(errorMessage)}&email=${encodeURIComponent(userEmail)}`);
      }
    } catch (error) {
      logger.error(`Email verification error: ${error.message}`, { stack: error.stack });
      return res.redirect(`${getFrontendUrl(req)}/registration-success?status=error&message=${encodeURIComponent('An unexpected error occurred')}`);
    }
  }

  async resendVerificationEmail(req, res) {
    try {
      logger.info('Processing resend verification email');
      const { email } = req.body;
      const frontendUrl = getFrontendUrl(req);
      const backendUrl = getBackendUrl(req);
      logger.info(`Frontend URL for verification email: ${frontendUrl}`);
      logger.info(`Backend URL for verification email: ${backendUrl}`);
      if (!email) {
        logger.warn('Email is required for resending verification email');
        return res.status(400).json({ success: false, message: 'Email is required' });
      }
      const result = await this.authService.resendVerificationEmail(email, frontendUrl, backendUrl);
      logger.info(`Verification email resent successfully for email: ${email}`);
      res.json(result);
    } catch (error) {
      logger.error(`Resend verification email error: ${error.message}`, { stack: error.stack });
      res.status(500).json({
        success: true,
        message: 'If your email exists in our system, a verification email has been sent'
      });
    }
  }

  async initiatePasswordReset(req, res) {
    try {
      logger.info('Initiating password reset');
      const { email } = req.body;
      const frontendUrl = getFrontendUrl(req);
      const backendUrl = getBackendUrl(req);
      logger.info(`Frontend URL for password reset email: ${frontendUrl}`);
      logger.info(`Backend URL for password reset email: ${backendUrl}`);
      if (!email) {
        logger.warn('Email is required for password reset initiation');
        return res.status(400).json({ success: false, message: 'Email is required' });
      }
      const result = await this.authService.initiatePasswordReset(email, frontendUrl, backendUrl);
      logger.info(`Password reset initiated successfully for email: ${email}`);
      res.json(result);
    } catch (error) {
      logger.error(`Password reset initiation error: ${error.message}`, { stack: error.stack });
      res.status(500).json({
        success: true,
        message: 'If your email exists in our system, a password reset link has been sent to your email'
      });
    }
  }

  async validateResetToken(req, res) {
    try {
      logger.info('Validating password reset token');
      const { token } = req.body;
      if (!token) {
        logger.warn('Token is required for validation');
        return res.status(400).json({ success: false, message: 'Token is required' });
      }
      const result = await this.authService.validateResetToken(token);
      if (!result.valid) {
        if (result.expired) {
          logger.warn('Token validation failed: Token expired');
          return res.status(410).json({ success: false, ...result });
        }
        if (result.used) {
          logger.warn('Token validation failed: Token already used');
          return res.status(409).json({ success: false, ...result });
        }
        logger.warn('Token validation failed: Invalid token');
        return res.status(400).json({ success: false, ...result });
      }
      logger.info('Password reset token validated successfully');
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error(`Token validation error: ${error.message}`, { stack: error.stack });
      res.status(500).json({ success: false, message: 'Token validation failed' });
    }
  }

  async resetPassword(req, res) {
    try {
      logger.info('Processing password reset with token');
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        logger.warn('Token and newPassword are required for password reset');
        return res.status(400).json({ success: false, message: 'Token and newPassword are required' });
      }
      const result = await this.authService.resetPassword(token, newPassword);
      if (!result.success) {
        if (result.expired) {
          logger.warn('Password reset failed: Token expired');
          return res.status(410).json({ success: false, ...result });
        }
        if (result.used) {
          logger.warn('Password reset failed: Token already used');
          return res.status(409).json({ success: false, ...result });
        }
        logger.warn('Password reset failed: Invalid token');
        return res.status(400).json({ success: false, ...result });
      }
      logger.info('Password reset successful');
      res.json(result);
    } catch (error) {
      logger.error(`Password reset error: ${error.message}`, { stack: error.stack });
      res.status(500).json({ success: false, message: 'Password reset failed' });
    }
  }

  async changePassword(req, res) {
    try {
      logger.info('Processing password change for authenticated user');
      const userId = req.user.userId;
      const { currentPassword, newPassword } = req.body;
      if (!userId || !currentPassword || !newPassword) {
        logger.warn('User ID, currentPassword, and newPassword are required for password change');
        return res.status(400).json({
          success: false,
          message: 'User ID, currentPassword, and newPassword are required'
        });
      }
      const result = await this.authService.changePassword(userId, currentPassword, newPassword);
      logger.info(`Password changed successfully for userId: ${userId}`);
      res.json(result);
    } catch (error) {
      logger.error(`Password change error: ${error.message}`, { stack: error.stack });
      if (error.message === 'Current password is incorrect') {
        logger.warn('Password change failed: Current password is incorrect');
        return res.status(401).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: 'Password change failed' });
    }
  }

  async getCurrentUser(req, res) {
    try {
      logger.info('Fetching current user info');
      const userId = req.user.userId;
      if (!userId) {
        logger.warn('User ID is required to fetch user info');
        return res.status(400).json({ success: false, message: 'User ID is required' });
      }
      const user = await this.authService.getUserById(userId);
      if (!user) {
        logger.warn(`User not found for userId: ${userId}`);
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      const { encPassword, ...userWithoutPassword } = user;
      logger.info(`Current user info retrieved successfully for userId: ${userId}`);
      res.json({ success: true, user: userWithoutPassword });
    } catch (error) {
      logger.error(`Get current user error: ${error.message}`, { stack: error.stack });
      res.status(500).json({ success: false, message: 'Failed to retrieve user information' });
    }
  }

  async cleanupExpiredTokens(req, res) {
    try {
      logger.info('Cleaning up expired tokens');
      const result = await this.authService.cleanupExpiredTokens();
      logger.info('Expired tokens cleanup completed successfully');
      res.json(result);
    } catch (error) {
      logger.error(`Cleanup expired tokens error: ${error.message}`, { stack: error.stack });
      res.status(500).json({ success: false, message: 'Failed to clean up expired tokens' });
    }
  }
}

module.exports = AuthController;