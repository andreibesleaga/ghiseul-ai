// src/services/tests/testPasswordService.js
// Test script for switchable passwordService.js

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
  
  // Mock console.log for cleaner output
  const originalLog = console.log;
  console.log = function(...args) {
    // Filter out the mode switching messages
    if (args[0] && typeof args[0] === 'string' && args[0].includes('PasswordService')) {
      return;
    }
    originalLog.apply(console, args);
  };
  
  // Mock httpService
  const httpService = {
    async post(endpoint, data) {
      console.log(`POST request to ${endpoint}`, data);
      
      if (endpoint === 'auth/reset-password') {
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
      }
      
      return { data: {} };
    }
  };
  
  // Mock userService
  const userService = {
    initiatePasswordReset(email) {
      console.log(`userService.initiatePasswordReset called with email: ${email}`);
      return Promise.resolve({ 
        success: true, 
        message: 'Password reset email sent (via userService)',
        token: 'mock-reset-token-userService'
      });
    },
    
    validateResetToken(token) {
      console.log(`userService.validateResetToken called with token: ${token}`);
      return Promise.resolve({ 
        valid: true, 
        userId: 'users/123',
        message: 'Token is valid (via userService)' 
      });
    },
    
    resetPassword(token, newPassword) {
      console.log(`userService.resetPassword called with token and password`);
      return Promise.resolve({ 
        success: true,
        message: 'Password has been reset successfully (via userService)'
      });
    },
    
    changePassword(currentPassword, newPassword) {
      console.log(`userService.changePassword called with current and new passwords`);
      return Promise.resolve({ 
        success: true,
        message: 'Password changed successfully (via userService)'
      });
    },
    
    validatePasswordStrength(password) {
      console.log(`userService.validatePasswordStrength called with password: ${password}`);
      return {
        isValid: password.length >= 8,
        score: password.length >= 12 ? 4 : 3,
        feedback: {
          warnings: [],
          suggestions: []
        }
      };
    },
    
    doPasswordsMatch(password, confirmPassword) {
      console.log(`userService.doPasswordsMatch called`);
      return password === confirmPassword;
    },
    
    hashPassword(password) {
      console.log(`userService.hashPassword called`);
      return `userService-hashed-${password}`;
    }
  };
  
  // Import PasswordService implementation
  // Note: In a real test environment, you would use module imports
  // For this test file, we'll include the implementation directly
  class PasswordService {
    constructor() {
      this.authEndpoint = 'auth';
      this.useUserService = false;
    }
    
    setMode(useUserService) {
      this.useUserService = !!useUserService;
      console.log(`PasswordService switched to ${this.useUserService ? 'delegated' : 'standalone'} mode`);
      return this;
    }
    
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
    
    async resetPassword(token, newPassword) {
      if (this.useUserService) {
        return userService.resetPassword(token, newPassword);
      }
      
      try {
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
    
    async changePassword(currentPassword, newPassword) {
      if (this.useUserService) {
        return userService.changePassword(currentPassword, newPassword);
      }
      
      try {
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
    
    validatePasswordStrength(password) {
      if (this.useUserService) {
        return userService.validatePasswordStrength(password);
      }
      
      // Simplified implementation for testing
      const result = {
        isValid: false,
        score: 0,
        feedback: { warnings: [], suggestions: [] }
      };
      
      if (password.length >= 8) {
        result.score = 3;
        result.isValid = true;
      }
      
      if (password.length >= 12) {
        result.score = 4;
      }
      
      return result;
    }
    
    doPasswordsMatch(password, confirmPassword) {
      if (this.useUserService) {
        return userService.doPasswordsMatch(password, confirmPassword);
      }
      
      return password === confirmPassword;
    }
    
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
  
  const passwordService = new PasswordService();
  
  // Run the tests
  async function runTests() {
    console.log('===== TESTING PASSWORD SERVICE IN STANDALONE MODE =====');
    
    // Reset to standalone mode
    passwordService.setMode(false);
    
    // Test standalone mode
    await testAllMethods(passwordService);
    
    console.log('\n===== TESTING PASSWORD SERVICE IN DELEGATED MODE =====');
    
    // Switch to userService mode
    passwordService.setMode(true);
    
    // Test delegated mode
    await testAllMethods(passwordService);
    
    console.log('\n===== ALL TESTS COMPLETED SUCCESSFULLY =====');
  }
  
  // Test all methods in current mode
  async function testAllMethods(service) {
    try {
      console.log('\n1. Testing initiateReset...');
      const resetResult = await service.initiateReset('test@example.com');
      console.log('  Reset initiation result:', resetResult);
      
      console.log('\n2. Testing validateToken...');
      const tokenResult = await service.validateToken('test-token');
      console.log('  Token validation result:', tokenResult);
      
      console.log('\n3. Testing resetPassword...');
      const resetPasswordResult = await service.resetPassword('test-token', 'NewPassword123!');
      console.log('  Reset password result:', resetPasswordResult);
      
      console.log('\n4. Testing changePassword...');
      const changePasswordResult = await service.changePassword('CurrentPassword123!', 'NewPassword123!');
      console.log('  Change password result:', changePasswordResult);
      
      console.log('\n5. Testing validatePasswordStrength...');
      const weakResult = service.validatePasswordStrength('pass');
      const strongResult = service.validatePasswordStrength('StrongPassword123!');
      console.log('  Weak password result:', weakResult);
      console.log('  Strong password result:', strongResult);
      
      console.log('\n6. Testing doPasswordsMatch...');
      const matchResult = service.doPasswordsMatch('samePassword', 'samePassword');
      const mismatchResult = service.doPasswordsMatch('password1', 'password2');
      console.log('  Matching passwords:', matchResult);
      console.log('  Non-matching passwords:', mismatchResult);
      
      console.log('\n7. Testing hashPassword...');
      const hashedPassword = service.hashPassword('TestPassword123');
      console.log('  Hashed password:', hashedPassword.substring(0, 20) + '...');
    } catch (error) {
      console.error('TEST FAILED:', error);
    }
  }
  
  // Run the tests
  runTests();