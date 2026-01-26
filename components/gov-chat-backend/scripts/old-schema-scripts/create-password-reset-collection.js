// create-password-reset-collection.js
// Script to create the passwordResetTokens collection in an existing database

require('dotenv').config();
const { Database } = require('arangojs');

// Database connection configuration
const config = {
  url: process.env.ARANGO_URL || 'http://localhost:8529',
  databaseName: process.env.ARANGO_DB || 'node-services',
  auth: {
    username: process.env.ARANGO_USERNAME || 'root',
    password: process.env.ARANGO_PASSWORD || 'test'
  }
};

// Connect to ArangoDB
const db = new Database({
  url: config.url,
  databaseName: config.databaseName,
  auth: {
    username: config.auth.username,
    password: config.auth.password
  }
});

/**
 * Create the passwordResetTokens collection and indexes
 */
async function createPasswordResetCollection() {
  try {
    console.log(`Creating passwordResetTokens collection in '${config.databaseName}'...`);
    
    // Test the connection
    try {
      const info = await db.version();
      console.log(`Connected to ArangoDB version: ${info.version}`);
    } catch (error) {
      console.error("Connection test failed:", error.message);
      throw new Error(`Authentication failed. Please check your ArangoDB credentials. Error: ${error.message}`);
    }
    
    // Check if collection exists
    const passwordResetTokensCollection = db.collection('passwordResetTokens');
    const exists = await passwordResetTokensCollection.exists().catch(() => false);
    
    if (exists) {
      console.log("Collection 'passwordResetTokens' already exists.");
    } else {
      console.log("Creating 'passwordResetTokens' collection...");
      
      // Create the collection
      await passwordResetTokensCollection.create({
        waitForSync: true,
        keyOptions: {
          type: 'autoincrement',
          increment: 1,
          offset: 0
        }
      });
      
      console.log("Collection 'passwordResetTokens' created successfully.");
    }
    
    // Create indexes
    console.log('Creating indexes for passwordResetTokens collection...');
    
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
    
    // Create index on used field for listing unused tokens
    const usedIndex = await passwordResetTokensCollection.ensureIndex({
      type: 'persistent',
      fields: ['used']
    });
    console.log(`Index on used field: ${usedIndex.isNewlyCreated ? 'created' : 'already exists'}`);
    
    console.log('Password reset tokens collection setup completed successfully!');
    return { success: true, message: 'Password reset tokens collection setup completed successfully' };
  } catch (error) {
    console.error('Error setting up password reset tokens collection:', error);
    throw error;
  }
}

// Execute the function if this script is run directly
if (require.main === module) {
  createPasswordResetCollection()
    .then(() => {
      console.log('Password reset collection setup complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

// Export the function for use in other files
module.exports = createPasswordResetCollection;