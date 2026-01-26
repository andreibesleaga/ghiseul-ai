// update_feedback_categories.js
const { Database } = require('arangojs');

// Configure your ArangoDB connection
const db = new Database({
  url: 'http://localhost:8529', // Change to your ArangoDB server URL
  databaseName: 'node-services',       // Change to your database name
  auth: {
    username: 'root',           // Change to your username
    password: 'test'        // Change to your password
  }
});

// The correct service category format based on the QueryService
const serviceCategories = [
  { id: '1', name: 'Identity & Civil Registration' },
  { id: '2', name: 'Healthcare & Social Services' },
  { id: '3', name: 'Education & Learning' },
  { id: '4', name: 'Employment & Labor Services' },
  { id: '5', name: 'Taxes & Revenue' },
  { id: '6', name: 'Public Safety & Justice' },
  { id: '7', name: 'Transportation & Mobility' },
  { id: '8', name: 'Business & Trade' },
  { id: '9', name: 'Housing & Urban Development' },
  { id: '10', name: 'Utilities & Environment' },
  { id: '11', name: 'Culture & Recreation' },
  { id: '12', name: 'Immigration & Citizenship' },
  { id: '13', name: 'Social Security & Pensions' }
];

// Map of old category IDs to proper service category IDs
const categoryMapping = {
  // For catX format
  'cat1': '1',
  'cat2': '2',
  'cat3': '3',
  'cat4': '4',
  'cat5': '5',
  'cat6': '6',
  'cat7': '7',
  'cat8': '8',
  'cat9': '9',
  'cat10': '10',
  'cat11': '11',
  'cat12': '12',
  'cat13': '13',
  
  // Keep the numeric IDs as they are (already correct format)
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  '11': '11',
  '12': '12',
  '13': '13',
  
  // For prefixed format (if they exist)
  'serviceCategories/1': '1',
  'serviceCategories/2': '2',
  'serviceCategories/3': '3',
  'serviceCategories/4': '4',
  'serviceCategories/5': '5',
  'serviceCategories/6': '6',
  'serviceCategories/7': '7',
  'serviceCategories/8': '8',
  'serviceCategories/9': '9',
  'serviceCategories/10': '10',
  'serviceCategories/11': '11',
  'serviceCategories/12': '12',
  'serviceCategories/13': '13'
};

async function updateFeedbackCategories() {
  try {
    console.log('Connecting to database...');
    
    // 1. First, count how many entries we'll need to update
    const countQuery = `
      FOR q IN queries
        FILTER q.userFeedback != null 
        FILTER q.userFeedback.rating != null
        COLLECT WITH COUNT INTO total
        RETURN total
    `;
    
    const countCursor = await db.query(countQuery);
    const totalFeedback = await countCursor.next();
    console.log(`Found ${totalFeedback} feedback entries total`);
    
    // Count entries with known category types
    const categoryTypesQuery = `
      FOR q IN queries
        FILTER q.userFeedback != null 
        FILTER q.userFeedback.rating != null
        COLLECT cat = q.categoryId WITH COUNT INTO catCount
        SORT catCount DESC
        RETURN { category: cat, count: catCount }
    `;
    
    const typeCursor = await db.query(categoryTypesQuery);
    const categoryTypes = await typeCursor.all();
    
    console.log('\nCurrent category distribution:');
    categoryTypes.forEach(ct => {
      console.log(`${ct.category === null ? 'null' : ct.category}: ${ct.count} entries`);
    });
    
    // 2. Update entries with specific mappings
    console.log('\nUpdating entries with mapped category IDs...');
    for (const [oldCategoryId, newCategoryId] of Object.entries(categoryMapping)) {
      // Skip null values in mapping
      if (oldCategoryId === 'null') continue;
      
      const updateDirectMappingQuery = `
        FOR q IN queries
          FILTER q.userFeedback != null 
          FILTER q.userFeedback.rating != null
          FILTER q.categoryId == "${oldCategoryId}"
          UPDATE q WITH { 
            categoryId: "${newCategoryId}" 
          } IN queries
          COLLECT WITH COUNT INTO updated
          RETURN updated
      `;
      
      try {
        const updateCursor = await db.query(updateDirectMappingQuery);
        const updateCount = await updateCursor.next() || 0;
        if (updateCount > 0) {
          console.log(`Updated ${updateCount} entries with category ID "${oldCategoryId}" to "${newCategoryId}"`);
        }
      } catch (err) {
        console.error(`Error updating category "${oldCategoryId}":`, err.message);
      }
    }
    
    // 3. Distribute null categories evenly
    console.log('\nUpdating entries with null category IDs...');
    const nullUpdateQuery = `
      FOR q IN queries
        FILTER q.userFeedback != null 
        FILTER q.userFeedback.rating != null
        FILTER q.categoryId == null
        
        // Use the query key to deterministically assign a category
        LET categoryIndex = MOD(ABS(HASH(q._key)), 13) + 1
        LET newCategoryId = TO_STRING(categoryIndex)
        
        UPDATE q WITH { 
          categoryId: newCategoryId
        } IN queries
        
        COLLECT catId = newCategoryId WITH COUNT INTO catCount
        SORT TO_NUMBER(catId)
        RETURN { categoryId: catId, count: catCount }
    `;
    
    try {
      const nullUpdateCursor = await db.query(nullUpdateQuery);
      const nullUpdateResults = await nullUpdateCursor.all();
      
      console.log('\nDistribution of updated null categories:');
      nullUpdateResults.forEach(result => {
        const category = serviceCategories.find(c => c.id === result.categoryId);
        console.log(`Category ${result.categoryId} (${category ? category.name : 'Unknown'}): ${result.count} entries`);
      });
    } catch (err) {
      console.error('Error updating null categories:', err.message);
    }
    
    // 4. Verify the updates
    const verifyQuery = `
      FOR q IN queries
        FILTER q.userFeedback != null 
        FILTER q.userFeedback.rating != null
        COLLECT cat = q.categoryId WITH COUNT INTO catCount
        SORT catCount DESC
        RETURN { category: cat, count: catCount }
    `;
    
    const verifyCursor = await db.query(verifyQuery);
    const verifyResults = await verifyCursor.all();
    
    console.log('\n=== Updated Category Distribution ===');
    verifyResults.forEach(result => {
      const category = result.category ? 
        serviceCategories.find(c => c.id === result.category) : null;
      
      console.log(`${result.category === null ? 'null' : result.category} (${category ? category.name : 'Unknown'}): ${result.count} entries`);
    });
    
    // 5. Check if there are any remaining null categories
    const remainingNullQuery = `
      FOR q IN queries
        FILTER q.userFeedback != null 
        FILTER q.userFeedback.rating != null
        FILTER q.categoryId == null
        COLLECT WITH COUNT INTO remaining
        RETURN remaining
    `;
    
    const remainingCursor = await db.query(remainingNullQuery);
    const remainingNull = await remainingCursor.next() || 0;
    
    if (remainingNull > 0) {
      console.log(`\nWARNING: There are still ${remainingNull} feedback entries with null category IDs`);
    } else {
      console.log('\nAll feedback entries now have category IDs');
    }
    
  } catch (error) {
    console.error('Error updating feedback categories:', error);
  }
}

// Execute the main function
updateFeedbackCategories().then(() => {
  console.log('\nCategory update completed.');
}).catch(err => {
  console.error('Fatal error:', err);
});