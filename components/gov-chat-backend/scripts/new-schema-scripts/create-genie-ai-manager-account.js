// Import the ArangoDB driver
const { Database } = require('arangojs');
const readline = require('readline');

// --- User Data ---
// The user object to be created.
const managerUser = {
  "loginName": "genie-ai-manager",
  "email": "genie.ai@atomicmail.io",
  "encPassword": "$2b$10$DpqLMweTJQr.G925ZiT8veB67g7neI6MtmAzjL2Yt1L9UorVmC822",
  "emailVerified": true,
  "createdAt": "2025-08-26T13:39:27.730Z",
  "updatedAt": "2025-10-06T03:07:39.356Z",
  "personalIdentification": {
    "fullName": "genie-ai-manager",
    "dob": "",
    "gender": "",
    "nationality": "",
    "maritalStatus": ""
  },
  "addressResidency": {
    "currentAddress": ""
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyMTYyIiwibG9naW5OYW1lIjoiZ2VuaWUtYWktbWFuYWdlciIsImVtYWlsIjoiZ2VuaWUuYWlAYXRvbWljbWFpbC5pbyIsImlhdCI6MTc1OTcyMDA1OSwiZXhwIjoxNzU5ODA2NDU5fQ.V93S6eBKkJpPj_wCbuVMdcdS6NhwGMMBKtGEFEHkn7E",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyMTYyIiwidG9rZW5WZXJzaW9uIjowLCJpYXQiOjE3NTk3MjAwNTksImV4cCI6MTc2MDMyNDg1OX0.wrG8l0e4z4AcY2FxBbfXcx9HfgWjFVD7ZRL80ygI4yQ",
  "role": "User"
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
 * Main function to connect to ArangoDB and create the user.
 */
async function createArangoUser() {
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
  console.log('--- Manager User Creation Script ---');
  console.log('This script will create a genie-ai-manager user in the database.');
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
    console.log(`Checking for existing user with loginName: "${managerUser.loginName}"...`);
    const cursor = await db.query({
      query: `
        FOR user IN users
        FILTER user.loginName == @loginName
        LIMIT 1
        RETURN user
      `,
      bindVars: { loginName: managerUser.loginName }
    });

    const existingUser = await cursor.next();

    if (existingUser) {
      // 2a. If user exists, do nothing
      console.log(`User "${managerUser.loginName}" already exists. No action taken.`);
    } else {
      // 2b. If user does not exist, create it
      console.log(`User "${managerUser.loginName}" not found. Creating new user...`);
      const result = await usersCollection.save(managerUser, { returnNew: true });
      console.log("Successfully created new user:");
      console.log(result.new);
    }

  } catch (err) {
    console.error("An error occurred:", err.message);
  }
}

// Run the script if executed directly
if (require.main === module) {
  createArangoUser();
}
