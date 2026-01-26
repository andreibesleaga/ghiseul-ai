// reset-passwords.js
require('dotenv').config();
const { Database } = require('arangojs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

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

async function resetAllPasswords() {
  try {
    console.log('=== RESETTING ALL USER PASSWORDS ===');
    console.log('This will set all user passwords to "password123" with proper bcrypt+SHA256 hashing');
    
    const db = initDB();
    const users = db.collection('users');
    
    // Standard test password
    const testPassword = 'password123';
    
    // Step 1: Generate SHA-256 hash (what the frontend sends)
    const sha256Hash = crypto
      .createHash('sha256')
      .update(testPassword)
      .digest('hex');
    
    console.log('Frontend SHA-256 hash of "password123":', sha256Hash);
    
    // Step 2: Hash the SHA-256 with bcrypt (what should be stored in DB)
    const saltRounds = 10;
    const bcryptHash = await bcrypt.hash(sha256Hash, saltRounds);
    
    console.log('Backend bcrypt hash of the SHA-256 hash:', bcryptHash);
    
    // Step 3: Verify the hashing process works
    const verificationResult = await bcrypt.compare(sha256Hash, bcryptHash);
    console.log('Verification test (should be true):', verificationResult);
    
    if (!verificationResult) {
      console.error('Verification failed! Aborting password reset.');
      return;
    }
    
    // Step 4: Get all users
    const usersCursor = await db.query('FOR u IN users RETURN u');
    const usersArray = await usersCursor.all();
    
    console.log(`Found ${usersArray.length} users to update.`);
    
    // Step 5: Update all users with the bcrypt hash
    for (const user of usersArray) {
      console.log(`Updating user: ${user.loginName || user.email || user._key}`);
      
      await users.update(user._key, {
        encPassword: bcryptHash,
        updatedAt: new Date().toISOString()
      });
    }
    
    console.log('\n=== PASSWORD RESET COMPLETED ===');
    console.log(`Successfully reset ${usersArray.length} user passwords.`);
    console.log('\nTest Login Credentials:');
    console.log('Username: [any existing username]');
    console.log('Password: password123');
    
    // Step 6: Create a test user if none exist
    if (usersArray.length === 0) {
      console.log('\nNo existing users found. Creating a test user...');
      
      const testUser = {
        loginName: 'testuser',
        email: 'test@example.com',
        encPassword: bcryptHash,
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
      };
      
      await users.save(testUser);
      console.log('Created test user with username: testuser');
      
      console.log('\nTest Login Credentials:');
      console.log('Username: testuser');
      console.log('Password: password123');
    }
  } catch (error) {
    console.error('Error resetting passwords:', error);
  }
}

resetAllPasswords().catch(console.error);