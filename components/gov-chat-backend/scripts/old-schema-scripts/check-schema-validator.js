// Save as check-schema-validator.js
require('dotenv').config();
const { Database } = require('arangojs');

(async function() {
  try {
    console.log('Checking schema validator implementation...');
    
    // Initialize ArangoDB connection
    const db = new Database({
      url: process.env.ARANGO_URL || 'http://localhost:8529',
      databaseName: process.env.ARANGO_DB || 'node-services',
      auth: {
        username: process.env.ARANGO_USERNAME || 'root',
        password: process.env.ARANGO_PASSWORD || 'test'
      }
    });
    
    // Check if we can create a test database to check validation behavior
    try {
      // Create a test database
      const testDbName = `test_schema_db_${Date.now()}`;
      console.log(`Creating test database: ${testDbName}`);
      
      try {
        await db.createDatabase(testDbName);
        console.log(`Test database created successfully`);
        
        // Switch to the test database
        const testDb = new Database({
          url: process.env.ARANGO_URL || 'http://localhost:8529',
          databaseName: testDbName,
          auth: {
            username: process.env.ARANGO_USERNAME || 'root',
            password: process.env.ARANGO_PASSWORD || 'test'
          }
        });
        
        // Create a test collection with schema validation
        console.log('Creating test collection with schema validation');
        const testColl = testDb.collection('test_coll');
        await testColl.create();
        
        // Apply schema validation
        console.log('Applying schema validation to test collection');
        await testColl.properties({
          schema: {
            rule: {
              type: "object",
              properties: {
                name: { type: "string" },
                age: { type: "number" }
              },
              required: ["name", "age"]
            },
            level: "strict",
            message: "Document does not match schema"
          }
        });
        
        console.log('Schema validation applied');
        
        // Try to insert valid document
        console.log('Trying to insert valid document');
        try {
          const validDoc = await testColl.save({ name: "John", age: 30 });
          console.log(`Valid document inserted: ${validDoc._key}`);
        } catch (validError) {
          console.error(`ERROR: Could not insert valid document: ${validError.message}`);
        }
        
        // Try to insert invalid document
        console.log('Trying to insert invalid document');
        try {
          await testColl.save({ name: "Jane" }); // Missing required age field
          console.error('ERROR: Invalid document was accepted!');
        } catch (invalidError) {
          console.log(`EXPECTED ERROR for invalid document: ${invalidError.message}`);
        }
        
        // Try to use AQL to insert valid document
        console.log('Trying to insert valid document via AQL');
        try {
          const aqlCursor = await testDb.query(`
            INSERT { name: "Bob", age: 40 } INTO test_coll
            RETURN NEW
          `);
          const aqlResult = await aqlCursor.next();
          console.log(`Valid document inserted via AQL: ${aqlResult._key}`);
        } catch (aqlValidError) {
          console.error(`ERROR: Could not insert valid document via AQL: ${aqlValidError.message}`);
        }
        
        // Try to use AQL to insert invalid document
        console.log('Trying to insert invalid document via AQL');
        try {
          await testDb.query(`
            INSERT { name: "Alice" } INTO test_coll
            RETURN NEW
          `);
          console.error('ERROR: Invalid document was accepted via AQL!');
        } catch (aqlInvalidError) {
          console.log(`EXPECTED ERROR for invalid document via AQL: ${aqlInvalidError.message}`);
        }
        
        // Get collection properties
        const props = await testColl.properties();
        console.log('Collection schema settings:', JSON.stringify(props.schema));
        
        // Drop the test database
        console.log(`Dropping test database: ${testDbName}`);
        await db.dropDatabase(testDbName);
        console.log('Test database dropped');
        
      } catch (testDbError) {
        console.error(`Error during test database operations: ${testDbError.message}`);
      }
    } catch (createDbError) {
      console.log(`Could not create test database: ${createDbError.message}`);
      console.log('Checking schema on existing "queries" collection instead...');
      
      // Check existing queries collection
      const queriesColl = db.collection('queries');
      
      if (await queriesColl.exists()) {
        console.log('Queries collection exists');
        
        // Get schema properties
        const props = await queriesColl.properties();
        console.log('Queries collection schema:', JSON.stringify(props.schema, null, 2));
        
        // Try a direct document API call
        try {
          const response = await db._connection.request({
            method: 'POST',
            path: '/_api/document/queries',
            body: {
              userId: "test",
              sessionId: "test",
              text: "Test query",
              timestamp: new Date().toISOString(),
              isAnswered: false
            }
          });
          console.log('Direct API document creation successful:', response);
        } catch (directApiError) {
          console.error(`Direct API document creation failed: ${directApiError.message}`);
        }
      } else {
        console.error('Queries collection does not exist!');
      }
    }
    
    console.log('Schema validator check complete');
  } catch (error) {
    console.error('Schema check error:', error);
  }
})();