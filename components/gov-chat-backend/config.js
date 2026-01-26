// config.js - Simple configuration with just API endpoints
const config = {
    // API configuration
    api: {
      baseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api',
      healthEndpoint: '/health',
      endpoints: [
        '/api/users',
        '/api/queries',
        '/api/logs',
        '/api/sessions',
        '/api/admin/system-health',
        '/api/admin/logs',
        '/api/admin/security-metrics',
        '/api/analytics/dashboard',
        '/api/auth/me'
      ]
    },
    
    // Security scan configuration
    security: {
      hiddenFiles: [
        '/.env',
        '/.git/config',
        '/.gitignore',
        '/.npmrc',
        '/node_modules/.package-lock.json'
      ]
    }
  };
  
  module.exports = config;