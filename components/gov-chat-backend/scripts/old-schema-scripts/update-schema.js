// update-schema.js
// Complete script to update the ArangoDB schema with loginName, accessToken, and encPassword

const { Database } = require('arangojs');
const crypto = require('crypto');

// IMPORTANT: Update these with your actual database credentials
const DB_URL = process.env.ARANGO_URL || 'http://localhost:8529';
const DB_NAME = process.env.ARANGO_DB || 'node-services'; // Default database name is '_system'
const DB_USER = process.env.ARANGO_USER || 'root';
const DB_PASS = process.env.ARANGO_PASSWORD || 'test'; // Update with your actual password

// Connect to ArangoDB with explicit credentials
const db = new Database({
  url: DB_URL,
  databaseName: DB_NAME,
  auth: {
    username: DB_USER,
    password: DB_PASS
  }
});

// Function to generate a default encrypted password (for test data)
const generateDefaultEncPassword = (userKey) => {
  // Use the userKey as a salt component for demo purposes
  const salt = crypto.randomBytes(16).toString('hex');
  // Create a default password hash (in real app, this would use proper password hashing like bcrypt)
  const hash = crypto.createHash('sha256')
    .update(`default_password_${userKey}_${salt}`)
    .digest('hex');
  
  return `${salt}:${hash}`;
};

async function updateSchema() {
  try {
    console.log('Starting schema update with encPassword addition...');
    console.log(`Connecting to database: ${DB_NAME} at ${DB_URL}`);
    
    // First, verify connection by getting database info
    try {
      const info = await db.get();
      console.log(`Successfully connected to ArangoDB. Database: ${info.name}`);
    } catch (error) {
      console.error('Connection test failed:', error.message);
      console.error('Please check your database credentials and connection details.');
      return;
    }
    
    // Get the users collection
    const usersCollection = db.collection('users');
    
    // Check if collection exists with proper error handling
    try {
      const exists = await usersCollection.exists();
      if (!exists) {
        console.error('Users collection does not exist');
        return;
      }
      console.log('Confirmed users collection exists');
    } catch (error) {
      console.error(`Error checking collection existence: ${error.message}`);
      console.error('Make sure you have the correct database name and permissions');
      return;
    }
    
    // Count users missing authentication fields
    try {
      const cursor = await db.query(`
        RETURN {
          missingLoginName: LENGTH(FOR doc IN users FILTER !HAS(doc, "loginName") RETURN 1),
          missingAccessToken: LENGTH(FOR doc IN users FILTER !HAS(doc, "accessToken") RETURN 1),
          missingEncPassword: LENGTH(FOR doc IN users FILTER !HAS(doc, "encPassword") RETURN 1),
          total: LENGTH(FOR doc IN users RETURN 1)
        }
      `);
      const [stats] = await cursor.all();
      console.log(`Found ${stats.total} total users`);
      console.log(`${stats.missingLoginName} users missing loginName field`);
      console.log(`${stats.missingAccessToken} users missing accessToken field`);
      console.log(`${stats.missingEncPassword} users missing encPassword field`);
    } catch (error) {
      console.error(`Error checking existing fields: ${error.message}`);
    }

    // Update users missing loginName
    try {
      const cursor = await db.query(`
        FOR doc IN users
          FILTER !HAS(doc, "loginName")
          UPDATE doc WITH { 
            loginName: HAS(doc, "email") ? doc.email : CONCAT("user_", doc._key)
          } IN users
          RETURN NEW
      `);
      
      const result = await cursor.all();
      console.log(`Added loginName to ${result.length} user documents`);
    } catch (error) {
      console.error(`Error updating loginName: ${error.message}`);
    }
    
    // Update users missing accessToken
    try {
      const cursor = await db.query(`
        FOR doc IN users
          FILTER !HAS(doc, "accessToken")
          UPDATE doc WITH { 
            accessToken: null 
          } IN users
          RETURN NEW
      `);
      
      const result = await cursor.all();
      console.log(`Added accessToken to ${result.length} user documents`);
    } catch (error) {
      console.error(`Error updating accessToken: ${error.message}`);
    }
    
    // Update users missing encPassword - generate a default for each user
    try {
      // First, get all users missing the encPassword field
      const usersCursor = await db.query(`
        FOR doc IN users
          FILTER !HAS(doc, "encPassword")
          RETURN { _key: doc._key }
      `);
      
      const usersToUpdate = await usersCursor.all();
      console.log(`Found ${usersToUpdate.length} users needing encPassword updates`);
      
      let updatedCount = 0;
      
      // Update each user with a unique default encrypted password
      for (const user of usersToUpdate) {
        const encPassword = generateDefaultEncPassword(user._key);
        
        await usersCollection.update(user._key, {
          encPassword: encPassword
        });
        
        updatedCount++;
        
        if (updatedCount % 50 === 0) {
          console.log(`Updated encPassword for ${updatedCount}/${usersToUpdate.length} users...`);
        }
      }
      
      console.log(`Added encPassword to ${updatedCount} user documents`);
    } catch (error) {
      console.error(`Error updating encPassword: ${error.message}`);
    }
    
    // Create an index on loginName for faster lookups
    try {
      const indexInfo = await usersCollection.ensureIndex({
        type: 'persistent',
        fields: ['loginName'],
        unique: true
      });
      console.log(`Index on loginName field: ${indexInfo.isNewlyCreated ? 'created' : 'already exists'}`);
    } catch (error) {
      console.error(`Error with loginName index: ${error.message}`);
    }
    
    // Create an index on email for faster lookups if it doesn't exist
    try {
      const indexInfo = await usersCollection.ensureIndex({
        type: 'persistent',
        fields: ['email'],
        unique: true
      });
      console.log(`Index on email field: ${indexInfo.isNewlyCreated ? 'created' : 'already exists'}`);
    } catch (error) {
      console.error(`Error with email index: ${error.message}`);
    }
    
    // Verify the required fields have been added to all users
    try {
      const cursor = await db.query(`
        RETURN {
          totalUsers: LENGTH(FOR u IN users RETURN 1),
          usersWithLoginName: LENGTH(FOR u IN users FILTER HAS(u, "loginName") RETURN 1),
          usersWithAccessToken: LENGTH(FOR u IN users FILTER HAS(u, "accessToken") RETURN 1),
          usersWithEncPassword: LENGTH(FOR u IN users FILTER HAS(u, "encPassword") RETURN 1),
          sampleUser: (
            FOR u IN users 
              LIMIT 1 
              RETURN { 
                _key: u._key, 
                email: u.email, 
                loginName: u.loginName, 
                hasToken: HAS(u, "accessToken"),
                hasEncPassword: HAS(u, "encPassword")
              }
          )[0]
        }
      `);
      
      const [verification] = await cursor.all();
      console.log('Field verification after updates:');
      console.log(`Total users: ${verification.totalUsers}`);
      console.log(`Users with loginName: ${verification.usersWithLoginName}`);
      console.log(`Users with accessToken: ${verification.usersWithAccessToken}`);
      console.log(`Users with encPassword: ${verification.usersWithEncPassword}`);
      console.log('Sample user:', verification.sampleUser);
      
      if (verification.totalUsers === verification.usersWithLoginName && 
          verification.totalUsers === verification.usersWithAccessToken &&
          verification.totalUsers === verification.usersWithEncPassword) {
        console.log('✅ All users now have the required authentication fields');
      } else {
        console.log('⚠️ Some users are still missing authentication fields');
      }
    } catch (error) {
      console.error(`Error verifying fields: ${error.message}`);
    }
    
    console.log('Schema update completed');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the update
updateSchema().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});