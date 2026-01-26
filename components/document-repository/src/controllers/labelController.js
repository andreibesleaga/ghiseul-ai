const labelService = require('../services/labelService');
const { logger } = require('../../shared-lib');


// Get a label by its _key (the id)
exports.getLabelById = async (req, res) => {
  logger.debug('Entering getLabelById controller...');
  try {
    const { labelId } = req.params; // Extract the label ID (_key) from the route parameter
    logger.debug(`Fetching label with ID (key): ${labelId}`);

    const label = await labelService.getLabelById(labelId); // Call the service to fetch the label
    
    logger.info(`Successfully fetched label ${labelId}`);
    res.status(200).json(label); // Return the label as a JSON response
  } catch (error) {
    logger.error(`Error in getLabelById for ID ${req.params.labelId}: ${error.message}`, error);
    res.status(500).json({ error: 'Failed to fetch label', details: error.message });
  }
};


// Get all labels or filter by level/status
exports.getLabels = async (req, res) => {
  logger.debug('Entering getLabels controller...');
  try {
    const { name, level, status, parentId, publish } = req.query;
    const filters = { name, level, status, parentId, publish };
    logger.debug(`Fetching labels with filters: ${JSON.stringify(filters)}`);

    const labels = await labelService.getLabels(filters);
    
    logger.info(`Successfully fetched ${labels.length} labels.`);
    res.status(200).json(labels);
  } catch (error) {
    logger.error(`Error in getLabels: ${error.message}`, error);
    res.status(500).json({ error: 'Failed to fetch labels', details: error.message });
  }
};


// Create a new label
exports.createLabel = async (req, res) => {
  logger.debug('Entering createLabel controller...');
  try {
    const { name, level, status, publish, parentId } = req.body;
    const labelData = {
      name,
      level,
      status,
      publish,
      parentId: parentId || null, // Set parent_id to null if not provided (for category labels)
    };
    logger.debug(`Attempting to create label with data: ${JSON.stringify(labelData)}`);

    const newLabel = await labelService.createLabel(labelData);

    logger.info(`Successfully created label ${newLabel._key}`);
    res.status(201).json(newLabel);
  } catch (error) {
    logger.error(`Error in createLabel: ${error.message}`, error);
    // Fixed the error response to pass message, not the full error object
    res.status(500).json({ error: 'Failed to create label', details: error.message });
  }
};


// Update a label by ID
exports.updateLabel = async (req, res) => {
  logger.debug('Entering updateLabel controller...');
  try {
    const { labelId } = req.params;
    const updates = req.body;
    logger.debug(`Attempting to update label ${labelId} with data: ${JSON.stringify(updates)}`);

    // Your existing logs - kept them as they are useful
    logger.info('🧪 Update Label ID:' + labelId);
    logger.info('🧪 Update Label Payload:' + JSON.stringify(updates));

    const updatedLabel = await labelService.updateLabel(labelId, updates);
    
    logger.info(`Successfully updated label ${labelId}`);
    res.status(200).json(updatedLabel);
  } catch (error) {
    logger.error(`Error in updateLabel for ID ${req.params.labelId}: ${error.message}`, error);
    res.status(500).json({ error: 'Failed to update label', details: error.message });
  }
};


// Delete a label by ID
exports.deleteLabel = async (req, res) => {
  logger.debug('Entering deleteLabel controller...');
  try {
    const { labelId } = req.params;
    logger.debug(`Attempting to delete label with ID: ${labelId}`);

    await labelService.deleteLabel(labelId);
    
    logger.info(`Successfully deleted label ${labelId}`);
    res.status(200).json({ message: 'Label deleted successfully' });
  } catch (error) {
    logger.error(`Error in deleteLabel for ID ${req.params.labelId}: ${error.message}`, error);
    res.status(500).json({ error: 'Failed to delete label', details: error.message });
  }
};


// Delete a category label and its children
exports.deleteCategoryWithChildren = async (req, res) => {
  logger.debug('Entering deleteCategoryWithChildren controller...');
  try {
    const { labelId } = req.params;
    logger.debug(`Attempting to delete category and children for ID: ${labelId}`);

    await labelService.deleteCategoryWithChildren(labelId);
    
    logger.info(`Successfully deleted category and children for ${labelId}`);
    res.status(200).json({ message: 'Label and its children deleted successfully' });
  } catch (error) {
    logger.error(`Error in deleteCategoryWithChildren for ID ${req.params.labelId}: ${error.message}`, error);
    res.status(500).json({ error: 'Failed to delete category label with children', details: error.message });
  }
};


// Get related labels (parent and children)
exports.getRelatedLabels = async (req, res) => {
  logger.debug('Entering getRelatedLabels controller...');
  try {
    const { labelId } = req.params;
    logger.debug(`Fetching related labels for ID: ${labelId}`);

    const relatedLabels = await labelService.getRelatedLabels(labelId);
    
    logger.info(`Successfully fetched related labels for ${labelId}`);
    res.status(200).json(relatedLabels);
  } catch (error) {
    logger.error(`Error in getRelatedLabels for ID ${req.params.labelId}: ${error.message}`, error);
    res.status(500).json({ error: 'Failed to fetch related labels', details: error.message });
  }
};