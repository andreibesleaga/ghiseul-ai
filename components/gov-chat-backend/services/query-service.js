require('dotenv').config();
const axios = require('axios');
const { Database, aql } = require('arangojs');
const { v4: uuidv4 } = require('uuid');
const { logger, dbService } = require('../shared-lib');

class QueryService {
  constructor() {
    this.dbService = dbService; // Store the service reference instead of the promise
    this.db = null;
    this.queries = null;
    this.serviceCategories = null;
    this.services = null;
    this.analyticsService = null; // Will be set via dependency injection
    this.chatHistoryService = null; // Will be set via dependency injection
    this.initialized = false;
    logger.info('QueryService constructor called');
  }

  /**
   * Initialize the QueryService
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      logger.debug('QueryService already initialized, skipping');
      return;
    }
    try {
      this.db = await this.dbService.getConnection('default');
      this.queries = this.db.collection('queries');
      this.serviceCategories = this.db.collection('serviceCategories');
      this.services = this.db.collection('services');
      this.initialized = true;
      logger.info('QueryService initialized successfully');
    } catch (error) {
      logger.error(`Error initializing QueryService: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  /**
   * Set the analytics service
   * @param {Object} analyticsService - Analytics service instance
   */
  setAnalyticsService(analyticsService) {
    this.analyticsService = analyticsService;
    logger.info('QueryService.analytics_service_set');
  }

  /**
   * Set the chat history service
   * @param {Object} chatHistoryService - Chat history service instance
   */
  async setChatHistoryService(chatHistoryService) {
    this.chatHistoryService = chatHistoryService;
    logger.info('QueryService.chat_history_service_set');
  }

  /**
   * Generates a mock OPEA response for testing purposes.
   * @param {Object} queryData - The incoming query data.
   * @returns {Object} A mock response object { response, metadata }.
   */
  getMockOpeaResponse(queryData) {
    logger.info('[DEBUG] Generating mock OPEA response for test mode.');
    const { categoryLabel, serviceLabels } = queryData.context;
    const lastMessage = queryData.messages[queryData.messages.length - 1].content.toLowerCase();

    let response = `This is a general mock response. You asked about "${lastMessage}" within the context of "${categoryLabel}".`;
    let metadata = {
      source_documents: [],
      confidence_score: Math.random() * (0.98 - 0.85) + 0.85,
    };

    // Main theme response based on categoryLabel
    switch (categoryLabel) {
      case "Identity & Civil Registration":
        response = `This is a mock response regarding **Identity & Civil Registration**. This category covers services like applying for National IDs, passports, and birth certificates. What specific service do you need help with?`;
        break;
      case "Taxes & Revenue":
        response = `This is a mock response for **Taxes & Revenue**. You can get assistance with filing returns, paying taxes, or getting a tax compliance certificate. Please specify what you need.`;
        break;
      case "Business & Trade":
        response = `This is a mock response for **Business & Trade**. We can help with business registration, permits, and licenses. How can I assist you today?`;
        break;
      case "Healthcare & Social Services":
        response = `This is a mock response for **Healthcare & Social Services**. This includes finding hospitals, information on national health insurance, and other social programs.`;
        break;
      case "Education & Learning":
        response = `This is a mock response for **Education & Learning**. You can find information on public schools, higher education loans, and curriculum details here.`;
        break;
      case "Transportation & Mobility":
        response = `This is a mock response for **Transport & Licenses**. This covers driver's licenses, vehicle registration, and public transport information.`;
        break;
      case "Housing & Urban Development":
        response = `This is a mock response for **Housing & Urban Development**. Information about affordable housing programs, land rates, and building permits can be found here.`;
        break;
      case "Employment & Labor Services":
        response = `This is a mock response for **Employment & Labor Services**. We can provide information on job searching, labor laws, and workplace safety.`;
        break;
      case "General":
        response = `This is a general mock response as no specific category was selected. I can answer questions about a wide range of government services. What would you like to know?`;
        break;
    }

    // Add documents based on serviceLabels
    if (serviceLabels && serviceLabels.length > 0) {
      serviceLabels.forEach(label => {
        if (label.toLowerCase().includes('id')) {
          metadata.source_documents.push({
            document_id: `doc_id_${Math.floor(Math.random() * 1000)}`,
            url: "http://example.com/docs/id_application_form.pdf",
            text: "Official form for National ID card application.",
            categoryLabel: categoryLabel || "Identity & Civil Registration",
            serviceLabels: [label],
            score: 0.95
          });
        }
        if (label.toLowerCase().includes('birth registration')) {
          metadata.source_documents.push({
            document_id: `doc_birth_${Math.floor(Math.random() * 1000)}`,
            url: "http://example.com/docs/birth_registration_guide",
            text: "A step-by-step guide on registering a birth.",
            categoryLabel: categoryLabel || "Identity & Civil Registration",
            serviceLabels: [label],
            score: 0.98
          });
        }
        if (label.toLowerCase().includes('passport')) {
          metadata.source_documents.push({
            document_id: `doc_passport_${Math.floor(Math.random() * 1000)}`,
            url: "http://example.com/docs/passport_application_ecitizen",
            text: "Link to the e-Guvernare portal for passport applications.",
            categoryLabel: categoryLabel || "Identity & Civil Registration",
            serviceLabels: [label],
            score: 0.93
          });
        }
        if (label.toLowerCase().includes('tax')) {
          metadata.source_documents.push({
            document_id: `doc_tax_${Math.floor(Math.random() * 1000)}`,
            url: "http://example.com/docs/tax_payment_options",
            text: "Information on various methods to pay your taxes.",
            categoryLabel: categoryLabel || "Taxes & Revenue",
            serviceLabels: [label],
            score: 0.91
          });
        }
        if (label.toLowerCase().includes('business')) {
          metadata.source_documents.push({
            document_id: `doc_biz_${Math.floor(Math.random() * 1000)}`,
            url: "http://example.com/docs/business_registration_requirements",
            text: "Checklist of requirements for starting a new business.",
            categoryLabel: categoryLabel || "Business & Trade",
            serviceLabels: [label],
            score: 0.96
          });
        }
      });
    }

    // If no specific documents were added but we have labels, add a generic one.
    if (metadata.source_documents.length === 0 && serviceLabels && serviceLabels.length > 0) {
      metadata.source_documents.push({
        document_id: `doc_generic_${Math.floor(Math.random() * 1000)}`,
        url: "http://example.com/docs/general_info",
        text: `General information document related to your query about ${serviceLabels.join(', ')}.`,
        categoryLabel: categoryLabel || "General",
        serviceLabels: serviceLabels,
        score: 0.85
      });
    }

    return { response, metadata };
  }

