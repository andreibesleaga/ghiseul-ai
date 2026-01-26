// src/services/chatbotService.js - Chatbot and Analytics Service
import httpService from './httpService';

export default {
  /**
   * Submit a query to the chatbot
   * @param {Object} queryData - Query data
   * @returns {Promise} Query result
   */
  async submitQuery(queryData) {
    try {
      console.log('Submitting query:', JSON.stringify(queryData, null, 2));
      const startTime = Date.now();
      
      const response = await httpService.post('queries', {
        ...queryData,
        timestamp: new Date().toISOString()
      });
      
      if (response.data.response && response.data.response.startsWith('Error:')) {
        console.error('OPEA service error in response:', response.data.response);
        throw new Error(response.data.response);
      }
      
      const responseTime = Date.now() - startTime;
      console.log('Received response:', JSON.stringify(response.data, null, 2));
      console.log('Response time:', responseTime, 'ms');
      console.log('OPEA response content:', response.data.response || 'No response content available');
      
      if (response.data.metadata) {
        console.log('Metadata:', JSON.stringify(response.data.metadata, null, 2));
      }
      
      const queryId = response.data.queryId;  // Fixed: Use queryId instead of _key
      if (queryId) {
        await this.updateQueryResponseTime(queryId, responseTime);
        await this.markQueryAsAnswered(queryId, responseTime);
      } else {
        console.warn('No queryId in response; skipping updates');
      }
      
      return response.data;
    } catch (error) {
      console.error('Error submitting query:', error.message, error.response ? JSON.stringify(error.response.data, null, 2) : 'No response data');
      throw error;
    }
  },

  /**
   * Update query response time
   * @param {String} queryId - Query ID
   * @param {Number} responseTime - Response time in milliseconds
   * @returns {Promise} Update result
   */
  async updateQueryResponseTime(queryId, responseTime) {
    try {
      const response = await httpService.patch(`queries/${queryId}/responsetime`, {
        responseTime
      });
      
      return response.data;
    } catch (error) {
      console.error('Error updating query response time:', error);
      // Non-critical error, can be ignored
      return null;
    }
  },

  /**
   * Mark a query as answered
   * @param {String} queryId - Query ID
   * @param {Number} responseTime - Response time in milliseconds
   * @returns {Promise} Update result
   */
  async markQueryAsAnswered(queryId, responseTime) {
    try {
      const response = await httpService.patch(`queries/${queryId}/answered`, {
        responseTime
      });
      
      return response.data;
    } catch (error) {
      console.error('Error marking query as answered:', error);
      throw error;
    }
  },

  /**
   * Submit feedback for a query
   * @param {String} queryId - Query ID
   * @param {Object} feedback - Feedback data
   * @returns {Promise} Update result
   */
  async submitFeedback(queryId, feedback) {
    try {
      const response = await httpService.post(`queries/${queryId}/feedback`, feedback);
      return response.data;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  },

  /**
   * Get user query history
   * @param {String} userId - User ID
   * @param {Number} page - Page number (starting from 1)
   * @param {Number} limit - Results per page
   * @returns {Promise} Query history with pagination
   */
  async getUserQueryHistory(userId, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      
      const response = await httpService.get('queries/history', {
        params: { userId, limit, offset }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching user query history:', error);
      throw error;
    }
  },

  /**
   * Get saved queries for a user
   * @param {String} userId - User ID
   * @param {Number} page - Page number (starting from 1)
   * @param {Number} limit - Results per page
   * @returns {Promise} Saved queries with pagination
   */
  async getSavedQueries(userId, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      
      const response = await httpService.get('queries/saved', {
        params: { userId, limit, offset }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching saved queries:', error);
      throw error;
    }
  },

  /**
   * Save a query for future use
   * @param {Object} queryData - Query data
   * @returns {Promise} Saved query
   */
  async saveQuery(queryData) {
    try {
      const response = await httpService.post('queries/saved', queryData);
      return response.data;
    } catch (error) {
      console.error('Error saving query:', error);
      throw error;
    }
  },

  /**
   * Get query recommendations for a user
   * @param {String} userId - User ID
   * @param {Number} limit - Number of recommendations to get
   * @returns {Promise} Query recommendations
   */
  async getQueryRecommendations(userId, limit = 5) {
    try {
      const response = await httpService.get('queries/recommendations', {
        params: { userId, limit }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching query recommendations:', error);
      return [];
    }
  },

  /**
   * Get similar queries to a given query text
   * @param {String} queryText - Query text
   * @param {Number} limit - Number of similar queries to get
   * @returns {Promise} Similar queries
   */
  async getSimilarQueries(queryText, limit = 5) {
    try {
      const response = await httpService.get('queries/similar', {
        params: { query: queryText, limit }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching similar queries:', error);
      return [];
    }
  },

  /**
   * Get analytics for chatbot usage
   * @param {String} period - Period ('daily', 'weekly', 'monthly', 'all-time')
   * @param {String} date - Date for the period (ISO string)
   * @returns {Promise} Analytics data
   */
  async getAnalytics(period = 'daily', date = new Date().toISOString().split('T')[0]) {
    try {
      const response = await httpService.get('analytics', {
        params: { period, date }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  },

  /**
   * Get user usage statistics
   * @param {String} userId - User ID
   * @param {String} startDate - Start date (ISO string)
   * @param {String} endDate - End date (ISO string)
   * @returns {Promise} User usage statistics
   */
  async getUserStats(userId, startDate, endDate) {
    try {
      const response = await httpService.get(`analytics/users/${userId}`, {
        params: { startDate, endDate }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching user statistics:', error);
      throw error;
    }
  },

  /**
   * Get session information
   * @param {String} sessionId - Session ID
   * @returns {Promise} Session information
   */
  async getSessionInfo(sessionId) {
    try {
      const response = await httpService.get(`sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching session information:', error);
      throw error;
    }
  },

  /**
   * Start a new session
   * @param {String} userId - User ID
   * @param {Object} deviceInfo - Device information
   * @returns {Promise} New session
   */
  async startSession(userId, deviceInfo = {}) {
    try {
      const response = await httpService.post('sessions', {
        userId,
        deviceInfo,
        timestamp: new Date().toISOString()
      });
      
      return response.data;
    } catch (error) {
      console.error('Error starting session:', error);
      throw error;
    }
  },

  /**
   * End a session
   * @param {String} sessionId - Session ID
   * @returns {Promise} Session end result
   */
  async endSession(sessionId) {
    try {
      const response = await httpService.patch(`sessions/${sessionId}/end`, {
        endTime: new Date().toISOString()
      });
      
      return response.data;
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  },

  /**
   * Keep a session alive
   * @param {String} sessionId - Session ID
   * @returns {Promise} Session update result
   */
  async keepSessionAlive(sessionId) {
    try {
      const response = await httpService.patch(`sessions/${sessionId}/keepalive`, {
        lastActiveTime: new Date().toISOString()
      });
      
      return response.data;
    } catch (error) {
      console.error('Error keeping session alive:', error);
      throw error;
    }
  }
};