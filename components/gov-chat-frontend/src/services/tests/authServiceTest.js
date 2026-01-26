// src/services/tests/nodeTestAuth.js
// Simple test script using CommonJS for direct Node.js testing

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

// Mock httpService for testing
const httpService = {
  async get(endpoint) {
    console.log(`GET request to ${endpoint}`);
    if (endpoint === 'auth/me') {
      return { 
        data: { 
          user: { 
            _key: '123', 
            loginName: 'testuser', 
            email: 'test@example.com' 
          } 
        } 
      };
    }
    return { data: {} };
  },
  
  async post(endpoint, data) {
    console.log(`POST request to ${endpoint}`, data);
    
    if (endpoint === 'auth/login') {
      return { 
        data: { 
          _key: '123', 
          loginName: data.loginName, 
          accessToken: 'mock-token-123' 
        } 
      };
    } else if (endpoint === 'auth/logout') {
      return { data: { success: true } };
    } else if (endpoint === 'auth/reset-password') {
      return { 
        data: { 
          success: true, 
          message: 'Password reset email sent',
          token: 'mock-reset-token' // Only in dev environment
        } 
      };
    } else if (endpoint === 'auth/validate-token') {
      return { data: { valid: true, userId: 'users/123' } };
    } else if (endpoint === 'auth/reset-password/confirm') {
      return { data: { success: true } };
    } else if (endpoint === 'auth/change-password') {
      return { data: { success: true } };
    } else if (endpoint === 'auth/register') {
      return { 
        data: { 
          _key: '456', 
          loginName: data.loginName, 
          email: data.email, 
          accessToken: 'mock-token-456' 
        } 
      };
    }
    
    return { data: {} };
  }
};

// AuthService implementation (simplified)
class AuthService {
  constructor() {
    this.tokenKey = 'user';
    this.authEndpoint = 'auth';
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
}

const authService = new AuthService();

// Run the tests
async function runTests() {
  try {
    // Test login
    console.log('Testing login...');
    const loginResult = await authService.login('testuser', 'password123');
    console.log('Login result:', loginResult);
    console.log('User in localStorage:', authService.getCurrentUser());
    console.log('isAuthenticated:', authService.isAuthenticated());
    
    // Test fetchCurrentUser
    console.log('\nTesting fetchCurrentUser...');
    const currentUser = await authService.fetchCurrentUser();
    console.log('Current user:', currentUser);
    
    // Test password reset initiation
    console.log('\nTesting initiatePasswordReset...');
    const resetResult = await authService.initiatePasswordReset('test@example.com');
    console.log('Reset initiation result:', resetResult);
    
    // Test token validation
    console.log('\nTesting validateResetToken...');
    const tokenResult = await authService.validateResetToken('test-token');
    console.log('Token validation result:', tokenResult);
    
    // Test reset password
    console.log('\nTesting resetPassword...');
    const newPasswordResult = await authService.resetPassword('test-token', 'newpassword123');
    console.log('Reset password result:', newPasswordResult);
    
    // Test change password
    console.log('\nTesting changePassword...');
    const changePasswordResult = await authService.changePassword('password123', 'updatedpassword123');
    console.log('Change password result:', changePasswordResult);
    
    // Test logout
    console.log('\nTesting logout...');
    const logoutResult = await authService.logout();
    console.log('Logout result:', logoutResult);
    console.log('User after logout:', authService.getCurrentUser());
    console.log('isAuthenticated after logout:', authService.isAuthenticated());
    
    // Test register
    console.log('\nTesting register...');
    const registerResult = await authService.register({
      loginName: 'newuser',
      email: 'newuser@example.com',
      password: 'password123',
      fullName: 'New User'
    });
    console.log('Register result:', registerResult);
    console.log('User after register:', authService.getCurrentUser());
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the tests
runTests();