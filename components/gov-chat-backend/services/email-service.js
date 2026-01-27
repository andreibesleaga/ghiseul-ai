require('dotenv').config();
const nodemailer = require('nodemailer');
const { URL } = require('url'); // Added
const { logger } = require('../shared-lib');

// Add debug flag - can be controlled via environment variable
const DEBUG = process.env.DEBUG_EMAIL !== 'false';

class EmailService {
  constructor() {
    // Validate required environment variables
    const requiredEnvVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingEnvVars.length > 0) {
      logger.warn('EmailService.missing_environment_variables', { missing: missingEnvVars });
    }

    // Log initialization details if DEBUG is enabled
    if (DEBUG) {
      logger.debug('EmailService.initializing', {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === 'true',
        fromEmail: process.env.EMAIL_FROM,
        appName: process.env.APP_NAME,
        defaultFrontendUrl: process.env.FRONTEND_URL
      });
      logger.debug('EMAIL_HOST:' + process.env.EMAIL_HOST);
      logger.debug('EMAIL_PORT:' + process.env.EMAIL_PORT);
      logger.debug('EMAIL_SECURE:' + process.env.EMAIL_SECURE);
      logger.debug('EMAIL_USER:' + process.env.EMAIL_USER);
      logger.debug('EMAIL_PASSWORD:' + (process.env.EMAIL_PASSWORD ? '[REDACTED]' : 'undefined')); // Modified
    }

    // Create a transporter with email provider settings
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'in-V3.mailjet.com',
      port: parseInt(process.env.EMAIL_PORT) || 587, // Modified
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Sender email address
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@hud.email';

    // App name for email templates
    this.appName = process.env.APP_NAME || 'Ghiseul AI Romania';

    // Default frontend URL for links, normalized
    this.defaultFrontendUrl = this.normalizeBaseUrl(process.env.FRONTEND_URL || 'http://localhost:8080'); // Modified

    // Test SMTP connection at startup
    this.verifyConnection();

