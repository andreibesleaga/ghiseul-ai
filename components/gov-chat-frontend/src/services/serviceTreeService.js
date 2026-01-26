// src/services/serviceTreeService.js - Connect ServiceTreePanelComponent to backend
import httpService from './httpService';

export default {
  /**
   * For the MAIN application sidebar.
   * Fetches all categories with a simple array of service name strings.
   * @param {String} locale - Locale code (e.g., 'en')
   * @returns {Promise} Categories with simple service name strings.
   */
  async getAllCategories(locale = 'en') {
    try {
      // This points to the PUBLIC endpoint that returns simple data
      const response = await httpService.get('services/categories', {
        params: { locale }
      });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching service categories:', error);
      throw error;
    }
  },

    /**
   * For the ADMIN dashboard ONLY.
   * Fetches all categories with a detailed array of service objects ({_key, name}).
   * @param {String} locale - Locale code (e.g., 'en')
   * @returns {Promise} Categories with detailed service objects.
   */
    async getAdminCategories(locale = 'en') {
      try {
        // This points to the ADMIN endpoint that returns detailed data
        const response = await httpService.get('service-categories/categories/detailed', {
          params: { locale }
        });
        return response.data || [];
      } catch (error) {
        console.error('Error fetching admin service categories:', error);
        throw error;
      }
    },

  /**
   * Transform backend categories to tree panel format
   * @param {Array} categories - Categories from backend
   * @param {String} locale - Locale code
   * @returns {Array} Transformed nodes for tree panel
   */
  transformCategoriesToTreeNodes(categories, locale) {
    return categories.map(category => ({
      catKey: category.catKey,
      name: category.name,  // Preserve the name property!
      expanded: false,
      children: category.children || []
    }));
  },

  /**
   * Get services for a specific category
   * @param {String} categoryId - Category ID
   * @param {String} locale - Locale code
   * @returns {Promise} Category with services
   */
  async getCategoryServices(categoryId, locale = 'en') {
    try {
      const response = await httpService.get(`services/categories/${categoryId}`, {
        params: { locale }
      });

      return response.data.children || [];
    } catch (error) {
      console.error(`Error fetching services for category ${categoryId}:`, error);
      throw error;
    }
  },

  /**
   * Search for categories and services
   * @param {String} query - Search query
   * @param {String} locale - Locale code
   * @returns {Promise} Search results
   */
  async searchServices(query, locale = 'en') {
    try {
      const response = await httpService.get('services/search', {
        params: { query, locale }
      });

      return response.data;
    } catch (error) {
      console.error('Error searching services:', error);
      return { categories: [], services: [] };
    }
  },

  /**
   * Get fallback categories in case of API failure
   * @param {String} locale - Locale code
   * @returns {Array} Fallback categories
   */
  getFallbackCategories(locale = 'en') {
    // These match the fallback data in ServiceTreePanelComponent
    const fallbackData = {
      en: [
        { catKey: 'cat1', expanded: false },
        { catKey: 'cat2', expanded: false },
        { catKey: 'cat3', expanded: false },
        { catKey: 'cat4', expanded: false },
        { catKey: 'cat5', expanded: false },
        { catKey: 'cat6', expanded: false },
        { catKey: 'cat7', expanded: false },
        { catKey: 'cat8', expanded: false },
        { catKey: 'cat9', expanded: false },
        { catKey: 'cat10', expanded: false },
        { catKey: 'cat11', expanded: false },
        { catKey: 'cat12', expanded: false }
      ],
      fr: [
        { catKey: 'cat1', expanded: false },
        { catKey: 'cat2', expanded: false },
        { catKey: 'cat3', expanded: false },
        { catKey: 'cat4', expanded: false },
        { catKey: 'cat5', expanded: false },
        { catKey: 'cat6', expanded: false },
        { catKey: 'cat7', expanded: false },
        { catKey: 'cat8', expanded: false },
        { catKey: 'cat9', expanded: false },
        { catKey: 'cat10', expanded: false },
        { catKey: 'cat11', expanded: false },
        { catKey: 'cat12', expanded: false }
      ],
      sw: [
        { catKey: 'cat1', expanded: false },
        { catKey: 'cat2', expanded: false },
        { catKey: 'cat3', expanded: false },
        { catKey: 'cat4', expanded: false },
        { catKey: 'cat5', expanded: false },
        { catKey: 'cat6', expanded: false },
        { catKey: 'cat7', expanded: false },
        { catKey: 'cat8', expanded: false },
        { catKey: 'cat9', expanded: false },
        { catKey: 'cat10', expanded: false },
        { catKey: 'cat11', expanded: false },
        { catKey: 'cat12', expanded: false }
      ]
    };

    return fallbackData[locale] || fallbackData.en;
  },

  /**
   * Save selected services to user preferences
   * @param {String} userId - User ID
   * @param {Array} selectedServices - Selected services
   * @returns {Promise} Save result
   */
  async saveSelectedServices(userId, selectedServices) {
    try {
      const response = await httpService.post(`users/${userId}/preferences/services`, {
        selectedServices
      });

      return response.data;
    } catch (error) {
      console.error('Error saving selected services:', error);
      throw error;
    }
  },

  /**
   * Get user's selected services
   * @param {String} userId - User ID
   * @returns {Promise} User's selected services
   */
  async getUserSelectedServices(userId) {
    try {
      const response = await httpService.get(`users/${userId}/preferences/services`);
      return response.data.selectedServices || [];
    } catch (error) {
      console.error('Error getting user selected services:', error);
      return [];
    }
  },

  /**
  * Get all translations for a specific category
  * @param {String} categoryId - The ID of the category
  * @returns {Promise<Array>} A list of translation objects [{lang, text}]
  */
  async getCategoryTranslations(categoryId) {
    try {
      // This endpoint matches the one created in service-category-routes.js
      const response = await httpService.get(`service-categories/${categoryId}/translations`);
      return response.data || [];
    } catch (error) {
      console.error(`Error fetching translations for category ${categoryId}:`, error);
      // Return an empty array on failure so the UI doesn't break
      return [];
    }
  },

  /**
   * Get all translations for a specific service
   * @param {String} serviceId - The ID of the service
   * @returns {Promise<Array>} A list of translation objects [{lang, text}]
   */
  async getServiceTranslations(serviceId) {
    try {
      // This endpoint matches the one created in service-category-routes.js
      const response = await httpService.get(`service-categories/services/${serviceId}/translations`);
      return response.data || [];
    } catch (error) {
      console.error(`Error fetching translations for service ${serviceId}:`, error);
      return [];
    }
  },

  /**
 * Creates a new category.
 * @param {Object} payload - The category data { nameEN, translations }.
 * @returns {Promise<Object>} The newly created category.
 */
  async createCategory(payload) {
    try {
      // Send the payload directly to our new single-item creation endpoint
      const response = await httpService.post('service-categories', payload);
      return response.data;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  },
  
  /**
   * Updates an existing category.
   * @param {String} categoryId - The ID of the category to update.
   * @param {Object} payload - The category data { nameEN, translations }.
   * @returns {Promise<Object>} The updated category.
   */
  async updateCategory(categoryId, payload) {
    try {
      // Assumes a PUT endpoint at /service-categories/:id
      const response = await httpService.put(`service-categories/${categoryId}`, payload);
      return response.data;
    } catch (error) {
      console.error(`Error updating category ${categoryId}:`, error);
      throw error;
    }
  },

  /**
   * Creates a new service under a category.
   * @param {String} categoryId - The parent category ID.
   * @param {Object} payload - The service data { nameEN, translations }.
   * @returns {Promise<Object>} The newly created service.
   */
  async createService(categoryId, payload) {
    try {
      // Assumes a POST endpoint at /service-categories/:id/services
      const response = await httpService.post(`service-categories/${categoryId}/services`, payload);
      return response.data;
    } catch (error) {
      console.error(`Error creating service for category ${categoryId}:`, error);
      throw error;
    }
  },

  /**
   * Updates an existing service.
   * @param {String} serviceId - The ID of the service to update.
   * @param {Object} payload - The service data { nameEN, translations }.
   * @returns {Promise<Object>} The updated service.
   */
  async updateService(serviceId, payload) {
    try {
      // Assumes a PUT endpoint at /service-categories/services/:id
      const response = await httpService.put(`service-categories/services/${serviceId}`, payload);
      return response.data;
    } catch (error) {
      console.error(`Error updating service ${serviceId}:`, error);
      throw error;
    }
  },

  /**
* Deletes a category.
* @param {String} categoryId - The ID of the category to delete.
* @returns {Promise<Object>} The response from the server.
*/
  async deleteCategory(categoryId) {
    try {
      // This endpoint matches the DELETE /:categoryId route in service-category-routes.js
      const response = await httpService.delete(`service-categories/${categoryId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting category ${categoryId}:`, error);
      throw error; // Re-throw to be caught by the component
    }
  },

  /**
   * Deletes a service.
   * @param {String} serviceId - The ID of the service to delete.
   * @returns {Promise<Object>} The response from the server.
   */
  async deleteService(serviceId) {
    try {
      // This endpoint is based on the previously defined roadmap
      const response = await httpService.delete(`service-categories/services/${serviceId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting service ${serviceId}:`, error);
      throw error;
    }
  },
};