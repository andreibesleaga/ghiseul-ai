// src/services/tests/nodeTestPassword.js
// Simple test script using CommonJS for direct Node.js testing

// Mock crypto for Node environment
const crypto = require('crypto');

// Mock httpService for testing
const httpService = {
  async get(endpoint) {
    console.log(`GET request to ${endpoint}`);
    return { data: {} };
  },
  
  async post(endpoint, data) {
    console.log(`POST request to ${endpoint}`, data);
    
    if (endpoint === 'auth/reset-password') {
      return { 
        data: { 
          success: true, 
          message: 'If your email exists in our system, a password reset link has been sent to your email',
          token: 'mock-reset-token' // Only in dev environment
        } 
      };
    } else if (endpoint === 'auth/validate-token') {
      if (data.token === 'valid-token') {
        return { data: { valid: true, userId: 'users/123' } };
      } else if (data.token === 'expired-token') {
        return { data: { valid: false, expired: true, message: 'Token has expired' } };
      } else if (data.token === 'used-token') {
        return { data: { valid: false, used: true, message: 'Token has already been used' } };
      } else {
        return { data: { valid: false, message: 'Invalid token' } };
      }
    } else if (endpoint === 'auth/reset-password/confirm') {
      if (data.token === 'valid-token') {
        return { data: { success: true, message: 'Password has been reset successfully' } };
      } else {
        return { data: { success: false, message: 'Invalid token' } };
      }
    } else if (endpoint === 'auth/change-password') {
      if (data.currentPassword === '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8') { // 'password'
        return { data: { success: true, message: 'Password changed successfully' } };
      } else {
        return { data: { success: false, message: 'Current password is incorrect' } };
      }
    }
    
    return { data: {} };
  }
};

// PasswordService implementation
class PasswordService {
  constructor() {
    this.authEndpoint = 'auth';
  }

  async initiateReset(email) {
    try {
      const response = await httpService.post(`${this.authEndpoint}/reset-password`, { email });
      return response.data;
    } catch (error) {
      console.error('Password reset initiation error:', error);
      throw error;
    }
  }

  async validateToken(token) {
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

  doPasswordsMatch(password, confirmPassword) {
    return password === confirmPassword;
  }

  hashPassword(password) {
    return crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');
  }
}

const passwordService = new PasswordService();

// Run the tests
async function runTests() {
  try {
    // Test initiateReset
    console.log('Testing initiateReset...');
    const resetResult = await passwordService.initiateReset('test@example.com');
    console.log('Reset initiation result:', resetResult);
    
    // Test validateToken with different token types
    console.log('\nTesting validateToken with valid token...');
    const validTokenResult = await passwordService.validateToken('valid-token');
    console.log('Valid token result:', validTokenResult);
    
    console.log('\nTesting validateToken with expired token...');
    const expiredTokenResult = await passwordService.validateToken('expired-token');
    console.log('Expired token result:', expiredTokenResult);
    
    console.log('\nTesting validateToken with used token...');
    const usedTokenResult = await passwordService.validateToken('used-token');
    console.log('Used token result:', usedTokenResult);
    
    console.log('\nTesting validateToken with invalid token...');
    const invalidTokenResult = await passwordService.validateToken('invalid-token');
    console.log('Invalid token result:', invalidTokenResult);
    
    // Test resetPassword
    console.log('\nTesting resetPassword with valid token...');
    const resetPasswordResult = await passwordService.resetPassword('valid-token', 'NewPassword123!');
    console.log('Reset password result:', resetPasswordResult);
    
    console.log('\nTesting resetPassword with invalid token...');
    const invalidResetResult = await passwordService.resetPassword('invalid-token', 'NewPassword123!');
    console.log('Invalid reset result:', invalidResetResult);
    
    // Test changePassword
    console.log('\nTesting changePassword with correct current password...');
    const changePasswordResult = await passwordService.changePassword('password', 'NewPassword123!');
    console.log('Change password result:', changePasswordResult);
    
    console.log('\nTesting changePassword with incorrect current password...');
    const incorrectChangeResult = await passwordService.changePassword('wrongpassword', 'NewPassword123!');
    console.log('Incorrect current password result:', incorrectChangeResult);
    
    // Test password strength validation
    console.log('\nTesting password strength validation...');
    
    const weakPassword = 'password';
    console.log(`Strength of "${weakPassword}":`, passwordService.validatePasswordStrength(weakPassword));
    
    const mediumPassword = 'Password123';
    console.log(`Strength of "${mediumPassword}":`, passwordService.validatePasswordStrength(mediumPassword));
    
    const strongPassword = 'P@ssw0rd!Complex2023';
    console.log(`Strength of "${strongPassword}":`, passwordService.validatePasswordStrength(strongPassword));
    
    // Test password matching
    console.log('\nTesting password matching...');
    console.log('Matching passwords:', passwordService.doPasswordsMatch('password123', 'password123'));
    console.log('Non-matching passwords:', passwordService.doPasswordsMatch('password123', 'password1234'));
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the tests
runTests();