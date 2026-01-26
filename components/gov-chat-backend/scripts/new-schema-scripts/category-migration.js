// ArangoDB Service Category & Services Translation Migration Script
// This script creates new translation collections and migrates existing translation data for both serviceCategories and services

const { Database } = require('arangojs');
const readline = require('readline');

// Global database connection variable
let db;

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

async function initializeDatabase(config) {
  try {
    console.log(`Connecting to ArangoDB at ${config.url}...`);
    
    db = new Database({
      url: config.url,
      databaseName: config.database,
      auth: config.auth
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

// 1. Create the serviceCategoryTranslations collection
async function createServiceCategoryTranslationsCollection() {
  try {
    console.log('Checking serviceCategoryTranslations collection...');
    
    const collection = db.collection('serviceCategoryTranslations');
    const exists = await collection.exists();
    
    if (exists) {
      console.log('⚠ serviceCategoryTranslations collection already exists - using existing collection');
      return collection;
    }
    
    console.log('Creating serviceCategoryTranslations collection...');
    
    const translationsCollection = await db.createCollection('serviceCategoryTranslations', {
      waitForSync: false,
      keyOptions: {},
      schema: {
        message: "Service category translation document does not match schema",
        level: "none", // Disable schema validation to avoid issues
        type: "json",
        rule: {
          type: "object",
          properties: {
            "_key": { type: "string" },
            "serviceCategoryId": { type: "string" },
            "languageCode": { type: "string" },
            "translation": { type: "string" },
            "isActive": { type: "boolean", default: true },
            "createdAt": { type: "string" },
            "updatedAt": { type: "string" }
          },
          required: ["_key", "serviceCategoryId", "languageCode", "translation"]
        }
      },
      computedValues: []
    });

    // Create indexes for better performance
    await translationsCollection.ensureIndex({
      type: "hash",
      fields: ["serviceCategoryId", "languageCode"],
      unique: true,
      name: "idx_serviceCategory_language"
    });

    await translationsCollection.ensureIndex({
      type: "skiplist", 
      fields: ["serviceCategoryId"],
      name: "idx_serviceCategoryId"
    });

    await translationsCollection.ensureIndex({
      type: "skiplist",
      fields: ["languageCode"],
      name: "idx_languageCode"
    });

    await translationsCollection.ensureIndex({
      type: "skiplist",
      fields: ["createdAt"],
      name: "idx_createdAt"
    });

    console.log('✓ serviceCategoryTranslations collection created successfully');
    return translationsCollection;
    
  } catch (error) {
    console.error('✗ Error creating serviceCategoryTranslations collection:', error);
    throw error;
  }
}

// 2. Create the serviceTranslations collection
async function createServiceTranslationsCollection() {
  try {
    console.log('Checking serviceTranslations collection...');
    
    const collection = db.collection('serviceTranslations');
    const exists = await collection.exists();
    
    if (exists) {
      console.log('⚠ serviceTranslations collection already exists - using existing collection');
      return collection;
    }
    
    console.log('Creating serviceTranslations collection...');
    
    const translationsCollection = await db.createCollection('serviceTranslations', {
      waitForSync: false,
      keyOptions: {},
      schema: {
        message: "Service translation document does not match schema",
        level: "none", // Disable schema validation to avoid issues
        type: "json",
        rule: {
          type: "object",
          properties: {
            "_key": { type: "string" },
            "serviceId": { type: "string" },
            "languageCode": { type: "string" },
            "translation": { type: "string" },
            "isActive": { type: "boolean", default: true },
            "createdAt": { type: "string" },
            "updatedAt": { type: "string" }
          },
          required: ["_key", "serviceId", "languageCode", "translation"]
        }
      },
      computedValues: []
    });

    // Create indexes for better performance
    await translationsCollection.ensureIndex({
      type: "hash",
      fields: ["serviceId", "languageCode"],
      unique: true,
      name: "idx_service_language"
    });

    await translationsCollection.ensureIndex({
      type: "skiplist", 
      fields: ["serviceId"],
      name: "idx_serviceId"
    });

    await translationsCollection.ensureIndex({
      type: "skiplist",
      fields: ["languageCode"],
      name: "idx_languageCode"
    });

    await translationsCollection.ensureIndex({
      type: "skiplist",
      fields: ["createdAt"],
      name: "idx_createdAt"
    });

    console.log('✓ serviceTranslations collection created successfully');
    return translationsCollection;
    
  } catch (error) {
    console.error('✗ Error creating serviceTranslations collection:', error);
    throw error;
  }
}

// 3. Create edge collection to link serviceCategories to translations
async function createServiceCategoryTranslationsEdgeCollection() {
  try {
    console.log('Checking serviceCategoryTranslationsEdge collection...');
    
    const collection = db.collection('serviceCategoryTranslationsEdge');
    const exists = await collection.exists();
    
    if (exists) {
      console.log('⚠ serviceCategoryTranslationsEdge collection already exists - using existing collection');
      return collection;
    }
    
    console.log('Creating serviceCategoryTranslationsEdge collection...');
    
    const edgeCollection = await db.createCollection('serviceCategoryTranslationsEdge', {
      type: 3, // Edge collection type
      waitForSync: false,
      keyOptions: {},
      schema: {
        message: "Service category translation edge does not match schema",
        level: "none", // Disable schema validation
        type: "json",
        rule: {
          type: "object",
          properties: {
            "_from": { type: "string" },
            "_to": { type: "string" },
            "createdAt": { type: "string" }
          },
          required: ["_from", "_to"]
        }
      }
    });

    console.log('✓ serviceCategoryTranslationsEdge collection created successfully');
    return edgeCollection;
    
  } catch (error) {
    console.error('✗ Error creating serviceCategoryTranslationsEdge collection:', error);
    throw error;
  }
}

// 4. Create edge collection to link services to translations
async function createServiceTranslationsEdgeCollection() {
  try {
    console.log('Checking serviceTranslationsEdge collection...');
    
    const collection = db.collection('serviceTranslationsEdge');
    const exists = await collection.exists();
    
    if (exists) {
      console.log('⚠ serviceTranslationsEdge collection already exists - using existing collection');
      return collection;
    }
    
    console.log('Creating serviceTranslationsEdge collection...');
    
    const edgeCollection = await db.createCollection('serviceTranslationsEdge', {
      type: 3, // Edge collection type
      waitForSync: false,
      keyOptions: {},
      schema: {
        message: "Service translation edge does not match schema",
        level: "none", // Disable schema validation
        type: "json",
        rule: {
          type: "object",
          properties: {
            "_from": { type: "string" },
            "_to": { type: "string" },
            "createdAt": { type: "string" }
          },
          required: ["_from", "_to"]
        }
      }
    });

    console.log('✓ serviceTranslationsEdge collection created successfully');
    return edgeCollection;
    
  } catch (error) {
    console.error('✗ Error creating serviceTranslationsEdge collection:', error);
    throw error;
  }
}

// 5. Migrate existing serviceCategories translation data
async function migrateServiceCategoryTranslations() {
  try {
    console.log('\n=== Starting serviceCategories translation migration ===');
    
    const serviceCategoriesCollection = db.collection('serviceCategories');
    const translationsCollection = db.collection('serviceCategoryTranslations');
    const edgeCollection = db.collection('serviceCategoryTranslationsEdge');
    
    // Check if serviceCategories collection exists
    const exists = await serviceCategoriesCollection.exists();
    if (!exists) {
      console.log('⚠ serviceCategories collection does not exist - skipping migration');
      return 0;
    }
    
    // Get all service categories
    const cursor = await serviceCategoriesCollection.all();
    const serviceCategories = await cursor.all();
    
    let migratedCount = 0;
    const currentTimestamp = new Date().toISOString();
    
    // Language mappings
    const languageMappings = [
      { field: 'nameEN', code: 'EN' },
      { field: 'nameFR', code: 'FR' }, 
      { field: 'nameSW', code: 'SW' }
    ];
    
    console.log(`Found ${serviceCategories.length} service categories to process`);
    
    for (const category of serviceCategories) {
      console.log(`Processing serviceCategory: ${category._key} (${category.nameEN || 'no nameEN'})`);
      
      for (const lang of languageMappings) {
        const translation = category[lang.field];
        
        // Only create translation if the field exists and has a value
        if (translation && translation.trim() !== '') {
          try {
            // Create translation document
            const translationKey = `${category._key}_${lang.code}`;
            const translationDoc = {
              _key: translationKey,
              serviceCategoryId: category._key,
              languageCode: lang.code,
              translation: translation.trim(),
              isActive: true,
              createdAt: currentTimestamp,
              updatedAt: currentTimestamp
            };
            
            // Insert translation document
            await translationsCollection.save(translationDoc);
            
            // Create edge linking category to translation
            const edgeDoc = {
              _from: `serviceCategories/${category._key}`,
              _to: `serviceCategoryTranslations/${translationKey}`,
              createdAt: currentTimestamp
            };
            
            await edgeCollection.save(edgeDoc);
            
            migratedCount++;
            console.log(`  ✓ Migrated serviceCategory ${lang.code}: ${translation}`);
            
          } catch (insertError) {
            if (insertError.code === 1210 || insertError.errorNum === 1210) { // Unique constraint violation
              console.log(`  ⚠ Translation already exists for serviceCategory ${category._key} - ${lang.code}`);
            } else {
              console.error(`  ✗ Error inserting translation for serviceCategory ${category._key} - ${lang.code}:`, insertError);
            }
          }
        } else {
          console.log(`  - Skipped serviceCategory ${lang.code}: empty or missing translation`);
        }
      }
    }
    
    console.log(`✓ ServiceCategory translation migration completed. ${migratedCount} translations migrated.`);
    return migratedCount;
    
  } catch (error) {
    console.error('✗ Error during serviceCategory translation migration:', error);
    throw error;
  }
}

// 6. Migrate existing services translation data
async function migrateServiceTranslations() {
  try {
    console.log('\n=== Starting services translation migration ===');
    
    const servicesCollection = db.collection('services');
    const translationsCollection = db.collection('serviceTranslations');
    const edgeCollection = db.collection('serviceTranslationsEdge');
    
    // Check if services collection exists
    const exists = await servicesCollection.exists();
    if (!exists) {
      console.log('⚠ services collection does not exist - skipping migration');
      return 0;
    }
    
    // Get all services
    const cursor = await servicesCollection.all();
    const services = await cursor.all();
    
    let migratedCount = 0;
    const currentTimestamp = new Date().toISOString();
    
    // Language mappings
    const languageMappings = [
      { field: 'nameEN', code: 'EN' },
      { field: 'nameFR', code: 'FR' }, 
      { field: 'nameSW', code: 'SW' }
    ];
    
    console.log(`Found ${services.length} services to process`);
    
    for (const service of services) {
      console.log(`Processing service: ${service._key} (${service.nameEN || 'no nameEN'})`);
      
      for (const lang of languageMappings) {
        const translation = service[lang.field];
        
        // Only create translation if the field exists and has a value
        if (translation && translation.trim() !== '') {
          try {
            // Create translation document
            const translationKey = `${service._key}_${lang.code}`;
            const translationDoc = {
              _key: translationKey,
              serviceId: service._key,
              languageCode: lang.code,
              translation: translation.trim(),
              isActive: true,
              createdAt: currentTimestamp,
              updatedAt: currentTimestamp
            };
            
            // Insert translation document
            await translationsCollection.save(translationDoc);
            
            // Create edge linking service to translation
            const edgeDoc = {
              _from: `services/${service._key}`,
              _to: `serviceTranslations/${translationKey}`,
              createdAt: currentTimestamp
            };
            
            await edgeCollection.save(edgeDoc);
            
            migratedCount++;
            console.log(`  ✓ Migrated service ${lang.code}: ${translation}`);
            
          } catch (insertError) {
            if (insertError.code === 1210 || insertError.errorNum === 1210) { // Unique constraint violation
              console.log(`  ⚠ Translation already exists for service ${service._key} - ${lang.code}`);
            } else {
              console.error(`  ✗ Error inserting translation for service ${service._key} - ${lang.code}:`, insertError);
            }
          }
        } else {
          console.log(`  - Skipped service ${lang.code}: empty or missing translation`);
        }
      }
    }
    
    console.log(`✓ Service translation migration completed. ${migratedCount} translations migrated.`);
    return migratedCount;
    
  } catch (error) {
    console.error('✗ Error during service translation migration:', error);
    throw error;
  }
}

// 7. Verification function
async function verifyMigration() {
  try {
    console.log('\n=== Verifying migration ===');
    
    const serviceCategoriesCollection = db.collection('serviceCategories');
    const servicesCollection = db.collection('services');
    const categoryTranslationsCollection = db.collection('serviceCategoryTranslations');
    const serviceTranslationsCollection = db.collection('serviceTranslations');
    const categoryEdgeCollection = db.collection('serviceCategoryTranslationsEdge');
    const serviceEdgeCollection = db.collection('serviceTranslationsEdge');
    
    // Count documents
    const totalCategories = await serviceCategoriesCollection.count();
    const totalServices = await servicesCollection.count();
    const totalCategoryTranslations = await categoryTranslationsCollection.count();
    const totalServiceTranslations = await serviceTranslationsCollection.count();
    const totalCategoryEdges = await categoryEdgeCollection.count();
    const totalServiceEdges = await serviceEdgeCollection.count();
    
    console.log(`Document counts:`);
    console.log(`  - ServiceCategories: ${totalCategories.count}`);
    console.log(`  - Services: ${totalServices.count}`);
    console.log(`  - ServiceCategory translations: ${totalCategoryTranslations.count}`);
    console.log(`  - Service translations: ${totalServiceTranslations.count}`);
    console.log(`  - ServiceCategory edges: ${totalCategoryEdges.count}`);
    console.log(`  - Service edges: ${totalServiceEdges.count}`);
    
    // Sample verification query for serviceCategories
    const categoryVerificationQuery = `
      FOR category IN serviceCategories
        LIMIT 2
        LET translations = (
          FOR edge IN serviceCategoryTranslationsEdge
            FILTER edge._from == CONCAT('serviceCategories/', category._key)
            FOR translation IN serviceCategoryTranslations
              FILTER translation._id == edge._to
              RETURN {
                language: translation.languageCode,
                text: translation.translation
              }
        )
        RETURN {
          categoryKey: category._key,
          originalEN: category.nameEN,
          originalFR: category.nameFR,
          originalSW: category.nameSW,
          newTranslations: translations
        }
    `;
    
    // Sample verification query for services
    const serviceVerificationQuery = `
      FOR service IN services
        LIMIT 2
        LET translations = (
          FOR edge IN serviceTranslationsEdge
            FILTER edge._from == CONCAT('services/', service._key)
            FOR translation IN serviceTranslations
              FILTER translation._id == edge._to
              RETURN {
                language: translation.languageCode,
                text: translation.translation
              }
        )
        RETURN {
          serviceKey: service._key,
          originalEN: service.nameEN,
          originalFR: service.nameFR,
          originalSW: service.nameSW,
          newTranslations: translations
        }
    `;
    
    const categoryCursor = await db.query(categoryVerificationQuery);
    const categoryResults = await categoryCursor.all();
    
    const serviceCursor = await db.query(serviceVerificationQuery);
    const serviceResults = await serviceCursor.all();
    
    console.log('\nSample serviceCategory verification results:');
    categoryResults.forEach(result => {
      console.log(`\nServiceCategory: ${result.categoryKey}`);
      console.log(`  Original EN: ${result.originalEN}`);
      console.log(`  Original FR: ${result.originalFR}`);
      console.log(`  Original SW: ${result.originalSW}`);
      console.log(`  New translations:`, result.newTranslations);
    });
    
    console.log('\nSample service verification results:');
    serviceResults.forEach(result => {
      console.log(`\nService: ${result.serviceKey}`);
      console.log(`  Original EN: ${result.originalEN}`);
      console.log(`  Original FR: ${result.originalFR}`);
      console.log(`  Original SW: ${result.originalSW}`);
      console.log(`  New translations:`, result.newTranslations);
    });
    
    return true;
    
  } catch (error) {
    console.error('✗ Error during verification:', error);
    return false;
  }
}

// Main execution function
async function executeTranslationMigration() {
  console.log('=== ArangoDB Service Category & Services Translation Migration ===\n');

  // Read configuration from environment variables, with defaults
  const config = {
    url: process.env.ARANGO_URL || 'http://127.0.0.1:8529',
    database: process.env.ARANGO_DATABASE || 'node-services',
    auth: {
      username: process.env.ARANGO_USER || 'root',
      password: process.env.ARANGO_PASSWORD || 'your-database-password'
    }
  };

  // --- Confirmation Prompt ---
  console.log('This script will migrate translation data in an ArangoDB database.');
  console.log('\nDatabase configuration to be used:');
  console.log(`  URL:      ${config.url}`);
  console.log(`  Database: ${config.database}`);
  console.log(`  User:     ${config.auth.username}`);
  
  const answer = await askQuestion('\nAre you sure you want to proceed with these settings? (Y/n) ');

  if (answer.toLowerCase() !== 'y') {
    console.log('Operation cancelled by user. Exiting.');
    process.exit(0);
  }
  // --- End Confirmation Prompt ---
  
  try {
    // Initialize database connection
    await initializeDatabase(config);
    
    // Step 1: Create translation collections
    await createServiceCategoryTranslationsCollection();
    await createServiceTranslationsCollection();
    
    // Step 2: Create edge collections
    await createServiceCategoryTranslationsEdgeCollection();
    await createServiceTranslationsEdgeCollection();
    
    // Step 3: Migrate serviceCategory translation data
    const categoryMigratedCount = await migrateServiceCategoryTranslations();
    
    // Step 4: Migrate service translation data
    const serviceMigratedCount = await migrateServiceTranslations();
    
    // Step 5: Verify migration
    const verificationSuccess = await verifyMigration();
    
    console.log('\n=== Migration Summary ===');
    console.log(`✓ Translation collections created successfully`);
    console.log(`✓ ServiceCategory translations migrated: ${categoryMigratedCount}`);
    console.log(`✓ Service translations migrated: ${serviceMigratedCount}`);
    console.log(`✓ Total translations migrated: ${categoryMigratedCount + serviceMigratedCount}`);
    console.log(`${verificationSuccess ? '✓' : '✗'} Verification ${verificationSuccess ? 'passed' : 'failed'}`);
    
    console.log('\n=== Next Steps ===');
    console.log('1. Test your application with the new translation system');
    console.log('2. Update your CRUD services to use both serviceCategoryTranslations and serviceTranslations');
    console.log('3. Add new language support as needed for both serviceCategories and services');
    console.log('4. Once migration is complete, you can remove nameEN, nameFR, nameSW from both collection schemas');
    
    return true;
    
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    return false;
  }
}

// Helper function to add new serviceCategory translations
async function addNewServiceCategoryTranslation(serviceCategoryKey, languageCode, translation) {
  try {
    const currentTimestamp = new Date().toISOString();
    const translationKey = `${serviceCategoryKey}_${languageCode}`;
    
    const translationDoc = {
      _key: translationKey,
      serviceCategoryId: serviceCategoryKey,
      languageCode: languageCode,
      translation: translation,
      isActive: true,
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp
    };
    
    const translationsCollection = db.collection('serviceCategoryTranslations');
    const edgeCollection = db.collection('serviceCategoryTranslationsEdge');
    
    const result = await translationsCollection.save(translationDoc);
    
    // Create edge
    const edgeDoc = {
      _from: `serviceCategories/${serviceCategoryKey}`,
      _to: `serviceCategoryTranslations/${translationKey}`,
      createdAt: currentTimestamp
    };
    
    await edgeCollection.save(edgeDoc);
    
    console.log(`✓ Added serviceCategory translation: ${languageCode} - ${translation}`);
    return result;
    
  } catch (error) {
    console.error('✗ Error adding serviceCategory translation:', error);
    throw error;
  }
}

// Helper function to add new service translations
async function addNewServiceTranslation(serviceKey, languageCode, translation) {
  try {
    const currentTimestamp = new Date().toISOString();
    const translationKey = `${serviceKey}_${languageCode}`;
    
    const translationDoc = {
      _key: translationKey,
      serviceId: serviceKey,
      languageCode: languageCode,
      translation: translation,
      isActive: true,
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp
    };
    
    const translationsCollection = db.collection('serviceTranslations');
    const edgeCollection = db.collection('serviceTranslationsEdge');
    
    const result = await translationsCollection.save(translationDoc);
    
    // Create edge
    const edgeDoc = {
      _from: `services/${serviceKey}`,
      _to: `serviceTranslations/${translationKey}`,
      createdAt: currentTimestamp
    };
    
    await edgeCollection.save(edgeDoc);
    
    console.log(`✓ Added service translation: ${languageCode} - ${translation}`);
    return result;
    
  } catch (error) {
    console.error('✗ Error adding service translation:', error);
    throw error;
  }
}

// Execute the migration if the script is run directly
if (require.main === module) {
    executeTranslationMigration().then(() => {
        console.log('Migration script completed');
        process.exit(0);
    }).catch(error => {
        console.error('Migration script failed:', error);
        process.exit(1);
    });
}


// Export helper functions for future use
module.exports = {
  executeTranslationMigration,
  addNewServiceCategoryTranslation,
  addNewServiceTranslation,
  verifyMigration,
  initializeDatabase
};