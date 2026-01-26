/**
 * create-translations.js
 * * This script creates translations for service categories and services in an ArangoDB database,
 * inserting them into the `serviceCategoryTranslations` and `serviceTranslations` collections,
 * along with edges in `serviceCategoryTranslationsEdge` and `serviceTranslationsEdge`.
 * It uses the Google Cloud Translate API to translate English (`nameEN`) fields from the
 * `serviceCategories` and `services` collections into the specified target language.
 * Translations and edges are only created if they do not already exist for the target language.
 * * Authentication:
 * - Uses a Google Cloud service account for server-to-server authentication with the
 * Google Cloud Translate API.
 * - Credentials are loaded from a JSON file (default: `google-credentials.json`), which
 * must be a Google Cloud service account key JSON with an added `apiKey` field.
 * - Do NOT use an OAuth 2.0 Client ID or client secret, as they are for user-based flows.
 * * Usage:
 * node create-translations.js <lang>
 * * Parameters:
 * - lang: Target language code (e.g., EN, FR, SW, ID, en, fr, sw, id). Case-insensitive.
 * Cannot be EN (English is the source language).
 * * Configuration File:
 * - File: `google-credentials.json` (override with GOOGLE_CREDENTIALS_PATH env variable)
 * - Format: Standard Google Cloud service account key JSON with an added `apiKey` field:
 * {
 * "type": "service_account",
 * "project_id": "your-project-id",
 * "private_key_id": "...",
 * "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
 * "client_email": "your-service-account@your-project-id.iam.gserviceaccount.com",
 * "client_id": "...",
 * "auth_uri": "...",
 * "token_uri": "...",
 * "auth_provider_x509_cert_url": "...",
 * "client_x509_cert_url": "...",
 * "universe_domain": "googleapis.com",
 * "apiKey": "your-api-key"
 * }
 * - Obtain credentials:
 * 1. Go to Google Cloud Console > IAM & Admin > Service Accounts.
 * 2. Create a service account with the 'Cloud Translation API User' role (roles/cloudtranslate.user).
 * 3. Download the JSON key file.
 * 4. Add the `apiKey` field by creating an API key in APIs & Services > Credentials > Create Credentials > API Key.
 * 5. Enable the Cloud Translation API in APIs & Services > Library.
 * * Environment Variables (in .env file):
 * - ARANGO_URL: ArangoDB URL (default: http://localhost:8529)
 * - ARANGO_DATABASE: Database name (default: genie)
 * - ARANGO_USERNAME: ArangoDB username (default: root)
 * - ARANGO_PASSWORD: ArangoDB password (default: test)
 * - GOOGLE_CREDENTIALS_PATH: Path to Google credentials JSON (default: ./google-credentials.json)
 * * Prerequisites:
 * - Install dependencies: `npm install arangojs dotenv @google-cloud/translate`
 * - Ensure ArangoDB collections exist: `serviceCategories`, `services`
 * - The script will create `serviceCategoryTranslations`, `serviceTranslations`,
 * `serviceCategoryTranslationsEdge`, and `serviceTranslationsEdge` if they don’t exist
 * - Create `google-credentials.json` with valid service account credentials and API key
 * * Example:
 * node create-translations.js ID
 * * Output:
 * - Logs creation of translations and edges
 * - Skips existing translations
 * - Exits with status 0 on success, 1 on failure
 * * Notes:
 * - Assumes `nameEN` fields in `serviceCategories` and `services` are the source texts.
 * - Translation keys are formatted as `${categoryKey}_${lang}` and `${serviceKey}_${lang}`.
 * - Edges link translations to their respective categories/services.
 * - Handles Google Translate API errors with a fallback placeholder translation.
 * - Schema aligns with import-service-categories.js, using `serviceCategoryId`, `languageCode`, and `translation`.
 * - Date/time: Script uses current date/time (e.g., 2025-06-28 21:44 WIB).
 */

const { Database, aql } = require('arangojs');
const { Translate } = require('@google-cloud/translate').v2;
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

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

class TranslationCreator {
  constructor(dbConfig) {
    // Load Google Cloud credentials from JSON file
    const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || './google-credentials.json';
    let credentials;
    try {
      const credentialsRaw = fs.readFileSync(path.resolve(credentialsPath), 'utf8');
      credentials = JSON.parse(credentialsRaw);
    } catch (error) {
      throw new Error(`Failed to read Google credentials from ${credentialsPath}: ${error.message}`);
    }

    // Map service account fields to expected names
    const projectId = credentials.project_id;
    const clientEmail = credentials.client_email;
    const privateKey = credentials.private_key;
    const apiKey = credentials.apiKey;

    if (!projectId || !clientEmail || !privateKey || !apiKey) {
      throw new Error('Google credentials JSON must contain project_id, client_email, private_key, and apiKey');
    }

    this.translate = new Translate({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey
      },
      key: apiKey
    });

