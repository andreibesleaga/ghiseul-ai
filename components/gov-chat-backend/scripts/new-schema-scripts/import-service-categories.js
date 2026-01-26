/**
 * import-service-categories.js
 *
 * This script imports a knowledge hierarchy (service categories, services, translations, and edges)
 * from a JSON file into an ArangoDB database. It is designed to restore a previously exported
 * structure from `export-service-categories.js`.
 *
 * It supports multiple versions of the export format and can handle the creation of the
 * database and collections if they do not already exist.
 *
 * Features:
 * - Reads database configuration from environment variables with sensible defaults.
 * - Prompts for user confirmation before making any changes.
 * - Interactively prompts for import settings, using environment variables as defaults.
 * - Can create the target database and collections on the fly.
 * - Validates the structure and integrity of the import file before processing.
 * - Imports data in batches to handle large datasets efficiently.
 * - Skips documents or edges that already exist in the target collections to prevent duplicates.
 * - Performs a verification step after import to ensure data integrity.
 *
 * Usage:
 * node import-service-categories.js
 *
 * The script will then guide you through the configuration and confirmation process.
 *
 * Environment Variables (in .env file or shell):
 * - ARANGO_URL: ArangoDB URL (default: http://localhost:8529)
 * - ARANGO_DATABASE: Database name (default: test-node-services)
 * - ARANGO_USERNAME: ArangoDB username (default: root)
 * - ARANGO_PASSWORD: ArangoDB password (default: test)
 *
 * - IMPORT_FILE: Path to the JSON file to import.
 * - CREATE_DATABASE: Set to 'false' to prevent database creation (default: true).
 * - CREATE_COLLECTION: Set to 'false' to prevent collection creation (default: true).
 * - VALIDATE_BEFORE_IMPORT: Set to 'false' to skip data validation (default: true).
 * - BATCH_SIZE: Number of documents to import per batch (default: 100).
 *
 * Prerequisites:
 * - Install dependencies: `npm install arangojs yargs inquirer dotenv`
 *
 * Output:
 * - Logs the entire import process, including validation, creation, and verification steps.
 * - Provides a final summary of imported, skipped, and errored items.
 * - Exits with status 0 on success, 1 on failure.
 */

const { Database } = require('arangojs');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// To support modern ESM-only packages like inquirer v9+, we will dynamically import it.
let inquirer;

/**
 * Asks a question in the console and returns the user's answer.
 * @param {string} query - The question to display to the user.
 * @returns {Promise<string>} The user's answer.
 */
function askQuestion(query) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  
    return new Promise(resolve => rl.question(query, ans => {
      rl.close();
      resolve(ans);
    }));
}

let db;

/**
 * Lazy-loads the inquirer module. This is necessary because inquirer v9+ is an ESM-only module.
 */
async function loadInquirer() {
    if (!inquirer) {
      inquirer = (await import('inquirer')).default;
    }
}

// Initialize database connection
async function initializeDatabase(dbConfig) {
  try {
    console.log(`Connecting to ArangoDB at ${dbConfig.url}...`);
    
    // First connect to system database to check/create target database
    db = new Database({
      url: dbConfig.url,
      auth: dbConfig.auth
    });
    
    // Test connection to system database first
    const systemInfo = await db.get();
    console.log(`✓ Connected to ArangoDB (version: ${systemInfo.version})`);
    
    return db;
  } catch (error) {
    console.error('✗ Failed to connect to database:', error.message);
    throw error;
  }
}

// Create target database if it doesn't exist
async function ensureTargetDatabase(dbConfig, importConfig) {
  try {
    if (!importConfig.createDatabase) {
      console.log('Skipping database creation (CREATE_DATABASE=false)');
      // Switch to target database
      db = new Database({
        url: dbConfig.url,
        databaseName: dbConfig.databaseName,
        auth: dbConfig.auth
      });
      return;
    }
    
    console.log(`Checking if database '${dbConfig.databaseName}' exists...`);
    
    const databases = await db.listDatabases();
    const databaseExists = databases.includes(dbConfig.databaseName);
    
    if (!databaseExists) {
      console.log(`Creating database '${dbConfig.databaseName}'...`);
      await db.createDatabase(dbConfig.databaseName);
      console.log(`✓ Database '${dbConfig.databaseName}' created successfully`);
    } else {
      console.log(`✓ Database '${dbConfig.databaseName}' already exists`);
    }
    
    // Switch to target database
    db = new Database({
      url: dbConfig.url,
      databaseName: dbConfig.databaseName,
      auth: dbConfig.auth
    });
    
    const info = await db.get();
    console.log(`✓ Using database: ${info.name}`);
    
  } catch (error) {
    console.error('✗ Error with target database:', error.message);
    throw error;
  }
}

// Create serviceCategories collection
async function createServiceCategoriesCollection(importConfig) {
  try {
    const collection = db.collection('serviceCategories');
    const exists = await collection.exists();
    
    if (exists) {
      console.log('✓ serviceCategories collection already exists - using existing collection');
      return collection;
    }
    
    if (!importConfig.createCollection) {
      throw new Error('serviceCategories collection does not exist and CREATE_COLLECTION=false');
    }
    
    console.log('Creating serviceCategories collection...');
    
    const newCollection = await db.createCollection('serviceCategories', {
      waitForSync: false,
      keyOptions: {}
    });
    
    console.log('✓ serviceCategories collection created');
    return newCollection;
    
  } catch (error) {
    console.error('✗ Error with serviceCategories collection:', error.message);
    throw error;
  }
}

// Create services collection
async function createServicesCollection(importConfig) {
  try {
    const collection = db.collection('services');
    const exists = await collection.exists();
    
    if (exists) {
      console.log('✓ services collection already exists - using existing collection');
      return collection;
    }
    
    if (!importConfig.createCollection) {
      throw new Error('services collection does not exist and CREATE_COLLECTION=false');
    }
    
    console.log('Creating services collection...');
    
    const newCollection = await db.createCollection('services', {
      waitForSync: false,
      keyOptions: {}
    });
    
    // Create indexes for services
    await newCollection.ensureIndex({
      type: "hash",
      fields: ["categoryId", "order"],
      unique: false,
      name: "idx_categoryId_order"
    });
    
    console.log('✓ services collection created with indexes');
    return newCollection;
    
  } catch (error) {
    console.error('✗ Error with services collection:', error.message);
    throw error;
  }
}

// Create categoryServices edge collection
async function createCategoryServicesCollection(importConfig) {
  try {
    const collection = db.collection('categoryServices');
    const exists = await collection.exists();
    
    if (exists) {
      console.log('✓ categoryServices edge collection already exists - using existing collection');
      return collection;
    }
    
    if (!importConfig.createCollection) {
      throw new Error('categoryServices edge collection does not exist and CREATE_COLLECTION=false');
    }
    
    console.log('Creating categoryServices edge collection...');
    
    const newCollection = await db.createCollection('categoryServices', {
      type: 3, // Edge collection type
      waitForSync: false,
      keyOptions: {}
    });
    
    // Create index for better performance
    await newCollection.ensureIndex({
      type: "skiplist",
      fields: ["createdAt"],
      name: "idx_createdAt"
    });
    
    console.log('✓ categoryServices edge collection created');
    return newCollection;
    
  } catch (error) {
    console.error('✗ Error with categoryServices edge collection:', error.message);
    throw error;
  }
}

// Create serviceCategoryTranslations collection
async function createServiceCategoryTranslationsCollection(importConfig) {
  try {
    const collection = db.collection('serviceCategoryTranslations');
    const exists = await collection.exists();
    
    if (exists) {
      console.log('✓ serviceCategoryTranslations collection already exists - using existing collection');
      return collection;
    }
    
    if (!importConfig.createCollection) {
      throw new Error('serviceCategoryTranslations collection does not exist and CREATE_COLLECTION=false');
    }
    
    console.log('Creating serviceCategoryTranslations collection...');
    
    const newCollection = await db.createCollection('serviceCategoryTranslations', {
      waitForSync: false,
      keyOptions: {}
    });
    
    // Create indexes for serviceCategoryTranslations
    await newCollection.ensureIndex({
      type: "hash",
      fields: ["serviceCategoryId", "languageCode"],
      unique: true,
      name: "idx_serviceCategory_language"
    });
    
    await newCollection.ensureIndex({
      type: "skiplist",
      fields: ["serviceCategoryId"],
      unique: false,
      name: "idx_serviceCategoryId"
    });
    
    await newCollection.ensureIndex({
      type: "skiplist",
      fields: ["languageCode"],
      unique: false,
      name: "idx_languageCode"
    });
    
    console.log('✓ serviceCategoryTranslations collection created with indexes');
    return newCollection;
    
  } catch (error) {
    console.error('✗ Error with serviceCategoryTranslations collection:', error.message);
    throw error;
  }
}

