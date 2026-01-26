const { Database } = require('arangojs');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

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

// Export configuration
const EXPORT_CONFIG = {
  outputDir: process.env.EXPORT_DIR || './exports',
  filename: process.env.EXPORT_FILENAME || `serviceCategoriesAndServices_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`,
  includeSystemFields: process.env.INCLUDE_SYSTEM_FIELDS === 'true' || false,
  prettyPrint: process.env.PRETTY_PRINT !== 'false' // default true
};

let db;

// Initialize database connection
async function initializeDatabase(dbConfig) {
  try {
    console.log(`Connecting to ArangoDB at ${dbConfig.url}...`);
    
    db = new Database({
      url: dbConfig.url,
      databaseName: dbConfig.databaseName,
      auth: dbConfig.auth
    });
    
    // Test connection
    const info = await db.get();
    console.log(`✓ Connected to database: ${info.name} (version: ${info.version})`);
    
    return db;
  } catch (error) {
    console.error('✗ Failed to connect to database:', error.message);
    throw error;
  }
}

// Check if all collections exist and get info
async function validateCollections() {
  try {
    console.log('Validating collections...');
    
    const collections = {
      serviceCategories: db.collection('serviceCategories'),
      services: db.collection('services'),
      categoryServices: db.collection('categoryServices'),
      serviceCategoryTranslations: db.collection('serviceCategoryTranslations'),
      serviceCategoryTranslationsEdge: db.collection('serviceCategoryTranslationsEdge'),
      serviceTranslations: db.collection('serviceTranslations'),
      serviceTranslationsEdge: db.collection('serviceTranslationsEdge')
    };
    
    const existence = await Promise.all([
      collections.serviceCategories.exists(),
      collections.services.exists(),
      collections.categoryServices.exists(),
      collections.serviceCategoryTranslations.exists(),
      collections.serviceCategoryTranslationsEdge.exists(),
      collections.serviceTranslations.exists(),
      collections.serviceTranslationsEdge.exists()
    ]);
    
    console.log(`Collection existence check:`);
    console.log(`  - serviceCategories: ${existence[0] ? 'EXISTS' : 'MISSING'}`);
    console.log(`  - services: ${existence[1] ? 'EXISTS' : 'MISSING'}`);
    console.log(`  - categoryServices: ${existence[2] ? 'EXISTS' : 'MISSING'}`);
    console.log(`  - serviceCategoryTranslations: ${existence[3] ? 'EXISTS' : 'MISSING'}`);
    console.log(`  - serviceCategoryTranslationsEdge: ${existence[4] ? 'EXISTS' : 'MISSING'}`);
    console.log(`  - serviceTranslations: ${existence[5] ? 'EXISTS' : 'MISSING'}`);
    console.log(`  - serviceTranslationsEdge: ${existence[6] ? 'EXISTS' : 'MISSING'}`);
    
    if (!existence[0]) {
      throw new Error('serviceCategories collection does not exist');
    }
    
    if (!existence[1]) {
      throw new Error('services collection does not exist');
    }
    
    if (!existence[2]) {
      console.log('⚠ Warning: categoryServices edge collection does not exist - will export without edges');
    }
    
    if (!existence[3]) {
      console.log('⚠ Warning: serviceCategoryTranslations collection does not exist - will export without category translations');
    }
    
    if (!existence[4]) {
      console.log('⚠ Warning: serviceCategoryTranslationsEdge collection does not exist - will export without category translation edges');
    }
    
    if (!existence[5]) {
      console.log('⚠ Warning: serviceTranslations collection does not exist - will export without service translations');
    }
    
    if (!existence[6]) {
      console.log('⚠ Warning: serviceTranslationsEdge collection does not exist - will export without service translation edges');
    }
    
    const [categoriesInfo, servicesInfo] = await Promise.all([
      collections.serviceCategories.get(),
      collections.services.get()
    ]);
    
    const [categoriesCount, servicesCount] = await Promise.all([
      collections.serviceCategories.count(),
      collections.services.count()
    ]);
    
    let categoryServicesInfo = null, categoryServicesCount = { count: 0 };
    let serviceCategoryTranslationsInfo = null, serviceCategoryTranslationsCount = { count: 0 };
    let serviceCategoryTranslationsEdgeInfo = null, serviceCategoryTranslationsEdgeCount = { count: 0 };
    let serviceTranslationsInfo = null, serviceTranslationsCount = { count: 0 };
    let serviceTranslationsEdgeInfo = null, serviceTranslationsEdgeCount = { count: 0 };
    
    if (existence[2]) {
      [categoryServicesInfo, categoryServicesCount] = await Promise.all([
        collections.categoryServices.get(),
        collections.categoryServices.count()
      ]);
    }
    
    if (existence[3]) {
      [serviceCategoryTranslationsInfo, serviceCategoryTranslationsCount] = await Promise.all([
        collections.serviceCategoryTranslations.get(),
        collections.serviceCategoryTranslations.count()
      ]);
    }
    
    if (existence[4]) {
      [serviceCategoryTranslationsEdgeInfo, serviceCategoryTranslationsEdgeCount] = await Promise.all([
        collections.serviceCategoryTranslationsEdge.get(),
        collections.serviceCategoryTranslationsEdge.count()
      ]);
    }
    
    if (existence[5]) {
      [serviceTranslationsInfo, serviceTranslationsCount] = await Promise.all([
        collections.serviceTranslations.get(),
        collections.serviceTranslations.count()
      ]);
    }
    
    if (existence[6]) {
      [serviceTranslationsEdgeInfo, serviceTranslationsEdgeCount] = await Promise.all([
        collections.serviceTranslationsEdge.get(),
        collections.serviceTranslationsEdge.count()
      ]);
    }
    
    console.log(`✓ Collections validated:`);
    console.log(`  - serviceCategories: ${categoriesInfo.type === 2 ? 'Document' : 'Edge'} collection with ${categoriesCount.count} documents`);
    console.log(`  - services: ${servicesInfo.type === 2 ? 'Document' : 'Edge'} collection with ${servicesCount.count} documents`);
    console.log(`  - categoryServices: ${categoryServicesInfo ? (categoryServicesInfo.type === 3 ? 'Edge' : 'Document') : 'Not Present'} collection with ${categoryServicesCount.count} edges`);
    console.log(`  - serviceCategoryTranslations: ${serviceCategoryTranslationsInfo ? (serviceCategoryTranslationsInfo.type === 2 ? 'Document' : 'Edge') : 'Not Present'} collection with ${serviceCategoryTranslationsCount.count} documents`);
    console.log(`  - serviceCategoryTranslationsEdge: ${serviceCategoryTranslationsEdgeInfo ? (serviceCategoryTranslationsEdgeInfo.type === 3 ? 'Edge' : 'Document') : 'Not Present'} collection with ${serviceCategoryTranslationsEdgeCount.count} edges`);
    console.log(`  - serviceTranslations: ${serviceTranslationsInfo ? (serviceTranslationsInfo.type === 2 ? 'Document' : 'Edge') : 'Not Present'} collection with ${serviceTranslationsCount.count} documents`);
    console.log(`  - serviceTranslationsEdge: ${serviceTranslationsEdgeInfo ? (serviceTranslationsEdgeInfo.type === 3 ? 'Edge' : 'Document') : 'Not Present'} collection with ${serviceTranslationsEdgeCount.count} edges`);
    
    return {
      serviceCategories: { collection: collections.serviceCategories, count: categoriesCount.count },
      services: { collection: collections.services, count: servicesCount.count },
      categoryServices: existence[2] ? { collection: collections.categoryServices, count: categoryServicesCount.count } : null,
      serviceCategoryTranslations: existence[3] ? { collection: collections.serviceCategoryTranslations, count: serviceCategoryTranslationsCount.count } : null,
      serviceCategoryTranslationsEdge: existence[4] ? { collection: collections.serviceCategoryTranslationsEdge, count: serviceCategoryTranslationsEdgeCount.count } : null,
      serviceTranslations: existence[5] ? { collection: collections.serviceTranslations, count: serviceTranslationsCount.count } : null,
      serviceTranslationsEdge: existence[6] ? { collection: collections.serviceTranslationsEdge, count: serviceTranslationsEdgeCount.count } : null
    };
  } catch (error) {
    console.error('✗ Error validating collections:', error.message);
    throw error;
  }
}

