import httpService from './httpService';

/**
 * Service for handling all label-related API requests to the document repository.
 */
const labelService = {
  /**
   * Gets a list of labels, with optional filters.
   * @param {Object} [params] - Optional query parameters.
   * @param {string} [params.level] - Filter by level ('category' or 'service').
   * @param {string} [params.status] - Filter by status ('pending' or 'active').
   * @returns {Promise<Array>} A list of label objects.
   */
  async getLabels(params = {}) {
    try {
      const response = await httpService.get('/labels', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching labels:', error);
      throw error;
    }
  },

  /**
   * Creates a new label.
   * @param {Object} labelData - The data for the new label.
   * @param {string} labelData.name - The name of the label.
   * @param {string} labelData.level - The level ('category' or 'service').
   * @param {string} [labelData.status] - The status ('pending' or 'active').
   * @returns {Promise<Object>} The newly created label object.
   */
  async createLabel(labelData) {
    try {
      const response = await httpService.post('/labels', labelData);
      return response.data;
    } catch (error) {
      console.error('Error creating label:', error);
      throw error;
    }
  },

  /**
   * Updates an existing label.
   * @param {string} labelId - The ID of the label to update.
   * @param {Object} updates - An object containing the fields to update.
   * @returns {Promise<Object>} The updated label object.
   */
  async updateLabel(labelId, updates) {
    try {
      const response = await httpService.patch(`/labels/${labelId}`, updates);
      return response.data;
    } catch (error) {
      console.error(`Error updating label ${labelId}:`, error);
      throw error;
    }
  },

  /**
   * Deletes a label.
   * @param {string} labelId - The ID of the label to delete.
   * @returns {Promise<Object>} The confirmation response.
   */
  async deleteLabel(labelId) {
    try {
      const response = await httpService.delete(`/labels/${labelId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting label ${labelId}:`, error);
      throw error;
    }
  },
};

export default labelService;