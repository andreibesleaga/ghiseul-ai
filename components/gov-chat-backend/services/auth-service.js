require('dotenv').config();
const { Database, aql } = require('arangojs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('./email-service');
const { logger, dbService } = require('../shared-lib');
const retry = require('async-retry');

class AuthService {
  constructor() {
    this.dbService = dbService;
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-here-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.tokenExpiryMinutes = 5; // Token expires in 5 minutes
    this.initialized = false;
    this.sessionService = null; // Will be set via setSessionService
    logger.info('AuthService constructor called');
  }

  // Setter for SessionService singleton
  setSessionService(sessionService) {
    if (!sessionService || typeof sessionService.createSession !== 'function') {
      logger.error('Invalid sessionService provided to AuthService');
      throw new Error('Invalid sessionService');
    }
    this.sessionService = sessionService;
    logger.debug('SessionService set in AuthService');
  }

  async init() {
    try {
      logger.info('Starting AuthService initialization');
      this.db = await this.dbService.getConnection();
      if (!this.db) {
        throw new Error('Failed to get database connection from dbService');
      }
      this.users = this.db.collection('users');
      this.passwordResetTokens = this.db.collection('passwordResetTokens');
      this.verificationTokens = this.db.collection('verificationTokens');
      await this.initialize();
      this.initialized = true;
      logger.info('AuthService initialized successfully');
    } catch (error) {
      logger.error(`Error initializing AuthService: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async initialize() {
    try {
      logger.info('Initializing collections and indexes');
      const collections = await this.db.listCollections();
      const collectionNames = collections.map(c => c.name);

      if (!collectionNames.includes('passwordResetTokens')) {
        logger.info('Creating passwordResetTokens collection...');
        await this.db.createCollection('passwordResetTokens');
        logger.info('Created passwordResetTokens collection successfully');

        await Promise.all([
          this.passwordResetTokens.ensureIndex({ type: 'persistent', fields: ['userId'] }),
          this.passwordResetTokens.ensureIndex({ type: 'persistent', fields: ['token'], unique: true }),
          this.passwordResetTokens.ensureIndex({ type: 'persistent', fields: ['expiresAt'] }),
          this.passwordResetTokens.ensureIndex({ type: 'persistent', fields: ['used'] }),
        ]);
        logger.info('Indexes created for passwordResetTokens');
      } else {
        logger.info('passwordResetTokens collection already exists, skipping creation');
      }

      if (!collectionNames.includes('verificationTokens')) {
        logger.info('Creating verificationTokens collection...');
        await this.db.createCollection('verificationTokens');
        logger.info('Created verificationTokens collection successfully');

        await Promise.all([
          this.verificationTokens.ensureIndex({ type: 'persistent', fields: ['userId'] }),
          this.verificationTokens.ensureIndex({ type: 'persistent', fields: ['token'], unique: true }),
          this.verificationTokens.ensureIndex({ type: 'persistent', fields: ['expiresAt'] }),
          this.verificationTokens.ensureIndex({ type: 'persistent', fields: ['used'] }),
        ]);
        logger.info('Indexes created for verificationTokens');
      } else {
        logger.info('verificationTokens collection already exists, skipping creation');
      }

      if (!collectionNames.includes('users')) {
        logger.info('Creating users collection...');
        await this.db.createCollection('users');
        logger.info('Created users collection successfully');
      } else {
        logger.info('users collection already exists');
      }

      await Promise.all([
        this.users.ensureIndex({ type: 'persistent', fields: ['loginName'], unique: true }),
        this.users.ensureIndex({ type: 'persistent', fields: ['email'], unique: true }),
      ]);
      logger.info('Indexes ensured for users collection');

      logger.info('Auth service initialized successfully');
    } catch (error) {
      logger.error(`Error initializing auth service collections: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async register(userData) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    try {
      logger.info(`Registering new user with loginName: ${userData.loginName}`);

      const frontendUrl = userData.frontendUrl;
      const backendUrl = userData.backendUrl;

      if (frontendUrl) logger.info(`Frontend URL for registration: ${frontendUrl}`);
      if (backendUrl) logger.info(`Backend URL for registration: ${backendUrl}`);

      if (!userData.loginName || !userData.email || !userData.encPassword) {
        logger.warn('Missing required fields: loginName, email, and encPassword are required');
        throw new Error('Missing required fields: loginName, email, and encPassword are required');
      }

      const existing = await this.getUserByLoginNameOrEmail(userData.loginName, userData.email);
      if (existing) {
        if (existing.loginName === userData.loginName) {
          logger.warn(`Username already exists: ${userData.loginName}`);
          throw new Error('Username already exists');
        } else {
          logger.warn(`Email already exists: ${userData.email}`);
          throw new Error('Email already exists');
        }
      }

      const hashedPassword = await this.hashPassword(userData.encPassword);

      const user = {
        loginName: userData.loginName,
        email: userData.email,
        encPassword: hashedPassword,
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        personalIdentification: {
          fullName: userData.fullName || userData.loginName,
          dob: userData.dob || '',
          gender: userData.gender || '',
          nationality: userData.nationality || '',
          maritalStatus: userData.maritalStatus || ''
        },
        addressResidency: {
          currentAddress: userData.address || ''
        }
      };

      logger.info('Saving user to database...');
      const savedUser = await this.users.save(user);
      logger.info(`Saved user before email verification: ${savedUser._key}`);

      setImmediate(async () => {
        try {
          const freshUser = await this.getUserById(savedUser._key);
          if (freshUser) {
            await this.sendVerificationEmail(freshUser, frontendUrl, backendUrl);
          } else {
            logger.error(`Could not retrieve fresh user for email verification: ${savedUser._key}`);
          }
        } catch (emailError) {
          logger.error(`Email verification failed, but user was registered: ${emailError.message}`, { stack: emailError.stack });
        }
      });

      const accessToken = this.generateToken(savedUser);

      await this.users.update(savedUser._key, {
        accessToken: accessToken
      });

      const { encPassword, ...userWithoutPassword } = savedUser;
      logger.info(`User registered successfully with ID: ${savedUser._key}`);
      return {
        ...userWithoutPassword,
        accessToken
      };
    } catch (error) {
      logger.error(`Error registering user: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async login(loginName, encPassword) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    if (!this.sessionService) throw new Error('SessionService not set in AuthService');
    try {
      logger.info(`Attempting login for user: ${loginName}`);
      const user = await this.getUserByLoginNameOrEmail(loginName, loginName);
      if (!user) throw new Error('User not found');
      const isPasswordValid = await this.verifyPassword(encPassword, user.encPassword);
      if (!isPasswordValid) throw new Error('Invalid password');
      if (user.disabled === true) throw new Error('This account has been disabled');
      if (!user.emailVerified) throw new Error('Email not verified');

      // --- FIX ADDED HERE ---
      // Create a session record for analytics and session management
      // This will either retrieve an existing active session or create a new one.
      try {
        await this.sessionService.getOrCreateSession(user._key);
        logger.info(`Session created or retrieved for user: ${user._key}`);
      } catch (sessionError) {
        // Log the error but don't fail the login
        logger.error(`Failed to create session for user ${user._key}: ${sessionError.message}`, { stack: sessionError.stack });
      }
      // --- END OF FIX ---

      const accessToken = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user._key, user.tokenVersion || 0); // Include tokenVersion
      await this.users.update(user._key, {
        accessToken: accessToken,
        refreshToken: refreshToken,
        updatedAt: new Date().toISOString()
      });
      // Remove encPassword from user object
      const { encPassword: password, ...userWithoutPassword } = user;
      logger.info(`User logged in successfully: ${loginName}`);
      return {
        ...userWithoutPassword,
        accessToken,
        refreshToken
      };
    } catch (error) {
      logger.error(`Error during login: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async refreshToken(refreshToken) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    const startTime = Date.now();
    try {
      logger.info('AuthService.refresh_token_start');

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.jwtSecret);
      if (!decoded || !decoded.userId) {
        logger.warn('AuthService.invalid_refresh_token', { token: refreshToken.substring(0, 10) + '...' });
        throw new Error('Invalid refresh token');
      }

      // Fetch user to validate tokenVersion
      const user = await this.getUserById(decoded.userId);
      if (!user) {
        logger.warn('AuthService.user_not_found', { userId: decoded.userId });
        throw new Error('User not found');
      }

      // Check token version
      const currentTokenVersion = user.tokenVersion || 0;
      const tokenVersionInToken = decoded.tokenVersion || 0;
      if (currentTokenVersion !== tokenVersionInToken) {
        logger.warn('AuthService.invalid_token_version', {
          userId: decoded.userId,
          currentTokenVersion,
          tokenVersionInToken
        });
        throw new Error('Invalid refresh token');
      }

      // Generate new tokens
      logger.info(`AuthService.generating_tokens_for_user`, { userId: decoded.userId });
      const accessToken = this.generateToken({ _key: decoded.userId });
      const newRefreshToken = this.generateRefreshToken(decoded.userId, currentTokenVersion);

      // Update tokens in database
      try {
        await this.users.update(decoded.userId, {
          accessToken,
          refreshToken: newRefreshToken,
          updatedAt: new Date().toISOString()
        });
        logger.info('AuthService.tokens_updated', { userId: decoded.userId });
      } catch (dbError) {
        logger.warn('AuthService.token_update_failed', {
          userId: decoded.userId,
          error: dbError.message
        });
        // Continue without failing the refresh
      }

      logger.info('AuthService.refresh_token_success', {
        userId: decoded.userId,
        durationMs: Date.now() - startTime
      });
      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      logger.error('AuthService.refresh_token_failed', {
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw new Error('Invalid refresh token');
    }
  }

  generateRefreshToken(userId, tokenVersion) {
    logger.info(`AuthService.generating_refresh_token`, { userId });
    const token = jwt.sign(
      { userId, tokenVersion: tokenVersion || 0 },
      this.jwtSecret,
      { expiresIn: '7d' }
    );
    logger.info(`AuthService.refresh_token_generated`, { userId });
    return token;
  }

  async logout(userId, token) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    if (!this.sessionService) throw new Error('SessionService not set in AuthService');
    try {
      logger.info(`Logging out user with ID: ${userId}`);

      // Validate token
      let decoded;
      try {
        decoded = jwt.verify(token, this.jwtSecret);
        if (!decoded || decoded.userId !== userId) {
          logger.warn(`Invalid token for logout, user: ${userId}`);
          return { success: true, message: 'Logged out successfully (invalid token)' };
        }
      } catch (tokenError) {
        logger.warn(`Token verification failed for logout, user: ${userId}: ${tokenError.message}`);
        return { success: true, message: 'Logged out successfully (token error)' };
      }

      // Try to update session and clear tokens
      let sessionUpdated = false;
      try {
        await this.users.update(userId, {
          accessToken: null,
          refreshToken: null,
          updatedAt: new Date().toISOString()
        });
        logger.info(`Tokens cleared for user: ${userId}`);

        try {
          const activeSession = await this.sessionService.getActiveSession(userId);
          if (activeSession) {
            logger.info(`Ending active session ${activeSession._key} for user ${userId} during logout`);
            await this.sessionService.endSession(activeSession._key);
            sessionUpdated = true;
          }
        } catch (sessionError) {
          logger.warn(`Failed to end session for user ${userId}: ${sessionError.message}`);
        }
      } catch (dbError) {
        logger.warn(`Failed to update tokens or session for user ${userId}: ${dbError.message}`);
      }

      logger.info(`Logout successful for user: ${userId}`);
      return { success: true, message: sessionUpdated ? 'Logged out successfully' : 'Logged out successfully (session update skipped)' };
    } catch (error) {
      logger.error(`Error logging out user ${userId}: ${error.message}`, { stack: error.stack });
      return { success: true, message: 'Logged out successfully (error occurred)' };
    }
  }

  async sendVerificationEmail(user, frontendUrl, backendUrl) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    try {
      if (!user || !user.email) {
        logger.error('Missing user or email for verification email', { user });
        throw new Error('User or email is missing for verification');
      }

      const envFrontendUrl = process.env.FRONTEND_URL;
      const finalFrontendUrl = envFrontendUrl || frontendUrl;

      logger.info(`Preparing to send verification email to ${user.email}`);

      if (envFrontendUrl) logger.info(`Using environment FRONTEND_URL: ${envFrontendUrl}`);
      else if (frontendUrl) logger.info(`Using provided frontend URL: ${frontendUrl}`);
      else logger.info('No frontend URL provided, using email service default');

      if (backendUrl) logger.info(`Using backend URL: ${backendUrl}`);

      const cleanupQuery = aql`
        FOR t IN verificationTokens
          FILTER t.userId == ${'users/' + user._key} AND t.used == false
          REMOVE t IN verificationTokens
      `;
      await this.db.query(cleanupQuery);
      logger.info(`Cleaned up existing unused verification tokens for user ${user._key}`);

      const token = crypto.randomBytes(32).toString('hex');

      const now = new Date();
      const expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000));

      try {
        await this.verificationTokens.save({
          userId: `users/${user._key}`,
          token: token,
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          used: false,
          email: user.email
        });
        logger.info(`Verification token saved for user ${user._key}`);
      } catch (saveError) {
        logger.error(`Error saving verification token: ${saveError.message}`, { stack: saveError.stack });
        throw new Error('Failed to create verification token');
      }

      let verificationEndpointUrl;
      if (backendUrl) {
        verificationEndpointUrl = `${backendUrl}/api/auth/verify-email/${token}`;
        logger.info(`Using backend verification endpoint URL: ${verificationEndpointUrl}`);
      }

      try {
        await emailService.sendVerificationEmail(
          user.email,
          token,
          user.personalIdentification?.fullName || user.loginName,
          finalFrontendUrl,
          verificationEndpointUrl
        );

        if (process.env.NODE_ENV === 'development') {
          logger.info(`Email verification token for ${user.email}: ${token}`);
        }

        logger.info(`Verification email sent successfully to ${user.email}`);
        return { success: true, message: 'Verification email sent' };
      } catch (emailError) {
        logger.error(`Error sending verification email for user ${user._key}: ${emailError.message}`, { stack: emailError.stack });

        const removeTokenQuery = aql`
          FOR t IN verificationTokens
            FILTER t.token == ${token}
            REMOVE t IN verificationTokens
        `;
        await this.db.query(removeTokenQuery);
        logger.info(`Removed verification token due to email sending failure for user ${user._key}`);

        if (process.env.NODE_ENV === 'development') {
          logger.info('DEV MODE: Continuing with registration despite email error');
          logger.info(`DEV MODE: Verification token for ${user.email}: ${token}`);
          return { success: false, message: 'Could not send verification email', token };
        }
        throw emailError;
      }
    } catch (error) {
      logger.error(`Error in verification email process for user: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async resendVerificationEmail(email, frontendUrl, backendUrl) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    try {
      logger.info(`Resending verification email to: ${email}`);

      const envFrontendUrl = process.env.FRONTEND_URL;
      const finalFrontendUrl = envFrontendUrl || frontendUrl;

      if (envFrontendUrl) logger.info(`Using environment FRONTEND_URL: ${envFrontendUrl}`);
      else if (frontendUrl) logger.info(`Using provided frontend URL: ${frontendUrl}`);
      else logger.info('No frontend URL provided, using email service default');

      if (backendUrl) logger.info(`Using backend URL: ${backendUrl}`);

      const user = await this.getUserByEmail(email);
      if (!user) {
        logger.info(`User not found for email: ${email}, returning generic response`);
        return {
          success: true,
          message: 'If your email exists in our system, a verification email has been sent'
        };
      }

      if (user.emailVerified) {
        logger.info(`Email already verified for: ${email}, returning generic response`);
        return {
          success: true,
          message: 'If your email exists in our system, a verification email has been sent'
        };
      }

      await this.sendVerificationEmail(user, finalFrontendUrl, backendUrl);
      logger.info(`Verification email resent successfully to: ${email}`);

      return {
        success: true,
        message: 'If your email exists in our system, a verification email has been sent'
      };
    } catch (error) {
      logger.error(`Error resending verification email for ${email}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async verifyEmail(token) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    try {
      logger.info(`Verifying email with token: ${token}`);

      const tokenQuery = aql`
        FOR t IN verificationTokens
          FILTER t.token == ${token}
          RETURN t
      `;

      const tokenCursor = await this.db.query(tokenQuery);
      let tokenDoc = await tokenCursor.next();
      let isEmailChangeToken = false;

      if (!tokenDoc) {
        logger.info('Token not found in verificationTokens, checking pendingEmailChange');

        const pendingEmailQuery = aql`
          FOR u IN users
            FILTER u.pendingEmailChange.token == ${token}
            RETURN {
              userId: u._id,
              token: u.pendingEmailChange.token,
              email: u.pendingEmailChange.email,
              expiresAt: DATE_ADD(u.updatedAt, 24, 'hour'),
              used: false
            }
        `;

        const pendingCursor = await this.db.query(pendingEmailQuery);
        tokenDoc = await pendingCursor.next();

        if (tokenDoc) {
          logger.info('Found token in pendingEmailChange:', JSON.stringify(tokenDoc));
          isEmailChangeToken = true;
        } else {
          logger.warn('No token found in either location');
        }
      }

      if (!tokenDoc) {
        logger.warn(`No token document found for token: ${token}`);
        return { success: false, message: 'Invalid token' };
      }

      const expiresAt = new Date(tokenDoc.expiresAt);
      const now = new Date();

      if (now > expiresAt) {
        logger.warn(`Token has expired: ${token}`);
        return { success: false, expired: true, message: 'Token has expired' };
      }

      if (tokenDoc.used) {
        logger.warn(`Token has already been used: ${token}`);
        return { success: false, used: true, message: 'Token has already been used' };
      }

      if (isEmailChangeToken) {
        const userId = tokenDoc.userId.split('/')[1];

        await this.users.update(userId, {
          email: tokenDoc.email,
          emailVerified: true,
          pendingEmailChange: null,
          updatedAt: new Date().toISOString()
        });

        logger.info(`Email changed successfully for user ${userId} to ${tokenDoc.email}`);
        return { success: true, message: 'Email changed successfully' };
      } else {
        const userId = tokenDoc.userId.split('/')[1];

        await this.users.update(userId, {
          emailVerified: true,
          updatedAt: new Date().toISOString()
        });

        await this.verificationTokens.update(tokenDoc._key, {
          used: true
        });

        logger.info(`Email verified successfully for user ${userId}`);
        return { success: true, message: 'Email verified successfully' };
      }
    } catch (error) {
      logger.error(`Error in verifyEmail: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async initiatePasswordReset(email, frontendUrl, backendUrl) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    try {
      logger.info(`Initiating password reset for email: ${email}`);

      const envFrontendUrl = process.env.FRONTEND_URL;
      const finalFrontendUrl = envFrontendUrl || frontendUrl;

      if (envFrontendUrl) logger.info(`Using environment FRONTEND_URL: ${envFrontendUrl}`);
      else if (frontendUrl) logger.info(`Using provided frontend URL: ${frontendUrl}`);
      else logger.info('No frontend URL provided, using email service default');

      if (backendUrl) logger.info(`Using backend URL: ${backendUrl}`);

      const user = await this.getUserByEmail(email);
      if (!user) {
        logger.info(`User not found for email: ${email}, returning generic response`);
        return {
          success: true,
          message: 'If your email exists in our system, a password reset link has been sent to your email'
        };
      }

      const token = crypto.randomBytes(32).toString('hex');

      const now = new Date();
      const expiresAt = new Date(now.getTime() + (this.tokenExpiryMinutes * 60 * 1000));

      await this.passwordResetTokens.save({
        userId: `users/${user._key}`,
        token: token,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        used: false
      });
      logger.info(`Password reset token saved for user ${user._key}`);

      await emailService.sendPasswordResetEmail(
        email,
        token,
        user.personalIdentification?.fullName || user.loginName,
        finalFrontendUrl
      );

      if (process.env.NODE_ENV === 'development') {
        logger.info(`Password reset token for ${email}: ${token}`);
      }

      logger.info(`Password reset email sent successfully to: ${email}`);
      return {
        success: true,
        message: 'If your email exists in our system, a password reset link has been sent to your email',
        ...(process.env.NODE_ENV === 'development' && { token })
      };
    } catch (error) {
      logger.error(`Error initiating password reset for email ${email}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async validateResetToken(token) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    try {
      logger.info(`Validating password reset token: ${token}`);

      const query = aql`
        FOR t IN passwordResetTokens
          FILTER t.token == ${token}
          RETURN t
      `;

      const cursor = await this.db.query(query);
      const tokenDoc = await cursor.next();

      if (!tokenDoc) {
        logger.warn(`Invalid reset token: ${token}`);
        return { valid: false, message: 'Invalid token' };
      }

      const expiresAt = new Date(tokenDoc.expiresAt);
      const now = new Date();

      if (now > expiresAt) {
        logger.warn(`Reset token has expired: ${token}`);
        return { valid: false, expired: true, message: 'Token has expired' };
      }

      if (tokenDoc.used) {
        logger.warn(`Reset token has already been used: ${token}`);
        return { valid: false, used: true, message: 'Token has already been used' };
      }

      logger.info(`Reset token validated successfully: ${token}`);
      return {
        valid: true,
        message: 'Token is valid',
        userId: tokenDoc.userId
      };
    } catch (error) {
      logger.error(`Error validating reset token ${token}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async resetPassword(token, newPassword) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    try {
      logger.info(`Completing password reset with token: ${token}`);

      const validation = await this.validateResetToken(token);
      if (!validation.valid) {
        logger.warn(`Invalid or expired token during password reset: ${token}`);
        return validation;
      }

      const userId = validation.userId.split('/')[1];

      const hashedPassword = await this.hashPassword(newPassword);

      await this.users.update(userId, {
        encPassword: hashedPassword,
        updatedAt: new Date().toISOString()
      });

      const tokenQuery = aql`
        FOR t IN passwordResetTokens
          FILTER t.token == ${token}
          UPDATE t WITH { used: true } IN passwordResetTokens
          RETURN NEW
      `;

      await this.db.query(tokenQuery);
      logger.info(`Password reset successfully for user ${userId}`);

      return { success: true, message: 'Password has been reset successfully' };
    } catch (error) {
      logger.error(`Error resetting password with token ${token}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    try {
      logger.info(`Changing password for user ${userId}`);

      const user = await this.users.document(userId);
      if (!user) {
        logger.warn(`User not found for ID: ${userId}`);
        throw new Error('User not found');
      }

      const isPasswordValid = await this.verifyPassword(currentPassword, user.encPassword);
      if (!isPasswordValid) {
        logger.warn(`Current password incorrect for user ${userId}`);
        throw new Error('Current password is incorrect');
      }

      const hashedPassword = await this.hashPassword(newPassword);

      await this.users.update(userId, {
        encPassword: hashedPassword,
        updatedAt: new Date().toISOString()
      });

      logger.info(`Password changed successfully for user ${userId}`);
      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      logger.error(`Error changing password for user ${userId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async getUserById(userId) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    try {
      logger.info(`Fetching user by ID: ${userId}`);
      const dbStatus = await this.dbService.getConnectionStatus();
      logger.debug(`Database connection status: ${JSON.stringify(dbStatus)}`);
      const user = await this.users.document(userId);
      logger.info(`User retrieved successfully by ID: ${userId}`);
      return user;
    } catch (error) {
      logger.error(`Error getting user ${userId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async getUserByLoginNameOrEmail(loginName, email) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    try {
      logger.info(`Fetching user by loginName: ${loginName} or email: ${email}`);
      const query = aql`
        FOR u IN users
          FILTER u.loginName == ${loginName} OR u.email == ${email}
          RETURN u
      `;

      const cursor = await this.db.query(query);
      const user = await cursor.next();
      if (!user) {
        logger.info(`No user found for loginName: ${loginName} or email: ${email}`);
      } else {
        logger.info(`User retrieved successfully for loginName: ${loginName} or email: ${email}`);
      }
      return user;
    } catch (error) {
      logger.error(`Error getting user by login name or email: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async getUserByEmail(email) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    try {
      logger.info(`Fetching user by email: ${email}`);
      const query = aql`
        FOR u IN users
          FILTER u.email == ${email}
          RETURN u
      `;

      const cursor = await this.db.query(query);
      const user = await cursor.next();
      if (!user) {
        logger.info(`No user found for email: ${email}`);
      } else {
        logger.info(`User retrieved successfully for email: ${email}`);
      }
      return user;
    } catch (error) {
      logger.error(`Error getting user by email: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  async verifyToken(token) {
    if (!this.initialized) throw new Error('AuthService not initialized');
    try {
      logger.info('Verifying JWT token');
      const decoded = jwt.verify(token, this.jwtSecret);
      const user = await this.getUserById(decoded.userId);
      if (!user) {
        logger.warn(`User not found: ${decoded.userId}`);
        return null;
      }
      logger.info(`Token verified successfully for user: ${decoded.userId}`);
      return decoded;
    } catch (error) {
      logger.error(`Token verification error: ${error.message}`, { stack: error.stack });
      return null;
    }
  }

  generateToken(user) {
    logger.info(`Generating JWT token for user: ${user._key}`);
    const token = jwt.sign(
      {
        userId: user._key,
        loginName: user.loginName,
        email: user.email
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );
    logger.info(`JWT token generated successfully for user: ${user._key}`);
    return token;
  }

  async hashPassword(password) {
    logger.info('Hashing password with bcrypt');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    logger.info('Password hashed successfully');
    return hashedPassword;
  }

  async verifyPassword(clientPassword, storedPassword) {
    logger.info('Verifying password');
    if (storedPassword.startsWith('$2')) {
      const isValid = await bcrypt.compare(clientPassword, storedPassword);
      logger.info(`Password verification result: ${isValid}`);
      return isValid;
    } else if (/^[a-f0-9]{64}$/i.test(storedPassword)) {
      const isValid = clientPassword === storedPassword;
      logger.info(`Password verification result: ${isValid}`);
      return isValid;
    }

    logger.warn('Unknown password format, verification failed');
    return false;
  }

  async comparePasswords(password, hashedPassword) {
    logger.info('Comparing passwords (legacy method)');
    const isValid = await this.verifyPassword(password, hashedPassword);
    logger.info(`Legacy password comparison result: ${isValid}`);
    return isValid;
  }

  async cleanupExpiredTokens() {
    if (!this.initialized) throw new Error('AuthService not initialized');
    try {
      logger.info('Cleaning up expired tokens');
      const now = new Date().toISOString();

      const resetQuery = aql`
        FOR t IN passwordResetTokens
          FILTER t.expiresAt < ${now} AND t.used == false
          REMOVE t IN passwordResetTokens
          RETURN OLD
      `;

      const resetCursor = await this.db.query(resetQuery);
      const resetRemoved = await resetCursor.all();

      const verifyQuery = aql`
        FOR t IN verificationTokens
          FILTER t.expiresAt < ${now} AND t.used == false
          REMOVE t IN verificationTokens
          RETURN OLD
      `;

      const verifyCursor = await this.db.query(verifyQuery);
      const verifyRemoved = await verifyCursor.all();

      logger.info(`Expired tokens cleaned up successfully: ${resetRemoved.length} reset tokens, ${verifyRemoved.length} verification tokens`);

      return {
        success: true,
        removed: resetRemoved.length + verifyRemoved.length,
        message: `Removed ${resetRemoved.length} expired reset tokens and ${verifyRemoved.length} verification tokens`
      };
    } catch (error) {
      logger.error(`Error cleaning up expired tokens: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }
}

// Create singleton instance
const authServiceInstance = new AuthService();

module.exports = authServiceInstance;