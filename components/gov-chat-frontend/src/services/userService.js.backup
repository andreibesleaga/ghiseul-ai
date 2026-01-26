// src/services/userService.js
import httpService from './httpService';

/**
 * Service for user account management operations
 * Focused on account-level operations separate from detailed profile management
 */
class UserService {
  /**
   * Get current user account information
   * @returns {Promise} Current user data
   */
  async getCurrentUserInfo() {
    try {
      const response = await httpService.get('users/me');
      return response.data;
    } catch (error) {
      console.error('Error fetching current user info:', error);
      throw error;
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
   * @returns {Promise} Operation result
   */
  async updateEmail(newEmail, password) {
    try {
      const response = await httpService.put('users/email', { email: newEmail, password });
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
      const response = await httpService.post('users/deactivate', { reason, password });
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
}

export default new UserService();