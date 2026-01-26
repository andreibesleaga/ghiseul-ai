const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth-middleware');
const { logger } = require('../shared-lib');

module.exports = (serviceCategoryService) => {
  if (!serviceCategoryService || typeof serviceCategoryService.getAllCategoriesWithServices !== 'function') {
    logger.error('Invalid serviceCategoryService provided to service-category-routes');
    throw new Error('serviceCategoryService is required with getAllCategoriesWithServices');
  }
  logger.debug('serviceCategory-routes initialized with serviceCategoryService');

  router.use(authMiddleware.authenticate);

  /**
   * @swagger
   * /service-categories/categories:
   *   get:
   *     summary: Get all categories with services
   *     description: Retrieves all service categories with their associated services
   *     tags: [Service Categories]
   *     parameters:
   *       - in: query
   *         name: locale
   *         schema:
   *           type: string
   *           default: en
   *         description: Language locale for category and service names
   *     responses:
   *       '200':
   *         description: List of categories with services
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   catKey:
   *                     type: string
   *                   name:
   *                     type: string
   *                   children:
   *                     type: array
   *                     items:
   *                       type: string
   *       '500':
   *         description: Server error
   */
  router.get('/categories', async (req, res) => {
    const start = Date.now();
    try {
      const locale = req.query.locale || 'en';
      logger.info(`Fetching all service categories with locale: ${locale}`);
      const categories = await serviceCategoryService.getAllCategoriesWithServices(locale);
      logger.info(`Fetched ${categories.length} categories in ${Date.now() - start}ms`);
      res.json(categories);
    } catch (error) {
      logger.error(`Error getting all categories with services: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /service-categories/categories/detailed:
   *   get:
   *     summary: Get all categories with detailed services for admin
   *     description: Retrieves all categories with their associated services as objects (including keys)
   *     tags: [Service Categories]
   *     parameters:
   *       - in: query
   *         name: locale
   *         schema:
   *           type: string
   *           default: en
   *         description: Language locale for category and service names
   *     responses:
   *       '200':
   *         description: List of categories with detailed service objects
   *       '500':
   *         description: Server error
   */
  router.get('/categories/detailed', async (req, res) => {
    const start = Date.now();
    try {
      const locale = req.query.locale || 'en';
      logger.info(`Fetching all DETAILED service categories with locale: ${locale}`);
      const categories = await serviceCategoryService.getAdminAllCategoriesWithServices(locale);
      logger.info(`Fetched ${categories.length} detailed categories in ${Date.now() - start}ms`);
      res.json(categories);
    } catch (error) {
      logger.error(`Error getting all detailed categories: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /service-categories/categories/{categoryId}:
   *   get:
   *     summary: Get category with services
   *     description: Retrieves a specific service category with its associated services
   *     tags: [Service Categories]
   *     parameters:
   *       - in: path
   *         name: categoryId
   *         required: true
   *         schema:
   *           type: string
   *         description: Category key
   *       - in: query
   *         name: locale
   *         schema:
   *           type: string
   *           default: en
   *         description: Language locale for category and service names
   *     responses:
   *       '200':
   *         description: Category with services
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 catKey:
   *                   type: string
   *                 name:
   *                   type: string
   *                 children:
   *                   type: array
   *                   items:
   *                     type: string
   *       '404':
   *         description: Category not found
   *       '500':
   *         description: Server error
   */
  router.get('/categories/:categoryId', async (req, res) => {
    const start = Date.now();
    try {
      const locale = req.query.locale || 'en';
      logger.info(`Fetching category ${req.params.categoryId} with locale: ${locale}`);
      const category = await serviceCategoryService.getCategoryWithServices(req.params.categoryId, locale);
      logger.info(`Fetched category ${req.params.categoryId} in ${Date.now() - start}ms`);
      res.json(category);
    } catch (error) {
      if (error.message.includes('not found')) {
        logger.warn(`Category ${req.params.categoryId} not found`);
        res.status(404).json({ message: error.message });
      } else {
        logger.error(`Error getting category ${req.params.categoryId}: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
        res.status(500).json({ message: error.message });
      }
    }
  });

  /**
   * @swagger
   * /service-categories/{categoryId}/translations:
   *   get:
   *     summary: Get all translations for a category
   *     description: Retrieves all available translations for a specific service category
   *     tags: [Service Categories]
   *     parameters:
   *       - in: path
   *         name: categoryId
   *         required: true
   *         schema:
   *           type: string
   *         description: The key of the category
   *     responses:
   *       '200':
   *         description: A list of translation objects
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   lang:
   *                     type: string
   *                     example: "FR"
   *                   text:
   *                     type: string
   *                     example: "Santé et services sociaux"
   *       '500':
   *         description: Server error
   */
  router.get('/:categoryId/translations', async (req, res) => {
    const start = Date.now();
    try {
      const { categoryId } = req.params;
      logger.info(`Fetching all translations for category: ${categoryId}`);
      const translations = await serviceCategoryService.getCategoryTranslations(categoryId);
      logger.info(`Fetched ${translations.length} translations for category ${categoryId} in ${Date.now() - start}ms`);
      res.json(translations);
    } catch (error) {
      logger.error(`Error getting translations for category ${req.params.categoryId}: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /service-categories/services/{serviceId}/translations:
   *   get:
   *     summary: Get all translations for a service
   *     description: Retrieves all available translations for a specific service
   *     tags: [Service Categories]
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *         description: The key of the service
   *     responses:
   *       '200':
   *         description: A list of translation objects
   *       '500':
   *         description: Server error
   */
  router.get('/services/:serviceId/translations', async (req, res) => {
    const start = Date.now();
    try {
      const { serviceId } = req.params;
      logger.info(`Fetching all translations for service: ${serviceId}`);
      const translations = await serviceCategoryService.getServiceTranslations(serviceId);
      logger.info(`Fetched ${translations.length} translations for service ${serviceId} in ${Date.now() - start}ms`);
      res.json(translations);
    } catch (error) {
      logger.error(`Error getting translations for service ${req.params.serviceId}: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /service-categories/search:
   *   get:
   *     summary: Search categories and services
   *     description: Searches for categories and services based on a query string
   *     tags: [Service Categories]
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
   *       '200':
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
   *                       type:
   *                         type: string
   *                       key:
   *                         type: string
   *                       name:
   *                         type: string
   *                 services:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       type:
   *                         type: string
   *                       key:
   *                         type: string
   *                       name:
   *                         type: string
   *                       categoryKey:
   *                         type: string
   *                       categoryName:
   *                         type: string
   *       '400':
   *         description: Missing search query
   *       '500':
   *         description: Server error
   */
  router.get('/search', async (req, res) => {
    const start = Date.now();
    try {
      const { query, locale = 'en' } = req.query;
      if (!query) {
        logger.warn('Search query missing in /service-categories/search');
        return res.status(400).json({ message: 'Search query is required' });
      }
      logger.info(`Searching categories and services with query: "${query}" and locale: ${locale}`);
      const results = await serviceCategoryService.searchCategoriesAndServices(query, locale);
      logger.info(`Search completed in ${Date.now() - start}ms: ${results.categories.length} categories, ${results.services.length} services`);
      res.json(results);
    } catch (error) {
      logger.error(`Error searching categories and services: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /service-categories:
   *   post:
   *     summary: Create a new category
   *     description: Creates a new service category with translations
   *     tags: [Service Categories]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               nameEN:
   *                 type: string
   *               translations:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       '201':
   *         description: Category created successfully
   */
  router.post('/', async (req, res) => {
    const start = Date.now();
    try {
      const payload = req.body;
      if (!payload || !payload.nameEN) {
        return res.status(400).json({ message: 'Payload with nameEN is required' });
      }
      logger.info(`Creating single category with name: ${payload.nameEN}`);
      const result = await serviceCategoryService.createCategory(payload);
      logger.info(`Category created successfully in ${Date.now() - start}ms`);
      res.status(201).json(result);
    } catch (error) {
      logger.error(`Error creating category: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /service-categories/{categoryId}:
   *   delete:
   *     summary: Delete a category
   *     description: Deletes a service category and its associated services
   *     tags: [Service Categories]
   *     parameters:
   *       - in: path
   *         name: categoryId
   *         required: true
   *         schema:
   *           type: string
   *         description: Category key
   *     responses:
   *       '200':
   *         description: Category deleted successfully
   *       '404':
   *         description: Category not found
   *       '500':
   *         description: Server error
   */
  router.delete('/:categoryId', async (req, res) => {
    const start = Date.now();
    try {
      logger.info(`Attempting to delete category: ${req.params.categoryId}`);
      const exists = await serviceCategoryService.categoryExists(req.params.categoryId);
      if (!exists) {
        logger.warn(`Category ${req.params.categoryId} not found for deletion`);
        return res.status(404).json({ message: `Category ${req.params.categoryId} not found` });
      }
      await serviceCategoryService.deleteCategory(req.params.categoryId);
      logger.info(`Category ${req.params.categoryId} deleted successfully in ${Date.now() - start}ms`);
      res.json({ message: `Category ${req.params.categoryId} deleted successfully` });
    } catch (error) {
      logger.error(`Error deleting category ${req.params.categoryId}: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /service-categories/services/{serviceId}:
   *   delete:
   *     summary: Delete a service
   *     description: Deletes a service and its associated translations
   *     tags: [Service Categories]
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *         description: The key of the service to delete
   *     responses:
   *       '200':
   *         description: Service deleted successfully
   *       '404':
   *         description: Service not found
   *       '500':
   *         description: Server error
   */
  router.delete('/services/:serviceId', async (req, res) => {
    const start = Date.now();
    try {
      const { serviceId } = req.params;
      logger.info(`Attempting to delete service: ${serviceId}`);
      const result = await serviceCategoryService.deleteService(serviceId);
      logger.info(`Service ${serviceId} deleted successfully in ${Date.now() - start}ms`);
      res.status(200).json({ message: `Service ${serviceId} deleted successfully` });
    } catch (error)
      {
      logger.error(`Error deleting service ${req.params.serviceId}: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
      if (error.code === 404) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  /**
   * @swagger
   * /service-categories/init:
   *   post:
   *     summary: Initialize default categories
   *     description: Initializes the system with default categories and services
   *     tags: [Service Categories]
   *     responses:
   *       '200':
   *         description: Default categories initialized successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 categoriesCreated:
   *                   type: integer
   *       '500':
   *         description: Server error
   */
  router.post('/init', async (req, res) => {
    const start = Date.now();
    try {
      logger.info('Initializing default categories and services');
      const result = await serviceCategoryService.initializeDefaultCategoriesAndServices();
      logger.info(`Default categories initialized successfully in ${Date.now() - start}ms`);
      res.json(result);
    } catch (error) {
      logger.error(`Error initializing default categories: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /service-categories/{categoryId}/services:
   *   post:
   *     summary: Create a new service for a category
   *     description: Creates a new service with translations under a specific category
   *     tags: [Service Categories]
   *     parameters:
   *       - in: path
   *         name: categoryId
   *         required: true
   *         schema:
   *           type: string
   *         description: The key of the parent category
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               nameEN:
   *                 type: string
   *               translations:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       '201':
   *         description: Service created successfully
   *       '500':
   *         description: Server error
   */
  router.post('/:categoryId/services', async (req, res) => {
    const start = Date.now();
    try {
      const { categoryId } = req.params;
      const payload = req.body;
      logger.info(`Creating service for category ${categoryId}`);
      const newService = await serviceCategoryService.createServiceWithTranslations(categoryId, payload);
      logger.info(`Service created successfully for category ${categoryId} in ${Date.now() - start}ms`);
      res.status(201).json(newService);
    } catch (error) {
      logger.error(`Error creating service for category ${req.params.categoryId}: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /service-categories/{categoryId}:
   *   put:
   *     summary: Update an existing category
   *     description: Updates a category's name and translations
   *     tags: [Service Categories]
   *     parameters:
   *       - in: path
   *         name: categoryId
   *         required: true
   *         schema:
   *           type: string
   *         description: The key of the category to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               nameEN:
   *                 type: string
   *               translations:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       '200':
   *         description: Category updated successfully
   *       '500':
   *         description: Server error
   */
  router.put('/:categoryId', async (req, res) => {
    const start = Date.now();
    try {
      const { categoryId } = req.params;
      const payload = req.body;
      logger.info(`Updating category ${categoryId}`);
      const result = await serviceCategoryService.updateCategoryWithTranslations(categoryId, payload);
      logger.info(`Category ${categoryId} updated successfully in ${Date.now() - start}ms`);
      res.status(200).json(result);
    } catch (error) {
      logger.error(`Error updating category ${req.params.categoryId}: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * @swagger
   * /service-categories/services/{serviceId}:
   *   put:
   *     summary: Update an existing service
   *     description: Updates a service's name and its associated translations
   *     tags: [Service Categories]
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *         description: The key of the service to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               nameEN:
   *                 type: string
   *               translations:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       '200':
   *         description: Service updated successfully
   *       '500':
   *         description: Server error
   */
  router.put('/services/:serviceId', async (req, res) => {
    const start = Date.now();
    try {
      const { serviceId } = req.params;
      const payload = req.body;
      logger.info(`Updating service ${serviceId}`);
      const result = await serviceCategoryService.updateServiceWithTranslations(serviceId, payload);
      logger.info(`Service ${serviceId} updated successfully in ${Date.now() - start}ms`);
      res.status(200).json(result);
    } catch (error) {
      logger.error(`Error updating service ${req.params.serviceId}: ${error.message}`, { stack: error.stack, durationMs: Date.now() - start });
      res.status(500).json({ message: error.message });
    }
  });

  return router;
};