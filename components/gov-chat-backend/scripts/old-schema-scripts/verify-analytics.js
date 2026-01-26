// verify-analytics.js
// Run this script to directly check the analytics collections
require('dotenv').config();
const { Database } = require('arangojs');

async function verifyAnalytics() {
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

    console.log('Checking analytics collections...');

    // Check analytics collection
    try {
      const analyticsCursor = await db.query(`
        FOR a IN analytics
        RETURN a
      `);
      const analyticsRecords = await analyticsCursor.all();
      console.log(`Found ${analyticsRecords.length} records in analytics collection`);
      
      if (analyticsRecords.length > 0) {
        console.log('Sample analytics record:');
        console.log(JSON.stringify(analyticsRecords[0], null, 2));
      }
    } catch (error) {
      console.error('Error checking analytics collection:', error);
    }

    // Check events collection
    try {
      const eventsCursor = await db.query(`
        FOR e IN events
        RETURN e
      `);
      const eventsRecords = await eventsCursor.all();
      console.log(`Found ${eventsRecords.length} records in events collection`);
      
      if (eventsRecords.length > 0) {
        console.log('Sample events record:');
        console.log(JSON.stringify(eventsRecords[0], null, 2));
      }
    } catch (error) {
      console.error('Error checking events collection:', error);
    }

    // Check if analytics service is properly injected into query service
    console.log('\nChecking for analyticsService references in queries collection...');
    try {
      const queriesCursor = await db.query(`
        FOR q IN queries
        FILTER q.userFeedback != null
        RETURN q
      `);
      const queriesWithFeedback = await queriesCursor.all();
      console.log(`Found ${queriesWithFeedback.length} queries with feedback`);
      
      if (queriesWithFeedback.length > 0) {
        console.log('Sample query with feedback:');
        console.log(JSON.stringify(queriesWithFeedback[0], null, 2));
      }
    } catch (error) {
      console.error('Error checking queries with feedback:', error);
    }

    console.log('\nVerification complete!');
  } catch (error) {
    console.error('Error verifying analytics:', error);
  }
}

// Run the function
verifyAnalytics();