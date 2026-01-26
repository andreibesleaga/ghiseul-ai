// check-collections.js
// Save this as a separate script to verify your ArangoDB collections

require('dotenv').config();
const { Database } = require('arangojs');

async function checkCollections() {
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

    // Check if database exists, if not create it
    try {
      await db.database(process.env.ARANGO_DB || 'node-services').exists();
      console.log(`Database ${process.env.ARANGO_DB || 'node-services'} exists`);
    } catch (err) {
      console.log(`Creating database ${process.env.ARANGO_DB || 'node-services'}`);
      await db.createDatabase(process.env.ARANGO_DB || 'node-services');
    }

    // Get list of collections
    const collections = await db.listCollections();
    console.log(`Found ${collections.length} collections:`);
    
    for (const collection of collections) {
      console.log(`- ${collection.name} (type: ${collection.type})`);
      
      // Get collection properties
      const props = await db.collection(collection.name).properties();
      console.log(`  Properties: ${JSON.stringify(props, null, 2)}`);
      
      // Get count of documents
      const count = await db.collection(collection.name).count();
      console.log(`  Document count: ${count.count}`);
      
      // Get a sample document if any exist
      if (count.count > 0) {
        const cursor = await db.query(`FOR doc IN ${collection.name} LIMIT 1 RETURN doc`);
        const sample = await cursor.next();
        console.log(`  Sample document key: ${sample._key}`);
        console.log(`  Sample document: ${JSON.stringify(sample, null, 2).substring(0, 200)}...`);
      }
    }

    console.log("Collection check complete!");
  } catch (error) {
    console.error("Error checking collections:", error);
  }
}

// Run the function
checkCollections();