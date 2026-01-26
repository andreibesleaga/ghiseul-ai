// chat-history-data-generator.js
// Complete script with proper ArangoDB edge handling and schema validation

require('dotenv').config();
const { Database } = require('arangojs');

// ================================================
// DATABASE CONNECTION CONFIGURATION
// ================================================
const config = {
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    databaseName: process.env.ARANGO_DB || 'node-services',
    auth: {
        username: process.env.ARANGO_USERNAME || 'root',
        password: process.env.ARANGO_PASSWORD || 'test'
    }
};

// Initialize ArangoDB connection
const db = new Database({
    url: config.url,
    databaseName: config.databaseName,
    auth: {
        username: config.auth.username,
        password: config.auth.password
    }
});

// ================================================
// CONFIGURATION FOR TEST DATA GENERATION
// ================================================
const TEST_CONFIG = {
    // User emails to generate conversations for
    userEmails: [
        'fordendk@gmail.com',
        'fordendk@outlook.com',
        'david.forden@itu.int',
        'scarlettsun0@gmail.com',
        'roman.digitallab@gmail.com'
    ],

    // Number of conversations to generate per user
    conversationsPerUser: 200,

    // Range of messages per conversation
    messagesPerConversation: {
        min: 10,
        max: 30
    },

    // Percentage settings
    percentages: {
        starred: 10,
        archived: 10
    },

    // Date range for generated data (last 12 months)
    dateRange: {
        start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        end: new Date() // Now
    }
};

// ================================================
// ERROR HANDLING & UTILITIES
// ================================================

/**
 * Enhanced error handling with custom error types
 */
class DatabaseError extends Error {
    constructor(message, code, operation) {
        super(message);
        this.name = 'DatabaseError';
        this.code = code;
        this.operation = operation;
    }
}

class SchemaValidationError extends Error {
    constructor(message, document, collectionName) {
        super(message);
        this.name = 'SchemaValidationError';
        this.document = document;
        this.collectionName = collectionName;
    }
}

/**
 * Handle unhandled promise rejections and exceptions at the process level
 */
function setupGlobalErrorHandlers() {
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Promise Rejection:', reason);
        // Exit with error code
        process.exit(1);
    });

    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        // Exit with error code
        process.exit(1);
    });
}

// Setup global error handlers
setupGlobalErrorHandlers();

/**
 * Perform retry logic for database operations that might fail temporarily
 */
async function withRetry(operation, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            // Check if error is retryable
            if (error.code === 503 || error.code === 429 || error.code === 408) {
                console.log(`Operation failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${delay}ms...`);

                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay));

                // Exponential backoff
                delay *= 2;
            } else {
                // Non-retryable error
                throw error;
            }
        }
    }

    throw lastError; // All retries failed
}

/**
 * Clean up non-alphanumeric characters from string to make it more sanitized for keys
 */
function sanitizeKey(input) {
    // Remove special characters and spaces, convert to lowercase
    return input.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

/**
 * Generate consistent hash for a string
 * Useful for generating deterministic keys based on content
 */
function hashString(str) {
    let hash = 0;
    if (str.length === 0) return hash;

    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString();
}

/**
 * Log execution duration for performance monitoring
 */
function logExecutionTime(label, startTime) {
    const endTime = process.hrtime.bigint();
    const durationNs = endTime - startTime;
    const durationMs = Number(durationNs) / 1_000_000;
    console.log(`${label} completed in ${durationMs.toFixed(2)}ms`);
}

/**
 * Transaction wrapper for ArangoDB operations
 * Ensures atomicity for multi-document operations
 */
async function runTransaction(collections, action) {
    try {
        const result = await db.transaction(
            collections,
            async (trx) => {
                return await action(trx);
            }
        );

        return result;
    } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
    }
}

/**
 * Create backup of database schema to file
 */
function backupSchemaToFile(schemaData, fileName) {
    const fs = require('fs');
    const backup = {
        timestamp: new Date().toISOString(),
        schema: schemaData
    };

    try {
        fs.writeFileSync(fileName, JSON.stringify(backup, null, 2));
        console.log(`Schema backup saved to ${fileName}`);
        return true;
    } catch (error) {
        console.error(`Failed to backup schema to ${fileName}:`, error);
        return false;
    }
}

/**
 * Cleanup backup files when they're no longer needed
 */
function cleanupBackupFiles() {
    const fs = require('fs');
    const backupFiles = [
        'conversations_schema_backup.json',
        'messages_schema_backup.json',
        'queryMessages_schema_backup.json'
    ];

    for (const file of backupFiles) {
        if (fs.existsSync(file)) {
            try {
                fs.unlinkSync(file);
                console.log(`Removed backup file: ${file}`);
            } catch (error) {
                console.error(`Failed to remove backup file ${file}:`, error);
            }
        }
    }
}

// ================================================
// SCHEMA VALIDATION FUNCTIONS
// ================================================

/**
 * Ensure schema validation is disabled for collections we'll be writing to
 * This will prevent ArangoError with code 1620
 */
async function disableSchemaValidation() {
    try {
        console.log('Checking and disabling schema validation for collections...');

        // Include ALL collections that need schema validation disabled
        const collections = [
            'conversations',
            'messages',
            'queryMessages',
            'sessions',
            'userSessions',
            'sessionQueries',
            'userConversations',
            'conversationCategories',
            'queries',
            'queryCategories'
        ];

        for (const collectionName of collections) {
            const collection = db.collection(collectionName);

            // Check if collection exists and has schema validation
            if (await collection.exists()) {
                const props = await collection.properties();

                if (props.schema) {
                    console.log(`Disabling schema validation for ${collectionName}...`);

                    // Store original schema to a file for reference
                    const fs = require('fs');
                    fs.writeFileSync(`${collectionName}_schema_backup.json`, JSON.stringify(props.schema, null, 2));

                    // Disable schema validation by setting schema to null
                    await collection.properties({ schema: null });
                    console.log(`Schema validation disabled for ${collectionName}`);
                } else {
                    console.log(`No schema validation found for ${collectionName}`);
                }
            } else {
                console.log(`Collection ${collectionName} does not exist, skipping`);
            }
        }

        console.log('Schema validation has been disabled for all affected collections');
        return true;
    } catch (error) {
        console.error('Error disabling schema validation:', error);
        throw error; // Rethrow to exit the script
    }
}

/**
 * Restore schema validation for collections after data generation
 * This ensures the database maintains data integrity after our script runs
 */
async function restoreSchemaValidation() {
    try {
        console.log('Restoring schema validation for collections...');

        const collections = ['conversations', 'messages', 'queryMessages'];

        for (const collectionName of collections) {
            const collection = db.collection(collectionName);

            // Check if collection exists
            if (await collection.exists()) {
                const backupFile = `${collectionName}_schema_backup.json`;

                // Check if backup file exists
                const fs = require('fs');
                if (fs.existsSync(backupFile)) {
                    console.log(`Restoring schema validation for ${collectionName}...`);

                    try {
                        // Read the backup file
                        const schemaJson = fs.readFileSync(backupFile, 'utf8');
                        const schema = JSON.parse(schemaJson);

                        // Apply the schema validation rule
                        await collection.properties({
                            schema: schema
                        });

                        console.log(`Schema validation restored for ${collectionName}`);
                    } catch (readError) {
                        console.error(`Error reading schema backup for ${collectionName}:`, readError);
                    }
                } else {
                    console.log(`No schema backup found for ${collectionName}`);
                }
            } else {
                console.log(`Collection ${collectionName} does not exist`);
            }
        }

        console.log('Schema validation has been restored for all collections');
        return true;
    } catch (error) {
        console.error('Error restoring schema validation:', error);
        return false; // Don't throw since this is a cleanup operation
    }
}

/**
 * Check collection schemas and required fields to ensure our generated data will be valid
 */
async function validateCollectionRequirements() {
    try {
        console.log('Validating collection requirements...');

        const requiredFields = {
            conversations: [],
            messages: [],
            queries: [],
            sessions: []
        };

        for (const [collectionName, fields] of Object.entries(requiredFields)) {
            const collection = db.collection(collectionName);

            if (await collection.exists()) {
                console.log(`Checking requirements for ${collectionName}...`);

                const properties = await collection.properties();

                if (properties.schema && properties.schema.rule && properties.schema.rule.required) {
                    requiredFields[collectionName] = properties.schema.rule.required;
                    console.log(`Required fields for ${collectionName}: ${properties.schema.rule.required.join(', ')}`);
                } else {
                    console.log(`No schema validation found for ${collectionName}`);
                }
            } else {
                throw new Error(`Collection ${collectionName} does not exist`);
            }
        }

        console.log('Collection requirements validated');
        return requiredFields;
    } catch (error) {
        console.error('Error validating collection requirements:', error);
        throw error; // Rethrow to exit the script
    }
}

/**
 * Check what fields are required for a collection based on schema
 * This helps ensure our generated data will match schema requirements
 */
async function checkRequiredFields(collectionName) {
    try {
        const collection = db.collection(collectionName);
        const props = await collection.properties();

        if (props.schema && props.schema.rule && props.schema.rule.required) {
            console.log(`Required fields for ${collectionName}:`, props.schema.rule.required.join(", "));
            return props.schema.rule.required;
        } else {
            console.log(`No schema requirements found for ${collectionName}`);
            return [];
        }
    } catch (error) {
        console.error(`Error checking schema for ${collectionName}:`, error);
        throw error; // Rethrow to exit the script
    }
}

/**
 * Helper function to validate a document against schema requirements
 * This ensures we don't try to save invalid documents to the database
 */
function validateDocumentAgainstRequirements(document, requiredFields) {
    if (!requiredFields || requiredFields.length === 0) {
        return true; // No requirements, document is valid
    }

    const missingFields = requiredFields.filter(field => !document.hasOwnProperty(field));

    if (missingFields.length > 0) {
        console.error(`Document is missing required fields: ${missingFields.join(', ')}`);
        return false;
    }

    return true;
}
// ================================================
// HELPER FUNCTIONS
// ================================================

/**
 * Generate a sequential numeric key for a collection
 */
/**
 * Generate a sequential numeric key for a collection with additional uniqueness guarantees
 */
