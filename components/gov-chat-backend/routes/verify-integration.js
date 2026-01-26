// verify-integration.js
// Run this script to verify the integration between query service and analytics service
require('dotenv').config();
const QueryService = require('../services/query-service');
const AnalyticsService = require('../services/analytics-service');

async function verifyIntegration() {
  try {
    console.log("Starting integration verification...");
    
    // Initialize services
    const queryService = new QueryService();
    const analyticsService = new AnalyticsService();
    
    // Inject analytics service into query service
    console.log("Setting analytics service...");
    queryService.setAnalyticsService(analyticsService);
    
    // Verify injection
    if (queryService.analyticsService) {
      console.log("✅ Analytics service successfully injected into query service");
    } else {
      console.error("❌ Failed to inject analytics service into query service");
      return;
    }
    
    // Test creating a query and check if analytics is updated
    console.log("\nCreating a test query...");
    const testQuery = await queryService.createQuery({
      userId: "test_integration_user",
      sessionId: "test_integration_session",
      text: "This is a test query for integration verification",
      timestamp: new Date().toISOString()
    });
    
    console.log(`Query created with ID: ${testQuery._key}`);
    
    // Check analytics collection
    console.log("\nChecking analytics collection for query record...");
    
    // Give a moment for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Query the analytics collection for the record
    const analyticsCursor = await analyticsService.db.query(`
      FOR a IN analytics
        FILTER a.queryId == "${testQuery._key}"
        RETURN a
    `);
    
    const analyticsRecords = await analyticsCursor.all();
    
    if (analyticsRecords.length > 0) {
      console.log(`✅ Found ${analyticsRecords.length} records in analytics for query ${testQuery._key}`);
      console.log("Sample record:", JSON.stringify(analyticsRecords[0], null, 2).substring(0, 200) + "...");
    } else {
      console.error(`❌ No analytics records found for query ${testQuery._key}`);
    }
    
    // Test adding feedback
    console.log("\nAdding feedback to the test query...");
    const updatedQuery = await queryService.addFeedback(testQuery._key, {
      rating: 5,
      comment: "This is a test feedback comment"
    });
    
    console.log(`Feedback added to query ${testQuery._key}`);
    
    // Check analytics collection for feedback record
    console.log("\nChecking analytics collection for feedback record...");
    
    // Give a moment for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Query the analytics collection for the feedback record
    const feedbackCursor = await analyticsService.db.query(`
      FOR a IN analytics
        FILTER a.queryId == "${testQuery._key}" && a.type == "feedback"
        RETURN a
    `);
    
    const feedbackRecords = await feedbackCursor.all();
    
    if (feedbackRecords.length > 0) {
      console.log(`✅ Found ${feedbackRecords.length} feedback records in analytics for query ${testQuery._key}`);
      console.log("Sample feedback record:", JSON.stringify(feedbackRecords[0], null, 2).substring(0, 200) + "...");
    } else {
      console.error(`❌ No feedback records found for query ${testQuery._key}`);
    }
    
    console.log("\nIntegration verification completed!");
  } catch (error) {
    console.error("Error verifying integration:", error);
  }
}

// Run the verification
verifyIntegration();