# ArangoDB Performance Optimization Guide for Analytics Service

This guide provides a comprehensive approach to optimizing your ArangoDB analytics service for high performance with large datasets. It includes indexing strategies, query optimization techniques, and troubleshooting methods.

## Table of Contents

- [Getting Started](#getting-started)
- [Indexing Strategy](#indexing-strategy)
- [Query Optimization Techniques](#query-optimization-techniques)
- [Performance Troubleshooting](#performance-troubleshooting)
- [Advanced Optimizations](#advanced-optimizations)

## Getting Started

1. Clone this repository
2. Run the indexing script to create all necessary indexes:

```bash
node create-indexes.js
```

## Indexing Strategy

### Analytics Collection Indexes

1. **`timestamp_type_idx` (timestamp, type)**
   - **Purpose**: Accelerates all queries that filter by timestamp and document type
   - **Used in**: Most analytics queries that have date ranges and filter by type (queries vs feedback)
   - **Impact**: Significantly improves dashboard analytics performance

2. **`queryId_idx` (queryId)**
   - **Purpose**: Speeds up lookups when joining feedback to queries
   - **Used in**: `recordFeedback` and queries that correlate feedback with original queries
   - **Impact**: Makes feedback recording and retrieval faster

3. **`userId_idx` (userId)**
   - **Purpose**: Enables quick counting of unique users
   - **Used in**: `getUniqueUsersCount` which performs a DISTINCT operation
   - **Impact**: Makes user metrics much faster to calculate

4. **`dashboard_query_idx` (type, timestamp, data.isAnswered)**
   - **Purpose**: Optimizes the complex dashboard query
   - **Used in**: `getDashboardAnalytics` counts of answered/unanswered queries
   - **Impact**: Makes the dashboard load much faster

5. **`feedback_idx` (type, timestamp, data.rating)**
   - **Purpose**: Speeds up feedback statistics calculations
   - **Used in**: Feedback aggregation in dashboard analytics
   - **Impact**: Makes satisfaction metrics faster to compute

6. **`category_idx` (type, timestamp, data.categoryId)**
   - **Purpose**: Optimizes category distribution queries
   - **Used in**: Category distribution analytics
   - **Impact**: Makes service category charts load faster

### Queries Collection Indexes

1. **`timestamp_idx` (timestamp)**
   - **Purpose**: Speeds up time-based filtering
   - **Used in**: All time-series queries
   - **Impact**: Basic performance improvement for time filtering

2. **`text_idx` (text)**
   - **Purpose**: Optimizes grouping by query text
   - **Used in**: Top queries aggregation
   - **Impact**: Makes the top queries list load faster

3. **`timeseries_idx` (timestamp, userId)**
   - **Purpose**: Optimizes time series data with user counting
   - **Used in**: `getTimeSeriesData` method
   - **Impact**: Significantly improves time series chart performance

## Query Optimization Techniques

Beyond just adding indexes, these techniques can further optimize your analytics service:

### 1. Use of Bind Variables

Your analytics service already uses bind variables (`@startDate`, `@endDate`, etc.), which is excellent. This prevents query injection and allows ArangoDB to cache query plans.

### 2. Batch Processing

For large analytics operations, process data in batches:

```javascript
// Instead of processing all data at once
const cursor = await this.db.query(query);
const allData = await cursor.all(); // May consume too much memory

// Use batch processing
const cursor = await this.db.query(query);
let batch;
while (batch = await cursor.nextBatch(1000)) {
  // Process this batch of 1000 records
  processBatch(batch);
}
```

### 3. Use Document Keys When Possible

When you know the document key, use `collection.document(key)` instead of a query:

```javascript
// Instead of
const query = `FOR q IN queries FILTER q._key == @key RETURN q`;
const cursor = await this.db.query(query, { key: queryId });
const query = await cursor.next();

// Use direct document lookup
const query = await queries.document(queryId);
```

### 4. Pre-aggregation Strategies

Consider implementing background jobs to pre-calculate common analytics:

1. **Daily aggregation job** - Calculate daily statistics once per day and store them
2. **Use materialized views** - Store pre-calculated results for common queries
3. **Time-bucket aggregation** - Pre-aggregate data into different time buckets (hourly, daily, weekly)

### 5. Query Cache Configuration

In your ArangoDB configuration, optimize the query cache:

```
--query.cache-mode=on
--query.cache-entries=1024
--query.memory-limit=32MB
```

### 6. Collection-Level Optimizations

Consider other collection settings:

1. **Appropriate shard keys** for distribution in a cluster
2. **Memory caching** for frequently accessed collections

## Performance Troubleshooting

When your analytics service is slow despite having proper indexes, use these techniques to diagnose and resolve performance issues.

### Diagnosing Query Performance Issues

#### 1. Query Profiling

Use ArangoDB's query profiling to identify slow queries:

```javascript
// Add this at the beginning of your analytics-service.js
const profileQuery = async (db, queryString, bindVars = {}) => {
  // Enable profiling for this query
  await db.query('FOR i IN [1] RETURN QUERY_PROFILE(true)');
  
  try {
    // Execute the query
    const cursor = await db.query(queryString, bindVars);
    const result = await cursor.all();
    
    // Get profile information
    const profile = await db.query('FOR i IN [1] RETURN QUERY_PROFILE()');
    const profileData = await profile.all();
    
    console.log('=== QUERY PROFILE ===');
    console.log(JSON.stringify(profileData, null, 2));
    console.log('====================');
    
    return result;
  } finally {
    // Disable profiling
    await db.query('FOR i IN [1] RETURN QUERY_PROFILE(false)');
  }
};

// Use it for a slow query
const result = await profileQuery(this.db, 
  'FOR a IN analytics FILTER a.timestamp >= @startDate RETURN a',
  { startDate: '2023-01-01' }
);
```

#### 2. Explain Queries

Get the query execution plan to see if your indexes are being used:

```javascript
const explainQuery = async (db, queryString, bindVars = {}) => {
  const explain = await db.explain(queryString, bindVars, { allPlans: true });
  console.log('=== QUERY EXPLANATION ===');
  console.log(JSON.stringify(explain, null, 2));
  console.log('========================');
  return explain;
};

// Use it to analyze a slow query
await explainQuery(this.db, 
  'FOR a IN analytics FILTER a.timestamp >= @startDate RETURN a',
  { startDate: '2023-01-01' }
);
```

#### 3. Check Index Usage

Verify if your indexes are being used:

```javascript
// Check what indexes are actually being used
const checkIndexUsage = async (db, collection) => {
  const query = `
    RETURN COLLECTION_INDEXES(@collection)
  `;
  const cursor = await db.query(query, { collection });
  const indexes = await cursor.all();
  
  console.log(`=== INDEXES FOR ${collection} ===`);
  console.log(JSON.stringify(indexes[0], null, 2));
  
  // Get index statistics if available
  try {
    const statsQuery = `
      RETURN INDEXES_STATISTICS(@collection)
    `;
    const statsCursor = await db.query(statsQuery, { collection });
    const stats = await statsCursor.all();
    console.log(`=== INDEX STATISTICS FOR ${collection} ===`);
    console.log(JSON.stringify(stats[0], null, 2));
  } catch (e) {
    console.log('Index statistics not available');
  }
};

await checkIndexUsage(db, 'analytics');
```

### Common Performance Issues and Solutions

#### 1. Filter Order Matters

ArangoDB's performance is affected by the order of filters:

```javascript
// Less efficient query - applies timestamp filter first
const lessEfficient = `
  FOR a IN analytics
    FILTER a.timestamp >= @startDate
    FILTER a.type == 'query'
    RETURN a
`;

// More efficient query - applies specific filter first
const moreEfficient = `
  FOR a IN analytics
    FILTER a.type == 'query'
    FILTER a.timestamp >= @startDate
    RETURN a
`;
```

#### 2. COLLECT vs. DISTINCT Performance

COLLECT is often more efficient than DISTINCT for counting:

```javascript
// Less efficient for just counting
const lessEfficient = `
  RETURN LENGTH(
    FOR a IN analytics
      FILTER a.type == 'query'
      RETURN DISTINCT a.userId
  )
`;

// More efficient for counting
const moreEfficient = `
  FOR a IN analytics
    FILTER a.type == 'query'
    COLLECT userId = a.userId
    WITH COUNT INTO count
    RETURN count
`;
```

#### 3. LIMIT Early

Apply LIMIT as early as possible in the query:

```javascript
// Less efficient - processes all documents before limiting
const lessEfficient = `
  FOR a IN analytics
    FILTER a.type == 'query'
    SORT a.timestamp DESC
    RETURN a
    LIMIT 10
`;

// More efficient - applies limit earlier
const moreEfficient = `
  FOR a IN analytics
    FILTER a.type == 'query'
    SORT a.timestamp DESC
    LIMIT 10
    RETURN a
`;
```

#### 4. Avoid Functions on Indexed Fields

Using functions on indexed fields prevents index usage:

```javascript
// Bad - won't use index
const badQuery = `
  FOR a IN analytics
    FILTER DATE_FORMAT(a.timestamp, '%Y-%m-%d') == @dateString
    RETURN a
`;

// Good - uses index
const goodQuery = `
  FOR a IN analytics
    FILTER a.timestamp >= @startDate AND a.timestamp <= @endDate
    RETURN a
`;
```

#### 5. Optimize Subqueries

Move conditions into subqueries:

```javascript
// Less efficient - repeated subquery
const lessEfficient = `
  FOR a IN analytics
    FILTER a.type == 'query'
    LET category = (
      FOR cat IN serviceCategories
        FILTER cat._key == a.data.categoryId
        RETURN cat.nameEN
    )[0]
    SORT category
    RETURN { query: a, category: category }
`;

// More efficient - join with a FOR loop
const moreEfficient = `
  FOR a IN analytics
    FILTER a.type == 'query'
    FOR cat IN serviceCategories
      FILTER cat._key == a.data.categoryId
      SORT cat.nameEN
      RETURN { query: a, category: cat.nameEN }
`;
```

## Advanced Optimizations

### 1. Database-Level Configuration

Adjust your ArangoDB configuration:

```
--database.query-cache-max-results=2048  // Increase cache size
--database.query-cache-mode=on           // Enable query cache
--database.query-cache-entry-max-size=32MB  // Larger entries in cache
```

### 2. Create Computed Values

Consider storing computed values directly in documents:

```javascript
// When recording a query, also store date components
async recordQuery(queryDoc) {
  // Create a Date object once
  const timestamp = new Date(queryDoc.timestamp || new Date());
  
  // Extract and store date components for faster filtering/grouping
  const analyticsDoc = {
    // ... existing fields
    timestamp: timestamp.toISOString(),
    dateComponents: {
      year: timestamp.getFullYear(),
      month: timestamp.getMonth() + 1,
      day: timestamp.getDate(),
      hour: timestamp.getHours()
    }
  };
  
  // Save with pre-computed values
  return await this.analytics.save(analyticsDoc);
}
```

### 3. Use View Instead of Complex Queries

For complex aggregations, consider creating a view:

```javascript
// Create a view (one-time setup)
await db.createView('analytics_by_date', 'arangosearch', {
  links: {
    analytics: {
      includeAllFields: false,
      fields: {
        timestamp: { analyzers: ['identity'] },
        type: { analyzers: ['identity'] },
        'data.categoryId': { analyzers: ['identity'] }
      }
    }
  }
});

// Use the view
const viewQuery = `
  FOR doc IN analytics_by_date
    FILTER doc.timestamp >= @startDate
    FILTER doc.type == 'query'
    COLLECT categoryId = doc.data.categoryId WITH COUNT INTO count
    RETURN { categoryId, count }
`;
```

### 4. Sharding Strategy for Clusters

If you're running ArangoDB in a cluster, optimize your sharding:

```javascript
// Create the collection with optimal sharding
await db.createCollection('analytics', {
  shardKeys: ['timestamp'], // Shard by timestamp for time-based queries
  numberOfShards: 6,        // Adjust based on cluster size
  replicationFactor: 2      // Ensure redundancy
});
```

This enables ArangoDB to parallelize time-based queries across nodes, significantly improving analytics performance.

## Implementation Plan

1. Run the `create-indexes.js` script on your development environment first
2. Benchmark performance before and after indexing
3. Apply to production during a maintenance window
4. Monitor query performance using ArangoDB's profiling tools
5. Adjust indexing strategy based on actual query patterns observed in production

Following this approach will ensure your analytics service can handle a large volume of data with minimal performance degradation.