  /**
 * Create a new query
 * @param {Object} queryData - Query data
 * @returns {Promise<Object>} The created query
 */
  async createQuery(queryData) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.create_query_start');
      logger.info(`[DEBUG] Received full request payload from frontend: ${JSON.stringify(queryData, null, 2)}`);

      const backendMode = process.env.CONTEXT_OPTION || 'single-message';
      logger.info(`[DEBUG] Backend is configured in "${backendMode}" mode.`);

      logger.info('[DEBUG] Starting validation of incoming data...');
      let missingFields = [];

      if (!queryData.userId) {
        logger.warn('[DEBUG] Validation FAILED: userId is missing.');
        missingFields.push('userId');
      } else {
        logger.info(`[DEBUG] Validation PASSED: userId is present (${queryData.userId}).`);
      }

      if (!queryData.sessionId) {
        logger.warn('[DEBUG] Validation FAILED: sessionId is missing.');
        missingFields.push('sessionId');
      } else {
        logger.info(`[DEBUG] Validation PASSED: sessionId is present (${queryData.sessionId}).`);
      }

      // --- FIX: START messages VALIDATION ---
      if (!Array.isArray(queryData.messages) || queryData.messages.length === 0) {
        // Fallback: Check for the legacy 'text' field
        if (queryData.text) {
          logger.warn('[DEBUG] Validation: messages array is missing. Synthesizing from legacy "text" field.');
          // Create the messages array from the text field
          queryData.messages = [{ role: 'user', content: queryData.text }];
          logger.info(`[DEBUG] Validation PASSED: messages array synthesized with 1 item.`);
        } else {
          // Only fail if BOTH messages and text are missing
          logger.warn('[DEBUG] Validation FAILED: messages array is missing or empty and no legacy "text" field found.');
          missingFields.push('messages');
        }
      } else {
        logger.info(`[DEBUG] Validation PASSED: messages array is present with ${queryData.messages.length} items.`);
      }
      // --- FIX: END messages VALIDATION ---


      // --- FIX: START context VALIDATION ---
      if (!queryData.context) {
        logger.warn('[DEBUG] Validation: context object is missing. Supplying default context.');
        // Create a default context object
        queryData.context = { categoryLabel: 'General', serviceLabels: [] };
        logger.info('[DEBUG] Validation PASSED: Default context object supplied.');
      } else {
        logger.info('[DEBUG] Validation PASSED: context object is present.');
        
        // Also validate the internals of the provided context
        if (!Array.isArray(queryData.context.serviceLabels)) {
          logger.warn('[DEBUG] Validation WARNING: context.serviceLabels is not an array. Defaulting to empty array.');
          queryData.context.serviceLabels = [];
        } else {
          logger.info(`[DEBUG] Validation PASSED: context.serviceLabels is present with labels: ${queryData.context.serviceLabels.join(', ')}.`);
        }
        
        if (!queryData.context.categoryLabel) {
           logger.warn('[DEBUG] Validation WARNING: context.categoryLabel is missing. Defaulting to "General".');
           queryData.context.categoryLabel = 'General';
        }
      }
      // --- FIX: END context VALIDATION ---


