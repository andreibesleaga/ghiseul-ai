// update-user-passwords-fixed.js
require('dotenv').config();
const { Database, aql } = require('arangojs');
const crypto = require('crypto');

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

async function updateAllUserPasswords() {
  const db = initDB();
  const users = db.collection('users');
  
  // The plaintext password we'll use for testing
  const testPassword = 'password123';
  
  // Generate SHA-256 hash (what frontend sends and what we'll store directly)
  const sha256Hash = crypto
    .createHash('sha256')
    .update(testPassword)
    .digest('hex');
  
  console.log('Starting password update...');
  console.log(`Setting all users to have password: "${testPassword}"`);
  console.log(`SHA-256 Hash: ${sha256Hash}`);
  
  try {
    // Get user count
    const usersCursor = await db.query('FOR u IN users RETURN u');
    const usersArray = await usersCursor.all();
    console.log(`Found ${usersArray.length} users to update`);
    
    if (usersArray.length === 0) {
      console.log('No users found. Creating a test user...');
      
      // Create a test user if none exist
      await users.save({
        loginName: 'testuser',
        email: 'test@example.com',
        encPassword: sha256Hash,  // Store the SHA-256 hash directly
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        personalIdentification: {
          fullName: 'Test User',
          dob: '',
          gender: '',
          nationality: '',
          maritalStatus: ''
        },
        addressResidency: {
          currentAddress: ''
        }
      });
      
      console.log('Created test user with username: testuser');
    } else {
      // Update all existing users
      const updateResult = await db.query(`
        FOR u IN users
          UPDATE u WITH { encPassword: @hashedPassword, updatedAt: @updatedAt } IN users
          RETURN { _key: NEW._key, loginName: NEW.loginName }
      `, { 
        hashedPassword: sha256Hash,  // Store the SHA-256 hash directly
        updatedAt: new Date().toISOString()
      });
      
      const updatedUsers = await updateResult.all();
      console.log(`Updated ${updatedUsers.length} users with the new password`);
      console.log('Updated users:', updatedUsers.map(u => u.loginName || u._key).join(', '));
    }
    
    // Find the user by either loginName or email
    const testUserExists = await db.query(`
      FOR u IN users
        FILTER u.loginName == @loginName OR u.email == @email
        RETURN u
    `, { 
      loginName: 'user108',
      email: 'user108@example.com'
    });
    
    const foundTestUser = await testUserExists.next();
    
    if (foundTestUser) {
      console.log(`Found existing user (${foundTestUser.loginName}/${foundTestUser.email}), updating password...`);
      await users.update(foundTestUser._key, {
        encPassword: sha256Hash,
        updatedAt: new Date().toISOString()
      });
      console.log(`Updated password for user with key: ${foundTestUser._key}`);
    } else {
      console.log('User not found. Trying to find any user to update...');
      
      // If we can't create/find specific test user, just update the first user we find
      if (usersArray.length > 0) {
        const firstUser = usersArray[0];
        console.log(`Using first available user: ${firstUser.loginName || firstUser.email || firstUser._key}`);
        await users.update(firstUser._key, {
          encPassword: sha256Hash,
          updatedAt: new Date().toISOString()
        });
        console.log(`Updated password for user: ${firstUser.loginName || firstUser.email || firstUser._key}`);
        
        // Print the credentials for this user
        console.log('\nTest credentials:');
        console.log(`Username: ${firstUser.loginName || firstUser.email}`);
        console.log(`Password: ${testPassword}`);
      }
    }
    
    console.log('\nPassword update completed successfully');
    console.log('----------------------------------------');
    console.log('You can now log in with any user and password:');
    console.log(`Password: ${testPassword}`);
    console.log('----------------------------------------');
    console.log('IMPORTANT: These passwords are stored as SHA-256 hashes in the database');
    console.log('without bcrypt. This is a quick fix for testing only and is not secure');
    console.log('for production environments.');
  } catch (error) {
    console.error('Error updating passwords:', error);
  }
}

updateAllUserPasswords().catch(console.error);