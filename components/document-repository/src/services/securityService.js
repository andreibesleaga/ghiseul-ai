const jwt = require('jsonwebtoken');
const NodeClam = require('clamscan');
const { Readable } = require('stream');

const appConfig= require('../config/appConfig');
const { logger } = require('../../shared-lib');
const { dbService } = require('../../shared-lib');


class SecurityService {
  constructor() {
    this.clamAVOptions = {
      removeInfected: appConfig.clamscan.removeInfected,
      quarantineInfected: appConfig.clamscan.quarantineInfected,
      debugMode: appConfig.clamscan.debugMode,
      clamdscan: {
        socket: appConfig.clamscan.socket,
        port: appConfig.clamscan.port,
        timeout: parseInt(appConfig.clamscan.timeout, 10) || 60000,
        localFallback: appConfig.clamscan.localFallback,
        path: appConfig.clamscan.path,
        active: appConfig.clamscan.active
      },
      preference: 'clamdscan'
    };
    
    this.clamscan = null;
    this.isInitialized = false;
    this.maxBufferSize = 100 * 1024 * 1024; // 100MB
  }

  async getDb() {
    return await dbService.getConnection('default');
  }

  /*
   * Converts a buffer to a stream
   * @param {Buffer} buffer - Buffer to convert
   * @returns {Readable} Stream
   */
  _convertToStream(buffer) {
    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);
    return bufferStream;
  }

  /**
   * Initialize the ClamAV scanner
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized && this.clamscan) {
      return;
    }

    logger.debug(`[SECURITY-SERVICE] Initializing...`);
    try {
      if (appConfig.virusScanning) 
        logger.debug(`[SECURITY-SERVICE] Initializing ClamAV scanner`);
        this.clamscan = await new NodeClam().init(this.clamAVOptions);
    } catch (error) {
      throw new Error(`Failed to initialize ClamAV: ${error.message}`);
    }

    this.isInitialized = true;
  }

  /**
   * Ensures the scanner is initialized before use
   * @returns {Promise<void>}
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Scans a buffer for viruses using ClamAV
   * @param {Buffer} buffer - File buffer to scan
   * @returns {Promise<Object>} Scan result
   */
  async scanBuffer(buffer) {
    logger.debug(`[SECURITY-SERVICE] Scanning buffer of size ${buffer.length} bytes`);
    try {
      // Validate input
      if (!Buffer.isBuffer(buffer)) {
        throw new Error('Input must be a Buffer');
      }

      if (buffer.length === 0) {
        throw new Error('Buffer is empty');
      }

      if (buffer.length > this.maxBufferSize) {
        throw new Error(`Buffer size exceeds maximum allowed size of ${this.maxBufferSize} bytes`);
      }
      await this.ensureInitialized();

      // Scan the buffer using stream scanning
      return await this.clamscan.scanStream(this._convertToStream(buffer));

    } catch (error) {
      throw new Error(`Buffer scan failed: ${error.message}`);
    }
  }

  async verifyToken(token) {
    await this.ensureInitialized();
    try {
      logger.info(`[SECURITY SERVICE] Verifying Token with value ${token.substring(0, 10)}...`);
      const decoded = jwt.verify(token, appConfig.security.jwtSecret);
      
      // return toke
      logger.debug(`[SECURITY SERVICE] ✅ Token successfully decoded ${JSON.stringify(decoded)}`)      
      return decoded;
    } catch (error) {
      logger.error(`[SECURITY SERVICE] ❌ Token verification error: ${error.message}`, { stack: error.stack });
      return null;
    }
  }

  async getUserById(userId) {
    await this.ensureInitialized();
    try {
      logger.info(`[SECURITY SERVICE] Getting user info for userId ${userId} ...`);
      const db = await this.getDb();
      const user = await db.collection('users').document(userId);
      if (!user) {
        logger.warn(`[SECURITY SERVICE] ⚠️ User not found: ${userId}`);
        return null;
      }

      // return user
      logger.info(`[SECURITY SERVICE] ✅ User found: ${userId}`);
      return user;
    } catch (error) {
      logger.error(`[SECURITY SERVICE] ❌ Error getting user by ID: ${error.message}`, { stack: error.stack });
      return null;
    }
  }
}

module.exports = new SecurityService();