// Create serviceCategoryTranslationsEdge collection
async function createServiceCategoryTranslationsEdgeCollection(importConfig) {
  try {
    const collection = db.collection('serviceCategoryTranslationsEdge');
    const exists = await collection.exists();
    
    if (exists) {
      console.log('✓ serviceCategoryTranslationsEdge collection already exists - using existing collection');
      return collection;
    }
    
    if (!importConfig.createCollection) {
      throw new Error('serviceCategoryTranslationsEdge collection does not exist and CREATE_COLLECTION=false');
    }
    
    console.log('Creating serviceCategoryTranslationsEdge collection...');
    
    const newCollection = await db.createCollection('serviceCategoryTranslationsEdge', {
      type: 3, // Edge collection type
      waitForSync: false,
      keyOptions: {}
    });
    
    console.log('✓ serviceCategoryTranslationsEdge collection created');
    return newCollection;
    
  } catch (error) {
    console.error('✗ Error with serviceCategoryTranslationsEdge collection:', error.message);
    throw error;
  }
}

// Create serviceTranslations collection
async function createServiceTranslationsCollection(importConfig) {
  try {
    const collection = db.collection('serviceTranslations');
    const exists = await collection.exists();
    
    if (exists) {
      console.log('✓ serviceTranslations collection already exists - using existing collection');
      return collection;
    }
    
    if (!importConfig.createCollection) {
      throw new Error('serviceTranslations collection does not exist and CREATE_COLLECTION=false');
    }
    
    console.log('Creating serviceTranslations collection...');
    
    const newCollection = await db.createCollection('serviceTranslations', {
      waitForSync: false,
      keyOptions: {}
    });
    
    // Create indexes for serviceTranslations
    await newCollection.ensureIndex({
      type: "hash",
      fields: ["serviceId", "languageCode"],
      unique: true,
      name: "idx_service_language"
    });
    
    await newCollection.ensureIndex({
      type: "skiplist",
      fields: ["serviceId"],
      unique: false,
      name: "idx_serviceId"
    });
    
    await newCollection.ensureIndex({
      type: "skiplist",
      fields: ["languageCode"],
      unique: false,
      name: "idx_languageCode"
    });
    
    console.log('✓ serviceTranslations collection created with indexes');
    return newCollection;
    
  } catch (error) {
    console.error('✗ Error with serviceTranslations collection:', error.message);
    throw error;
  }
}

// Create serviceTranslationsEdge collection
async function createServiceTranslationsEdgeCollection(importConfig) {
  try {
    const collection = db.collection('serviceTranslationsEdge');
    const exists = await collection.exists();
    
    if (exists) {
      console.log('✓ serviceTranslationsEdge collection already exists - using existing collection');
      return collection;
    }
    
    if (!importConfig.createCollection) {
      throw new Error('serviceTranslationsEdge collection does not exist and CREATE_COLLECTION=false');
    }
    
    console.log('Creating serviceTranslationsEdge collection...');
    
    const newCollection = await db.createCollection('serviceTranslationsEdge', {
      type: 3, // Edge collection type
      waitForSync: false,
      keyOptions: {}
    });
    
    console.log('✓ serviceTranslationsEdge collection created');
    return newCollection;
    
  } catch (error) {
    console.error('✗ Error with serviceTranslationsEdge collection:', error.message);
    throw error;
  }
}

// Read and validate import file
async function readImportFile(importConfig) {
  try {
    console.log(`Reading import file: ${importConfig.inputFile}`);
    
    // Check if file exists
    try {
      await fs.access(importConfig.inputFile);
    } catch (error) {
      throw new Error(`Import file not found: ${importConfig.inputFile}`);
    }
    
    // Read file content
    const fileContent = await fs.readFile(importConfig.inputFile, 'utf8');
    const importData = JSON.parse(fileContent);
    
    console.log('Analyzing import file structure...');
    
    // Basic validation for different export formats
    if (!importData.metadata || !importData.data) {
      throw new Error('Invalid import file structure - missing metadata or data');
    }
    
    // Handle different format versions
    let serviceCategoriesData, servicesData, categoryServicesData,
        serviceCategoryTranslationsData, serviceCategoryTranslationsEdgeData,
        serviceTranslationsData, serviceTranslationsEdgeData;
    
    if (importData.metadata.exportVersion === '4.0') {
      // New format with translation collections
      serviceCategoriesData = importData.data.serviceCategories || [];
      servicesData = importData.data.services || [];
      categoryServicesData = importData.data.categoryServices || [];
      serviceCategoryTranslationsData = importData.data.serviceCategoryTranslations || [];
      serviceCategoryTranslationsEdgeData = importData.data.serviceCategoryTranslationsEdge || [];
      serviceTranslationsData = importData.data.serviceTranslations || [];
      serviceTranslationsEdgeData = importData.data.serviceTranslationsEdge || [];
      console.log('✓ Format v4.0 detected - importing all collections including translations');
    } else if (importData.metadata.exportVersion === '3.0' && importData.data.categoryServices) {
      // Format v3.0 with edge collection
      serviceCategoriesData = importData.data.serviceCategories;
      servicesData = importData.data.services || [];
      categoryServicesData = importData.data.categoryServices || [];
      serviceCategoryTranslationsData = [];
      serviceCategoryTranslationsEdgeData = [];
      serviceTranslationsData = [];
      serviceTranslationsEdgeData = [];
      console.log('✓ Format v3.0 detected - importing serviceCategories, services, and categoryServices edges');
    } else if (importData.metadata.exportVersion === '2.0' && importData.data.serviceCategories) {
      // Format v2.0 without edge collection
      serviceCategoriesData = importData.data.serviceCategories;
      servicesData = importData.data.services || [];
      categoryServicesData = [];
      serviceCategoryTranslationsData = [];
      serviceCategoryTranslationsEdgeData = [];
      serviceTranslationsData = [];
      serviceTranslationsEdgeData = [];
      console.log('✓ Format v2.0 detected - importing serviceCategories and services (no edges)');
    } else if (Array.isArray(importData.data)) {
      // Old format - assume it's serviceCategories only
      serviceCategoriesData = importData.data;
      servicesData = [];
      categoryServicesData = [];
      serviceCategoryTranslationsData = [];
      serviceCategoryTranslationsEdgeData = [];
      serviceTranslationsData = [];
      serviceTranslationsEdgeData = [];
      console.log('⚠ Old format (v1.0) detected - importing serviceCategories only');
    } else {
      throw new Error('Invalid import file data structure - cannot determine format');
    }
    
    if (!Array.isArray(serviceCategoriesData) || !Array.isArray(servicesData) || 
        !Array.isArray(categoryServicesData) || !Array.isArray(serviceCategoryTranslationsData) ||
        !Array.isArray(serviceCategoryTranslationsEdgeData) || !Array.isArray(serviceTranslationsData) ||
        !Array.isArray(serviceTranslationsEdgeData)) {
      throw new Error('Import data collections are not arrays');
    }
    
    console.log(`✓ Import file loaded successfully:`);
    console.log(`  - Source database: ${importData.metadata.sourceDatabase || 'unknown'}`);
    console.log(`  - Export date: ${importData.metadata.exportDate || 'unknown'}`);
    console.log(`  - Export version: ${importData.metadata.exportVersion || '1.0'}`);
    console.log(`  - ServiceCategories: ${serviceCategoriesData.length} documents`);
    console.log(`  - Services: ${servicesData.length} documents`);
    console.log(`  - CategoryServices: ${categoryServicesData.length} edges`);
    console.log(`  - ServiceCategoryTranslations: ${serviceCategoryTranslationsData.length} documents`);
    console.log(`  - ServiceCategoryTranslationsEdge: ${serviceCategoryTranslationsEdgeData.length} edges`);
    console.log(`  - ServiceTranslations: ${serviceTranslationsData.length} documents`);
    console.log(`  - ServiceTranslationsEdge: ${serviceTranslationsEdgeData.length} edges`);
    console.log(`  - Total: ${serviceCategoriesData.length + servicesData.length + categoryServicesData.length + 
        serviceCategoryTranslationsData.length + serviceCategoryTranslationsEdgeData.length + 
        serviceTranslationsData.length + serviceTranslationsEdgeData.length} items`);
    
    return {
      metadata: importData.metadata,
      serviceCategories: serviceCategoriesData,
      services: servicesData,
      categoryServices: categoryServicesData,
      serviceCategoryTranslations: serviceCategoryTranslationsData,
      serviceCategoryTranslationsEdge: serviceCategoryTranslationsEdgeData,
      serviceTranslations: serviceTranslationsData,
      serviceTranslationsEdge: serviceTranslationsEdgeData
    };
    
  } catch (error) {
    console.error('✗ Error reading import file:', error.message);
    throw error;
  }
}

