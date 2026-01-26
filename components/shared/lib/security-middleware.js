const rateLimit = require('express-rate-limit');
const { logger } = require('./logger');
const validator = require('validator');
const geoip = require('geoip-lite');

class SecurityMiddleware {
  static threatPatterns = {
    sqlInjection: [
      /((\%27)|(\')|(\-\-)|(\%23)|(#))/i,
      /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
      /exec(\s|\+)+(s|x)p\w+/i,
      /UNION(\s|\+)+(ALL|SELECT)/i
    ],
    commandInjection: [
      /(cmd|command)=|(\bls\b|\bcat\b)/i,
      /(\bwget\b|\bcurl\b|\bnc\b)/i
    ],
    crossSiteScripting: [
      /(\%3Cscript)|(script)/i,
      /javascript:/i
    ],
    serverSideInclusion: [
      /<!--#(exec|include)/i
    ],
    pathTraversal: [
      /(\.\.[\/\\])+/i,
      /(%2e%2e[\/\\])+/i,
      /\b(etc\/passwd|\/root\/)\b/i
    ]
  };

  static ipReputation = new Map();

  static apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000,
    standardHeaders: true,
    message: 'Too many requests, please try again later.',
    handler: (req, res, next, options) => {
      SecurityMiddleware.logSecurityEvent('Rate Limit Exceeded', {
        type: 'rate_limit',
        ip: req.ip,
        path: req.path,
        headers: req.headers,
        userAgent: req.headers['user-agent'],
        user: req.user || null
      });
      res.status(options.statusCode).send(options.message);
    }
  });

  static chatApiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 2000,
    standardHeaders: true,
    message: 'Too many requests to chat endpoints, please try again later.',
    handler: (req, res, next, options) => {
      SecurityMiddleware.logSecurityEvent('Chat Rate Limit Exceeded', {
        type: 'chat_rate_limit',
        ip: req.ip,
        path: req.path,
        headers: req.headers,
        userAgent: req.headers['user-agent'],
        user: req.user || null
      });
      res.status(options.statusCode).send(options.message);
    }
  });

  static threatDetectionMiddleware(req, res, next) {
    // Skip threat detection for authenticated requests or auth endpoints
    if (req.headers.authorization || req.user || req.path.startsWith('/api/auth')) {
      logger.debug('Skipping threat detection for authenticated request', {
        ip: req.ip,
        path: req.path,
        user: req.user || null,
        hasAuthHeader: !!req.headers.authorization
      });
      return next();
    }

    const allInputs = {
      ...req.query,
      ...req.body,
      path: req.path
    };

    const threatChecks = [
      { type: 'sqlInjection', patterns: SecurityMiddleware.threatPatterns.sqlInjection },
      { type: 'commandInjection', patterns: SecurityMiddleware.threatPatterns.commandInjection },
      { type: 'crossSiteScripting', patterns: SecurityMiddleware.threatPatterns.crossSiteScripting },
      { type: 'serverSideInclusion', patterns: SecurityMiddleware.threatPatterns.serverSideInclusion },
      { type: 'pathTraversal', patterns: SecurityMiddleware.threatPatterns.pathTraversal }
    ];

    const detectedThreats = SecurityMiddleware.detectThreats(allInputs, threatChecks);

    if (detectedThreats.length > 0) {
      SecurityMiddleware.handleThreatDetection(req, detectedThreats);
      return res.status(403).json({ 
        message: 'Potential security threat detected', 
        threats: detectedThreats 
      });
    }

    SecurityMiddleware.updateIPReputation(req);
    next();
  }

  static detectThreats(inputs, threatChecks) {
    const detectedThreats = [];

    Object.entries(inputs).forEach(([key, value]) => {
      if (typeof value === 'string') {
        threatChecks.forEach(({ type, patterns }) => {
          patterns.forEach(pattern => {
            if (pattern.test(value)) {
              detectedThreats.push({
                type,
                key,
                value,
                pattern: pattern.toString()
              });
            }
          });
        });
      }
    });

    return detectedThreats;
  }

  static handleThreatDetection(req, detectedThreats) {
    const geoInfo = geoip.lookup(req.ip);

    SecurityMiddleware.logSecurityEvent('Threat Detection', {
      type: 'threat_detected',
      ip: req.ip,
      geo: geoInfo ? {
        country: geoInfo.country,
        city: geoInfo.city,
        region: geoInfo.region
      } : null,
      path: req.path,
      method: req.method,
      threats: detectedThreats,
      headers: req.headers,
      userAgent: req.headers['user-agent'],
      user: req.user || null
    });

    SecurityMiddleware.blockIP(req.ip, 'Threat detected');
  }

  static updateIPReputation(req) {
    // Skip reputation scoring for auth endpoints or authenticated requests
    if (req.path.startsWith('/api/auth') || req.headers.authorization || req.user) {
      logger.debug('Skipping IP reputation scoring for authenticated request', {
        ip: req.ip,
        path: req.path,
        user: req.user || null,
        hasAuthHeader: !!req.headers.authorization
      });
      return;
    }

    const ip = req.ip;
    const key = ip;
    const reputation = SecurityMiddleware.ipReputation.get(key) || { 
      score: 0, 
      lastSeen: Date.now() 
    };
    const timeSinceLastSeen = Date.now() - reputation.lastSeen;
    reputation.score = Math.max(0, reputation.score - Math.floor(timeSinceLastSeen / (1000 * 60 * 60)));
    reputation.score += 1;
    SecurityMiddleware.ipReputation.set(key, {
      score: reputation.score,
      lastSeen: Date.now()
    });

    logger.debug('Updated IP reputation', {
      ip,
      score: reputation.score,
      path: req.path
    });

    if (reputation.score > 100) {
      SecurityMiddleware.blockIP(ip, 'High threat score');
    }
  }

  static applySecurityMiddleware(app) {
    // Apply chat-specific rate limiter
    app.use('/api/chat', SecurityMiddleware.chatApiLimiter);

    // Apply general API rate limiter, skipping auth endpoints
    app.use('/api/', (req, res, next) => {
      if (req.path.startsWith('/api/auth')) {
        return next();
      }
      SecurityMiddleware.apiLimiter(req, res, next);
    });

    // Apply threat detection after auth middleware
    app.use(SecurityMiddleware.threatDetectionMiddleware.bind(SecurityMiddleware));

    // Log auth failures
    app.use(SecurityMiddleware.authFailureLogger);

    // Sanitize inputs
    app.use((req, res, next) => {
      Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
          req.query[key] = validator.escape(req.query[key]);
        }
      });
      if (req.body) {
        Object.keys(req.body).forEach(key => {
          if (typeof req.body[key] === 'string') {
            req.body[key] = validator.escape(req.body[key]);
          }
        });
      }
      next();
    });
  }

  static blockIP(ip, reason) {
    logger.warn('IP Blocked', { 
      ip, 
      reason 
    });
  }

  static logSecurityEvent(eventName, eventDetails) {
    logger.warn(eventName, eventDetails);
  }

  static authFailureLogger(req, res, next) {
    const originalEnd = res.end;
    
    res.end = function(chunk, encoding) {
      if (res.statusCode === 401 || res.statusCode === 403) {
        SecurityMiddleware.logSecurityEvent(`Authentication Failure - ${res.statusCode}`, {
          ip: req.ip,
          path: req.path,
          method: req.method,
          headers: req.headers,
          userAgent: req.headers['user-agent'],
          user: req.user || null
        });
      }
      return originalEnd.call(this, chunk, encoding);
    };
    next();
  }
}

module.exports = SecurityMiddleware;