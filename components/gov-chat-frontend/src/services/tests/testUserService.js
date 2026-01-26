// src/services/tests/testUserService.js
// Test script for userService.js

// Mock localStorage for Node environment
global.localStorage = {
    data: {},
    getItem(key) {
      return this.data[key];
    },
    setItem(key, value) {
      this.data[key] = value;
    },
    removeItem(key) {
      delete this.data[key];
    }
  };
  
  // Mock crypto for Node environment
  const crypto = require('crypto');
  
  // Mock FormData for Node environment
  global.FormData = class FormData {
    constructor() {
      this.data = {};
    }
    
    append(key, value) {
      this.data[key] = value;
    }
  };
  
  // Mock httpService
  const httpService = {
    async get(endpoint, config) {
      console.log(`GET request to ${endpoint}`, config || '');
      
      if (endpoint === 'auth/me') {
        return { 
          data: { 
            user: { 
              _key: '123', 
              loginName: 'testuser', 
              email: 'test@example.com',
              personalIdentification: {
                fullName: 'Test User',
                dob: '1990-01-01'
              }
            } 
          } 
        };
      } else if (endpoint === 'users/me') {
        return { 
          data: { 
            _key: '123', 
            loginName: 'testuser', 
            email: 'test@example.com' 
          } 
        };
      } else if (endpoint === 'users/status') {
        return { 
          data: { 
            status: 'active',
            emailVerified: true,
            accountCreated: '2023-01-01T00:00:00Z'
          } 
        };
      } else if (endpoint === 'users/activity') {
        return { 
          data: { 
            activities: [
              {
                type: 'login',
                timestamp: '2023-01-15T10:30:00Z',
                ip: '192.168.1.1'
              },
              {
                type: 'password_change',
                timestamp: '2023-01-10T14:20:00Z',
                ip: '192.168.1.1'
              }
            ],
            total: 2
          } 
        };
      } else if (endpoint === 'users/check-username') {
        return { 
          data: { 
            available: config.params.username !== 'testuser' 
          } 
        };
      } else if (endpoint === 'users/check-email') {
        return { 
          data: { 
            available: config.params.email !== 'test@example.com' 
          } 
        };
      }
      
      return { data: {} };
    },
    
    async post(endpoint, data, config) {
      console.log(`POST request to ${endpoint}`, data);
      
      if (endpoint === 'auth/login') {
        return { 
          data: { 
            _key: '123', 
            loginName: data.loginName, 
            accessToken: 'mock-token-123' 
          } 
        };
      } else if (endpoint === 'auth/register') {
        return { 
          data: { 
            _key: '456', 
            loginName: data.loginName, 
            email: data.email,
            accessToken: 'mock-token-456' 
          } 
        };
      } else if (endpoint === 'auth/logout') {
        return { 
          data: { 
            success: true, 
            message: 'Logged out successfully' 
          } 
        };
      } else if (endpoint === 'auth/reset-password') {
        return { 
          data: { 
            success: true, 
            message: 'Password reset email sent',
            token: 'mock-reset-token' // Only in dev environment
          } 
        };
      } else if (endpoint === 'auth/validate-token') {
        return { 
          data: { 
            valid: true, 
            userId: 'users/123' 
          } 
        };
      } else if (endpoint === 'auth/reset-password/confirm') {
        return { 
          data: { 
            success: true,
            message: 'Password has been reset successfully'
          } 
        };
      } else if (endpoint === 'auth/change-password') {
        return { 
          data: { 
            success: true,
            message: 'Password changed successfully'
          } 
        };
      } else if (endpoint === 'users/avatar') {
        return { 
          data: { 
            success: true,
            avatarUrl: 'https://example.com/avatar.jpg',
            message: 'Avatar uploaded successfully'
          } 
        };
      } else if (endpoint === 'users/verify-email') {
        return {
          data: {
            success: true,
            message: 'Email verified successfully'
          }
        };
      } else if (endpoint === 'users/resend-verification') {
        return {
          data: {
            success: true,
            message: 'Verification email sent'
          }
        };
      } else if (endpoint === 'users/deactivate') {
        return {
          data: {
            success: true,
            message: 'Account deactivated successfully'
          }
        };
      } else if (endpoint === 'users/reactivate') {
        return {
          data: {
            success: true,
            message: 'Account reactivated successfully'
          }
        };
      }
      
      return { data: {} };
    },
    
    async put(endpoint, data, config) {
      console.log(`PUT request to ${endpoint}`, data);
      
      if (endpoint === 'users/settings') {
        return {
          data: {
            success: true,
            message: 'Settings updated successfully'
          }
        };
      } else if (endpoint === 'users/email') {
        return {
          data: {
            success: true,
            message: 'Email updated successfully'
          }
        };
      }
      
      return { data: {} };
    },
    
    async delete(endpoint) {
      console.log(`DELETE request to ${endpoint}`);
      
      if (endpoint === 'users/avatar') {
        return {
          data: {
            success: true,
            message: 'Avatar deleted successfully'
          }
        };
      }
      
      return { data: {} };
    }
  };
  
  // Import user service implementation
  // Note: In a real test environment, you would use module imports
  // For this test file, we'll include the implementation directly
  class UserService {
    constructor() {
      this.tokenKey = 'user';
      this.authEndpoint = 'auth';
      this.userEndpoint = 'users';
    }
  
    async login(loginName, password) {
      try {
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
    
    async register(userData) {
      try {
        const payload = {
          loginName: userData.loginName,
          email: userData.email,
          encPassword: this.hashPassword(userData.password)
        };
        
        if (userData.fullName) {
          payload.fullName = userData.fullName;
        }
        
        const response = await httpService.post(`${this.authEndpoint}/register`, payload);
        
        if (response.data && response.data.accessToken) {
          this.setUserData(response.data);
        }
        
        return response.data;
      } catch (error) {
        console.error('Registration error:', error);
        throw error;
      }
    }
    
    async logout() {
      try {
        const response = await httpService.post(`${this.authEndpoint}/logout`);
        this.clearUserData();
        return response.data;
      } catch (error) {
        console.error('Logout error:', error);
        this.clearUserData();
        throw error;
      }
    }
    
    async fetchCurrentUser() {
      try {
        const response = await httpService.get(`${this.authEndpoint}/me`);
        return response.data.user;
      } catch (error) {
        console.error('Fetch current user error:', error);
        throw error;
      }
    }
    
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
    
    isAuthenticated() {
      const user = this.getCurrentUser();
      return !!user && !!user.accessToken;
    }
    
    setUserData(userData) {
      localStorage.setItem(this.tokenKey, JSON.stringify(userData));
    }
    
    clearUserData() {
      localStorage.removeItem(this.tokenKey);
    }
    
    hashPassword(password) {
      return crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');
    }
    
    async initiatePasswordReset(email) {
      try {
        const response = await httpService.post(`${this.authEndpoint}/reset-password`, { email });
        return response.data;
      } catch (error) {
        console.error('Password reset initiation error:', error);
        throw error;
      }
    }
    
    async validateResetToken(token) {
      try {
        const response = await httpService.post(`${this.authEndpoint}/validate-token`, { token });
        return response.data;
      } catch (error) {
        console.error('Token validation error:', error);
        throw error;
      }
    }
    
    async resetPassword(token, newPassword) {
      try {
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
    
    async changePassword(currentPassword, newPassword) {
      try {
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
    
    async getCurrentUserInfo() {
      try {
        const response = await httpService.get(`${this.userEndpoint}/me`);
        return response.data;
      } catch (error) {
        console.error('Error fetching current user info:', error);
        throw error;
      }
    }
    
    async updateAccountSettings(settings) {
      try {
        const response = await httpService.put(`${this.userEndpoint}/settings`, settings);
        return response.data;
      } catch (error) {
        console.error('Error updating account settings:', error);
        throw error;
      }
    }
    
    async verifyEmail(token) {
      try {
        const response = await httpService.post(`${this.userEndpoint}/verify-email`, { token });
        return response.data;
      } catch (error) {
        console.error('Error verifying email:', error);
        throw error;
      }
    }
    
    async resendVerificationEmail(email) {
      try {
        const response = await httpService.post(`${this.userEndpoint}/resend-verification`, { email });
        return response.data;
      } catch (error) {
        console.error('Error resending verification email:', error);
        throw error;
      }
    }
    
    async updateEmail(newEmail, password) {
      try {
        const response = await httpService.put(`${this.userEndpoint}/email`, {
          email: newEmail,
          password: this.hashPassword(password)
        });
        return response.data;
      } catch (error) {
        console.error('Error updating email:', error);
        throw error;
      }
    }
    
    async getActivityLog(page = 1, limit = 20) {
      try {
        const response = await httpService.get(`${this.userEndpoint}/activity`, {
          params: { page, limit }
        });
        return response.data;
      } catch (error) {
        console.error('Error fetching activity log:', error);
        throw error;
      }
    }
    
    async getAccountStatus() {
      try {
        const response = await httpService.get(`${this.userEndpoint}/status`);
        return response.data;
      } catch (error) {
        console.error('Error fetching account status:', error);
        throw error;
      }
    }
    
    async deactivateAccount(reason, password) {
      try {
        const response = await httpService.post(`${this.userEndpoint}/deactivate`, {
          reason,
          password: this.hashPassword(password)
        });
        return response.data;
      } catch (error) {
        console.error('Error deactivating account:', error);
        throw error;
      }
    }
    
    async reactivateAccount() {
      try {
        const response = await httpService.post(`${this.userEndpoint}/reactivate`);
        return response.data;
      } catch (error) {
        console.error('Error reactivating account:', error);
        throw error;
      }
    }
    
    async uploadAvatar(avatarFile) {
      try {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        
        const response = await httpService.post(`${this.userEndpoint}/avatar`, formData, {
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
    
    async deleteAvatar() {
      try {
        const response = await httpService.delete(`${this.userEndpoint}/avatar`);
        return response.data;
      } catch (error) {
        console.error('Error deleting avatar:', error);
        throw error;
      }
    }
    
    async checkUsernameAvailability(username) {
      try {
        const response = await httpService.get(`${this.userEndpoint}/check-username`, {
          params: { username }
        });
        return response.data.available;
      } catch (error) {
        console.error('Error checking username availability:', error);
        return false;
      }
    }
    
    async checkEmailAvailability(email) {
      try {
        const response = await httpService.get(`${this.userEndpoint}/check-email`, {
          params: { email }
        });
        return response.data.available;
      } catch (error) {
        console.error('Error checking email availability:', error);
        return false;
      }
    }
    
    validatePasswordStrength(password) {
      const result = {
        isValid: false,
        score: 0,
        feedback: {
          warnings: [],
          suggestions: []
        }
      };
      
      if (!password || password.length < 8) {
        result.feedback.warnings.push('Password is too short');
        result.feedback.suggestions.push('Use at least 8 characters');
        return result;
      }
      
      let score = 0;
      
      const hasLowercase = /[a-z]/.test(password);
      const hasUppercase = /[A-Z]/.test(password);
      const hasDigit = /\d/.test(password);
      const hasSpecial = /[^a-zA-Z0-9]/.test(password);
      
      if (hasLowercase) score++;
      if (hasUppercase) score++;
      if (hasDigit) score++;
      if (hasSpecial) score++;
      
      if (password.length >= 12) score++;
      if (password.length >= 16) score++;
      
      score = Math.min(score, 4);
      result.score = score;
      
      result.isValid = score >= 3;
      
      return result;
    }
    
    doPasswordsMatch(password, confirmPassword) {
      return password === confirmPassword;
    }
  }
  
  // Create instance
  const userService = new UserService();
  
  // Define test cases
  const runTests = async () => {
    try {
      console.log('===== TESTING USER SERVICE =====\n');
      
      // Test authentication
      console.log('1. Testing Authentication Features');
      
      // Test login
      console.log('\n  Testing login...');
      const loginResult = await userService.login('testuser', 'password123');
      console.log('  Login result:', loginResult);
      console.log('  User in localStorage:', userService.getCurrentUser());
      console.log('  Is authenticated:', userService.isAuthenticated());
      
      // Test registration
      console.log('\n  Testing registration...');
      const registrationResult = await userService.register({
        loginName: 'newuser',
        email: 'new@example.com',
        password: 'Password123!',
        fullName: 'New User'
      });
      console.log('  Registration result:', registrationResult);
      
      // Test fetch current user
      console.log('\n  Testing fetchCurrentUser...');
      const currentUser = await userService.fetchCurrentUser();
      console.log('  Current user:', currentUser);
      
      // Test logout
      console.log('\n  Testing logout...');
      const logoutResult = await userService.logout();
      console.log('  Logout result:', logoutResult);
      console.log('  Is authenticated after logout:', userService.isAuthenticated());
      
      // Test password management
      console.log('\n2. Testing Password Management Features');
      
      // Test initiate password reset
      console.log('\n  Testing initiatePasswordReset...');
      const resetResult = await userService.initiatePasswordReset('test@example.com');
      console.log('  Reset initiation result:', resetResult);
      
      // Test validate reset token
      console.log('\n  Testing validateResetToken...');
      const tokenResult = await userService.validateResetToken('test-token');
      console.log('  Token validation result:', tokenResult);
      
      // Test reset password
      console.log('\n  Testing resetPassword...');
      const resetPasswordResult = await userService.resetPassword('test-token', 'NewPassword123!');
      console.log('  Reset password result:', resetPasswordResult);
      
      // Test change password
      console.log('\n  Testing changePassword...');
      await userService.login('testuser', 'password123'); // Log in again for this test
      const changePasswordResult = await userService.changePassword('password123', 'NewPassword123!');
      console.log('  Change password result:', changePasswordResult);
      
      // Test password strength validation
      console.log('\n  Testing validatePasswordStrength...');
      const weakPassword = 'password';
      const mediumPassword = 'Password123';
      const strongPassword = 'P@ssw0rd!Complex2023';
      
      console.log(`  Strength of "${weakPassword}":`, userService.validatePasswordStrength(weakPassword));
      console.log(`  Strength of "${mediumPassword}":`, userService.validatePasswordStrength(mediumPassword));
      console.log(`  Strength of "${strongPassword}":`, userService.validatePasswordStrength(strongPassword));
      
      // Test password matching
      console.log('\n  Testing doPasswordsMatch...');
      console.log('  Matching passwords:', userService.doPasswordsMatch('test123', 'test123'));
      console.log('  Non-matching passwords:', userService.doPasswordsMatch('test123', 'test456'));
      
      // Test user account management
      console.log('\n3. Testing User Account Management Features');
      
      // Test get current user info
      console.log('\n  Testing getCurrentUserInfo...');
      const userInfo = await userService.getCurrentUserInfo();
      console.log('  User info:', userInfo);
      
      // Test get account status
      console.log('\n  Testing getAccountStatus...');
      const accountStatus = await userService.getAccountStatus();
      console.log('  Account status:', accountStatus);
      
      // Test get activity log
      console.log('\n  Testing getActivityLog...');
      const activityLog = await userService.getActivityLog();
      console.log('  Activity log:', activityLog);
      
      // Test update account settings
      console.log('\n  Testing updateAccountSettings...');
      const updateSettingsResult = await userService.updateAccountSettings({
        theme: 'dark',
        language: 'en',
        notifications: true
      });
      console.log('  Update settings result:', updateSettingsResult);
      
      // Test verify email
      console.log('\n  Testing verifyEmail...');
      const verifyEmailResult = await userService.verifyEmail('email-verification-token');
      console.log('  Verify email result:', verifyEmailResult);
      
      // Test resend verification email
      console.log('\n  Testing resendVerificationEmail...');
      const resendEmailResult = await userService.resendVerificationEmail('test@example.com');
      console.log('  Resend verification email result:', resendEmailResult);
      
      // Test update email
      console.log('\n  Testing updateEmail...');
      const updateEmailResult = await userService.updateEmail('newemail@example.com', 'password123');
      console.log('  Update email result:', updateEmailResult);
      
      // Test check username availability
      console.log('\n  Testing checkUsernameAvailability...');
      const existingUsername = await userService.checkUsernameAvailability('testuser');
      const newUsername = await userService.checkUsernameAvailability('availableuser');
      console.log('  Existing username available:', existingUsername);
      console.log('  New username available:', newUsername);
      
      // Test check email availability
      console.log('\n  Testing checkEmailAvailability...');
      const existingEmail = await userService.checkEmailAvailability('test@example.com');
      const newEmail = await userService.checkEmailAvailability('available@example.com');
      console.log('  Existing email available:', existingEmail);
      console.log('  New email available:', newEmail);
      
      // Test avatar management
      console.log('\n  Testing uploadAvatar...');
      const mockAvatar = { name: 'avatar.jpg', size: 1024 };
      const uploadAvatarResult = await userService.uploadAvatar(mockAvatar);
      console.log('  Upload avatar result:', uploadAvatarResult);
      
      console.log('\n  Testing deleteAvatar...');
      const deleteAvatarResult = await userService.deleteAvatar();
      console.log('  Delete avatar result:', deleteAvatarResult);
      
      // Test account deactivation/reactivation
      console.log('\n  Testing deactivateAccount...');
      const deactivateResult = await userService.deactivateAccount('Taking a break', 'password123');
      console.log('  Deactivate account result:', deactivateResult);
      
      console.log('\n  Testing reactivateAccount...');
      const reactivateResult = await userService.reactivateAccount();
      console.log('  Reactivate account result:', reactivateResult);
      
      console.log('\n===== ALL TESTS COMPLETED SUCCESSFULLY =====');
    } catch (error) {
      console.error('TEST FAILED:', error);
    }
  };
  
  // Run the tests
  runTests();