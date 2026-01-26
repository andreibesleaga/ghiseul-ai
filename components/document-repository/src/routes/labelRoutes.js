const labelController = require('../controllers/labelController');
const express = require('express');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

const router = express.Router();

// apply authentication to all endpoints 
router.use(authenticateToken);


/**
 * @route GET /api/labels/:labelId
 * @desc Get a label by its _key
 * @access Admin
 * @param {string} labelId - Label _key
 */
router.get('/:labelId', authorizeRole(['Admin']), labelController.getLabelById);


/**
 * @route GET /api/labels
 * @desc Get all labels or filter by level/status
 * @access Public
 * @query {string} level - Filter by label level (category/service)
 * @query {string} status - Filter by label status (pending/active)
 */
router.get('/', authorizeRole(['Admin']), labelController.getLabels);


/**
 * @route POST /api/labels
 * @desc Create a new label
 * @access Admin
 * @body {string} name - Label name
 * @body {string} level - Label level (category/service)
 * @body {string} status - Label status (pending/active)
 * @body {string} [publish_date] - Optional publish date
 */
router.post('/', authorizeRole(['Admin']), labelController.createLabel);

/**
 * @route PATCH /api/labels/:labelId
 * @desc Update a label by ID
 * @access Admin
 * @param {string} labelId - Label ID
 * @body {Object} updates - JSON object with fields to update
 */
router.patch('/:labelId', authorizeRole(['Admin']), labelController.updateLabel);

/**
 * @route DELETE /api/labels/:labelId
 * @desc Delete a label by ID
 * @access Admin
 * @param {string} labelId - Label ID
 */
router.delete('/:labelId', authorizeRole(['Admin']), labelController.deleteLabel);

/**
 * @route DELETE /api/labels/:labelId/with-children
 * @desc Delete a category label and its children
 * @access Admin
 * @param {string} labelId - Label ID
 */
router.delete('/:labelId/with-children', authorizeRole(['Admin']), labelController.deleteCategoryWithChildren);

/**
 * @route GET /api/labels/:labelId/related
 * @desc Get related labels (parent and children)
 * @access Admin
 * @param {string} labelId - Label ID
 */
router.get('/:labelId/related', authorizeRole(['Admin']), labelController.getRelatedLabels);

module.exports = router;