// Create export directory if it doesn't exist
async function ensureExportDirectory() {
  try {
    await fs.mkdir(EXPORT_CONFIG.outputDir, { recursive: true });
    console.log(`✓ Export directory ready: ${EXPORT_CONFIG.outputDir}`);
  } catch (error) {
    console.error('✗ Error creating export directory:', error.message);
    throw error;
  }
}

// Export all collections data
async function exportServiceCategoriesAndServices(dbConfig) {
  try {
    console.log('Starting export of all collections...');
    
    // Build AQL queries for all collections based on configuration
    let serviceCategoriesQuery, servicesQuery, categoryServicesQuery,
        serviceCategoryTranslationsQuery, serviceCategoryTranslationsEdgeQuery,
        serviceTranslationsQuery, serviceTranslationsEdgeQuery;
    
    if (!EXPORT_CONFIG.includeSystemFields) {
      serviceCategoriesQuery = `
        FOR doc IN serviceCategories
          SORT doc.order ASC
          RETURN {
            _key: doc._key,
            nameEN: doc.nameEN,
            nameFR: doc.nameFR,
            nameSW: doc.nameSW,
            order: doc.order,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
          }`;
      
      servicesQuery = `
        FOR doc IN services
          SORT doc.categoryId ASC, doc.order ASC
          RETURN {
            _key: doc._key,
            categoryId: doc.categoryId,
            nameEN: doc.nameEN,
            nameFR: doc.nameFR,
            nameSW: doc.nameSW,
            description: doc.description,
            order: doc.order,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
          }`;
          
      categoryServicesQuery = `
        FOR doc IN categoryServices
          SORT doc._from ASC, doc.order ASC
          RETURN {
            _key: doc._key,
            _from: doc._from,
            _to: doc._to,
            order: doc.order,
            createdAt: doc.createdAt
          }`;
      
      serviceCategoryTranslationsQuery = `
        FOR doc IN serviceCategoryTranslations
          SORT doc.serviceCategoryId ASC, doc.languageCode ASC
          RETURN {
            _key: doc._key,
            serviceCategoryId: doc.serviceCategoryId,
            languageCode: doc.languageCode,
            translation: doc.translation,
            isActive: doc.isActive,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
          }`;
      
      serviceCategoryTranslationsEdgeQuery = `
        FOR doc IN serviceCategoryTranslationsEdge
          SORT doc._from ASC
          RETURN {
            _key: doc._key,
            _from: doc._from,
            _to: doc._to,
            createdAt: doc.createdAt
          }`;
      
      serviceTranslationsQuery = `
        FOR doc IN serviceTranslations
          SORT doc.serviceId ASC, doc.languageCode ASC
          RETURN {
            _key: doc._key,
            serviceId: doc.serviceId,
            languageCode: doc.languageCode,
            translation: doc.translation,
            isActive: doc.isActive,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
          }`;
      
      serviceTranslationsEdgeQuery = `
        FOR doc IN serviceTranslationsEdge
          SORT doc._from ASC
          RETURN {
            _key: doc._key,
            _from: doc._from,
            _to: doc._to,
            createdAt: doc.createdAt
          }`;
    } else {
      serviceCategoriesQuery = `
        FOR doc IN serviceCategories
          SORT doc.order ASC
          RETURN doc`;
      
      servicesQuery = `
        FOR doc IN services
          SORT doc.categoryId ASC, doc.order ASC
          RETURN doc`;
          
      categoryServicesQuery = `
        FOR doc IN categoryServices
          SORT doc._from ASC, doc.order ASC
          RETURN doc`;
      
      serviceCategoryTranslationsQuery = `
        FOR doc IN serviceCategoryTranslations
          SORT doc.serviceCategoryId ASC, doc.languageCode ASC
          RETURN doc`;
      
      serviceCategoryTranslationsEdgeQuery = `
        FOR doc IN serviceCategoryTranslationsEdge
          SORT doc._from ASC
          RETURN doc`;
      
      serviceTranslationsQuery = `
        FOR doc IN serviceTranslations
          SORT doc.serviceId ASC, doc.languageCode ASC
          RETURN doc`;
      
      serviceTranslationsEdgeQuery = `
        FOR doc IN serviceTranslationsEdge
          SORT doc._from ASC
          RETURN doc`;
    }
    
    console.log('Executing export queries...');
    
    // Execute queries
    const [
      serviceCategoriesCursor,
      servicesCursor,
      categoryServicesExists,
      serviceCategoryTranslationsExists,
      serviceCategoryTranslationsEdgeExists,
      serviceTranslationsExists,
      serviceTranslationsEdgeExists
    ] = await Promise.all([
      db.query(serviceCategoriesQuery),
      db.query(servicesQuery),
      db.collection('categoryServices').exists(),
      db.collection('serviceCategoryTranslations').exists(),
      db.collection('serviceCategoryTranslationsEdge').exists(),
      db.collection('serviceTranslations').exists(),
      db.collection('serviceTranslationsEdge').exists()
    ]);
    
    const [
      serviceCategoriesDocuments,
      servicesDocuments
    ] = await Promise.all([
      serviceCategoriesCursor.all(),
      servicesCursor.all()
    ]);
    
    console.log(`  ✓ Retrieved ${serviceCategoriesDocuments.length} serviceCategories documents`);
    console.log(`  ✓ Retrieved ${servicesDocuments.length} services documents`);
    
    // Handle optional collections
    let categoryServicesDocuments = [];
    let serviceCategoryTranslationsDocuments = [];
    let serviceCategoryTranslationsEdgeDocuments = [];
    let serviceTranslationsDocuments = [];
    let serviceTranslationsEdgeDocuments = [];
    
    if (categoryServicesExists) {
      console.log('  - Executing categoryServices query...');
      const cursor = await db.query(categoryServicesQuery);
      categoryServicesDocuments = await cursor.all();
      console.log(`  ✓ Retrieved ${categoryServicesDocuments.length} categoryServices edges`);
    } else {
      console.log('  ⚠ Skipping categoryServices - collection does not exist');
    }
    
    if (serviceCategoryTranslationsExists) {
      console.log('  - Executing serviceCategoryTranslations query...');
      const cursor = await db.query(serviceCategoryTranslationsQuery);
      serviceCategoryTranslationsDocuments = await cursor.all();
      console.log(`  ✓ Retrieved ${serviceCategoryTranslationsDocuments.length} serviceCategoryTranslations documents`);
    } else {
      console.log('  ⚠ Skipping serviceCategoryTranslations - collection does not exist');
    }
    
    if (serviceCategoryTranslationsEdgeExists) {
      console.log('  - Executing serviceCategoryTranslationsEdge query...');
      const cursor = await db.query(serviceCategoryTranslationsEdgeQuery);
      serviceCategoryTranslationsEdgeDocuments = await cursor.all();
      console.log(`  ✓ Retrieved ${serviceCategoryTranslationsEdgeDocuments.length} serviceCategoryTranslationsEdge edges`);
    } else {
      console.log('  ⚠ Skipping serviceCategoryTranslationsEdge - collection does not exist');
    }
    
    if (serviceTranslationsExists) {
      console.log('  - Executing serviceTranslations query...');
      const cursor = await db.query(serviceTranslationsQuery);
      serviceTranslationsDocuments = await cursor.all();
      console.log(`  ✓ Retrieved ${serviceTranslationsDocuments.length} serviceTranslations documents`);
    } else {
      console.log('  ⚠ Skipping serviceTranslations - collection does not exist');
    }
    
    if (serviceTranslationsEdgeExists) {
      console.log('  - Executing serviceTranslationsEdge query...');
      const cursor = await db.query(serviceTranslationsEdgeQuery);
      serviceTranslationsEdgeDocuments = await cursor.all();
      console.log(`  ✓ Retrieved ${serviceTranslationsEdgeDocuments.length} serviceTranslationsEdge edges`);
    } else {
      console.log('  ⚠ Skipping serviceTranslationsEdge - collection does not exist');
    }
    
    console.log(`Export data summary:`);
    console.log(`  - ServiceCategories: ${serviceCategoriesDocuments.length} documents`);
    console.log(`  - Services: ${servicesDocuments.length} documents`);
    console.log(`  - CategoryServices: ${categoryServicesDocuments.length} edges`);
    console.log(`  - ServiceCategoryTranslations: ${serviceCategoryTranslationsDocuments.length} documents`);
    console.log(`  - ServiceCategoryTranslationsEdge: ${serviceCategoryTranslationsEdgeDocuments.length} edges`);
    console.log(`  - ServiceTranslations: ${serviceTranslationsDocuments.length} documents`);
    console.log(`  - ServiceTranslationsEdge: ${serviceTranslationsEdgeDocuments.length} edges`);
    console.log(`  - Total: ${serviceCategoriesDocuments.length + servicesDocuments.length + categoryServicesDocuments.length + serviceCategoryTranslationsDocuments.length + serviceCategoryTranslationsEdgeDocuments.length + serviceTranslationsDocuments.length + serviceTranslationsEdgeDocuments.length} items`);
    
    // Show sample data for verification
    if (serviceCategoriesDocuments.length > 0) {
      console.log('Sample serviceCategory:', JSON.stringify(serviceCategoriesDocuments[0], null, 2));
    }
    if (servicesDocuments.length > 0) {
      console.log('Sample service:', JSON.stringify(servicesDocuments[0], null, 2));
    }
    if (categoryServicesDocuments.length > 0) {
      console.log('Sample categoryServices edge:', JSON.stringify(categoryServicesDocuments[0], null, 2));
    }
    if (serviceCategoryTranslationsDocuments.length > 0) {
      console.log('Sample serviceCategoryTranslations:', JSON.stringify(serviceCategoryTranslationsDocuments[0], null, 2));
    }
    if (serviceCategoryTranslationsEdgeDocuments.length > 0) {
      console.log('Sample serviceCategoryTranslationsEdge:', JSON.stringify(serviceCategoryTranslationsEdgeDocuments[0], null, 2));
    }
    if (serviceTranslationsDocuments.length > 0) {
      console.log('Sample serviceTranslations:', JSON.stringify(serviceTranslationsDocuments[0], null, 2));
    }
    if (serviceTranslationsEdgeDocuments.length > 0) {
      console.log('Sample serviceTranslationsEdge:', JSON.stringify(serviceTranslationsEdgeDocuments[0], null, 2));
    }
    
    // Prepare export data with metadata for all collections
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        sourceDatabase: dbConfig.databaseName,
        sourceUrl: dbConfig.url,
        collections: [
          'serviceCategories',
          'services',
          'categoryServices',
          'serviceCategoryTranslations',
          'serviceCategoryTranslationsEdge',
          'serviceTranslations',
          'serviceTranslationsEdge'
        ],
        documentCounts: {
          serviceCategories: serviceCategoriesDocuments.length,
          services: servicesDocuments.length,
          categoryServices: categoryServicesDocuments.length,
          serviceCategoryTranslations: serviceCategoryTranslationsDocuments.length,
          serviceCategoryTranslationsEdge: serviceCategoryTranslationsEdgeDocuments.length,
          serviceTranslations: serviceTranslationsDocuments.length,
          serviceTranslationsEdge: serviceTranslationsEdgeDocuments.length
        },
        totalDocuments: serviceCategoriesDocuments.length + servicesDocuments.length + categoryServicesDocuments.length + 
                        serviceCategoryTranslationsDocuments.length + serviceCategoryTranslationsEdgeDocuments.length + 
                        serviceTranslationsDocuments.length + serviceTranslationsEdgeDocuments.length,
        includeSystemFields: EXPORT_CONFIG.includeSystemFields,
        exportVersion: '4.0' // Updated version to indicate translation collections support
      },
      schemas: {
        serviceCategories: {
          type: "object",
          properties: {
            "_key": { type: "string" },
            "nameEN": { type: "string" },
            "nameFR": { type: "string", optional: true },
            "nameSW": { type: "string", optional: true },
            "order": { type: "number" }
          },
          required: ["_key", "nameEN", "order"]
        },
        services: {
          type: "object",
          properties: {
            "_key": { type: "string" },
            "categoryId": { type: "string" },
            "nameEN": { type: "string" },
            "nameFR": { type: "string", optional: true },
            "nameSW": { type: "string", optional: true },
            "description": { type: "string", optional: true },
            "order": { type: "number" }
          },
          required: ["_key", "categoryId", "nameEN", "order"]
        },
        categoryServices: {
          type: "object",
          properties: {
            "_from": { type: "string" },
            "_to": { type: "string" },
            "order": { type: "number", optional: true }
          },
          required: ["_from", "_to"]
        },
        serviceCategoryTranslations: {
          type: "object",
          properties: {
            "_key": { type: "string" },
            "serviceCategoryId": { type: "string" },
            "languageCode": { type: "string" },
            "translation": { type: "string" },
            "isActive": { type: "boolean" },
            "createdAt": { type: "string", optional: true },
            "updatedAt": { type: "string", optional: true }
          },
          required: ["_key", "serviceCategoryId", "languageCode", "translation"]
        },
        serviceCategoryTranslationsEdge: {
          type: "object",
          properties: {
            "_key": { type: "string" },
            "_from": { type: "string" },
            "_to": { type: "string" },
            "createdAt": { type: "string", optional: true }
          },
          required: ["_key", "_from", "_to"]
        },
        serviceTranslations: {
          type: "object",
          properties: {
            "_key": { type: "string" },
            "serviceId": { type: "string" },
            "languageCode": { type: "string" },
            "translation": { type: "string" },
            "isActive": { type: "boolean" },
            "createdAt": { type: "string", optional: true },
            "updatedAt": { type: "string", optional: true }
          },
          required: ["_key", "serviceId", "languageCode", "translation"]
        },
        serviceTranslationsEdge: {
          type: "object",
          properties: {
            "_key": { type: "string" },
            "_from": { type: "string" },
            "_to": { type: "string" },
            "createdAt": { type: "string", optional: true }
          },
          required: ["_key", "_from", "_to"]
        }
      },
      data: {
        serviceCategories: serviceCategoriesDocuments,
        services: servicesDocuments,
        categoryServices: categoryServicesDocuments,
        serviceCategoryTranslations: serviceCategoryTranslationsDocuments,
        serviceCategoryTranslationsEdge: serviceCategoryTranslationsEdgeDocuments,
        serviceTranslations: serviceTranslationsDocuments,
        serviceTranslationsEdge: serviceTranslationsEdgeDocuments
      }
    };
    
    // Write to file
    const filePath = path.join(EXPORT_CONFIG.outputDir, EXPORT_CONFIG.filename);
    const jsonData = EXPORT_CONFIG.prettyPrint 
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData);
    
    console.log('Writing export file...');
    await fs.writeFile(filePath, jsonData, 'utf8');
    
    console.log(`✓ Export completed successfully`);
    console.log(`  - File: ${filePath}`);
    console.log(`  - Size: ${Math.round(jsonData.length / 1024)} KB`);
    console.log(`  - ServiceCategories: ${serviceCategoriesDocuments.length} documents`);
    console.log(`  - Services: ${servicesDocuments.length} documents`);
    console.log(`  - CategoryServices: ${categoryServicesDocuments.length} edges`);
    console.log(`  - ServiceCategoryTranslations: ${serviceCategoryTranslationsDocuments.length} documents`);
    console.log(`  - ServiceCategoryTranslationsEdge: ${serviceCategoryTranslationsEdgeDocuments.length} edges`);
    console.log(`  - ServiceTranslations: ${serviceTranslationsDocuments.length} documents`);
    console.log(`  - ServiceTranslationsEdge: ${serviceTranslationsEdgeDocuments.length} edges`);
    console.log(`  - Total items: ${serviceCategoriesDocuments.length + servicesDocuments.length + categoryServicesDocuments.length + serviceCategoryTranslationsDocuments.length + serviceCategoryTranslationsEdgeDocuments.length + serviceTranslationsDocuments.length + serviceTranslationsEdgeDocuments.length}`);
    
    return {
      filePath,
      documentCounts: {
        serviceCategories: serviceCategoriesDocuments.length,
        services: servicesDocuments.length,
        categoryServices: categoryServicesDocuments.length,
        serviceCategoryTranslations: serviceCategoryTranslationsDocuments.length,
        serviceCategoryTranslationsEdge: serviceCategoryTranslationsEdgeDocuments.length,
        serviceTranslations: serviceTranslationsDocuments.length,
        serviceTranslationsEdge: serviceTranslationsEdgeDocuments.length
      },
      totalDocuments: serviceCategoriesDocuments.length + servicesDocuments.length + categoryServicesDocuments.length + 
                      serviceCategoryTranslationsDocuments.length + serviceCategoryTranslationsEdgeDocuments.length + 
                      serviceTranslationsDocuments.length + serviceTranslationsEdgeDocuments.length,
      fileSize: jsonData.length
    };
    
  } catch (error) {
    console.error('✗ Error during export:', error.message);
    throw error;
  }
}

