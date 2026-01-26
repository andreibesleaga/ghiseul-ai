// setup-db.js
// Load environment variables from .env file
require('dotenv').config();

const { Database } = require('arangojs');
const schemas = require('./schemas'); // Import the schema definitions we created earlier

// Database connection configuration
const config = {
  url: process.env.ARANGO_URL || 'http://localhost:8529',
  databaseName: process.env.ARANGO_DB || 'chatbot_analytics',
  auth: {
    username: process.env.ARANGO_USERNAME || 'root',
    password: process.env.ARANGO_PASSWORD || ''
  }
};

// Add validation and debugging
console.log('Database configuration:');
console.log(`URL: ${config.url}`);
console.log(`Database: ${config.databaseName}`);
console.log(`Username: ${config.auth.username}`);
console.log(`Password provided: ${config.auth.password ? 'Yes' : 'No'}`);

if (!config.auth.password) {
  console.error('ERROR: No ArangoDB password provided! Set ARANGO_PASSWORD in your .env file');
  process.exit(1);
}

// Connect to ArangoDB
const db = new Database({
  url: config.url,
  auth: {
    username: config.auth.username,
    password: config.auth.password
  }
});

/**
 * Initialize the database and collections
 */
async function setupDatabase() {
  try {
    console.log(`Setting up database '${config.databaseName}'...`);
    
    // Test the connection first
    try {
      console.log("Testing connection to ArangoDB...");
      // This will throw an error if authentication fails
      const info = await db.version();
      console.log(`Connected to ArangoDB version: ${info.version}`);
    } catch (error) {
      console.error("Connection test failed:", error.message);
      throw new Error(`Authentication failed. Please check your ArangoDB credentials. Error: ${error.message}`);
    }
    
    // Create database if it doesn't exist
    console.log("Listing available databases...");
    const databases = await db.listDatabases();
    console.log("Available databases:", databases);
    
    if (!databases.includes(config.databaseName)) {
      console.log(`Creating database '${config.databaseName}'...`);
      await db.createDatabase(config.databaseName);
      console.log(`Database '${config.databaseName}' created successfully!`);
    } else {
      console.log(`Database '${config.databaseName}' already exists.`);
    }
    
    // Switch to the database by creating a new connection
    console.log(`Switching to database '${config.databaseName}'...`);
    const dbConn = new Database({
      url: config.url,
      databaseName: config.databaseName,
      auth: {
        username: config.auth.username,
        password: config.auth.password
      }
    });
    
    // Define the collections to create
    const documentCollections = [
      'users',
      'sessions',
      'serviceCategories',
      'services',
      'queries',
      'analytics',
      'passwordResetTokens' // Added new collection for password reset tokens
    ];
    
    const edgeCollections = [
      'userSessions',
      'sessionQueries',
      'categoryServices',
      'queryCategories'
    ];
    
    // Create document collections
    for (const collectionName of documentCollections) {
      await createCollection(dbConn, collectionName, false);
    }
    
    // Create edge collections (using same method but specifying type)
    for (const collectionName of edgeCollections) {
      await createCollection(dbConn, collectionName, true);
    }
    
    // Create indexes on passwordResetTokens collection
    console.log('Creating indexes for passwordResetTokens collection...');
    try {
      const passwordResetTokensCollection = dbConn.collection('passwordResetTokens');
      
      // Create index on userId for faster lookups
      const userIdIndex = await passwordResetTokensCollection.ensureIndex({
        type: 'persistent',
        fields: ['userId']
      });
      console.log(`Index on userId field: ${userIdIndex.isNewlyCreated ? 'created' : 'already exists'}`);
      
      // Create index on token for faster lookups
      const tokenIndex = await passwordResetTokensCollection.ensureIndex({
        type: 'persistent',
        fields: ['token'],
        unique: true
      });
      console.log(`Index on token field: ${tokenIndex.isNewlyCreated ? 'created' : 'already exists'}`);
      
      // Create index on expiresAt for efficient cleanup of expired tokens
      const expiresAtIndex = await passwordResetTokensCollection.ensureIndex({
        type: 'persistent',
        fields: ['expiresAt']
      });
      console.log(`Index on expiresAt field: ${expiresAtIndex.isNewlyCreated ? 'created' : 'already exists'}`);
    } catch (error) {
      console.error('Error creating indexes for passwordResetTokens collection:', error);
    }
    
    console.log('Database setup completed successfully!');
    return { success: true, message: 'Database setup completed successfully' };
  } catch (error) {
    console.error('Error setting up database:', error);
    throw error;
  }
}

/**
 * Create a collection
 * @param {Database} dbConn - Database connection
 * @param {String} collectionName - Collection name
 * @param {Boolean} isEdge - Whether this is an edge collection
 */
async function createCollection(dbConn, collectionName, isEdge = false) {
  try {
    // Check if collection exists
    const collections = await dbConn.collections();
    const collectionExists = collections.some(col => col.name === collectionName);
    
    if (collectionExists) {
      console.log(`Collection '${collectionName}' already exists.`);
    } else {
      console.log(`Creating collection '${collectionName}'...`);
      
      // Create the collection - use standard collection method with type option
      const collection = dbConn.collection(collectionName);
      
      // Add the edge collection type if needed
      const options = {
        waitForSync: true,
        keyOptions: {
          type: 'autoincrement',
          increment: 1,
          offset: 0
        }
      };
      
      // If it's an edge collection, set the type
      if (isEdge) {
        options.type = 3; // Edge collection type
      }
      
      await collection.create(options);
      
      console.log(`Collection '${collectionName}' created successfully.`);
    }
  } catch (error) {
    console.error(`Error creating collection '${collectionName}':`, error);
    throw error;
  }
}

// Execute the setup function if this script is run directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('Database setup complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

// Export the setupDatabase function for use in other files
module.exports = setupDatabase;