// update-admin.js
require('dotenv').config();
const { Database } = require('arangojs');

// Database connection
const DB_URL = process.env.ARANGO_URL || 'http://localhost:8529';
const DB_NAME = process.env.ARANGO_DB || 'node-services';
const DB_USER = process.env.ARANGO_USER || 'root';
const DB_PASS = process.env.ARANGO_PASSWORD || 'test';

// Connect to ArangoDB
const db = new Database({
  url: DB_URL,
  databaseName: DB_NAME,
  auth: {
    username: DB_USER,
    password: DB_PASS
  }
});

async function updateUserToAdmin() {
  try {
    console.log('Updating user to admin...');
    
    // Execute the update query
    const cursor = await db.query(`
      FOR u IN users
        FILTER u._key == "2133"
        UPDATE u WITH { 
          role: "Admin"
        } IN users
        RETURN NEW
    `);
    
    // Get the updated user
    const result = await cursor.all();
    
    if (result.length > 0) {
      console.log('User updated successfully:');
      console.log(JSON.stringify(result[0], null, 2));
    } else {
      console.log('No user found with ID 2133');
    }
  } catch (error) {
    console.error('Error updating user:', error);
  }
}

// Run the update
updateUserToAdmin().catch(err => {
  console.error('Fatal error:', err);
}).finally(() => {
  process.exit(0);
});