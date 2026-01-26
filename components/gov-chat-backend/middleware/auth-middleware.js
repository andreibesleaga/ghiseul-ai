const authService = require('../services/auth-service');
const UserProfileService = require('../services/user-profile-service');
const { logger } = require('../shared-lib');

// Utility function to safely stringify objects with circular references
const safeStringify = (obj, indent = 2) => {
  try {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return '[Circular]';
        }
        cache.add(value);
      }
      // Mask sensitive data
      if (key === 'password' || key === 'encPassword' || key === 'token') {
        return typeof value === 'string' ? '******' : value;
      }
      return value;
    }, indent);
  } catch (err) {
    return `[Error serializing object: ${err.message}]`;
  }
};

/**
 * Authentication middleware functions
 */
const authMiddleware = {
  /**
   * Authenticate a user based on JWT token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async authenticate(req, res, next) {
    logger.info('\n=======================================================');
    logger.info(`[AUTH DEBUG] ${new Date().toISOString()} - Authentication Started`);
    logger.info('=======================================================');
    logger.info(`[AUTH DEBUG] Request URL: ${req.method} ${req.url}`);
    logger.info(`[AUTH DEBUG] Route parameters:`, safeStringify(req.params));
    logger.info(`[AUTH DEBUG] Query parameters:`, safeStringify(req.query));

    // Log request headers
    logger.info('[AUTH DEBUG] Request headers:');
    Object.keys(req.headers).forEach(key => {
      // Don't log the full token for security
      const value = key.toLowerCase() === 'authorization'
        ? req.headers[key].substring(0, 20) + '...'
        : req.headers[key];
      logger.info(`  ${key}: ${value}`);
    });

    // Log request body
    logger.info('[AUTH DEBUG] Request body:', safeStringify(req.body));
    logger.info('[AUTH DEBUG] Content-Type:', req.get('Content-Type'));

    try {
      // Check if auth header exists
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        logger.info('[AUTH DEBUG] ❌ No Authorization header found');

        // Special handling for '/email' route - try to extract userId from body
        if (req.originalUrl.includes('/email') && req.body && req.body.userId) {
          logger.info(`[AUTH DEBUG] 📧 Email route detected with userId: ${req.body.userId} in body`);
          logger.info('[AUTH DEBUG] Checking if this is a direct userId authentication attempt');

          try {
            logger.info(`[AUTH DEBUG] Attempting to get user by ID: ${req.body.userId}`);
            const user = await authService.getUserById(req.body.userId);

            if (user) {
              logger.info('[AUTH DEBUG] ✅ Found user by ID:', safeStringify(user));
              req.user = user;
              next();
              return;
            } else {
              logger.info(`[AUTH DEBUG] ❌ No user found with ID: ${req.body.userId}`);
            }
          } catch (userErr) {
            logger.error(`[AUTH DEBUG] ❌ Error fetching user by ID: ${userErr.message}`, { stack: userErr.stack });
          }
        }

        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Please log in again'
        });
      }

      if (!authHeader.startsWith('Bearer ')) {
        logger.info('[AUTH DEBUG] ❌ Authorization header does not start with "Bearer "');
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Please log in again'
        });
      }

      // Extract token
      const token = authHeader.split(' ')[1];
      logger.info(`[AUTH DEBUG] 🔑 Token extracted (first 10 chars): ${token.substring(0, 10)}...`);

      if (!token) {
        logger.info('[AUTH DEBUG] ❌ Token is empty after extraction');
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Please log in again'
        });
      }

      // Verify token
      logger.info('[AUTH DEBUG] 🔍 Attempting to verify token...');
      let decoded;
      try {
        decoded = await authService.verifyToken(token);
        logger.info(`[AUTH DEBUG] ✅ Token verification result:`, safeStringify(decoded));
      } catch (tokenErr) {
        logger.error(`[AUTH DEBUG] ❌ Token verification error: ${tokenErr.message}`, { stack: tokenErr.stack });
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Please log in again'
        });
      }

      if (!decoded) {
        logger.info('[AUTH DEBUG] ❌ Decoded token is null or undefined');
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Please log in again'
        });
      }

      // Extract user identifiers from decoded token
      const tokenUserId = decoded._key || decoded.id || decoded._id || decoded.userId;
      logger.info(`[AUTH DEBUG] 👤 User ID from token: ${tokenUserId}`);

      // Check for userId in request body for extra validation
      if (req.body && req.body.userId) {
        logger.info(`[AUTH DEBUG] 📝 Found userId in request body: ${req.body.userId}`);

        if (tokenUserId && req.body.userId !== tokenUserId) {
          logger.warn(`[AUTH DEBUG] ⚠️ WARNING: userId in body (${req.body.userId}) does not match token userId (${tokenUserId})`);
        } else {
          logger.info('[AUTH DEBUG] ✅ userId in body matches token');
        }
      }

      try {
        // Get complete user data from database to obtain role and token information
        logger.info(`[AUTH DEBUG] Fetching user by ID: ${tokenUserId}`);
        const user = await UserProfileService.getUserProfile(tokenUserId); // Use UserProfileService for consistency
        logger.info(`[AUTH DEBUG] User retrieved successfully by ID: ${tokenUserId}`);

        // Check if user account is disabled
        if (user.disabled === true) {
          logger.info(`[AUTH DEBUG] ❌ User account is disabled: ${tokenUserId}`);
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Your account has been disabled'
          });
        }

        // Check if accessToken matches or is null (indicating revocation, e.g., via force logout)
        logger.info(`[AUTH DEBUG] Checking accessToken for user ${tokenUserId}`);
        if (!user.accessToken || user.accessToken !== token) {
          logger.warn(`[AUTH DEBUG] ❌ Invalid or revoked access token for user ${tokenUserId}`);
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Please log in again'
          });
        }
        logger.info(`[AUTH DEBUG] ✅ Access token validated for user ${tokenUserId}`);

        // Combine token data with user data from database
        req.user = {
          ...decoded,
          role: user.role || 'User', // Get role from database, default to 'User'
          _key: user._key || tokenUserId
        };

        logger.info(`[AUTH DEBUG] ✅ User attached to request with role: ${req.user.role}`);
      } catch (userError) {
        logger.warn(`[AUTH DEBUG] ⚠️ Failed to fetch user details: ${userError.message}`, { stack: userError.stack });
        // Still set basic user data even if fetching details fails
        req.user = decoded;
        logger.info(`[AUTH DEBUG] ✅ User attached to request (without role)`);
      }

      // Check if we need to get additional user data
      if (req.originalUrl.includes('/email')) {
        try {
          logger.info(`[AUTH DEBUG] 📧 Email route - fetching additional user data for ID: ${tokenUserId}`);
          const userDetails = await authService.getUserById(tokenUserId);

          if (userDetails) {
            logger.info('[AUTH DEBUG] ✅ Additional user details found:', safeStringify(userDetails));
          } else {
            logger.warn(`[AUTH DEBUG] ⚠️ WARNING: Could not find additional user details for ID: ${tokenUserId}`);
          }
        } catch (userDetailErr) {
          logger.error(`[AUTH DEBUG] ⚠️ Error fetching additional user details: ${userDetailErr.message}`, { stack: userDetailErr.stack });
        }
      }

      logger.info('[AUTH DEBUG] ✅ Authentication middleware complete, calling next()');
      next();
    } catch (error) {
      logger.info('=======================================================');
      logger.error(`[AUTH DEBUG] ❌ AUTHENTICATION ERROR: ${error.message}`, { stack: error.stack });
      logger.info('=======================================================');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Please log in again'
      });
    }
  },

  /**
   * Check if user is an admin
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async isAdmin(req, res, next) {
    logger.info('\n=======================================================');
    logger.info(`[ADMIN DEBUG] ${new Date().toISOString()} - Admin Check Started`);
    logger.info('=======================================================');

    try {
      // Must be used after authenticate middleware
      if (!req.user) {
        logger.info('[ADMIN DEBUG] ❌ No user object found in request');
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Please log in again'
        });
      }

      const userId = req.user._key || req.user.id || req.user._id || req.user.userId;
      logger.info(`[ADMIN DEBUG] 👤 Checking admin status for user ID: ${userId}`);

      // Get user from database to check role
      logger.info('[ADMIN DEBUG] 🔍 Fetching user details from database...');
      const user = await authService.getUserById(userId);
      logger.info('[ADMIN DEBUG] User details:', safeStringify(user));

      if (!user) {
        logger.info(`[ADMIN DEBUG] ❌ No user found with ID: ${userId}`);
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      // Check if user is admin: either one of the first 10 users OR has role "Admin"
      const isAdmin = parseInt(user._key) <= 10 || user.role === 'Admin';

      logger.info(`[ADMIN DEBUG] Checking role field: ${user.role}`);
      logger.info(`[ADMIN DEBUG] Checking user ID: ${user._key} <= 10: ${parseInt(user._key) <= 10}`);
      logger.info(`[ADMIN DEBUG] User _key: ${user._key}, Is admin? ${isAdmin}`);

      if (!isAdmin) {
        logger.info('[ADMIN DEBUG] ❌ User is not an admin');
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Admin access required'
        });
      }

      logger.info('[ADMIN DEBUG] ✅ Admin check passed, calling next()');
      next();
    } catch (error) {
      logger.info('=======================================================');
      logger.error(`[ADMIN ERROR] ❌ ADMIN CHECK ERROR: ${error.message}`, { stack: error.stack });
      logger.info('=======================================================');
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Error checking admin status'
      });
    }
  }
};

module.exports = authMiddleware;