// Validate import data
async function validateImportData(importData, importConfig) {
  try {
    if (!importConfig.validateBeforeImport) {
      console.log('Skipping data validation (VALIDATE_BEFORE_IMPORT=false)');
      return true;
    }
    
    console.log('Validating import data...');
    
    let errors = [];
    let warnings = [];
    
    // Validate serviceCategories
    console.log('Validating serviceCategories...');
    const categoryRequiredFields = ['_key', 'nameEN', 'order'];
    const categoryKeySet = new Set();
    
    importData.serviceCategories.forEach((doc, index) => {
      const missingFields = categoryRequiredFields.filter(field => !doc.hasOwnProperty(field) || doc[field] === null || doc[field] === undefined);
      if (missingFields.length > 0) {
        errors.push(`ServiceCategory ${index}: Missing required fields: ${missingFields.join(', ')}`);
      }
      
      if (doc._key) {
        if (categoryKeySet.has(doc._key)) {
          errors.push(`ServiceCategory ${index}: Duplicate _key: ${doc._key}`);
        } else {
          categoryKeySet.add(doc._key);
        }
      }
      
      if (doc.order !== undefined && typeof doc.order !== 'number') {
        warnings.push(`ServiceCategory ${index}: order field should be a number, got: ${typeof doc.order}`);
      }
    });
    
    // Validate services
    console.log('Validating services...');
    const serviceRequiredFields = ['_key', 'categoryId', 'nameEN', 'order'];
    const serviceKeySet = new Set();
    
    importData.services.forEach((doc, index) => {
      const missingFields = serviceRequiredFields.filter(field => !doc.hasOwnProperty(field) || doc[field] === null || doc[field] === undefined);
      if (missingFields.length > 0) {
        errors.push(`Service ${index}: Missing required fields: ${missingFields.join(', ')}`);
      }
      
      if (doc._key) {
        if (serviceKeySet.has(doc._key)) {
          errors.push(`Service ${index}: Duplicate _key: ${doc._key}`);
        } else {
          serviceKeySet.add(doc._key);
        }
      }
      
      if (doc.order !== undefined && typeof doc.order !== 'number') {
        warnings.push(`Service ${index}: order field should be a number, got: ${typeof doc.order}`);
      }
      
      // Check if categoryId references exist
      if (doc.categoryId) {
        let categoryRef = doc.categoryId;
        if (categoryRef.includes('/')) {
          categoryRef = categoryRef.split('/')[1];
        }
        
        if (!categoryKeySet.has(categoryRef)) {
          warnings.push(`Service ${index}: categoryId '${doc.categoryId}' (extracted: '${categoryRef}') not found in serviceCategories`);
        }
      }
    });
    
    // Validate categoryServices edges
    console.log('Validating categoryServices edges...');
    const edgeRequiredFields = ['_from', '_to'];
    const edgeKeySet = new Set();
    
    importData.categoryServices.forEach((doc, index) => {
      const missingFields = edgeRequiredFields.filter(field => !doc.hasOwnProperty(field) || doc[field] === null || doc[field] === undefined);
      if (missingFields.length > 0) {
        errors.push(`CategoryServices edge ${index}: Missing required fields: ${missingFields.join(', ')}`);
      }
      
      if (doc._from) {
        const fromKey = doc._from.split('/')[1];
        if (!categoryKeySet.has(fromKey)) {
          warnings.push(`CategoryServices edge ${index}: _from '${doc._from}' references non-existent serviceCategory`);
        }
      }
      
      if (doc._to) {
        const toKey = doc._to.split('/')[1];
        if (!serviceKeySet.has(toKey)) {
          warnings.push(`CategoryServices edge ${index}: _to '${doc._to}' references non-existent service`);
        }
      }
      
      const edgeKey = `${doc._from}-${doc._to}`;
      if (edgeKeySet.has(edgeKey)) {
        warnings.push(`CategoryServices edge ${index}: Duplicate edge from ${doc._from} to ${doc._to}`);
      } else {
        edgeKeySet.add(edgeKey);
      }
    });
    
    // Validate serviceCategoryTranslations
    console.log('Validating serviceCategoryTranslations...');
    const categoryTranslationRequiredFields = ['_key', 'serviceCategoryId', 'languageCode', 'translation'];
    const categoryTranslationKeySet = new Set();
    
    importData.serviceCategoryTranslations.forEach((doc, index) => {
      const missingFields = categoryTranslationRequiredFields.filter(field => !doc.hasOwnProperty(field) || doc[field] === null || doc[field] === undefined);
      if (missingFields.length > 0) {
        errors.push(`ServiceCategoryTranslation ${index}: Missing required fields: ${missingFields.join(', ')}`);
      }
      
      if (doc._key) {
        if (categoryTranslationKeySet.has(doc._key)) {
          errors.push(`ServiceCategoryTranslation ${index}: Duplicate _key: ${doc._key}`);
        } else {
          categoryTranslationKeySet.add(doc._key);
        }
      }
      
      if (doc.serviceCategoryId && !categoryKeySet.has(doc.serviceCategoryId)) {
        warnings.push(`ServiceCategoryTranslation ${index}: serviceCategoryId '${doc.serviceCategoryId}' not found in serviceCategories`);
      }
    });
    
    // Validate serviceCategoryTranslationsEdge
    console.log('Validating serviceCategoryTranslationsEdge...');
    const categoryTranslationEdgeKeySet = new Set();
    
    importData.serviceCategoryTranslationsEdge.forEach((doc, index) => {
      const missingFields = edgeRequiredFields.filter(field => !doc.hasOwnProperty(field) || doc[field] === null || doc[field] === undefined);
      if (missingFields.length > 0) {
        errors.push(`ServiceCategoryTranslationsEdge ${index}: Missing required fields: ${missingFields.join(', ')}`);
      }
      
      if (doc._from) {
        const fromKey = doc._from.split('/')[1];
        if (!categoryKeySet.has(fromKey)) {
          warnings.push(`ServiceCategoryTranslationsEdge ${index}: _from '${doc._from}' references non-existent serviceCategory`);
        }
      }
      
      if (doc._to) {
        const toKey = doc._to.split('/')[1];
        if (!categoryTranslationKeySet.has(toKey)) {
          warnings.push(`ServiceCategoryTranslationsEdge ${index}: _to '${doc._to}' references non-existent serviceCategoryTranslation`);
        }
      }
      
      const edgeKey = `${doc._from}-${doc._to}`;
      if (categoryTranslationEdgeKeySet.has(edgeKey)) {
        warnings.push(`ServiceCategoryTranslationsEdge ${index}: Duplicate edge from ${doc._from} to ${doc._to}`);
      } else {
        categoryTranslationEdgeKeySet.add(edgeKey);
      }
    });
    
    // Validate serviceTranslations
    console.log('Validating serviceTranslations...');
    const serviceTranslationRequiredFields = ['_key', 'serviceId', 'languageCode', 'translation'];
    const serviceTranslationKeySet = new Set();
    
    importData.serviceTranslations.forEach((doc, index) => {
      const missingFields = serviceTranslationRequiredFields.filter(field => !doc.hasOwnProperty(field) || doc[field] === null || doc[field] === undefined);
      if (missingFields.length > 0) {
        errors.push(`ServiceTranslation ${index}: Missing required fields: ${missingFields.join(', ')}`);
      }
      
      if (doc._key) {
        if (serviceTranslationKeySet.has(doc._key)) {
          errors.push(`ServiceTranslation ${index}: Duplicate _key: ${doc._key}`);
        } else {
          serviceTranslationKeySet.add(doc._key);
        }
      }
      
      if (doc.serviceId && !serviceKeySet.has(doc.serviceId)) {
        warnings.push(`ServiceTranslation ${index}: serviceId '${doc.serviceId}' not found in services`);
      }
    });
    
    // Validate serviceTranslationsEdge
    console.log('Validating serviceTranslationsEdge...');
    const serviceTranslationEdgeKeySet = new Set();
    
    importData.serviceTranslationsEdge.forEach((doc, index) => {
      const missingFields = edgeRequiredFields.filter(field => !doc.hasOwnProperty(field) || doc[field] === null || doc[field] === undefined);
      if (missingFields.length > 0) {
        errors.push(`ServiceTranslationsEdge ${index}: Missing required fields: ${missingFields.join(', ')}`);
      }
      
      if (doc._from) {
        const fromKey = doc._from.split('/')[1];
        if (!serviceKeySet.has(fromKey)) {
          warnings.push(`ServiceTranslationsEdge ${index}: _from '${doc._from}' references non-existent service`);
        }
      }
      
      if (doc._to) {
        const toKey = doc._to.split('/')[1];
        if (!serviceTranslationKeySet.has(toKey)) {
          warnings.push(`ServiceTranslationsEdge ${index}: _to '${doc._to}' references non-existent serviceTranslation`);
        }
      }
      
      const edgeKey = `${doc._from}-${doc._to}`;
      if (serviceTranslationEdgeKeySet.has(edgeKey)) {
        warnings.push(`ServiceTranslationsEdge ${index}: Duplicate edge from ${doc._from} to ${doc._to}`);
      } else {
        serviceTranslationEdgeKeySet.add(edgeKey);
      }
    });
    
    if (errors.length > 0) {
      console.error(`✗ Validation failed with ${errors.length} errors:`);
      errors.slice(0, 10).forEach(error => console.error(`  - ${error}`));
      if (errors.length > 10) {
        console.error(`  ... and ${errors.length - 10} more errors`);
      }
      return false;
    }
    
    if (warnings.length > 0) {
      console.log(`⚠ Validation completed with ${warnings.length} warnings:`);
      warnings.slice(0, 10).forEach(warning => console.log(`  - ${warning}`));
      if (warnings.length > 10) {
        console.log(`  ... and ${warnings.length - 10} more warnings`);
      }
    } else {
      console.log(`✓ Validation passed:`);
      console.log(`  - ServiceCategories: ${importData.serviceCategories.length} valid documents`);
      console.log(`  - Services: ${importData.services.length} valid documents`);
      console.log(`  - CategoryServices: ${importData.categoryServices.length} valid edges`);
      console.log(`  - ServiceCategoryTranslations: ${importData.serviceCategoryTranslations.length} valid documents`);
      console.log(`  - ServiceCategoryTranslationsEdge: ${importData.serviceCategoryTranslationsEdge.length} valid edges`);
      console.log(`  - ServiceTranslations: ${importData.serviceTranslations.length} valid documents`);
      console.log(`  - ServiceTranslationsEdge: ${importData.serviceTranslationsEdge.length} valid edges`);
    }
    
    return true;
    
  } catch (error) {
    console.error('✗ Error during validation:', error.message);
    return false;
  }
}

