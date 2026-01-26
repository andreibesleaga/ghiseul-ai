// debug-auth-service.js
require('dotenv').config();
const { Database, aql } = require('arangojs');
const bcrypt = require('bcrypt');
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

// Create a test user and debug password comparison
async function debugPasswordAuthentication() {
  try {
    const db = initDB();
    const users = db.collection('users');
    
    // Constants for testing
    const TEST_LOGIN = 'testuser';
    const TEST_EMAIL = 'test@example.com';
    const TEST_PASSWORD = 'password123';
    
    // Log the SHA-256 hash of the password (what frontend sends)
    const sha256Hash = crypto
      .createHash('sha256')
      .update(TEST_PASSWORD)
      .digest('hex');
    console.log('Frontend SHA-256 hash of "password123":', sha256Hash);
    
    // Check if test user exists
    const checkUserQuery = aql`
      FOR u IN users
        FILTER u.loginName == ${TEST_LOGIN}
        RETURN u
    `;
    
    const cursor = await db.query(checkUserQuery);
    let user = await cursor.next();
    
    // If user doesn't exist, create it
    if (!user) {
      console.log(`User ${TEST_LOGIN} doesn't exist. Creating a test user...`);
      
      // Hash the SHA-256 password with bcrypt (what backend does)
      const saltRounds = 10;
      const bcryptHash = await bcrypt.hash(sha256Hash, saltRounds);
      console.log('Backend bcrypt hash of the SHA-256 hash:', bcryptHash);
      
      // Create test user
      user = {
        loginName: TEST_LOGIN,
        email: TEST_EMAIL,
        encPassword: bcryptHash,  // Store the bcrypt hash of SHA-256 hash
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
      
      const result = await users.save(user);
      console.log('Created test user:', result);
      user._key = result._key;
    } else {
      console.log('Found existing test user:', user._key);
      console.log('Current encPassword in database:', user.encPassword);
    }
    
    // Simulate login with different password formats
    console.log('\n--- SIMULATING LOGIN ATTEMPTS ---');
    
    // 1. Test with SHA-256 hash (what frontend sends)
    console.log('\nTest 1: Using SHA-256 hash (what frontend sends)');
    const isValidWithSha256 = await bcrypt.compare(sha256Hash, user.encPassword);
    console.log('Is valid with SHA-256 hash?', isValidWithSha256);
    
    // 2. Test with plaintext password
    console.log('\nTest 2: Using plaintext password (incorrect approach)');
    const isValidWithPlaintext = await bcrypt.compare(TEST_PASSWORD, user.encPassword);
    console.log('Is valid with plaintext?', isValidWithPlaintext);
    
    // 3. Test by manually updating the database password
    console.log('\nTest 3: Updating user password directly with bcrypt hash of plaintext');
    // Hash the plaintext password directly
    const directBcryptHash = await bcrypt.hash(TEST_PASSWORD, saltRounds);
    console.log('Direct bcrypt hash of plaintext:', directBcryptHash);
    
    // Update the user
    await users.update(user._key, {
      encPassword: directBcryptHash,
      updatedAt: new Date().toISOString()
    });
    
    // Test the login with both approaches against the new password
    console.log('\nAfter update - test login with SHA-256 hash');
    const updatedUser = await users.document(user._key);
    const isValidAfterUpdateWithSha256 = await bcrypt.compare(sha256Hash, updatedUser.encPassword);
    console.log('Is valid with SHA-256 hash after update?', isValidAfterUpdateWithSha256);
    
    console.log('\nAfter update - test login with plaintext');
    const isValidAfterUpdateWithPlaintext = await bcrypt.compare(TEST_PASSWORD, updatedUser.encPassword);
    console.log('Is valid with plaintext after update?', isValidAfterUpdateWithPlaintext);
    
    // 4. Create a special debug user with known credentials
    console.log('\nTest 4: Creating a debug user with specific format');
    
    // Hash the plaintext password with SHA-256
    const debugUserShaSha256 = crypto
      .createHash('sha256')
      .update(TEST_PASSWORD)
      .digest('hex');
    
    // Store this hash directly without bcrypt (for debugging only)
    const debugUser = {
      loginName: 'debuguser',
      email: 'debug@example.com',
      encPassword: debugUserShaSha256,  // Store the SHA-256 hash directly
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      personalIdentification: {
        fullName: 'Debug User',
        dob: '',
        gender: '',
        nationality: '',
        maritalStatus: ''
      },
      addressResidency: {
        currentAddress: ''
      }
    };
    
    // Check if debug user exists
    const checkDebugQuery = aql`
      FOR u IN users
        FILTER u.loginName == ${'debuguser'}
        RETURN u
    `;
    
    const debugCursor = await db.query(checkDebugQuery);
    let existingDebugUser = await debugCursor.next();
    
    if (!existingDebugUser) {
      console.log('Creating special debug user with SHA-256 hash stored directly...');
      const debugResult = await users.save(debugUser);
      console.log('Created debug user with SHA-256 hash as password:', debugResult);
    } else {
      console.log('Debug user already exists. Updating password...');
      await users.update(existingDebugUser._key, {
        encPassword: debugUserShaSha256,  // Store the SHA-256 hash directly
        updatedAt: new Date().toISOString()
      });
    }
    
    // Print summary and login instructions
    console.log('\n--- DEBUG SUMMARY ---');
    console.log(`Regular test user: ${TEST_LOGIN}`);
    console.log(`Debug user: debuguser`);
    console.log(`Password for both: ${TEST_PASSWORD}`);
    console.log('\nTry logging in with each of these accounts to see what works.');
    console.log('If the debug user works but the regular one doesn\'t, it suggests');
    console.log('the issue is with the password bcrypt hashing in auth-service.js.');
    
    // Problem Analysis
    console.log('\n--- PROBLEM ANALYSIS ---');
    console.log('Current authentication flow:');
    console.log('1. Frontend hashes password with SHA-256 and sends hash');
    console.log('2. Backend receives SHA-256 hash in encPassword field');
    console.log('3. Backend compares SHA-256 hash with stored bcrypt hash using bcrypt.compare()');
    console.log('4. This comparison mismatches because:');
    console.log('   - In database: bcrypt(SHA-256(password))');
    console.log('   - In login attempt: SHA-256(password)');
    console.log('\nPossible solutions:');
    console.log('1. (Best) Update backend to hash the received encPassword with bcrypt before storing');
    console.log('   but NOT hash it again during comparison - must match hashing methodology');
    console.log('2. (Alternative) Make frontend send plaintext password over HTTPS and handle all');
    console.log('   password hashing on the server side only');
    console.log('3. (Quick fix) Update auth-service.js login method to handle the current');
    console.log('   frontend SHA-256 hash properly');
    
    console.log('\nFix suggestion for auth-service.js comparePasswords method:');
    console.log('// Current problematic code:');
    console.log('async comparePasswords(password, hashedPassword) {');
    console.log('  return bcrypt.compare(password, hashedPassword);');
    console.log('}');
    console.log('\n// Suggested fix - if frontend is sending SHA-256 and your database has bcrypt(SHA-256):');
    console.log('async comparePasswords(password, hashedPassword) {');
    console.log('  // password is already SHA-256 hashed by frontend, we just need to compare it');
    console.log('  // with the bcrypt hash in database');
    console.log('  return bcrypt.compare(password, hashedPassword);');
    console.log('}');
    
  } catch (error) {
    console.error('Error during debug:', error);
  }
}

// Run the debug process
debugPasswordAuthentication().catch(console.error);