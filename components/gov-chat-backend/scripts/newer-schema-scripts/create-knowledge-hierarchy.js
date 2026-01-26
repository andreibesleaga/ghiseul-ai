/**
 * create-knowledge-hierarchy.js
 *
 * This script establishes the foundational knowledge hierarchy (service categories and services)
 * in an ArangoDB database. It populates the `serviceCategories`, `services`, and
 * `categoryServices` (edge) collections.
 *
 * This is the first step in setting up a new RAG use case for the GENIE.AI framework.
 * The script is designed to create the English (`nameEN`) labels only. After running
 * this script, use `create-translations.js` to add support for other languages.
 *
 * It operates in two modes:
 * 1. Interactive Mode: Prompts the user to enter categories and their associated services
 * via the command line. This is ideal for manual setup.
 * 2. File Mode: Imports the hierarchy from a user-provided JSON file. This is
 * suitable for automated deployments or predefined structures.
 *
 * The script ensures data integrity by preventing the creation of duplicate categories
 * or services based on their `nameEN`.
 *
 * Usage:
 * - Interactive Mode: node create-knowledge-hierarchy.js
 * - File Mode:        node create-knowledge-hierarchy.js --file <path_to_json_file>
 * * NOTE: disable schema validation for the serviceCategories and Services collection 
 * and the categoryServices edge collection before running the script and enable again afterward
 *
 * JSON File Format for File Mode:
 * The file should be an array of category objects. Each object must have a `category`
 * (string) and a `services` property (array of strings).
 *
 * Example `hierarchy.json`:
 * [
 * {
 * "category": "Healthcare & Social Services",
 * "services": [
 * "Find a Doctor",
 * "Book a Hospital Appointment",
 * "Apply for Social Assistance"
 * ]
 * }
 * ]
 *
 * Environment Variables (in .env file):
 * - ARANGO_URL: ArangoDB URL (default: http://localhost:8529)
 * - ARANGO_DATABASE: Database name (default: genie)
 * - ARANGO_USERNAME: ArangoDB username (default: root)
 * - ARANGO_PASSWORD: ArangoDB password (default: test)
 *
 * Prerequisites:
 * - The target database and collections (`serviceCategories`, `services`, `categoryServices`) must already exist.
 * Run `arango-schema-creator.js` first if the schema is not in place.
 * - Install dependencies: `npm install arangojs dotenv inquirer yargs`
 *
 * Output:
 * - Logs the creation of categories, services, and edges.
 * - Skips any duplicates found.
 * - Exits with status 0 on success, 1 on failure.
 */

const { Database, aql } = require('arangojs');
const fs = require('fs').promises;
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const readline = require('readline');
require('dotenv').config();

// To support modern ESM-only packages like inquirer v9+, we will dynamically import it.
let inquirer;

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

class HierarchyCreator {
  constructor(dbConfig) {
    this.db = new Database(dbConfig);
  }

