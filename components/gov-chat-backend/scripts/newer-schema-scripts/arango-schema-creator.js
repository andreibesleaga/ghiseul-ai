#!/usr/bin/env node

const { Database } = require('arangojs');
const fs = require('fs').promises;
const readline = require('readline');

// Redirect all console output to both console and log file
let logBuffer = [];

function logToFile(message) {
  logBuffer.push(`${new Date().toISOString()}: ${message}`);
}

// Override console methods to capture all output
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function (...args) {
  const message = args.join(' ');
  originalLog(...args);
  logToFile(`LOG: ${message}`);
};

console.error = function (...args) {
  const message = args.join(' ');
  originalError(...args);
  logToFile(`ERROR: ${message}`);
};

console.warn = function (...args) {
  const message = args.join(' ');
  originalWarn(...args);
  logToFile(`WARN: ${message}`);
};

class ArangoSchemaCreator {
  constructor(config) {
    this.databaseName = config.database; // Store for logging
    this.db = new Database({
      url: config.url,
      databaseName: this.databaseName,
      auth: config.auth
    });
  }

  async saveFullLog(outputPath) {
    await fs.writeFile(outputPath, logBuffer.join('\n'), 'utf8');
    originalLog(`Complete log saved to: ${outputPath}`);
  }

  convertSchemaFormat(schema) {
    // This function recursively cleans the schema rule to remove non-standard properties like "optional".
    function processProperties(properties) {
      if (!properties || typeof properties !== 'object') return properties;

      const newProperties = {};

      for (const [key, value] of Object.entries(properties)) {
        const newValue = { ...value };

        // Remove non-standard properties used for our custom format
        delete newValue.optional;
        delete newValue.default;

        // Recurse into nested objects
        if (newValue.type === 'object' && newValue.properties) {
          newValue.properties = processProperties(newValue.properties);
        }

        // Recurse into array items if they are objects
        if (newValue.type === 'array' && newValue.items && newValue.items.type === 'object' && newValue.items.properties) {
          newValue.items.properties = processProperties(newValue.items.properties);
        }

        newProperties[key] = newValue;
      }

      return newProperties;
    }

    // Deep clone the original schema rule to avoid modifying it
    const result = JSON.parse(JSON.stringify(schema));

    // Process properties to clean them up, but leave the 'required' array as is.
    if (result.properties) {
      result.properties = processProperties(result.properties);
    }

    return result;
  }

  async loadSchema(schemaPath) {
    const schemaContent = await fs.readFile(schemaPath, 'utf8');
    return JSON.parse(schemaContent);
  }

