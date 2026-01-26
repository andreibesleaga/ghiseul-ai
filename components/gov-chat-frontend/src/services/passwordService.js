// src/services/passwordService.js

import httpService from './httpService';
import userService from './userService';
import crypto from 'crypto';

/**
 * Service to handle password-related operations
 * This implementation can switch between standalone mode and delegated mode
 */
class PasswordService {
  /**
   * Initialize the PasswordService
   */
  constructor() {
    this.authEndpoint = 'auth';
    
    // CONFIGURATION: Set to true to use userService, false to use standalone implementation
    this.useUserService = true;
    
    // For debugging/development
    console.log(`PasswordService initialized in ${this.useUserService ? 'delegated' : 'standalone'} mode`);
  }

  /**
   * Set the operation mode
   * @param {boolean} useUserService - True to delegate to userService, false for standalone
   */
  setMode(useUserService) {
    this.useUserService = !!useUserService;
    console.log(`PasswordService switched to ${this.useUserService ? 'delegated' : 'standalone'} mode`);
    return this;
  }

  /**
   * Initiate password reset by sending email with reset token
   * @param {string} email User's email address
   * @returns {Promise} Promise with reset request result
   */
  async initiateReset(email) {
    if (this.useUserService) {
      return userService.initiatePasswordReset(email);
    }
    
    try {
      const response = await httpService.post(`${this.authEndpoint}/reset-password`, { email });
      return response.data;
    } catch (error) {
      console.error('Password reset initiation error:', error);
      throw error;
    }
  }

  /**
   * Validate a password reset token
   * @param {string} token Reset token from email
   * @returns {Promise} Promise with token validation result
   */
  async validateToken(token) {
    if (this.useUserService) {
      return userService.validateResetToken(token);
    }
    
    try {
      const response = await httpService.post(`${this.authEndpoint}/validate-token`, { token });
      return response.data;
    } catch (error) {
      console.error('Token validation error:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   * @param {string} token Reset token from email
   * @param {string} newPassword New password (will be hashed)
   * @returns {Promise} Promise with password reset result
   */
  async resetPassword(token, newPassword) {
    if (this.useUserService) {
      return userService.resetPassword(token, newPassword);
    }
    
    try {
      // Hash the new password before sending
      const hashedPassword = this.hashPassword(newPassword);
      
      const response = await httpService.post(`${this.authEndpoint}/reset-password/confirm`, {
        token,
        newPassword: hashedPassword
      });
      
      return response.data;
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Change password for authenticated user
   * @param {string} currentPassword Current password (will be hashed)
   * @param {string} newPassword New password (will be hashed)
   * @returns {Promise} Promise with password change result
   */
  async changePassword(currentPassword, newPassword) {
    if (this.useUserService) {
      return userService.changePassword(currentPassword, newPassword);
    }
    
    try {
      // Hash both passwords before sending
      const hashedCurrentPassword = this.hashPassword(currentPassword);
      const hashedNewPassword = this.hashPassword(newPassword);
      
      const response = await httpService.post(`${this.authEndpoint}/change-password`, {
        currentPassword: hashedCurrentPassword,
        newPassword: hashedNewPassword
      });
      
      return response.data;
    } catch (error) {
      console.error('Password change error:', error);
      throw error;
    }
  }

  /**
   * Validate password strength
   * @param {string} password Password to validate
   * @returns {Object} Validation result with strength score and feedback
   */
  validatePasswordStrength(password) {
    if (this.useUserService) {
      return userService.validatePasswordStrength(password);
    }
    
    // Initialize result object
    const result = {
      isValid: false,
      score: 0, // 0-4 scale (0: very weak, 4: very strong)
      feedback: {
        warnings: [],
        suggestions: []
      }
    };
    
    // Check length
    if (!password || password.length < 8) {
      result.feedback.warnings.push('Password is too short');
      result.feedback.suggestions.push('Use at least 8 characters');
      return result;
    }
    
    // Initialize score
    let score = 0;
    
    // Check for various character types
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    
    // Calculate base score
    if (hasLowercase) score++;
    if (hasUppercase) score++;
    if (hasDigit) score++;
    if (hasSpecial) score++;
    
    // Add extra score for length
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    
    // Cap score at 4
    score = Math.min(score, 4);
    result.score = score;
    
    // Set validity based on score
    result.isValid = score >= 3;
    
    // Add feedback based on missing criteria
    if (!hasLowercase) {
      result.feedback.suggestions.push('Add lowercase letters');
    }
    if (!hasUppercase) {
      result.feedback.suggestions.push('Add uppercase letters');
    }
    if (!hasDigit) {
      result.feedback.suggestions.push('Add numbers');
    }
    if (!hasSpecial) {
      result.feedback.suggestions.push('Add special characters');
    }
    if (password.length < 12) {
      result.feedback.suggestions.push('Make your password longer');
    }
    
    // Check for common patterns
    if (/^[a-zA-Z]+$/.test(password)) {
      result.feedback.warnings.push('Password contains only letters');
    }
    if (/^\d+$/.test(password)) {
      result.feedback.warnings.push('Password contains only numbers');
    }
    if (/(.)\1{2,}/.test(password)) {
      result.feedback.warnings.push('Password contains repeated characters');
    }
    
    return result;
  }

  /**
   * Check if passwords match
   * @param {string} password First password
   * @param {string} confirmPassword Second password for confirmation
   * @returns {boolean} True if passwords match
   */
  doPasswordsMatch(password, confirmPassword) {
    if (this.useUserService) {
      return userService.doPasswordsMatch(password, confirmPassword);
    }
    
    return password === confirmPassword;
  }

  /**
   * Hash a password using SHA-256
   * @param {string} password The password to hash
   * @returns {string} The hashed password
   * @private
   */
  hashPassword(password) {
    if (this.useUserService) {
      return userService.hashPassword(password);
    }
    
    return crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');
  }
}

export default new PasswordService();