  /**
   * Lazy-loads the inquirer module. This is necessary because inquirer v9+ is an ESM-only module.
   */
  async #loadInquirer() {
    if (!inquirer) {
      inquirer = (await import('inquirer')).default;
    }
  }

  /**
   * Verifies that the required collections exist.
   */
  async ensureCollections() {
    console.log('Verifying that required collections exist...');
    const requiredCollections = ['serviceCategories', 'services', 'categoryServices'];
    const missingCollections = [];

    for (const name of requiredCollections) {
      const collection = this.db.collection(name);
      const exists = await collection.exists();
      if (!exists) {
        missingCollections.push(name);
      }
    }

    if (missingCollections.length > 0) {
      const errorMessage = `
✗ Prerequisite check failed. The following required collections are missing:
  - ${missingCollections.join('\n  - ')}

Please run the schema creation script first to set up the database structure:
  node arango-schema-creator.js ./arango-schema.json
`;
      throw new Error(errorMessage);
    }

    console.log('✓ All required collections found.');
    this.serviceCategories = this.db.collection('serviceCategories');
    this.services = this.db.collection('services');
    this.categoryServices = this.db.collection('categoryServices');
  }

  /**
   * Gathers hierarchy data from a JSON file.
   */
  async processFromFile(filePath) {
    console.log(`Reading hierarchy from file: ${filePath}`);
    try {
      const fileContent = await fs.readFile(path.resolve(filePath), 'utf8');
      const data = JSON.parse(fileContent);

      if (!Array.isArray(data)) {
        throw new Error('Invalid file format: The root element must be an array.');
      }
      data.forEach((item, index) => {
        if (typeof item.category !== 'string' || !Array.isArray(item.services)) {
          throw new Error(`Invalid format for item at index ${index}: Must have a 'category' (string) and 'services' (array).`);
        }
        item.services.forEach(service => {
          if (typeof service !== 'string') {
            throw new Error(`Invalid service name in category "${item.category}". All services must be strings.`);
          }
        });
      });
      console.log(`✓ Successfully read and validated ${data.length} categories from file.`);
      return data;
    } catch (error) {
      console.error(`✗ Error reading or parsing file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gathers hierarchy data through interactive prompts.
   */
  async processInteractively() {
    await this.#loadInquirer();
    console.log('Starting interactive mode to define knowledge hierarchy.');
    console.log('Please enter your service categories and the services within each.');
    const hierarchy = [];
    let addAnotherCategory = true;

    while (addAnotherCategory) {
      const { categoryName } = await inquirer.prompt([
        { type: 'input', name: 'categoryName', message: 'Enter the name of the service category (e.g., "Healthcare"):' }
      ]);

      const services = [];
      let addAnotherService = true;
      while (addAnotherService) {
        const { serviceName } = await inquirer.prompt([
          { type: 'input', name: 'serviceName', message: `Enter a service for "${categoryName}" (or press Enter to finish):` }
        ]);
        if (serviceName) {
          services.push(serviceName);
        } else {
          addAnotherService = false;
        }
      }
      hierarchy.push({ category: categoryName, services });

      const { continueCategory } = await inquirer.prompt([
        { type: 'confirm', name: 'continueCategory', message: 'Do you want to add another category?', default: true }
      ]);
      addAnotherCategory = continueCategory;
    }
    return hierarchy;
  }

  /**
   * Displays the planned insertions and asks for user confirmation.
   */
  async getConfirmation(data) {
    await this.#loadInquirer();
    console.log('\n--- Review Proposed Hierarchy ---');
    data.forEach((cat, catIndex) => {
      console.log(`\nCategory ${catIndex + 1}: ${cat.category}`);
      if (cat.services.length > 0) {
        cat.services.forEach((svc, svcIndex) => {
          console.log(`  - Service ${svcIndex + 1}: ${svc}`);
        });
      } else {
        console.log('  (No services defined for this category)');
      }
    });
    console.log('\nThis script will write the above structure to the database.');

    // const { confirm } = await inquirer.prompt([
    //   { type: 'confirm', name: 'confirm', message: 'Proceed with writing to the database?', default: false }
    // ]);
    const confirm = true;
    return confirm;
  }

  /**
   * Writes the hierarchy data to the ArangoDB database using individual save operations.
   */
  async writeToDatabase(data) {
    console.log('\nAttempting to write data to the database...');
    let result = {
      inserted: { categories: 0, services: 0, edges: 0 },
      skipped: { categories: 0, services: 0 },
      errors: []
    };

    try {
      // Determine starting keys and orders by querying the database
      const lastCatCursor = await this.db.query(aql`
        FOR doc IN ${this.serviceCategories}
        SORT doc.order DESC
        LIMIT 1
        RETURN doc
      `);
      const lastCategory = await lastCatCursor.next();

      const lastSvcCursor = await this.db.query(aql`
        FOR doc IN ${this.services}
        SORT TO_NUMBER(doc._key) DESC
        LIMIT 1
        RETURN doc
      `);
      const lastService = await lastSvcCursor.next();

      let categoryOrder = lastCategory ? lastCategory.order + 1 : 1;
      let categoryKey = lastCategory ? parseInt(lastCategory._key) + 1 : 1;
      let serviceKey = lastService ? parseInt(lastService._key) + 1 : 101;

      for (const catData of data) {
        // Check if category already exists
        const existingCatCursor = await this.db.query(aql`
          FOR doc IN ${this.serviceCategories}
          FILTER doc.nameEN == ${catData.category}
          LIMIT 1
          RETURN doc
        `);
        let existingCategory = await existingCatCursor.next();
        let currentCategoryKey;

        if (existingCategory) {
          result.skipped.categories++;
          currentCategoryKey = existingCategory._key;
          console.log(`- Skipping existing category: "${catData.category}"`);
        } else {
          const categoryDoc = {
            _key: String(categoryKey),
            nameEN: catData.category,
            order: categoryOrder
          };

          // --- DEBUGGING ---
          console.log('\n[DEBUG] Attempting to save to serviceCategories with document:');
          console.log(JSON.stringify(categoryDoc, null, 2));
          // --- END DEBUGGING ---

          await this.serviceCategories.save(categoryDoc);
          currentCategoryKey = categoryDoc._key;
          result.inserted.categories++;
          console.log(`✓ Inserted category: "${categoryDoc.nameEN}" (Key: ${currentCategoryKey})`);
          categoryKey++;
          categoryOrder++;
        }

        let serviceOrder = 1;
        for (const serviceName of catData.services) {
          // Check if service already exists for this category
          const existingSvcCursor = await this.db.query(aql`
            FOR doc IN ${this.services}
            FILTER doc.nameEN == ${serviceName} AND doc.categoryId == ${currentCategoryKey}
            LIMIT 1
            RETURN doc
          `);
          const existingService = await existingSvcCursor.next();

          if (existingService) {
            result.skipped.services++;
            console.log(`  - Skipping existing service: "${serviceName}"`);
          } else {
            const serviceDoc = {
              _key: String(serviceKey),
              categoryId: currentCategoryKey,
              nameEN: serviceName,
              order: serviceOrder
            };

            // --- DEBUGGING ---
            console.log('\n[DEBUG] Attempting to save to services with document:');
            console.log(JSON.stringify(serviceDoc, null, 2));
            // --- END DEBUGGING ---

            const newServiceMeta = await this.services.save(serviceDoc);
            result.inserted.services++;
            console.log(`  ✓ Inserted service: "${serviceDoc.nameEN}" (Key: ${serviceDoc._key})`);

            // Create edge
            const edgeDoc = {
              _from: this.serviceCategories.name + '/' + currentCategoryKey,
              _to: newServiceMeta._id
            };

            // --- DEBUGGING ---
            console.log('\n[DEBUG] Attempting to save to categoryServices with document:');
            console.log(JSON.stringify(edgeDoc, null, 2));
            // --- END DEBUGGING ---

            await this.categoryServices.save(edgeDoc);
            result.inserted.edges++;
            console.log(`    ✓ Created edge from category ${currentCategoryKey} to service ${serviceDoc._key}`);

            serviceKey++;
            serviceOrder++;
          }
        }
      }

      console.log('\n--- Database Write Summary ---');
      console.log(`✓ Categories inserted: ${result.inserted.categories}`);
      console.log(`✓ Services inserted:   ${result.inserted.services}`);
      console.log(`✓ Edges created:       ${result.inserted.edges}`);
      console.log(`- Categories skipped (already exist): ${result.skipped.categories}`);
      console.log(`- Services skipped (already exist):   ${result.skipped.services}`);
      if (result.errors.length > 0) {
        console.error('✗ Errors encountered:', result.errors);
      }
      console.log('\n✓ Hierarchy creation completed successfully.');

    } catch (error) {
      console.error('\n✗ An error occurred during the database write operation:', error.message);
      throw error;
    }
  }

  /**
   * Main method to run the hierarchy creation process.
   */
  async run() {
    const argv = yargs(hideBin(process.argv)).option('file', {
      alias: 'f',
      type: 'string',
      description: 'Path to a JSON file with the hierarchy definition'
    }).argv;

    try {
      await this.ensureCollections();

      let hierarchyData;
      if (argv.file) {
        hierarchyData = await this.processFromFile(argv.file);
      } else {
        hierarchyData = await this.processInteractively();
      }

      if (!hierarchyData || hierarchyData.length === 0) {
        console.log('No hierarchy data provided. Exiting.');
        return;
      }

      const isConfirmed = await this.getConfirmation(hierarchyData);

      if (isConfirmed) {
        await this.writeToDatabase(hierarchyData);
      } else {
        console.log('Operation cancelled by user.');
      }
    } catch (error) {
      console.error(`\n${error.message}`);
      process.exit(1);
    }
  }
}

async function main() {
  // Read configuration from environment variables, with defaults
  const dbConfig = {
    url: process.env.ARANGO_URL || "http://localhost:8529",
    databaseName: process.env.ARANGO_DATABASE || "test-temp",
    auth: {
      username: process.env.ARANGO_USER || "root",
      password: process.env.ARANGO_PASSWORD || "test"
    }
  };

  // --- Confirmation Prompt ---
  console.log('--- Knowledge Hierarchy Creation Script ---');
  console.log('This script will create service categories and services in the database.');
  console.log('\nDatabase configuration to be used:');
  console.log(`  URL:      ${dbConfig.url}`);
  console.log(`  Database: ${dbConfig.databaseName}`);
  console.log(`  User:     ${dbConfig.auth.username}`);

  // const answer = await askQuestion('\nAre you sure you want to proceed with these settings? (Y/n) ');
  const answer = 'Y';

  if (answer.toLowerCase() !== 'y') {
    console.log('Operation cancelled by user. Exiting.');
    process.exit(0);
  }
  // --- End Confirmation Prompt ---

  try {
    const creator = new HierarchyCreator(dbConfig);
    await creator.run();
    process.exit(0);
  } catch (error) {
    console.error('✗ Failed to initialize HierarchyCreator:', error.message);
    process.exit(1);
  }
}

main();