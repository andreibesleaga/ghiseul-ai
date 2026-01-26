// generate-password-reset-tokens.js
// Standalone script to generate password reset tokens for 5% of existing users

require('dotenv').config();
const { Database } = require('arangojs');
const crypto = require('crypto');
const fs = require('fs');

// Setup logging
const logStream = fs.createWriteStream('password-reset-tokens-generation.log', { flags: 'a' });
const log = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}`;
    console.log(logMessage);
    logStream.write(logMessage + '\n');
};

// Enhanced compatible timestamp function that ensures ArangoDB compatibility
const createCompatibleTimestamp = (date) => {
    // Ensure we're working with a proper Date object
    if (!(date instanceof Date)) {
        date = new Date(date);
    }

    // Format the date in a way that ArangoDB's DATE_NOW() can directly compare
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');

    // Use explicit formatting instead of toISOString to ensure consistency
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
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

// Generate a random integer between min and max (inclusive)
const randomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Generate a key that is purely numeric to maximize compatibility
// Follow exactly the same approach as in the original script
let keyCounter = 0;
const generateKey = () => {
    keyCounter++;
    return String(keyCounter); // Just a string of digits, e.g., "1", "2", "3"
};

// Generate a random password reset token
const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Create password reset tokens for 5% of users
const createPasswordResetTokens = async () => {
    log('Starting generation of password reset tokens for 5% of users...');
    
    const db = initDB();
    
    try {
        // Check if users collection exists and get count
        const usersCollection = db.collection('users');
        let usersCount = 0;
        
        try {
            const usersExists = await usersCollection.exists();
            if (!usersExists) {
                log('Error: Users collection does not exist. Please run the main test data generation script first.');
                return;
            }
            
            // Get actual count of users more carefully
            const countCursor = await db.query('RETURN LENGTH(FOR u IN users RETURN 1)');
            usersCount = await countCursor.next();
            log(`Found ${usersCount} users in the database`);
            
            if (usersCount === 0) {
                log('Error: No users found in the database. Please run the main test data generation script first.');
                return;
            }
        } catch (err) {
            log(`Error checking users collection: ${err.message}`);
            return;
        }
        
        // Check if passwordResetTokens collection exists
        const resetTokensCollection = db.collection('passwordResetTokens');
        let collectionExists = false;
        
        try {
            collectionExists = await resetTokensCollection.exists();
        } catch (err) {
            log('passwordResetTokens collection does not exist, creating it...');
        }
        
        if (!collectionExists) {
            await db.createCollection('passwordResetTokens');
            log('Created passwordResetTokens collection');
            
            // Create indexes
            await resetTokensCollection.ensureIndex({
                type: 'persistent',
                fields: ['userId']
            });
            log('Created index on userId field');
            
            await resetTokensCollection.ensureIndex({
                type: 'persistent',
                fields: ['token'],
                unique: true
            });
            log('Created unique index on token field');
            
            await resetTokensCollection.ensureIndex({
                type: 'persistent',
                fields: ['expiresAt']
            });
            log('Created index on expiresAt field');
            
            await resetTokensCollection.ensureIndex({
                type: 'persistent',
                fields: ['used']
            });
            log('Created index on used field');
        } else {
            log('passwordResetTokens collection already exists');
            
            // Check if we should truncate the collection
            const countCursor = await db.query('RETURN LENGTH(FOR t IN passwordResetTokens RETURN 1)');
            const tokenCount = await countCursor.next();
            
            if (tokenCount > 0) {
                const truncate = process.argv.includes('--truncate') || process.argv.includes('-t');
                
                if (truncate) {
                    await resetTokensCollection.truncate();
                    log(`Truncated passwordResetTokens collection (removed ${tokenCount} existing tokens)`);
                } else {
                    log(`Found ${tokenCount} existing tokens. Use --truncate or -t flag to replace them.`);
                    
                    // Check if user wants to proceed with adding more tokens
                    const addMore = process.argv.includes('--add') || process.argv.includes('-a');
                    
                    if (!addMore) {
                        log('Use --add or -a flag to add more tokens without removing existing ones.');
                        log('Exiting without making changes.');
                        return;
                    }
                    
                    log('Proceeding to add more tokens without removing existing ones...');
                }
            }
        }
        
        // Calculate 5% of users - ensure Math.ceil for rounding up
        const percentage = 5;  // 5%
        const tokenCount = Math.ceil((usersCount * percentage) / 100);
        log(`Will create ${tokenCount} tokens for ${usersCount} users (${percentage}%)`);
        
        // Get ALL user IDs first
        log('Retrieving all user IDs...');
        const usersCursor = await db.query(`
            FOR u IN users
            RETURN u._key
        `);
        
        const allUserKeys = await usersCursor.all();
        log(`Retrieved ${allUserKeys.length} user keys from database`);
        
        // Verify we got the expected number
        if (allUserKeys.length !== usersCount) {
            log(`Warning: Retrieved ${allUserKeys.length} user keys but count was ${usersCount}`);
            // Use the actual number we retrieved
            usersCount = allUserKeys.length;
        }
        
        // Shuffle the array of all users
        const shuffledUserKeys = [...allUserKeys].sort(() => Math.random() - 0.5);
        
        // Take exactly 5% (or at least 1)
        const selectedUserKeys = shuffledUserKeys.slice(0, Math.max(1, tokenCount));
        
        if (selectedUserKeys.length !== tokenCount) {
            log(`Warning: Selected ${selectedUserKeys.length} users but expected ${tokenCount}`);
        }
        
        log(`Selected ${selectedUserKeys.length} random users for token generation`);
        
        // Current time
        const now = new Date();
        
        // Reset key counter to ensure we start from fresh keys
        keyCounter = 0;
        
        // Get current max key to avoid duplicates
        try {
            const maxKeyCursor = await db.query(`
                FOR t IN passwordResetTokens
                SORT TO_NUMBER(t._key) DESC
                LIMIT 1
                RETURN TO_NUMBER(t._key)
            `);
            const maxKey = await maxKeyCursor.next();
            if (maxKey) {
                keyCounter = maxKey;
                log(`Starting key counter at ${keyCounter} to avoid duplicates`);
            }
        } catch (err) {
            log(`Error getting max key: ${err.message}`);
            log("Will start key counter at 0");
        }
        
        // Create tokens with different states
        const createdTokens = [];
        for (let i = 0; i < selectedUserKeys.length; i++) {
            const userKey = selectedUserKeys[i];
            
            // Determine token state (active, expired, used)
            const tokenState = Math.random();
            
            let tokenData = {
                _key: generateKey(),  // Using the same key generation as the original script
                userId: `users/${userKey}`,
                token: generateResetToken(),
                createdAt: createCompatibleTimestamp(now)
            };
            
            if (tokenState < 0.6) {
                // 60% active tokens (not expired, not used)
                const expiresAt = new Date(now.getTime() + (5 * 60 * 1000)); // 5 minutes from now
                tokenData.expiresAt = createCompatibleTimestamp(expiresAt);
                tokenData.used = false;
            } else if (tokenState < 0.8) {
                // 20% expired tokens (expired, not used)
                const expiresAt = new Date(now.getTime() - randomInt(1, 60) * 60 * 1000); // 1-60 minutes in the past
                tokenData.expiresAt = createCompatibleTimestamp(expiresAt);
                tokenData.used = false;
            } else {
                // 20% used tokens (may be expired or not)
                const isExpired = Math.random() < 0.5;
                const expiresAt = isExpired 
                    ? new Date(now.getTime() - randomInt(1, 60) * 60 * 1000) // expired
                    : new Date(now.getTime() + randomInt(1, 5) * 60 * 1000); // not expired
                tokenData.expiresAt = createCompatibleTimestamp(expiresAt);
                tokenData.used = true;
            }
            
            try {
                await resetTokensCollection.save(tokenData);
                createdTokens.push(tokenData);
                
                if ((i + 1) % 10 === 0 || i === selectedUserKeys.length - 1) {
                    log(`Created ${i + 1}/${selectedUserKeys.length} password reset tokens...`);
                }
            } catch (err) {
                log(`Error creating token for user ${userKey}: ${err.message}`);
            }
        }
        
        log(`✅ Successfully created ${createdTokens.length} password reset tokens`);
        
        // Test query to verify token distribution
        try {
            const tokenStatsQuery = `
            RETURN {
                totalTokens: LENGTH(FOR t IN passwordResetTokens RETURN 1),
                activeTokens: LENGTH(FOR t IN passwordResetTokens FILTER t.used == false && t.expiresAt >= "${createCompatibleTimestamp(now)}" RETURN 1),
                expiredTokens: LENGTH(FOR t IN passwordResetTokens FILTER t.used == false && t.expiresAt < "${createCompatibleTimestamp(now)}" RETURN 1),
                usedTokens: LENGTH(FOR t IN passwordResetTokens FILTER t.used == true RETURN 1),
                usersWithTokens: LENGTH(UNIQUE(FOR t IN passwordResetTokens RETURN t.userId))
            }
            `;
            
            const tokenStatsCursor = await db.query(tokenStatsQuery);
            const tokenStats = await tokenStatsCursor.next();
            log('Password reset token statistics:');
            log(JSON.stringify(tokenStats, null, 2));
            
            // Sample a few tokens to verify data format
            const sampleTokensQuery = `
            FOR t IN passwordResetTokens
            LIMIT 3
            RETURN t
            `;
            
            const sampleTokensCursor = await db.query(sampleTokensQuery);
            const sampleTokens = await sampleTokensCursor.all();
            log('Sample tokens:');
            log(JSON.stringify(sampleTokens, null, 2));
            
        } catch (err) {
            log(`Error getting token statistics: ${err.message}`);
        }
        
    } catch (err) {
        log(`Error creating password reset tokens: ${err.message}`);
    } finally {
        logStream.end();
    }
};

// Execute the main function if run directly
if (require.main === module) {
    createPasswordResetTokens().then(() => {
        console.log('Done!');
        process.exit(0);
    }).catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = {
    createPasswordResetTokens
};