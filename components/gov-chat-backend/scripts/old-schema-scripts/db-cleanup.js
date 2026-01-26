// db-cleanup.js
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

async function cleanDatabase() {
  const db = initDB();
  
  // Collections that should be cleaned
  const documentCollections = [
    'users',
    'sessions',
    'queries',
    'analytics',
    'events',
    'services',
    'serviceCategories'
  ];
  
  // Edge collections to clean
  const edgeCollections = [
    'userSessions',
    'sessionQueries',
    'queryCategories',
    'categoryServices'
  ];
  
  console.log('Starting database cleanup...');
  
  // First, drop all edge collections to avoid foreign key constraints
  for (const collectionName of edgeCollections) {
    try {
      const collection = db.collection(collectionName);
      
      if (await collection.exists()) {
        // First try to truncate it
        try {
          console.log(`Truncating edge collection: ${collectionName}`);
          await collection.truncate();
        } catch (truncateError) {
          console.error(`Error truncating edge collection ${collectionName}:`, truncateError);
          
          // If truncate fails, try dropping and recreating
          try {
            console.log(`Dropping edge collection: ${collectionName}`);
            await collection.drop();
            console.log(`Recreating edge collection: ${collectionName}`);
            await collection.create({ type: 3 }); // 3 is edge collection type
          } catch (dropError) {
            console.error(`Error dropping/recreating edge collection ${collectionName}:`, dropError);
          }
        }
      } else {
        console.log(`Edge collection doesn't exist, creating: ${collectionName}`);
        await collection.create({ type: 3 });
      }
    } catch (error) {
      console.error(`Error processing edge collection ${collectionName}:`, error);
    }
  }
  
  // Then, clean all document collections
  for (const collectionName of documentCollections) {
    try {
      const collection = db.collection(collectionName);
      
      if (await collection.exists()) {
        // First try to truncate it
        try {
          console.log(`Truncating document collection: ${collectionName}`);
          await collection.truncate();
        } catch (truncateError) {
          console.error(`Error truncating collection ${collectionName}:`, truncateError);
          
          // If truncate fails, try dropping and recreating
          try {
            console.log(`Dropping collection: ${collectionName}`);
            await collection.drop();
            console.log(`Recreating collection: ${collectionName}`);
            await collection.create();
          } catch (dropError) {
            console.error(`Error dropping/recreating collection ${collectionName}:`, dropError);
          }
        }
      } else {
        console.log(`Collection doesn't exist, creating: ${collectionName}`);
        await collection.create();
      }
    } catch (error) {
      console.error(`Error processing collection ${collectionName}:`, error);
    }
  }
  
  console.log('Database cleanup completed');
}

// Alternative approach: Drop and recreate database
async function recreateDatabase() {
  try {
    // Connect to _system database first
    const systemDb = new Database({
      url: process.env.ARANGO_URL || 'http://localhost:8529',
      databaseName: '_system',
      auth: {
        username: process.env.ARANGO_USERNAME || 'root',
        password: process.env.ARANGO_PASSWORD || 'test'
      }
    });

    const dbName = process.env.ARANGO_DB || 'node-services';
    
    // Check if our target database exists
    const databases = await systemDb.listDatabases();
    
    // If it exists, drop it
    if (databases.includes(dbName)) {
      console.log(`Dropping database: ${dbName}`);
      await systemDb.dropDatabase(dbName);
    }
    
    // Create the database
    console.log(`Creating database: ${dbName}`);
    await systemDb.createDatabase(dbName);
    
    // Initialize collections in the new database
    const db = initDB();
    
    // Document collections
    for (const collectionName of [
      'users',
      'sessions',
      'queries',
      'analytics',
      'events',
      'services',
      'serviceCategories'
    ]) {
      console.log(`Creating document collection: ${collectionName}`);
      await db.collection(collectionName).create();
    }
    
    // Edge collections
    for (const collectionName of [
      'userSessions',
      'sessionQueries',
      'queryCategories',
      'categoryServices'
    ]) {
      console.log(`Creating edge collection: ${collectionName}`);
      await db.collection(collectionName).create({ type: 3 });
    }
    
    console.log(`Successfully recreated database: ${dbName}`);
  } catch (error) {
    console.error('Error recreating database:', error);
  }
}

// Run the cleanup based on command line arguments
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'clean';
  
  if (command === 'clean') {
    await cleanDatabase();
  } else if (command === 'recreate') {
    await recreateDatabase();
  } else {
    console.log(`Unknown command: ${command}`);
    console.log('Available commands: clean, recreate');
  }
}

main().catch(console.error);