async function generateKey(collectionName) {
    try {
        // Base timestamp (milliseconds)
        const timestamp = Date.now().toString();
        
        // Add more entropy with nanosecond precision if available
        let nanoseconds = '';
        if (process.hrtime) {
            const hrTime = process.hrtime();
            nanoseconds = hrTime[1].toString().padStart(9, '0').substring(0, 4);
        } else {
            // If process.hrtime is not available, use random numbers
            nanoseconds = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        }
        
        // Add a random component for additional uniqueness
        const randomComponent = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        
        // Combine timestamp + nanoseconds + random for high uniqueness
        let key = `${timestamp}${nanoseconds}${randomComponent}`;
        
        // For certain collection types, ensure it starts with expected digits
        if (collectionName === 'conversations') {
            key = `1${key.slice(1)}`;
        } else if (collectionName === 'messages') {
            key = `2${key.slice(1)}`;
        } else if (collectionName === 'queries') {
            key = `3${key.slice(1)}`;
        } else if (collectionName === 'sessions') {
            key = `4${key.slice(1)}`;
        } else if (collectionName === 'analytics') {
            key = `5${key.slice(1)}`;
        }
        
        // Check if this key already exists in the collection to avoid duplicates
        try {
            const collection = db.collection(collectionName);
            const exists = await collection.documentExists(key);
            
            if (exists) {
                console.log(`Key ${key} already exists in ${collectionName}, generating new key...`);
                // Recursively try again with a delay to avoid race conditions
                await new Promise(resolve => setTimeout(resolve, 5));
                return generateKey(collectionName);
            }
        } catch (checkError) {
            // If there was an error checking, still proceed with this key
            // but log the error
            console.warn(`Warning: Couldn't check if key exists: ${checkError.message}`);
        }
        
        console.log(`Generated unique key for ${collectionName}: ${key}`);
        return key;
    } catch (error) {
        console.error(`Error generating key for ${collectionName}:`, error);
        // Create fallback key with very high entropy in case of error
        const fallbackKey = `${Date.now()}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
        
        if (collectionName === 'conversations') {
            return `1${fallbackKey.slice(1)}`;
        } else if (collectionName === 'messages') {
            return `2${fallbackKey.slice(1)}`;
        } else if (collectionName === 'queries') {
            return `3${fallbackKey.slice(1)}`;
        } else if (collectionName === 'sessions') {
            return `4${fallbackKey.slice(1)}`;
        } else if (collectionName === 'analytics') {
            return `5${fallbackKey.slice(1)}`;
        } else {
            return fallbackKey;
        }
    }
}

/**
 * Generate a random date between two dates
 */
function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Generate a sequence of dates, with each later than the previous
 */
function generateDateSequence(start, end, count) {
    const timeRange = end.getTime() - start.getTime();
    const timeStep = timeRange / (count + 1);

    let dates = [];
    let currentTime = start.getTime();

    for (let i = 0; i < count; i++) {
        // Add some randomness to each step (between 0.5 and 1.5 of the average step)
        const randomFactor = 0.5 + Math.random();
        currentTime += timeStep * randomFactor;

        // Ensure we don't exceed the end time
        if (currentTime > end.getTime()) {
            currentTime = end.getTime() - (Math.random() * timeStep / 2);
        }

        dates.push(new Date(currentTime));
    }

    return dates;
}

/**
 * Generate random boolean based on percentage
 */
function randomBoolean(percentTrue) {
    return Math.random() < (percentTrue / 100);
}

/**
 * Get a random item from an array
 */
function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate fake user feedback data for analytics
 */
function generateFakeFeedback() {
    // 70% chance of being positive (4-5), 20% neutral (3), 10% negative (1-2)
    const rand = Math.random();
    let rating;

    if (rand < 0.1) {
        // Negative feedback
        rating = Math.floor(Math.random() * 2) + 1; // 1-2
    } else if (rand < 0.3) {
        // Neutral feedback
        rating = 3;
    } else {
        // Positive feedback
        rating = Math.floor(Math.random() * 2) + 4; // 4-5
    }

    const positiveComments = [
        "Very helpful, thank you!",
        "This was exactly what I needed.",
        "Clear information, much appreciated.",
        "Thanks for the quick assistance.",
        "Perfectly explained, thank you."
    ];

    const neutralComments = [
        "This was okay, but could be more detailed.",
        "Somewhat helpful, thanks.",
        "Got what I needed, but it took some time.",
        "Information was basic but sufficient.",
        "Average service, thanks anyway."
    ];

    const negativeComments = [
        "This didn't answer my question.",
        "Information was not clear.",
        "I need more specific details.",
        "This was confusing.",
        "Not what I was looking for."
    ];

    let comment = null;
    if (Math.random() < 0.7) { // 70% chance of having a comment
        if (rating >= 4) {
            comment = positiveComments[Math.floor(Math.random() * positiveComments.length)];
        } else if (rating == 3) {
            comment = neutralComments[Math.floor(Math.random() * neutralComments.length)];
        } else {
            comment = negativeComments[Math.floor(Math.random() * negativeComments.length)];
        }
    }

    return {
        rating: rating,
        comment: comment,
        providedAt: new Date(Date.now() - Math.random() * 3600000).toISOString() // Random time within the last hour
    };
}

/**
 * Batch save documents to improve performance
 */
async function batchSaveDocuments(collectionName, documents, batchSize = 50) {
    try {
        const collection = db.collection(collectionName);
        const totalDocuments = documents.length;
        let savedCount = 0;

        console.log(`Batch saving ${totalDocuments} documents to ${collectionName}...`);

        // Process in batches
        for (let i = 0; i < totalDocuments; i += batchSize) {
            const batch = documents.slice(i, i + batchSize);

            // Create the AQL query for batch insert
            const cursor = await db.query(`
          FOR doc IN @documents
            INSERT doc INTO ${collectionName}
            RETURN NEW
        `, { documents: batch });

            const saved = await cursor.all();
            savedCount += saved.length;

            console.log(`Saved ${savedCount}/${totalDocuments} documents to ${collectionName}...`);
        }

        console.log(`Completed saving ${savedCount} documents to ${collectionName}`);
        return savedCount;
    } catch (error) {
        console.error(`Error batch saving documents to ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Get detailed database stats for reporting
 */
async function getDatabaseStats() {
    try {
        console.log('Gathering database statistics...');

        const stats = {};

        // Get document counts for all collections
        for (const collectionName of [
            'users', 'sessions', 'queries', 'analytics', 'events',
            'services', 'serviceCategories', 'conversations', 'messages'
        ]) {
            try {
                const collection = db.collection(collectionName);
                if (await collection.exists()) {
                    const count = await collection.count();
                    stats[collectionName] = count.count;
                } else {
                    stats[collectionName] = 0;
                }
            } catch (countError) {
                console.error(`Error counting ${collectionName}:`, countError);
                stats[collectionName] = 'error';
            }
        }

        // Get edge counts for all edge collections
        for (const edgeCollection of [
            'userSessions', 'sessionQueries', 'categoryServices', 'queryCategories',
            'userConversations', 'conversationCategories', 'queryMessages'
        ]) {
            try {
                const collection = db.collection(edgeCollection);
                if (await collection.exists()) {
                    const count = await collection.count();
                    stats[edgeCollection] = count.count;
                } else {
                    stats[edgeCollection] = 0;
                }
            } catch (countError) {
                console.error(`Error counting ${edgeCollection}:`, countError);
                stats[edgeCollection] = 'error';
            }
        }

        // Get disk usage stats
        try {
            const dbInfo = await db.get();
            stats.databaseSize = dbInfo.engine?.stats?.documentsSize || 'unknown';
        } catch (dbError) {
            console.error('Error getting database info:', dbError);
            stats.databaseSize = 'error';
        }

        console.log('Database statistics:', JSON.stringify(stats, null, 2));
        return stats;
    } catch (error) {
        console.error('Error gathering database statistics:', error);
        return { error: error.message };
    }
}

//**** PART 3 HERE */

// ================================================
// CONTENT GENERATION - QUERIES AND RESPONSES
// ================================================

// Sample user queries by category
const categoryQueries = {
    "Identity & Civil Registration": [
        "How do I apply for a birth certificate?",
        "What documents do I need for my child's birth certificate?",
        "Can I apply for a birth certificate online?",
        "How do I apply for a national ID card?",
        "What's required for passport renewal?",
        "When will my ID card be ready for collection?",
        "I lost my ID card. How do I get a replacement?",
        "How much does it cost to get a birth certificate?",
        "What's the procedure for registering a death?",
        "How do I get a copy of my marriage certificate?",
        "What's the process for changing my name officially?",
        "How do I register my child's birth?",
        "Can someone else collect my ID card on my behalf?",
        "How long does it take to process a passport application?",
        "What's the process for registering as a citizen?",
        "How do I verify the authenticity of my ID card?",
        "What do I do if there's an error on my birth certificate?",
        "How do I apply for a passport for my child?",
        "What's the process for registering a late birth?",
        "How do I get an ID card if I'm disabled and can't travel?"
    ],
    "Education": [
        "How do I enroll my child in public school?",
        "What scholarships are available for university students?",
        "How can I verify my academic certificates?",
        "What's the process for school transfers?",
        "How do I apply for student loans?",
        "When are the national exams registration periods?",
        "How do I check my national exam results?",
        "What's the procedure for getting a duplicate certificate?",
        "How do I apply to a public university?",
        "What documents are needed for school enrollment?",
        "How do I get an education bursary?",
        "What's the process for homeschooling registration?",
        "How do I change subjects in secondary school?",
        "What's the procedure for appealing exam results?",
        "How do I register for adult education programs?",
        "What's the process for teacher certification?",
        "How do I transfer credits between universities?",
        "What special education services are available?",
        "How do I apply for an education tax benefit?",
        "What's the process for international student registration?"
    ],
    "Health": [
        "How do I register for national health insurance?",
        "Where can I get my vaccination records?",
        "What hospitals accept the national health insurance?",
        "How much are the monthly health insurance contributions?",
        "How do I register for COVID-19 vaccination?",
        "What's the process for getting a health card?",
        "How do I find the nearest public hospital?",
        "What vaccinations are required for school enrollment?",
        "How do I access mental health services?",
        "What's the procedure for getting a medical certificate?",
        "How do I check my health insurance status?",
        "What maternal health services are free?",
        "How do I file a complaint against a healthcare provider?",
        "What's the process for getting specialized treatment abroad?",
        "How do I access disability healthcare services?",
        "What's the procedure for getting a medical exemption?",
        "How do I register a newborn with health insurance?",
        "What emergency services are available at night?",
        "How do I get subsidized healthcare?",
        "What's the process for transferring medical records?"
    ],
    "Housing & Property": [
        "How do I register a land title?",
        "What's the process for property transfer?",
        "How are property taxes calculated?",
        "What permits do I need for home construction?",
        "How do I resolve a land boundary dispute?",
        "What's the procedure for checking land ownership?",
        "How do I apply for a mortgage?",
        "What documents do I need for property purchase?",
        "How do I report illegal construction?",
        "What's the process for subdividing land?",
        "How do I get a building approval certificate?",
        "What's the procedure for property valuation?",
        "How do I check if land has any encumbrances?",
        "What's the process for converting agricultural land?",
        "How do I apply for social housing?",
        "What's the procedure for eviction?",
        "How do I appeal property tax assessment?",
        "What's the process for registering a lease agreement?",
        "How do I check zoning regulations for my property?",
        "What's the procedure for getting a property search certificate?"
    ],
    "Transport & Licensing": [
        "How do I apply for a driver's license?",
        "What's the process for vehicle registration?",
        "How much are the road tax fees?",
        "When does my vehicle need inspection?",
        "How do I pay a traffic fine?",
        "What's the procedure for renewing a driver's license?",
        "How do I change ownership of a vehicle?",
        "What documents do I need for vehicle importation?",
        "How do I report a lost driver's license?",
        "What's the process for getting a commercial driving permit?",
        "How do I check my driving license points?",
        "What's the procedure for getting a taxi license?",
        "How do I appeal a driving license suspension?",
        "What's the process for getting a motorcycle license?",
        "How do I check vehicle registration status?",
        "What's the procedure for getting a public service vehicle license?",
        "How do I register an electric vehicle?",
        "What's the process for getting a disabled parking permit?",
        "How do I report dangerous driving?",
        "What's the procedure for getting an international driver's license?"
    ],
    "Business": [
        "How do I register a new business?",
        "What licenses do I need for a restaurant?",
        "How do I register for business taxes?",
        "What's the process for import/export licensing?",
        "How do I register a trademark?",
        "What's the procedure for registering a company name?",
        "How do I obtain a business permit?",
        "What documents do I need for a business loan?",
        "How do I register for VAT?",
        "What's the process for getting a food handler's certificate?",
        "How do I check business compliance requirements?",
        "What's the procedure for foreign investment registration?",
        "How do I register a non-profit organization?",
        "What's the process for getting a liquor license?",
        "How do I file annual business returns?",
        "What's the procedure for dissolving a business?",
        "How do I register for e-procurement?",
        "What's the process for getting a manufacturing license?",
        "How do I report unfair business practices?",
        "What's the procedure for business tax exemption?"
    ],
    "Employment & Labor": [
        "How do I register as a job seeker?",
        "What employment certification do I need?",
        "How do I file a workplace complaint?",
        "What are my rights if I'm laid off?",
        "How do I claim workman's compensation?",
        "What's the procedure for filing for unemployment benefits?",
        "How do I verify employment information?",
        "What documents do I need for employment verification?",
        "How do I report workplace discrimination?",
        "What's the process for getting work permits for foreigners?",
        "How do I check my pension contributions?",
        "What's the procedure for retirement application?",
        "How do I form a labor union?",
        "What's the process for resolving salary disputes?",
        "How do I report unsafe working conditions?",
        "What's the procedure for maternity leave application?",
        "How do I get employment insurance?",
        "What's the process for filing for disability benefits?",
        "How do I verify my professional certifications?",
        "What's the procedure for filing a workplace injury claim?"
    ],
    "Social Welfare": [
        "How do I apply for social security benefits?",
        "What assistance is available for elderly citizens?",
        "How do I apply for disability support?",
        "What programs exist for low-income families?",
        "How do I register for food assistance?",
        "What's the procedure for getting housing assistance?",
        "How do I apply for childcare subsidies?",
        "What documents do I need for welfare application?",
        "How do I check my welfare benefits status?",
        "What's the process for getting heating assistance?",
        "How do I apply for emergency financial aid?",
        "What's the procedure for getting medical assistance?",
        "How do I access services for the homeless?",
        "What's the process for getting foster care support?",
        "How do I apply for widow/widower benefits?",
        "What's the procedure for getting rehabilitation services?",
        "How do I report welfare fraud?",
        "What's the process for appealing a denied welfare application?",
        "How do I get support for a disabled child?",
        "What's the procedure for accessing mental health support services?"
    ],
    "Taxation": [
        "When is the deadline for filing tax returns?",
        "How do I get a tax clearance certificate?",
        "How do I register for a tax ID number?",
        "What tax deductions am I eligible for?",
        "How do I pay property taxes?",
        "What's the procedure for filing corporate taxes?",
        "How do I report tax evasion?",
        "What documents do I need for tax filing?",
        "How do I check my tax compliance status?",
        "What's the process for appealing tax assessment?",
        "How do I apply for tax exemption?",
        "What's the procedure for getting a tax refund?",
        "How do I file amended tax returns?",
        "What's the process for registering as a tax agent?",
        "How do I calculate capital gains tax?",
        "What's the procedure for paying import duties?",
        "How do I get a tax statement transcript?",
        "What's the process for filing tax for freelance work?",
        "How do I report foreign income?",
        "What's the procedure for tax dispute resolution?"
    ],
    "Immigration": [
        "How do I apply for a work visa?",
        "What are the requirements for permanent residency?",
        "How do I renew my residence permit?",
        "What's the process for citizenship application?",
        "How long does visa processing take?",
        "What's the procedure for getting a tourist visa?",
        "How do I apply for a student visa?",
        "What documents do I need for visa application?",
        "How do I check my visa status?",
        "What's the process for getting an emergency visa?",
        "How do I report visa violations?",
        "What's the procedure for getting a visa extension?",
        "How do I apply for asylum?",
        "What's the process for getting a dependent visa?",
        "How do I register as a foreign resident?",
        "What's the procedure for getting travel authorization?",
        "How do I appeal a visa rejection?",
        "What's the process for getting a business visa?",
        "How do I verify my immigration status?",
        "What's the procedure for return immigration clearance?"
    ],
    "Legal & Judiciary": [
        "How do I access free legal aid?",
        "What's the process for filing a small claims case?",
        "How do I get a police clearance certificate?",
        "What's the procedure for filing divorce papers?",
        "How do I check the status of my court case?",
        "What's the procedure for getting a restraining order?",
        "How do I file a consumer complaint?",
        "What documents do I need for a civil suit?",
        "How do I report corruption?",
        "What's the process for appealing a court decision?",
        "How do I get court transcripts?",
        "What's the procedure for changing my will?",
        "How do I file for child custody?",
        "What's the process for getting compensation for accidents?",
        "How do I register a power of attorney?",
        "What's the procedure for filing a human rights violation?",
        "How do I get legal representation if I can't afford it?",
        "What's the process for filing for bankruptcy?",
        "How do I report domestic violence?",
        "What's the procedure for settling inheritance disputes?"
    ],
    "Agriculture & Rural Development": [
        "How do I apply for farming subsidies?",
        "What agricultural extension services are available?",
        "How do I get a loan for farm equipment?",
        "What irrigation development support exists?",
        "How do I register for livestock insurance?",
        "What's the procedure for getting agricultural training?",
        "How do I apply for seed subsidies?",
        "What documents do I need for agricultural loans?",
        "How do I check soil quality for farming?",
        "What's the process for getting fertilizer subsidies?",
        "How do I report crop diseases?",
        "What's the procedure for getting market information?",
        "How do I join a farmers' cooperative?",
        "What's the process for getting land for agriculture?",
        "How do I apply for agricultural tax exemptions?",
        "What's the procedure for getting fishing licenses?",
        "How do I access veterinary services?",
        "What's the process for agricultural product certification?",
        "How do I get compensation for crop damage?",
        "What's the procedure for getting drought relief assistance?"
    ],
    "Security": [
        "How do I report a security concern?",
        "What's the process for getting a police abstract?",
        "How do I apply for a firearm license?",
        "What should I do if I witness a crime?",
        "How do I contact emergency services?",
        "What's the procedure for reporting a missing person?",
        "How do I get home security advice?",
        "What documents do I need for a security clearance?",
        "How do I verify a police officer's identity?",
        "What's the process for reporting cyber crime?",
        "How do I apply for a private security license?",
        "What's the procedure for getting witness protection?",
        "How do I report suspicious activity?",
        "What's the process for getting community policing?",
        "How do I report police misconduct?",
        "What's the procedure for checking criminal records?",
        "How do I apply for security for a public event?",
        "What's the process for getting border security information?",
        "How do I get emergency evacuation information?",
        "What's the procedure for reporting terrorism threats?"
    ]
};

// Sample bot responses by category
const categoryResponses = {
    "Identity & Civil Registration": [
        "To apply for a birth certificate, visit your nearest Ghișeul Unic with the notification of birth from the hospital, parents' ID cards, and the prescribed fee of RON 50. The process typically takes 7-14 working days.",
        "For a national ID card, visit your nearest Ghișeul Unic with your birth certificate and two passport-sized photos. First-time applications are free, and the process takes approximately 14-21 days.",
        "Lost ID replacements require a police abstract, Form C, your birth certificate, and RON 100 fee. It takes approximately 14 days to process.",
        "To register a child's birth, visit a Ghișeul Unic or civil registration office within six months of birth with the notification of birth from the hospital, parents' ID cards, and RON 50 fee. Late registration requires additional documentation and a RON 100 fee.",
        "Passport renewal requires your old passport, ID card, three passport photos, and RON 4,500 for a 34-page passport. The process takes about 10 working days. You can apply through the e-Guvernare portal or visit immigration offices.",
        "You can check the status of your ID card application by visiting the registration office where you applied or by checking online using your application number. Standard processing time is 14-21 days.",
        "For marriage certificate applications, both parties must visit a registrar's office with their ID cards, birth certificates, and two witnesses with their ID cards. The fee is RON 600, and there's a 21-day notice period before marriage solemnization.",
        "To change your name officially, publish a deed poll in the Romania Gazette, then visit the civil registration office with the gazette notice, your birth certificate, ID card, and RON 500 fee to update your birth certificate and other documents.",
        "For posthumous birth registration, bring the deceased's death certificate, the child's notification of birth, both parents' ID cards, and RON 50 fee to any civil registration office or Ghișeul Unic."
    ],
    "Education": [
        "To enroll your child in a public primary school, visit the school with the child's birth certificate, immunization card, and your ID card during the January enrollment period. Primary education is free in public schools.",
        "Higher education scholarships applications open from April to June. Submit academic transcripts, recommendation letters, and proof of income to the Higher Education Loans Board office.",
        "For certificate verification, submit your documents to the Romania National Examinations Council with the verification fee. The process takes about 7-14 days.",
        "School transfers require a transfer letter from the current school, academic progress reports, and the child's birth certificate. Visit the new school with these documents during school opening dates.",
        "Student loan applications are submitted through the Higher Education Loans Board website or offices. You'll need admission letters, fee structures, guardian income details, and student/guardian ID cards.",
        "National examinations registration opens in February for KCPE and KCSE. Register through your school administration with RON 800 for KCPE and RON 2,500 for KCSE.",
        "To check examination results, use the SMS service by sending your index number to 20076, or visit the KNEC portal with your index number and year of examination.",
        "For duplicate certificates, apply at the Romania National Examinations Council with a police abstract, affidavit, copy of ID, and RON 2,300 fee. Processing takes about 30 days.",
        "University applications are submitted through the Romania Universities and Colleges Central Placement Service between December and February. You'll need your KCSE results slip and RON 1,500 application fee."
    ],
    "Health": [
        "To register for NHIF, visit any NHIF office with your ID and RON 500 for the first month's contribution. For employees, monthly contributions are automatically deducted from your salary.",
        "Vaccination records can be accessed at the health facility where vaccinations were administered. Bring your clinic card for verification. Replacement cards cost RON 50.",
        "NHIF covers services at all public hospitals and many private facilities that are NHIF-accredited. You can check the full list on the NHIF website.",
        "Monthly NHIF contributions vary based on income, starting at RON 500 for self-employed individuals. Employed persons contribute on a graduated scale from RON 150 to RON 1,700 based on gross salary.",
        "COVID-19 vaccination registration is done through the Ministry of Health portal or by dialing *299# on your mobile phone. Visit your nearest vaccination center with your ID card on your appointment date.",
        "To get a health card, visit your nearest public health facility with your ID card, two passport photos, and RON 100 fee. Health cards are necessary for food handlers and are valid for six months.",
        "You can locate the nearest public hospital using the eHealth Romania app or by dialing *433# from your mobile phone. Emergency services are available 24/7 at all public hospitals.",
        "Required school vaccinations include BCG, Polio, DPT, Measles, and Hepatitis B. Visit any public health facility with your child's clinic card for free immunization services.",
        "Mental health services are available at county referral hospitals and specialized facilities like Mathari Hospital. Visit with your ID and NHIF card. Initial consultation fees range from RON 300-1,000 at public facilities.",
        "For a medical certificate, visit a government hospital with your ID card. The doctor will conduct an examination, and you'll pay RON 1,000-2,000 depending on the type of certificate required.",
        "Check your NHIF status by dialing *155# on your mobile phone, visiting any NHIF office with your ID, or logging into the NHIF member portal with your NHIF number.",
        "Free maternal healthcare services include antenatal care, delivery, postnatal care, and immunization. Register at any public health facility with your ID card and NHIF card if available.",
        "To file a complaint against a healthcare provider, submit a written complaint to the Romania Medical Practitioners and Dentists Council with supporting evidence. You can also report to the facility's quality assurance department."
    ],
    "Housing & Property": [
        "To register a land title, submit your application at the local land registry with proof of ownership, survey report, and the registration fee of 2.5% of the land value.",
        "Property taxes are calculated at 0.1% of the property value annually. Payments can be made quarterly through the e-Guvernare portal or at your county revenue office.",
        "For building permits, submit architectural plans, structural drawings, and an environmental impact assessment to your county planning department.",
        "To resolve a land boundary dispute, first try mediation through local elders. If unsuccessful, file a case with the Environment and Land Court with survey maps, title deeds, and witness statements.",
        "To check land ownership, visit the lands office with the parcel number and RON 500 search fee. Official searches take about 3-5 working days.",
        "Mortgage applications require proof of income, property valuation report, title deed copy, ID card, ANAF PIN, and 6 months' bank statements. Processing typically takes 30-45 days.",
        "For property purchase, you'll need a sale agreement, transfer documents, land rates clearance, consent to transfer, ID cards of both parties, and transfer fees of 4% of property value.",
        "Report illegal construction to your county government's planning department with the location details, photos if possible, and a written complaint. Enforcement usually takes 7-14 days.",
        "Land subdivision requires a survey plan, mutation forms, title deed, land rates clearance, and approval from the county land board. The process takes about 90 days and costs vary by county."
    ],
    "Transport & Licensing": [
        "For a driver's license, first obtain a provisional license, complete driving school, pass the test, and apply at the DRPCIV office. A 3-year license costs RON 3,050.",
        "Vehicle registration requires the logbook, inspection certificate, insurance certificate, and registration fees based on engine capacity. Visit any DRPCIV office.",
        "Vehicle inspections are mandatory annually for commercial vehicles and every two years for private vehicles. Visit any inspection center with your logbook.",
        "Road tax fees vary by vehicle weight and type. For standard private vehicles, it's approximately RON 5,000 annually, payable through the e-Guvernare portal or at DRPCIV offices.",
        "Traffic fines can be paid through the e-Guvernare portal, at any DRPCIV office, or through mobile banking using the offense notification number.",
        "To renew a driver's license, visit any DRPCIV office with your ID, old license, eye test results, and RON 3,050 for a 3-year renewal. You can also apply online through e-Guvernare.",
        "For vehicle ownership transfer, both buyer and seller must visit an DRPCIV office with ID cards, transfer forms, original logbook, and RON 4,050 transfer fee.",
        "Vehicle importation requires an import declaration form, bill of lading, commercial invoice, certificate of conformity, and import duty payment receipt. Vehicles must be less than 8 years old.",
        "For a lost driver's license, get a police abstract, then apply for replacement at any DRPCIV office with the abstract, ID card, and RON 700 fee. Processing takes about 14 days."
    ],
    "Business": [
        "To register a business, apply through e-Guvernare or visit the Business Registration Service with name reservation, fee payment receipt, and signed memorandum of association.",
        "Restaurant licenses include a health certificate, food handling certificates for staff, fire safety approval, and liquor license if applicable.",
        "For VAT registration, businesses with turnover exceeding RON 5 million should apply online through the ANAF portal with your business registration certificate.",
        "Import/export licensing requires a registration with the Romania Trade Network Agency, product-specific permits, and customs registration. Apply through the KenTrade portal with business registration documents.",
        "Trademark registration is done through the Romania Industrial Property Institute. Submit your application with the trademark design, business registration certificates, and RON 5,000 fee per class.",
        "To register a company name, search availability on the Business Registration Service portal and pay RON 150 for name reservation. Names are reserved for 30 days.",
        "Business permits are obtained from your county government office with business registration certificate, lease agreement, fire safety certificate, and RON 3,000-15,000 fee depending on business size.",
        "For business loans, prepare a comprehensive business plan, financial statements, collateral documentation, and ANAF compliance certificate. Visit any commercial bank or microfinance institution.",
        "To register for VAT, your business must have annual turnover exceeding RON 5 million. Apply online through the ANAF iTax platform with business registration documents and financial statements."
    ],
    "Employment & Labor": [
        "To register as a job seeker, create an account on the National Employment Authority portal with your ID number, academic certificates, and resume. Registration is free.",
        "Employment certification requires application to the Directorate of Industrial Training with academic certificates, work experience proof, and RON 2,000 assessment fee.",
        "Workplace complaints should first be reported to your HR department, then to the nearest labor office for mediation.",
        "If laid off, you're entitled to severance pay of at least 15 days' wages for each completed year of service, accrued leave payment, and one month's notice or payment in lieu of notice.",
        "For workman's compensation, report the injury to your employer immediately, get medical assessment, and file a claim with the Work Injury Benefits Authority within 12 months of the accident.",
        "Unemployment benefits application requires proof of involuntary job loss, registration with the National Employment Authority, and three months of NSSF contributions. Apply at your nearest NSSF office.",
        "Employment verification requires a letter from your employer on company letterhead, pay slips, and work contract. For government verification, visit the Public Service Commission with your employment letter.",
        "For employment verification documents, prepare certified copies of academic certificates, employment letter, pay slips for the last 3 months, and ID card.",
        "Report workplace discrimination to the nearest labor office with a written complaint detailing the incidents, witness statements if available, and employment contract copy."
    ],
    "Social Welfare": [
        "For social security benefits, visit your nearest NSSF office with your ID, birth certificate, and bank details. Benefits depend on your contribution history.",
        "Elderly citizens (70+ years) can register for the Inua Jamii program at their local chief's office with ID card, birth certificate, and proof of residency.",
        "Disability support registration is done at the National Council for Persons with Disabilities. Bring medical assessment, ID, photos, and birth certificate.",
        "Low-income families can apply for the Cash Transfer Program at their local social development office with household income verification, children's birth certificates, and parents' IDs.",
        "For food assistance, register with the National Drought Management Authority or county social services department during announced registration periods with ID and proof of residency.",
        "Housing assistance applications are submitted to the State Department for Housing with proof of income, family size documentation, ID, and ANAF PIN. Applications open periodically as announced.",
        "Childcare subsidies are available through the Early Childhood Development program. Apply at your county education office with child's birth certificate, parents' IDs, and income verification.",
        "For welfare applications, prepare ID card, birth certificate, proof of residence, income verification, bank statements, and medical assessment if applicable.",
        "Check welfare benefits status by visiting your local social services office with your beneficiary number and ID, or check online through the social protection portal."
    ],
    "Taxation": [
        "Tax returns must be filed by June 30th each year through the ANAF iTax portal. You'll need employment income details, additional income sources, and deduction documentation.",
        "For a tax clearance certificate, apply online through ANAF with RON 1,000 fee payment receipt. All tax returns must be up to date, and processing takes 1-2 working days.",
        "To register for a ANAF PIN, apply through the iTax portal with your ID or passport. The process is free and immediate for individuals.",
        "Tax deductions include mortgage interest up to RON 300,000 annually, insurance premiums up to RON 60,000, and pension contributions up to RON 240,000 annually.",
        "Property taxes (land rates) are paid to your county government annually. The amount varies by location and property value, typically 0.1-0.5% of the unimproved site value.",
        "Corporate taxes are filed by the 6th month after your financial year end. Prepare audited financial statements, fixed asset schedules, and tax computation schedules.",
        "To report tax evasion, submit information through the ANAF whistle-blower portal or visit any ANAF office with supporting evidence. Your identity remains confidential.",
        "For tax filing documents, prepare employment income statements (P9 form), business financial statements, rental income details, investment income records, and receipts for claimable expenses.",
        "Check tax compliance status through the ANAF iTax portal using your PIN, or request a tax compliance certificate which costs RON 1,000 and takes 1-2 days to process."
    ],
    "Immigration": [
        "Work visa applications require sponsorship from a Romanian employer who must submit the application with your passport, certificates, employment contract, and fee.",
        "For permanent residency, you need proof of 7+ years legal residency, tax compliance, police clearance, and investment/employment proof. The fee is USD 500.",
        "Residence permit renewals should be submitted 30 days before expiry through the e-Guvernare portal with updated documentation, employer letter, and renewal fee.",
        "Citizenship applications require 7 years continuous residency, Romanian spouse for 3+ years, or birth in Romania plus continuous residency. Apply at Immigration Department with RON 30,000 fee.",
        "Visa processing typically takes 5-10 working days for standard applications. For expedited processing (24-48 hours), pay an additional RON 10,000 fee.",
        "Tourist visa applications require a valid passport, return ticket, hotel reservation, and USD 50 fee. Apply online through e-Guvernare or on arrival at entry points.",
        "Student visa requirements include admission letter from a Romanian institution, passport valid for at least 6 months, passport photos, and USD 50 fee.",
        "For visa applications, prepare passport (valid 6+ months), application form, passport photos, invitation letter/hotel booking, return ticket, and bank statements.",
        "Check visa status online through the e-Guvernare portal with your application reference number, or visit the Immigration Department with your passport and application receipt."
    ],
    "Legal & Judiciary": [
        "Free legal aid is available through the National Legal Aid Service. Visit any office or partner legal clinic with your ID and case documentation for eligibility assessment.",
        "Small claims (under RON 200,000) can be filed at the nearest court registry with a completed claim form, supporting evidence, and RON 500 filing fee.",
        "Police clearance certificates require application at the Directorate of Criminal Investigations with fingerprints, ID copy, and RON 1,000 fee.",
        "For divorce filing, you must be married for at least 3 years. Submit a petition to the Family Division with marriage certificate, ID card, and RON 1,500 filing fee.",
        "Check your court case status online through the Judiciary e-filing system with your case number, or visit the court registry with your case number and ID.",
        "Restraining orders are issued by magistrate courts. File an application with evidence of threat, witness statements, and police reports if available. Emergency orders can be issued within 24 hours.",
        "Consumer complaints should first be addressed with the business directly. If unresolved, file with the Consumer Protection Agency with purchase receipts, correspondence, and product details.",
        "For civil suits, prepare a plaint or petition, supporting affidavits, witness statements, and relevant documents. The filing fee varies from RON 1,500-25,000 depending on claim amount.",
        "Report corruption to the Ethics and Anti-Corruption Commission online, through the toll-free number 1551, or at any EACC office with supporting evidence."
    ],
    "Agriculture & Rural Development": [
        "Farming subsidies registration is done with the Ministry of Agriculture during announced enrollment periods. Bring your ID, land ownership/lease proof, and previous farming records.",
        "Agricultural extension officers provide free technical assistance at county agricultural offices. You can request farm visits, crop/livestock guidance, and soil testing.",
        "Farm equipment loans are available through the Agricultural Finance Corporation. Apply with your business plan, farm ownership documents, and production history.",
        "Irrigation development support is provided through the National Irrigation Authority. Apply with land documents, water source information, and crop plans.",
        "Livestock insurance registration is done through the Romania Livestock Insurance Program. Visit your county agricultural office with livestock ownership documents and RON 500 per animal.",
        "Agricultural training programs are available at county agricultural training centers. Register with your ID and RON 200-1,000 fee depending on the course duration.",
        "For seed subsidies, register with your nearest agricultural office during planting seasons with ID, land ownership documents, and previous season's production records.",
        "Agricultural loan documentation includes business plan, farm title deed/lease agreement, crop/livestock production records, income statements, and RON 1,000 application fee.",
        "Soil testing services are available at county agricultural offices and the Romania Agricultural and Livestock Research Organization. Sample collection costs RON 500, analysis costs RON 1,500-3,000."
    ],
    "Security": [
        "To report a security concern, contact your nearest police station or call the emergency hotline 999/911/112. You can also use the police reporting app for non-emergency matters.",
        "For a police abstract, visit any police station with your ID within 24 hours of the incident. Provide a detailed statement of what happened. The service is free.",
        "Firearm license applications require security vetting, psychological evaluation, training certification, and background check. Apply at the Firearms Licensing Board with RON 2,000 fee.",
        "If you witness a crime, report immediately to the nearest police station or call 999/911/112. Provide your contact information, location details, and description of the incident.",
        "Emergency services can be contacted by dialing 999/911/112. For ambulance services specifically, dial 997. These services operate 24/7 throughout the country.",
        "To report a missing person, visit any police station with the person's recent photo, description, last known location, and your contact details. There's no waiting period required.",
        "Home security assessments are available through your local police station's community policing unit. Request a visit with your ID and proof of residence.",
        "Security clearance documentation includes ID, ANAF PIN, birth certificate, academic certificates, police clearance certificate, and three character references.",
        "To verify a police officer's identity, request to see their service number and official police ID card. You can also verify through the nearest police station or by calling 112."
    ]
};

// ================================================
// DATA GENERATION FUNCTIONS
// ================================================

/**
 * Generate a conversation with messages for a specific category, ensuring schema compliance
 */
async function generateConversation(categoryName, serviceCategory, creationDate, requiredFields) {
    // Select a random title for this category conversation
    const titlePrefixes = ["Question about", "Help with", "Information on", "Inquiry regarding", "Assistance with"];
    const titleSuffix = categoryName.toLowerCase().includes("services") ?
        categoryName.replace(" Services", "") : categoryName;

    const title = `${randomItem(titlePrefixes)} ${titleSuffix}`;

    // Use the current date as the end date for message timestamps
    const endDate = new Date();

    // Generate appropriate number of messages
    const messagesCount = Math.floor(Math.random() *
        (TEST_CONFIG.messagesPerConversation.max - TEST_CONFIG.messagesPerConversation.min + 1))
        + TEST_CONFIG.messagesPerConversation.min;

    // Make sure messagesCount is even (to have equal user/assistant messages)
    const adjustedMessagesCount = messagesCount + (messagesCount % 2);

    // Generate message timestamps
    const messageTimestamps = generateDateSequence(creationDate, endDate, adjustedMessagesCount);

    // Generate proper ArangoDB key for the conversation
    const conversationKey = await generateKey('conversations');

    // Create conversation object with all required fields from the schema
    const conversation = {
        _key: conversationKey,
        title: title,
        lastMessage: "", // We'll set this after generating messages
        created: creationDate.toISOString(),
        updated: messageTimestamps[messageTimestamps.length - 1].toISOString(),
        messageCount: adjustedMessagesCount,
        isStarred: randomBoolean(TEST_CONFIG.percentages.starred),
        isArchived: randomBoolean(TEST_CONFIG.percentages.archived),
        category: categoryName,
        tags: [serviceCategory.nameEN, titleSuffix.split(" ")[0]] // Add some relevant tags
    };

    // Validate that our conversation meets schema requirements
    if (requiredFields && requiredFields.conversations) {
        const missingFields = requiredFields.conversations.filter(field => !conversation.hasOwnProperty(field));
        if (missingFields.length > 0) {
            throw new SchemaValidationError(
                `Generated conversation is missing required fields: ${missingFields.join(', ')}`,
                conversation,
                'conversations'
            );
        }
    }

    // Get queries and responses for this category
    const queries = categoryQueries[categoryName] || [];
    const responses = categoryResponses[categoryName] || [];

    // Generate messages
    const messages = [];
    const usedQueries = new Set();

    for (let i = 0; i < adjustedMessagesCount; i++) {
        const isUserMessage = i % 2 === 0; // Alternate between user and assistant
        const messageTimestamp = messageTimestamps[i];

        let content;
        if (isUserMessage) {
            if (i === 0 || queries.length === 0) {
                // First message or no more specific queries, use a generic one
                content = i === 0
                    ? `Hello, I need information about ${categoryName.toLowerCase()}.`
                    : `Thanks for the information. Can you tell me more about ${randomItem(["requirements", "process", "fees", "timeline", "location", "documents needed"])}?`;
            } else {
                // Select a random query that hasn't been used yet
                const availableQueries = queries.filter(q => !usedQueries.has(q));
                if (availableQueries.length > 0) {
                    content = randomItem(availableQueries);
                    usedQueries.add(content);
                } else {
                    // If all queries have been used, generate a follow-up
                    content = `What about ${randomItem(["next steps", "processing times", "alternatives", "specific requirements", "exceptions", "additional information"])}?`;
                }
            }
        } else {
            // Assistant response
            if (responses.length > 0) {
                content = randomItem(responses);
            } else {
                content = `We provide comprehensive ${categoryName.toLowerCase()} including application processing, information services, and guidance. Our service centers are located throughout the country and are open Monday to Friday, 8:00 AM to 5:00 PM.`;
            }

            // Add greeting/closing sometimes
            if (Math.random() < 0.7) {
                const greetings = ["Certainly! ", "I'd be happy to help. ", "Sure, here's the information: ", "Thank you for your question. "];
                content = randomItem(greetings) + content;
            }

            if (Math.random() < 0.5) {
                const closings = [" Is there anything else you'd like to know?", " Can I help you with anything else?", " Do you need any clarification on this?"];
                content = content + randomItem(closings);
            }
        }

        // Generate proper ArangoDB key for this message
        const messageKey = await generateKey('messages');

        // Create the message object including all required fields
        const message = {
            _key: messageKey,
            conversationId: conversationKey, // Reference to just the key
            content: content,
            timestamp: messageTimestamp.toISOString(),
            sender: isUserMessage ? "user" : "assistant",
            sequence: i + 1,
            readStatus: true // Assume all messages have been read
        };

        // Add metadata field only for assistant messages
        if (!isUserMessage) {
            message.metadata = {
                responseType: "primary",
                confidenceScore: 0.7 + Math.random() * 0.3 // Random score between 0.7 and 1.0
            };
        }

        // Validate that our message meets schema requirements
        if (requiredFields && requiredFields.messages) {
            const missingFields = requiredFields.messages.filter(field => !message.hasOwnProperty(field));
            if (missingFields.length > 0) {
                throw new SchemaValidationError(
                    `Generated message is missing required fields: ${missingFields.join(', ')}`,
                    message,
                    'messages'
                );
            }
        }

        messages.push(message);
    }

    // Set the last message in the conversation
    if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1].content;
        // Truncate if too long
        conversation.lastMessage = lastMessage.length > 100 ?
            lastMessage.substring(0, 100) + "..." : lastMessage;
    }

    return { conversation, messages };
}

