// src/services/userService.js
import httpService from './httpService';
import crypto from 'crypto';

/**
 * Service for user account management and authentication operations
 * Integrates account management with authentication features
 */
class UserService {
  /**
   * Initialize the UserService
   */
  constructor() {
    this.tokenKey = 'user';
    this.authEndpoint = 'auth';
    this.userEndpoint = 'users';
  }

  // ===== AUTHENTICATION METHODS =====

  /**
   * Authenticate user with username and password
   * @param {string} loginName The username or email
   * @param {string} password The password
   * @returns {Promise} Promise with user data or error
   */
  async login(loginName, password) {
    try {
      // Hash the password client-side before sending
      const encPassword = this.hashPassword(password);

      const response = await httpService.post(`${this.authEndpoint}/login`, {
        loginName,
        encPassword
      });

      if (response.data && response.data.accessToken) {
        this.setUserData(response.data);
      }

      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Register a new user
   * @param {Object} userData User registration data
   * @param {string} userData.loginName Username
   * @param {string} userData.email Email address
   * @param {string} userData.password Password (will be hashed)
   * @param {string} [userData.fullName] Full name (optional)
   * @returns {Promise} Promise with registration result or error
   */
  async register(userData) {
    try {
      // Create payload with hashed password
      const payload = {
        loginName: userData.loginName,
        email: userData.email,
        encPassword: this.hashPassword(userData.password)
      };

      // Add optional fields if provided
      if (userData.fullName) {
        payload.fullName = userData.fullName;
      }

      const response = await httpService.post(`${this.authEndpoint}/register`, payload);

      // If registration includes auto login, store token
      if (response.data && response.data.accessToken) {
        this.setUserData(response.data);
      }

      return response.data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Log out the user
   * @returns {Promise} Promise with logout result
   */

  async logout() {
    try {
      const userData = this.getCurrentUser();
      const accessToken = userData?.accessToken;

      if (!accessToken) {
        console.warn('No access token found for logout');
        this.clearUserData();
        return { success: true, message: 'Logged out successfully (no token)' };
      }

      console.log('Sending logout request with Authorization header');

      // Set Authorization header explicitly
      const response = await httpService.post(
        `${this.authEndpoint}/logout`,
        {}, // Empty body
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      // Remove user data from local storage regardless of server response
      this.clearUserData();

      return response.data;
    } catch (error) {
      console.error('Logout error:', error);

      // Even if the server request fails, clear local user data
      this.clearUserData();

      // Re-throw the error so the UI can handle it
      throw error;
    }
  }

  /**
   * Get the currently authenticated user from the server
   * @returns {Promise} Promise with current user data
   */
  async fetchCurrentUser() {
    try {
      const response = await httpService.get(`${this.authEndpoint}/me`);
      return response.data.user;
    } catch (error) {
      console.error('Fetch current user error:', error);
      throw error;
    }
  }

  /**
   * Get the currently authenticated user from local storage
   * @returns {Object|null} The user data or null if not authenticated
   */
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem(this.tokenKey);
      if (!userStr) return null;

      return JSON.parse(userStr);
    } catch (e) {
      console.error('Error parsing user data:', e);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} True if authenticated, false otherwise
   */
  isAuthenticated() {
    const user = this.getCurrentUser();
    return !!user && !!user.accessToken;
  }

  /**
   * Set user data in local storage
   * @param {Object} userData User data with accessToken
   * @private
   */
  setUserData(userData) {
    localStorage.setItem(this.tokenKey, JSON.stringify(userData));
  }

  /**
   * Clear user data from local storage
   * @private
   */
  clearUserData() {
    localStorage.removeItem(this.tokenKey);
  }

  // Add this to userService.js - make sure it's inside the class definition
  /**
   * Reset user profile data while preserving essential account information
   * @returns {Promise} Promise with reset operation result
   */
  async resetUserData() {
    try {
      console.log('Calling reset user data endpoint');
      const response = await httpService.post(`${this.userEndpoint}/reset-data`);

      // If successful, refresh the user data in local storage
      if (response.data && response.data.success) {
        await this.refreshUserData();
      }

      return response.data;
    } catch (error) {
      console.error('Error resetting user data:', error);
      throw error;
    }
  }

  /**
   * Hash a password using SHA-256
   * Note: This is done for demonstration. In production, HTTPS should be used
   * rather than client-side hashing, or a more secure method should be employed.
   * @param {string} password The password to hash
   * @returns {string} The hashed password
   */
  hashPassword(password) {
    return crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');
  }

  /**
   * Initiate password reset process
   * @param {string} email User's email address
   * @returns {Promise} Promise with reset request result
   */
  async initiatePasswordReset(email) {
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
  async validateResetToken(token) {
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
    try {
      // Hash the new password before sending
      const encPassword = this.hashPassword(newPassword);

      const response = await httpService.post(`${this.authEndpoint}/reset-password/confirm`, {
        token,
        newPassword: encPassword
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
    try {
      // Hash both passwords before sending
      const encCurrentPassword = this.hashPassword(currentPassword);
      const encNewPassword = this.hashPassword(newPassword);

      const response = await httpService.post(`${this.authEndpoint}/change-password`, {
        currentPassword: encCurrentPassword,
        newPassword: encNewPassword
      });

      return response.data;
    } catch (error) {
      console.error('Password change error:', error);
      throw error;
    }
  }

  // ===== EXISTING USER METHODS =====

  /**
   * Get current user account information
   * @returns {Promise} Current user data
   */
  async getCurrentUserInfo() {
    try {
      // First try to get from localStorage for faster loading
      const cachedUser = this.getCurrentUser();
      if (cachedUser) {
        // If we have cached data, make a background refresh but don't wait for it
        this.refreshUserData();
        return cachedUser;
      }

      // If no cached data, fetch from the server
      const response = await httpService.get(`${this.authEndpoint}/me`);
      return response.data.user || response.data; // Handle possible response formats
    } catch (error) {
      console.error('Error fetching current user info:', error);
      throw error;
    }
  }

  /**
 * Refresh the data for the logged in user
 * @returns {Promise} Promise with refreshed user data
 */
  async refreshUserData() {
    try {
      const response = await httpService.get(`${this.authEndpoint}/me`);
      const userData = response.data.user || response.data;

      // Update local storage with fresh data
      if (userData) {
        const currentData = this.getCurrentUser();
        this.setUserData({
          ...currentData,
          ...userData
        });
      }

      return userData;
    } catch (error) {
      console.error('Error refreshing user data:', error);
      // Don't throw, this is a background refresh
      return null;
    }
  }

  /**
   * Update user account settings
   * @param {Object} settings - Account settings to update
   * @returns {Promise} Updated account settings
   */
  async updateAccountSettings(settings) {
    try {
      const response = await httpService.put('users/settings', settings);
      return response.data;
    } catch (error) {
      console.error('Error updating account settings:', error);
      throw error;
    }
  }

  /**
   * Verify user's email address
   * @param {string} token - Email verification token
   * @returns {Promise} Verification result
   */
  async verifyEmail(token) {
    try {
      const response = await httpService.post('users/verify-email', { token });
      return response.data;
    } catch (error) {
      console.error('Error verifying email:', error);
      throw error;
    }
  }

  /**
   * Resend email verification link
   * @param {string} email - User's email address
   * @returns {Promise} Operation result
   */
  async resendVerificationEmail(email) {
    try {
      const response = await httpService.post('users/resend-verification', { email });
      return response.data;
    } catch (error) {
      console.error('Error resending verification email:', error);
      throw error;
    }
  }

  /**
   * Update user's email address
   * @param {string} newEmail - New email address
   * @param {string} password - Current password for verification
   * @param {string} userId - User ID for authentication
   * @returns {Promise} Operation result
   */
  async updateEmail(newEmail, password, userId) {
    try {
      console.log(`Updating email to: ${newEmail} for user: ${userId}`);
      const response = await httpService.put('users/email', {
        email: newEmail,
        password: this.hashPassword(password),
        userId: userId  // Include userId in the request payload
      });
      return response.data;
    } catch (error) {
      console.error('Error updating email:', error);
      throw error;
    }
  }

  /**
   * Get user account activity log
   * @param {Number} page - Page number (starting from 1)
   * @param {Number} limit - Results per page
   * @returns {Promise} User activity log with pagination
   */
  async getActivityLog(page = 1, limit = 20) {
    try {
      const response = await httpService.get('users/activity', {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching activity log:', error);
      throw error;
    }
  }

  /**
   * Get user's account status
   * @returns {Promise} Account status information
   */
  async getAccountStatus() {
    try {
      const response = await httpService.get('users/status');
      return response.data;
    } catch (error) {
      console.error('Error fetching account status:', error);
      throw error;
    }
  }

  /**
   * Deactivate user account
   * @param {string} reason - Reason for deactivation
   * @param {string} password - Password confirmation
   * @returns {Promise} Deactivation result
   */
  async deactivateAccount(reason, password) {
    try {
      const response = await httpService.post('users/deactivate', {
        reason,
        password: this.hashPassword(password)
      });
      return response.data;
    } catch (error) {
      console.error('Error deactivating account:', error);
      throw error;
    }
  }

  /**
   * Reactivate a previously deactivated account
   * @returns {Promise} Reactivation result
   */
  async reactivateAccount() {
    try {
      const response = await httpService.post('users/reactivate');
      return response.data;
    } catch (error) {
      console.error('Error reactivating account:', error);
      throw error;
    }
  }

  /**
   * Upload a user avatar
   * @param {File} avatarFile - Avatar image file
   * @returns {Promise} Upload result with avatar URL
   */
  async uploadAvatar(avatarFile) {
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);

      const response = await httpService.post('users/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  }

  /**
   * Delete user's avatar
   * @returns {Promise} Operation result
   */
  async deleteAvatar() {
    try {
      const response = await httpService.delete('users/avatar');
      return response.data;
    } catch (error) {
      console.error('Error deleting avatar:', error);
      throw error;
    }
  }

  /**
   * Check if username is available
   * @param {string} username - Username to check
   * @returns {Promise<boolean>} True if username is available
   */
  async checkUsernameAvailability(username) {
    try {
      const response = await httpService.get('users/check-username', {
        params: { username }
      });
      return response.data.available;
    } catch (error) {
      console.error('Error checking username availability:', error);
      return false;
    }
  }

  /**
   * Check if email is available
   * @param {string} email - Email to check
   * @returns {Promise<boolean>} True if email is available
   */
  async checkEmailAvailability(email) {
    try {
      const response = await httpService.get('users/check-email', {
        params: { email }
      });
      return response.data.available;
    } catch (error) {
      console.error('Error checking email availability:', error);
      return false;
    }
  }

  /**
   * Validate password strength
   * @param {string} password Password to validate
   * @returns {Object} Validation result with strength score and feedback
   */
  validatePasswordStrength(password) {
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
 * Check if email is available
 * @param {string} email - Email to check
 * @returns {Promise<boolean>} True if email is available
 */
  async checkEmailAvailability(email) {
    try {
      // Direct approach - manually construct the URL with the email parameter
      const encodedEmail = encodeURIComponent(email);
      const url = `${this.userEndpoint}/check-email?email=${encodedEmail}`;
      console.log(`Checking email availability at: ${url}`);

      const response = await httpService.get(url);
      return response.data.available;
    } catch (error) {
      console.error('Error checking email availability:', error);
      return false;
    }
  }

  /**
   * Check if passwords match
   * @param {string} password First password
   * @param {string} confirmPassword Second password for confirmation
   * @returns {boolean} True if passwords match
   */
  doPasswordsMatch(password, confirmPassword) {
    return password === confirmPassword;
  }

  /**
   * Deactivate user account
   * @param {string} reason - Reason for deactivation
   * @param {string} password - Password confirmation
   * @returns {Promise} Deactivation result
   */
  async deactivateAccount(reason, password) {
    try {
      const response = await httpService.post('users/deactivate', {
        reason,
        password: this.hashPassword(password)
      });
      return response.data;
    } catch (error) {
      console.error('Error deactivating account:', error);
      throw error;
    }
  }

  /**
   * Permanently delete user account
   * @param {string} password - Password confirmation for security
   * @param {string} reason - Optional reason for deletion
   * @returns {Promise} Deletion result
   */
  async deleteAccount(password, reason = '') {
    try {
      const response = await httpService.post('users/delete', {
        password: this.hashPassword(password),
        reason
      });

      // If successful, clear user data from local storage
      if (response.data && response.data.success) {
        this.clearUserData();
      }

      return response.data;
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  /**
   * Update user role (admin only)
   * @param {String} userId - User ID
   * @param {Object} updateData - Data to update (role, disabled status)
   * @returns {Promise} Update result
   */
  async updateUserRole(userId, updateData) {
    try {
      console.log(`Updating role for user ${userId} to ${updateData.role}`);

      // Use the direct user endpoint - this matches the backend route
      // The route is PUT /api/users/:userId
      const response = await httpService.put(`${this.userEndpoint}/${userId}`, updateData);

      // Log the response
      console.log(`Role update response for ${userId}:`, response);

      return response;
    } catch (error) {
      console.error(`Error updating user role for ${userId}:`, error);

      // Additional logging for diagnosis
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', error.response.data);
      }

      throw error;
    }
  }

  /**
   * Verify user email (admin only)
   * @param {String} userId - User ID
   * @returns {Promise} Operation result
   */
  async verifyUserEmail(userId) {
    try {
      const response = await httpService.post(`admin/users/${userId}/verify-email`);
      return response;
    } catch (error) {
      console.error('Error verifying user email:', error);
      throw error;
    }
  }

  /**
   * Get a list of all users (admin only)
   * @param {Object} options - Query options (limit, offset, sort)
   * @returns {Promise} List of users
   */
  async getAllUsers(options = {}) {
    try {
      const response = await httpService.get('admin/users', { params: options });
      return response;
    } catch (error) {
      console.error('Error fetching users list:', error);
      throw error;
    }
  }

  /**
   * Get user profile by ID (for admin use)
   * Using this method allows admins to view any user's profile
   * @param {String} userId - User ID
   * @returns {Promise} User profile data
   */
  async getUserProfile(userId) {
    try {
      // For admin purposes, let's use the standard getProfile method
      // but add an admin flag to the request
      return await httpService.get(`users/${userId}`, {
        params: { admin: true }
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  /**
   * Update user role and status (admin only)
   * @param {String} userId - User ID
   * @param {Object} updateData - Data to update (role, disabled status)
   * @returns {Promise} Update result
   */
  async updateUserRole(userId, updateData) {
    try {
      const response = await httpService.put(`admin/users/${userId}/role`, updateData);
      return response;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

  /**
   * Verify user email (admin only)
   * @param {String} userId - User ID
   * @returns {Promise} Operation result
   */
  async verifyUserEmail(userId) {
    try {
      const response = await httpService.post(`admin/users/${userId}/verify-email`);
      return response;
    } catch (error) {
      console.error('Error verifying user email:', error);
      throw error;
    }
  }

  /**
   * Force user logout by invalidating their token (admin only)
   * @param {String} userId - User ID
   * @returns {Promise} Operation result
   */
  async forceUserLogout(userId) {
    try {
      console.log(`[USER SERVICE DEBUG] Attempting force logout for user ${userId} at endpoint: /api/users/admin/users/${userId}/force-logout`);
      const response = await httpService.post(`users/admin/users/${userId}/force-logout`);
      console.log(`[USER SERVICE DEBUG] Force logout successful for user ${userId}:`, response.data);
      return response.data; // Ensure data is returned
    } catch (error) {
      console.error(`[USER SERVICE DEBUG] Error forcing logout for user ${userId}:`, error.message, error.response?.data);
      throw error;
    }
  }

  /**
   * Resend email verification for a user (admin only)
   * @param {String} userId - User ID
   * @returns {Promise} Operation result
   */
  async resendVerificationEmailAdmin(userId) {
    try {
      console.log(`Attempting to resend verification email for user: ${userId}`);
      const response = await httpService.post(`users/admin/users/${userId}/resend-verification`);
      return response.data;
    } catch (error) {
      console.error('Verification email resend error:', error.response || error);
      throw error;
    }
  }

  /**
  * Force user logout by invalidating their token (admin only)
  * @param {String} userId - User ID
  * @returns {Promise} Operation result
  */
  async forceUserLogout(userId) {
    try {
      console.log(`[USER SERVICE DEBUG] Attempting force logout for user ${userId} at endpoint: /api/users/admin/users/${userId}/force-logout`);
      const response = await httpService.post(`users/admin/users/${userId}/force-logout`);
      console.log(`[USER SERVICE DEBUG] Force logout successful for user ${userId}:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`[USER SERVICE DEBUG] Error forcing logout for user ${userId}:`, error.message, error.response?.data);
      throw error;
    }
  }
}

export default new UserService();