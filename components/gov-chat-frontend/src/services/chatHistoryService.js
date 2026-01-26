import httpService from './httpService';

/**
 * Service for managing chat history and conversations
 */
class ChatHistoryService {
  /**
   * Get all conversations for the authenticated user
   * @param {String} userId - User ID (required)
   * @param {Object} options - Filter and pagination options
   * @param {Number} options.limit - Maximum conversations to return (default: 20)
   * @param {Number} options.offset - Number of records to skip (default: 0)
   * @param {Boolean} options.includeArchived - Whether to include archived conversations
   * @param {Boolean} options.filterStarred - Filter to show only starred conversations
   * @param {String} options.searchTerm - Text to search in conversation titles or messages
   * @returns {Promise} Conversations list with pagination details
   */
  async getUserConversations(userId, options = {}) {
    try {
      if (!userId) {
        console.error('Error: userId is required for getUserConversations');
        throw new Error('User ID is required');
      }

      console.log(`Fetching conversations for user ${userId} with options:`, options);

      const params = {
        limit: options.limit || 20,
        offset: options.offset || 0,
        includeArchived: options.includeArchived || false,
        filterStarred: options.filterStarred || false,
        searchTerm: options.searchTerm || ''
      };

      const response = await httpService.get('/chat/conversations', {
        params: { ...params, userId }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching user conversations:', error);
      throw error;
    }
  }

  /**
   * Get a specific conversation with its details
   * @param {String} conversationId - ID of the conversation to retrieve
   * @returns {Promise} Conversation details
   */
  async getConversation(conversationId) {
    try {
      const response = await httpService.get(`/chat/conversations/${conversationId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new conversation
   * @param {Object} conversationData - Data for the new conversation
   * @param {String} conversationData.userId - User ID (required)
   * @param {String} conversationData.title - Title of the conversation
   * @param {String} conversationData.categoryId - Optional category ID
   * @param {String} conversationData.initialMessage - Optional initial message
   * @param {Array} conversationData.tags - Optional tags for the conversation
   * @returns {Promise} Created conversation data
   */
  async createConversation(conversationData) {
    try {
      // Ensure userId is provided
      if (!conversationData.userId) {
        console.error('Error: userId is required for createConversation');
        throw new Error('User ID is required');
      }

      console.log("chatHistoryService.createConversation called with:", conversationData);
      const response = await httpService.post('/chat/conversations', conversationData);
      return response.data;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * Update an existing conversation
   * @param {String} conversationId - ID of the conversation to update
   * @param {Object} updateData - Data to update
   * @param {String} updateData.title - New title for the conversation
   * @param {String} updateData.categoryId - Optional category ID
   * @param {String} updateData.category - Optional category name
   * @param {Array} updateData.tags - Optional tags for the conversation
   * @param {Boolean} updateData.isStarred - Starred status
   * @param {Boolean} updateData.isArchived - Archived status
   * @param {String} updateData.userId - User ID (required)
   * @returns {Promise} Updated conversation data
   */
  async updateConversation(conversationId, updateData) {
    try {
      if (!conversationId) {
        console.error('Error: conversationId is required for updateConversation');
        throw new Error('Conversation ID is required');
      }

      if (!updateData.userId) {
        console.error('Error: userId is required for updateConversation');
        throw new Error('User ID is required');
      }

      console.log(`chatHistoryService.updateConversation called with:`, { conversationId, updateData });
      const response = await httpService.patch(`/chat/conversations/${conversationId}`, updateData);
      return response.data;
    } catch (error) {
      console.error(`Error updating conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a conversation and all its messages
   * @param {String} conversationId - ID of the conversation to delete
   * @param {String} userId - User ID requesting the deletion (required for validation)
   * @returns {Promise} Result of the deletion
   */
  async deleteConversation(conversationId, userId) {
    try {
      if (!userId) {
        console.error('Error: userId is required for deleteConversation');
        throw new Error('User ID is required');
      }

      console.log(`Deleting conversation ${conversationId} for user ${userId}`);

      // Pass userId as a query parameter as expected by the backend
      const response = await httpService.delete(`/chat/conversations/${conversationId}`, {
        params: { userId }
      });

      return response.data;
    } catch (error) {
      console.error(`Error deleting conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Get messages for a specific conversation
   * @param {String} conversationId - ID of the conversation
   * @param {Object} options - Pagination and sorting options
   * @param {Number} options.limit - Maximum messages to return (default: 50)
   * @param {Number} options.offset - Number of records to skip (default: 0)
   * @param {Boolean} options.newestFirst - Sort with newest messages first
   * @returns {Promise} Messages with pagination details
   */
  async getConversationMessages(conversationId, options = {}) {
    try {
      const params = {
        limit: options.limit || 50,
        offset: options.offset || 0,
        newestFirst: options.newestFirst || false
      };

      const response = await httpService.get(
        `/chat/conversations/${conversationId}/messages`,
        { params }
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching messages for conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Add a new message to a conversation
   * @param {Object} messageData - Message data
   * @param {String} messageData.conversationId - ID of the conversation
   * @param {String} messageData.content - Message content
   * @param {String} messageData.sender - Sender ('user' or 'assistant')
   * @param {String} messageData.queryId - Optional query ID for assistant messages
   * @param {Object} messageData.metadata - Optional additional metadata
   * @returns {Promise} Created message data
   */
  async addMessage(messageData) {
    try {
      if (!messageData.conversationId) {
        console.error('Error: conversationId is required for addMessage');
        throw new Error('Conversation ID is required');
      }

      console.log("chatHistoryService.addMessage called with:", messageData);
      const response = await httpService.post(
        `/chat/conversations/${messageData.conversationId}/messages`,
        messageData
      );
      return response.data;
    } catch (error) {
      console.error(`Error adding message to conversation ${messageData.conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Mark messages as read
   * @param {String} conversationId - ID of the conversation
   * @param {Array} messageIds - Optional specific message IDs to mark as read
   * @returns {Promise} Result of the operation
   */
  async markMessagesAsRead(conversationId, messageIds = []) {
    try {
      const response = await httpService.post(
        `/chat/conversations/${conversationId}/messages/read`,
        { messageIds }
      );
      return response.data;
    } catch (error) {
      console.error(`Error marking messages as read in conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Find messages related to a specific query
   * @param {String} queryId - ID of the query
   * @returns {Promise} Messages related to the query
   */
  async findMessagesForQuery(queryId) {
    try {
      const response = await httpService.get(`/chat/query/${queryId}/messages`);
      return response.data;
    } catch (error) {
      console.error(`Error finding messages for query ${queryId}:`, error);
      throw error;
    }
  }

  /**
   * Find the originating query for a message
   * @param {String} messageId - ID of the message
   * @returns {Promise} Query information
   */
  async findOriginatingQuery(messageId) {
    try {
      const response = await httpService.get(`/chat/messages/${messageId}/query`);
      return response.data;
    } catch (error) {
      console.error(`Error finding originating query for message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new conversation from an existing query
   * @param {String} queryId - ID of the query
   * @param {String} userId - User ID
   * @param {Object} options - Conversation options
   * @param {String} options.title - Optional title for the conversation
   * @param {String} options.responseText - Optional response text to include
   * @param {Array} options.tags - Optional tags for the conversation
   * @returns {Promise} Created conversation data
   */
  async createConversationFromQuery(queryId, userId, options = {}) {
    try {
      if (!userId) {
        console.error('Error: userId is required for createConversationFromQuery');
        throw new Error('User ID is required');
      }

      const response = await httpService.post(
        `/chat/query/${queryId}/conversation`,
        { ...options, userId }
      );
      return response.data;
    } catch (error) {
      console.error(`Error creating conversation from query ${queryId}:`, error);
      throw error;
    }
  }

  /**
   * Search conversations containing specific text
   * @param {String} userId - User ID
   * @param {String} searchTerm - Text to search for
   * @param {Object} options - Search options
   * @param {Number} options.limit - Maximum results to return (default: 20)
   * @param {Number} options.offset - Number of results to skip (default: 0)
   * @param {Boolean} options.includeArchived - Whether to include archived conversations
   * @returns {Promise} Search results with pagination
   */
  async searchConversations(userId, searchTerm, options = {}) {
    try {
      if (!userId) {
        console.error('Error: userId is required for searchConversations');
        throw new Error('User ID is required');
      }

      const params = {
        userId,
        q: searchTerm,
        limit: options.limit || 20,
        offset: options.offset || 0,
        includeArchived: options.includeArchived || false
      };

      const response = await httpService.get('/chat/search', { params });
      return response.data;
    } catch (error) {
      console.error(`Error searching conversations with term "${searchTerm}":`, error);
      throw error;
    }
  }

  /**
   * Get recent conversations for the user
   * @param {String} userId - User ID
   * @param {Number} limit - Maximum number of conversations to return
   * @returns {Promise} Recent conversations
   */
  async getRecentConversations(userId, limit = 5) {
    try {
      if (!userId) {
        console.error('Error: userId is required for getRecentConversations');
        throw new Error('User ID is required');
      }

      const response = await httpService.get('/chat/recent', {
        params: { userId, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching recent conversations:', error);
      throw error;
    }
  }

  /**
   * Get conversation statistics for the user
   * @param {String} userId - User ID
   * @returns {Promise} Conversation statistics
   */
  async getUserConversationStats(userId) {
    try {
      if (!userId) {
        console.error('Error: userId is required for getUserConversationStats');
        throw new Error('User ID is required');
      }

      const response = await httpService.get('/chat/stats', {
        params: { userId }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching conversation statistics:', error);
      throw error;
    }
  }

  /**
   * Export conversation to PDF or other format
   * @param {String} conversationId - ID of the conversation to export
   * @param {String} format - Export format (pdf, json, etc.)
   * @returns {Promise} Export data or download URL
   */
  async exportConversation(conversationId, format = 'pdf') {
    try {
      const response = await httpService.get(
        `/chat/conversations/${conversationId}/export`,
        {
          params: { format },
          responseType: 'blob'
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Error exporting conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Get all folders for the authenticated user
   * @param {String} userId - User ID (required)
   * @param {Object} options - Filter options
   * @param {Boolean} options.includeArchived - Whether to include archived folders
   * @param {String} options.parentFolderId - ID of parent folder to get subfolders (null for root folders)
   * @returns {Promise} Folders list
   */
  async getUserFolders(userId, options = {}) {
    try {
      if (!userId) {
        console.error('Error: userId is required for getUserFolders');
        throw new Error('User ID is required');
      }

      console.log(`Fetching folders for user ${userId} with options:`, options);

      const params = {
        userId // Always include userId
      };

      // Only add options if explicitly provided
      if ('includeArchived' in options) {
        params.includeArchived = options.includeArchived;
      }
      if ('parentFolderId' in options && options.parentFolderId !== undefined) {
        params.parentFolderId = options.parentFolderId;
      }

      const response = await httpService.get('/chat/folders', {
        params
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching user folders:', error);
      throw error;
    }
  }

  /**
   * Get shared folders for the authenticated user
   * @param {String} userId - User ID (required)
   * @param {Object} options - Filter options
   * @param {Boolean} options.includeArchived - Whether to include archived folders
   * @returns {Promise} Shared folders list
   */
  async getSharedFolders(userId, options = {}) {
    try {
      if (!userId) {
        console.error('Error: userId is required for getSharedFolders');
        throw new Error('User ID is required');
      }

      console.log(`Fetching shared folders for user ${userId} with options:`, options);

      const params = {
        includeArchived: options.includeArchived || false
      };

      const response = await httpService.get('/chat/folders/shared', {
        params: { ...params, userId }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching shared folders:', error);
      throw error;
    }
  }

  /**
   * Get a specific folder with its details
   * @param {String} folderId - ID of the folder to retrieve
   * @returns {Promise} Folder details with conversations
   */
  async getFolder(folderId) {
    try {
      const response = await httpService.get(`/chat/folders/${folderId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching folder ${folderId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new folder
   * @param {Object} folderData - Data for the new folder
   * @param {String} folderData.userId - User ID (required)
   * @param {String} folderData.name - Name of the folder (required)
   * @param {String} folderData.description - Optional description
   * @param {String} folderData.parentFolderId - Optional parent folder ID
   * @param {String} folderData.color - Optional color code
   * @param {String} folderData.icon - Optional icon name
   * @returns {Promise} Created folder data
   */
  async createFolder(folderData) {
    try {
      // Ensure userId and name are provided
      if (!folderData.userId) {
        console.error('Error: userId is required for createFolder');
        throw new Error('User ID is required');
      }

      if (!folderData.name) {
        console.error('Error: name is required for createFolder');
        throw new Error('Folder name is required');
      }

      const response = await httpService.post('/chat/folders', folderData);
      return response.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  /**
   * Update an existing folder
   * @param {String} folderId - ID of the folder to update
   * @param {Object} updateData - Data to update
   * @param {String} updateData.name - New name for the folder
   * @param {String} updateData.description - New description
   * @param {Boolean} updateData.isArchived - Archive status
   * @param {String} updateData.color - Color code
   * @param {String} updateData.icon - Icon name
   * @param {String} updateData.parentFolderId - Parent folder ID
   * @param {String} updateData.userId - User ID for permission check
   * @returns {Promise} Updated folder data
   */
  async updateFolder(folderId, updateData) {
    try {
      console.log(`Updating folder ${folderId} with data:`, updateData);
      const response = await httpService.patch(`/chat/folders/${folderId}`, updateData);
      return response.data;
    } catch (error) {
      console.error(`Error updating folder ${folderId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a folder
   * @param {String} folderId - ID of the folder to delete
   * @param {String} userId - User ID requesting the deletion (required for validation)
   * @param {Boolean} deleteContents - Whether to delete contained conversations and subfolders
   * @returns {Promise} Result of the deletion
   */
  async deleteFolder(folderId, userId, deleteContents = false) {
    try {
      if (!userId) {
        console.error('Error: userId is required for deleteFolder');
        throw new Error('User ID is required');
      }

      console.log(`Deleting folder ${folderId} for user ${userId}, deleteContents: ${deleteContents}`);

      const response = await httpService.delete(`/chat/folders/${folderId}`, {
        params: { userId, deleteContents }
      });

      return response.data;
    } catch (error) {
      console.error(`Error deleting folder ${folderId}:`, error);
      throw error;
    }
  }

  /**
   * Get the folder path (breadcrumbs)
   * @param {String} folderId - ID of the folder
   * @returns {Promise} Array of folders representing the path
   */
  async getFolderPath(folderId) {
    try {
      const response = await httpService.get(`/chat/folders/${folderId}/path`);
      return response.data;
    } catch (error) {
      console.error(`Error getting path for folder ${folderId}:`, error);
      throw error;
    }
  }

  /**
   * Search folders by name or description
   * @param {String} userId - User ID
   * @param {String} searchTerm - Text to search for
   * @param {Object} options - Search options
   * @param {Boolean} options.includeArchived - Whether to include archived folders
   * @returns {Promise} Search results
   */
  async searchFolders(userId, searchTerm, options = {}) {
    try {
      if (!userId) {
        console.error('Error: userId is required for searchFolders');
        throw new Error('User ID is required');
      }

      if (!searchTerm) {
        console.error('Error: searchTerm is required for searchFolders');
        throw new Error('Search term is required');
      }

      const params = {
        userId,
        q: searchTerm,
        includeArchived: options.includeArchived || false
      };

      const response = await httpService.get('/chat/folders/search', { params });
      return response.data;
    } catch (error) {
      console.error(`Error searching folders with term "${searchTerm}":`, error);
      throw error;
    }
  }

  /**
   * Reorder folders
   * @param {String} userId - User ID
   * @param {Array} folderOrders - Array of {folderId, order} objects
   * @param {String} parentFolderId - Parent folder ID (null for root folders)
   * @returns {Promise} Result of the operation
   */
  async reorderFolders(userId, folderOrders, parentFolderId = null) {
    try {
      if (!userId) {
        console.error('Error: userId is required for reorderFolders');
        throw new Error('User ID is required');
      }

      if (!Array.isArray(folderOrders) || folderOrders.length === 0) {
        console.error('Error: folderOrders must be a non-empty array');
        throw new Error('Folder orders array is required');
      }

      const response = await httpService.post('/chat/folders/reorder', {
        userId,
        folderOrders,
        parentFolderId
      });

      return response.data;
    } catch (error) {
      console.error('Error reordering folders:', error);
      throw error;
    }
  }

  /**
   * Add a conversation to a folder
   * @param {String} folderId - Folder ID
   * @param {String} conversationId - Conversation ID
   * @param {String} userId - User ID for permission check
   * @returns {Promise} Result of the operation
   */
  async addConversationToFolder(folderId, conversationId, userId) {
    try {
      if (!userId) {
        console.error('Error: userId is required for addConversationToFolder');
        throw new Error('User ID is required');
      }

      console.log(`chatHistoryService.addConversationToFolder called with:`, { folderId, conversationId, userId });

      const response = await httpService.post(
        `/chat/folders/${folderId}/conversations/${conversationId}`,
        { userId }
      );

      return response.data;
    } catch (error) {
      console.error(`Error adding conversation ${conversationId} to folder ${folderId}:`, error);
      throw error;
    }
  }

  /**
   * Get the folder containing a conversation
   * @param {String} conversationId - Conversation ID
   * @returns {Promise} Folder information or null if not in a folder
   */
  async getConversationFolder(conversationId) {
    try {
      const response = await httpService.get(`/chat/conversations/${conversationId}/folder`);
      return response.data;
    } catch (error) {
      // If 404, the conversation is not in any folder
      if (error.response && error.response.status === 404) {
        return { inFolder: false, folder: null };
      }
      console.error(`Error finding folder for conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Move a conversation between folders
   * @param {String} conversationId - Conversation ID
   * @param {String} sourceFolderId - Source folder ID (null for root)
   * @param {String} targetFolderId - Target folder ID (null for root)
   * @param {String} userId - User ID for permission check
   * @returns {Promise} Result of the operation
   */
  async moveConversation(conversationId, sourceFolderId, targetFolderId, userId) {
    try {
      if (!userId) {
        console.error('Error: userId is required for moveConversation');
        throw new Error('User ID is required');
      }

      console.log(`Moving conversation ${conversationId} from folder ${sourceFolderId || 'root'} to ${targetFolderId || 'root'}`);

      const response = await httpService.post(
        `/chat/conversations/${conversationId}/move`,
        {
          userId,
          sourceFolderId,
          targetFolderId
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Error moving conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Share a folder with another user
   * @param {String} folderId - Folder ID
   * @param {String} userId - Owner user ID
   * @param {String} targetUserId - Target user ID to share with
   * @param {String} role - Role to assign (viewer, editor, contributor)
   * @returns {Promise} Result of the operation
   */
  async shareFolder(folderId, userId, targetUserId, role = 'viewer') {
    try {
      if (!userId) {
        console.error('Error: userId is required for shareFolder');
        throw new Error('User ID is required');
      }

      if (!targetUserId) {
        console.error('Error: targetUserId is required for shareFolder');
        throw new Error('Target user ID is required');
      }

      console.log(`Sharing folder ${folderId} with user ${targetUserId} as ${role}`);

      const response = await httpService.post(
        `/chat/folders/${folderId}/share`,
        {
          userId,
          targetUserId,
          role
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Error sharing folder ${folderId} with user ${targetUserId}:`, error);
      throw error;
    }
  }

  /**
   * Remove folder sharing with a user
   * @param {String} folderId - Folder ID
   * @param {String} userId - Owner user ID
   * @param {String} targetUserId - Target user ID to remove access from
   * @returns {Promise} Result of the operation
   */
  async removeFolderShare(folderId, userId, targetUserId) {
    try {
      if (!userId) {
        console.error('Error: userId is required for removeFolderShare');
        throw new Error('User ID is required');
      }

      if (!targetUserId) {
        console.error('Error: targetUserId is required for removeFolderShare');
        throw new Error('Target user ID is required');
      }

      console.log(`Removing share for folder ${folderId} from user ${targetUserId}`);

      const response = await httpService.delete(
        `/chat/folders/${folderId}/share/${targetUserId}`,
        { params: { userId } }
      );

      return response.data;
    } catch (error) {
      console.error(`Error removing share for folder ${folderId} from user ${targetUserId}:`, error);
      throw error;
    }
  }

  /**
   * Get users with access to a folder
   * @param {String} folderId - Folder ID
   * @param {String} userId - User ID for permission check
   * @returns {Promise} List of users with access
   */
  async getFolderUsers(folderId, userId) {
    try {
      if (!userId) {
        console.error('Error: userId is required for getFolderUsers');
        throw new Error('User ID is required');
      }

      const response = await httpService.get(
        `/chat/folders/${folderId}/users`,
        { params: { userId } }
      );

      return response.data;
    } catch (error) {
      console.error(`Error getting users for folder ${folderId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a conversation from a folder
   * @param {String} conversationId - Conversation ID
   * @param {String} currentFolderId - Current folder ID
   * @param {String} userId - User ID for permission check
   * @returns {Promise} Result of the operation
   */
  async removeConversationFromFolder(conversationId, currentFolderId, userId) {
    try {
      if (!userId) {
        console.error('Error: userId is required for removeConversationFromFolder');
        throw new Error('User ID is required');
      }

      console.log(`Removing conversation ${conversationId} from folder ${currentFolderId}`);

      const response = await httpService.delete(
        `/chat/folders/${currentFolderId}/conversations/${conversationId}`,
        { params: { userId } }
      );

      return response.data;
    } catch (error) {
      console.error(
        `Error removing conversation ${conversationId} from folder ${currentFolderId}:`,
        error
      );
      throw error;
    }
  }
}

export default new ChatHistoryService();