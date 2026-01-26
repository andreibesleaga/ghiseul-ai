// create-indexes.js
// Script to create optimized indexes for analytics service queries
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

async function createIndexes() {
  const db = initDB();
  
  try {
    console.log('Starting index creation for analytics optimization...');
    
    // Collection references
    const analytics = db.collection('analytics');
    const events = db.collection('events');
    const queries = db.collection('queries');
    const users = db.collection('users');
    const sessions = db.collection('sessions');
    const serviceCategories = db.collection('serviceCategories');
    
    // Make sure all collections exist before creating indexes
    await ensureCollectionsExist(db, [
      'analytics', 'events', 'queries', 'users', 'sessions', 'serviceCategories'
    ]);
    
    // Create indexes for analytics collection
    console.log('Creating indexes for analytics collection...');
    
    // Index for timestamp + type queries (used in many queries)
    await createPersistentIndex(analytics, ['timestamp', 'type'], 'timestamp_type_idx');
    
    // Index for analytics by queryId (used in recordFeedback & other queries)
    await createPersistentIndex(analytics, ['queryId'], 'queryId_idx');
    
    // Index for analytics by type (used in many filters)
    await createPersistentIndex(analytics, ['type'], 'type_idx');
    
    // Index for analytics by userId (used in unique users count)
    await createPersistentIndex(analytics, ['userId'], 'userId_idx');
    
    // Combined index for dashboard analytics query
    await createPersistentIndex(analytics, ['type', 'timestamp', 'data.isAnswered'], 'dashboard_query_idx');
    
    // Index for feedback rating lookup
    await createPersistentIndex(analytics, ['type', 'timestamp', 'data.rating'], 'feedback_idx');
    
    // Index for category distribution
    await createPersistentIndex(analytics, ['type', 'timestamp', 'data.categoryId'], 'category_idx');
    
    // Create indexes for events collection
    console.log('Creating indexes for events collection...');
    
    // Index for events by timestamp
    await createPersistentIndex(events, ['timestamp'], 'timestamp_idx');
    
    // Index for events by userId
    await createPersistentIndex(events, ['userId'], 'userId_idx');
    
    // Index for events by eventType
    await createPersistentIndex(events, ['eventType'], 'eventType_idx');
    
    // Create indexes for queries collection
    console.log('Creating indexes for queries collection...');
    
    // Index for queries by timestamp
    await createPersistentIndex(queries, ['timestamp'], 'timestamp_idx');
    
    // Index for queries by text (for top queries analysis)
    await createPersistentIndex(queries, ['text'], 'text_idx');
    
    // Index for queries by responseTime (for avg calculation)
    await createPersistentIndex(queries, ['responseTime'], 'responseTime_idx');
    
    // Index for queries by isAnswered
    await createPersistentIndex(queries, ['isAnswered'], 'isAnswered_idx');
    
    // Combined index for time series breakdowns
    await createPersistentIndex(queries, ['timestamp', 'userId'], 'timeseries_idx');
    
    // Index for queries by categoryId
    await createPersistentIndex(queries, ['categoryId'], 'categoryId_idx');
    
    // Create indexes for serviceCategories collection
    console.log('Creating indexes for serviceCategories collection...');
    
    // Index for serviceCategories by nameEN (for category name lookups)
    await createPersistentIndex(serviceCategories, ['nameEN'], 'nameEN_idx');
    
    console.log('All indexes created successfully!');
    
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
}

// Helper function to ensure collections exist
async function ensureCollectionsExist(db, collectionNames) {
  const collections = await db.listCollections();
  const existingCollections = collections.map(c => c.name);
  
  for (const name of collectionNames) {
    if (!existingCollections.includes(name)) {
      console.log(`Collection '${name}' does not exist. Creating it...`);
      await db.createCollection(name);
      console.log(`Created collection '${name}'`);
    }
  }
}

// Helper function to create a persistent index
async function createPersistentIndex(collection, fields, indexName) {
  try {
    // Check if index already exists
    const indexes = await collection.indexes();
    const existingIndex = indexes.find(idx => 
      idx.type === 'persistent' && 
      JSON.stringify(idx.fields.sort()) === JSON.stringify(fields.sort()));
    
    if (existingIndex) {
      console.log(`Index on fields [${fields.join(', ')}] already exists`);
      return;
    }
    
    // Create the index
    await collection.ensureIndex({
      type: 'persistent',
      fields: fields,
      name: indexName,
      sparse: false
    });
    
    console.log(`Created persistent index '${indexName}' on fields [${fields.join(', ')}]`);
  } catch (error) {
    console.error(`Error creating index on fields [${fields.join(', ')}]:`, error);
  }
}

// Run the indexing function
createIndexes()
  .then(() => {
    console.log('Indexing completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error during indexing process:', err);
    process.exit(1);
  });