// fix-email-verification.js

const { Database, aql } = require('arangojs');

// Connect to the database
const db = new Database({
  url: process.env.ARANGO_URL || 'http://localhost:8529',
  databaseName: process.env.ARANGO_DB || 'node-services',
  auth: {
    username: process.env.ARANGO_USERNAME || 'root',
    password: process.env.ARANGO_PASSWORD || 'test'
  }
});

// Get a reference to the users collection
const usersCollection = db.collection('users');

async function fixEmailVerification() {
  try {
    console.log('Starting email verification property fix for all user documents...');
    
    // Step 1 & 2 & 3: Remove isEmailVerified, ensure emailVerified exists and set it to true
    const query = `
      FOR user IN users
        LET updatedUser = MERGE(
          UNSET(user, 'isEmailVerified'),
          { emailVerified: true }
        )
        UPDATE user WITH updatedUser IN users
        RETURN { 
          _key: user._key, 
          email: user.email, 
          loginName: user.loginName,
          oldIsEmailVerified: user.isEmailVerified,
          newEmailVerified: true 
        }
    `;
    
    // Execute the query
    const cursor = await db.query(query);
    const result = await cursor.all();
    
    console.log(`Successfully updated ${result.length} user documents.`);
    if (result.length > 0) {
      console.log('Sample of updated users:');
      console.log(result.slice(0, 5)); // Show first 5 for verification
    } else {
      console.log('No users were found to update.');
    }
    
    return result;
  } catch (error) {
    console.error('Error fixing email verification on user documents:', error);
    throw error;
  }
}

// Execute the update
fixEmailVerification()
  .then(() => {
    console.log('Email verification fix completed successfully.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Email verification fix failed:', err);
    process.exit(1);
  });