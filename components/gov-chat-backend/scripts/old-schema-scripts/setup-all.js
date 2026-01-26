// setup-all.js
// Load environment variables from .env file
require('dotenv').config();

const setupDatabase = require('./setup-db');
const initializeServiceCategories = require('./init-service-categories');
const createPasswordResetCollection = require('./create-password-reset-collection');

/**
 * Run the complete database setup
 */
async function setupAll() {
  try {
    console.log('Starting complete database setup...');
    
    // Step 1: Set up database and collections
    console.log('\n=== STEP 1: Setting up database and collections ===');
    await setupDatabase();
    
    // Step 2: Initialize service categories
    console.log('\n=== STEP 2: Initializing service categories ===');
    await initializeServiceCategories();
    
    // Step 3: Ensure password reset collection exists (added)
    console.log('\n=== STEP 3: Setting up password reset tokens collection ===');
    await createPasswordResetCollection();
    
    console.log('\n=== Setup completed successfully! ===');
    return { success: true };
  } catch (error) {
    console.error('\n=== Setup failed ===');
    console.error(error);
    throw error;
  }
}

// Run the setup
if (require.main === module) {
  setupAll()
    .then(() => {
      console.log('All setup completed successfully!');
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = setupAll;