// Generate export summary
async function generateExportSummary(exportResult, dbConfig) {
  try {
    console.log('Generating export summary...');
    
    const summaryData = {
      export: exportResult,
      timestamp: new Date().toISOString(),
      config: EXPORT_CONFIG,
      database: {
        url: dbConfig.url,
        name: dbConfig.databaseName
      }
    };
    
    const summaryPath = path.join(
      EXPORT_CONFIG.outputDir, 
      `export_summary_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    );
    
    await fs.writeFile(summaryPath, JSON.stringify(summaryData, null, 2), 'utf8');
    console.log(`✓ Export summary saved: ${summaryPath}`);
    
  } catch (error) {
    console.error('⚠ Failed to generate export summary:', error.message);
  }
}

// Validate exported data
async function validateExportedData(filePath) {
  try {
    console.log('\nValidating exported data...');
    
    const fileContent = await fs.readFile(filePath, 'utf8');
    const exportData = JSON.parse(fileContent);
    
    console.log('Checking export file structure...');
    
    // Basic validation
    if (!exportData.metadata || !exportData.data) {
      throw new Error('Invalid export file structure - missing metadata or data');
    }
    
    if (!exportData.data.serviceCategories || !exportData.data.services) {
      throw new Error('Missing serviceCategories or services data in export file');
    }
    
    // Optional collections
    if (!exportData.data.categoryServices) {
      console.log('⚠ categoryServices data not present in export (collection may not exist in source)');
    }
    if (!exportData.data.serviceCategoryTranslations) {
      console.log('⚠ serviceCategoryTranslations data not present in export (collection may not exist in source)');
    }
    if (!exportData.data.serviceCategoryTranslationsEdge) {
      console.log('⚠ serviceCategoryTranslationsEdge data not present in export (collection may not exist in source)');
    }
    if (!exportData.data.serviceTranslations) {
      console.log('⚠ serviceTranslations data not present in export (collection may not exist in source)');
    }
    if (!exportData.data.serviceTranslationsEdge) {
      console.log('⚠ serviceTranslationsEdge data not present in export (collection may not exist in source)');
    }
    
    if (!Array.isArray(exportData.data.serviceCategories) || !Array.isArray(exportData.data.services)) {
      throw new Error('Export data collections are not arrays');
    }
    
    // Validate array structure for optional collections
    if (exportData.data.categoryServices && !Array.isArray(exportData.data.categoryServices)) {
      throw new Error('categoryServices data is not an array');
    }
    if (exportData.data.serviceCategoryTranslations && !Array.isArray(exportData.data.serviceCategoryTranslations)) {
      throw new Error('serviceCategoryTranslations data is not an array');
    }
    if (exportData.data.serviceCategoryTranslationsEdge && !Array.isArray(exportData.data.serviceCategoryTranslationsEdge)) {
      throw new Error('serviceCategoryTranslationsEdge data is not an array');
    }
    if (exportData.data.serviceTranslations && !Array.isArray(exportData.data.serviceTranslations)) {
      throw new Error('serviceTranslations data is not an array');
    }
    if (exportData.data.serviceTranslationsEdge && !Array.isArray(exportData.data.serviceTranslationsEdge)) {
      throw new Error('serviceTranslationsEdge data is not an array');
    }
    
    console.log('Validating document structure...');
    
    // Validate serviceCategories documents
    const categoryRequiredFields = ['_key', 'nameEN', 'order'];
    const invalidCategories = [];
    
    exportData.data.serviceCategories.forEach((doc, index) => {
      const missingFields = categoryRequiredFields.filter(field => !doc.hasOwnProperty(field));
      if (missingFields.length > 0) {
        invalidCategories.push({ index, missingFields });
      }
    });
    
    // Validate services documents
    const serviceRequiredFields = ['_key', 'categoryId', 'nameEN', 'order'];
    const invalidServices = [];
    
    exportData.data.services.forEach((doc, index) => {
      const missingFields = serviceRequiredFields.filter(field => !doc.hasOwnProperty(field));
      if (missingFields.length > 0) {
        invalidServices.push({ index, missingFields });
      }
    });
    
    // Validate categoryServices edges if present
    const edgeRequiredFields = ['_from', '_to'];
    const invalidEdges = [];
    
    if (exportData.data.categoryServices) {
      exportData.data.categoryServices.forEach((doc, index) => {
        const missingFields = edgeRequiredFields.filter(field => !doc.hasOwnProperty(field));
        if (missingFields.length > 0) {
          invalidEdges.push({ index, missingFields });
        }
      });
    }
    
    // Validate serviceCategoryTranslations documents if present
    const categoryTranslationRequiredFields = ['_key', 'serviceCategoryId', 'languageCode', 'translation'];
    const invalidCategoryTranslations = [];
    
    if (exportData.data.serviceCategoryTranslations) {
      exportData.data.serviceCategoryTranslations.forEach((doc, index) => {
        const missingFields = categoryTranslationRequiredFields.filter(field => !doc.hasOwnProperty(field));
        if (missingFields.length > 0) {
          invalidCategoryTranslations.push({ index, missingFields });
        }
      });
    }
    
    // Validate serviceCategoryTranslationsEdge edges if present
    const invalidCategoryTranslationEdges = [];
    
    if (exportData.data.serviceCategoryTranslationsEdge) {
      exportData.data.serviceCategoryTranslationsEdge.forEach((doc, index) => {
        const missingFields = edgeRequiredFields.filter(field => !doc.hasOwnProperty(field));
        if (missingFields.length > 0) {
          invalidCategoryTranslationEdges.push({ index, missingFields });
        }
      });
    }
    
    // Validate serviceTranslations documents if present
    const serviceTranslationRequiredFields = ['_key', 'serviceId', 'languageCode', 'translation'];
    const invalidServiceTranslations = [];
    
    if (exportData.data.serviceTranslations) {
      exportData.data.serviceTranslations.forEach((doc, index) => {
        const missingFields = serviceTranslationRequiredFields.filter(field => !doc.hasOwnProperty(field));
        if (missingFields.length > 0) {
          invalidServiceTranslations.push({ index, missingFields });
        }
      });
    }
    
    // Validate serviceTranslationsEdge edges if present
    const invalidServiceTranslationEdges = [];
    
    if (exportData.data.serviceTranslationsEdge) {
      exportData.data.serviceTranslationsEdge.forEach((doc, index) => {
        const missingFields = edgeRequiredFields.filter(field => !doc.hasOwnProperty(field));
        if (missingFields.length > 0) {
          invalidServiceTranslationEdges.push({ index, missingFields });
        }
      });
    }
    
    if (invalidCategories.length > 0) {
      console.error(`✗ Found ${invalidCategories.length} invalid serviceCategory documents:`, invalidCategories.slice(0, 5));
      return false;
    }
    
    if (invalidServices.length > 0) {
      console.error(`✗ Found ${invalidServices.length} invalid service documents:`, invalidServices.slice(0, 5));
      return false;
    }
    
    if (invalidEdges.length > 0) {
      console.error(`✗ Found ${invalidEdges.length} invalid categoryServices edges:`, invalidEdges.slice(0, 5));
      return false;
    }
    
    if (invalidCategoryTranslations.length > 0) {
      console.error(`✗ Found ${invalidCategoryTranslations.length} invalid serviceCategoryTranslations documents:`, invalidCategoryTranslations.slice(0, 5));
      return false;
    }
    
    if (invalidCategoryTranslationEdges.length > 0) {
      console.error(`✗ Found ${invalidCategoryTranslationEdges.length} invalid serviceCategoryTranslationsEdge edges:`, invalidCategoryTranslationEdges.slice(0, 5));
      return false;
    }
    
    if (invalidServiceTranslations.length > 0) {
      console.error(`✗ Found ${invalidServiceTranslations.length} invalid serviceTranslations documents:`, invalidServiceTranslations.slice(0, 5));
      return false;
    }
    
    if (invalidServiceTranslationEdges.length > 0) {
      console.error(`✗ Found ${invalidServiceTranslationEdges.length} invalid serviceTranslationsEdge edges:`, invalidServiceTranslationEdges.slice(0, 5));
      return false;
    }
    
    console.log(`✓ Validation passed:`);
    console.log(`  - ServiceCategories: ${exportData.data.serviceCategories.length} valid documents`);
    console.log(`  - Services: ${exportData.data.services.length} valid documents`);
    console.log(`  - CategoryServices: ${exportData.data.categoryServices ? exportData.data.categoryServices.length : 0} valid edges`);
    console.log(`  - ServiceCategoryTranslations: ${exportData.data.serviceCategoryTranslations ? exportData.data.serviceCategoryTranslations.length : 0} valid documents`);
    console.log(`  - ServiceCategoryTranslationsEdge: ${exportData.data.serviceCategoryTranslationsEdge ? exportData.data.serviceCategoryTranslationsEdge.length : 0} valid edges`);
    console.log(`  - ServiceTranslations: ${exportData.data.serviceTranslations ? exportData.data.serviceTranslations.length : 0} valid documents`);
    console.log(`  - ServiceTranslationsEdge: ${exportData.data.serviceTranslationsEdge ? exportData.data.serviceTranslationsEdge.length : 0} valid edges`);
    console.log(`  - Export date: ${exportData.metadata.exportDate}`);
    console.log(`  - Source database: ${exportData.metadata.sourceDatabase}`);
    console.log(`  - Export version: ${exportData.metadata.exportVersion}`);
    
    return true;
    
  } catch (error) {
    console.error('✗ Validation failed:', error.message);
    return false;
  }
}

// Main export function
async function executeExport(dbConfig) {
  console.log('=== ArangoDB ServiceCategories, Services & Translations Data Export ===\n');
  
  try {
    // Initialize database connection
    await initializeDatabase(dbConfig);
    
    // Validate all collections exist
    const collections = await validateCollections();
    
    if (collections.serviceCategories.count === 0 && collections.services.count === 0) {
      console.log('⚠ Both main collections are empty, nothing to export');
      return false;
    }
    
    // Ensure export directory exists
    await ensureExportDirectory();
    
    // Perform export of all collections
    const exportResult = await exportServiceCategoriesAndServices(dbConfig);
    
    // Validate exported data
    const isValid = await validateExportedData(exportResult.filePath);
    
    if (isValid) {
      // Generate summary
      await generateExportSummary(exportResult, dbConfig);
    }
    
    console.log('\n=== Export Summary ===');
    console.log(`✓ Export completed ${isValid ? 'successfully' : 'with warnings'}`);
    console.log(`✓ File: ${exportResult.filePath}`);
    console.log(`✓ ServiceCategories: ${exportResult.documentCounts.serviceCategories} documents`);
    console.log(`✓ Services: ${exportResult.documentCounts.services} documents`);
    console.log(`✓ CategoryServices: ${exportResult.documentCounts.categoryServices} edges`);
    console.log(`✓ ServiceCategoryTranslations: ${exportResult.documentCounts.serviceCategoryTranslations} documents`);
    console.log(`✓ ServiceCategoryTranslationsEdge: ${exportResult.documentCounts.serviceCategoryTranslationsEdge} edges`);
    console.log(`✓ ServiceTranslations: ${exportResult.documentCounts.serviceTranslations} documents`);
    console.log(`✓ ServiceTranslationsEdge: ${exportResult.documentCounts.serviceTranslationsEdge} edges`);
    console.log(`✓ Total items: ${exportResult.totalDocuments}`);
    console.log(`✓ File size: ${Math.round(exportResult.fileSize / 1024)} KB`);
    
    console.log('\n=== Usage ===');
    console.log('Use the generated file with the import script to restore all collections to another database.');
    console.log(`Filename for import: ${path.basename(exportResult.filePath)}`);
    
    return true;
    
  } catch (error) {
    console.error('\n✗ Export failed:', error.message);
    return false;
  }
}

// Main entry point
async function main() {
    // --- Database Configuration ---
    const dbConfig = {
        url: process.env.ARANGO_URL || 'http://localhost:8529',
        databaseName: process.env.ARANGO_DATABASE || 'node-services',
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
    console.log(`- Output Directory: ${EXPORT_CONFIG.outputDir}`);
    console.log('--------------------------------------------------');
    
    const answer = await askQuestion('Are you sure you want to proceed with these settings? (Y/n) ');
    if (answer.toLowerCase() !== 'y') {
        console.log('Operation cancelled by user.');
        process.exit(0);
    }

    executeExport(dbConfig).then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Export script crashed:', error);
        process.exit(1);
    });
}

// Command line interface
if (require.main === module) {
  main();
}

module.exports = {
  executeExport,
  exportServiceCategoriesAndServices,
  validateExportedData,
  initializeDatabase
};
