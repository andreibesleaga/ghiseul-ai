// src/services/userProfileService.js - Connect UserProfileComponent to backend
import httpService from './httpService';

/**
 * Service for managing detailed user profiles
 */
class UserProfileService {
  /**
   * Get user profile by ID
   * @param {String} userId - User ID
   * @returns {Promise} User profile data
   */
  async getProfile(userId) {
    try {
      const response = await httpService.get(`users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  /**
   * Create a new user profile
   * @param {Object} profileData - Profile data from the form
   * @returns {Promise} Created user profile
   */
  async createProfile(profileData) {
    try {
      // Handle file uploads and form data
      const formData = this.prepareFormData(profileData);
      
      const response = await httpService.post('users', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

 /**
 * Update an existing user profile
 * @param {String} userId - User ID
 * @param {Object} profileData - Updated profile data
 * @returns {Promise} Updated user profile
 */
  async updateProfile(userId, profileData) {
    try {
      console.log(`Updating user profile for ID: ${userId}`);
      console.log('Profile data:', profileData);

      // Check if there are any File objects in the profile data
      const hasFiles = this.checkForFiles(profileData);

      let response;
      if (hasFiles) {
        // Handle file uploads and form data
        const formData = this.prepareFormData(profileData);

        response = await httpService.put(`users/${userId}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        // No files, send as JSON
        response = await httpService.put(`users/${userId}`, profileData);
      }

      return response.data;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
 * Check if the profile data contains any File objects
 * @param {Object} profileData - Profile data to check
 * @returns {Boolean} True if files are present
 */
  checkForFiles(profileData) {
    // Check for File objects in any section
    for (const section in profileData) {
      if (typeof profileData[section] === 'object' && profileData[section] !== null) {
        for (const field in profileData[section]) {
          if (profileData[section][field] instanceof File) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Delete a user profile
   * @param {String} userId - User ID
   * @returns {Promise} Deletion result
   */
  async deleteProfile(userId) {
    try {
      const response = await httpService.delete(`users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting user profile:', error);
      throw error;
    }
  }

  /**
   * Prepare form data for file uploads
   * @param {Object} profileData - Profile data including files
   * @returns {FormData} Form data for submission
   */
  prepareFormData(profileData) {
    const formData = new FormData();
    
    // Clone the profile data to avoid modifying the original
    const dataToSend = JSON.parse(JSON.stringify(profileData));
    
    // Process each section that might have file uploads
    const sectionsWithFiles = [
      'personalIdentification',
      'civilRegistration',
      'addressResidency',
      'identityTravel',
      'healthMedical',
      'employment',
      'financialTax',
      'criminalLegal',
      'transportation'
    ];
    
    // Extract files and append them to form data
    sectionsWithFiles.forEach(section => {
      if (!dataToSend[section]) return;
      
      Object.keys(dataToSend[section]).forEach(field => {
        const value = dataToSend[section][field];
        
        // Check if it's a File object
        if (value instanceof File) {
          formData.append(`${section}-${field}`, value);
          // Remove the file from the data object
          delete dataToSend[section][field];
        }
      });
    });
    
    // Append the non-file data as JSON
    formData.append('data', JSON.stringify(dataToSend));
    
    return formData;
  }

  /**
   * Search for users based on criteria
   * @param {Object} criteria - Search criteria
   * @param {Number} page - Page number (starting from 1)
   * @param {Number} limit - Results per page
   * @returns {Promise} Search results with pagination
   */
  async searchUsers(criteria, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      
      const response = await httpService.get('users/search', {
        params: { ...criteria, limit, offset }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }


  /**
   * Update user role (admin only)
   * @param {String} userId - User ID to update
   * @param {Object} updateData - Data containing the new role
   * @returns {Promise} Update result
   */
  async updateUserRole(userId, updateData) {
    try {
      console.log(`Updating role for user ${userId} to ${updateData.role}`);

      // First try the admin-specific endpoint
      try {
        const response = await httpService.put(`admin/users/${userId}/role`, updateData);
        return response;
      } catch (adminError) {
        console.warn('Admin-specific role update failed, falling back to standard user update:', adminError.message);

        // If that fails, try the standard user update endpoint
        // This matches the route in user-routes.js 
        const response = await httpService.put(`users/${userId}`, {
          role: updateData.role
        });
        return response;
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

  /**
   * Update user role only (specific method for role changes)
   * @param {String} userId - User ID to update
   * @param {String} role - New role value
   * @returns {Promise} Update result
   */
  async updateUserRoleOnly(userId, role) {
    try {
      console.log(`Updating role for user ${userId} to ${role}`);

      // Make the API request to the endpoint that matches the backend route
      // This matches the PUT /api/users/:userId/role endpoint in user-routes.js
      const response = await httpService.put(`users/${userId}/role`, { role });

      console.log(`Role update response:`, response);
      return response;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

}

export default new UserProfileService();