// Check for existing data conflicts
async function checkExistingData(collections, importData) {
  try {
    console.log('Checking existing data status...');
    
    const counts = await Promise.all([
      collections.serviceCategories.count(),
      collections.services.count(),
      collections.categoryServices.count(),
      collections.serviceCategoryTranslations.count(),
      collections.serviceCategoryTranslationsEdge.count(),
      collections.serviceTranslations.count(),
      collections.serviceTranslationsEdge.count()
    ]);
    
    console.log(`Target collections currently have:`);
    console.log(`  - serviceCategories: ${counts[0].count} existing documents`);
    console.log(`  - services: ${counts[1].count} existing documents`);
    console.log(`  - categoryServices: ${counts[2].count} existing edges`);
    console.log(`  - serviceCategoryTranslations: ${counts[3].count} existing documents`);
    console.log(`  - serviceCategoryTranslationsEdge: ${counts[4].count} existing edges`);
    console.log(`  - serviceTranslations: ${counts[5].count} existing documents`);
    console.log(`  - serviceTranslationsEdge: ${counts[6].count} existing edges`);
    
    console.log('✓ Import will skip any existing documents and only add new ones');
    
    return { conflicts: [], canProceed: true };
    
  } catch (error) {
    console.error('✗ Error checking existing data:', error.message);
    throw error;
  }
}

// Clean document based on schema requirements
function cleanDocument(doc, collectionName, importConfig) {
  if (importConfig.schemaStrict) {
    if (collectionName === 'serviceCategories') {
      const cleaned = {
        _key: doc._key,
        nameEN: doc.nameEN,
        order: doc.order
      };
      
      if (doc.nameFR !== null && doc.nameFR !== undefined) {
        cleaned.nameFR = doc.nameFR;
      }
      if (doc.nameSW !== null && doc.nameSW !== undefined) {
        cleaned.nameSW = doc.nameSW;
      }
      
      return cleaned;
    } else if (collectionName === 'services') {
      const cleaned = {
        _key: doc._key,
        categoryId: doc.categoryId,
        nameEN: doc.nameEN,
        order: doc.order
      };
      
      if (doc.nameFR !== null && doc.nameFR !== undefined) {
        cleaned.nameFR = doc.nameFR;
      }
      if (doc.nameSW !== null && doc.nameSW !== undefined) {
        cleaned.nameSW = doc.nameSW;
      }
      if (doc.description !== null && doc.description !== undefined) {
        cleaned.description = doc.description;
      }
      
      return cleaned;
    } else if (collectionName === 'categoryServices') {
      const cleaned = {
        _from: doc._from,
        _to: doc._to
      };
      
      if (doc.order !== null && doc.order !== undefined) {
        cleaned.order = doc.order;
      }
      if (doc._key !== null && doc._key !== undefined) {
        cleaned._key = doc._key;
      }
      
      return cleaned;
    } else if (collectionName === 'serviceCategoryTranslations') {
      const cleaned = {
        _key: doc._key,
        serviceCategoryId: doc.serviceCategoryId,
        languageCode: doc.languageCode,
        translation: doc.translation,
        isActive: doc.isActive
      };
      
      if (doc.createdAt !== null && doc.createdAt !== undefined) {
        cleaned.createdAt = doc.createdAt;
      }
      if (doc.updatedAt !== null && doc.updatedAt !== undefined) {
        cleaned.updatedAt = doc.updatedAt;
      }
      
      return cleaned;
    } else if (collectionName === 'serviceCategoryTranslationsEdge') {
      const cleaned = {
        _key: doc._key,
        _from: doc._from,
        _to: doc._to
      };
      
      if (doc.createdAt !== null && doc.createdAt !== undefined) {
        cleaned.createdAt = doc.createdAt;
      }
      
      return cleaned;
    } else if (collectionName === 'serviceTranslations') {
      const cleaned = {
        _key: doc._key,
        serviceId: doc.serviceId,
        languageCode: doc.languageCode,
        translation: doc.translation,
        isActive: doc.isActive
      };
      
      if (doc.createdAt !== null && doc.createdAt !== undefined) {
        cleaned.createdAt = doc.createdAt;
      }
      if (doc.updatedAt !== null && doc.updatedAt !== undefined) {
        cleaned.updatedAt = doc.updatedAt;
      }
      
      return cleaned;
    } else if (collectionName === 'serviceTranslationsEdge') {
      const cleaned = {
        _key: doc._key,
        _from: doc._from,
        _to: doc._to
      };
      
      if (doc.createdAt !== null && doc.createdAt !== undefined) {
        cleaned.createdAt = doc.createdAt;
      }
      
      return cleaned;
    }
  } else {
    // Include all fields, clean nulls and add timestamps
    const cleanDoc = { ...doc };
    
    // Remove null values
    Object.keys(cleanDoc).forEach(key => {
      if (cleanDoc[key] === null) {
        delete cleanDoc[key];
      }
    });
    
    // Add timestamps if missing (not for edges)
    if (!['categoryServices', 'serviceCategoryTranslationsEdge', 'serviceTranslationsEdge'].includes(collectionName)) {
      const now = new Date().toISOString();
      if (!cleanDoc.createdAt) {
        cleanDoc.createdAt = now;
      }
      if (!cleanDoc.updatedAt) {
        cleanDoc.updatedAt = now;
      }
    }
    
    return cleanDoc;
  }
  
  return doc;
}

