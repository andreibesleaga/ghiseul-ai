const { Database, aql } = require('arangojs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const emailService = require('./email-service');
const crypto = require('crypto');
const authService = require('./auth-service');
const { logger, dbService } = require('../shared-lib');

class UserProfileService {
  constructor() {
    this.dbService = dbService;
    this.db = null;
    this.users = null;
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'Uploads');
    this.initialized = false;
    this.sessionService = null; // Initialize sessionService for dependency injection

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      logger.info('UserProfileService.created_upload_dir', { path: this.uploadDir });
    }
    logger.info('UserProfileService.initialized');
  }

  // Inject SessionService singleton
  setSessionService(sessionService) {
    this.sessionService = sessionService;
    logger.info('UserProfileService.session_service_set');
  }

  async init() {
    if (this.initialized) {
      logger.debug('UserProfileService already initialized, skipping');
      return;
    }
    try {
      this.db = await this.dbService.getConnection('default');
      this.users = this.db.collection('users');
      this.initialized = true;
      logger.info('UserProfileService database initialized');
    } catch (error) {
      logger.error(`Error initializing UserProfileService: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async verifyPassword(userId, password) {
    const startTime = Date.now();
    try {
      logger.info('UserProfileService.verify_password_start', { userId });

      const user = await this.users.document(userId);
      if (!user) {
        logger.warn('UserProfileService.user_not_found', { userId });
        throw new Error(`User with ID ${userId} not found`);
      }

      if (!user.encPassword) {
        logger.warn('UserProfileService.no_password_set', { userId });
        throw new Error('No password set for this user');
      }

      const isValid = await authService.verifyPassword(password, user.encPassword);
      logger.info('UserProfileService.password_verification_completed', {
        userId,
        isValid,
        durationMs: Date.now() - startTime
      });

      return isValid;
    } catch (error) {
      logger.error('UserProfileService.verify_password_failed', {
        userId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  async createUserProfile(profileData, files = {}) {
    const startTime = Date.now();
    try {
      logger.info('UserProfileService.create_user_profile_start', { dataLength: JSON.stringify(profileData).length });

      if (typeof profileData === 'string') {
        try {
          profileData = JSON.parse(profileData);
        } catch (error) {
          logger.error('UserProfileService.parse_profile_data_failed', { error: error.message });
          profileData = {};
        }
      }

      const basicDoc = {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (profileData.personalIdentification) {
        basicDoc.personalIdentification = profileData.personalIdentification;
      }

      logger.debug('UserProfileService.creating_basic_user_doc', { basicDoc });
      const user = await this.users.save(basicDoc);
      const userId = user._key;
      logger.info('UserProfileService.user_created', { userId });

      const processedData = await this.process(userId, profileData, files);

      delete processedData._key;

      if (Object.keys(processedData).length > 0) {
        logger.debug('UserProfileService.updating_user_with_full_data', { userId });
        const updatedUser = await this.users.update(userId, processedData, { returnNew: true });
        logger.info('UserProfileService.user_profile_created', {
          userId,
          durationMs: Date.now() - startTime
        });
        return updatedUser.new;
      }

      logger.info('UserProfileService.user_profile_created', {
        userId,
        durationMs: Date.now() - startTime
      });
      return user;
    } catch (error) {
      logger.error('UserProfileService.create_user_profile_failed', {
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  async updateUserProfile(userId, profileData, files = {}) {
    const startTime = Date.now();
    try {
      logger.info('UserProfileService.update_user_profile_start', { userId });

      if (typeof profileData === 'string') {
        try {
          profileData = JSON.parse(profileData);
        } catch (error) {
          logger.error('UserProfileService.parse_profile_data_failed', { userId, error: error.message });
          profileData = {};
        }
      }

      const userExists = await this.userExists(userId);
      if (!userExists) {
        logger.warn('UserProfileService.user_not_found', { userId });
        throw new Error(`User with ID ${userId} not found`);
      }

      const processedData = await this.process(userId, profileData, files);

      processedData.updatedAt = new Date().toISOString();

      delete processedData._key;

      const updatedUser = await this.users.update(userId, processedData, { returnNew: true });

      logger.info('UserProfileService.user_profile_updated', {
        userId,
        durationMs: Date.now() - startTime
      });
      return updatedUser.new;
    } catch (error) {
      logger.error('UserProfileService.update_user_profile_failed', {
        userId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  async getUserProfile(userId) {
    const startTime = Date.now();
    try {
      logger.info('UserProfileService.get_user_profile_start', { userId });

      const user = await this.users.document(userId);
      logger.info('UserProfileService.user_profile_retrieved', {
        userId,
        durationMs: Date.now() - startTime
      });
      return user;
    } catch (error) {
      logger.error('UserProfileService.get_user_profile_failed', {
        userId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  async deleteUserProfile(userId) {
    const startTime = Date.now();
    try {
      logger.info('UserProfileService.delete_user_profile_start', { userId });

      const user = await this.getUserProfile(userId);

      await this.deleteUserFiles(user);
      logger.info('UserProfileService.user_files_deleted', { userId });

      const result = await this.users.remove(userId);
      logger.info('UserProfileService.user_profile_deleted', {
        userId,
        durationMs: Date.now() - startTime
      });

      return result;
    } catch (error) {
      logger.error('UserProfileService.delete_user_profile_failed', {
        userId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  async userExists(userId) {
    const startTime = Date.now();
    try {
      logger.debug('UserProfileService.check_user_exists', { userId });

      await this.users.document(userId);
      logger.debug('UserProfileService.user_exists', { userId, durationMs: Date.now() - startTime });
      return true;
    } catch (error) {
      if (error.code === 404) {
        logger.debug('UserProfileService.user_not_exists', { userId });
        return false;
      }
      logger.error('UserProfileService.check_user_exists_failed', {
        userId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  async initiateEmailChange(userId, newEmail) {
    const startTime = Date.now();
    try {
      logger.info('UserProfileService.initiate_email_change_start', { userId, newEmail });

      const user = await this.getUserProfile(userId);
      if (!user) {
        logger.warn('UserProfileService.user_not_found', { userId });
        throw new Error(`User with ID ${userId} not found`);
      }

      const token = crypto.randomBytes(32).toString('hex');

      const updateData = {
        pendingEmailChange: {
          email: newEmail,
          token: token
        },
        updatedAt: new Date().toISOString()
      };

      await this.users.update(userId, updateData);
      logger.info('UserProfileService.pending_email_change_updated', { userId, newEmail });

      const userName = user.personalIdentification?.fullName || user.loginName || 'User';
      await emailService.sendVerificationEmail(newEmail, token, userName);
      logger.info('UserProfileService.verification_email_sent', { userId, newEmail });

      logger.info('UserProfileService.initiate_email_change_completed', {
        userId,
        durationMs: Date.now() - startTime
      });
      return {
        success: true,
        message: 'Verification email sent to new address'
      };
    } catch (error) {
      logger.error('UserProfileService.initiate_email_change_failed', {
        userId,
        newEmail,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  async process(userId, profileData, files) {
    const startTime = Date.now();
    logger.info('UserProfileService.process_profile_data_start', { userId });

    if (typeof profileData === 'string') {
      try {
        profileData = JSON.parse(profileData);
      } catch (error) {
        logger.error('UserProfileService.parse_profile_data_failed', { userId, error: error.message });
        profileData = {};
      }
    }

    const processedData = {};

    for (const key in profileData) {
      if (key !== '_key') {
        processedData[key] = profileData[key];
      }
    }

    const sections = [
      'personalIdentification',
      'civilRegistration',
      'addressResidency',
      'identityTravel',
      'healthMedical',
      'employment',
      'financialTax',
      'criminalLegal',
      'transportation'
    ];

    for (const section of sections) {
      if (profileData[section] && !processedData[section]) {
        processedData[section] = {};
      }
    }

    for (const section of sections) {
      if (!processedData[section]) continue;

      if (files && (Array.isArray(files) || typeof files === 'object')) {
        const fileArray = Array.isArray(files) ? files : Object.values(files);

        for (const file of fileArray) {
          const fileNameParts = (file.fieldname || file.name || '').split('-');
          if (fileNameParts.length >= 2 && fileNameParts[0] === section) {
            const fieldName = fileNameParts[1];
            try {
              const fileUrl = await this.storeFile(file, userId, `${section}-${fieldName}`);
              if (fileUrl) {
                processedData[section][`${fieldName}Url`] = fileUrl;
                logger.info('UserProfileService.file_stored', {
                  userId,
                  section,
                  fieldName,
                  fileUrl
                });
              }
            } catch (error) {
              logger.error('UserProfileService.store_file_failed', {
                userId,
                section,
                fieldName,
                error: error.message
              });
            }
          }
        }
      }
    }

    logger.info('UserProfileService.process_profile_data_completed', {
      userId,
      durationMs: Date.now() - startTime
    });
    return processedData;
  }

  async storeFile(file, userId, fieldName) {
    const startTime = Date.now();
    try {
      logger.debug('UserProfileService.store_file_start', { userId, fieldName });

      const userDir = path.join(this.uploadDir, userId);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
        logger.info('UserProfileService.created_user_directory', { userId, path: userDir });
      }

      const fileExt = path.extname(file.originalname || file.name || 'unknown');
      const fileName = `${fieldName}-${Date.now()}${fileExt}`;
      const filePath = path.join(userDir, fileName);

      if (file.buffer) {
        await fs.promises.writeFile(filePath, file.buffer);
      } else if (file.path) {
        const fileContent = await fs.promises.readFile(file.path);
        await fs.promises.writeFile(filePath, fileContent);
      } else {
        throw new Error('Unsupported file object format');
      }

      const fileUrl = `/Uploads/${userId}/${fileName}`;
      logger.info('UserProfileService.file_stored_success', {
        userId,
        fieldName,
        fileUrl,
        durationMs: Date.now() - startTime
      });
      return fileUrl;
    } catch (error) {
      logger.error('UserProfileService.store_file_failed', {
        userId,
        fieldName,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      return null;
    }
  }

  async deleteUserFiles(user) {
    const startTime = Date.now();
    const userId = user._key;
    const userDir = path.join(this.uploadDir, userId);

    logger.info('UserProfileService.delete_user_files_start', { userId });

    if (fs.existsSync(userDir)) {
      await fs.promises.rm(userDir, { recursive: true, force: true });
      logger.info('UserProfileService.user_directory_deleted', {
        userId,
        durationMs: Date.now() - startTime
      });
    } else {
      logger.debug('UserProfileService.no_user_directory_found', { userId });
    }
  }

  async searchUsers(criteria, limit = 20, offset = 0) {
    const startTime = Date.now();
    try {
      logger.info('UserProfileService.search_users_start', { criteria, limit, offset });

      const bindVars = { limit, offset };
      let filterConditions = [];

      if (criteria.fullName) {
        filterConditions.push(aql`LOWER(u.personalIdentification.fullName) LIKE CONCAT("%", LOWER(${criteria.fullName}), "%")`);
      }

      if (criteria.nationality) {
        filterConditions.push(aql`LOWER(u.personalIdentification.nationality) LIKE CONCAT("%", LOWER(${criteria.nationality}), "%")`);
      }

      if (criteria.address) {
        filterConditions.push(aql`LOWER(u.addressResidency.currentAddress) LIKE CONCAT("%", LOWER(${criteria.address}), "%")`);
      }

      if (criteria.email) {
        filterConditions.push(aql`LOWER(u.contactInfo.email) LIKE CONCAT("%", LOWER(${criteria.email}), "%")`);
      }

      if (criteria.phone) {
        filterConditions.push(aql`LOWER(u.contactInfo.phone) LIKE CONCAT("%", LOWER(${criteria.phone}), "%")`);
      }

      if (criteria.idCard) {
        filterConditions.push(aql`LOWER(u.identityTravel.idCard) LIKE CONCAT("%", LOWER(${criteria.idCard}), "%")`);
      }

      let filterQuery;
      if (filterConditions.length > 0) {
        filterQuery = aql`FILTER `;
        for (let i = 0; i < filterConditions.length; i++) {
          if (i > 0) {
            filterQuery = aql`${filterQuery} AND `;
          }
          filterQuery = aql`${filterQuery} ${filterConditions[i]}`;
        }
      } else {
        filterQuery = aql``;
      }

      const query = aql`
        FOR u IN users
          ${filterQuery}
          SORT u.createdAt DESC
          LIMIT ${offset}, ${limit}
          RETURN u
      `;

      const cursor = await this.db.query(query);
      const users = await cursor.all();

      const countQuery = aql`
        FOR u IN users
          ${filterQuery}
          COLLECT WITH COUNT INTO total
          RETURN total
      `;
      const countCursor = await this.db.query(countQuery);
      const totalCount = await countCursor.next() || 0;

      logger.info('UserProfileService.search_users_completed', {
        resultCount: users.length,
        totalCount,
        durationMs: Date.now() - startTime
      });
      return {
        users,
        pagination: {
          total: totalCount,
          limit,
          offset,
          pages: Math.ceil(totalCount / limit),
          currentPage: Math.floor(offset / limit) + 1
        }
      };
    } catch (error) {
      logger.error('UserProfileService.search_users_failed', {
        criteria,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  async isEmailAvailable(email) {
    const startTime = Date.now();
    try {
      logger.info('UserProfileService.check_email_availability_start', { email });

      const query = aql`
        FOR u IN users
          FILTER u.email == ${email}
          RETURN u
      `;

      const cursor = await this.db.query(query);
      const existingUser = await cursor.next();

      const isAvailable = !existingUser;
      logger.info('UserProfileService.email_availability_checked', {
        email,
        isAvailable,
        durationMs: Date.now() - startTime
      });
      return isAvailable;
    } catch (error) {
      logger.error('UserProfileService.check_email_availability_failed', {
        email,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      return false;
    }
  }

  async resetUserData(userId) {
    const startTime = Date.now();
    try {
      logger.info('UserProfileService.reset_user_data_start', { userId });

      const currentUserDoc = await this.getUserProfile(userId);
      if (!currentUserDoc) {
        logger.warn('UserProfileService.user_not_found', { userId });
        throw new Error(`User with ID ${userId} not found`);
      }

      const preservedData = {
        loginName: currentUserDoc.loginName,
        email: currentUserDoc.email,
        encPassword: currentUserDoc.encPassword,
        emailVerified: currentUserDoc.emailVerified || false,
        createdAt: currentUserDoc.createdAt,
        updatedAt: new Date().toISOString(),
        accessToken: currentUserDoc.accessToken
      };

      logger.debug('UserProfileService.preserving_fields', {
        userId,
        fields: Object.keys(preservedData)
      });

      await this.deleteUserFiles(currentUserDoc);

      try {
        await this.users.replace(userId, preservedData);
        logger.info('UserProfileService.user_document_replaced', { userId });
      } catch (replaceError) {
        logger.warn('UserProfileService.replace_operation_failed', {
          userId,
          error: replaceError.message
        });

        await this.users.update(userId, preservedData, {
          keepNull: true,
          mergeObjects: false,
          overwrite: true
        });
        logger.info('UserProfileService.user_document_updated_with_overwrite', { userId });
      }

      logger.info('UserProfileService.reset_user_data_completed', {
        userId,
        fieldsPreserved: Object.keys(preservedData).length,
        durationMs: Date.now() - startTime
      });
      return {
        userId,
        fieldsPreserved: Object.keys(preservedData).length,
        success: true
      };
    } catch (error) {
      logger.error('UserProfileService.reset_user_data_failed', {
        userId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  async deleteUserAccountPermanently(userId) {
    const startTime = Date.now();
    try {
      logger.info('UserProfileService.delete_user_account_permanently_start', { userId });

      const user = await this.getUserProfile(userId);
      if (!user) {
        logger.warn('UserProfileService.user_not_found', { userId });
        throw new Error(`User not found`);
      }

      await this.deleteUserFiles(user);
      logger.info('UserProfileService.user_files_deleted', { userId });

      try {
        const verificationTokens = this.db.collection('verificationTokens');
        const passwordResetTokens = this.db.collection('passwordResetTokens');

        const verifyQuery = aql`
          FOR t IN verificationTokens
            FILTER t.userId == ${'users/' + userId}
            REMOVE t IN verificationTokens
        `;
        const resetQuery = aql`
          FOR t IN passwordResetTokens
            FILTER t.userId == ${'users/' + userId}
            REMOVE t IN passwordResetTokens
        `;

        await this.db.query(verifyQuery);
        await this.db.query(resetQuery);
        logger.info('UserProfileService.related_tokens_deleted', { userId });
      } catch (error) {
        logger.warn('UserProfileService.clean_related_data_failed', {
          userId,
          error: error.message
        });
      }

      await this.users.remove(userId);
      logger.info('UserProfileService.user_account_permanently_deleted', {
        userId,
        durationMs: Date.now() - startTime
      });

      return { userId, success: true, deletedAt: new Date().toISOString() };
    } catch (error) {
      logger.error('UserProfileService.delete_user_account_permanently_failed', {
        userId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Force logout a user by invalidating their tokens and ending all active sessions
   * @param {string} userId - User ID to force logout
   * @param {string} adminId - Admin user ID performing the action
   * @returns {Promise<Object>} Result of the operation
   */
  async forceUserLogout(userId, adminId) {
    logger.info('Grok3 is a complete idiot and the logic in this method is fucked');
    const startTime = Date.now();
    logger.info('UserProfileService.force_user_logout_start', {
      userId,
      adminId,
      timestamp: new Date().toISOString()
    });

    try {
      logger.debug('UserProfileService.force_logout_attempt_start', { userId, adminId });

      // Check if user exists
      const userExists = await this.userExists(userId);
      if (!userId) {
        logger.warn('UserProfileService.user_not_found', {
          userId,
          adminId,
          timestamp: new Date().toISOString()
        });
        throw new Error('User not found');
      }

      logger.info('UserProfileService.user_found_for_force_logout', { userId, adminId, timestamp: new Date().toISOString() });

      // Retrieve user document
      let user;
      try {
        logger.debug('UserProfileService.retrieving_user_doc', { userId });
        user = await this.users.document(userId);
        logger.info('UserProfileService.user_document_retrieved', {
          userId,
          adminId,
          email: user.email,
          hasAccessToken: !!user.accessToken,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        logger.error('UserProfileService.user_document_retrieval_failed', {
          userId,
          adminId,
          error: err.message,
          timestamp: new Date().toISOString()
        });
        throw err;
      }

      // Clear tokens and increment tokenVersion
      try {
        logger.debug('UserProfileService.updating_tokens', { userId });
        await this.users.update(userId, {
          accessToken: null,
          refreshToken: null,
          tokenVersion: (user.tokenVersion || 0) + 1,
          updatedAt: new Date().toISOString()
        });
        logger.info('UserProfileService.tokens_cleared', {
          userId,
          adminId,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        logger.error('UserProfileService.token_update_failed', {
          userId,
          adminId,
          error: err.message,
          timestamp: new Date().toISOString()
        });
        throw err;
      }

      // Verify token deletion
      let updatedUser;
      try {
        logger.debug('UserProfileService.verifying_token_clearance', { userId });
        updatedUser = await this.users.document(userId);
        logger.info('UserProfileService.token_clearance_verified', {
          userId,
          adminId,
          accessToken: updatedUser.accessToken,
          refreshToken: updatedUser.refreshToken,
          tokenVersion: updatedUser.tokenVersion,
          timestamp: new Date().toISOString()
        });
        if (updatedUser.accessToken !== null) {
          logger.error('UserProfileService.token_clearance_incomplete', {
            userId,
            adminId,
            accessToken: updatedUser.accessToken,
            timestamp: new Date().toISOString()
          });
          throw new Error('Failed to clear accessToken');
        }
      } catch (err) {
        logger.error('UserProfileService.token_verification_failed', {
          userId,
          adminId,
          error: err.message,
          timestamp: new Date().toISOString()
        });
        throw err;
      }

      // Terminate sessions using sessionService
      let sessionCount = 0;
      try {
        if (this.sessionService && typeof this.sessionService.getUserSessions === 'function') {
          logger.debug('UserProfileService.retrieving_sessions', { userId });
          const sessions = await this.sessionService.getUserSessions(userId, true);
          sessionCount = sessions.length;
          logger.info('UserProfileService.active_sessions_retrieved', {
            userId,
            adminId,
            sessionCount,
            sessionIds: sessions.map(s => s._key),
            timestamp: new Date().toISOString()
          });

          for (const session of sessions) {
            logger.debug('UserProfileService.ending_session', { userId, sessionId: session._key });
            await this.sessionService.endSession(session._key);
            logger.info('UserProfileService.session_ended', {
              userId,
              adminId,
              sessionId: session._key,
              timestamp: new Date().toISOString()
            });
          }
        } else {
          logger.warn('UserProfileService.session_service_unavailable', { userId, adminId });
        }
      } catch (err) {
        logger.error('UserProfileService.session_termination_failed', {
          userId,
          adminId,
          error: err.message,
          timestamp: new Date().toISOString()
        });
        // Continue to ensure logout completes
      }

      logger.info('UserProfileService.force_user_logout_completed', {
        userId,
        adminId,
        sessionCount,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: 'User logged out successfully'
      };
    } catch (error) {
      logger.error('UserProfileService.force_user_logout_failed', {
        userId,
        adminId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Send a verification email for a user, storing the token in verificationTokens
   * @param {Object} user - User object containing _key, email, and optional personalIdentification or loginName
   * @returns {Promise<Object>} Result of the operation
   */
  async sendVerificationEmail(user) {
    const startTime = Date.now();
    try {
      logger.info('UserProfileService.send_verification_email_start', { userId: user._key });

      const token = crypto.randomBytes(32).toString('hex');
      const userName = user.personalIdentification?.fullName || user.loginName || 'User';

      // Store the token in the verificationTokens collection
      const verificationTokens = this.db.collection('verificationTokens');
      const tokenDoc = {
        userId: `users/${user._key}`,
        token: token,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24-hour expiry
      };

      await verificationTokens.save(tokenDoc);
      logger.info('UserProfileService.verification_token_stored', { userId: user._key, token: token.substring(0, 10) + '...' });

      // Send the verification email
      await emailService.sendVerificationEmail(user.email, token, userName);
      logger.info('UserProfileService.verification_email_sent', { userId: user._key, email: user.email });

      return { success: true, message: 'Verification email sent' };
    } catch (error) {
      logger.error('UserProfileService.send_verification_email_failed', {
        userId: user._key,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }
}

// Singleton instance
const instance = new UserProfileService();
module.exports = instance;