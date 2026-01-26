const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const { logger } = require('../shared-lib');
const authMiddleware = require('../middleware/auth-middleware');

module.exports = (analyticsService) => {
  try {
    if (!analyticsService || typeof analyticsService.getDashboardAnalytics !== 'function') {
      throw new Error('analyticsService is invalid or missing getDashboardAnalytics');
    }
    logger.debug('analytics-routes initialized with analyticsService', {
      methods: Object.getOwnPropertyNames(Object.getPrototypeOf(analyticsService)).filter(m => m !== 'constructor')
    });

    // Instantiate controller with singleton analyticsService
    const analyticsController = new AnalyticsController(analyticsService);

    router.use(authMiddleware.authenticate);

    /**
     * @swagger
     * /analytics/dashboard:
     *   get:
     *     summary: Get dashboard analytics
     *     description: Retrieves analytics data for the dashboard within a date range
     *     tags: [Analytics]
     *     parameters:
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *         description: Start date (YYYY-MM-DD)
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date-time
     *         description: End date (ISO format)
     *       - in: query
     *         name: locale
     *         schema:
     *           type: string
     *           enum: [en, fr, sw]
     *           default: en
     *         description: Language locale for category names
     *     responses:
     *       200:
     *         description: Dashboard analytics data
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 queries:
     *                   type: object
     *                   properties:
     *                     total:
     *                       type: integer
     *                     unanswered:
     *                       type: integer
     *                     answeredPercentage:
     *                       type: number
     *                     avgResponseTime:
     *                       type: number
     *                 categories:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       categoryId:
     *                         type: string
     *                       name:
     *                         type: string
     *                       count:
     *                         type: integer
     *                 feedback:
     *                   type: object
     *                   properties:
     *                     total:
     *                       type: integer
     *                     positive:
     *                       type: integer
     *                     neutral:
     *                       type: integer
     *                     negative:
     *                       type: integer
     *                     positivePercentage:
     *                       type: number
     *                     negativePercentage:
     *                       type: number
     *                 users:
     *                   type: object
     *                   properties:
     *                     activeCount:
     *                       type: integer
     *                 topQueries:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       text:
     *                         type: string
     *                       count:
     *                         type: integer
     *                       avgTime:
     *                         type: number
     *       500:
     *         description: Server error
     */
    router.get('/dashboard', async (req, res) => {
      try {
        const startDate = req.query.startDate || new Date().toISOString().split('T')[0];
        const endDate = req.query.endDate || new Date().toISOString();
        const locale = req.query.locale || 'en';
        
        logger.info(`Getting dashboard analytics from ${startDate} to ${endDate} with locale ${locale}`);
        const analytics = await analyticsService.getDashboardAnalytics(startDate, endDate, locale);
        
        res.json(analytics);
      } catch (error) {
        logger.error(`Error getting dashboard analytics: ${error.message}`, { stack: error.stack });
        res.status(500).json({ message: error.message });
      }
    });

    /**
     * @swagger
     * /analytics/metric/{metric}:
     *   get:
     *     summary: Get specific metric data
     *     description: Retrieves data for a specific analytics metric
     *     tags: [Analytics]
     *     parameters:
     *       - in: path
     *         name: metric
     *         schema:
     *           type: string
     *           enum: [totalQueries, uniqueUsers, averageResponseTime, satisfactionRate]
     *         required: true
     *         description: Metric name
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date-time
     *         required: true
     *         description: Start date (ISO format)
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date-time
     *         required: true
     *         description: End date (ISO format)
     *     responses:
     *       200:
     *         description: Metric data
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 metric:
     *                   type: string
     *                 value:
     *                   type: number
     *       400:
     *         description: Bad request
     *       500:
     *         description: Server error
     */
    router.get('/metric/:metric', (req, res) => {
      logger.info(`Fetching metric: ${req.params.metric} from ${req.query.startDate} to ${req.query.endDate}`);
      analyticsController.getMetric(req, res);
    });

    /**
     * @swagger
     * /analytics:
     *   get:
     *     summary: Get general analytics
     *     description: Retrieves general analytics data with optional filters and date range
     *     tags: [Analytics]
     *     parameters:
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date-time
     *         description: Start date (ISO format)
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date-time
     *         description: End date (ISO format)
     *       - in: query
     *         name: filters
     *         schema:
     *           type: string
     *         description: JSON string of filter criteria
     *       - in: query
     *         name: locale
     *         schema:
     *           type: string
     *           enum: [en, fr, sw]
     *           default: en
     *         description: Language locale for category names
     *     responses:
     *       200:
     *         description: General analytics data
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 queryCount:
     *                   type: integer
     *                 feedbackCount:
     *                   type: integer
     *                 avgRating:
     *                   type: number
     *                 timeDistribution:
     *                   type: object
     *                 categoryDistribution:
     *                   type: object
     *                 raw:
     *                   type: array
     *                   items:
     *                     type: object
     *       500:
     *         description: Server error
     */
    router.get('/', async (req, res) => {
      try {
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const filters = req.query.filters ? JSON.parse(req.query.filters) : {};
        const locale = req.query.locale || 'en';
        
        logger.info(`Getting analytics from ${startDate || 'unspecified'} to ${endDate || 'unspecified'} with filters: ${JSON.stringify(filters)} and locale: ${locale}`);
        const analytics = await analyticsService.getAnalytics(filters, startDate, endDate);
        
        res.json(analytics);
      } catch (error) {
        logger.error(`Error getting analytics: ${error.message}`, { stack: error.stack });
        res.status(500).json({ message: error.message });
      }
    });

    /**
     * @swagger
     * /analytics/timeseries/{metricType}:
     *   get:
     *     summary: Get time series data
     *     description: Retrieves time series data for a specific metric, interval, and date range
     *     tags: [Analytics]
     *     parameters:
     *       - in: path
     *         name: metricType
     *         required: true
     *         schema:
     *           type: string
     *           enum: [queries, users]
     *         description: Metric type name (e.g., queries, users)
     *       - in: query
     *         name: interval
     *         schema:
     *           type: string
     *           enum: [hourly, daily, weekly, monthly]
     *           default: daily
     *         description: Time interval for grouping
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date-time
     *         description: Start date (ISO format)
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date-time
     *         description: End date (ISO format)
     *     responses:
     *       200:
     *         description: Time series data
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   timestamp:
     *                     type: string
     *                     format: date-time
     *                   value:
     *                     type: number
     *       400:
     *         description: Bad request
     *       500:
     *         description: Server error
     */
    router.get('/timeseries/:metricType', (req, res) => {
      logger.info(`Fetching time series data for metricType: ${req.params.metricType}, interval: ${req.query.interval || 'daily'}, from ${req.query.startDate} to ${req.query.endDate}`);
      analyticsController.getTimeSeriesData(req, res);
    });

    /**
     * @swagger
     * /analytics/events:
     *   post:
     *     summary: Track an event
     *     description: Records a user event for analytics
     *     tags: [Analytics]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - userId
     *               - eventType
     *             properties:
     *               userId:
     *                 type: string
     *                 description: ID of the user
     *               eventType:
     *                 type: string
     *                 description: Type of event (e.g., pageView, buttonClick)
     *               eventData:
     *                 type: object
     *                 description: Additional event data
     *     responses:
     *       201:
     *         description: Event tracked successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Event'
     *       400:
     *         description: Missing required fields
     *       500:
     *         description: Server error
     */
    router.post('/events', async (req, res) => {
      try {
        const { userId, eventType, eventData } = req.body;
        
        if (!userId || !eventType) {
          logger.warn(`Missing required fields in event tracking: userId=${userId}, eventType=${eventType}`);
          return res.status(400).json({ message: 'userId and eventType are required' });
        }
        
        logger.info(`Recording event of type ${eventType} for user ${userId}`);
        const result = await analyticsService.trackEvent(userId, eventType, eventData || {});
        res.status(201).json(result);
      } catch (error) {
        logger.error(`Error recording event: ${error.message}`, { stack: error.stack });
        res.status(500).json({ message: error.message });
      }
    });

    /**
     * @swagger
     * /analytics/records:
     *   get:
     *     summary: Get analytics records
     *     description: Retrieves analytics records with pagination
     *     tags: [Analytics]
     *     parameters:
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
     *     responses:
     *       200:
     *         description: Analytics records
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Analytics'
     *       500:
     *         description: Server error
     */
    router.get('/records', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        logger.info(`Getting analytics records with limit ${limit} and offset ${offset}`);
        
        const cursor = await analyticsService.db.query(`
          FOR a IN analytics
            SORT a.timestamp DESC
            LIMIT ${offset}, ${limit}
            RETURN a
        `);
        
        const records = await cursor.all();
        res.json(records);
      } catch (error) {
        logger.error(`Error retrieving analytics records: ${error.message}`, { stack: error.stack });
        res.status(500).json({ message: error.message });
      }
    });

    /**
     * @swagger
     * /analytics/events:
     *   get:
     *     summary: Get events records
     *     description: Retrieves event records with pagination
     *     tags: [Analytics]
     *     parameters:
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
     *     responses:
     *       200:
     *         description: Event records
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Event'
     *       500:
     *         description: Server error
     */
    router.get('/events', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        logger.info(`Getting event records with limit ${limit} and offset ${offset}`);
        
        const cursor = await analyticsService.db.query(`
          FOR e IN events
            SORT e.timestamp DESC
            LIMIT ${offset}, ${limit}
            RETURN e
        `);
        
        const events = await cursor.all();
        res.json(events);
      } catch (error) {
        logger.error(`Error retrieving events records: ${error.message}`, { stack: error.stack });
        res.status(500).json({ message: error.message });
      }
    });

    /**
     * @swagger
     * /analytics/satisfaction/gauge:
     *   get:
     *     summary: Get satisfaction gauge data
     *     description: Retrieves satisfaction percentage data for the gauge visualization
     *     tags: [Analytics]
     *     parameters:
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date-time
     *         description: Start date (ISO format)
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date-time
     *         description: End date (ISO format)
     *       - in: query
     *         name: locale
     *         schema:
     *           type: string
     *           enum: [en, fr, sw]
     *           default: en
     *         description: Language locale
     *     responses:
     *       200:
     *         description: Satisfaction gauge data
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 currentValue:
     *                   type: number
     *                 previousValue:
     *                   type: number
     *                 changePercentage:
     *                   type: number
     *                 target:
     *                   type: number
     *                 historicalData:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       label:
     *                         type: string
     *                       value:
     *                         type: number
     *       500:
     *         description: Server error
     */
    router.get('/satisfaction/gauge', (req, res) => {
      logger.info(`Fetching satisfaction gauge data from ${req.query.startDate} to ${req.query.endDate} with locale ${req.query.locale || 'en'}`);
      analyticsController.getSatisfactionGauge(req, res);
    });

    /**
     * @swagger
     * /analytics/satisfaction/heatmap:
     *   get:
     *     summary: Get satisfaction heatmap data
     *     description: Retrieves satisfaction percentage data by knowledge area over time
     *     tags: [Analytics]
     *     parameters:
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date-time
     *         description: Start date (ISO format)
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date-time
     *         description: End date (ISO format)
     *       - in: query
     *         name: locale
     *         schema:
     *           type: string
     *           enum: [en, fr, sw]
     *           default: en
     *         description: Language locale
     *     responses:
     *       200:
     *         description: Satisfaction heatmap data
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   name:
     *                     type: string
     *                   data:
     *                     type: array
     *                     items:
     *                       type: object
     *                       properties:
     *                         x:
     *                           type: string
     *                         y:
     *                           type: number
     *       500:
     *         description: Server error
     */
    router.get('/satisfaction/heatmap', (req, res) => {
      logger.info(`Fetching satisfaction heatmap data from ${req.query.startDate} to ${req.query.endDate} with locale ${req.query.locale || 'en'}`);
      analyticsController.getSatisfactionHeatmap(req, res);
    });

    return router;
  } catch (error) {
    logger.error('Failed to initialize analytics-routes:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};