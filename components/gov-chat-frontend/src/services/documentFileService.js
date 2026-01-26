import httpService from './httpService';

/**
 * Service for handling all document file-related API requests for the document repository.
 */
const documentFileService = {
  /**
   * Gets a paginated and filtered list of file metadata.
   * @param {Object} params - The query parameters.
   * @param {number} [params.page=1] - Page number.
   * @param {number} [params.limit=10] - Items per page.
   * @param {string} [params.category] - Filter by category.
   * @param {string} [params.search] - Search term.
   * @returns {Promise<Object>} The paginated list of files.
   */
  // In the getFiles method

  async getFiles(params) {
    try {
      const response = await httpService.get('/files', { params });

      // <-- ADD THIS LINE to inspect the raw API response
      console.log('[documentFileService] Raw API Response:', response);

      return response.data;
    } catch (error) {
      console.error('Error fetching files:', error);
      throw error;
    }
  },

  /**
 * Gets the metadata for a single file.
 * @param {string} fileId - The unique ID of the file.
 * @returns {Promise<Object>} The file metadata object.
 */
  async getFileMetadata(fileId) {
    try {
      const response = await httpService.get(`/files/${fileId}`);

      // This is the key change:
      // Instead of returning the whole response.data object,
      // we extract and return the nested 'data' property which contains the file.
      return response.data.data;

    } catch (error) {
      console.error(`Error fetching metadata for file ${fileId}:`, error);
      throw error;
    }
  },

  /**
   * Uploads a single file using FormData.
   * @param {FormData} formData - The FormData object containing the file and any metadata.
   * @returns {Promise<Object>} The response from the server.
   */
  async uploadFile(formData) {
    try {
      const response = await httpService.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading single file:', error);
      throw error;
    }
  },

  /**
   * Uploads a file by crawling a public URL.
   * @param {string} url - The URL to crawl.
   * @returns {Promise<Object>} The response from the server.
   */
  async uploadLink(url) {
    try {
      const response = await httpService.post('/files/upload-link', { url });
      return response.data;
    } catch (error) {
      console.error('Error uploading link:', error);
      throw error;
    }
  },

  /**
   * Updates the metadata for a specific file.
   * @param {string} fileId - The ID of the file to update.
   * @param {Object} updates - An object containing the fields to update.
   * @returns {Promise<Object>} The updated file metadata.
   */
  async updateFile(fileId, updates) {
    try {
      const response = await httpService.patch(`/files/${fileId}`, updates);
      return response.data;
    } catch (error) {
      console.error(`Error updating file ${fileId}:`, error);
      throw error;
    }
  },

  /**
   * Deletes a single file.
   * @param {string} fileId - The ID of the file to delete.
   * @returns {Promise<Object>} The confirmation response.
   */
  async deleteFile(fileId) {
    try {
      const response = await httpService.delete(`/files/${fileId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting file ${fileId}:`, error);
      throw error;
    }
  },

    /**
   * Triggers the ingestion process for a single file.
   * @param {string} fileId - The ID of the file to ingest.
   * @returns {Promise<Object>} The confirmation response.
   */
    async ingestFile(fileId) {
      try {
        // This corresponds to the backend route: POST /api/files/:fileId/ingest
        const response = await httpService.post(`/files/${fileId}/ingest`);
        return response.data;
      } catch (error) {
        console.error(`Error ingesting file ${fileId}:`, error);
        throw error;
      }
    },

  /**
   * Triggers the ingestion process for multiple files.
   * @param {string[]} fileIds - An array of file IDs to ingest.
   * @returns {Promise<Object>} The confirmation response.
   */
  async ingestMultipleFiles(fileIds) {
    try {
      const response = await httpService.post('/files/ingest', { fileIds });
      return response.data;
    } catch (error) {
      console.error('Error ingesting multiple files:', error);
      throw error;
    }
  },

  /**
   * Retracts multiple files from the system.
   * @param {string[]} fileIds - An array of file IDs to retract.
   * @returns {Promise<Object>} The confirmation response.
   */
  async retractMultipleFiles(fileIds) {
    try {
      const response = await httpService.post('/files/retract', { fileIds });
      return response.data;
    } catch (error) {
      console.error('Error retracting multiple files:', error);
      throw error;
    }
  },

  /**
   * NEW: Gets all ingestion logs for a specific file.
   * @param {string} fileId - The ID of the file.
   * @returns {Promise<Object>} The API response containing the list of logs.
   */
  async getIngestionLogs(fileId) {
    try {
      // This corresponds to the backend route: GET /api/files/:fileId/ingestion-log
      const response = await httpService.get(`/files/${fileId}/ingestion-log`);
      return response.data; // Assumes backend returns { success: true, data: [...] }
    } catch (error) {
      console.error(`Error fetching ingestion logs for file ${fileId}:`, error);
      throw error;
    }
  },
};

export default documentFileService;