// Import documents for a single collection
async function importDocumentsForCollection(collection, documents, collectionName, importConfig) {
  try {
    console.log(`\n=== Starting ${collectionName} import ===`);
    
    if (documents.length === 0) {
      console.log(`⚠ No ${collectionName} documents to import`);
      return { importedCount: 0, errorCount: 0, skippedCount: 0, errors: [] };
    }
    
    const totalDocs = documents.length;
    let importedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors = [];
    
    console.log(`${collectionName} import details:`);
    console.log(`  - Total documents to process: ${totalDocs}`);
    console.log(`  - Sample document:`, JSON.stringify(documents[0], null, 2));
    
    // Get existing document keys to avoid duplicates
    console.log(`Checking for existing ${collectionName} documents...`);
    const existingKeys = new Set();
    
    if (['categoryServices', 'serviceCategoryTranslationsEdge', 'serviceTranslationsEdge'].includes(collectionName)) {
      try {
        const existingCursor = await collection.all();
        const existingDocs = await existingCursor.all();
        existingDocs.forEach(doc => {
          const edgeKey = `${doc._from}-${doc._to}`;
          existingKeys.add(edgeKey);
        });
        console.log(`  - Found ${existingKeys.size} existing ${collectionName} edges`);
      } catch (error) {
        console.log(`  - Could not check existing edges: ${error.message}`);
      }
    } else {
      try {
        const existingCursor = await collection.all();
        const existingDocs = await existingCursor.all();
        existingDocs.forEach(doc => existingKeys.add(doc._key));
        console.log(`  - Found ${existingKeys.size} existing ${collectionName} documents`);
      } catch (error) {
        console.log(`  - Could not check existing documents: ${error.message}`);
      }
    }
    
    // Filter out documents that already exist
    const documentsToImport = documents.filter(doc => {
      if (['categoryServices', 'serviceCategoryTranslationsEdge', 'serviceTranslationsEdge'].includes(collectionName)) {
        const edgeKey = `${doc._from}-${doc._to}`;
        if (existingKeys.has(edgeKey)) {
          console.log(`  - Skipping existing edge from ${doc._from} to ${doc._to}`);
          skippedCount++;
          return false;
        }
      } else {
        if (existingKeys.has(doc._key)) {
          console.log(`  - Skipping existing ${collectionName} ${doc._key}: ${doc.nameEN || doc.translation || 'document already exists'}`);
          skippedCount++;
          return false;
        }
      }
      return true;
    });
    
    console.log(`  - Documents to import: ${documentsToImport.length}`);
    console.log(`  - Documents to skip: ${skippedCount}`);
    
    if (documentsToImport.length === 0) {
      console.log(`✓ All ${collectionName} documents already exist - nothing to import`);
      return { importedCount: 0, errorCount: 0, skippedCount, errors: [] };
    }
    
    // Clean documents based on schema requirements
    const cleanedDocs = documentsToImport.map(doc => cleanDocument(doc, collectionName, importConfig));
    
    console.log(`  - Cleaned sample:`, JSON.stringify(cleanedDocs[0], null, 2));
    
    // Process in batches
    for (let i = 0; i < cleanedDocs.length; i += importConfig.batchSize) {
      const batch = cleanedDocs.slice(i, i + importConfig.batchSize);
      const batchNumber = Math.floor(i / importConfig.batchSize) + 1;
      const totalBatches = Math.ceil(cleanedDocs.length / importConfig.batchSize);
      
      console.log(`Processing ${collectionName} batch ${batchNumber}/${totalBatches} (${batch.length} documents)...`);
      
      try {
        // Use individual saves for better debugging
        for (let j = 0; j < batch.length; j++) {
          try {
            const result = await collection.save(batch[j], { 
              returnNew: false,
              returnOld: false,
              waitForSync: true
            });
            
            if (['categoryServices', 'serviceCategoryTranslationsEdge', 'serviceTranslationsEdge'].includes(collectionName)) {
              console.log(`    ✓ Edge ${batch[j]._from} → ${batch[j]._to} imported`);
            } else {
              console.log(`    ✓ ${collectionName} ${batch[j]._key}: ${batch[j].nameEN || batch[j].translation || 'imported'}`);
            }
            importedCount++;
            
          } catch (docError) {
            if (['categoryServices', 'serviceCategoryTranslationsEdge', 'serviceTranslationsEdge'].includes(collectionName)) {
              console.error(`    ✗ Failed edge ${batch[j]._from} → ${batch[j]._to}:`, docError.message);
            } else {
              console.error(`    ✗ Failed ${collectionName} ${batch[j]._key}:`, docError.message);
            }
            console.error(`    Document was:`, JSON.stringify(batch[j], null, 2));
            errorCount++;
            errors.push(`${collectionName} ${batch[j]._key || 'edge'}: ${docError.message}`);
          }
        }
        
        // Progress indicator
        const progress = Math.round((importedCount / cleanedDocs.length) * 100);
        console.log(`  ✓ ${collectionName} batch ${batchNumber} completed - Progress: ${progress}% (${importedCount}/${cleanedDocs.length})`);
        
      } catch (batchError) {
        console.error(`  ✗ ${collectionName} batch ${batchNumber} failed:`, batchError.message);
        errorCount += batch.length;
        errors.push(`${collectionName} batch ${batchNumber}: ${batchError.message}`);
      }
    }
    
    // Final count check
    const finalCount = await collection.count();
    console.log(`✓ ${collectionName} import completed:`);
    console.log(`  - Successfully imported: ${importedCount} documents`);
    console.log(`  - Skipped existing: ${skippedCount} documents`);
    console.log(`  - Errors: ${errorCount} documents`);
    console.log(`  - Final collection count: ${finalCount.count} documents`);
    
    return { importedCount, errorCount, skippedCount, errors };
    
  } catch (error) {
    console.error(`✗ Error during ${collectionName} import:`, error.message);
    throw error;
  }
}

