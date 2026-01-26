const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth-middleware');
const { logger } = require('../shared-lib');

module.exports = (serviceCategoryService) => {
  if (!serviceCategoryService || typeof serviceCategoryService.getAllCategoriesWithServices !== 'function') {
    logger.error('Invalid serviceCategoryService provided to service-routes');
    throw new Error('serviceCategoryService is required with getAllCategoriesWithServices');
  }
  logger.debug('service-routes initialized with serviceCategoryService', {
    methods: Object.getOwnPropertyNames(Object.getPrototypeOf(serviceCategoryService)).filter(m => m !== 'constructor')
  });

  router.use(authMiddleware.authenticate);

  /**
   * @swagger
   * /services/categories:
   *   get:
   *     summary: Get all categories with services
   *     description: Retrieves all service categories with their associated services
   *     tags: [Services]
   *     parameters:
   *       - in: query
   *         name: locale
   *         schema:
   *           type: string
   *           default: en
   *         description: Language locale for category and service names
   *     responses:
   *       200:
   *         description: List of categories with services
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   _key:
   *                     type: string
   *                   nameEN:
   *                     type: string
   *                   descriptionEN:
   *                     type: string
   *                   icon:
   *                     type: string
   *                   services:
   *                     type: array
   *                     items:
   *                       type: object
   *                       properties:
   *                         _key:
   *                           type: string
   *                         nameEN:
   *                           type: string
   *                         descriptionEN:
   *                           type: string
   *                         requirements:
   *                           type: string
   *                         process:
   *                           type: string
   *       500:
   *         description: Server error
   */
  router.get('/categories', async (req, res) => {
    const start = Date.now();
    try {
      const locale = req.query.locale || 'en';
      logger.info(`Fetching all service categories with services, locale: ${locale}`);
      const categories = await serviceCategoryService.getAllCategoriesWithServices(locale);
      logger.info(`Fetched ${categories.length} categories in ${Date.now() - start}ms`);
      res.json(categories);
    } catch (error) {
      logger.error(`Error fetching all categories with services: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /services/categories/{categoryId}:
   *   get:
   *     summary: Get category with services
   *     description: Retrieves a specific service category with its associated services
   *     tags: [Services]
   *     parameters:
   *       - in: path
   *         name: categoryId
   *         required: true
   *         schema:
   *           type: string
   *         description: Category ID
   *       - in: query
   *         name: locale
   *         schema:
   *           type: string
   *           default: en
   *         description: Language locale for category and service names
   *     responses:
   *       200:
   *         description: Category with services
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 _key:
   *                   type: string
   *                 nameEN:
   *                   type: string
   *                 descriptionEN:
   *                   type: string
   *                 icon:
   *                   type: string
   *                 services:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       _key:
   *                         type: string
   *                       nameEN:
   *                         type: string
   *                       descriptionEN:
   *                         type: string
   *                       requirements:
   *                           type: string
   *                       process:
   *                           type: string
   *       404:
   *         description: Category not found
   *       500:
   *         description: Server error
   */
  router.get('/categories/:categoryId', async (req, res) => {
    const start = Date.now();
    try {
      const locale = req.query.locale || 'en';
      logger.info(`Fetching category ${req.params.categoryId} with services, locale: ${locale}`);
      const category = await serviceCategoryService.getCategoryWithServices(req.params.categoryId, locale);
      logger.info(`Fetched category ${req.params.categoryId} in ${Date.now() - start}ms`);
      res.json(category);
    } catch (error) {
      if (error.message.includes('not found')) {
        logger.warn(`Category ${req.params.categoryId} not found`);
        res.status(404).json({ message: error.message });
      } else {
        logger.error(`Error fetching category ${req.params.categoryId} with services: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
        res.status(500).json({ message: error.message });
      }
    }
  });

  /**
   * @swagger
   * /services/search:
   *   get:
   *     summary: Search categories and services
   *     description: Searches for categories and services based on a query string
   *     tags: [Services]
   *     parameters:
   *       - in: query
   *         name: query
   *         required: true
   *         schema:
   *           type: string
   *         description: Search query
   *       - in: query
   *         name: locale
   *         schema:
   *           type: string
   *           default: en
   *         description: Language locale for search results
   *     responses:
   *       200:
   *         description: Search results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 categories:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       _key:
   *                         type: string
   *                       nameEN:
   *                         type: string
   *                       descriptionEN:
   *                         type: string
   *                       relevance:
   *                         type: number
   *                 services:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       _key:
   *                         type: string
   *                       nameEN:
   *                         type: string
   *                       descriptionEN:
   *                         type: string
   *                       categoryId:
   *                         type: string
   *                       relevance:
   *                         type: number
   *       400:
   *         description: Missing search query
   *       500:
   *         description: Server error
   */
  router.get('/search', async (req, res) => {
    const start = Date.now();
    try {
      const { query, locale = 'en' } = req.query;
      if (!query) {
        logger.warn('Search query missing in /services/search');
        return res.status(400).json({ message: 'Search query is required' });
      }
      logger.info(`Searching services with query: "${query}", locale: ${locale}`);
      const results = await serviceCategoryService.searchCategoriesAndServices(query, locale);
      logger.info(`Search completed in ${Date.now() - start}ms: ${results.categories.length} categories, ${results.services.length} services`);
      res.json(results);
    } catch (error) {
      logger.error(`Error searching categories and services: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
      res.status(500).json({ message: error.message });
    }
  });

  return router;
};