const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth-middleware');
const { logger } = require('../shared-lib');

module.exports = (chatHistoryService) => {
  // Helper function to extract user ID from the request
  const extractUserId = (req) => {
    let userId = '';

    if (req.user) {
      // The userId must be in the format "users/2133"
      if (req.user.userId) {
        userId = req.user.userId;
        // Ensure it has the correct prefix
        if (!userId.startsWith('users/')) {
          userId = `users/${userId}`;
        }
      }
      // If not in userId, try _key and other fields
      else if (req.user._key) {
        userId = `users/${req.user._key}`;
      }
      else if (req.user.id) {
        userId = `users/${req.user.id}`;
      }

      logger.info(`Using user identifier from req.user: ${userId}`);
    }

    // If we don't have a user ID from req.user, check query params
    if (!userId && req.query.userId) {
      userId = req.query.userId;
      // Ensure it has the correct prefix
      if (!userId.startsWith('users/')) {
        userId = `users/${userId}`;
      }
      logger.info(`Using userId from query parameter: ${userId}`);
    }

    // Lastly, check if it's in the body (some routes use this)
    if (!userId && req.body && req.body.userId) {
      userId = req.body.userId;
      // Ensure it has the correct prefix
      if (!userId.startsWith('users/')) {
        userId = `users/${userId}`;
      }
      logger.info(`Using userId from request body: ${userId}`);
    }

    return userId;
  };

  // Apply authentication middleware to all routes
  router.use(authMiddleware.authenticate);

  /**
   * @swagger
   * /chat/conversations:
   *   get:
   *     summary: Get user conversations
   *     description: Retrieves all conversations for the authenticated user with pagination and filtering options
   *     tags: [Chat History]
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Maximum number of conversations to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *         description: Number of records to skip for pagination
   *       - in: query
   *         name: includeArchived
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include archived conversations
   *       - in: query
   *         name: filterStarred
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Filter to show only starred conversations
   *       - in: query
   *         name: searchTerm
   *         schema:
   *           type: string
   *         description: Text to search for in conversation titles or messages
   *     responses:
   *       200:
   *         description: List of conversations with pagination details
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  router.get('/conversations', async (req, res) => {
    try {
      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;
      const includeArchived = req.query.includeArchived === 'true';
      const filterStarred = req.query.filterStarred === 'true';
      const searchTerm = req.query.searchTerm || '';

      logger.info(`Getting conversations for user ${userId} with filters - includeArchived: ${includeArchived}, filterStarred: ${filterStarred}, searchTerm: "${searchTerm}"`);

      const options = {
        limit,
        offset,
        includeArchived,
        filterStarred,
        searchTerm
      };

      const result = await chatHistoryService.getUserConversations(userId, options);
      res.json(result);
    } catch (error) {
      logger.error(`Error getting user conversations: ${error.message}`, { stack: error.stack });
      res.status(500).json({
        success: false,
        message: `Error getting user conversations: ${error.message}`
      });
    }
  });

  /**
 * @swagger
 * /chat/conversations/{conversationId}:
 *   get:
 *     summary: Get conversation details
 *     description: Retrieves a specific conversation including its messages
 *     tags: [Chat History]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the conversation to retrieve
 *     responses:
 *       200:
 *         description: Conversation details with messages
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Server error
 */
  router.get('/conversations/:conversationId', async (req, res) => {
    try {
      const { conversationId } = req.params;
      logger.info(`Getting conversation ${conversationId}`);

      const conversation = await chatHistoryService.getConversation(conversationId);

      if (!conversation) {
        logger.warn(`Conversation ${conversationId} not found`);
        return res.status(404).json({ message: 'Conversation not found' });
      }

      res.json(conversation);
    } catch (error) {
      logger.error(`Error getting conversation ${req.params.conversationId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/conversations:
   *   post:
   *     summary: Create a new conversation
   *     description: Creates a new chat conversation
   *     tags: [Chat History]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - title
   *             properties:
   *               title:
   *                 type: string
   *                 description: Title of the conversation
   *               categoryId:
   *                 type: string
   *                 description: ID of the service category
   *               initialMessage:
   *                 type: string
   *                 description: Initial message to include in the conversation
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Tags associated with the conversation
   *     responses:
   *       201:
   *         description: Conversation created successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  router.post('/conversations', async (req, res) => {
    try {
      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      const { title, categoryId, initialMessage, tags } = req.body;

      logger.info(`Creating new conversation for user ${numericUserId} with title "${title}"`);

      const conversationData = {
        userId: numericUserId,
        title: title || 'New Conversation',
        categoryId,
        tags: tags || [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        messageCount: initialMessage ? 1 : 0,
        isStarred: false,
        isArchived: false
      };

      const conversation = await chatHistoryService.createConversation(conversationData);

      if (initialMessage) {
        await chatHistoryService.addMessage({
          conversationId: conversation._key,
          content: initialMessage,
          sender: 'user',
          userId: numericUserId
        });
      }

      res.status(201).json(conversation);
    } catch (error) {
      logger.error(`Error creating conversation: ${error.message}`, { stack: error.stack });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/conversations/{conversationId}:
   *   patch:
   *     summary: Update conversation
   *     description: Updates conversation properties like title, starred status, etc.
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: conversationId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the conversation to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *                 description: New title for the conversation
   *               isStarred:
   *                 type: boolean
   *                 description: Star status
   *               isArchived:
   *                 type: boolean
   *                 description: Archive status
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Tags for the conversation
   *               categoryId:
   *                 type: string
   *                 description: ID of the service category
   *     responses:
   *       200:
   *         description: Conversation updated successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Conversation not found
   *       500:
   *         description: Server error
   */
  router.patch('/conversations/:conversationId', async (req, res) => {
    try {
      const { conversationId } = req.params;

      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      const updateData = { ...req.body, userId: numericUserId };

      logger.info(`Updating conversation ${conversationId} with data:`, updateData);

      const updatedConversation = await chatHistoryService.updateConversation(conversationId, updateData);
      res.json(updatedConversation);
    } catch (error) {
      logger.error(`Error updating conversation ${req.params.conversationId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/conversations/{conversationId}:
   *   delete:
   *     summary: Delete conversation
   *     description: Deletes a conversation and all associated messages
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: conversationId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the conversation to delete
   *     responses:
   *       200:
   *         description: Conversation deleted successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - user doesn't have permission to delete this conversation
   *       404:
   *         description: Conversation not found
   *       500:
   *         description: Server error
   */
  router.delete('/conversations/:conversationId', async (req, res) => {
    try {
      const { conversationId } = req.params;

      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      logger.info(`Deleting conversation ${conversationId} for user ${numericUserId}`);

      const result = await chatHistoryService.deleteConversation(conversationId, numericUserId);
      res.json(result);
    } catch (error) {
      logger.error(`Error deleting conversation ${req.params.conversationId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('permission')) {
        return res.status(403).json({ message: error.message });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/conversations/{conversationId}/messages:
   *   get:
   *     summary: Get conversation messages
   *     description: Retrieves messages for a specific conversation with pagination
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: conversationId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the conversation
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *         description: Maximum number of messages to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *         description: Number of records to skip for pagination
   *       - in: query
   *         name: newestFirst
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Sort messages with newest first
   *     responses:
   *       200:
   *         description: List of messages with pagination details
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Conversation not found
   *       500:
   *         description: Server error
   */
  router.get('/conversations/:conversationId/messages', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const newestFirst = req.query.newestFirst === 'true';

      logger.info(`Getting messages for conversation ${conversationId} with limit ${limit}, offset ${offset}, newestFirst ${newestFirst}`);

      const options = { limit, offset, newestFirst };
      const result = await chatHistoryService.getConversationMessages(conversationId, options);

      res.json(result);
    } catch (error) {
      logger.error(`Error getting messages for conversation ${req.params.conversationId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/conversations/{conversationId}/messages:
   *   post:
   *     summary: Add message to conversation
   *     description: Adds a new message to a conversation
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: conversationId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the conversation
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - content
   *               - sender
   *             properties:
   *               content:
   *                 type: string
   *                 description: Message content
   *               sender:
   *                 type: string
   *                 enum: [user, assistant]
   *                 description: Sender of the message
   *               queryId:
   *                 type: string
   *                 description: Optional ID of a related query (for assistant messages)
   *               metadata:
   *                 type: object
   *                 description: Additional metadata for the message
   *     responses:
   *       201:
   *         description: Message added successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Conversation not found
   *       500:
   *         description: Server error
   */
  router.post('/conversations/:conversationId/messages', async (req, res) => {
    try {
      const { conversationId } = req.params;
      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      logger.info(`Raw request body for conversation ${conversationId}:`, req.body ? JSON.stringify(req.body, null, 2) : 'No body');

      const { content, sender, queryId, metadata } = req.body || {};

      logger.info(`Adding ${sender || 'unknown'} message to conversation ${conversationId}`);
      logger.info('Parsed request body:', { content, sender, queryId, metadata });

      if (!req.body) {
        logger.warn('Request body is missing');
        return res.status(400).json({ message: 'Request body is required' });
      }

      if (!content) {
        logger.warn('Message content is missing');
        return res.status(400).json({ message: 'Message content is required' });
      }

      if (!sender || !['user', 'assistant'].includes(sender)) {
        logger.warn(`Invalid sender: ${sender}`);
        return res.status(400).json({ message: 'Sender must be either "user" or "assistant"' });
      }

      const messageData = {
        conversationId,
        content,
        sender,
        userId: numericUserId,
        timestamp: new Date().toISOString(),
        queryId,
        metadata: metadata || {}
      };

      const message = await chatHistoryService.addMessage(messageData);

      if (sender === 'assistant' && queryId) {
        try {
          await chatHistoryService.db.collection('queries').document(queryId);
          await chatHistoryService.linkQueryToConversation(
            queryId,
            conversationId,
            message._key,
            { responseType: 'primary' }
          );
        } catch (queryError) {
          logger.warn(`Skipping query linking due to invalid queryId ${queryId}: ${queryError.message}`, { stack: queryError.stack });
        }
      }

      res.status(201).json(message);
    } catch (error) {
      logger.error(`Error adding message to conversation ${req.params.conversationId}: ${error.message}`, { stack: error.stack });
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Conversation not found' });
      }
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/conversations/{conversationId}/messages/read:
   *   post:
   *     summary: Mark messages as read
   *     description: Marks all or specific messages in a conversation as read
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: conversationId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the conversation
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               messageIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Specific message IDs to mark as read (if empty, marks all messages)
   *     responses:
   *       200:
   *         description: Messages marked as read
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Conversation not found
   *       500:
   *         description: Server error
   */
  router.post('/conversations/:conversationId/messages/read', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { messageIds } = req.body;

      logger.info(`Marking messages as read in conversation ${conversationId}`);

      const result = await chatHistoryService.markMessagesAsRead(conversationId, messageIds);
      res.json(result);
    } catch (error) {
      logger.error(`Error marking messages as read in conversation ${req.params.conversationId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/query/{queryId}/messages:
   *   get:
   *     summary: Get messages for a query
   *     description: Retrieves all messages related to a specific query
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: queryId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the query
   *     responses:
   *       200:
   *         description: Messages related to the query
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Query not found
   *       500:
   *         description: Server error
   */
  router.get('/query/:queryId/messages', async (req, res) => {
    try {
      const { queryId } = req.params;

      logger.info(`Finding messages related to query ${queryId}`);

      const messages = await chatHistoryService.findMessagesForQuery(queryId);
      res.json(messages);
    } catch (error) {
      logger.error(`Error finding messages for query ${req.params.queryId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Query not found' });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/messages/{messageId}/query:
   *   get:
   *     summary: Get originating query for a message
   *     description: Retrieves the query that led to a specific message
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: messageId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the message
   *     responses:
   *       200:
   *         description: Query information
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: No originating query found
   *       500:
   *         description: Server error
   */
  router.get('/messages/:messageId/query', async (req, res) => {
    try {
      const { messageId } = req.params;

      logger.info(`Finding originating query for message ${messageId}`);

      const query = await chatHistoryService.findOriginatingQuery(messageId);

      if (!query) {
        return res.status(404).json({ message: 'No originating query found for this message' });
      }

      res.json(query);
    } catch (error) {
      logger.error(`Error finding originating query for message ${req.params.messageId}: ${error.message}`, { stack: error.stack });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/query/{queryId}/conversation:
   *   post:
   *     summary: Create conversation from query
   *     description: Creates a new conversation based on an existing query
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: queryId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the query
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *                 description: Optional title for the conversation
   *               responseText:
   *                 type: string
   *                 description: Optional response text to include
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Optional tags for the conversation
   *     responses:
   *       201:
   *         description: Conversation created successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Query not found
   *       500:
   *         description: Server error
   */
  router.post('/query/:queryId/conversation', async (req, res) => {
    try {
      const { queryId } = req.params;

      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      const { title, responseText, tags } = req.body;

      logger.info(`Creating conversation from query ${queryId} for user ${numericUserId}`);

      const result = await chatHistoryService.createConversationFromQuery(
        queryId,
        numericUserId,
        { title, responseText, tags }
      );

      res.status(201).json(result);
    } catch (error) {
      logger.error(`Error creating conversation from query ${req.params.queryId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Query not found' });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/search:
   *   get:
   *     summary: Search conversations
   *     description: Searches for conversations containing specific text
   *     tags: [Chat History]
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *         description: Search term
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Maximum number of results to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *         description: Number of results to skip for pagination
   *       - in: query
   *         name: includeArchived
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include archived conversations
   *     responses:
   *       200:
   *         description: Search results
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  router.get('/search', async (req, res) => {
    try {
      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      const searchTerm = req.query.q || '';
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;
      const includeArchived = req.query.includeArchived === 'true';

      if (!searchTerm) {
        return res.status(400).json({ message: 'Search term is required' });
      }

      logger.info(`Searching conversations for user ${numericUserId} with term "${searchTerm}"`);

      const options = { limit, offset, includeArchived };
      const results = await chatHistoryService.searchConversations(numericUserId, searchTerm, options);

      res.json(results);
    } catch (error) {
      logger.error(`Error searching conversations: ${error.message}`, { stack: error.stack });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/recent:
   *   get:
   *     summary: Get recent conversations
   *     description: Retrieves recent conversations for the user
   *     tags: [Chat History]
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 5
   *         description: Maximum number of conversations to return
   *     responses:
   *       200:
   *         description: Recent conversations
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  router.get('/recent', async (req, res) => {
    try {
      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      const limit = parseInt(req.query.limit) || 5;

      logger.info(`Getting ${limit} recent conversations for user ${numericUserId}`);

      const conversations = await chatHistoryService.getRecentConversations(numericUserId, limit);
      res.json(conversations);
    } catch (error) {
      logger.error(`Error getting recent conversations: ${error.message}`, { stack: error.stack });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/stats:
   *   get:
   *     summary: Get conversation statistics
   *     description: Retrieves statistics about the user's conversations
   *     tags: [Chat History]
   *     responses:
   *       200:
   *         description: Conversation statistics
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  router.get('/stats', async (req, res) => {
    try {
      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      logger.info(`Getting conversation statistics for user ${numericUserId}`);

      const stats = await chatHistoryService.getUserConversationStats(numericUserId);
      res.json(stats);
    } catch (error) {
      logger.error(`Error getting conversation statistics: ${error.message}`, { stack: error.stack });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/folders:
   *   get:
   *     summary: Get user folders
   *     description: Retrieves all folders for the authenticated user
   *     tags: [Chat History]
   *     parameters:
   *       - in: query
   *         name: includeArchived
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include archived folders
   *       - in: query
   *         name: parentFolderId
   *         schema:
   *           type: string
   *         description: ID of parent folder to get subfolders (omit for root folders)
   *     responses:
   *       200:
   *         description: List of folders
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  router.get('/folders', async (req, res) => {
    try {
      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const includeArchived = req.query.includeArchived === 'true';
      const parentFolderId = req.query.parentFolderId || null;

      logger.info(`Getting folders for user ${userId} with filters - includeArchived: ${includeArchived}, parentFolderId: ${parentFolderId || 'root'}`);

      const options = {
        includeArchived,
        parentFolderId
      };

      const folders = await chatHistoryService.getUserFolders(userId, options);
      res.json(folders);
    } catch (error) {
      logger.error(`Error getting user folders: ${error.message}`, { stack: error.stack });
      res.status(500).json({
        success: false,
        message: `Error getting user folders: ${error.message}`
      });
    }
  });

  /**
   * @swagger
   * /chat/folders:
   *   post:
   *     summary: Create a new folder
   *     description: Creates a new folder for organizing conversations
   *     tags: [Chat History]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *                 description: Name of the folder
   *               description:
   *                 type: string
   *                 description: Optional description of the folder
   *               parentFolderId:
   *                 type: string
   *                 description: Optional ID of parent folder
   *               color:
   *                 type: string
   *                 description: Optional color for the folder
   *               icon:
   *                 type: string
   *                 description: Optional icon for the folder
   *     responses:
   *       201:
   *         description: Folder created successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  router.post('/folders', async (req, res) => {
    try {
      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      const { name, description, parentFolderId, color, icon } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Folder name is required' });
      }

      logger.info(`Creating new folder for user ${numericUserId} with name "${name}"`);

      if (parentFolderId) {
        try {
          const parentFolder = await chatHistoryService.getFolder(parentFolderId);

          const ownerCheck = parentFolder.owners.some(owner => owner._key === numericUserId);
          if (!ownerCheck) {
            return res.status(403).json({
              message: 'You do not have permission to create subfolders in this folder'
            });
          }
        } catch (error) {
          return res.status(404).json({ message: 'Parent folder not found' });
        }
      }

      const existingFolders = await chatHistoryService.getUserFolders(numericUserId, {
        parentFolderId: parentFolderId
      });
      const order = existingFolders.length;

      const folderData = {
        userId: numericUserId,
        name,
        description: description || '',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        isArchived: false,
        color: color || '#808080',
        icon: icon || 'folder',
        parentFolderId: parentFolderId || null,
        order
      };

      const folder = await chatHistoryService.createFolder(folderData);
      res.status(201).json(folder);
    } catch (error) {
      logger.error(`Error creating folder: ${error.message}`, { stack: error.stack });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/folders/{folderId}:
   *   get:
   *     summary: Get folder details
   *     description: Retrieves a specific folder including its conversations
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: folderId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the folder to retrieve
   *     responses:
   *       200:
   *         description: Folder details with conversations
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Folder not found
   *       500:
   *         description: Server error
   */
  router.get('/folders/:folderId', async (req, res) => {
    try {
      const { folderId } = req.params;
      logger.info(`Getting folder ${folderId}`);

      const folder = await chatHistoryService.getFolder(folderId);

      if (!folder) {
        logger.warn(`Folder ${folderId} not found`);
        return res.status(404).json({ message: 'Folder not found' });
      }

      res.json(folder);
    } catch (error) {
      logger.error(`Error getting folder ${req.params.folderId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Folder not found' });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/folders/{folderId}:
   *   patch:
   *     summary: Update folder
   *     description: Updates folder properties
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: folderId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the folder to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 description: New name for the folder
   *               description:
   *                 type: string
   *                 description: New description for the folder
   *               isArchived:
   *                 type: boolean
   *                 description: Archive status
   *               color:
   *                 type: string
   *                 description: Color for the folder
   *               icon:
   *                 type: string
   *                 description: Icon for the folder
   *               parentFolderId:
   *                 type: string
   *                 description: ID of parent folder (null for root)
   *     responses:
   *       200:
   *         description: Folder updated successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Folder not found
   *       500:
   *         description: Server error
   */
  router.patch('/folders/:folderId', async (req, res) => {
    try {
      const { folderId } = req.params;

      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      const updateData = { ...req.body, userId: numericUserId };

      logger.info(`Updating folder ${folderId} with data:`, updateData);

      if (updateData.parentFolderId !== undefined) {
        if (updateData.parentFolderId === folderId) {
          return res.status(400).json({
            message: 'A folder cannot be its own parent'
          });
        }

        if (updateData.parentFolderId) {
          try {
            const parentFolder = await chatHistoryService.getFolder(updateData.parentFolderId);

            const folderPath = await chatHistoryService.getFolderPath(updateData.parentFolderId);
            if (folderPath.some(f => f._key === folderId)) {
              return res.status(400).json({
                message: 'Cannot move a folder to its own subfolder'
              });
            }
          } catch (error) {
            return res.status(404).json({ message: 'Target parent folder not found' });
          }
        }
      }

      const updatedFolder = await chatHistoryService.updateFolder(folderId, updateData);
      res.json(updatedFolder);
    } catch (error) {
      logger.error(`Error updating folder ${req.params.folderId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Folder not found' });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/folders/{folderId}:
   *   delete:
   *     summary: Delete folder
   *     description: Deletes a folder and optionally its contents
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: folderId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the folder to delete
   *       - in: query
   *         name: deleteContents
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to delete contained conversations and subfolders
   *     responses:
   *       200:
   *         description: Folder deleted successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - user doesn't have permission to delete this folder
   *       404:
   *         description: Folder not found
   *       500:
   *         description: Server error
   */
  router.delete('/folders/:folderId', async (req, res) => {
    try {
      const { folderId } = req.params;
      const deleteContents = req.query.deleteContents === 'true';

      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      logger.info(`Deleting folder ${folderId} for user ${numericUserId}, deleteContents: ${deleteContents}`);

      const result = await chatHistoryService.deleteFolder(folderId, numericUserId, deleteContents);
      res.json(result);
    } catch (error) {
      logger.error(`Error deleting folder ${req.params.folderId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('permission')) {
        return res.status(403).json({ message: error.message });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Folder not found' });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/folders/shared:
   *   get:
   *     summary: Get shared folders
   *     description: Retrieves folders that have been shared with the authenticated user
   *     tags: [Chat History]
   *     parameters:
   *       - in: query
   *         name: includeArchived
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include archived folders
   *     responses:
   *       200:
   *         description: List of shared folders
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  router.get('/folders/shared', async (req, res) => {
    try {
      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const includeArchived = req.query.includeArchived === 'true';

      logger.info(`Getting shared folders for user ${userId} with includeArchived: ${includeArchived}`);

      const options = {
        includeArchived
      };

      const folders = await chatHistoryService.getSharedFolders(userId, options);
      res.json(folders);
    } catch (error) {
      logger.error(`Error getting shared folders: ${error.message}`, { stack: error.stack });
      res.status(500).json({
        success: false,
        message: `Error getting shared folders: ${error.message}`
      });
    }
  });

  /**
   * @swagger
   * /chat/folders/search:
   *   get:
   *     summary: Search folders
   *     description: Searches for folders by name or description
   *     tags: [Chat History]
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *         description: Search term
   *       - in: query
   *         name: includeArchived
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include archived folders
   *     responses:
   *       200:
   *         description: Search results
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  router.get('/folders/search', async (req, res) => {
    try {
      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      const searchTerm = req.query.q || '';
      const includeArchived = req.query.includeArchived === 'true';

      if (!searchTerm) {
        return res.status(400).json({ message: 'Search term is required' });
      }

      logger.info(`Searching folders for user ${numericUserId} with term "${searchTerm}"`);

      const options = { includeArchived };
      const results = await chatHistoryService.searchFolders(numericUserId, searchTerm, options);

      res.json(results);
    } catch (error) {
      logger.error(`Error searching folders: ${error.message}`, { stack: error.stack });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/folders/reorder:
   *   post:
   *     summary: Reorder folders
   *     description: Updates the order of folders at the same level
   *     tags: [Chat History]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - folderOrders
   *             properties:
   *               folderOrders:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     folderId:
   *                       type: string
   *                     order:
   *                       type: integer
   *               parentFolderId:
   *                 type: string
   *                 description: Parent folder ID (null for root folders)
   *     responses:
   *       200:
   *         description: Folders reordered successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - user doesn't have permission
   *       400:
   *         description: Invalid request data
   *       500:
   *         description: Server error
   */
  router.post('/folders/reorder', async (req, res) => {
    try {
      const { folderOrders, parentFolderId } = req.body;

      if (!Array.isArray(folderOrders) || folderOrders.length === 0) {
        return res.status(400).json({ message: 'Invalid folder orders data' });
      }

      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      logger.info(`Reordering ${folderOrders.length} folders for user ${numericUserId} under parent ${parentFolderId || 'root'}`);

      const result = await chatHistoryService.reorderFolders(numericUserId, folderOrders, parentFolderId);
      res.json(result);
    } catch (error) {
      logger.error(`Error reordering folders: ${error.message}`, { stack: error.stack });

      if (error.message.includes('permission')) {
        return res.status(403).json({ message: error.message });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/folders/{folderId}/path:
   *   get:
   *     summary: Get folder path
   *     description: Retrieves the folder path (breadcrumbs)
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: folderId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the folder
   *     responses:
   *       200:
   *         description: Folder path
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Folder not found
   *       500:
   *         description: Server error
   */
  router.get('/folders/:folderId/path', async (req, res) => {
    try {
      const { folderId } = req.params;
      logger.info(`Getting path for folder ${folderId}`);

      const path = await chatHistoryService.getFolderPath(folderId);
      res.json(path);
    } catch (error) {
      logger.error(`Error getting path for folder ${req.params.folderId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Folder not found' });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/folders/{folderId}/conversations/{conversationId}:
   *   post:
   *     summary: Add conversation to folder
   *     description: Adds a conversation to a folder
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: folderId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the folder
   *       - in: path
   *         name: conversationId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the conversation to add
   *     responses:
   *       200:
   *         description: Conversation added to folder
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - user doesn't have permission
   *       404:
   *         description: Folder or conversation not found
   *       500:
   *         description: Server error
   */
  router.post('/folders/:folderId/conversations/:conversationId', async (req, res) => {
    try {
      const { folderId, conversationId } = req.params;

      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      logger.info(`Adding conversation ${conversationId} to folder ${folderId} by user ${numericUserId}`);

      const result = await chatHistoryService.addConversationToFolder(folderId, conversationId, numericUserId);
      res.json(result);
    } catch (error) {
      logger.error(`Error adding conversation to folder: ${error.message}`, { stack: error.stack });

      if (error.message.includes('permission')) {
        return res.status(403).json({ message: error.message });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Folder or conversation not found' });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/folders/{folderId}/conversations/{conversationId}:
   *   delete:
   *     summary: Remove conversation from folder
   *     description: Removes a conversation from a folder
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: folderId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the folder
   *       - in: path
   *         name: conversationId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the conversation to remove
   *     responses:
   *       200:
   *         description: Conversation removed from folder
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - user doesn't have permission
   *       404:
   *         description: Folder, conversation, or relationship not found
   *       500:
   *         description: Server error
   */
  router.delete('/folders/:folderId/conversations/:conversationId', async (req, res) => {
    try {
      const { folderId, conversationId } = req.params;

      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      logger.info(`Removing conversation ${conversationId} from folder ${folderId} by user ${numericUserId}`);

      const result = await chatHistoryService.removeConversationFromFolder(folderId, conversationId, numericUserId);
      res.json(result);
    } catch (error) {
      logger.error(`Error removing conversation from folder: ${error.message}`, { stack: error.stack });

      if (error.message.includes('permission')) {
        return res.status(403).json({ message: error.message });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/conversations/{conversationId}/folder:
   *   get:
   *     summary: Get conversation's folder
   *     description: Finds which folder a conversation belongs to
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: conversationId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the conversation
   *     responses:
   *       200:
   *         description: Folder information
   *       404:
   *         description: Conversation not found or not in any folder
   *       500:
   *         description: Server error
   */
  router.get('/conversations/:conversationId/folder', async (req, res) => {
    try {
      const { conversationId } = req.params;
      logger.info(`Finding folder for conversation ${conversationId}`);

      const folder = await chatHistoryService.findConversationFolder(conversationId);

      if (!folder) {
        return res.status(404).json({
          message: 'Conversation not found or not in any folder',
          inFolder: false
        });
      }

      res.json({
        folder,
        inFolder: true
      });
    } catch (error) {
      logger.error(`Error finding folder for conversation ${req.params.conversationId}: ${error.message}`, { stack: error.stack });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/conversations/{conversationId}/move:
   *   post:
   *     summary: Move conversation
   *     description: Moves a conversation from one folder to another
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: conversationId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the conversation to move
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               sourceFolderId:
   *                 type: string
   *                 description: Source folder ID (null for root)
   *               targetFolderId:
   *                 type: string
   *                 description: Target folder ID (null for root)
   *     responses:
   *       200:
   *         description: Conversation moved successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - user doesn't have permission
   *       404:
   *         description: Conversation, source, or target folder not found
   *       500:
   *         description: Server error
   */
  router.post('/conversations/:conversationId/move', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { sourceFolderId, targetFolderId } = req.body;

      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      logger.info(`Moving conversation ${conversationId} from folder ${sourceFolderId || 'root'} to ${targetFolderId || 'root'} by user ${numericUserId}`);

      const result = await chatHistoryService.moveConversation(conversationId, sourceFolderId, targetFolderId, numericUserId);
      res.json(result);
    } catch (error) {
      logger.error(`Error moving conversation ${req.params.conversationId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('permission')) {
        return res.status(403).json({ message: error.message });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/folders/{folderId}/share:
   *   post:
   *     summary: Share folder
   *     description: Shares a folder with another user
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: folderId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the folder to share
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - targetUserId
   *             properties:
   *               targetUserId:
   *                 type: string
   *                 description: ID of the user to share with
   *               role:
   *                 type: string
   *                 enum: [viewer, editor, contributor]
   *                 default: viewer
   *                 description: Permission role for the shared user
   *     responses:
   *       200:
   *         description: Folder shared successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - user doesn't have permission
   *       404:
   *         description: Folder or target user not found
   *       500:
   *         description: Server error
   */
  router.post('/folders/:folderId/share', async (req, res) => {
    try {
      const { folderId } = req.params;
      const { targetUserId, role } = req.body;

      if (!targetUserId) {
        return res.status(400).json({ message: 'Target user ID is required' });
      }

      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;
      const numericTargetUserId = targetUserId.startsWith('users/') ? targetUserId.substring(6) : targetUserId;

      if (numericUserId === numericTargetUserId) {
        return res.status(400).json({ message: 'Cannot share a folder with yourself' });
      }

      logger.info(`Sharing folder ${folderId} from user ${numericUserId} to user ${numericTargetUserId} with role ${role || 'viewer'}`);

      const result = await chatHistoryService.shareFolder(
        folderId,
        numericUserId,
        numericTargetUserId,
        role || 'viewer'
      );

      res.json(result);
    } catch (error) {
      logger.error(`Error sharing folder ${req.params.folderId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('permission') || error.message.includes('owner')) {
        return res.status(403).json({ message: error.message });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Folder or target user not found' });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/folders/{folderId}/share/{targetUserId}:
   *   delete:
   *     summary: Remove folder share
   *     description: Removes a user's access to a shared folder
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: folderId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the shared folder
   *       - in: path
   *         name: targetUserId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the user whose access to remove
   *     responses:
   *       200:
   *         description: Share removed successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - user doesn't have permission
   *       404:
   *         description: Folder or share not found
   *       500:
   *         description: Server error
   */
  router.delete('/folders/:folderId/share/:targetUserId', async (req, res) => {
    try {
      const { folderId, targetUserId } = req.params;

      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;
      const numericTargetUserId = targetUserId.startsWith('users/') ? targetUserId.substring(6) : targetUserId;

      logger.info(`Removing share for folder ${folderId} from user ${numericTargetUserId} by owner ${numericUserId}`);

      const result = await chatHistoryService.removeFolderShare(folderId, numericUserId, numericTargetUserId);
      res.json(result);
    } catch (error) {
      logger.error(`Error removing folder share ${req.params.folderId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('permission') || error.message.includes('owner')) {
        return res.status(403).json({ message: error.message });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /chat/folders/{folderId}/users:
   *   get:
   *     summary: Get folder users
   *     description: Retrieves users who have access to a folder
   *     tags: [Chat History]
   *     parameters:
   *       - in: path
   *         name: folderId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the folder
   *     responses:
   *       200:
   *         description: List of users with access to the folder
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - user doesn't have permission
   *       404:
   *         description: Folder not found
   *       500:
   *         description: Server error
   */
  router.get('/folders/:folderId/users', async (req, res) => {
    try {
      const { folderId } = req.params;

      let userId = extractUserId(req);

      if (!userId) {
        logger.warn('No userId available in request');
        return res.status(400).json({
          success: false,
          message: 'User ID is required but not found in request'
        });
      }

      const numericUserId = userId.startsWith('users/') ? userId.substring(6) : userId;

      logger.info(`Getting users with access to folder ${folderId} for user ${numericUserId}`);

      const users = await chatHistoryService.getFolderUsers(folderId, numericUserId);
      res.json(users);
    } catch (error) {
      logger.error(`Error getting users for folder ${req.params.folderId}: ${error.message}`, { stack: error.stack });

      if (error.message.includes('permission')) {
        return res.status(403).json({ message: error.message });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Folder not found' });
      }

      res.status(500).json({ message: error.message });
    }
  });

  /**
 * @swagger
 * /chat/conversations/{conversationId}/export:
 *   get:
 *     summary: Export conversation
 *     description: Exports a conversation in the specified format (PDF or JSON)
 *     tags: [Chat History]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the conversation to export
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [pdf, json]
 *           default: pdf
 *         description: Export format
 *     responses:
 *       200:
 *         description: Exported conversation data
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Invalid format specified
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Server error
 */
  router.get('/conversations/:conversationId/export', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const format = req.query.format || 'pdf';

      if (!['pdf', 'json'].includes(format)) {
        logger.warn(`Invalid export format: ${format}`);
        return res.status(400).json({ message: 'Invalid format. Use "pdf" or "json"' });
      }

      logger.info(`Exporting conversation ${conversationId} in ${format} format`);

      // Fetch the conversation and its messages
      const conversation = await chatHistoryService.getConversation(conversationId);
      if (!conversation) {
        logger.warn(`Conversation ${conversationId} not found`);
        return res.status(404).json({ message: 'Conversation not found' });
      }

      // Fetch messages (all messages, no pagination)
      const messagesResult = await chatHistoryService.getConversationMessages(conversationId, {
        limit: 1000, // Large limit to get all messages
        offset: 0,
        newestFirst: false
      });

      const messages = messagesResult.messages || [];

      if (format === 'json') {
        // Return JSON response
        res.setHeader('Content-Type', 'application/json');
        res.json({
          conversation: {
            _key: conversation._key,
            title: conversation.title,
            created: conversation.created,
            updated: conversation.updated,
            isStarred: conversation.isStarred,
            isArchived: conversation.isArchived,
            category: conversation.category,
            tags: conversation.tags
          },
          messages: messages.map(msg => ({
            _key: msg._key,
            content: msg.content,
            sender: msg.sender,
            timestamp: msg.timestamp,
            readStatus: msg.readStatus,
            metadata: msg.metadata
          }))
        });
      } else {
        // Generate PDF
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="conversation-${conversationId}.pdf"`);
        doc.pipe(res);

        // Add title
        doc.fontSize(20).text(`Conversation: ${conversation.title || 'Untitled'}`, { align: 'center' });
        doc.moveDown();

        // Add metadata
        doc.fontSize(12).text(`Created: ${new Date(conversation.created).toLocaleString()}`, { align: 'left' });
        doc.text(`Updated: ${new Date(conversation.updated).toLocaleString()}`, { align: 'left' });
        doc.text(`Category: ${conversation.category || 'None'}`, { align: 'left' });
        doc.text(`Tags: ${conversation.tags?.join(', ') || 'None'}`, { align: 'left' });
        doc.moveDown();

        // Add messages
        doc.fontSize(14).text('Messages:', { underline: true });
        doc.moveDown(0.5);

        messages.forEach((msg, index) => {
          doc.fontSize(12).text(
            `${index + 1}. ${msg.sender === 'user' ? 'User' : 'Assistant'} (${new Date(msg.timestamp).toLocaleString()}):`,
            { continued: true }
          );
          doc.fontSize(10).text(` ${msg.content}`, { indent: 20 });
          doc.moveDown(0.5);
        });

        doc.end();
      }
    } catch (error) {
      logger.error(`Error exporting conversation ${req.params.conversationId}: ${error.message}`, { stack: error.stack });
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Conversation not found' });
      }
      res.status(500).json({ message: 'Error exporting conversation' });
    }
  });

  return router;
};