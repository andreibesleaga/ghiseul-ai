#!/usr/bin/env node

const { Database } = require('arangojs');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

class ArangoSchemaExtractor {
  constructor(config) {
    this.db = new Database({
      url: config.url,
      databaseName: config.database,
      auth: config.auth
    });
    this.schema = {
      database: config.database,
      collections: [],
      graphs: [],
      views: [],
      analyzers: [],
      functions: []
    };
  }

  async extractSchema() {
    console.log('Starting schema extraction...');
    
    try {
      await this.extractCollections();
      await this.extractGraphs();
      await this.extractViews();
      await this.extractAnalyzers();
      await this.extractFunctions();
      
      console.log('Schema extraction completed successfully');
      return this.schema;
    } catch (error) {
      console.error('Error during schema extraction:', error);
      throw error;
    }
  }

  async extractCollections() {
    console.log('Extracting collections...');
    
    const collections = await this.db.collections();
    
    for (const collection of collections) {
      if (collection.name.startsWith('_')) {
        continue; // Skip system collections
      }

      try {
        // Get basic collection info and indexes
        const collectionInfo = await collection.get();
        const indexes = await collection.indexes();
        
        // Try to get schema validation using AQL query to system collections
        let schemaInfo = null;
        
        try {
          // Query the _collections system collection for schema information
          const schemaQuery = `
            FOR c IN _collections
            FILTER c.name == @collectionName
            RETURN c.schema
          `;
          
          const cursor = await this.db.query(schemaQuery, { collectionName: collection.name });
          const results = await cursor.all();
          
          if (results.length > 0 && results[0]) {
            schemaInfo = results[0];
          }
        } catch (schemaQueryError) {
          console.log(`Schema query failed for ${collection.name}: ${schemaQueryError.message}`);
        }
        
        // If still no schema, try alternative system collection query
        if (!schemaInfo) {
          try {
            const altQuery = `
              FOR doc IN @@collection
              LIMIT 1
              RETURN ATTRIBUTES(doc)
            `;
            
            // This won't get the schema but will help us understand the collection structure
            const cursor = await this.db.query(altQuery, { '@collection': collection.name });
            const results = await cursor.all();
            console.log(`Collection ${collection.name} has fields:`, results[0] || 'empty collection');
          } catch (altQueryError) {
            console.log(`Alt query failed for ${collection.name}: ${altQueryError.message}`);
          }
        }
        
        // Try using collection properties via arangojs methods
        if (!schemaInfo) {
          try {
            const properties = await collection.properties();
            if (properties.schema) {
              schemaInfo = properties.schema;
            }
          } catch (propsError) {
            console.log(`Properties method failed for ${collection.name}: ${propsError.message}`);
          }
        }
        
        console.log(`\nProcessing collection: ${collection.name}`);
        console.log(`Schema validation found:`, !!schemaInfo);
        if (schemaInfo) {
          console.log(`Schema content:`, JSON.stringify(schemaInfo, null, 2));
        } else {
          console.log(`No schema validation rules found for ${collection.name}`);
        }
        
        const collectionSchema = {
          name: collection.name,
          type: collectionInfo.type === 2 ? 'document' : 'edge',
          properties: {
            waitForSync: collectionInfo.waitForSync || false,
            keyOptions: collectionInfo.keyOptions || {},
            schema: schemaInfo,
            computedValues: collectionInfo.computedValues || []
          },
          indexes: indexes
            .filter(idx => idx.type !== 'primary')
            .map(idx => ({
              type: idx.type,
              fields: idx.fields,
              unique: idx.unique || false,
              sparse: idx.sparse || false,
              deduplicate: idx.deduplicate || false,
              name: idx.name,
              selectivityEstimate: idx.selectivityEstimate,
              estimates: idx.estimates || false,
              minLength: idx.minLength,
              geoJson: idx.geoJson || false,
              constraint: idx.constraint || false,
              expireAfter: idx.expireAfter,
              cacheEnabled: idx.cacheEnabled || false,
              storedValues: idx.storedValues || [],
              inBackground: idx.inBackground || false
            }))
        };

        // Add sharding information if available (cluster setup)  
        if (collectionInfo.shardKeys) {
          collectionSchema.properties.shardKeys = collectionInfo.shardKeys;
          collectionSchema.properties.numberOfShards = collectionInfo.numberOfShards;
          collectionSchema.properties.shardingStrategy = collectionInfo.shardingStrategy;
          collectionSchema.properties.distributeShardsLike = collectionInfo.distributeShardsLike;
          collectionSchema.properties.replicationFactor = collectionInfo.replicationFactor;
          collectionSchema.properties.minReplicationFactor = collectionInfo.minReplicationFactor;
        }

        this.schema.collections.push(collectionSchema);
        
      } catch (error) {
        console.error(`Error processing collection ${collection.name}:`, error.message);
        // Fallback to basic collection info
        const fallbackInfo = await collection.get();
        const indexes = await collection.indexes();
        
        const collectionSchema = {
          name: collection.name,
          type: fallbackInfo.type === 2 ? 'document' : 'edge',
          properties: {
            waitForSync: fallbackInfo.waitForSync || false,
            keyOptions: fallbackInfo.keyOptions || {},
            schema: null,
            computedValues: []
          },
          indexes: indexes
            .filter(idx => idx.type !== 'primary')
            .map(idx => ({
              type: idx.type,
              fields: idx.fields,
              unique: idx.unique || false,
              sparse: idx.sparse || false,
              deduplicate: idx.deduplicate || false,
              name: idx.name,
              selectivityEstimate: idx.selectivityEstimate,
              estimates: idx.estimates || false,
              minLength: idx.minLength,
              geoJson: idx.geoJson || false,
              constraint: idx.constraint || false,
              expireAfter: idx.expireAfter,
              cacheEnabled: idx.cacheEnabled || false,
              storedValues: idx.storedValues || [],
              inBackground: idx.inBackground || false
            }))
        };
        
        this.schema.collections.push(collectionSchema);
      }
    }
    
    console.log(`Extracted ${this.schema.collections.length} collections`);
    
    // Log schema validation info
    const collectionsWithSchema = this.schema.collections.filter(c => c.properties.schema);
    if (collectionsWithSchema.length > 0) {
      console.log(`Found ${collectionsWithSchema.length} collections with schema validation:`);
      collectionsWithSchema.forEach(c => console.log(`  - ${c.name}`));
    }
  }

