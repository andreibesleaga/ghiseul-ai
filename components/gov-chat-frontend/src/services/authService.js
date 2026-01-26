// src/services/authService.js
import httpService from './httpService';
import crypto from 'crypto';

/**
 * Service to handle authentication with the backend
 */
class AuthService {
  /**
   * Initialize the AuthService
   */
  constructor() {
    this.tokenKey = 'user';
    this.authEndpoint = 'auth';
    // Add a map to track in-flight requests
    this.pendingRequests = new Map();
    this.refreshInterval = 15 * 60 * 1000; // Refresh every 15 minutes
    this.maxRetries = 3; // Max retries for failed requests
    this.retryDelay = 1000; // Delay between retries in ms
    this.setupTokenRefresh(); // Start proactive refresh
  }

  /**
   * Set up interval for proactive token refresh
   * @private
   */
  setupTokenRefresh() {
    setInterval(async () => {
      if (this.isAuthenticated()) {
        try {
          console.log('Attempting proactive token refresh');
          await this.refreshToken();
          console.log('Token refreshed proactively');
        } catch (error) {
          console.error('Proactive token refresh failed:', error);
          if (error.response?.status === 401 || error.response?.status === 403) {
            this.clearUserData();
            console.log('Cleared user data due to refresh failure');
          }
        }
      }
    }, this.refreshInterval);
  }

  /**
   * Retry a request with exponential backoff
   * @private
   * @param {Function} fn - Function to retry
   * @param {number} attempt - Current attempt number
   * @returns {Promise} Result of the function
   */
  async retryRequest(fn, attempt = 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= this.maxRetries || ![401, 403].includes(error.response?.status)) {
        throw error;
      }
      console.log(`Retry attempt ${attempt} for failed request: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      return this.retryRequest(fn, attempt + 1);
    }
  }

  /**
   * Authenticate user with username and password
   * @param {string} loginName The username or email
   * @param {string} password The password
   * @returns {Promise} Promise with user data or error
   */
  async login(loginName, password) {
    try {
      const encPassword = this.hashPassword(password);
      const response = await this.retryRequest(() =>
        httpService.post(`${this.authEndpoint}/login`, {
          loginName,
          encPassword
        })
      );
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
   * Refresh the access token using the refresh token
   * @returns {Promise} Promise with new token data or error
   */
  async refreshToken() {
    // Prevent multiple simultaneous refresh attempts
    if (this.pendingRequests.has('refresh')) {
      console.log('Returning existing refresh request');
      return this.pendingRequests.get('refresh');
    }

    const requestPromise = (async () => {
      try {
        const userData = this.getCurrentUser();
        if (!userData?.refreshToken) {
          throw new Error('No refresh token available');
        }
        const response = await httpService.post(`${this.authEndpoint}/refresh-token`, {
          refreshToken: userData.refreshToken
        });
        if (response.data && response.data.accessToken) {
          this.setUserData({
            ...userData,
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken || userData.refreshToken
          });
        }
        return response.data;
      } catch (error) {
        console.error('Refresh token error:', error);
        if (error.response?.status === 401 || error.response?.status === 403) {
          this.clearUserData();
        }
        throw error;
      } finally {
        this.pendingRequests.delete('refresh');
      }
    })();

    this.pendingRequests.set('refresh', requestPromise);
    return requestPromise;
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
      const encPassword = this.hashPassword(userData.password);
      const payload = {
        loginName: userData.loginName,
        email: userData.email,
        encPassword
      };
      if (userData.fullName) {
        payload.fullName = userData.fullName;
      }
      const response = await this.retryRequest(() =>
        httpService.post(`${this.authEndpoint}/register`, payload)
      );
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
      const response = await this.retryRequest(() =>
        httpService.post(`${this.authEndpoint}/logout`)
      );
      this.clearUserData();
      return response.data;
    } catch (error) {
      console.error('Logout error:', error);
      this.clearUserData();
      throw error;
    }
  }

  /**
   * Get the currently authenticated user from the server
   * @returns {Promise} Promise with current user data
   */
  async fetchCurrentUser() {
    try {
      const response = await this.retryRequest(() =>
        httpService.get(`${this.authEndpoint}/me`)
      );
      return response.data.user;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          const retryResponse = await httpService.get(`${this.authEndpoint}/me`);
          return retryResponse.data.user;
        } catch (refreshError) {
          console.error('Refresh failed, logging out:', refreshError);
          this.clearUserData();
          throw refreshError;
        }
      }
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
      const response = await this.retryRequest(() =>
        httpService.post(`${this.authEndpoint}/reset-password`, { email })
      );
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
      const response = await this.retryRequest(() =>
        httpService.post(`${this.authEndpoint}/validate-token`, { token })
      );
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
      const encPassword = this.hashPassword(newPassword);
      const response = await this.retryRequest(() =>
        httpService.post(`${this.authEndpoint}/reset-password/confirm`, {
          token,
          newPassword: encPassword
        })
      );
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
      const encCurrentPassword = this.hashPassword(currentPassword);
      const encNewPassword = this.hashPassword(newPassword);
      const response = await this.retryRequest(() =>
        httpService.post(`${this.authEndpoint}/change-password`, {
          currentPassword: encCurrentPassword,
          newPassword: encNewPassword
        })
      );
      return response.data;
    } catch (error) {
      console.error('Password change error:', error);
      throw error;
    }
  }

  /**
   * Verify email with token
   * @param {string} token Verification token from email
   * @returns {Promise} Promise with verification result
   */
  async verifyEmail(token) {
    if (this.pendingRequests.has(`verify_${token}`)) {
      console.log('Returning existing verification request');
      return this.pendingRequests.get(`verify_${token}`);
    }
    
    try {
      const requestPromise = this.retryRequest(() =>
        httpService.get(`${this.authEndpoint}/verify-email/${token}`)
      );
      this.pendingRequests.set(`verify_${token}`, requestPromise);
      const response = await requestPromise;
      this.pendingRequests.delete(`verify_${token}`);
      return response.data;
    } catch (error) {
      this.pendingRequests.delete(`verify_${token}`);
      console.error('Email verification error:', error);
      throw error;
    }
  }

  /**
   * Resend verification email
   * @param {string} email User's email address
   * @returns {Promise} Promise with resend result
   */
  async resendVerificationEmail(email) {
    try {
      const response = await this.retryRequest(() =>
        httpService.post(`${this.authEndpoint}/resend-verification`, { email })
      );
      return response.data;
    } catch (error) {
      console.error('Resend verification error:', error);
      throw error;
    }
  }
}

export default new AuthService();