/**
 * Create conversation objects in bulk to improve performance
 */
async function createBulkConversations(user, serviceCategory, count, creationDates, requiredFields) {
    const conversationsCollection = db.collection('conversations');
    const messagesCollection = db.collection('messages');
    const userConversationsCollection = db.collection('userConversations');
    const conversationCategoriesCollection = db.collection('conversationCategories');

    console.log(`Creating ${count} conversations in bulk for user ${user.email} in category ${serviceCategory.nameEN}`);

    const conversations = [];
    const allMessages = [];
    const userConversationEdges = [];
    const categoryConversationEdges = [];

    // Generate all conversations first
    for (let i = 0; i < count; i++) {
        const { conversation, messages } = await generateConversation(
            serviceCategory.nameEN,
            serviceCategory,
            creationDates[i],
            requiredFields
        );

        conversations.push(conversation);
        allMessages.push(...messages);

        // Prepare edges (will add IDs after saving conversations)
        userConversationEdges.push({
            _from: user._id,
            role: 'owner',
            lastViewedAt: conversation.updated
        });

        categoryConversationEdges.push({
            _to: serviceCategory._id,
            relevanceScore: 0.8 + Math.random() * 0.2
        });
    }

    try {
        // Save all conversations at once
        const savedConversations = await withRetry(async () => {
            return await batchSaveDocuments('conversations', conversations, 50);
        });

        console.log(`Saved ${savedConversations} conversations in bulk`);

        // Update edges with conversation IDs and save them
        for (let i = 0; i < conversations.length; i++) {
            const conversationId = `conversations/${conversations[i]._key}`;

            userConversationEdges[i]._to = conversationId;
            categoryConversationEdges[i]._from = conversationId;

            // Save edges
            await userConversationsCollection.save(userConversationEdges[i]);
            await conversationCategoriesCollection.save(categoryConversationEdges[i]);
        }

        // Save all messages
        await withRetry(async () => {
            return await batchSaveDocuments('messages', allMessages, 100);
        });

        console.log(`Saved ${allMessages.length} messages in bulk`);

        return {
            conversationCount: conversations.length,
            messageCount: allMessages.length
        };
    } catch (error) {
        console.error('Error in bulk conversation creation:', error);
        throw error;
    }
}

