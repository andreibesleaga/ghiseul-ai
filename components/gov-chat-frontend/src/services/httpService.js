import axios from 'axios';
import AuthService from './authService';

/**
 * Base service for handling HTTP requests
 * Provides standardized methods for API communication
 */
class HttpService {
  /**
   * Initialize the HTTP service
   */
  constructor() {
    this.baseUrl = process.env.VUE_APP_API_URL || 'http://localhost:3000/api';
    console.log('VUE_APP_API_URL=', process.env.VUE_APP_API_URL);

    this.axios = axios;

    // Configure axios
    this.axios.defaults.headers.common['Content-Type'] = 'application/json';

    // Token refresh state
    this.isRefreshing = false;
    this.refreshSubscribers = [];
    this.maxRetries = 2; // Limit interceptor retries to avoid overlap with authService
    this.retryDelay = 2000; // Delay for 401/403 retries in ms

    // Add request interceptor
    this.axios.interceptors.request.use(
      this.handleRequest.bind(this),
      this.handleRequestError.bind(this)
    );

    // Add response interceptor
    this.axios.interceptors.response.use(
      this.handleResponse.bind(this),
      this.handleResponseError.bind(this)
    );
  }

  /**
   * Refresh token with retry handling delegated to AuthService
   * @returns {Promise} Token refresh response
   */
  async refreshToken() {
    try {
      const response = await AuthService.refreshToken();
      return response;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Set the base URL for API requests
   * @param {string} url - Base URL for API endpoints
   */
  setBaseUrl(url) {
    this.baseUrl = url;
  }

  /**
   * Get the full URL by combining base URL with endpoint
   * @param {string} endpoint - API endpoint
   * @returns {string} Full URL
   */
  getUrl(endpoint) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    let base = this.baseUrl;
    if (!base.endsWith('/') && cleanEndpoint) {
      base += '/';
    }
    return `${base}${cleanEndpoint}`;
  }

  /**
   * Handle request interceptor
   * @param {Object} config - Request configuration
   * @returns {Object} Modified request configuration
   */
  handleRequest(config) {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        if (userData.accessToken) {
          config.headers.Authorization = `Bearer ${userData.accessToken}`;
          console.debug(`[HttpService] Added Authorization header for ${config.url}`);
        }
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
    return config;
  }

  /**
   * Handle request error interceptor
   * @param {Error} error - Request error
   * @returns {Promise} Rejected promise with error
   */
  handleRequestError(error) {
    console.error('Request error:', error);
    return Promise.reject(error);
  }

  /**
   * Handle response interceptor
   * @param {Object} response - Response object
   * @returns {Object} Response object
   */
  handleResponse(response) {
    return response;
  }

  /**
   * Subscribe to token refresh
   * @param {Function} callback - Function to call after token refresh
   */
  subscribeTokenRefresh(callback) {
    this.refreshSubscribers.push(callback);
  }

  /**
   * Notify subscribers about token refresh completion
   * @param {string} token - New access token
   */
  onTokenRefreshed(token) {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  }

  /**
   * Handle response error interceptor with token refresh and login redirect
   * @param {Error} error - Response error
   * @returns {Promise} Rejected promise with error or retried request
   */
  async handleResponseError(error) {
    console.debug(`[HttpService] Handling response error for ${error.config?.url}:`, {
      status: error.response?.status,
      data: error.response?.data
    });

    if (error.response) {
      const status = error.response.status;
      const originalRequest = error.config;

      // Handle all 401/403 responses immediately
      if ([401, 403].includes(status)) {
        console.debug(`[HttpService] Unauthorized request detected for ${originalRequest.url} (status: ${status})`);

        // Clear all user-related localStorage data
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        console.debug('[HttpService] Cleared localStorage user data');

        // Redirect to login if not already there
        if (typeof window !== 'undefined' && window.location && !window.location.pathname.includes('/login')) {
          console.log(`[HttpService] Redirecting to /login?error=unauthorized from ${originalRequest.url}`);
          window.location.href = '/login?error=unauthorized';
        }

        return Promise.reject({
          status,
          statusText: error.response.statusText,
          data: error.response.data,
          message: error.response.data?.message || 'Unauthorized access'
        });
      }

      // Retry logic for 401/403 with refresh token
      if ([401, 403].includes(status) && !originalRequest._retryCount) {
        originalRequest._retryCount = originalRequest._retryCount || 0;

        if (originalRequest._retryCount >= this.maxRetries) {
          console.error(`[HttpService] Max retries (${this.maxRetries}) reached for ${originalRequest.url}`);
          AuthService.clearUserData();
          if (typeof window !== 'undefined' && window.location && !window.location.pathname.includes('/login')) {
            console.log('[HttpService] Redirecting to login due to max retries');
            window.location.href = '/login?error=session_expired';
          }
          return Promise.reject(error);
        }

        originalRequest._retryCount += 1;
        console.debug(`[HttpService] Retry attempt ${originalRequest._retryCount} for ${originalRequest.url} (status: ${status})`);

        if (this.isRefreshing) {
          return new Promise((resolve) => {
            this.subscribeTokenRefresh(token => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(this.axios(originalRequest));
            });
          });
        }

        this.isRefreshing = true;

        try {
          const response = await this.refreshToken();
          const newToken = response.data.accessToken;

          const userStr = localStorage.getItem('user');
          if (userStr) {
            try {
              const userData = JSON.parse(userStr);
              userData.accessToken = newToken;
              userData.refreshToken = response.data.refreshToken || userData.refreshToken;
              localStorage.setItem('user', JSON.stringify(userData));

              this.axios.defaults.headers.common.Authorization = `Bearer ${newToken}`;
              originalRequest.headers.Authorization = `Bearer ${newToken}`;

              this.onTokenRefreshed(newToken);
              this.isRefreshing = false;

              await new Promise(resolve => setTimeout(resolve, this.retryDelay));
              return this.axios(originalRequest);
            } catch (e) {
              console.error('Error parsing user data during token refresh:', e);
            }
          }

          throw new Error('No user data available');
        } catch (refreshError) {
          console.error('Token refresh error:', refreshError);
          this.isRefreshing = false;
          AuthService.clearUserData();
          localStorage.removeItem('user');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          console.debug('[HttpService] Cleared localStorage after refresh failure');

          if (typeof window !== 'undefined' && window.location && !window.location.pathname.includes('/login')) {
            console.log('[HttpService] Redirecting to login due to refresh failure');
            window.location.href = '/login?error=refresh_failed';
          }
          return Promise.reject(refreshError);
        }
      }

      const errorData = {
        status,
        statusText: error.response.statusText,
        data: error.response.data,
        message: error.response.data?.message || 'An error occurred'
      };

      console.error('API response error:', errorData);
      return Promise.reject(errorData);
    } else if (error.request) {
      console.error('Network error - no response received:', error.request);
      return Promise.reject({
        status: 0,
        message: 'Network error. Please check your connection.'
      });
    } else {
      console.error('Request setup error:', error.message);
      return Promise.reject({
        message: 'Error preparing the request: ' + error.message
      });
    }
  }

  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @param {Object} options - Additional axios options
   * @returns {Promise} Response promise
   */
  async get(endpoint, params = {}, options = {}) {
    try {
      const url = this.getUrl(endpoint);
      const config = {
        ...options,
        params: params.params || params
      };
      return await this.axios.get(url, config);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Make a POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request payload
   * @param {Object} options - Additional axios options
   * @param {boolean} appendBaseUrl - Whether to append base URL
   * @returns {Promise} Response promise
   */
  async post(endpoint, data = {}, options = {}, appendBaseUrl = true) {
    try {
      const url = appendBaseUrl ? this.getUrl(endpoint) : endpoint;
      return await this.axios.post(url, data, options);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Make a PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request payload
   * @param {Object} options - Additional axios options
   * @returns {Promise} Response promise
   */
  async put(endpoint, data = {}, options = {}) {
    try {
      const url = this.getUrl(endpoint);
      return await this.axios.put(url, data, options);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Make a DELETE request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Additional axios options
   * @returns {Promise} Response promise
   */
  async delete(endpoint, options = {}) {
    try {
      const url = this.getUrl(endpoint);
      return await this.axios.delete(url, options);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Make a PATCH request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request payload
   * @param {Object} options - Additional axios options
   * @returns {Promise} Response promise
   */
  async patch(endpoint, data = {}, options = {}) {
    try {
      const url = this.getUrl(endpoint);
      return await this.axios.patch(url, data, options);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Special PUT method that completely bypasses caching
   * @param {string} url - API endpoint
   * @param {Object} data - Data to send
   * @returns {Promise} Promise with server response
   */
  async putNoCache(url, data) {
    const timestamp = Date.now();
    const noCacheUrl = `${this.getUrl(url)}?_nocache=${timestamp}`;
    const noCacheData = {
      ...data,
      _timestamp: timestamp
    };
    return this.axios.put(noCacheUrl, noCacheData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '-1',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Timestamp': timestamp
      }
    });
  }
}

export default new HttpService();