// test-keys.js
// Save this as a separate script to test key creation directly

require('dotenv').config();
const { Database } = require('arangojs');

async function testKeys() {
  try {
    // Initialize ArangoDB connection
    const db = new Database({
      url: process.env.ARANGO_URL || 'http://localhost:8529',
      databaseName: process.env.ARANGO_DB || 'node-services',
      auth: {
        username: process.env.ARANGO_USERNAME || 'root',
        password: process.env.ARANGO_PASSWORD || 'test'
      }
    });

    console.log("Testing key formats in ArangoDB...");

    // Make sure users collection exists
    let collection;
    try {
      collection = db.collection('test_keys');
      const exists = await collection.exists();
      if (!exists) {
        console.log("Creating test_keys collection...");
        await collection.create();
      }
    } catch (error) {
      console.log("Creating test_keys collection...");
      collection = db.collection('test_keys');
      await collection.create();
    }

    // Test various key formats
    const keyFormats = [
      `key${Date.now()}${Math.floor(Math.random() * 1000000)}`,
      `doc${Date.now()}${Math.floor(Math.random() * 1000)}`,
      `test_${Date.now()}`,
      `abc123`,
      `document_${Date.now()}`,
      `user-${Date.now()}`,
      `key-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    ];

    for (const key of keyFormats) {
      try {
        console.log(`Testing key format: ${key}`);
        const doc = await collection.save({ _key: key, test: true });
        console.log(`✅ Success! Document created with key: ${doc._key}`);
        
        // Clean up
        await collection.remove(key);
      } catch (error) {
        console.error(`❌ Error with key "${key}": ${error.message}`);
      }
    }

    console.log("Key format testing complete!");
  } catch (error) {
    console.error("Error testing keys:", error);
  }
}

// Run the function
testKeys();