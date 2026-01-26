// db-init.js
require('dotenv').config();
const { Database } = require('arangojs');

// Initialize ArangoDB connection
const initDB = () => {
  const db = new Database({
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    databaseName: process.env.ARANGO_DB || 'node-services',
    auth: {
      username: process.env.ARANGO_USERNAME || 'root',
      password: process.env.ARANGO_PASSWORD || 'test'
    }
  });

  return db;
};

async function initializeDatabase() {
  const db = initDB();
  
  // Required document collections
  const documentCollections = [
    'users',
    'sessions',
    'queries',
    'analytics',
    'events',
    'services',
    'serviceCategories'
  ];
  
  // Required edge collections
  const edgeCollections = [
    'userSessions',     // users to sessions
    'sessionQueries',   // sessions to queries
    'queryCategories',  // queries to categories
    'categoryServices'  // categories to services
  ];
  
  console.log('Initializing database collections...');
  
  // Create document collections
  for (const collectionName of documentCollections) {
    try {
      const collection = db.collection(collectionName);
      if (!(await collection.exists())) {
        await collection.create();
        console.log(`Created document collection: ${collectionName}`);
      } else {
        console.log(`Document collection already exists: ${collectionName}`);
      }
    } catch (error) {
      console.error(`Error creating document collection ${collectionName}:`, error);
    }
  }
  
  // Create edge collections
  for (const collectionName of edgeCollections) {
    try {
      const collection = db.collection(collectionName);
      if (!(await collection.exists())) {
        await collection.create({ type: 3 }); // Type 3 for edge collection
        console.log(`Created edge collection: ${collectionName}`);
      } else {
        console.log(`Edge collection already exists: ${collectionName}`);
      }
    } catch (error) {
      console.error(`Error creating edge collection ${collectionName}:`, error);
    }
  }
  
  console.log('Database initialization completed');
}

// Truncate collections for fresh tests
async function cleanTestCollections() {
  const db = initDB();

  // Collections that should be cleaned before tests
  const collectionsToClean = [
    'users',
    'queries',
    'sessions',
    'events',
    'analytics',
    'userSessions',
    'sessionQueries',
    'queryCategories'
  ];

  console.log('Cleaning test collections...');

  for (const collectionName of collectionsToClean) {
    try {
      const collection = db.collection(collectionName);
      if (await collection.exists()) {
        console.log(`Truncating collection: ${collectionName}`);
        await collection.truncate();
      } else {
        console.log(`Collection doesn't exist, skipping: ${collectionName}`);
      }
    } catch (error) {
      console.error(`Error cleaning collection ${collectionName}:`, error);
    }
  }

  console.log('Database cleanup completed');
}

// Run the initialization only if this script is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'init';
  
  if (command === 'init') {
    initializeDatabase().catch(console.error);
  } else if (command === 'clean') {
    cleanTestCollections().catch(console.error);
  } else {
    console.log(`Unknown command: ${command}`);
    console.log('Available commands: init, clean');
  }
}

module.exports = {
  initializeDatabase,
  cleanTestCollections
};