const config = require('../config/appConfig');

const { logger } = require('../../shared-lib');
const { dbService } = require('../../shared-lib');

class LabelService {
    constructor() {
    this.collectionName = 'labels'; // Name of the labels collection in ArangoDB
    this.allowedLevels = config.labels.allowedLevels;
    this.allowedStatuses = config.labels.allowedStatuses;
  }

  /**
   * Validate level and status
   * @param {string} level - Label level
   * @param {string} status - Label status
   */
  validateLevelAndStatus(level, status) {
    if (level && !this.allowedLevels.includes(level)) {
      throw new Error(`Invalid level: Allowed levels are ${this.allowedLevels.join(', ')}`);
    }
    if (status && !this.allowedStatuses.includes(status)) {
      throw new Error(`Invalid status: Allowed statuses are ${this.allowedStatuses.join(', ')}`);
    }
  }

  /**
   * Get database connection for labels
   */
  async getDb() {
    return await dbService.getConnection(this.collectionName);
  }


  /**
   * Get a label by its _key
   * @param {string} labelKey - Label _key
   * @returns {Object} Label document
   */
  async getLabelById(labelKey) {
    const db = await this.getDb();
    try {
      const label = await db.collection(this.collectionName).document(labelKey);
      return label;
    } catch (err) {
      if (err.errorNum === 1202) {
        throw new Error(`Label with key ${labelKey} not found.`);
      }
      throw err;
    }
  }


  /**
   * Get all labels or filter by level/status/parentId
   * @param {Object} filters - Filters for level, status, parentId, or publish
   * @returns {Array} List of labels
   */
  async getLabels(filters = {}) {
    const db = await this.getDb();
    const { name, level, status, parentId, publish } = filters;

    let query = `FOR label IN ${this.collectionName}`;
    const bindVars = {};

    const conditions = [];
    if (name) {
      conditions.push('CONTAINS(LOWER(label.name), LOWER(@name))');
      bindVars.name = name;
    }
    if (level) {
      conditions.push('label.level == @level');
      bindVars.level = level;
    }
    if (status) {
      conditions.push('label.status == @status');
      bindVars.status = status;
    }
    if (parentId) {
      conditions.push('label.parentId == @parentId');
      bindVars.parentId = parentId;
    }
    if (publish !== undefined) {
      // Convert string "true"/"false" to boolean
      let publishBool;
      if (typeof publish === 'string') {
        publishBool = publish.toLowerCase() === 'true';
      } else {
        publishBool = Boolean(publish);
      }
      conditions.push('label.publish == @publish');
      bindVars.publish = publishBool;
    }

    if (conditions.length > 0) {
      query += ` FILTER ${conditions.join(' AND ')}`;
    }

    query += ' RETURN label';

    const cursor = await db.query(query, bindVars);
    return await cursor.all();
  }


  /**
   * Create a new label
   * @param {Object} labelData - Data for the new label
   * @returns {Object} Created label
   */
  async createLabel(labelData) {
    const db = await this.getDb();

    // Validate level and status
    this.validateLevelAndStatus(labelData.level, labelData.status);

    // Validate parentId if provided
    if (labelData.parentId) {
      try{
        const parentLabel = await db.collection(this.collectionName).document(labelData.parentId);
        logger.info('🧪 Parent Label:' + JSON.stringify(parentLabel));
        if (!parentLabel || parentLabel.level !== 'category') {
          throw new Error('Invalid parentId: Parent must be a category label.');
        }
      }
      catch(err){
        if (err.errorNum === 1202) {
          throw new Error(`Parent label with key ${labelData.parentId} not found.`);
        }
        throw err.message; 
      }
    }

    // Ensure only allowed attributes are added
    const newLabel = {
      name: labelData.name,
      level: labelData.level,
      parentId: labelData.parentId || null,
      status: labelData.status,
      publish: labelData.publish || false,
    };

    const label = await db.collection(this.collectionName).save(newLabel, { returnNew: true });
    return label.new;
  }


  /**
   * Update a label by ID (_key attribute)
   * @param {string} labelKey - Label _key
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated label
   */
  async updateLabel(labelKey, updates) {
    const db = await this.getDb();
    const currentLabel = await this.getLabelById(labelKey);

    // Validate level and status
    this.validateLevelAndStatus(updates.level, updates.status);

    if (currentLabel.level === 'category' && updates.level === 'service') {
        // Ensure category label has no children before downgrading to service
        const cursor = await db.query(
          `FOR label IN ${this.collectionName} FILTER label.parentId == @labelKey RETURN label`,
          { labelKey }
        );
        const childLabels = await cursor.all();
        if (childLabels.length > 0) {
          throw new Error('Cannot update category label to service: It has child labels.');
        }
      }

    // Validate parentId if provided in updates
    if (updates.parentId) {
      const parentLabel = await db.collection(this.collectionName).document(updates.parentId);
      if (!parentLabel || parentLabel.level !== 'category') {
        throw new Error('Invalid parentId: Parent must be a category label.');
      }
    }

    const label = await db.collection(this.collectionName).update(labelKey, updates, { returnNew: true });
    return label.new;
  }


  /**
   * Delete a label by _key attribute
   * @param {string} labelId - Label _key
   * @returns {boolean} Success status
   */
  async deleteLabel(labelKey) {
    const db = await this.getDb();

    // Check if the label has child labels
    const cursor = await db.query(
      `FOR label IN ${this.collectionName} FILTER label.parentId == @labelKey RETURN label`,
      { labelKey }
    );
    const childLabels = await cursor.all();
    if (childLabels.length > 0) {
      throw new Error('Cannot delete label: It has child labels.');
    }

    await db.collection(this.collectionName).remove(labelKey);
    return true;
  }

  /**
   * Delete a category label and its children
   * @param {string} labelId - Category label _key
   * @returns {boolean} Success status
   */
  async deleteCategoryWithChildren(labelKey) {
    const db = await this.getDb();

    // Delete all child labels
    await db.query(
      `FOR label IN ${this.collectionName} FILTER label.parentId == @labelKey REMOVE label IN ${this.collectionName}`,
      { labelKey }
    );

    // Delete the category label itself
    await db.collection(this.collectionName).remove(labelKey);
    return true;
  }

  /**
   * Get related labels (children or parent)
   * @param {string} labelKey - Label _key
   * @returns {Object} Parent and child labels
   */
  async getRelatedLabels(labelKey) {
    const db = await this.getDb();

    // Get the label itself
    const label = await db.collection(this.collectionName).document(labelKey);

    // Get child labels
    const childCursor = await db.query(
      `FOR label IN ${this.collectionName} FILTER label.parentId == @labelKey RETURN label`,
      { labelKey }
    );
    const children = await childCursor.all();

    // Get parent label (if applicable)
    let parent = null;
    if (label.parentId) {
      parent = await db.collection(this.collectionName).document(label.parentId);
    }

    return { label, parent, children };
  }
}

module.exports = new LabelService();