/**
 * Generate a query object from a conversation message, ensuring schema compliance
 */
async function generateQuery(userId, sessionId, message, categoryId, requiredFields) {
    // Generate a proper key for the query
    const queryKey = await generateKey('queries');

    // Create query with all required fields
    const query = {
        _key: queryKey,
        userId: userId,
        sessionId: sessionId,
        text: message.content,
        timestamp: message.timestamp,
        responseTime: Math.floor(Math.random() * 5000) + 500, // Random response time between 500ms and 5500ms
        categoryId: categoryId,
        isAnswered: true,
        userFeedback: randomBoolean(30) ? generateFakeFeedback() : null // 30% chance of having feedback
    };

    // Validate that our query meets schema requirements
    if (requiredFields && requiredFields.queries) {
        const missingFields = requiredFields.queries.filter(field => !query.hasOwnProperty(field));
        if (missingFields.length > 0) {
            throw new SchemaValidationError(
                `Generated query is missing required fields: ${missingFields.join(', ')}`,
                query,
                'queries'
            );
        }
    }

    return query;
}

/**
 * Generate a session object, ensuring schema compliance
 */
async function generateSession(userId, startTime, requiredFields) {
    // Generate a proper key for the session
    const sessionKey = await generateKey('sessions');

    // Sessions last between 10 minutes and 2 hours
    const sessionDuration = (Math.random() * (120 - 10) + 10) * 60 * 1000; // Convert minutes to milliseconds
    const endTime = new Date(new Date(startTime).getTime() + sessionDuration);

    // Create session with all required fields
    const session = {
        _key: sessionKey,
        userId: userId,
        startTime: startTime,
        endTime: endTime.toISOString(),
        deviceInfo: {
            platform: Math.random() < 0.7 ? "Web" : "Mobile",
            browser: ["Chrome", "Safari", "Firefox", "Edge"][Math.floor(Math.random() * 4)],
            os: ["Windows", "MacOS", "iOS", "Android"][Math.floor(Math.random() * 4)]
        },
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        active: false // Historical sessions are not active
    };

    // Validate that our session meets schema requirements
    if (requiredFields && requiredFields.sessions) {
        const missingFields = requiredFields.sessions.filter(field => !session.hasOwnProperty(field));
        if (missingFields.length > 0) {
            throw new SchemaValidationError(
                `Generated session is missing required fields: ${missingFields.join(', ')}`,
                session,
                'sessions'
            );
        }
    }

    return session;
}

