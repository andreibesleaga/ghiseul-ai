// shared-lib/security-headers.js

const { logger } = require('./logger');

/**
 * Sets miscellaneous security headers that are not managed by dedicated middleware like 'helmet' (for CSP) or 'cors' (for CORS).
 * This prevents conflicts and centralizes configuration in index.js.
 */
const securityHeaders = (req, res, next) => {
  // CSP and CORS headers have been REMOVED from this file to be managed by 'helmet' and 'cors' in index.js.

  // Sets security headers to prevent various attacks
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('X-XSS-Protection', '1; mode=block');

  // Enforces HTTPS
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Controls caching to prevent sensitive data from being stored
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  // Controls referrer information
  res.set('Referrer-Policy', 'no-referrer-when-downgrade');
  
  // Controls browser feature permissions
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.set('Feature-Policy', 'camera none; microphone none; geolocation none');

  // Optional: Logging for secure requests can remain if you find it useful
  logger.info(`HTTP_SECURE_REQUEST: ${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    remoteAddress: req.ip,
    referrer: req.get('Referrer') || 'none',
    userAgent: req.get('User-Agent') || 'none'
  });

  next();
};

module.exports = securityHeaders;