    logger.info('EmailService.initialized');
  }

  /**
   * Normalize a base URL to remove trailing slashes and ensure proper format
   * @param {string} url - The URL to normalize
   * @returns {string} - Normalized URL
   */
  normalizeBaseUrl(url) { // Added
    try {
      const parsedUrl = new URL(url);
      parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, '');
      return parsedUrl.toString();
    } catch (error) {
      logger.error('EmailService.invalid_base_url', {
        url,
        error: error.message
      });
      return 'http://localhost:8080';
    }
  }

  /**
   * Build a clean URL by combining base URL and path
   * @param {string} baseUrl - Base URL
   * @param {string} path - Path to append
   * @returns {string} - Clean, normalized URL
   */
  buildUrl(baseUrl, path) { // Added
    try {
      const normalizedBase = this.normalizeBaseUrl(baseUrl);
      const url = new URL(normalizedBase);
      url.pathname = `/${path.replace(/^\/+/, '')}`;
      const finalUrl = url.toString();
      if (DEBUG) {
        logger.debug('EmailService.build_url', { baseUrl, path, finalUrl });
      }
      return finalUrl;
    } catch (error) {
      logger.error('EmailService.url_build_failed', {
        baseUrl,
        path,
        error: error.message
      });
      return `${this.defaultFrontendUrl}/${path.replace(/^\/+/, '')}`;
    }
  }

  /**
   * Verify SMTP connection is working
   */
  async verifyConnection() {
    const startTime = Date.now();
    try {
      if (DEBUG) {
        logger.debug('EmailService.verify_smtp_connection_start');
      }

      await this.transporter.verify();

      logger.info('EmailService.smtp_connection_verified', {
        durationMs: Date.now() - startTime
      });
    } catch (error) {
      logger.error('EmailService.smtp_connection_failed', {
        error: error.message,
        code: error.code,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });

      // Provide specific guidance for common errors
      if (error.code === 'EAUTH') {
        logger.error('EmailService.smtp_authentication_failed', {
          message: 'Check EMAIL_USER and EMAIL_PASSWORD in .env file.'
        });
      } else if (error.code === 'ESOCKET') {
        logger.error('EmailService.smtp_connection_error', {
          message: 'Check host, port, and firewall settings.'
        });
      } else if (error.code === 'ETIMEDOUT') {
        logger.error('EmailService.smtp_timeout_error', {
          message: 'SMTP server might be down or blocked.'
        });
      }

      if (DEBUG) {
        logger.debug('EmailService.smtp_connection_error_details', {
          error: error.message,
          code: error.code,
          response: error.response
        });
      }
    }
  }

  /**
   * Send a password reset email
   * @param {string} email - Recipient email
   * @param {string} token - Password reset token
   * @param {string} userName - User's name
   * @param {string} frontendUrl - Frontend URL for UI links
   * @returns {Promise} Send result
   */
  async sendPasswordResetEmail(email, token, userName, frontendUrl) {
    const startTime = Date.now();
    if (DEBUG) {
      logger.debug('EmailService.send_password_reset_email_start', {
        to: email,
        token: token ? `${token.substring(0, 10)}...` : 'undefined',
        userName,
        frontendUrl: frontendUrl || this.defaultFrontendUrl
      });
    }

    // Use provided frontend URL or fall back to default
    const resetLink = this.buildUrl(frontendUrl || this.defaultFrontendUrl, `reset-password/${token}`); // Modified

    // Email content
    const mailOptions = {
      from: `"${this.appName}" <${this.fromEmail}>`, // Modified
      to: email,
      subject: `Password Reset Request - ${this.appName}`,
      text: `
Hello ${userName || ''},

You recently requested to reset your password for your ${this.appName} account. 
Use the following token to complete the process:

${token}

Alternatively, you can directly visit:
${resetLink}

This token is only valid for the next 5 minutes.

If you did not request a password reset, please ignore this email or contact support if you have concerns.

Thank you,
The ${this.appName} Team
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${this.appName} Password Reset</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header img { max-width: 150px; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 5px; }
    .button { display: inline-block; padding: 10px 20px; background: #4E97D1; color: white !important; text-decoration: none; border-radius: 5px; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${this.appName}</h1>
    </div>
    <div class="content">
      <p>Hello ${userName || ''},</p>
      <p>You recently requested to reset your password for your ${this.appName} account. Use the following token to complete the process:</p>
      <p><strong>${token}</strong></p>
      <p>Alternatively, you can click the button below:</p>
      <p><a href="${resetLink}" class="button">Reset Password</a></p>
      <p>This token is only valid for the next 5 minutes.</p>
      <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
    </div>
    <div class="footer">
      <p>Thank you,<br>The ${this.appName} Team</p>
    </div>
  </div>
</body>
</html>
      `
    };

    if (DEBUG) {
      logger.debug('EmailService.password_reset_email_content', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        textPreview: mailOptions.text.substring(0, 100) + '...',
        resetLink // Added
      });
    }

    // Send email
    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('EmailService.password_reset_email_sent', {
        to: email,
        messageId: info.messageId,
        resetLink, // Added
        durationMs: Date.now() - startTime
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('EmailService.password_reset_email_failed', {
        to: email,
        error: error.message,
        code: error.code,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });

      if (error.code === 'EAUTH') {
        logger.error('EmailService.smtp_authentication_failed', {
          message: 'Check EMAIL_USER and EMAIL_PASSWORD in .env file.'
        });
      } else if (error.code === 'ESOCKET') {
        logger.error('EmailService.smtp_connection_error', {
          message: 'Check host, port, and firewall settings.'
        });
      } else if (error.code === 'ETIMEDOUT') {
        logger.error('EmailService.smtp_timeout_error', {
          message: 'SMTP server might be down or blocked.'
        });
      }

      if (DEBUG) {
        logger.debug('EmailService.password_reset_email_error_details', {
          error: error.message,
          code: error.code,
          response: error.response,
          responseCode: error.responseCode
        });
      }

      throw error;
    }
  }

  /**
   * Send an email verification email
   * @param {string} email - Recipient email
   * @param {string} token - Verification token
   * @param {string} userName - User's name
   * @param {string} frontendUrl - Frontend URL for UI links
   * @param {string} verificationUrl - The complete verification URL to use (back-end endpoint)
   * @returns {Promise} Send result
   */
  async sendVerificationEmail(email, token, userName, frontendUrl, verificationUrl) {
    const startTime = Date.now();
    if (!email) {
      logger.error('EmailService.verification_email_missing_recipient', {
        token: token ? `${token.substring(0, 10)}...` : 'undefined',
        userName: userName || 'undefined',
        frontendUrl: frontendUrl || 'undefined',
        verificationUrl: verificationUrl || 'undefined'
      });
      throw new Error('Email recipient is required');
    }

    if (DEBUG) {
      logger.debug('EmailService.send_verification_email_start', {
        to: email,
        token: token ? `${token.substring(0, 10)}...` : 'undefined',
        userName,
        frontendUrl: frontendUrl || this.defaultFrontendUrl,
        verificationUrl: verificationUrl || 'not provided'
      });
    }

    // Use provided frontend URL or fall back to default
    const verificationLink = verificationUrl || this.buildUrl(frontendUrl || this.defaultFrontendUrl, `api/auth/verify-email/${token}`); // Modified

    // Email content
    const mailOptions = {
      from: `"${this.appName}" <${this.fromEmail}>`, // Modified
      to: email,
      subject: `Verify Your Email - ${this.appName}`,
      text: `
Hello ${userName || ''},

Thank you for registering with ${this.appName}. 
Please verify your email address by using the following token:

${token}

Alternatively, you can directly visit:
${verificationLink}

This link will expire in 24 hours.

Thank you,
The ${this.appName} Team
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${this.appName} Email Verification</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header img { max-width: 150px; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 5px; }
    .button { display: inline-block; padding: 10px 20px; background: #4E97D1; color: white !important; text-decoration: none; border-radius: 5px; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${this.appName}</h1>
    </div>
    <div class="content">
      <p>Hello ${userName || ''},</p>
      <p>Thank you for registering with ${this.appName}. Please verify your email address by using the following token:</p>
      <p><strong>${token}</strong></p>
      <p>Alternatively, you can click the button below:</p>
      <p><a href="${verificationLink}" class="button">Verify Email</a></p>
      <p>This link will expire in 24 hours.</p>
    </div>
    <div class="footer">
      <p>Thank you,<br>The ${this.appName} Team</p>
    </div>
  </div>
</body>
</html>
      `
    };

    if (DEBUG) {
      logger.debug('EmailService.verification_email_content', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        textPreview: mailOptions.text.substring(0, 100) + '...',
        verificationLink // Added
      });
    }

    // Send email
    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('EmailService.verification_email_sent', {
        to: email,
        messageId: info.messageId,
        verificationLink, // Added
        durationMs: Date.now() - startTime
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('EmailService.verification_email_failed', {
        to: email,
        error: error.message,
        code: error.code,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });

      if (error.code === 'EAUTH') {
        logger.error('EmailService.smtp_authentication_failed', {
          message: 'Check EMAIL_USER and EMAIL_PASSWORD in .env file.'
        });
      } else if (error.code === 'ESOCKET') {
        logger.error('EmailService.smtp_connection_error', {
          message: 'Check host, port, and firewall settings.'
        });
      } else if (error.code === 'ETIMEDOUT') {
        logger.error('EmailService.smtp_timeout_error', {
          message: 'SMTP server might be down or blocked.'
        });
      }

      if (DEBUG) {
        logger.debug('EmailService.verification_email_error_details', {
          error: error.message,
          code: error,
          response: error.response,
          responseCode: error.responseCode
        });
      }

      throw error;
    }
  }
}

// Export a singleton instance
module.exports = new EmailService();