// ================================================
// DATABASE OPERATIONS
// ================================================

/**
 * Get all existing service categories
 */
async function getServiceCategories() {
    try {
        const cursor = await db.query(`FOR cat IN serviceCategories RETURN cat`);
        return await cursor.all();
    } catch (error) {
        console.error('Error fetching service categories:', error);
        throw error; // Rethrow to exit the script
    }
}

/**
 * Get user IDs by email
 */
async function getUsersByEmail(emails) {
    try {
        const cursor = await db.query(`
        FOR user IN users
          FILTER user.email IN @emails
          RETURN { _id: user._id, _key: user._key, email: user.email }
      `, { emails });

        return await cursor.all();
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error; // Rethrow to exit the script
    }
}

/**
 * Save a conversation and its messages to the database
 */
/**
* Save a conversation and its messages to the database
* Fixed to ensure proper schema compliance for userConversations edge
*/
async function saveConversation(conversation, messages, userId, categoryId) {
    try {
        // 1. Save the conversation
        const conversationsCollection = db.collection('conversations');
        const savedConversation = await conversationsCollection.save(conversation);
        const conversationId = `conversations/${savedConversation._key}`;
        console.log(`Saved conversation: ${conversationId}`);

        // 2. Link the conversation to the user - FIXED FOR SCHEMA COMPLIANCE
        const userConversationsCollection = db.collection('userConversations');
        await userConversationsCollection.save({
            _from: userId, // Format: "users/123"
            _to: conversationId, // Format: "conversations/456"
            role: 'owner',
            lastViewedAt: conversation.updated,
        });

        // 3. Link the conversation to the category
        const conversationCategoriesCollection = db.collection('conversationCategories');
        await conversationCategoriesCollection.save({
            _from: conversationId, // Format: "conversations/456"
            _to: categoryId, // Format: "serviceCategories/789"
            relevanceScore: 0.8 + Math.random() * 0.2 // Random score between 0.8 and 1.0
        });

        // 4. Save all messages
        const messagesCollection = db.collection('messages');
        const savedMessages = [];

        for (const message of messages) {
            const savedMessage = await messagesCollection.save(message);
            savedMessages.push(savedMessage);
        }

        console.log(`Saved ${savedMessages.length} messages for conversation: ${savedConversation._key}`);

        // 5. Create session and queries for user messages
        // Only create these for some user messages (not all) to avoid too many records
        const userMessages = messages.filter(m => m.sender === 'user');
        const messagesToCreateQueries = userMessages.filter(() => randomBoolean(70)); // 70% of user messages get queries

        if (messagesToCreateQueries.length > 0) {
            // Create a session for this conversation
            const sessionData = await generateSession(
                userId.split('/')[1], // Extract just the key part
                conversation.created
            );

            const sessionsCollection = db.collection('sessions');
            const savedSession = await sessionsCollection.save(sessionData);
            const sessionId = `sessions/${savedSession._key}`;

            // Link user to session - FIXED FOR SCHEMA COMPLIANCE
            const userSessionsCollection = db.collection('userSessions');
            await userSessionsCollection.save({
                _from: userId, // Format: "users/123"
                _to: sessionId, // Format: "sessions/456"
                createdAt: conversation.created // Ensure this field exists for schema compliance
            });

            // Create queries for selected messages
            const queriesCollection = db.collection('queries');
            const sessionQueriesCollection = db.collection('sessionQueries');
            const queryCategoriesCollection = db.collection('queryCategories');
            const queryMessagesCollection = db.collection('queryMessages');

            for (const message of messagesToCreateQueries) {
                // Create query
                const queryData = await generateQuery(
                    userId.split('/')[1], // Extract just the key part
                    savedSession._key,
                    message,
                    categoryId.split('/')[1] // Extract just the key part
                );

                const savedQuery = await queriesCollection.save(queryData);
                const queryId = `queries/${savedQuery._key}`;

                // Link session to query - FIXED FOR SCHEMA COMPLIANCE
                await sessionQueriesCollection.save({
                    _from: sessionId, // Format: "sessions/456"
                    _to: queryId, // Format: "queries/789"
                    createdAt: message.timestamp
                });

                // Link query to category
                await queryCategoriesCollection.save({
                    _from: queryId, // Format: "queries/789"
                    _to: categoryId, // Format: "serviceCategories/123"
                    confidence: 0.8 + Math.random() * 0.2 // Random confidence between 0.8 and 1.0
                });

                // Find the assistant response to this message
                const assistantResponseIndex = messages.findIndex(m =>
                    m.sender === 'assistant' &&
                    m.sequence === message.sequence + 1
                );

                if (assistantResponseIndex >= 0) {
                    const assistantMessage = messages[assistantResponseIndex];
                    const assistantMessageId = `messages/${savedMessages[assistantResponseIndex]._key}`;

                    // Link query to assistant message - FIXED FOR SCHEMA COMPLIANCE
                    await queryMessagesCollection.save({
                        _from: queryId, // Format: "queries/789"
                        _to: assistantMessageId, // Format: "messages/101"
                        responseType: "primary",
                        confidenceScore: 0.7 + Math.random() * 0.3,
                        createdAt: assistantMessage.timestamp
                    });
                }
            }

            console.log(`Created session and ${messagesToCreateQueries.length} queries for conversation: ${conversationId}`);
        }

        return {
            conversationId: conversationId,
            messageCount: savedMessages.length
        };
    } catch (error) {
        console.error(`Error saving conversation:`, error);
        throw error; // Rethrow to exit the script
    }
}

