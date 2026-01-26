// query_feedback.js
const { Database } = require('arangojs');

// Configure your ArangoDB connection
const db = new Database({
  url: 'http://localhost:8529', // Change this to your ArangoDB server URL
  databaseName: 'node-services',       // Change this to your database name
  auth: {
    username: 'root',           // Change this to your username
    password: 'test'        // Change this to your password
  }
});

async function queryFeedback() {
  try {
    console.log('Connecting to database...');
    
    // Query for the most recent feedback entries
    const recentFeedbackQuery = `
      FOR q IN queries
        FILTER q.userFeedback != null
        FILTER q.userFeedback.rating != null
        SORT q.timestamp DESC
        LIMIT 20
        RETURN {
          categoryId: q.categoryId,
          timestamp: q.timestamp,
          rating: q.userFeedback.rating,
          comment: q.userFeedback.comment
        }
    `;
    
    console.log('Querying recent feedback...');
    const recentFeedbackCursor = await db.query(recentFeedbackQuery);
    const recentFeedback = await recentFeedbackCursor.all();
    
    console.log('\n=== 20 Most Recent Feedback Entries ===');
    if (recentFeedback.length === 0) {
      console.log('No feedback entries found');
    } else {
      recentFeedback.forEach((entry, index) => {
        console.log(`\nEntry #${index + 1}:`);
        console.log(`Category ID: ${entry.categoryId}`);
        console.log(`Timestamp: ${entry.timestamp}`);
        console.log(`Rating: ${entry.rating}/5`);
        if (entry.comment) {
          console.log(`Comment: ${entry.comment}`);
        }
      });
    }
    
    // Query for feedback count by category
    const feedbackByCategoryQuery = `
      FOR q IN queries
        FILTER q.userFeedback != null
        FILTER q.userFeedback.rating != null
        COLLECT categoryId = q.categoryId WITH COUNT INTO count
        SORT count DESC
        RETURN {
          categoryId: categoryId,
          count: count
        }
    `;
    
    console.log('\n\n=== Feedback Count by Category ===');
    const categoryFeedbackCursor = await db.query(feedbackByCategoryQuery);
    const categoryFeedback = await categoryFeedbackCursor.all();
    
    if (categoryFeedback.length === 0) {
      console.log('No categories with feedback found');
    } else {
      categoryFeedback.forEach((category) => {
        console.log(`Category ${category.categoryId}: ${category.count} entries`);
      });
    }
    
    // Query for feedback in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTimeframeQuery = `
      FOR q IN queries
        FILTER q.userFeedback != null
        FILTER q.userFeedback.rating != null
        FILTER q.timestamp >= "${thirtyDaysAgo.toISOString()}"
        COLLECT AGGREGATE
          count = COUNT(),
          avgRating = AVG(q.userFeedback.rating)
        RETURN {
          count: count,
          avgRating: avgRating
        }
    `;
    
    console.log('\n\n=== Feedback in the Last 30 Days ===');
    const recentStatsCursor = await db.query(recentTimeframeQuery);
    const recentStats = await recentStatsCursor.next();
    
    if (!recentStats || recentStats.count === 0) {
      console.log('No feedback entries in the last 30 days');
    } else {
      console.log(`Total entries: ${recentStats.count}`);
      console.log(`Average rating: ${recentStats.avgRating.toFixed(2)}/5`);
    }
    
    // Query for weekly breakdown (last 5 weeks)
    const weeklyBreakdownQuery = `
      LET now = DATE_NOW()
      LET fiveWeeksAgo = DATE_SUBTRACT(now, 35, "day")
      
      FOR q IN queries
        FILTER q.userFeedback != null
        FILTER q.userFeedback.rating != null
        FILTER q.timestamp >= "${new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()}"
        
        LET weekNumber = DATE_DIFF(
          DATE_TRUNC(q.timestamp, "day"),
          DATE_TRUNC(now, "day"),
          "day"
        ) / 7
        
        LET weekLabel = FLOOR(ABS(weekNumber))
        
        COLLECT week = weekLabel WITH COUNT INTO weekCount
        SORT week ASC
        
        RETURN {
          week: week == 0 ? "Current Week" : 
                week == 1 ? "1 Week Ago" : 
                week == 2 ? "2 Weeks Ago" : 
                week == 3 ? "3 Weeks Ago" : 
                week == 4 ? "4 Weeks Ago" : 
                "Older",
          count: weekCount
        }
    `;
    
    console.log('\n\n=== Weekly Feedback Breakdown ===');
    const weeklyBreakdownCursor = await db.query(weeklyBreakdownQuery);
    const weeklyBreakdown = await weeklyBreakdownCursor.all();
    
    if (weeklyBreakdown.length === 0) {
      console.log('No feedback entries in the last 5 weeks');
    } else {
      weeklyBreakdown.forEach((week) => {
        console.log(`${week.week}: ${week.count} entries`);
      });
    }
    
  } catch (error) {
    console.error('Error querying feedback data:', error);
  }
}

// Execute the main function
queryFeedback().then(() => {
  console.log('\nQuery completed.');
}).catch(err => {
  console.error('Fatal error:', err);
});