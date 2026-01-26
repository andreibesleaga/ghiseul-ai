const { logger } = require('../../shared-lib');
const securityService = require('../services/securityService');

const authenticateToken = async (req, res, next) => {

  // Log request headers
  logger.info('[AUTH MIDDLEWARE] Request headers:');
  Object.keys(req.headers).forEach(key => {
    // Don't log the full token for security
    const value = key.toLowerCase() === 'authorization' 
      ? req.headers[key].substring(0, 20) + '...' 
      : req.headers[key];
    logger.info(`  ${key}: ${value}`);
  });
  
  try {
    // Check if auth header exists
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logger.info('[AUTH MIDDLEWARE] ❌ No Authorization header found');
      return res.status(401).json({ success: false, message: 'Authorization header missing' });
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      logger.info('[AUTH MIDDLEWARE] ❌ Authorization header does not start with "Bearer "');
      return res.status(401).json({ success: false, message: 'Invalid authorization format' });
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    logger.info(`[AUTH MIDDLEWARE] 🔑 Token extracted (first 10 chars): ${token.substring(0, 10)}...`);
    
    // Verify token
    logger.info('[AUTH MIDDLEWARE] Verifying token...');
    let decoded;
    try {
      decoded = await securityService.verifyToken(token);
      logger.debug(`[AUTH MIDDLEWARE] Decoded ${JSON.stringify(decoded)}`)
    } catch (tokenErr) {
      logger.error(`[AUTH MIDDLEWARE] ❌ Token verification error: ${tokenErr.message}`, { stack: tokenErr.stack });
      return res.status(401).json({ success: false, message: `Token verification failed: ${tokenErr.message}` });
    }
    
    if (!decoded) {
      logger.info('[AUTH DEBUG] ❌ Decoded token is null or undefined');
      return res.status(401).json({ success: false, message: 'Invalid token - could not decode' });
    }    
    
    try {
      // Get complete user data from database to obtain role information
      const user = await securityService.getUserById(decoded.userId);
      
      // Check if user account is disabled
      if (user.disabled === true) {
        logger.info(`[AUTH DEBUG] ❌ User account is disabled: ${decoded.userId}`);
        return res.status(403).json({ success: false, message: 'Your account has been disabled' });
      }
      
      // Combine token data with user data from database to get user role
      // Overwrite req.user with user data from database to be passed to the next middleware
      req.user = {
        ...decoded,
        role: user.role || 'User', // Get role from database, default to 'User'
        _key: user._key || decoded.userId
      };      
      logger.info(`[AUTH DEBUG] ✅ User attached to request with role: ${req.user.role}`);
    
    } catch (userError) {
      logger.warn(`[AUTH DEBUG] ⚠️ Failed to fetch user details: ${userError.message}`, { stack: userError.stack });
      // Still set basic user data even if fetching details fails
      req.user = decoded;
      logger.info(`[AUTH DEBUG] ✅ User attached to request (without role)`);
    }
    next();
  } catch (error) {
    logger.error(`[AUTH DEBUG] ❌ Error in isAuthenticated middleware: ${error.message}`, { stack: error.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const authorizeRole = (allowedRoles) => {
    return async (req, res, next) => {   
      logger.info(`[AUTH MIDDLEWARE] Validating if user has allowed roles [${allowedRoles.join(', ')}] ...`)
      
      try {
        // Must be used after authenticate middleware
        if (!req.user.userId || !req.user.role) {
          logger.info('[AUTH MIDDLEWARE] ❌ No user object found in request');
          return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        
        const userId = req.user.userId;
        const userRole = req.user.role;
                
        // Check if user has any of the allowed roles
        logger.info(`[AUTH MIDDLEWARE] Checking. UserID: ${userId} - Role: ${userRole}`);
        const hasAllowedRole = allowedRoles.some(role => role.toLowerCase() === String(userRole).toLowerCase());
        
        if (!hasAllowedRole) {
          logger.info(`[AUTH MIDDLEWARE] ❌ User role "${userRole}" not in allowed roles: [${allowedRoles.join(', ')}]`);
          return res.status(403).json({ 
            success: false, 
            message: `Access denied. User does not have sufficient role}` 
          });
        }
        
        logger.info(`[AUTH MIDDLEWARE] ✅ Role check passed for any of: [${allowedRoles.join(', ')}]`);
        next();
      } catch (error) {
        logger.error(`[AUTH MIDDLEWARE] ❌ ROLE CHECK ERROR: ${error.message}`, { stack: error.stack });
        res.status(500).json({ 
          success: false, 
          message: 'Error checking role permissions', 
          error: error.message 
        });
      }
    }
}

module.exports = {
  authenticateToken,
  authorizeRole
}; 

