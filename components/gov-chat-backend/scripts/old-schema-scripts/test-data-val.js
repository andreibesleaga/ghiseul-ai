// data-validation.js
require('dotenv').config();
const { Database } = require('arangojs');
const fs = require('fs');

// Setup logging
const logStream = fs.createWriteStream('data-validation.log', { flags: 'a' });
const log = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}`;
  console.log(logMessage);
  logStream.write(logMessage + '\n');
};

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

// Main validation function
const validateData = async () => {
  try {
    log('Starting data validation...');
    const db = initDB();
    
    // 1. Check collection sizes and status
    await checkCollectionSizes(db);
    
    // 2. Check data distribution over time
    await checkDataDistribution(db);
    
    // 3. Verify indexes and optimize if needed
    await verifyAndCreateIndexes(db);
    
    // 4. Check data consistency
    await checkDataConsistency(db);
    
    // 5. Test queries with different date formats
    await testDateFormats(db);
    
    // 6. Test dashboard queries with wider date range
    await testDashboardQueries(db);
    
    log('Data validation complete.');
    
  } catch (error) {
    log(`Error during validation: ${error.message}`);
    console.error('Error:', error);
  } finally {
    logStream.end();
  }
};

// Check collection sizes and status
const checkCollectionSizes = async (db) => {
  log('Checking collection sizes and status...');
  
  const collections = [
    'serviceCategories', 'users', 'sessions', 'queries', 
    'analytics', 'analyticsMetrics', 'events',
    'userSessions', 'sessionQueries', 'queryCategories'
  ];
  
  const results = {};
  
  for (const collName of collections) {
    try {
      const coll = db.collection(collName);
      const info = await coll.count();
      results[collName] = info;
      log(`Collection ${collName}: ${info.count} documents`);
    } catch (err) {
      log(`Error checking collection ${collName}: ${err.message}`);
    }
  }
  
  log('Collection size check complete');
  return results;
};

// Check data distribution over time
const checkDataDistribution = async (db) => {
  log('Checking data distribution over time...');
  
  // Check query distribution by month
  try {
    log('Checking query distribution by month...');
    const queryDistQuery = `
      FOR q IN queries
        COLLECT month = DATE_FORMAT(q.timestamp, '%Y-%m')
        WITH COUNT INTO count
        SORT month ASC
        RETURN { month, count }
    `;
    
    const cursor = await db.query(queryDistQuery);
    const results = await cursor.all();
    
    if (results.length === 0) {
      log('WARNING: No query distribution data found');
    } else {
      log(`Query distribution by month (${results.length} months):`);
      results.forEach(r => log(`Month ${r.month}: ${r.count} queries`));
    }
    
    // Check if there are records for the most recent month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const hasRecentData = results.some(r => r.month === currentMonth);
    log(`Has data for current month (${currentMonth}): ${hasRecentData}`);
    
  } catch (err) {
    log(`Error checking query distribution: ${err.message}`);
  }
  
  // Check user activity distribution
  try {
    log('Checking user activity distribution...');
    const userActivityQuery = `
      FOR a IN analytics
        FILTER a.type == 'query'
        COLLECT month = DATE_FORMAT(a.timestamp, '%Y-%m')
        AGGREGATE uniqueUsers = COUNT_DISTINCT(a.userId)
        SORT month ASC
        RETURN { month, uniqueUsers }
    `;
    
    const cursor = await db.query(userActivityQuery);
    const results = await cursor.all();
    
    if (results.length === 0) {
      log('WARNING: No user activity distribution data found');
    } else {
      log(`User activity by month (${results.length} months):`);
      results.forEach(r => log(`Month ${r.month}: ${r.uniqueUsers} active users`));
    }
    
  } catch (err) {
    log(`Error checking user activity distribution: ${err.message}`);
  }
  
  // Check data for the last 3 months specifically
  try {
    log('Checking data for the last 3 months...');
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString();
    
    const recentDataQuery = `
      LET startDate = DATE_ISO8601('${threeMonthsAgoStr}')
      LET endDate = DATE_NOW()
      
      LET queryCount = (
        FOR q IN queries
          FILTER q.timestamp >= startDate AND q.timestamp <= endDate
          COLLECT WITH COUNT INTO count
          RETURN count
      )[0]
      
      LET userCount = (
        FOR q IN queries
          FILTER q.timestamp >= startDate AND q.timestamp <= endDate
          COLLECT userId = q.userId WITH COUNT INTO count
          RETURN userId
      )
      
      LET categoryCount = (
        FOR q IN queries
          FILTER q.timestamp >= startDate AND q.timestamp <= endDate
          FILTER q.categoryId != null
          COLLECT categoryId = q.categoryId WITH COUNT INTO count
          RETURN { categoryId, count }
      )
      
      RETURN {
        period: CONCAT(DATE_FORMAT(startDate, '%Y-%m-%d'), ' to ', DATE_FORMAT(endDate, '%Y-%m-%d')),
        queryCount: queryCount,
        uniqueUserCount: LENGTH(userCount),
        categoriesWithData: LENGTH(categoryCount),
        queryByCategoryCount: categoryCount
      }
    `;
    
    const cursor = await db.query(recentDataQuery);
    const result = await cursor.next();
    
    log('Recent data summary:');
    log(JSON.stringify(result, null, 2));
    
    if (result.queryCount === 0) {
      log('WARNING: No queries found in the last 3 months');
    }
    
  } catch (err) {
    log(`Error checking recent data: ${err.message}`);
  }
};

// Verify and create indexes
const verifyAndCreateIndexes = async (db) => {
  log('Verifying and creating indexes...');
  
  const indexConfigs = [
    { collection: 'queries', fields: ['timestamp'], name: 'idx_queries_timestamp', type: 'persistent' },
    { collection: 'queries', fields: ['categoryId'], name: 'idx_queries_categoryId', type: 'persistent' },
    { collection: 'queries', fields: ['userId'], name: 'idx_queries_userId', type: 'persistent' },
    { collection: 'queries', fields: ['sessionId'], name: 'idx_queries_sessionId', type: 'persistent' },
    { collection: 'analytics', fields: ['timestamp'], name: 'idx_analytics_timestamp', type: 'persistent' },
    { collection: 'analytics', fields: ['type'], name: 'idx_analytics_type', type: 'persistent' },
    { collection: 'analytics', fields: ['userId'], name: 'idx_analytics_userId', type: 'persistent' },
    { collection: 'sessions', fields: ['startTime'], name: 'idx_sessions_startTime', type: 'persistent' },
    { collection: 'sessions', fields: ['userId'], name: 'idx_sessions_userId', type: 'persistent' }
  ];
  
  for (const config of indexConfigs) {
    try {
      const collection = db.collection(config.collection);
      
      // Check if index already exists
      const indexes = await collection.indexes();
      const exists = indexes.some(idx => 
        idx.type === config.type && 
        JSON.stringify(idx.fields) === JSON.stringify(config.fields)
      );
      
      if (exists) {
        log(`Index ${config.name} already exists on ${config.collection}`);
      } else {
        log(`Creating index ${config.name} on ${config.collection}...`);
        
        if (config.type === 'persistent') {
          await collection.ensureIndex({
            type: 'persistent',
            fields: config.fields,
            name: config.name
          });
        }
        
        log(`Created index ${config.name}`);
      }
    } catch (err) {
      log(`Error creating index ${config.name}: ${err.message}`);
    }
  }
  
  log('Index verification complete');
};

// Check data consistency
const checkDataConsistency = async (db) => {
  log('Checking data consistency...');
  
  // Check for queries without valid sessionId
  try {
    log('Checking for queries without valid sessionId...');
    const orphanedQueriesQuery = `
      FOR q IN queries
        FILTER q.sessionId != null
        LET session = DOCUMENT(q.sessionId)
        FILTER session == null
        LIMIT 10
        RETURN q
    `;
    
    const cursor = await db.query(orphanedQueriesQuery);
    const results = await cursor.all();
    
    if (results.length === 0) {
      log('No orphaned queries found (all queries have valid sessionId)');
    } else {
      log(`WARNING: Found ${results.length} queries with invalid sessionId`);
      log(`Sample orphaned query: ${JSON.stringify(results[0], null, 2)}`);
    }
  } catch (err) {
    log(`Error checking orphaned queries: ${err.message}`);
  }
  
  // Check for queries with invalid categoryId
  try {
    log('Checking for queries with invalid categoryId...');
    const invalidCategoryQuery = `
      FOR q IN queries
        FILTER q.categoryId != null
        LET category = DOCUMENT(q.categoryId)
        FILTER category == null
        LIMIT 10
        RETURN q
    `;
    
    const cursor = await db.query(invalidCategoryQuery);
    const results = await cursor.all();
    
    if (results.length === 0) {
      log('No queries with invalid categoryId found');
    } else {
      log(`WARNING: Found ${results.length} queries with invalid categoryId`);
      log(`Sample query with invalid category: ${JSON.stringify(results[0], null, 2)}`);
    }
  } catch (err) {
    log(`Error checking invalid categories: ${err.message}`);
  }
  
  // Verify that timestamp formats are consistent
  try {
    log('Checking timestamp formats...');
    const timestampFormatQuery = `
      FOR q IN queries
        LIMIT 100
        RETURN { id: q._key, timestamp: q.timestamp }
    `;
    
    const cursor = await db.query(timestampFormatQuery);
    const results = await cursor.all();
    
    if (results.length === 0) {
      log('WARNING: No queries found for timestamp format check');
    } else {
      // Check if all timestamps are ISO format
      const nonIsoTimestamps = results.filter(r => {
        const timestamp = r.timestamp;
        // Check if timestamp is a valid ISO format (rough check)
        return !timestamp || typeof timestamp !== 'string' || 
               !timestamp.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/);
      });
      
      if (nonIsoTimestamps.length === 0) {
        log('All checked timestamps are in valid ISO format');
      } else {
        log(`WARNING: Found ${nonIsoTimestamps.length} queries with non-ISO timestamps`);
        log(`Sample: ${JSON.stringify(nonIsoTimestamps[0], null, 2)}`);
      }
    }
  } catch (err) {
    log(`Error checking timestamp formats: ${err.message}`);
  }
};

// Test with different date formats
const testDateFormats = async (db) => {
  log('Testing queries with different date formats...');
  
  // Current date in various formats
  const now = new Date();
  const iso = now.toISOString();
  const dateOnly = iso.split('T')[0];
  const dateTimeLocal = iso.replace('Z', '');
  
  // 30 days ago in various formats
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const isoThirtyDaysAgo = thirtyDaysAgo.toISOString();
  const dateOnlyThirtyDaysAgo = isoThirtyDaysAgo.split('T')[0];
  
  const formats = [
    { name: 'ISO with Z', start: isoThirtyDaysAgo, end: iso },
    { name: 'ISO without Z', start: isoThirtyDaysAgo.replace('Z', ''), end: dateTimeLocal },
    { name: 'Date only', start: dateOnlyThirtyDaysAgo, end: dateOnly },
    { name: 'Date timestamp in milliseconds', start: thirtyDaysAgo.getTime(), end: now.getTime() },
    { name: 'DATE_ISO8601', start: `DATE_ISO8601('${isoThirtyDaysAgo}')`, end: `DATE_ISO8601('${iso}')`, isAQL: true },
    { name: 'DATE_NOW', start: `DATE_ISO8601('${isoThirtyDaysAgo}')`, end: 'DATE_NOW()', isAQL: true }
  ];
  
  for (const format of formats) {
    try {
      let query;
      
      if (format.isAQL) {
        // For AQL date functions
        query = `
          LET startDate = ${format.start}
          LET endDate = ${format.end}
          
          FOR q IN queries
            FILTER q.timestamp >= startDate AND q.timestamp <= endDate
            COLLECT WITH COUNT INTO count
            RETURN count
        `;
      } else {
        // For string or numeric formats
        query = `
          FOR q IN queries
            FILTER q.timestamp >= '${format.start}' AND q.timestamp <= '${format.end}'
            COLLECT WITH COUNT INTO count
            RETURN count
        `;
        
        // Special case for timestamps as numbers
        if (format.name.includes('milliseconds')) {
          query = `
            FOR q IN queries
              FILTER DATE_TIMESTAMP(q.timestamp) >= ${format.start} AND DATE_TIMESTAMP(q.timestamp) <= ${format.end}
              COLLECT WITH COUNT INTO count
              RETURN count
          `;
        }
      }
      
      log(`Testing with ${format.name}`);
      log(`Query: ${query}`);
      
      const cursor = await db.query(query);
      const result = await cursor.next();
      
      log(`Result with ${format.name}: ${result}`);
      
    } catch (err) {
      log(`Error testing with ${format.name}: ${err.message}`);
    }
  }
};

// Test dashboard queries with wider date range
const testDashboardQueries = async (db) => {
  log('Testing dashboard queries with wider date ranges...');
  
  // Test with 3 different date ranges
  const ranges = [
    { name: 'Last 7 days', days: 7 },
    { name: 'Last 30 days', days: 30 },
    { name: 'Last 90 days', days: 90 },
    { name: 'All time', days: 365 * 10 } // Very wide range to capture everything
  ];
  
  for (const range of ranges) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - range.days);
      const startDateISO = startDate.toISOString();
      
      log(`Testing dashboard query with range: ${range.name}`);
      
      const query = `
        LET startDate = DATE_ISO8601('${startDateISO}')
        LET endDate = DATE_NOW()
        
        LET query_data = (
          FOR q IN queries
            FILTER q.timestamp >= startDate AND q.timestamp <= endDate
            COLLECT WITH COUNT INTO queryCount
            RETURN queryCount
        )
        
        LET user_data = (
          FOR q IN queries
            FILTER q.timestamp >= startDate AND q.timestamp <= endDate
            COLLECT userId = q.userId WITH COUNT INTO queryCount
            RETURN userId
        )
        
        LET response_data = (
          FOR q IN queries
            FILTER q.timestamp >= startDate AND q.timestamp <= endDate
            RETURN q.responseTime
        )
        
        LET avg_response = LENGTH(response_data) > 0 ? 
          AVERAGE(response_data) : 0
        
        LET feedback_data = (
          FOR a IN analytics
            FILTER a.type == "feedback" 
            AND a.timestamp >= startDate AND a.timestamp <= endDate
            COLLECT rating = a.data.rating WITH COUNT INTO count
            RETURN { rating, count }
        )
        
        LET positive_feedback = SUM(
          FOR f IN feedback_data
            FILTER f.rating >= 4
            RETURN f.count
        ) || 0
        
        LET total_feedback = SUM(
          FOR f IN feedback_data
            RETURN f.count
        ) || 0
        
        LET category_data = (
          FOR q IN queries
            FILTER q.timestamp >= startDate AND q.timestamp <= endDate
            FILTER q.categoryId != null
            COLLECT categoryId = q.categoryId WITH COUNT INTO count
            LET category = DOCUMENT(categoryId)
            RETURN {
              categoryId,
              name: category.nameEN,
              count
            }
        )
        
        RETURN {
          dateRange: { 
            start: DATE_FORMAT(startDate, '%Y-%m-%d'),
            end: DATE_FORMAT(endDate, '%Y-%m-%d'),
            name: '${range.name}'
          },
          queries: {
            total: SUM(query_data) || 0,
            avgResponseTime: avg_response
          },
          users: {
            activeCount: LENGTH(user_data)
          },
          feedback: {
            positivePercentage: total_feedback > 0 ? (positive_feedback / total_feedback) * 100 : 0,
            totalFeedback: total_feedback
          },
          categories: {
            totalCategories: LENGTH(category_data),
            sampleCategories: (
              FOR cat IN category_data
              SORT cat.count DESC
              LIMIT 3
              RETURN cat
            )
          }
        }
      `;
      
      const cursor = await db.query(query);
      const result = await cursor.next();
      
      log(`Dashboard query results for ${range.name}:`);
      log(JSON.stringify(result, null, 2));
      
      if (result.queries.total === 0) {
        log(`WARNING: No queries found for range ${range.name}`);
      } else {
        log(`SUCCESS: Found ${result.queries.total} queries for range ${range.name}`);
      }
    } catch (err) {
      log(`Error testing dashboard query for ${range.name}: ${err.message}`);
    }
  }
  
  // Test a simple count query to verify data is accessible
  try {
    log('Testing simple count query to verify data access...');
    
    const query = `
      RETURN {
        totalQueries: LENGTH(FOR q IN queries RETURN q._key),
        totalUsers: LENGTH(FOR u IN users RETURN u._key),
        totalSessions: LENGTH(FOR s IN sessions RETURN s._key),
        totalAnalytics: LENGTH(FOR a IN analytics RETURN a._key),
        totalServiceCategories: LENGTH(FOR c IN serviceCategories RETURN c._key)
      }
    `;
    
    const cursor = await db.query(query);
    const result = await cursor.next();
    
    log(`Simple count query results:`);
    log(JSON.stringify(result, null, 2));
    
    if (result.totalQueries === 0) {
      log(`CRITICAL: No queries found in database!`);
    } else {
      log(`SUCCESS: Database contains ${result.totalQueries} queries, ${result.totalUsers} users, ${result.totalSessions} sessions`);
    }
  } catch (err) {
    log(`Error executing simple count query: ${err.message}`);
  }
};

// Run the validation
validateData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});