    // Initialize ArangoDB connection
    this.db = new Database(dbConfig);
  }

  /**
   * Ensure required collections exist, creating them if necessary
   */
  async ensureCollections() {
    try {
      console.log('Validating and creating collections if necessary...');

      // Document collections
      this.serviceCategories = this.db.collection('serviceCategories');
      this.services = this.db.collection('services');
      this.categoryTranslations = this.db.collection('serviceCategoryTranslations');
      this.serviceTranslations = this.db.collection('serviceTranslations');

      // Edge collections
      this.categoryTranslationsEdge = this.db.collection('serviceCategoryTranslationsEdge');
      this.serviceTranslationsEdge = this.db.collection('serviceTranslationsEdge');

      // Check existence and create if needed
      const collections = [
        { name: 'serviceCategories', type: 2, instance: this.serviceCategories },
        { name: 'services', type: 2, instance: this.services },
        { name: 'serviceCategoryTranslations', type: 2, instance: this.categoryTranslations },
        { name: 'serviceTranslations', type: 2, instance: this.serviceTranslations },
        { name: 'serviceCategoryTranslationsEdge', type: 3, instance: this.categoryTranslationsEdge },
        { name: 'serviceTranslationsEdge', type: 3, instance: this.serviceTranslationsEdge }
      ];

      for (const { name, type, instance } of collections) {
        const exists = await instance.exists();
        if (!exists) {
          console.log(`Creating ${name} collection...`);
          await this.db.createCollection(name, {
            type, // 2 for document, 3 for edge
            waitForSync: false,
            keyOptions: {}
          });
          console.log(`✓ ${name} collection created`);
        } else {
          console.log(`✓ ${name} collection already exists`);
        }
      }

      // Add indexes for serviceCategoryTranslations and serviceTranslations
      if (!(await this.categoryTranslations.indexes()).some(idx => idx.name === 'idx_category_language')) {
        await this.categoryTranslations.ensureIndex({
          type: 'hash',
          fields: ['serviceCategoryId', 'languageCode'],
          unique: true,
          name: 'idx_category_language'
        });
        console.log('✓ Created index idx_category_language on serviceCategoryTranslations');
      }

      if (!(await this.serviceTranslations.indexes()).some(idx => idx.name === 'idx_service_language')) {
        await this.serviceTranslations.ensureIndex({
          type: 'hash',
          fields: ['serviceId', 'languageCode'],
          unique: true,
          name: 'idx_service_language'
        });
        console.log('✓ Created index idx_service_language on serviceTranslations');
      }
    } catch (error) {
      console.error('Error ensuring collections:', error.message);
      throw error;
    }
  }

  /**
   * Validate language code
   * @param {string} lang - Language code
   * @returns {string} - Uppercase language code
   */
  validateLanguage(lang) {
    const validLang = lang.toUpperCase();
    if (!validLang || typeof validLang !== 'string' || validLang.trim() === '') {
      throw new Error('Language code must be a non-empty string');
    }
    if (validLang === 'EN') {
      throw new Error('Cannot create translations for EN; English is the source language');
    }
    return validLang;
  }

  /**
   * Generate translation using Google Translate API
   * @param {string} text - Original English text
   * @param {string} lang - Target language code
   * @returns {string} - Translated text
   */
  async generateTranslation(text, lang) {
    try {
      const [translation] = await this.translate.translate(text, {
        from: 'en',
        to: lang.toLowerCase()
      });
      return translation;
    } catch (error) {
      console.error(`Translation failed for "${text}" to ${lang}:`, error.message);
      // Fallback to placeholder
      return `${text} (${lang})`;
    }
  }

  /**
   * Create translations and edges for service categories
   * @param {string} lang - Language code
   */
  async createCategoryTranslations(lang) {
    try {
      console.log(`\nCreating category translations for ${lang}...`);

      // Fetch existing English categories
      const categories = await this.db.query(aql`
        FOR cat IN ${this.serviceCategories}
          FILTER cat.nameEN != null
          RETURN { _key: cat._key, nameEN: cat.nameEN }
      `).then(cursor => cursor.all());

      // Fetch existing translations for the language
      const existingTranslations = await this.db.query(aql`
        FOR trans IN ${this.categoryTranslations}
          FILTER trans.languageCode == ${lang}
          RETURN trans.serviceCategoryId
      `).then(cursor => cursor.all());

      let inserted = 0;
      for (const category of categories) {
        if (existingTranslations.includes(category._key)) {
          console.log(`- Skipping category "${category.nameEN}": translation for ${lang} already exists.`);
          continue;
        }

        const translatedName = await this.generateTranslation(category.nameEN, lang);
        const translation = {
          _key: `${category._key}_${lang}`,
          serviceCategoryId: category._key,
          languageCode: lang,
          translation: translatedName,
          isActive: true,
          createdAt: new Date().toISOString()
        };

        // Insert translation
        await this.categoryTranslations.save(translation);
        console.log(`  ✓ Translated category "${category.nameEN}" to "${translatedName}"`);

        // Create edge
        await this.categoryTranslationsEdge.save({
          _from: `serviceCategories/${category._key}`,
          _to: `serviceCategoryTranslations/${translation._key}`,
          createdAt: new Date().toISOString()
        });
        inserted++;
      }

      console.log(`\n✓ Inserted ${inserted} new category translations and edges for ${lang}.`);
    } catch (error) {
      console.error(`✗ Error creating category translations for ${lang}:`, error.message);
      throw error;
    }
  }

  /**
   * Create translations and edges for services
   * @param {string} lang - Language code
   */
  async createServiceTranslations(lang) {
    try {
      console.log(`\nCreating service translations for ${lang}...`);

      // Fetch existing English services
      const services = await this.db.query(aql`
        FOR srv IN ${this.services}
          FILTER srv.nameEN != null
          RETURN { _key: srv._key, nameEN: srv.nameEN }
      `).then(cursor => cursor.all());

      // Fetch existing translations for the language
      const existingTranslations = await this.db.query(aql`
        FOR trans IN ${this.serviceTranslations}
          FILTER trans.languageCode == ${lang}
          RETURN trans.serviceId
      `).then(cursor => cursor.all());

      let inserted = 0;
      for (const service of services) {
        if (existingTranslations.includes(service._key)) {
          console.log(`- Skipping service "${service.nameEN}": translation for ${lang} already exists.`);
          continue;
        }

        const translatedName = await this.generateTranslation(service.nameEN, lang);
        const translation = {
          _key: `${service._key}_${lang}`,
          serviceId: service._key,
          languageCode: lang,
          translation: translatedName,
          isActive: true,
          createdAt: new Date().toISOString()
        };

        // Insert translation
        await this.serviceTranslations.save(translation);
        console.log(`  ✓ Translated service "${service.nameEN}" to "${translatedName}"`);

        // Create edge
        await this.serviceTranslationsEdge.save({
          _from: `services/${service._key}`,
          _to: `serviceTranslations/${translation._key}`,
          createdAt: new Date().toISOString()
        });
        inserted++;
      }

      console.log(`\n✓ Inserted ${inserted} new service translations and edges for ${lang}.`);
    } catch (error) {
      console.error(`✗ Error creating service translations for ${lang}:`, error.message);
      throw error;
    }
  }

  /**
   * Main method to run translation creation
   * @param {string} lang - Language code
   */
  async run(lang) {
    try {
      const validLang = this.validateLanguage(lang);
      await this.ensureCollections();
      await this.createCategoryTranslations(validLang);
      await this.createServiceTranslations(validLang);
      console.log(`\n✓ Translation creation completed for ${validLang}.`);
    } catch (error) {
      console.error('✗ Translation creation failed:', error.message);
      process.exit(1);
    }
  }
}

async function main() {
  const lang = process.argv[2];
  if (!lang) {
    console.error('Usage: node create-translations.js <lang>');
    console.error('Example: node create-translations.js ID');
    process.exit(1);
  }

    // Read configuration from environment variables, with defaults
    const dbConfig = {
        url: process.env.ARANGO_URL || "http://localhost:8529",
        databaseName: process.env.ARANGO_DATABASE || "node-services",
        auth: {
            username: process.env.ARANGO_USER || "root",
            password: process.env.ARANGO_PASSWORD || "test"
        }
    };

    // --- Confirmation Prompt ---
    console.log('--- Database Translation Creation Script ---');
    console.log(`This script will translate categories and services into '${lang.toUpperCase()}'.`);
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

  try {
    const creator = new TranslationCreator(dbConfig);
    await creator.run(lang);
    process.exit(0);
  } catch (error) {
    console.error('✗ Failed to initialize TranslationCreator:', error.message);
    process.exit(1);
  }
}

main();