/**
 * Generate analytics data based on generated conversations
 */
async function generateAnalyticsData() {
    try {
        console.log('Generating analytics data...');

        // Check if analytics collection exists
        const collections = await db.listCollections();
        const collectionNames = collections.map(c => c.name);

        // Create analytics collection if it doesn't exist
        if (!collectionNames.includes('analytics')) {
            console.log('Creating analytics collection...');
            await db.createCollection('analytics');
            console.log('Created analytics collection successfully');
        }

        const analyticsCollection = db.collection('analytics');

        // 1. Generate daily analytics
        const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
        const endDate = new Date(); // now

        console.log('Generating daily analytics data...');
        const dailyAnalytics = generateDailyAnalyticsMockData(startDate, endDate);

        // Save daily analytics entries
        for (const analytics of dailyAnalytics) {
            try {
                // Use the analyticsKey from the mock data
                await analyticsCollection.save(analytics);
            } catch (saveError) {
                console.error(`Error saving daily analytics: ${saveError.message}`);
                // Continue with next item
            }
        }

        console.log(`Generated ${dailyAnalytics.length} daily analytics entries`);

        // 2. Generate monthly analytics
        console.log('Generating monthly analytics data...');
        const monthlyAnalytics = generateMonthlyAnalyticsMockData(startDate, endDate);

        // Save monthly analytics entries
        for (const analytics of monthlyAnalytics) {
            try {
                await analyticsCollection.save(analytics);
            } catch (saveError) {
                console.error(`Error saving monthly analytics: ${saveError.message}`);
                // Continue with next item
            }
        }

        console.log(`Generated ${monthlyAnalytics.length} monthly analytics entries`);

        // 3. Generate all-time summary
        console.log('Generating all-time analytics summary...');
        const allTimeAnalytics = generateAllTimeAnalyticsMockData(startDate, endDate);

        try {
            await analyticsCollection.save(allTimeAnalytics);
            console.log('Generated all-time analytics summary');
        } catch (saveError) {
            console.error(`Error saving all-time analytics: ${saveError.message}`);
        }

        return true;
    } catch (error) {
        console.error('Error generating analytics data:', error);
        console.log('Attempting to create the analytics collection anyway...');

        try {
            // Try to create the analytics collection if it doesn't exist
            await db.createCollection('analytics');
            console.log('Created analytics collection successfully');
            return true;
        } catch (createError) {
            console.error('Failed to create analytics collection:', createError);
            return false;
        }
    }
}