      if (missingFields.length > 0) {
        const errorMsg = `Missing required query data from frontend. Fields: ${missingFields.join(', ')}`;
        logger.error('QueryService.missing_required_data', { missingFields: missingFields.join(', ') });
        throw new Error(errorMsg);
      }
      logger.info('[DEBUG] All validations passed successfully.');

      // Derive text from the last message for backward compatibility and analytics
      const lastMessage = queryData.messages[queryData.messages.length - 1];
      const queryText = lastMessage ? lastMessage.content : '';
      if (!queryText) {
        logger.warn('No extractable text from messages; analytics may be affected.');
      }

      // Resolve categoryLabel to categoryId if not provided
      let categoryId = queryData.categoryId || null;
      if (queryData.context?.categoryLabel && !categoryId) {
        try {
          const categoryQuery = aql`
              FOR cat IN ${this.serviceCategories}
                FILTER cat.nameEN == ${queryData.context.categoryLabel}  // Changed to nameEN for schema match
                LIMIT 1
                RETURN cat._key
            `;
          const cursor = await this.db.query(categoryQuery);
          categoryId = await cursor.next();
          if (!categoryId) {
            logger.warn(`Category not found for label: ${queryData.context.categoryLabel}`);
          } else {
            logger.info(`Resolved categoryLabel "${queryData.context.categoryLabel}" to categoryId: ${categoryId}`);
          }
        } catch (error) {
          logger.error(`Error resolving categoryId: ${error.message}`, { stack: error.stack });
        }
      }

      // Optionally resolve serviceLabels to serviceIds (array)
      let serviceIds = queryData.serviceId ? [queryData.serviceId] : [];  // Preserve if provided (as single or array)
      if (queryData.context?.serviceLabels?.length > 0 && serviceIds.length === 0) {
        try {
          const servicesQuery = aql`
              FOR svc IN ${this.services}
                FILTER svc.nameEN IN ${queryData.context.serviceLabels}  // Changed to nameEN for schema match
                RETURN svc._key
            `;
          const cursor = await this.db.query(servicesQuery);
          serviceIds = await cursor.all();
          if (serviceIds.length === 0) {
            logger.warn(`No services found for labels: ${queryData.context.serviceLabels.join(', ')}`);
          } else {
            logger.info(`Resolved serviceLabels to serviceIds: ${serviceIds.join(', ')}`);
          }
        } catch (error) {
          logger.error(`Error resolving serviceIds: ${error.message}`, { stack: error.stack });
        }
      }

      const basicQueryDoc = {
        userId: queryData.userId,
        sessionId: queryData.sessionId,
        timestamp: queryData.timestamp || new Date().toISOString(),
        isAnswered: false, // Will be updated after response
        categoryId: categoryId,
        serviceId: serviceIds.length > 0 ? serviceIds : null, // Store as array or null
        responseTime: 0, // Will be updated after response
        contextOption: backendMode,
        messages: queryData.messages,
        context: queryData.context,
        text: queryText
      };

      logger.debug('QueryService.saving_query_document', { basicQueryDoc });
      const query = await this.queries.save(basicQueryDoc);
      const queryId = query._key;
      logger.info('QueryService.query_created', { queryId });

      let opeaResponseContent = null;
      let opeaMetadata = null;
      let opeaResponseTime = 0;
      const opeaStartTime = Date.now();

      // *** START: TEST MODE LOGIC ***
      if (backendMode === 'test-mode') {
        logger.info('[DEBUG] TEST MODE ACTIVATED. Bypassing OPEA call.');
        const mockData = this.getMockOpeaResponse(queryData);
        opeaResponseContent = mockData.response;
        opeaMetadata = mockData.metadata;
        opeaResponseTime = (Date.now() - opeaStartTime) + Math.floor(Math.random() * 200); // Simulate network delay

        logger.info(`[DEBUG] Mock response generated in ${opeaResponseTime}ms.`);
        logger.info(`[DEBUG] Mock Response Content: ${opeaResponseContent}`);
        logger.info(`[DEBUG] Mock Metadata: ${JSON.stringify(opeaMetadata, null, 2)}`);

        const updateData = {
          response: opeaResponseContent,
          responseTime: opeaResponseTime,
          isAnswered: true,
          metadata: opeaMetadata
        };
        await this.queries.update(queryId, updateData);

      } else {
        // *** EXISTING OPEA CALL LOGIC ***
        const opeaHost = process.env.OPEA_HOST || 'e2e-109-198';
        const opeaPort = process.env.OPEA_PORT || '8888';
        const opeaUrl = `http://${opeaHost}:${opeaPort}/v1/chatqna`;

        let opeaPayload;
        if (backendMode === 'single-message') {
          logger.info('[DEBUG] Backend mode is "single-message". Extracting last message for OPEA.');
          const lastMessage = queryData.messages[queryData.messages.length - 1];
          const queryText = lastMessage ? lastMessage.content : '';

          if (!queryText) {
            throw new Error('Could not extract last message content for single-message mode.');
          }

          opeaPayload = {
            messages: queryText,
            stream: false
          };
        } else {
          logger.info('[DEBUG] Backend mode is "conversation-with-labels". Formatting payload with full context.');
          opeaPayload = {
            messages: queryData.messages,
            context: {
              categoryLabel: queryData.context.categoryLabel,
              serviceLabels: queryData.context.serviceLabels
            },
            stream: false
          };
        }

        logger.info('[DEBUG] Sending request to OPEA...');
        logger.info(`[DEBUG] OPEA Payload: ${JSON.stringify(opeaPayload, null, 2)}`);

        const opeaResponse = await axios.post(opeaUrl, opeaPayload, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 seconds timeout
        });

