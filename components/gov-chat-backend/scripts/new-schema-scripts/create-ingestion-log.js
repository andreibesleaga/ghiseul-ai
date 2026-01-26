/*
  This script creates the 'ingestion_log' collection and its necessary indexes.
  It is designed to be run as a standalone Node.js script.
  
  It reads database configuration from environment variables:
  - ARANGO_URL (default: 'http://127.0.0.1:8529')
  - ARANGO_DATABASE (default: 'node-services')
  - ARANGO_USER (default: 'root')
  - ARANGO_PASSWORD (default: 'your-password')
*/

require('dotenv').config();
const { Database } = require('arangojs');

// Global database connection variable
let db;

// Read configuration from environment variables, with defaults
const config = {
  url: process.env.ARANGO_URL || 'http://127.0.0.1:8529',
  database: process.env.ARANGO_DATABASE || 'node-services',
  auth: {
    username: process.env.ARANGO_USER || 'root',
    password: process.env.ARANGO_PASSWORD || 'test' // Defaulting to 'test' as seen in your logs
  }
};

/**
 * Initializes the ArangoDB database connection.
 */
async function initializeDatabase() {
  try {
    console.log(`Connecting to ArangoDB at ${config.url}, database "${config.database}"...`);
    
    db = new Database({
      url: config.url,
      databaseName: config.database,
      auth: config.auth
    });
    
    // Test connection
    const info = await db.get();
    console.log(`✓ Connected to database: ${info.name} (version: ${info.version})`);
    
  } catch (error) {
    console.error(`✗ Failed to connect to database at ${config.url}.`);
    console.error('Error:', error.message);
    console.error('Please check your ARANGO_ environment variables.');
    throw error;
  }
}

/**
 * Creates the ingestion_log collection and its indexes.
 */
async function createCollectionAndIndexes() {
  try {
    console.log('Checking "ingestion_log" collection...');
    const collection = db.collection('ingestion_log');
    const exists = await collection.exists();
    
    if (exists) {
      console.log('⚠ "ingestion_log" collection already exists. Skipping creation.');
    } else {
      console.log('Creating "ingestion_log" collection...');
      await db.createCollection('ingestion_log');
      console.log('✓ "ingestion_log" collection created successfully.');
    }

    // --- Create Indexes ---
    
    // Index 1: file_id
    console.log('Ensuring "file_id" index exists...');
    await collection.ensureIndex({
      type: "persistent",
      fields: ["file_id"],
      name: "idx_ingestion_log_file_id"
    });
    console.log('✓ "file_id" index is in place.');

    // Index 2: timestamp
    console.log('Ensuring "timestamp" index exists...');
    await collection.ensureIndex({
      type: "persistent",
      fields: ["timestamp"],
      name: "idx_ingestion_log_timestamp"
    });
    console.log('✓ "timestamp" index is in place.');

  } catch (error) {
    console.error('✗ Error creating collection or indexes:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    await initializeDatabase();
    await createCollectionAndIndexes();
    console.log('\n✅ Setup complete. The "ingestion_log" collection and its indexes are ready.');
  } catch (error) {
    console.error('\n✗ Setup failed.');
    process.exit(1); // Exit with an error code
  }
}

// Execute the main function if the script is run directly
if (require.main === module) {
  main().then(() => {
    process.exit(0); // Exit successfully
  }).catch(() => {
    // Error is already logged in main()
    process.exit(1);
  });
}