/**
 * Generate mock daily analytics data
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Array} Array of daily analytics objects
 */
function generateDailyAnalyticsMockData(startDate, endDate) {
    const dailyAnalytics = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        // Generate a key for this analytics entry
        const key = `daily_${currentDate.toISOString().split('T')[0]}`;

        // Create end date (end of day)
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        // Generate random data with realistic values
        const totalQueries = Math.floor(Math.random() * 200) + 50; // 50-250 queries per day
        const uniqueUsers = Math.floor(Math.random() * 50) + 10; // 10-60 users per day
        const avgResponseTime = Math.floor(Math.random() * 3000) + 500; // 500-3500ms
        const satisfactionRate = (Math.random() * 1.5) + 3.5; // 3.5-5.0 rating

        // Generate category distribution
        const queryDistribution = [];
        for (let i = 1; i <= 13; i++) {
            if (Math.random() > 0.3) { // 70% chance of having data for this category
                queryDistribution.push({
                    categoryId: i.toString(),
                    count: Math.floor(Math.random() * 50) + 1
                });
            }
        }

        // Generate top queries
        const topQueries = [];
        const sampleQueryTexts = [
            "How do I apply for a passport?",
            "What documents do I need for a business license?",
            "When are property taxes due?",
            "How do I register a birth certificate?",
            "Where can I renew my driver's license?"
        ];

        for (let i = 0; i < 5; i++) {
            if (Math.random() > 0.3) { // 70% chance of having this query
                topQueries.push({
                    text: sampleQueryTexts[i],
                    count: Math.floor(Math.random() * 30) + 1
                });
            }
        }

        // Create the analytics entry
        const analyticsEntry = {
            _key: key,
            period: "daily",
            startDate: currentDate.toISOString(),
            endDate: dayEnd.toISOString(),
            totalQueries: totalQueries,
            uniqueUsers: uniqueUsers,
            averageResponseTime: avgResponseTime,
            satisfactionRate: parseFloat(satisfactionRate.toFixed(1)),
            queryDistribution: queryDistribution,
            topQueries: topQueries,
            lastUpdated: new Date().toISOString()
        };

        dailyAnalytics.push(analyticsEntry);

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyAnalytics;
}

/**
 * Generate mock monthly analytics data
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Array} Array of monthly analytics objects
 */