        opeaResponseTime = Date.now() - opeaStartTime;
        opeaResponseContent = opeaResponse.data.response;
        opeaMetadata = opeaResponse.data.metadata;

        logger.info(`[DEBUG] OPEA response received in ${opeaResponseTime}ms.`);
        logger.info(`[DEBUG] OPEA Response Content: ${opeaResponseContent}`);
        logger.info(`[DEBUG] OPEA Metadata: ${JSON.stringify(opeaMetadata, null, 2)}`);

        const updateData = {
          response: opeaResponseContent,
          responseTime: opeaResponseTime,
          isAnswered: true,
          metadata: opeaMetadata
        };
        await this.queries.update(queryId, updateData);
      }

      // Record the query in analytics
      if (this.analyticsService) {
        await this.analyticsService.recordQuery(await this.queries.document(queryId));
      }

      const totalDuration = Date.now() - startTime;
      logger.info('QueryService.create_query_complete', {
        queryId,
        mode: backendMode,
        responseTime: opeaResponseTime,
        totalDuration
      });

      return {
        queryId,
        response: opeaResponseContent,
        metadata: opeaMetadata,
        responseTime: opeaResponseTime
      };

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      logger.error('QueryService.create_query_failed', {
        error: error.message,
        stack: error.stack,
        durationMs: totalDuration
      });
      throw error;
    }
  }

  /**
   * Add feedback to a query
   * @param {String} queryId - Query ID
   * @param {Object} feedback - Feedback data
   * @returns {Promise<Object>} The updated query
   */
  async addFeedback(queryId, feedback) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.add_feedback_start', { queryId });

      // Ensure feedback has required fields
      if (feedback.rating === undefined) {
        logger.warn('QueryService.feedback_rating_required', { queryId });
        throw new Error('Feedback rating is required');
      }

      // Prepare feedback object
      const userFeedback = {
        rating: feedback.rating,
        comment: feedback.comment || '',
        providedAt: new Date().toISOString()
      };

      // Update the query with feedback
      const updatedQuery = await this.queries.update(queryId, {
        userFeedback
      }, { returnNew: true });

      // Update analytics if service is set
      if (this.analyticsService) {
        try {
          await this.analyticsService.recordFeedback(queryId, userFeedback);
          logger.info('QueryService.analytics_feedback_updated', { queryId });
        } catch (error) {
          logger.error('QueryService.update_analytics_feedback_failed', {
            queryId,
            error: error.message
          });
          // Continue even if analytics update fails
        }
      }

      logger.info('QueryService.feedback_added', {
        queryId,
        durationMs: Date.now() - startTime
      });
      return updatedQuery.new;
    } catch (error) {
      logger.error('QueryService.add_feedback_failed', {
        queryId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Get a query by ID
   * @param {String} queryId - Query ID
   * @returns {Promise<Object>} The query
   */
  async getQuery(queryId) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.get_query_start', { queryId });
      const query = await this.queries.document(queryId);
      logger.info('QueryService.query_retrieved', {
        queryId,
        durationMs: Date.now() - startTime
      });
      return query;
    } catch (error) {
      logger.error('QueryService.get_query_failed', {
        queryId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Mark a query as answered
   * @param {String} queryId - Query ID
   * @param {Number} responseTime - Response time in milliseconds
   * @returns {Promise<Object>} The updated query
   */
  async markAsAnswered(queryId, responseTime = 0) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.mark_as_answered_start', { queryId, responseTime });
      const updatedQuery = await this.queries.update(queryId, {
        isAnswered: true,
        responseTime
      }, { returnNew: true });

      logger.info('QueryService.query_marked_answered', {
        queryId,
        durationMs: Date.now() - startTime
      });
      return updatedQuery.new;
    } catch (error) {
      logger.error('QueryService.mark_as_answered_failed', {
        queryId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Update the response time for a query
   * @param {String} queryId - Query ID
   * @param {Number} responseTime - Response time in milliseconds
   * @returns {Promise<Object>} The updated query
   */
  async updateQueryResponseTime(queryId, responseTime) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.update_query_response_time_start', { queryId, responseTime });

      // Validate responseTime
      if (typeof responseTime !== 'number' || responseTime < 0) {
        logger.warn('QueryService.invalid_response_time', { queryId, responseTime });
        throw new Error('Invalid response time');
      }

      // Update the query with response time
      const updatedQuery = await this.queries.update(queryId, {
        responseTime,
        updatedAt: new Date().toISOString()
      }, { returnNew: true });

      logger.info('QueryService.query_response_time_updated', {
        queryId,
        durationMs: Date.now() - startTime
      });
      return updatedQuery.new;
    } catch (error) {
      logger.error('QueryService.update_query_response_time_failed', {
        queryId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Set query category and service
   * @param {String} queryId - Query ID
   * @param {String} categoryId - Category ID
   * @param {String} serviceId - Service ID (optional)
   * @returns {Promise<Object>} The updated query
   */
  async setQueryCategory(queryId, categoryId, serviceId = null) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.set_query_category_start', { queryId, categoryId, serviceId });

      // Update the query with category and service
      const updateData = { categoryId };
      if (serviceId) {
        updateData.serviceId = serviceId;
      }

      const updatedQuery = await this.queries.update(queryId, updateData, { returnNew: true });

      // Update or create edge between query and category
      try {
        const edgeCursor = await this.db.query(aql`
          FOR edge IN queryCategories
            FILTER edge._from == ${'queries/' + queryId}
            RETURN edge
        `);

        const existingEdge = await edgeCursor.next();

        if (existingEdge) {
          logger.debug('QueryService.updating_query_category_edge', { queryId });
          await this.db.collection('queryCategories').update(existingEdge._key, {
            _to: `serviceCategories/${categoryId}`,
            updatedAt: new Date().toISOString()
          });
        } else {
          logger.debug('QueryService.creating_query_category_edge', { queryId });
          await this.db.collection('queryCategories').save({
            _from: `queries/${queryId}`,
            _to: `serviceCategories/${categoryId}`,
            createdAt: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.error('QueryService.update_query_category_edge_failed', {
          queryId,
          error: error.message
        });
        // Continue even if edge update fails
      }

      logger.info('QueryService.category_set', {
        queryId,
        durationMs: Date.now() - startTime
      });
      return updatedQuery.new;
    } catch (error) {
      logger.error('QueryService.set_query_category_failed', {
        queryId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Search for queries based on criteria
   * @param {Object} criteria - Search criteria
   * @param {Number} limit - Maximum number of results (default: 20)
   * @param {Number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} Search results
   */
  async searchQueries(criteria, limit = 20, offset = 0) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.search_queries_start', { criteria, limit, offset });

      let filterConditions = [];

      if (criteria.userId) {
        filterConditions.push(aql`q.userId == ${criteria.userId}`);
      }

      if (criteria.sessionId) {
        filterConditions.push(aql`q.sessionId == ${criteria.sessionId}`);
      }

      if (criteria.text) {
        filterConditions.push(aql`LOWER(q.text) LIKE CONCAT("%", LOWER(${criteria.text}), "%")`);
      }

      if (criteria.categoryId) {
        filterConditions.push(aql`q.categoryId == ${criteria.categoryId}`);
      }

      if (criteria.serviceId) {
        filterConditions.push(aql`q.serviceId == ${criteria.serviceId}`);
      }

      if (criteria.isAnswered !== undefined) {
        filterConditions.push(aql`q.isAnswered == ${criteria.isAnswered}`);
      }

      if (criteria.startDate) {
        filterConditions.push(aql`q.timestamp >= ${criteria.startDate}`);
      }

      if (criteria.endDate) {
        filterConditions.push(aql`q.timestamp <= ${criteria.endDate}`);
      }

      if (criteria.hasFeedback !== undefined) {
        if (criteria.hasFeedback) {
          filterConditions.push(aql`q.userFeedback != null`);
        } else {
          filterConditions.push(aql`q.userFeedback == null`);
        }
      }

      if (criteria.minRating !== undefined) {
        filterConditions.push(aql`q.userFeedback.rating >= ${criteria.minRating}`);
      }

      if (criteria.maxRating !== undefined) {
        filterConditions.push(aql`q.userFeedback.rating <= ${criteria.maxRating}`);
      }

      if (criteria.tags && criteria.tags.length > 0) {
        filterConditions.push(aql`
          LENGTH(
            FOR tag IN ${criteria.tags}
              FILTER tag IN q.metadata.tags
              RETURN tag
          ) == LENGTH(${criteria.tags})
        `);
      }

      let filterQuery;
      if (filterConditions.length > 0) {
        filterQuery = aql`FILTER `;
        for (let i = 0; i < filterConditions.length; i++) {
          if (i > 0) {
            filterQuery = aql`${filterQuery} AND `;
          }
          filterQuery = aql`${filterQuery} ${filterConditions[i]}`;
        }
      } else {
        filterQuery = aql``;
      }

      const query = aql`
        FOR q IN queries
          ${filterQuery}
          SORT q.timestamp DESC
          LIMIT ${offset}, ${limit}
          RETURN q
      `;

      const cursor = await this.db.query(query);
      const queries = await cursor.all();

      const countQuery = aql`
        FOR q IN queries
          ${filterQuery}
          COLLECT WITH COUNT INTO total
          RETURN total
      `;
      const countCursor = await this.db.query(countQuery);
      const totalCount = await countCursor.next() || 0;

      logger.info('QueryService.search_queries_completed', {
        resultCount: queries.length,
        totalCount,
        durationMs: Date.now() - startTime
      });
      return {
        queries,
        pagination: {
          total: totalCount,
          limit,
          offset,
          pages: Math.ceil(totalCount / limit),
          currentPage: Math.floor(offset / limit) + 1
        }
      };
    } catch (error) {
      logger.error('QueryService.search_queries_failed', {
        criteria,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Delete a query
   * @param {String} queryId - Query ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteQuery(queryId) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.delete_query_start', { queryId });

      // Delete edges connected to the query
      try {
        await this.db.query(aql`
          FOR edge IN sessionQueries
            FILTER edge._to == ${'queries/' + queryId}
            REMOVE edge IN sessionQueries
        `);

        await this.db.query(aql`
          FOR edge IN queryCategories
            FILTER edge._from == ${'queries/' + queryId}
            REMOVE edge IN queryCategories
        `);
        logger.info('QueryService.edges_deleted', { queryId });
      } catch (error) {
        logger.error('QueryService.delete_edges_failed', {
          queryId,
          error: error.message
        });
        // Continue even if edge deletion fails
      }

      const result = await this.queries.remove(queryId);
      logger.info('QueryService.query_deleted', {
        queryId,
        durationMs: Date.now() - startTime
      });
      return result;
    } catch (error) {
      logger.error('QueryService.delete_query_failed', {
        queryId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Get similar queries
   * @param {String} queryText - Query text to find similar queries
   * @param {Number} limit - Maximum number of similar queries to return
   * @returns {Promise<Array>} Similar queries
   */
  async getSimilarQueries(queryText, limit = 5) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.get_similar_queries_start', { queryText });

      const lowerQueryText = queryText.toLowerCase();
      const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by'];
      const words = lowerQueryText.split(/\s+/).filter(word =>
        word.length > 2 && !stopWords.includes(word)
      );

      if (words.length === 0) {
        logger.info('QueryService.no_significant_words', { queryText });
        return [];
      }

      const similarQueriesQuery = aql`
        FOR q IN queries
          LET score = (
            FOR word IN ${words}
              FILTER LOWER(q.text) LIKE CONCAT("%", word, "%")
              RETURN 1
          )
          FILTER LENGTH(score) > 0
          SORT LENGTH(score) DESC, q.timestamp DESC
          LIMIT ${limit}
          RETURN q
      `;

      const cursor = await this.db.query(similarQueriesQuery);
      const similarQueries = await cursor.all();
      logger.info('QueryService.similar_queries_found', {
        count: similarQueries.length,
        durationMs: Date.now() - startTime
      });
      return similarQueries;
    } catch (error) {
      logger.error('QueryService.get_similar_queries_failed', {
        queryText,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      return [];
    }
  }

  /**
   * Save a query with its criteria for future recall
   * @param {Object} queryData - Query data with criteria
   * @returns {Promise<Object>} The saved query
   */
  async saveQueryWithCriteria(queryData) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.save_query_with_criteria_start', { dataLength: JSON.stringify(queryData).length });

      if (!queryData.userId || !queryData.text) {
        logger.warn('QueryService.missing_required_data', { queryData });
        throw new Error('Missing required query data');
      }

      const basicQueryDoc = {
        userId: queryData.userId,
        text: queryData.text,
        timestamp: queryData.timestamp || new Date().toISOString()
      };

      if (queryData.categoryId) basicQueryDoc.categoryId = queryData.categoryId;
      if (queryData.serviceId) basicQueryDoc.serviceId = queryData.serviceId;

      basicQueryDoc.metadata = {
        criteria: queryData.criteria || '',
        tags: Array.isArray(queryData.tags) ? queryData.tags : [],
        isSaved: true,
        name: queryData.name || `Query ${new Date().toISOString()}`,
        description: queryData.description || ''
      };

      logger.debug('QueryService.saving_query_with_criteria', { basicQueryDoc });
      const query = await this.queries.save(basicQueryDoc);
      logger.info('QueryService.query_saved', {
        queryId: query._key,
        durationMs: Date.now() - startTime
      });

      return query;
    } catch (error) {
      logger.error('QueryService.save_query_with_criteria_failed', {
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Get saved queries for a user
   * @param {String} userId - User ID
   * @param {Number} limit - Maximum number of queries to return
   * @param {Number} offset - Offset for pagination
   * @returns {Promise<Object>} Saved queries with pagination
   */
  async getSavedQueries(userId, limit = 20, offset = 0) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.get_saved_queries_start', { userId });

      const query = aql`
        FOR q IN queries
          FILTER q.userId == ${userId}
          FILTER q.metadata.isSaved == true
          SORT q.timestamp DESC
          LIMIT ${offset}, ${limit}
          RETURN q
      `;

      const cursor = await this.db.query(query);
      const queries = await cursor.all();

      const countQuery = aql`
        FOR q IN queries
          FILTER q.userId == ${userId}
          FILTER q.metadata.isSaved == true
          COLLECT WITH COUNT INTO total
          RETURN total
      `;
      const countCursor = await this.db.query(countQuery);
      const totalCount = await countCursor.next() || 0;

      logger.info('QueryService.saved_queries_retrieved', {
        userId,
        count: queries.length,
        totalCount,
        durationMs: Date.now() - startTime
      });
      return {
        queries,
        pagination: {
          total: totalCount,
          limit,
          offset,
          pages: Math.ceil(totalCount / limit),
          currentPage: Math.floor(offset / limit) + 1
        }
      };
    } catch (error) {
      logger.error('QueryService.get_saved_queries_failed', {
        userId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Get query recommendations based on user history
   * @param {String} userId - User ID
   * @param {Number} limit - Maximum number of recommendations
   * @returns {Promise<Array>} Recommended queries
   */
  async getQueryRecommendations(userId, limit = 5) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.get_query_recommendations_start', { userId });

      const recentQueriesQuery = aql`
        FOR q IN queries
          FILTER q.userId == ${userId}
          SORT q.timestamp DESC
          LIMIT 10
          RETURN q
      `;

      const recentQueriesCursor = await this.db.query(recentQueriesQuery);
      const recentQueries = await recentQueriesCursor.all();

      if (recentQueries.length === 0) {
        logger.info('QueryService.no_recent_queries', { userId });
        const popularQueries = await this.getPopularQueries(limit);
        return popularQueries.map(q => q.text);
      }

      const categories = recentQueries
        .filter(q => q.categoryId)
        .map(q => q.categoryId);

      const services = recentQueries
        .filter(q => q.serviceId)
        .map(q => q.serviceId);

      if (categories.length === 0 && services.length === 0) {
        logger.info('QueryService.no_categories_or_services', { userId });
        const popularQueries = await this.getPopularQueries(limit);
        return popularQueries.map(q => q.text);
      }

      const recommendationsQuery = aql`
        LET categorySimilar = (
          FOR q IN queries
            FILTER q.userId != ${userId}
            FILTER q.categoryId IN ${categories}
            SORT q.timestamp DESC
            LIMIT ${limit * 2}
            RETURN DISTINCT q.text
        )
        
        LET serviceSimilar = (
          FOR q IN queries
            FILTER q.userId != ${userId}
            FILTER q.serviceId IN ${services}
            SORT q.timestamp DESC
            LIMIT ${limit * 2}
            RETURN DISTINCT q.text
        )
        
        LET combined = UNION(categorySimilar, serviceSimilar)
        
        FOR text IN combined
          SORT RAND()
          LIMIT ${limit}
          RETURN text
      `;

      const recommendationsCursor = await this.db.query(recommendationsQuery);
      const recommendations = await recommendationsCursor.all();

      if (recommendations.length < limit) {
        logger.info('QueryService.insufficient_recommendations', {
          count: recommendations.length,
          limit
        });
        const popularQueries = await this.getPopularQueries(limit - recommendations.length);
        return [...recommendations, ...popularQueries.map(q => q.text)];
      }

      logger.info('QueryService.query_recommendations_found', {
        userId,
        count: recommendations.length,
        durationMs: Date.now() - startTime
      });
      return recommendations;
    } catch (error) {
      logger.error('QueryService.get_query_recommendations_failed', {
        userId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      return await this.getPopularQueries(limit).then(queries => queries.map(q => q.text));
    }
  }

  /**
   * Get popular queries
   * @param {Number} limit - Maximum number of queries to return
   * @returns {Promise<Array>} Popular queries
   */
  async getPopularQueries(limit = 5) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.get_popular_queries_start');
      const query = aql`
        FOR q IN queries
          COLLECT text = q.text WITH COUNT INTO count
          SORT count DESC
          LIMIT ${limit}
          RETURN { text, count }
      `;

      const cursor = await this.db.query(query);
      const popularQueries = await cursor.all();
      logger.info('QueryService.popular_queries_found', {
        count: popularQueries.length,
        durationMs: Date.now() - startTime
      });
      return popularQueries;
    } catch (error) {
      logger.error('QueryService.get_popular_queries_failed', {
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      return [];
    }
  }

  /**
   * Create a conversation from a query
   * @param {String} queryId - Query ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created conversation data
   */
  async createConversationFromQuery(queryId, options = {}) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.create_conversation_from_query_start', { queryId });

      if (!this.chatHistoryService) {
        logger.error('QueryService.chat_history_service_not_set');
        throw new Error('Chat history service is not set');
      }

      const query = await this.getQuery(queryId);

      if (!query) {
        logger.warn('QueryService.query_not_found', { queryId });
        throw new Error('Query not found');
      }

      const conversation = await this.chatHistoryService.createConversationFromQuery(
        queryId,
        query.userId,
        {
          title: options.title || query.text,
          responseText: options.responseText,
          tags: options.tags || []
        }
      );

      logger.info('QueryService.conversation_created', {
        queryId,
        conversationId: conversation.conversation._key,
        durationMs: Date.now() - startTime
      });
      return conversation;
    } catch (error) {
      logger.error('QueryService.create_conversation_from_query_failed', {
        queryId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Get conversations for a query
   * @param {String} queryId - Query ID
   * @returns {Promise<Array>} Conversations associated with the query
   */
  async getConversationsForQuery(queryId) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.get_conversations_for_query_start', { queryId });

      if (!this.chatHistoryService) {
        logger.error('QueryService.chat_history_service_not_set');
        throw new Error('Chat history service is not set');
      }

      const relatedMessages = await this.chatHistoryService.findMessagesForQuery(queryId);

      const conversationMap = new Map();
      for (const item of relatedMessages) {
        if (item.conversation && !conversationMap.has(item.conversation._key)) {
          conversationMap.set(item.conversation._key, {
            conversation: item.conversation,
            messages: []
          });
        }

        if (item.message) {
          const conversation = conversationMap.get(item.conversation._key);
          if (conversation) {
            conversation.messages.push(item.message);
          }
        }
      }

      const conversations = Array.from(conversationMap.values());
      logger.info('QueryService.conversations_found', {
        queryId,
        count: conversations.length,
        durationMs: Date.now() - startTime
      });
      return conversations;
    } catch (error) {
      logger.error('QueryService.get_conversations_for_query_failed', {
        queryId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
 * Mark a query as answered
 * @param {String} queryId - Query ID
 * @param {Number} responseTime - Response time in milliseconds
 * @returns {Promise<Object>} Updated query
 */
  async markQueryAsAnswered(queryId, responseTime) {
    const startTime = Date.now();
    try {
      if (!queryId || queryId === 'undefined') {
        logger.warn('QueryService.mark_query_as_answered_invalid_id', { queryId });
        throw new Error('Invalid query ID provided');
      }

      logger.info('QueryService.mark_query_as_answered_start', { queryId, responseTime });

      const updateData = {
        isAnswered: true,
        responseTime,
        updatedAt: new Date().toISOString()
      };

      const updatedQuery = await this.queries.update(queryId, updateData);

      logger.info('QueryService.query_marked_as_answered', {
        queryId,
        responseTime,
        durationMs: Date.now() - startTime
      });

      return updatedQuery;
    } catch (error) {
      logger.error('QueryService.mark_query_as_answered_failed', {
        queryId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });

      if (error.name === 'ArangoError' && error.errorNum === 1202) {
        throw new Error('Query not found');
      }

      throw error;
    }
  }

  /**
   * Link query to an existing conversation message
   * @param {String} queryId - Query ID
   * @param {String} messageId - Message ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Link details
   */
  async linkQueryToMessage(queryId, messageId, options = {}) {
    const startTime = Date.now();
    try {
      logger.info('QueryService.link_query_to_message_start', { queryId, messageId });

      if (!this.chatHistoryService) {
        logger.error('QueryService.chat_history_service_not_set');
        throw new Error('Chat history service is not set');
      }

      const messageCursor = await this.db.query(`
      FOR msg IN messages
        FILTER msg._key == @messageId
        RETURN {
          _key: msg._key,
          conversationId: msg.conversationId
        }
    `, { messageId });

      const message = await messageCursor.next();

      if (!message) {
        logger.warn('QueryService.message_not_found', { messageId });
        throw new Error('Message not found');
      }

      const link = await this.chatHistoryService.linkQueryToConversation(
        queryId,
        message.conversationId,
        messageId,
        {
          responseType: options.responseType || 'primary',
          confidenceScore: options.confidenceScore || 1.0
        }
      );

      logger.info('QueryService.query_linked_to_message', {
        queryId,
        messageId,
        conversationId: message.conversationId,
        durationMs: Date.now() - startTime
      });
      return link;
    } catch (error) {
      logger.error('QueryService.link_query_to_message_failed', {
        queryId,
        messageId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }
}

// Singleton instance
const instance = new QueryService();
module.exports = instance;