// Import all data
async function importAllDocuments(collections, importData, importConfig) {
  try {
    console.log('\n=== Starting import of all collections ===');
    
    // Import in dependency order
    const categoriesResult = await importDocumentsForCollection(
      collections.serviceCategories, 
      importData.serviceCategories, 
      'serviceCategories',
      importConfig
    );
    
    const servicesResult = await importDocumentsForCollection(
      collections.services, 
      importData.services, 
      'services',
      importConfig
    );
    
    const categoryServicesResult = await importDocumentsForCollection(
      collections.categoryServices,
      importData.categoryServices,
      'categoryServices',
      importConfig
    );
    
    const serviceCategoryTranslationsResult = await importDocumentsForCollection(
      collections.serviceCategoryTranslations,
      importData.serviceCategoryTranslations,
      'serviceCategoryTranslations',
      importConfig
    );
    
    const serviceCategoryTranslationsEdgeResult = await importDocumentsForCollection(
      collections.serviceCategoryTranslationsEdge,
      importData.serviceCategoryTranslationsEdge,
      'serviceCategoryTranslationsEdge',
      importConfig
    );
    
    const serviceTranslationsResult = await importDocumentsForCollection(
      collections.serviceTranslations,
      importData.serviceTranslations,
      'serviceTranslations',
      importConfig
    );
    
    const serviceTranslationsEdgeResult = await importDocumentsForCollection(
      collections.serviceTranslationsEdge,
      importData.serviceTranslationsEdge,
      'serviceTranslationsEdge',
      importConfig
    );
    
    const totalImported = categoriesResult.importedCount + servicesResult.importedCount + 
        categoryServicesResult.importedCount + serviceCategoryTranslationsResult.importedCount + 
        serviceCategoryTranslationsEdgeResult.importedCount + serviceTranslationsResult.importedCount + 
        serviceTranslationsEdgeResult.importedCount;
    const totalSkipped = categoriesResult.skippedCount + servicesResult.skippedCount + 
        categoryServicesResult.skippedCount + serviceCategoryTranslationsResult.skippedCount + 
        serviceCategoryTranslationsEdgeResult.skippedCount + serviceTranslationsResult.skippedCount + 
        serviceTranslationsEdgeResult.skippedCount;
    const totalErrors = categoriesResult.errorCount + servicesResult.errorCount + 
        categoryServicesResult.errorCount + serviceCategoryTranslationsResult.errorCount + 
        serviceCategoryTranslationsEdgeResult.errorCount + serviceTranslationsResult.errorCount + 
        serviceTranslationsEdgeResult.errorCount;
    const allErrors = [
      ...categoriesResult.errors,
      ...servicesResult.errors,
      ...categoryServicesResult.errors,
      ...serviceCategoryTranslationsResult.errors,
      ...serviceCategoryTranslationsEdgeResult.errors,
      ...serviceTranslationsResult.errors,
      ...serviceTranslationsEdgeResult.errors
    ];
    
    console.log(`\n=== Combined Import Results ===`);
    console.log(`✓ ServiceCategories imported: ${categoriesResult.importedCount}`);
    console.log(`✓ ServiceCategories skipped: ${categoriesResult.skippedCount}`);
    console.log(`✓ Services imported: ${servicesResult.importedCount}`);
    console.log(`✓ Services skipped: ${servicesResult.skippedCount}`);
    console.log(`✓ CategoryServices edges imported: ${categoryServicesResult.importedCount}`);
    console.log(`✓ CategoryServices edges skipped: ${categoryServicesResult.skippedCount}`);
    console.log(`✓ ServiceCategoryTranslations imported: ${serviceCategoryTranslationsResult.importedCount}`);
    console.log(`✓ ServiceCategoryTranslations skipped: ${serviceCategoryTranslationsResult.skippedCount}`);
    console.log(`✓ ServiceCategoryTranslationsEdge imported: ${serviceCategoryTranslationsEdgeResult.importedCount}`);
    console.log(`✓ ServiceCategoryTranslationsEdge skipped: ${serviceCategoryTranslationsEdgeResult.skippedCount}`);
    console.log(`✓ ServiceTranslations imported: ${serviceTranslationsResult.importedCount}`);
    console.log(`✓ ServiceTranslations skipped: ${serviceTranslationsResult.skippedCount}`);
    console.log(`✓ ServiceTranslationsEdge imported: ${serviceTranslationsEdgeResult.importedCount}`);
    console.log(`✓ ServiceTranslationsEdge skipped: ${serviceTranslationsEdgeResult.skippedCount}`);
    console.log(`✓ Total items imported: ${totalImported}`);
    console.log(`✓ Total items skipped: ${totalSkipped}`);
    console.log(`${totalErrors > 0 ? '⚠' : '✓'} Total errors: ${totalErrors}`);
    
    if (allErrors.length > 0 && allErrors.length <= 10) {
      console.log('All errors encountered:');
      allErrors.forEach(error => console.log(`  - ${error}`));
    } else if (allErrors.length > 10) {
      console.log(`First 10 errors encountered:`);
      allErrors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
      console.log(`  ... and ${allErrors.length - 10} more errors`);
    }
    
    return {
      serviceCategories: categoriesResult,
      services: servicesResult,
      categoryServices: categoryServicesResult,
      serviceCategoryTranslations: serviceCategoryTranslationsResult,
      serviceCategoryTranslationsEdge: serviceCategoryTranslationsEdgeResult,
      serviceTranslations: serviceTranslationsResult,
      serviceTranslationsEdge: serviceTranslationsEdgeResult,
      totals: {
        importedCount: totalImported,
        skippedCount: totalSkipped,
        errorCount: totalErrors,
        errors: allErrors
      }
    };
    
  } catch (error) {
    console.error('✗ Error during import:', error.message);
    throw error;
  }
}

