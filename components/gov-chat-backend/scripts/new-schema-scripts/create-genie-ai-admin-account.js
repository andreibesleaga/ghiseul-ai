// Import the ArangoDB driver
const { Database } = require('arangojs');
const readline = require('readline');

// --- Admin User Data ---
// The basic admin user object to be created.
const adminUser = {
  "loginName": "Admin",
  "email": "admin@admin.com",
  "encPassword": "$2b$10$DNPqLSecZ5sVKGRfB5PyGe/HIx03O1PTdxn3lAKQLLfOlH0fJ0nM2",
  "emailVerified": true,
  "createdAt": "2025-04-15T16:40:05.829Z",
  "updatedAt": "2025-10-07T06:37:32.681Z",
  "personalIdentification": {
    "fullName": "Admin",
    "dob": "",
    "gender": "",
    "nationality": "",
    "maritalStatus": ""
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyMTQwIiwiaWF0IjoxNzU5ODE4NTk0LCJleHAiOjE3NTk5MDQ5OTR9.Q_D7mCXORPTCfFu0RTjUFMNtgx-PKjEr4WNrfxyCv3Q",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyMTQwIiwidG9rZW5WZXJzaW9uIjozLCJpYXQiOjE3NTk4MTg1OTQsImV4cCI6MTc2MDQyMzM5NH0.yu4Rif5ieMbWpcHRZUeK8g5Pj7TBgD9BeRfNDdfPDrU",
  "role": "Admin"
};

/**
 * Asks a question in the console and returns the user's answer.
 * @param {string} query - The question to display to the user.
 * @returns {Promise<string>} The user's answer.
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}


/**
 * Main function to connect to ArangoDB and create the admin user.
 */
async function createAdminUser() {

  // Read configuration from environment variables, with defaults
  const dbConfig = {
    url: process.env.ARANGO_URL || "http://127.0.0.1:8529",
    databaseName: process.env.ARANGO_DATABASE || "node-services",
    auth: {
      username: process.env.ARANGO_USER || "root",
      password: process.env.ARANGO_PASSWORD || "your-database-password"
    },
  };

  // --- Confirmation Prompt ---
  console.log('--- Admin User Creation Script ---');
  console.log('This script will create an Admin user in the database.');
  console.log('\nDatabase configuration to be used:');
  console.log(`  URL:      ${dbConfig.url}`);
  console.log(`  Database: ${dbConfig.databaseName}`);
  console.log(`  User:     ${dbConfig.auth.username}`);

  const answer = await askQuestion('\nAre you sure you want to proceed with these settings? (Y/n) ');

  if (answer.toLowerCase() !== 'y') {
    console.log('Operation cancelled by user. Exiting.');
    process.exit(0);
  }
  // --- End Confirmation Prompt ---

  console.log("\nConnecting to ArangoDB...");
  const db = new Database(dbConfig);

  try {
    // Verify that the database exists
    const dbExists = await db.exists();
    if (!dbExists) {
      console.error(`Error: Database "${dbConfig.databaseName}" does not exist.`);
      return;
    }
    console.log(`Successfully connected to database: "${dbConfig.databaseName}"`);

    const usersCollection = db.collection("users");

    // 1. Check if the user already exists
    console.log(`Checking for existing user with loginName: "${adminUser.loginName}"...`);
    const cursor = await db.query({
      query: `
        FOR user IN users
        FILTER user.loginName == @loginName
        LIMIT 1
        RETURN user
      `,
      bindVars: { loginName: adminUser.loginName }
    });

    const existingUser = await cursor.next();

    if (existingUser) {
      // 2a. If user exists, do nothing
      console.log(`User "${adminUser.loginName}" already exists. No action taken.`);
    } else {
      // 2b. If user does not exist, create it
      console.log(`User "${adminUser.loginName}" not found. Creating new user...`);
      const result = await usersCollection.save(adminUser, { returnNew: true });
      console.log("Successfully created new admin user:");
      console.log(result.new);
    }

  } catch (err) {
    console.error("An error occurred:", err.message);
  }
}

// Run the script if executed directly
if (require.main === module) {
  createAdminUser();
}

