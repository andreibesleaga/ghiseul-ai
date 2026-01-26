const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { logger } = require('../shared-lib');

// Import middlewares
const { errorHandler } = require('./middlewares/errorHandler');

// Import routes
const fileRoutes = require('./routes/fileRoutes');
const labelRoutes = require('./routes/labelRoutes');

// Import config
const appConfig = require('./config/appConfig');

const app = express();

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerOptions = require('./config/swaggerConfig');

// Generate Swagger specification
try {
  const swaggerSpec = swaggerJsdoc(swaggerOptions);
  logger.info('Swagger specification generated successfully');

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
  }));

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
} catch (error) {
  logger.error('Failed to initialize Swagger:', {
    error: error.message,
    stack: error.stack,
    rawError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    errorType: error?.constructor?.name || 'Unknown',
  });
}


// TODO: [NORMA] should use from shared-lib??
// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

// TODO: [NORMA] should use from shared-lib??
// CORS configuration
app.use(cors({
  origin: appConfig.allowedOrigins || ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true
}));

// TODO: [NORMA] should use from shared-lib??
// **FIX:** Trust the proxy to allow rate limiting based on X-Forwarded-For
app.set('trust proxy', 1); 

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: appConfig.rateLimitMax || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '..', appConfig.upload.uploadDir || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API information endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Document Repository API',
    version: '1.0.0',
    description: 'Backend API for document repository with file upload, virus scanning, label management, and search capabilities',
    endpoints: {
      files: '/api/files',
      health: '/health'
    },
    features: [
      'File upload (doc, pdf, spreadsheet, markdown, html)',
      'Virus scanning',
      'File processing via dataprep service',
      'File search',
      'Label management',
      'ArangoDB integration'
    ]
  });
});

// API routes
app.use('/api/files', fileRoutes);
app.use('/api/labels', labelRoutes);

// Serve uploaded files (with security considerations)
app.use('/uploads', express.static(uploadDir, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Security headers for file serving
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-XSS-Protection', '1; mode=block');
  }
}));

// 404 handler for undefined routes
app.use('*', (req, res) => {
  console.log('Registered routes:', app._router.stack);
  
  const availableRoutes = app._router.stack
    .filter(r => r.route)
    .map((r) => `${Object.keys(r.route.methods).join(', ').toUpperCase()} ${r.route.path}`);
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist.`,
    availableRoutes: availableRoutes
  });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;