  async extractGraphs() {
    console.log('Extracting graphs...');
    
    try {
      const graphs = await this.db.graphs();
      
      for (const graph of graphs) {
        const graphInfo = await graph.get();
        
        const graphSchema = {
          name: graph.name,
          edgeDefinitions: graphInfo.edgeDefinitions,
          orphanCollections: graphInfo.orphanCollections || [],
          isSmart: graphInfo.isSmart || false,
          options: {
            smartGraphAttribute: graphInfo.smartGraphAttribute,
            numberOfShards: graphInfo.numberOfShards,
            replicationFactor: graphInfo.replicationFactor,
            minReplicationFactor: graphInfo.minReplicationFactor
          }
        };
        
        this.schema.graphs.push(graphSchema);
      }
      
      console.log(`Extracted ${this.schema.graphs.length} graphs`);
    } catch (error) {
      console.warn('Error extracting graphs (might not be available):', error.message);
    }
  }

  async extractViews() {
    console.log('Extracting views...');
    
    try {
      const views = await this.db.views();
      
      for (const view of views) {
        const viewInfo = await view.get();
        
        const viewSchema = {
          name: view.name,
          type: viewInfo.type,
          properties: viewInfo.properties || {}
        };
        
        this.schema.views.push(viewSchema);
      }
      
      console.log(`Extracted ${this.schema.views.length} views`);
    } catch (error) {
      console.warn('Error extracting views (might not be available):', error.message);
    }
  }

  async extractAnalyzers() {
    console.log('Extracting analyzers...');
    
    try {
      const result = await this.db.request({
        method: 'GET',
        path: '/_api/analyzer'
      });
      
      const customAnalyzers = result.body.result.filter(analyzer => 
        !analyzer.name.startsWith('_system') && 
        analyzer.name.includes('::')
      );
      
      for (const analyzer of customAnalyzers) {
        const analyzerSchema = {
          name: analyzer.name.split('::')[1], // Remove database prefix
          type: analyzer.type,
          properties: analyzer.properties || {},
          features: analyzer.features || []
        };
        
        this.schema.analyzers.push(analyzerSchema);
      }
      
      console.log(`Extracted ${this.schema.analyzers.length} custom analyzers`);
    } catch (error) {
      console.warn('Error extracting analyzers (might not be available):', error.message);
    }
  }

  async extractFunctions() {
    console.log('Extracting AQL user functions...');
    
    try {
      const result = await this.db.request({
        method: 'GET',
        path: '/_api/aqlfunction'
      });
      
      for (const func of result.body.result) {
        const functionSchema = {
          name: func.name,
          code: func.code,
          isDeterministic: func.isDeterministic || false
        };
        
        this.schema.functions.push(functionSchema);
      }
      
      console.log(`Extracted ${this.schema.functions.length} AQL functions`);
    } catch (error) {
      console.warn('Error extracting functions (might not be available):', error.message);
    }
  }

  async saveSchema(outputPath) {
    const schemaJson = JSON.stringify(this.schema, null, 2);
    await fs.writeFile(outputPath, schemaJson, 'utf8');
    console.log(`Schema saved to: ${outputPath}`);
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
  const outputPath = process.argv[2] || './arango-schema.json';

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
  console.log('--- Database Schema Extractor ---');
  console.log('This script will extract the schema from an ArangoDB database.');
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

  const extractor = new ArangoSchemaExtractor(config);
  
  try {
    await extractor.extractSchema();
    await extractor.saveSchema(outputPath);
    
    console.log(`\nSchema extraction completed! Schema saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Schema extraction failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ArangoSchemaExtractor;