// Verify imported data
async function verifyImport(collections, originalData) {
  try {
    console.log('\n=== Verifying imported data ===');
    
    const counts = await Promise.all([
      collections.serviceCategories.count(),
      collections.services.count(),
      collections.categoryServices.count(),
      collections.serviceCategoryTranslations.count(),
      collections.serviceCategoryTranslationsEdge.count(),
      collections.serviceTranslations.count(),
      collections.serviceTranslationsEdge.count()
    ]);
    
    console.log(`Document counts:`);
    console.log(`  - Expected serviceCategories: ${originalData.serviceCategories.length}`);
    console.log(`  - Actual serviceCategories: ${counts[0].count}`);
    console.log(`  - Expected services: ${originalData.services.length}`);
    console.log(`  - Actual services: ${counts[1].count}`);
    console.log(`  - Expected categoryServices edges: ${originalData.categoryServices.length}`);
    console.log(`  - Actual categoryServices edges: ${counts[2].count}`);
    console.log(`  - Expected serviceCategoryTranslations: ${originalData.serviceCategoryTranslations.length}`);
    console.log(`  - Actual serviceCategoryTranslations: ${counts[3].count}`);
    console.log(`  - Expected serviceCategoryTranslationsEdge: ${originalData.serviceCategoryTranslationsEdge.length}`);
    console.log(`  - Actual serviceCategoryTranslationsEdge: ${counts[4].count}`);
    console.log(`  - Expected serviceTranslations: ${originalData.serviceTranslations.length}`);
    console.log(`  - Actual serviceTranslations: ${counts[5].count}`);
    console.log(`  - Expected serviceTranslationsEdge: ${originalData.serviceTranslationsEdge.length}`);
    console.log(`  - Actual serviceTranslationsEdge: ${counts[6].count}`);
    
    // Sample verification for serviceCategories
    const categorySampleSize = Math.min(3, originalData.serviceCategories.length);
    const categorySampleKeys = originalData.serviceCategories.slice(0, categorySampleSize).map(doc => doc._key);
    
    console.log(`\nVerifying ${categorySampleSize} sample serviceCategories...`);
    let categoryVerifiedCount = 0;

    for (const key of categorySampleKeys) {
      try {
        const doc = await collections.serviceCategories.document(key);
        if (doc) {
          categoryVerifiedCount++;
          console.log(`  ✓ serviceCategory ${key}: ${doc.nameEN}`);
        }
      } catch (error) {
        console.log(`  ✗ serviceCategory ${key}: not found`);
      }
    }
    
    // Sample verification for services
    const serviceSampleSize = Math.min(3, originalData.services.length);
    const serviceSampleKeys = originalData.services.slice(0, serviceSampleSize).map(doc => doc._key);
    
    console.log(`\nVerifying ${serviceSampleSize} sample services...`);
    let serviceVerifiedCount = 0;
    
    for (const key of serviceSampleKeys) {
      try {
        const doc = await collections.services.document(key);
        if (doc) {
          serviceVerifiedCount++;
          console.log(`  ✓ service ${key}: ${doc.nameEN} (category: ${doc.categoryId})`);
        }
      } catch (error) {
        console.log(`  ✗ service ${key}: not found`);
      }
    }
    
    // Sample verification for categoryServices edges
    const edgeSampleSize = Math.min(3, originalData.categoryServices.length);
    const edgeSamples = originalData.categoryServices.slice(0, edgeSampleSize);
    
    console.log(`\nVerifying ${edgeSampleSize} sample categoryServices edges...`);
    let edgeVerifiedCount = 0;
    
    for (const edgeSample of edgeSamples) {
      try {
        const query = `
          FOR edge IN categoryServices
            FILTER edge._from == @from AND edge._to == @to
            RETURN edge
        `;
        const cursor = await db.query(query, { from: edgeSample._from, to: edgeSample._to });
        const results = await cursor.all();
        
        if (results.length > 0) {
          edgeVerifiedCount++;
          console.log(`  ✓ edge ${edgeSample._from} → ${edgeSample._to} found`);
        } else {
          console.log(`  ✗ edge ${edgeSample._from} → ${edgeSample._to} not found`);
        }
      } catch (error) {
        console.log(`  ✗ edge ${edgeSample._from} → ${edgeSample._to} verification failed: ${error.message}`);
      }
    }
    
    // Sample verification for serviceCategoryTranslations
    const categoryTranslationSampleSize = Math.min(3, originalData.serviceCategoryTranslations.length);
    const categoryTranslationSampleKeys = originalData.serviceCategoryTranslations.slice(0, categoryTranslationSampleSize).map(doc => doc._key);
    
    console.log(`\nVerifying ${categoryTranslationSampleSize} sample serviceCategoryTranslations...`);
    let categoryTranslationVerifiedCount = 0;
    
    for (const key of categoryTranslationSampleKeys) {
      try {
        const doc = await collections.serviceCategoryTranslations.document(key);
        if (doc) {
          categoryTranslationVerifiedCount++;
          console.log(`  ✓ serviceCategoryTranslation ${key}: ${doc.translation} (${doc.languageCode})`);
        }
      } catch (error) {
        console.log(`  ✗ serviceCategoryTranslation ${key}: not found`);
      }
    }
    
    // Sample verification for serviceCategoryTranslationsEdge
    const categoryTranslationEdgeSampleSize = Math.min(3, originalData.serviceCategoryTranslationsEdge.length);
    const categoryTranslationEdgeSamples = originalData.serviceCategoryTranslationsEdge.slice(0, categoryTranslationEdgeSampleSize);
    
    console.log(`\nVerifying ${categoryTranslationEdgeSampleSize} sample serviceCategoryTranslationsEdge...`);
    let categoryTranslationEdgeVerifiedCount = 0;
    
    for (const edgeSample of categoryTranslationEdgeSamples) {
      try {
        const query = `
          FOR edge IN serviceCategoryTranslationsEdge
            FILTER edge._from == @from AND edge._to == @to
            RETURN edge
        `;
        const cursor = await db.query(query, { from: edgeSample._from, to: edgeSample._to });
        const results = await cursor.all();
        
        if (results.length > 0) {
          categoryTranslationEdgeVerifiedCount++;
          console.log(`  ✓ edge ${edgeSample._from} → ${edgeSample._to} found`);
        } else {
          console.log(`  ✗ edge ${edgeSample._from} → ${edgeSample._to} not found`);
        }
      } catch (error) {
        console.log(`  ✗ edge ${edgeSample._from} → ${edgeSample._to} verification failed: ${error.message}`);
      }
    }
    
    // Sample verification for serviceTranslations
    const serviceTranslationSampleSize = Math.min(3, originalData.serviceTranslations.length);
    const serviceTranslationSampleKeys = originalData.serviceTranslations.slice(0, serviceTranslationSampleSize).map(doc => doc._key);
    
    console.log(`\nVerifying ${serviceTranslationSampleSize} sample serviceTranslations...`);
    let serviceTranslationVerifiedCount = 0;
    
    for (const key of serviceTranslationSampleKeys) {
      try {
        const doc = await collections.serviceTranslations.document(key);
        if (doc) {
          serviceTranslationVerifiedCount++;
          console.log(`  ✓ serviceTranslation ${key}: ${doc.translation} (${doc.languageCode})`);
        }
      } catch (error) {
        console.log(`  ✗ serviceTranslation ${key}: not found`);
      }
    }
    
    // Sample verification for serviceTranslationsEdge
    const serviceTranslationEdgeSampleSize = Math.min(3, originalData.serviceTranslationsEdge.length);
    const serviceTranslationEdgeSamples = originalData.serviceTranslationsEdge.slice(0, serviceTranslationEdgeSampleSize);
    
    console.log(`\nVerifying ${serviceTranslationEdgeSampleSize} sample serviceTranslationsEdge...`);
    let serviceTranslationEdgeVerifiedCount = 0;
    
    for (const edgeSample of serviceTranslationEdgeSamples) {
      try {
        const query = `
          FOR edge IN serviceTranslationsEdge
            FILTER edge._from == @from AND edge._to == @to
            RETURN edge
        `;
        const cursor = await db.query(query, { from: edgeSample._from, to: edgeSample._to });
        const results = await cursor.all();
        
        if (results.length > 0) {
          serviceTranslationEdgeVerifiedCount++;
          console.log(`  ✓ edge ${edgeSample._from} → ${edgeSample._to} found`);
        } else {
          console.log(`  ✗ edge ${edgeSample._from} → ${edgeSample._to} not found`);
        }
      } catch (error) {
        console.log(`  ✗ edge ${edgeSample._from} → ${edgeSample._to} verification failed: ${error.message}`);
      }
    }
    
    // Verify relationships
    console.log('\nVerifying relationships...');
    const relationshipQuery = `
      FOR cat IN serviceCategories
        LIMIT 2
        LET services = (
          FOR edge IN categoryServices
            FILTER edge._from == CONCAT('serviceCategories/', cat._key)
            FOR svc IN services
              FILTER svc._id == edge._to
              RETURN svc.nameEN
        )
        LET categoryTranslations = (
          FOR edge IN serviceCategoryTranslationsEdge
            FILTER edge._from == CONCAT('serviceCategories/', cat._key)
            FOR trans IN serviceCategoryTranslations
              FILTER trans._id == edge._to
              RETURN { language: trans.languageCode, translation: trans.translation }
        )
        RETURN {
          category: cat.nameEN,
          serviceCount: LENGTH(services),
          sampleServices: services[* LIMIT 3],
          translations: categoryTranslations
        }
    `;
    
    try {
      const relCursor = await db.query(relationshipQuery);
      const relResults = await relCursor.all();
      
      console.log('Category-Service relationships:');
      relResults.forEach(result => {
        console.log(`  - ${result.category}: ${result.serviceCount} services`);
        if (result.sampleServices.length > 0) {
          console.log(`    Services: ${result.sampleServices.join(', ')}`);
        }
        if (result.translations.length > 0) {
          console.log(`    Translations: ${result.translations.map(t => `${t.language}: ${t.translation}`).join(', ')}`);
        }
      });
    } catch (error) {
      console.log(`  ⚠ Could not verify relationships: ${error.message}`);
    }
    
    const categorySuccess = categorySampleSize === 0 || categoryVerifiedCount === categorySampleSize;
    const serviceSuccess = serviceSampleSize === 0 || serviceVerifiedCount === serviceSampleSize;
    const edgeSuccess = edgeSampleSize === 0 || edgeVerifiedCount === edgeSampleSize;
    const categoryTranslationSuccess = categoryTranslationSampleSize === 0 || categoryTranslationVerifiedCount === categoryTranslationSampleSize;
    const categoryTranslationEdgeSuccess = categoryTranslationEdgeSampleSize === 0 || categoryTranslationEdgeVerifiedCount === categoryTranslationEdgeSampleSize;
    const serviceTranslationSuccess = serviceTranslationSampleSize === 0 || serviceTranslationVerifiedCount === serviceTranslationSampleSize;
    const serviceTranslationEdgeSuccess = serviceTranslationEdgeSampleSize === 0 || serviceTranslationEdgeVerifiedCount === serviceTranslationEdgeSampleSize;
    const overallSuccess = categorySuccess && serviceSuccess && edgeSuccess && 
        categoryTranslationSuccess && categoryTranslationEdgeSuccess && 
        serviceTranslationSuccess && serviceTranslationEdgeSuccess;
    
    console.log(`\n${overallSuccess ? '✓' : '✗'} Verification ${overallSuccess ? 'passed' : 'failed'}`);
    console.log(`  - ServiceCategories: ${categoryVerifiedCount}/${categorySampleSize} samples found`);
    console.log(`  - Services: ${serviceVerifiedCount}/${serviceSampleSize} samples found`);
    console.log(`  - CategoryServices edges: ${edgeVerifiedCount}/${edgeSampleSize} samples found`);
    console.log(`  - ServiceCategoryTranslations: ${categoryVerifiedCount}/${categoryTranslationSampleSize} samples found`);
    console.log(`  - ServiceCategoryTranslationsEdge: ${categoryTranslationEdgeVerifiedCount}/${categoryTranslationEdgeSampleSize} samples found`);
    console.log(`  - ServiceTranslations: ${serviceVerifiedCount}/${serviceTranslationSampleSize} samples found`);
    console.log(`  - ServiceTranslationsEdge: ${serviceTranslationEdgeVerifiedCount}/${serviceTranslationEdgeSampleSize} samples found`);
    
    return overallSuccess;
    
  } catch (error) {
    console.error('✗ Error during verification:', error.message);
    return false;
  }
}