  async createSchema(schema) {
    console.log(`Creating schema for database: ${this.databaseName}`);

    try {
      await this.createCollections(schema.collections);
      await this.createIndexes(schema.collections);
      await this.createGraphs(schema.graphs);
      await this.createViews(schema.views);
      await this.createAnalyzers(schema.analyzers);
      await this.createFunctions(schema.functions);

      console.log('Schema creation completed successfully');
      await this.saveFullLog('./schema-creation-complete-log.txt');
    } catch (error) {
      console.error(`Error during schema creation: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
      await this.saveFullLog('./schema-creation-complete-log.txt');
      throw error;
    }
  }

  async createCollections(collections) {
    console.log('Creating collections...');

    for (const collectionSchema of collections) {
      try {
        const collection = this.db.collection(collectionSchema.name);

        const options = {
          type: collectionSchema.type === 'edge' ? 3 : 2,
          waitForSync: collectionSchema.properties.waitForSync,
          keyOptions: collectionSchema.properties.keyOptions
        };

        // Add cluster options if available
        if (collectionSchema.properties.shardKeys) {
          options.shardKeys = collectionSchema.properties.shardKeys;
          options.numberOfShards = collectionSchema.properties.numberOfShards;
          options.shardingStrategy = collectionSchema.properties.shardingStrategy;
          options.distributeShardsLike = collectionSchema.properties.distributeShardsLike;
          options.replicationFactor = collectionSchema.properties.replicationFactor;
          options.minReplicationFactor = collectionSchema.properties.minReplicationFactor;
        }

        // Add computed values if available
        if (collectionSchema.properties.computedValues && collectionSchema.properties.computedValues.length > 0) {
          options.computedValues = collectionSchema.properties.computedValues;
        }

        // Add schema validation if available
        if (collectionSchema.properties.schema && collectionSchema.properties.schema.rule) {
          try {
            console.log(`  Processing schema for ${collectionSchema.name}`);

            // Convert schema format to ArangoDB format
            const convertedSchemaRule = this.convertSchemaFormat(collectionSchema.properties.schema.rule);
            console.log(`  Converted schema rule:`, JSON.stringify(convertedSchemaRule, null, 2));

            options.schema = {
              rule: convertedSchemaRule,
              level: collectionSchema.properties.schema.level || "none",
              message: collectionSchema.properties.schema.message || "Document does not match schema"
            };

            console.log(`  Adding schema validation to ${collectionSchema.name}`);
          } catch (schemaError) {
            console.error(`  Schema conversion failed for ${collectionSchema.name}: ${schemaError.message}`);
            console.log(`  Creating collection without schema validation`);
          }
        } else {
          console.log(`  No schema validation for ${collectionSchema.name}`);
        }

        await collection.create(options);
        console.log(`Created collection: ${collectionSchema.name}`);
      } catch (error) {
        if (error.errorNum === 1207 || error.code === 409) { // Collection already exists
          console.log(`Collection already exists: ${collectionSchema.name}`);
        } else {
          console.error(`Error creating collection ${collectionSchema.name}: ${error.message}`);
          console.error(`Error details:`, JSON.stringify(error, null, 2));
          throw error;
        }
      }
    }
  }

  async createIndexes(collections) {
    console.log('Creating indexes...');

    for (const collectionSchema of collections) {
      const collection = this.db.collection(collectionSchema.name);

      for (const indexSchema of collectionSchema.indexes) {
        // Skip creating edge indexes as ArangoDB manages them automatically
        if (indexSchema.type === 'edge') {
          console.log(`Skipping managed edge index on ${collectionSchema.name}`);
          continue;
        }

        try {
          const indexOptions = {
            type: indexSchema.type,
            fields: indexSchema.fields,
            unique: indexSchema.unique,
            sparse: indexSchema.sparse,
            deduplicate: indexSchema.deduplicate
          };

          // Add type-specific options
          if (indexSchema.name) indexOptions.name = indexSchema.name;
          if (indexSchema.selectivityEstimate !== undefined) indexOptions.selectivityEstimate = indexSchema.selectivityEstimate;
          if (indexSchema.estimates !== undefined) indexOptions.estimates = indexSchema.estimates;
          if (indexSchema.minLength !== undefined) indexOptions.minLength = indexSchema.minLength;
          if (indexSchema.geoJson !== undefined) indexOptions.geoJson = indexSchema.geoJson;
          if (indexSchema.constraint !== undefined) indexOptions.constraint = indexSchema.constraint;
          if (indexSchema.expireAfter !== undefined) indexOptions.expireAfter = indexSchema.expireAfter;
          if (indexSchema.cacheEnabled !== undefined) indexOptions.cacheEnabled = indexSchema.cacheEnabled;
          if (indexSchema.storedValues && indexSchema.storedValues.length > 0) indexOptions.storedValues = indexSchema.storedValues;
          if (indexSchema.inBackground !== undefined) indexOptions.inBackground = indexSchema.inBackground;

          await collection.ensureIndex(indexOptions);
          console.log(`Created index on ${collectionSchema.name}: ${indexSchema.fields.join(', ')}`);
        } catch (error) {
          console.error(`Error creating index on ${collectionSchema.name}: ${error.message}`);
        }
      }
    }
  }

  async createGraphs(graphs) {
    console.log('Creating graphs...');
    if (!graphs || !Array.isArray(graphs)) return;

    for (const graphSchema of graphs) {
      try {
        const graph = this.db.graph(graphSchema.name);
        const edgeDefs = Array.isArray(graphSchema.edgeDefinitions) ? graphSchema.edgeDefinitions : [];
        const orphanColls = Array.isArray(graphSchema.orphanCollections) ? graphSchema.orphanCollections : [];

        const graphOptions = {};
        if (graphSchema.isSmart) {
          graphOptions.isSmart = true;
          if (graphSchema.options) {
            graphOptions.options = graphSchema.options;
          }
        }

        await graph.create({ edgeDefinitions: edgeDefs, orphanCollections: orphanColls, ...graphOptions });
        console.log(`Created graph: ${graphSchema.name}`);
      } catch (error) {
        if (error.code === 1925) { // Graph already exists
          console.log(`Graph already exists: ${graphSchema.name}`);
        } else {
          console.error(`Error creating graph ${graphSchema.name}:`, error.message);
        }
      }
    }
  }

  async createViews(views) {
    console.log('Creating views...');
    if (!views || !Array.isArray(views)) return;

    for (const viewSchema of views) {
      try {
        const view = this.db.view(viewSchema.name);
        await view.create(viewSchema.properties, viewSchema.type);
        console.log(`Created view: ${viewSchema.name}`);
      } catch (error) {
        if (error.code === 1207) { // View already exists
          console.log(`View already exists: ${viewSchema.name}`);
        } else {
          console.error(`Error creating view ${viewSchema.name}:`, error);
        }
      }
    }
  }

  async createAnalyzers(analyzers) {
    console.log('Creating analyzers...');
    if (!analyzers || !Array.isArray(analyzers)) return;

    for (const analyzerSchema of analyzers) {
      try {
        await this.db.request({
          method: 'POST',
          path: '/_api/analyzer',
          body: {
            name: analyzerSchema.name,
            type: analyzerSchema.type,
            properties: analyzerSchema.properties,
            features: analyzerSchema.features
          }
        });
        console.log(`Created analyzer: ${analyzerSchema.name}`);
      } catch (error) {
        if (error.code === 1650) { // Analyzer already exists
          console.log(`Analyzer already exists: ${analyzerSchema.name}`);
        } else {
          console.error(`Error creating analyzer ${analyzerSchema.name}:`, error);
        }
      }
    }
  }

  async createFunctions(functions) {
    console.log('Creating AQL functions...');
    if (!functions || !Array.isArray(functions)) return;

    for (const functionSchema of functions) {
      try {
        await this.db.request({
          method: 'POST',
          path: '/_api/aqlfunction',
          body: {
            name: functionSchema.name,
            code: functionSchema.code,
            isDeterministic: functionSchema.isDeterministic
          }
        });
        console.log(`Created function: ${functionSchema.name}`);
      } catch (error) {
        if (error.code === 1582) { // Function already exists
          console.log(`Function already exists: ${functionSchema.name}`);
        } else {
          console.error(`Error creating function ${functionSchema.name}:`, error);
        }
      }
    }
  }
}

/**
 * Helper function to ask a question in the console.
 * @param {string} query The question to ask the user.
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

// Main execution block
async function main() {
  const schemaPath = process.argv[2] || './arango-schema.json';

  // Read configuration from environment variables, with defaults
  const config = {
    url: process.env.ARANGO_URL || 'http://127.0.0.1:8529',
    database: process.env.ARANGO_DATABASE || 'node-services',
    auth: {
      username: process.env.ARANGO_USER || 'root',
      password: process.env.ARANGO_PASSWORD || 'your-database-password'
    }
  };

  // --- Confirmation Prompt ---
  console.log('--- Database Schema Creator ---');
  console.log('This script will apply a schema to an ArangoDB database.');
  console.log('\nDatabase configuration to be used:');
  console.log(`  URL:      ${config.url}`);
  console.log(`  Database: ${config.database}`);
  console.log(`  User:     ${config.auth.username}`);

  const answer = await askQuestion('\nAre you sure you want to proceed with these settings? (Y/n) ');

  if (answer.toLowerCase() !== 'y') {
    console.log('Operation cancelled by user. Exiting.');
    process.exit(0);
  }
  // --- End Confirmation Prompt ---

  const creator = new ArangoSchemaCreator(config);

  try {
    const schema = await creator.loadSchema(schemaPath);
    await creator.createSchema(schema);

    console.log('\nSchema creation completed!');

  } catch (error) {
    console.error('Schema creation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ArangoSchemaCreator;

