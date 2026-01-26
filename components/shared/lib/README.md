# Shared Libraries for Node.js Applications

This repository contains a set of shared utilities and middleware for Node.js applications, focusing on logging, database connection management, security headers, and API security middleware. These libraries are designed to enhance security, reliability, and maintainability in backend services.

## Table of Contents

- [Shared Libraries for Node.js Applications](#shared-libraries-for-nodejs-applications)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Exported Components](#exported-components)
    - [Logger](#logger)
    - [Database Service](#database-service)
    - [Security Headers](#security-headers)
    - [Security Middleware](#security-middleware)
  - [Configuration](#configuration)
  - [Examples](#examples)
    - [Basic Express Integration](#basic-express-integration)
    - [Reconfiguring Logger](#reconfiguring-logger)
    - [Monitoring Database Health](#monitoring-database-health)
  - [Contributing](#contributing)
  - [License](#license)

## Installation

To use these shared libraries in your project, install the required dependencies and copy or link the files. The libraries depend on external packages such as `winston`, `winston-daily-rotate-file`, `arangojs`, `async-retry`, `express-rate-limit`, `validator`, and `geoip-lite`.

Run the following to install dependencies (assuming this is a package):

```bash
npm install winston winston-daily-rotate-file arangojs async-retry express-rate-limit validator geoip-lite
```

If this is used as a local module, require it in your project:

```javascript
const sharedLibs = require('./path/to/shared-lib');
```

## Usage

Import the desired components from the index file:

```javascript
const { logger, dbService, securityHeaders, SecurityMiddleware } = require('./shared-lib');
```

These can be integrated into Express.js applications or other Node.js services for logging, database management, and security enhancements.

## Exported Components

### Logger

A configurable Winston-based logger with support for console output, daily rotating files, and exception handling.

- **Features**:
  - Logs to console with colorization.
  - Daily rotated error and combined logs (e.g., `logs/error-YYYY-MM-DD.log`).
  - Static combined log file with size limits.
  - Configurable log levels, max sizes, and retention periods.
  - Functions for reconfiguration, manual log rollover, cleanup, and flushing.

- **Exported Functions**:
  - `reconfigureLogger(newConfig)`: Updates logger configuration (e.g., log level, file sizes).
  - `triggerLogRollover()`: Manually rotates log files.
  - `cleanupCombinedLog()`: Removes the large combined log file.
  - `flushLogs()`: Flushes all pending logs.

- **Usage Example**:
  ```javascript
  logger.info('Application started');
  logger.error('An error occurred', { details: error });
  ```

### Database Service

A singleton service for managing long-lived connections to ArangoDB, with automatic recovery, health checks, and proxy-based self-healing.

- **Features**:
  - Singleton pattern for connection management.
  - Automatic retry on connection failures.
  - Health checks, idle timeouts, and max age for connections.
  - Self-healing proxies that auto-update on recovery.
  - Support for multiple named connections.
  - Detailed info and health summary methods.

- **Environment Variables**:
  - `ARANGO_URL`: Database URL (default: `http://arango-vector-db:8529`).
  - `ARANGO_DB`: Database name (default: `node-services`).

- **Key Methods**:
  - `getConnection(name = 'default', config = {})`: Returns a self-healing database proxy.
  - `performFullHealthCheck()`: Checks and recovers all connections.
  - `getDetailedConnectionInfo(name)`: Returns connection details.
  - `getHealthSummary()`: Returns overall connection health stats.
  - `onConnectionRecovery(name, callback)`: Registers a callback for recovery events.
  - `cleanupConnection(name)`: Cleans up resources for a connection.

- **Usage Example**:
  ```javascript
  const db = await dbService.getConnection('myDb');
  const cursor = await db.query('FOR doc IN collection RETURN doc');
  ```

**Note**: The service uses proxies to handle methods like `query`, `collection`, `graph`, etc., with automatic reconnection on errors.

### Security Headers

Middleware to set security-related HTTP headers in responses.

- **Features**:
  - Sets Content-Security-Policy (CSP), Access-Control-Allow-* headers, X-Content-Type-Options, X-Frame-Options, etc.
  - Configurable CORS origin via `CORS_ORIGIN` environment variable.
  - Logs secure requests with details (method, URL, headers, etc.).

- **Usage**:
  This is an Express middleware function. Apply it to your app:

  ```javascript
  app.use(securityHeaders);
  ```

### Security Middleware

A class providing middleware for threat detection, rate limiting, and input sanitization in Express.js applications.

- **Features**:
  - Rate limiting for general APIs (1000 req/min) and chat APIs (2000 req/min).
  - Threat detection for SQL injection, command injection, XSS, path traversal, etc. (skipped for authenticated requests).
  - IP reputation scoring and blocking.
  - Input sanitization using `validator`.
  - Logging of security events (e.g., threats, auth failures).

- **Static Methods**:
  - `applySecurityMiddleware(app)`: Applies all middleware to an Express app.
  - `threatDetectionMiddleware(req, res, next)`: Detects threats in queries and bodies.
  - `logSecurityEvent(eventName, details)`: Logs security-related events.

- **Usage**:
  ```javascript
  SecurityMiddleware.applySecurityMiddleware(app);
  ```

## Configuration

- **Logger**:
  - Customize via `reconfigureLogger({ level: 'debug', errorMaxSize: '20m', ... })`.

- **Database**:
  - Set environment variables for ArangoDB connection.
  - Adjust timeouts and retries in the `DatabaseService` class.

- **Security Headers**:
  - Set `CORS_ORIGIN` for allowed origins.

- **Security Middleware**:
  - Modify `threatPatterns` for custom detection rules.
  - Adjust rate limits in `apiLimiter` and `chatApiLimiter`.

Ensure directories like `logs/` exist for logging.

## Examples

### Basic Express Integration

```javascript
const express = require('express');
const { logger, dbService, securityHeaders, SecurityMiddleware } = require('./shared-lib');

const app = express();

SecurityMiddleware.applySecurityMiddleware(app);
app.use(securityHeaders);

app.get('/', async (req, res) => {
  try {
    const db = await dbService.getConnection();
    // Perform DB operations...
    logger.info('Request handled');
    res.send('Hello World');
  } catch (error) {
    logger.error('Error in route', { error });
    res.status(500).send('Error');
  }
});

app.listen(3000, () => logger.info('Server started'));
```

### Reconfiguring Logger

```javascript
loggerModule.reconfigureLogger({
  level: 'debug',
  errorMaxSize: '20m',
  combinedMaxFiles: '60d'
});
```

### Monitoring Database Health

```javascript
const health = await dbService.performFullHealthCheck();
console.log(health.summary);
```

## Contributing

Contributions are welcome! Please submit pull requests for bug fixes or new features. Ensure code follows ESLint standards and includes tests where applicable.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.