// Main import function
async function executeImport(dbConfig, importConfig) {
  console.log('=== ArangoDB ServiceCategories, Services & Translations Data Import ===\n');
  
  try {
    // Initialize database connection
    await initializeDatabase(dbConfig);
    
    // Read and validate import file
    const importData = await readImportFile(importConfig);
    
    if (importData.serviceCategories.length === 0 && importData.services.length === 0 && 
        importData.categoryServices.length === 0 && importData.serviceCategoryTranslations.length === 0 &&
        importData.serviceCategoryTranslationsEdge.length === 0 && importData.serviceTranslations.length === 0 &&
        importData.serviceTranslationsEdge.length === 0) {
      console.log('⚠ No data to import');
      return false;
    }
    
    // Validate import data
    const isValid = await validateImportData(importData, importConfig);
    if (!isValid) {
      console.log('✗ Import aborted due to validation errors');
      return false;
    }
    
    // Ensure target database exists
    await ensureTargetDatabase(dbConfig, importConfig);
    
    // Create collections
    const collections = {
      serviceCategories: await createServiceCategoriesCollection(importConfig),
      services: await createServicesCollection(importConfig),
      categoryServices: await createCategoryServicesCollection(importConfig),
      serviceCategoryTranslations: await createServiceCategoryTranslationsCollection(importConfig),
      serviceCategoryTranslationsEdge: await createServiceCategoryTranslationsEdgeCollection(importConfig),
      serviceTranslations: await createServiceTranslationsCollection(importConfig),
      serviceTranslationsEdge: await createServiceTranslationsEdgeCollection(importConfig)
    };
    
    // Check for existing data conflicts
    const { conflicts, canProceed } = await checkExistingData(collections, importData, importConfig);
    if (!canProceed) {
      console.log('✗ Import aborted due to existing data conflicts');
      return false;
    }
    
    // Perform import
    const importResult = await importAllDocuments(collections, importData, importConfig);
    
    // Verify import
    const verificationSuccess = await verifyImport(collections, importData, importConfig);
    
    console.log('\n=== Final Import Summary ===');
    console.log(`✓ Database: ${dbConfig.databaseName}`);
    console.log(`✓ ServiceCategories imported: ${importResult.serviceCategories.importedCount}`);
    console.log(`✓ ServiceCategories skipped: ${importResult.serviceCategories.skippedCount}`);
    console.log(`✓ Services imported: ${importResult.services.importedCount}`);
    console.log(`✓ Services skipped: ${importResult.services.skippedCount}`);
    console.log(`✓ CategoryServices edges imported: ${importResult.categoryServices.importedCount}`);
    console.log(`✓ CategoryServices edges skipped: ${importResult.categoryServices.skippedCount}`);
    console.log(`✓ ServiceCategoryTranslations imported: ${importResult.serviceCategoryTranslations.importedCount}`);
    console.log(`✓ ServiceCategoryTranslations skipped: ${importResult.serviceCategoryTranslations.skippedCount}`);
    console.log(`✓ ServiceCategoryTranslationsEdge imported: ${importResult.serviceCategoryTranslationsEdge.importedCount}`);
    console.log(`✓ ServiceCategoryTranslationsEdge skipped: ${importResult.serviceCategoryTranslationsEdge.skippedCount}`);
    console.log(`✓ ServiceTranslations imported: ${importResult.serviceTranslations.importedCount}`);
    console.log(`✓ ServiceTranslations skipped: ${importResult.serviceTranslations.skippedCount}`);
    console.log(`✓ ServiceTranslationsEdge imported: ${importResult.serviceTranslationsEdge.importedCount}`);
    console.log(`✓ ServiceTranslationsEdge skipped: ${importResult.serviceTranslationsEdge.skippedCount}`);
    console.log(`✓ Total items imported: ${importResult.totals.importedCount}`);
    console.log(`✓ Total items skipped: ${importResult.totals.skippedCount}`);
    console.log(`${importResult.totals.errorCount > 0 ? '⚠' : '✓'} Total errors: ${importResult.totals.errorCount}`);
    console.log(`${verificationSuccess ? '✓' : '✗'} Verification: ${verificationSuccess ? 'passed' : 'failed'}`);
    
    const success = (importResult.totals.importedCount > 0 || importResult.totals.skippedCount > 0) && 
        importResult.totals.errorCount === 0 && verificationSuccess;
    
    console.log('\n=== Next Steps ===');
    if (success) {
      console.log('1. Run your application tests against the new database');
      console.log('2. Update your application configuration to use the new database');
      console.log('3. Verify the parent-child relationships between serviceCategories and services work correctly');
      console.log('4. Test that categoryServices edges properly link categories to their services');
      console.log('5. Verify translation data is accessible in all supported languages');
      console.log('6. Test translation edges for proper connectivity');
    } else {
      console.log('1. Review the errors above');
      console.log('2. Fix the import file or configuration');
      console.log('3. Re-run the import script');
    }
    
    return success;
    
  } catch (error) {
    console.error('\n✗ Import failed:', error.message);
    return false;
  }
}

// Main entry point
async function main() {
    // --- Database Configuration ---
    const dbConfig = {
        url: process.env.ARANGO_URL || 'http://localhost:8529',
        databaseName: process.env.ARANGO_DATABASE || 'test-node-services',
        auth: {
            username: process.env.ARANGO_USERNAME || 'root',
            password: process.env.ARANGO_PASSWORD || 'test'
        }
    };

    // --- User Confirmation ---
    console.log('The script is configured with the following settings:');
    console.log(`- ArangoDB URL: ${dbConfig.url}`);
    console.log(`- Database Name: ${dbConfig.databaseName}`);
    console.log(`- Username: ${dbConfig.auth.username}`);
    console.log('--------------------------------------------------');
    
    const answer = await askQuestion('Are you sure you want to proceed with these settings? (Y/n) ');
    if (answer.toLowerCase() !== 'y') {
        console.log('Operation cancelled by user.');
        process.exit(0);
    }
    
    await loadInquirer();

    // --- Define Base Import Config ---
    const IMPORT_CONFIG = {
        inputFile: process.env.IMPORT_FILE || './exports/serviceCategoriesAndServices_export_2025-06-19T14-55-00.json',
        createDatabase: process.env.CREATE_DATABASE !== 'false', // default true
        createCollection: process.env.CREATE_COLLECTION !== 'false', // default true
        overwriteExisting: process.env.OVERWRITE_EXISTING === 'true' || false,
        batchSize: parseInt(process.env.BATCH_SIZE) || 100,
        validateBeforeImport: process.env.VALIDATE_BEFORE_IMPORT !== 'false', // default true
        schemaStrict: process.env.SCHEMA_STRICT === 'true' || true // only include original fields
    };

    // --- Interactive Import Config ---
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'inputFile',
            message: 'Enter the path to the import JSON file:',
            default: IMPORT_CONFIG.inputFile,
        },
        {
            type: 'confirm',
            name: 'createDatabase',
            message: 'Create the database if it does not exist?',
            default: IMPORT_CONFIG.createDatabase,
        },
        {
            type: 'confirm',
            name: 'createCollection',
            message: 'Create collections if they do not exist?',
            default: IMPORT_CONFIG.createCollection,
        },
        {
            type: 'confirm',
            name: 'validateBeforeImport',
            message: 'Validate the import file before processing?',
            default: IMPORT_CONFIG.validateBeforeImport,
        },
        {
            type: 'number',
            name: 'batchSize',
            message: 'Enter the batch size for import:',
            default: IMPORT_CONFIG.batchSize,
        }
    ]);

    const importConfig = {
        ...IMPORT_CONFIG, // Keep other defaults not prompted for
        ...answers
    };


    executeImport(dbConfig, importConfig).then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Import script crashed:', error);
        process.exit(1);
    });
}


// Command line interface
if (require.main === module) {
  main();
}

module.exports = {
  executeImport,
  importAllDocuments,
  validateImportData,
  initializeDatabase,
  createServiceCategoriesCollection,
  createServicesCollection,
  createCategoryServicesCollection,
  createServiceCategoryTranslationsCollection,
  createServiceCategoryTranslationsEdgeCollection,
  createServiceTranslationsCollection,
  createServiceTranslationsEdgeCollection
};