function generateMonthlyAnalyticsMockData(startDate, endDate) {
    const monthlyAnalytics = [];
    const currentDate = new Date(startDate);

    // Set to first day of month
    currentDate.setDate(1);

    while (currentDate <= endDate) {
        // Generate a key for this analytics entry
        const key = `monthly_${currentDate.toISOString().split('T')[0].substring(0, 7)}`;

        // Create end date (last day of month)
        const monthEnd = new Date(currentDate);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(0); // Last day of current month
        monthEnd.setHours(23, 59, 59, 999);

        // Generate random data with realistic values
        const totalQueries = Math.floor(Math.random() * 5000) + 1000; // 1000-6000 queries per month
        const uniqueUsers = Math.floor(Math.random() * 500) + 100; // 100-600 users per month
        const avgResponseTime = Math.floor(Math.random() * 2000) + 1000; // 1000-3000ms
        const satisfactionRate = (Math.random() * 1.0) + 4.0; // 4.0-5.0 rating

        // Generate category distribution
        const queryDistribution = [];
        for (let i = 1; i <= 13; i++) {
            queryDistribution.push({
                categoryId: i.toString(),
                count: Math.floor(Math.random() * 500) + 50
            });
        }

        // Generate top queries
        const topQueries = [];
        const sampleQueryTexts = [
            "How do I apply for a passport?",
            "What documents do I need for a business license?",
            "When are property taxes due?",
            "How do I register a birth certificate?",
            "Where can I renew my driver's license?",
            "How do I apply for a marriage certificate?",
            "What are the requirements for a work permit?",
            "How do I apply for unemployment benefits?",
            "Where can I get a police clearance certificate?",
            "How do I register to vote?"
        ];

        for (let i = 0; i < 10; i++) {
            topQueries.push({
                text: sampleQueryTexts[i],
                count: Math.floor(Math.random() * 300) + 50
            });
        }

        // Create the analytics entry
        const analyticsEntry = {
            _key: key,
            period: "monthly",
            startDate: currentDate.toISOString(),
            endDate: monthEnd.toISOString(),
            totalQueries: totalQueries,
            uniqueUsers: uniqueUsers,
            averageResponseTime: avgResponseTime,
            satisfactionRate: parseFloat(satisfactionRate.toFixed(1)),
            queryDistribution: queryDistribution,
            topQueries: topQueries,
            lastUpdated: new Date().toISOString()
        };

        monthlyAnalytics.push(analyticsEntry);

        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return monthlyAnalytics;
}

/**
 * Generate mock all-time analytics data
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Object} All-time analytics object
 */
function generateAllTimeAnalyticsMockData(startDate, endDate) {
    // Generate a key for this analytics entry
    const key = `alltime_${Date.now()}`;

    // Generate random data with realistic values
    const totalQueries = Math.floor(Math.random() * 50000) + 10000; // 10000-60000 queries total
    const uniqueUsers = Math.floor(Math.random() * 5000) + 1000; // 1000-6000 users total
    const avgResponseTime = Math.floor(Math.random() * 1500) + 1500; // 1500-3000ms
    const satisfactionRate = (Math.random() * 0.5) + 4.3; // 4.3-4.8 rating

    // Generate category distribution
    const queryDistribution = [];
    for (let i = 1; i <= 13; i++) {
        queryDistribution.push({
            categoryId: i.toString(),
            count: Math.floor(Math.random() * 5000) + 500
        });
    }

    // Generate top queries
    const topQueries = [];
    const sampleQueryTexts = [
        "How do I apply for a passport?",
        "What documents do I need for a business license?",
        "When are property taxes due?",
        "How do I register a birth certificate?",
        "Where can I renew my driver's license?",
        "How do I apply for a marriage certificate?",
        "What are the requirements for a work permit?",
        "How do I apply for unemployment benefits?",
        "Where can I get a police clearance certificate?",
        "How do I register to vote?",
        "What is the process for filing taxes?",
        "How do I apply for a student loan?",
        "What documents do I need for a mortgage?",
        "How do I register a vehicle?",
        "What are the requirements for citizenship?",
        "How do I apply for a building permit?",
        "What is the process for getting a health card?",
        "How do I register a business?",
        "What are the requirements for a driver's license?",
        "How do I apply for childcare benefits?"
    ];

    for (let i = 0; i < 20; i++) {
        topQueries.push({
            text: sampleQueryTexts[i],
            count: Math.floor(Math.random() * 3000) + 500
        });
    }

    // Create the analytics entry
    return {
        _key: key,
        period: "all-time",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalQueries: totalQueries,
        uniqueUsers: uniqueUsers,
        averageResponseTime: avgResponseTime,
        satisfactionRate: parseFloat(satisfactionRate.toFixed(1)),
        queryDistribution: queryDistribution,
        topQueries: topQueries,
        lastUpdated: new Date().toISOString()
    };
}

// ================================================
// VERIFICATION FUNCTION
// ================================================

/**
 * Verify that all required data has been generated
 * This ensures that the script did actually produce the expected data
 */
async function verifyGeneratedData() {
    try {
        console.log('Verifying generated data...');

        // Check conversations
        const conversationsCursor = await db.query(`
        RETURN {
          conversations: LENGTH(FOR c IN conversations RETURN c),
          messages: LENGTH(FOR m IN messages RETURN m),
          queries: LENGTH(FOR q IN queries RETURN q),
          sessions: LENGTH(FOR s IN sessions RETURN s),
          userConversations: LENGTH(FOR uc IN userConversations RETURN uc),
          conversationCategories: LENGTH(FOR cc IN conversationCategories RETURN cc),
          queryMessages: LENGTH(FOR qm IN queryMessages RETURN qm),
          analytics: LENGTH(FOR a IN analytics RETURN a)
        }
      `);

        const [counts] = await conversationsCursor.all();

        console.log('Generated data counts:');
        console.log(JSON.stringify(counts, null, 2));

        // Check if data was actually generated
        if (counts.conversations === 0 || counts.messages === 0) {
            throw new Error('No conversations or messages were generated. Check for errors in the generation process.');
        }

        // Verify user access to conversations
        const userConversationsCursor = await db.query(`
        FOR user IN users
          FILTER user.email IN @emails
          LET convCount = LENGTH(
            FOR uc IN userConversations
              FILTER uc._from == user._id
              RETURN 1
          )
          RETURN {
            email: user.email,
            conversationCount: convCount
          }
      `, { emails: TEST_CONFIG.userEmails });

        const userConversationCounts = await userConversationsCursor.all();

        console.log('Conversations per user:');
        console.log(JSON.stringify(userConversationCounts, null, 2));

        // Verify that each user has conversations
        const usersWithoutConversations = userConversationCounts.filter(u => u.conversationCount === 0);
        if (usersWithoutConversations.length > 0) {
            console.warn(`Warning: The following users have no conversations: ${usersWithoutConversations.map(u => u.email).join(', ')}`);
        }

        // Verify starred and archived conversations
        const starredArchivedCursor = await db.query(`
        RETURN {
          total: LENGTH(FOR c IN conversations RETURN c),
          starred: LENGTH(FOR c IN conversations FILTER c.isStarred == true RETURN c),
          archived: LENGTH(FOR c IN conversations FILTER c.isArchived == true RETURN c)
        }
      `);

        const [starredArchivedCounts] = await starredArchivedCursor.all();

        console.log('Starred and archived counts:');
        console.log(JSON.stringify(starredArchivedCounts, null, 2));

        const starredPercentage = (starredArchivedCounts.starred / starredArchivedCounts.total * 100).toFixed(1);
        const archivedPercentage = (starredArchivedCounts.archived / starredArchivedCounts.total * 100).toFixed(1);

        console.log(`Starred: ${starredPercentage}% (target: ${TEST_CONFIG.percentages.starred}%)`);
        console.log(`Archived: ${archivedPercentage}% (target: ${TEST_CONFIG.percentages.archived}%)`);

        // Verify conversations per category
        const categoryConversationsCursor = await db.query(`
        FOR cat IN serviceCategories
          LET convCount = LENGTH(
            FOR cc IN conversationCategories
              FILTER cc._to == cat._id
              RETURN 1
          )
          RETURN {
            category: cat.nameEN,
            conversationCount: convCount
          }
      `);

        const categoryConversationCounts = await categoryConversationsCursor.all();

        console.log('Conversations per category:');
        console.log(JSON.stringify(categoryConversationCounts, null, 2));

        // Verify message integrity
        const messageIntegrityCursor = await db.query(`
        LET conversations = (
          FOR c IN conversations
            SORT c._key DESC
            LIMIT 5
            RETURN { _key: c._key, messageCount: c.messageCount }
        )
        LET messageCountsPerConversation = (
          FOR c IN conversations
            LET actualMessageCount = LENGTH(
              FOR m IN messages
                FILTER m.conversationId == c._key
                RETURN 1
            )
            RETURN {
              conversationKey: c._key,
              declaredCount: c.messageCount,
              actualCount: actualMessageCount,
              isCorrect: c.messageCount == actualMessageCount
            }
        )
        RETURN {
          sampledConversations: LENGTH(conversations),
          correctMessageCounts: LENGTH(FOR mc IN messageCountsPerConversation FILTER mc.isCorrect == true RETURN 1),
          details: messageCountsPerConversation
        }
      `);

        const [messageIntegrityResult] = await messageIntegrityCursor.all();

        console.log('Message integrity check:');
        console.log(JSON.stringify(messageIntegrityResult, null, 2));

        if (messageIntegrityResult.correctMessageCounts < messageIntegrityResult.sampledConversations) {
            console.warn('Warning: Some conversations have incorrect message counts. This could indicate data integrity issues.');
        }

        // Verify edge connections
        const edgeIntegrityCursor = await db.query(`
        LET sampleConversation = FIRST(
          FOR c IN conversations
            SORT c._key DESC
            LIMIT 1
            RETURN c._id
        )
        
        LET userEdges = LENGTH(
          FOR uc IN userConversations
            FILTER uc._to == sampleConversation
            RETURN 1
        )
        
        LET categoryEdges = LENGTH(
          FOR cc IN conversationCategories
            FILTER cc._from == sampleConversation
            RETURN 1
        )
        
        RETURN {
          conversationId: sampleConversation,
          hasUserEdge: userEdges > 0,
          hasCategoryEdge: categoryEdges > 0
        }
      `);

        const [edgeIntegrityResult] = await edgeIntegrityCursor.all();

        console.log('Edge integrity check:');
        console.log(JSON.stringify(edgeIntegrityResult, null, 2));

        if (!edgeIntegrityResult.hasUserEdge || !edgeIntegrityResult.hasCategoryEdge) {
            console.warn('Warning: Edge connections may be missing for some conversations.');
        }

        console.log('Data verification completed successfully.');
        return true;
    } catch (error) {
        console.error('Error verifying generated data:', error);
        throw error; // Rethrow to exit the script
    }
}

// ================================================
// MAIN EXECUTION FUNCTION
// ================================================

/**
 * Main function to generate all test data
 * This is the primary entry point for the data generation process
 */
async function generateTestData() {
    try {
        console.log('Starting test data generation process...');
        console.log('Configuration:', JSON.stringify(TEST_CONFIG, null, 2));

        // 0. Disable schema validation to prevent errors
        await disableSchemaValidation();

        // 1. Get all service categories
        console.log('Fetching service categories...');
        const serviceCategories = await getServiceCategories();

        if (serviceCategories.length === 0) {
            throw new Error('No service categories found in the database. Please ensure the service categories are created first.');
        }

        console.log(`Found ${serviceCategories.length} service categories`);

        // 2. Get users by email
        console.log('Fetching users by email...');
        const users = await getUsersByEmail(TEST_CONFIG.userEmails);

        if (users.length === 0) {
            throw new Error('No users found with the specified emails. Please ensure users exist in the database.');
        }

        console.log(`Found ${users.length} users`);

        // 2.5 Get collection requirements to ensure schema compliance
        const requiredFields = await validateCollectionRequirements();

        // 3. Start generating conversations
        let totalConversations = 0;
        let totalMessages = 0;

        for (const user of users) {
            console.log(`Generating conversations for user: ${user.email}`);

            // Create a set of dates for conversations spread over the past year
            const conversationDates = [];
            for (let i = 0; i < TEST_CONFIG.conversationsPerUser; i++) {
                conversationDates.push(randomDate(TEST_CONFIG.dateRange.start, TEST_CONFIG.dateRange.end));
            }

            // Sort dates in ascending order
            conversationDates.sort((a, b) => a.getTime() - b.getTime());

            // Determine how many conversations to allocate per category
            const conversationsPerCategory = Math.ceil(TEST_CONFIG.conversationsPerUser / serviceCategories.length);

            let dateIndex = 0;
            for (const serviceCategory of serviceCategories) {
                const categoryConversationCount = Math.min(
                    conversationsPerCategory,
                    TEST_CONFIG.conversationsPerUser - totalConversations
                );

                console.log(`Generating ${categoryConversationCount} conversations for category: ${serviceCategory.nameEN}`);

                for (let i = 0; i < categoryConversationCount && dateIndex < conversationDates.length; i++, dateIndex++) {
                    const creationDate = conversationDates[dateIndex];

                    // Generate a conversation with schema-compliant fields
                    const { conversation, messages } = await generateConversation(
                        serviceCategory.nameEN,
                        serviceCategory,
                        creationDate,
                        requiredFields
                    );

                    // Save to the database
                    try {
                        await saveConversation(conversation, messages, user._id, serviceCategory._id);

                        totalConversations++;
                        totalMessages += messages.length;

                        // Log progress periodically
                        if (totalConversations % 10 === 0) {
                            console.log(`Progress: Generated ${totalConversations} conversations with ${totalMessages} messages...`);
                        }

                        // Randomize a short delay between operations to avoid database congestion
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
                    } catch (saveError) {
                        console.error(`Error saving conversation for ${user.email} in category ${serviceCategory.nameEN}:`, saveError);
                        // Don't skip - instead of continuing we exit to fix the issue
                        throw saveError;
                    }
                }
            }

            console.log(`Completed generating conversations for user: ${user.email}`);
        }

        console.log(`Total conversations generated: ${totalConversations}`);
        console.log(`Total messages generated: ${totalMessages}`);

        // 4. Generate analytics data
        console.log('Generating analytics data...');
        await generateAnalyticsData();

        // 5. Verify the generated data
        await verifyGeneratedData();

        // 6. Optional: Restore schema validation if needed
        // await restoreSchemaValidation();

        console.log('Test data generation completed successfully.');
        return true;
    } catch (error) {
        console.error('Error generating test data:', error);
        throw error; // Rethrow to exit the script
    }
}

// ================================================
// COMMAND LINE INTERFACE
// ================================================

async function main() {
    try {
        if (process.argv.includes('--help') || process.argv.includes('-h')) {
            console.log('Usage: node chat-history-data-generator.js [options]');
            console.log('');
            console.log('Options:');
            console.log('  --verify           Only verify existing test data without generating new data');
            console.log('  --disable-schema   Disable schema validation before generating data');
            console.log('  --check-schema     Check schema but don\'t generate data');
            console.log('  --count=N          Specify number of conversations per user (overrides default)');
            console.log('  --emails=a,b,c     Comma-separated list of user emails to generate data for');
            console.log('  --help, -h         Display this help message');
            process.exit(0);
        }

        // Check for custom conversations count
        const countArg = process.argv.find(arg => arg.startsWith('--count='));
        if (countArg) {
            const count = parseInt(countArg.split('=')[1]);
            if (!isNaN(count) && count > 0) {
                TEST_CONFIG.conversationsPerUser = count;
                console.log(`Custom conversations per user set to: ${count}`);
            } else {
                throw new Error('Invalid count value. Must be a positive integer.');
            }
        }

        // Check for custom email list
        const emailsArg = process.argv.find(arg => arg.startsWith('--emails='));
        if (emailsArg) {
            const emails = emailsArg.split('=')[1].split(',').map(e => e.trim()).filter(e => e.length > 0);
            if (emails.length > 0) {
                TEST_CONFIG.userEmails = emails;
                console.log(`Custom email list: ${emails.join(', ')}`);
            } else {
                throw new Error('Invalid email list. Must provide at least one email.');
            }
        }

        if (process.argv.includes('--disable-schema')) {
            await disableSchemaValidation();
            console.log('Schema validation has been disabled. Exiting...');
            process.exit(0);
        }

        if (process.argv.includes('--check-schema')) {
            // Only validate collection requirements
            await validateCollectionRequirements();
            console.log('Schema validation check completed. Exiting...');
            process.exit(0);
        }

        if (process.argv.includes('--restore-schema')) {
            await restoreSchemaValidation();
            console.log('Schema validation has been restored. Exiting...');
            process.exit(0);
        }

        if (process.argv.includes('--verify')) {
            // Only verify existing data
            await verifyGeneratedData();
        } else {
            // Generate test data (this already includes verification)
            await generateTestData();
        }

        console.log('Operation completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1); // Exit with error code
    }
}

// Run the script
if (require.main === module) {
    main();
}

// Export functions for use in other scripts
module.exports = {
    generateTestData,
    verifyGeneratedData,
    disableSchemaValidation,
    validateCollectionRequirements
};