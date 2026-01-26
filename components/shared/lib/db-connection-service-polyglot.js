const { Database } = require('arangojs');
const retry = require('async-retry');
const http = require('http');
const https = require('https');
const { logger } = require('./logger');
// Import the new translation modules. These will be built separately.
// We are assuming they export translator functions/classes.
const { AqlToSqlTranslator } = require('./aql-to-sql');
const { ArangoToArcadeGraphTranslator } = require('./arango-to-arcade-graph');

/**
 * Enhanced singleton class to manage long-lived database connections with COMPLETE RECOVERY.
 * This service now supports both ArangoDB and ArcadeDB as backends, determined by DB_TYPE.
 * The interface remains IDENTICAL to the client, ensuring transparent switching.
 */
class DatabaseService {
    constructor() {
        // Determine the database type. Default to 'arango' for backward compatibility.
        this._dbType = (process.env.DB_TYPE || 'arango').toLowerCase();

        logger.info(`Initializing Enhanced DatabaseService with COMPLETE RECOVERY in '${this._dbType}' mode.`);

        this._connections = new Map();
        this._connectionTimestamps = new Map();
        this._healthCheckIntervals = new Map();
        this._connectionConfigs = new Map();

        // Track all database proxies issued to consumer services
        this._activeProxies = new Map(); // connectionName -> Set of proxy objects
        this._proxyUpdateCallbacks = new Map(); // connectionName -> Set of callback functions

        // Initialize translators if in ArcadeDB mode
        if (this._dbType === 'arcade') {
            this.aqlTranslator = new AqlToSqlTranslator();
            this.graphTranslator = new ArangoToArcadeGraphTranslator();
        }

        // Conditional configuration based on DB_TYPE
        if (this._dbType === 'arcade') {
            // --- ARCADE DB CONFIGURATION ---
            const url = process.env.ARCADE_URL || 'http://localhost:2480';
            const databaseName = process.env.ARCADE_DB || 'node-services';
            const username = process.env.ARCADE_USER || 'root';
            const password = process.env.ARCADE_PASSWORD || 'test';

            logger.info(`ARCADE_URL: ${url}`);
            logger.info(`ARCADE_DB: ${databaseName}`);
            logger.info(`ARCADE_USERNAME: ${username}`);

            this._arcadeBaseUrl = url;
            this._arcadeDbName = databaseName;
            this._arcadeAuthHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

            // Use a persistent HTTP/HTTPS agent for connection pooling
            const agentOptions = {
                keepAlive: true,
                keepAliveMsecs: 60000,
                maxSockets: 20,
                maxFreeSockets: 10,
                timeout: 120000,
                freeSocketTimeout: 1800000
            };
            this._httpAgent = url.startsWith('https') ? new https.Agent(agentOptions) : new http.Agent(agentOptions);

        } else {
            // --- ARANGO DB CONFIGURATION (UNCHANGED) ---
            const url = process.env.ARANGO_URL || 'http://arango-vector-db:8529';
            const databaseName = process.env.ARANGO_DB || 'node-services';
            const username = process.env.ARANGO_USER || 'root';
            const password = process.env.ARANGO_PASSWORD || 'test';

            logger.info(`process.env.ARANGO_URL:` + process.env.ARANGO_URL);
            logger.info(`process.env.ARANGO_DB:` + process.env.ARANGO_DB);
            logger.info(`process.env.ARANGO_USER:` + process.env.ARANGO_USER);
            logger.info(`process.env.ARANGO_PASSWORD:` + process.env.ARANGO_PASSWORD);
            logger.info(`ARANGO_URL: ${url}`);
            logger.info(`ARANGO_DB: ${databaseName}`);
            logger.info(`ARANGO_USERNAME: ${username}`);

            this._defaultConfig = {
                url,
                databaseName,
                auth: { username, password },
                agentOptions: {
                    keepAlive: true,
                    keepAliveMsecs: 60000,
                    maxSockets: 20,
                    maxFreeSockets: 10,
                    timeout: 120000,
                    freeSocketTimeout: 1800000
                },
                timeout: 60000
            };
        }

        // Configuration for connection lifecycle - optimized for 24/7 operation
        this.CONNECTION_IDLE_TIMEOUT = 8 * 60 * 60 * 1000;   // 8 hours idle timeout
        this.HEALTH_CHECK_INTERVAL = 10 * 60 * 1000;         // Health check every 10 minutes
        this.MAX_CONNECTION_AGE = 7 * 24 * 60 * 60 * 1000;   // Max connection age: 7 days

        // Active recovery settings
        this.RECOVERY_RETRY_ATTEMPTS = 5;
        this.RECOVERY_RETRY_DELAY = 30000;
        this.FAILED_RECOVERY_COOLDOWN = 5 * 60 * 1000;

        // Track recovery attempts
        this._recoveryAttempts = new Map();
        this._lastRecoveryAttempt = new Map();

        // Start cleanup routine
        this._startConnectionCleanup();

        logger.debug('Enhanced DatabaseService singleton instance created with COMPLETE RECOVERY');
    }

    /**
     * Returns the configured database type ('arango' or 'arcade')
     */
    getDBType() {
        return this._dbType;
    }

    /**
     * Get a database connection with enhanced lifecycle management and automatic recovery
     * This method now returns a self-healing proxy that automatically updates on recovery
     */
    async getConnection(name = 'default', config = {}) {
        const connectionName = name === 'test' ? 'default' : name;
        const now = Date.now();

        logger.info(`[DB_CONNECTION] Getting database connection: ${connectionName} at ${new Date().toISOString()}`);

        // Check if we have a valid existing connection
        if (this._connections.has(connectionName)) {
            const connectionInfo = this._connections.get(connectionName);
            const age = now - connectionInfo.createdAt;
            const idleTime = now - connectionInfo.lastActivity;

            logger.info(`[DB_CONNECTION] Existing connection found for ${connectionName}:`);
            logger.info(`[DB_CONNECTION]   - Age: ${Math.round(age / 60000)}min`);
            logger.info(`[DB_CONNECTION]   - Idle time: ${Math.round(idleTime / 60000)}min`);

            // Check if connection is too old or has been idle too long
            if (this._isConnectionStale(connectionInfo, now)) {
                logger.warn(`[DB_CONNECTION] Connection ${connectionName} is stale - forcing recreation`);
                await this._closeConnection(connectionName);
            } else {
                // Test connection health before returning
                try {
                    logger.info(`[DB_CONNECTION] Testing existing connection health for ${connectionName}`);
                    await this._quickHealthCheck(connectionInfo.db, connectionName);
                    connectionInfo.lastActivity = now;
                    logger.info(`[DB_CONNECTION] Existing connection ${connectionName} is healthy`);

                    // Return existing proxy or create one if needed
                    return this._getOrCreateProxy(connectionName, connectionInfo.db);
                } catch (error) {
                    logger.error(`[DB_CONNECTION] Existing connection ${connectionName} failed health check: ${error.message}`);
                    await this._closeConnection(connectionName);
                }
            }
        }

        // Create new connection with automatic retry
        logger.info(`[DB_CONNECTION] Creating new connection for ${connectionName}`);
        const db = await this._createNewConnectionWithRetry(connectionName, config);

        // Return a self-healing proxy
        return this._getOrCreateProxy(connectionName, db);
    }

    /**
     * NEW: Create an adapter for ArcadeDB that mimics the arangojs driver interface.
     * This is the core of the transparent integration.
     */
    _createArcadeDBAdapter(connectionName) {
        const self = this;

        const executeArcadeCommand = async (command, language = 'sql') => {
            // Determine the correct API endpoint
            const apiEndpoint = language === 'cypher' || language === 'gremlin'
                ? `query/${self._arcadeDbName}`
                : `command/${self._arcadeDbName}`;

            // CRITICAL FIX: Construct the full, correct URL
            const fullUrl = `${self._arcadeBaseUrl}/api/v1/${apiEndpoint}`;

            const body = {
                language,
                command: command.command || command,
                params: command.params || {}
            };

            logger.debug(`[DB_ARCADE_ADAPTER] Sending command to ${fullUrl}`);

            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: {
                    'Authorization': self._arcadeAuthHeader,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body),
                agent: self._httpAgent // Use the persistent agent
            });

            if (!response.ok) {
                const errorBody = await response.text();
                logger.error(`[DB_ARCADE_ADAPTER] ArcadeDB command failed with status ${response.status}: ${errorBody}`);
                const error = new Error(`ArcadeDB command failed: ${response.statusText} - ${errorBody}`);
                error.response = { status: response.status };
                throw error;
            }

            const json = await response.json();
            return json.result;
        };

        const adapter = {
            isArangoDatabase: false, // Identifier for proxy logic
            name: self._arcadeDbName,

            query: async (aqlQuery, bindVars = {}) => {
                logger.debug(`[DB_ARCADE_ADAPTER] Intercepted query for translation: ${aqlQuery}`);
                const { sql, params } = self.aqlTranslator.translateQuery(aqlQuery, bindVars);
                logger.debug(`[DB_ARCADE_ADAPTER] Translated to SQL: ${sql} with params: ${JSON.stringify(params)}`);
                const result = await executeArcadeCommand({ command: sql, params });

                // Return a cursor-like object for compatibility
                let resultSet = Array.isArray(result) ? result : [result];
                return {
                    all: async () => resultSet,
                    next: async () => resultSet.shift(),
                    hasNext: () => resultSet.length > 0,
                    count: resultSet.length,
                };
            },

            collection: (collectionName) => {
                return self._createArcadeCollectionAdapter(collectionName, executeArcadeCommand);
            },

            graph: (graphName) => {
                return self._createArcadeGraphAdapter(graphName, executeArcadeCommand);
            },

            listCollections: async () => {
                const result = await executeArcadeCommand("SELECT name, type FROM sys.types WHERE type IN ['VERTEX', 'EDGE']");
                return result.map(item => ({ name: item.name, isSystem: false, type: item.type === 'VERTEX' ? 2 : 3 }));
            },

            version: async () => {
                const result = await executeArcadeCommand("SELECT value FROM sys.properties WHERE name = 'version'");
                return { version: result[0]?.value || 'unknown', server: 'arcade' };
            }
        };
        return adapter;
    }

    /**
     * NEW: Creates a collection adapter for ArcadeDB.
     */
    /**
   * NEW: Creates a collection adapter for ArcadeDB.
   */
    _createArcadeCollectionAdapter(collectionName, commandExecutor) {
        const self = this;
        return {
            // FIX: Added the missing 'all' method to match the arangojs driver interface.
            all: async () => {
                logger.debug(`[DB_ARCADE_ADAPTER] Executing 'all' for collection ${collectionName}`);
                // This emulates the ArangoDB cursor by fetching all documents.
                const result = await commandExecutor(`SELECT * FROM \`${collectionName}\``);
                const resultSet = Array.isArray(result) ? result : [];
                // Return a cursor-like object for compatibility with client code that might call .all() on the result.
                return {
                    all: async () => resultSet,
                    next: async () => resultSet.shift(),
                    hasNext: () => resultSet.length > 0,
                    count: resultSet.length,
                };
            },
            save: async (doc, options = {}) => {
                const { sql, params } = self.aqlTranslator.translateInsert(collectionName, doc, options);
                return await commandExecutor({ command: sql, params });
            },
            document: async (docOrKey) => {
                const key = typeof docOrKey === 'string' ? docOrKey : docOrKey._key;
                const { sql, params } = self.aqlTranslator.translateGet(collectionName, key);
                const result = await commandExecutor({ command: sql, params });
                return result[0];
            },
            update: async (docOrKey, newData, options = {}) => {
                const key = typeof docOrKey === 'string' ? docOrKey : docOrKey._key;
                const { sql, params } = self.aqlTranslator.translateUpdate(collectionName, key, newData, options);
                return await commandExecutor({ command: sql, params });
            },
            replace: async (docOrKey, newData, options = {}) => {
                const key = typeof docOrKey === 'string' ? docOrKey : docOrKey._key;
                const { sql, params } = self.aqlTranslator.translateReplace(collectionName, key, newData, options);
                return await commandExecutor({ command: sql, params });
            },
            remove: async (docOrKey, options = {}) => {
                const key = typeof docOrKey === 'string' ? docOrKey : docOrKey._key;
                const { sql, params } = self.aqlTranslator.translateRemove(collectionName, key, options);
                return await commandExecutor({ command: sql, params });
            },
            count: async () => {
                const result = await commandExecutor(`SELECT count(*) as count FROM ${collectionName}`);
                return { count: result[0]?.count || 0 };
            },
            truncate: async () => {
                return await commandExecutor(`TRUNCATE TYPE ${collectionName}`);
            }
        };
    }

    /**
     * NEW: Creates a graph adapter for ArcadeDB.
     */
    _createArcadeGraphAdapter(graphName, commandExecutor) {
        const self = this;
        return {
            traversal: async (startVertex, options = {}) => {
                logger.debug(`[DB_ARCADE_ADAPTER] Intercepted graph traversal for translation.`);
                const { query, params, language } = self.graphTranslator.translateTraversal(startVertex, options);
                logger.debug(`[DB_ARCADE_ADAPTER] Translated to ${language}: ${query}`);
                return await commandExecutor({ command: query, params }, language);
            },
            addEdgeDefinition: async (edgeDefinition) => {
                logger.warn(`[DB_ARCADE_ADAPTER] addEdgeDefinition is a schema operation, translation may be complex.`);
                const { command } = self.graphTranslator.translateAddEdgeDefinition(edgeDefinition);
                return await commandExecutor(command);
            }
        };
    }

    /**
     * Create new connection with built-in retry logic
     */
    async _createNewConnectionWithRetry(name, config = {}) {
        let lastError;
        const maxRetries = 3;

        logger.info(`[DB_CONNECTION] Starting connection creation with retry for ${name}`);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.info(`[DB_CONNECTION] Connection attempt ${attempt}/${maxRetries} for ${name}`);

                const db = await this._createNewConnection(name, config);
                logger.info(`[DB_CONNECTION] Connection created successfully on attempt ${attempt} for ${name}`);
                return db;

            } catch (error) {
                lastError = error;
                logger.error(`[DB_CONNECTION] Connection attempt ${attempt}/${maxRetries} failed for ${name}: ${error.message}`);

                if (this._isConnectionError(error) && attempt < maxRetries) {
                    const backoffTime = 1000 * attempt;
                    logger.warn(`[DB_CONNECTION] Connection error detected, will retry in ${backoffTime}ms`);
                    await this._sleep(backoffTime);
                } else if (attempt >= maxRetries) {
                    logger.error(`[DB_CONNECTION] Max connection attempts exceeded for ${name}`);
                    break;
                } else {
                    logger.error(`[DB_CONNECTION] Non-connection error for ${name}, not retrying: ${error.message}`);
                    throw error;
                }
            }
        }

        logger.error(`[DB_CONNECTION] Connection creation failed permanently for ${name}: ${lastError.message}`);
        throw lastError;
    }

    /**
     * Create a new database connection with enhanced configuration
     */
    async _createNewConnection(name, config = {}) {
        const now = Date.now();
        let db;
        let connectionConfig;

        if (this._dbType === 'arcade') {
            logger.info(`[DB_CONNECTION] Creating new ArcadeDB adapter: ${name}`);
            db = this._createArcadeDBAdapter(name);
            connectionConfig = {
                url: this._arcadeBaseUrl,
                databaseName: this._arcadeDbName,
                auth: { username: 'from_env' }
            };
            await this._testConnection(db, name);
            logger.info(`[DB_CONNECTION] ArcadeDB adapter created and tested for ${name}`);

        } else {
            // --- UNCHANGED ARANGODB LOGIC ---
            connectionConfig = { ...this._defaultConfig, ...config };
            logger.info(`[DB_CONNECTION] Creating new ArangoDB connection: ${name}`);
            logger.info(`[DB_CONNECTION] Target: ${connectionConfig.url}/${connectionConfig.databaseName}`);

            db = new Database(connectionConfig);

            await retry(async () => {
                try {
                    logger.info(`[DB_CONNECTION] Attempting ArangoDB login for ${name}`);
                    await db.login(connectionConfig.auth.username, connectionConfig.auth.password);
                    logger.info(`[DB_CONNECTION] ArangoDB login successful for ${name}`);

                    await this._testConnection(db, name);
                    logger.info(`[DB_CONNECTION] ArangoDB connection test passed for ${name}`);

                } catch (error) {
                    logger.error(`[DB_CONNECTION] ArangoDB authentication/test failed for ${name}: ${error.message}`);
                    throw error;
                }
            }, {
                retries: 3,
                minTimeout: 1000,
                maxTimeout: 5000,
                onRetry: (err, attempt) => {
                    logger.warn(`[DB_CONNECTION] ArangoDB connection attempt ${attempt} failed for ${name}: ${err.message}`);
                }
            });
        }

        const connectionInfo = {
            db,
            createdAt: now,
            lastActivity: now,
            lastHealthCheck: now,
            config: connectionConfig
        };

        this._connections.set(name, connectionInfo);
        this._connectionConfigs.set(name, connectionConfig);
        this._startHealthCheckForConnection(name);

        this._recoveryAttempts.delete(name);
        this._lastRecoveryAttempt.delete(name);

        logger.info(`[DB_CONNECTION] New connection created and stored: ${name}`);
        logger.info(`[DB_CONNECTION] Total active connections: ${this._connections.size}`);

        return db;
    }

    /**
     * Test a database connection. Now supports both DB types.
     */
    async _testConnection(db, name) {
        const startTime = Date.now();
        try {
            if (this._dbType === 'arcade') {
                logger.info(`[DB_TEST] Testing ArcadeDB connection ${name}...`);
                const cursor = await db.query('RETURN 1');
                const result = await cursor.next();

                // BETTER DEBUGGING: Log the actual response from the database
                logger.debug(`[DB_TEST] Health check response for ${name}: ${JSON.stringify(result)}`);

                // CRITICAL FIX: ArcadeDB returns an object like { "health_check": 1 }.
                // We need to check the value inside the object, not the object itself.
                if (!result || result.health_check !== 1) {
                    throw new Error(`Unexpected query result from ArcadeDB: ${JSON.stringify(result)}`);
                }

                const testTime = Date.now() - startTime;
                logger.info(`[DB_TEST] ArcadeDB connection test passed for ${name} in ${testTime}ms`);
            } else {
                // --- UNCHANGED ARANGODB LOGIC ---
                logger.info(`[DB_TEST] Testing ArangoDB connection ${name}...`);
                const cursor = await db.query('RETURN 1', {}, { timeout: 5000 });
                const result = await cursor.next();
                if (result !== 1) {
                    throw new Error(`Unexpected query result: ${result}`);
                }
                const collections = await db.listCollections();
                logger.debug(`[DB_TEST] Found ${collections.length} collections for ${name}`);
                const testTime = Date.now() - startTime;
                logger.info(`[DB_TEST] ArangoDB connection test passed for ${name} in ${testTime}ms`);
            }
        } catch (error) {
            const testTime = Date.now() - startTime;
            logger.error(`[DB_TEST] Connection test failed for ${name} after ${testTime}ms: ${error.message}`);
            throw error;
        }
    }

    /**
     * Quick health check (lighter than full test)
     */
    async _quickHealthCheck(db, name) {
        const startTime = Date.now();
        try {
            if (this._dbType === 'arcade') {
                const cursor = await db.query('RETURN 1');
                await cursor.next();
            } else {
                // --- UNCHANGED ARANGODB LOGIC ---
                const cursor = await db.query('RETURN 1', {}, { timeout: 3000 });
                await cursor.next();
            }
            const checkTime = Date.now() - startTime;
            logger.debug(`[DB_HEALTH] Quick health check passed for ${name} in ${checkTime}ms`);
        } catch (error) {
            const checkTime = Date.now() - startTime;
            logger.error(`[DB_HEALTH] Quick health check failed for ${name} after ${checkTime}ms: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if an error is connection-related. Now supports both DB types.
     */
    _isConnectionError(error) {
        const connectionErrorStrings = [
            'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT',
            'EPIPE', 'EHOSTUNREACH', 'socket hang up'
        ];

        const message = error.message?.toLowerCase() || '';
        const code = error.code?.toString()?.toLowerCase() || '';

        if (connectionErrorStrings.some(errStr => message.includes(errStr.toLowerCase()) || code.includes(errStr.toLowerCase()))) {
            logger.debug(`[DB_ERROR] Generic connection error detected: "${error.message}"`);
            return true;
        }

        if (this._dbType === 'arcade') {
            const status = error.response?.status;
            if (status === 401 || status === 403 || status === 503 || status === 504) {
                logger.debug(`[DB_ERROR] Treating ArcadeDB HTTP status ${status} as connection error.`);
                return true;
            }
        } else {
            // --- UNCHANGED ARANGODB LOGIC ---
            if (error.response?.status === 401 || error.code === 401 || message.includes('not authorized')) {
                logger.debug(`[DB_ERROR] Treating ArangoDB 401/auth error as connection error for recovery`);
                return true;
            }
        }

        logger.debug(`[DB_ERROR] Connection error check for "${error.message}": false`);
        return false;
    }

    // =================================================================================
    // ALL REMAINING METHODS ARE GENERIC AND SHOULD WORK WITHOUT MODIFICATION
    // AS THEY RELY ON THE PROXY AND THE CORE CONNECTION MANAGEMENT LOGIC.
    // NO CHANGES ARE MADE TO THE CODE BELOW THIS LINE TO ENSURE STABILITY.
    // =================================================================================

    /**
 * Get or create a self-healing proxy for a connection.
 * This version contains the definitive fix for the .collections() method.
 */
    _getOrCreateProxy(connectionName, targetDb) {
        const self = this;

        const proxy = new Proxy({}, {
            get(target, prop) {
                // Always get the current connection info
                const currentConnectionInfo = self._connections.get(connectionName);
                const currentDb = currentConnectionInfo ? currentConnectionInfo.db : targetDb;

                if (typeof currentDb[prop] !== 'function') {
                    return currentDb[prop];
                }

                // =================================================================
                // THE DEFINITIVE FIX IS HERE
                // =================================================================
                // When the client calls db.collections(), the result is an array of
                // collection objects. We MUST intercept this and wrap each object in
                // the collection proxy to ensure they are all resilient.
                if (prop === 'collections') {
                    return async function (...args) {
                        const rawCollections = await self._executeWithRetry(
                            connectionName,
                            async (db) => db.collections(...args),
                            'collections'
                        );
                        // Wrap each raw collection object in our resilient proxy
                        return rawCollections.map(collection =>
                            self._createCollectionProxy(connectionName, collection.name, collection)
                        );
                    };
                }
                // =================================================================
                // END OF FIX
                // =================================================================

                // Special handling for methods that return proxied objects
                if (prop === 'collection') {
                    return function (collectionName) {
                        const realCollection = currentDb.collection(collectionName);
                        return self._createCollectionProxy(connectionName, collectionName, realCollection);
                    };
                }

                if (prop === 'graph') {
                    return function (graphName) {
                        const realGraph = currentDb.graph(graphName);
                        return self._createGraphProxy(connectionName, graphName, realGraph);
                    };
                }

                if (prop === 'view') {
                    return function (viewName) {
                        const realView = currentDb.view(viewName);
                        return self._createViewProxy(connectionName, viewName, realView);
                    };
                }

                if (prop === 'analyzer') {
                    return function (analyzerName) {
                        const realAnalyzer = currentDb.analyzer(analyzerName);
                        return self._createAnalyzerProxy(connectionName, analyzerName, realAnalyzer);
                    };
                }

                // Methods that return cursors need special handling
                if (prop === 'query') {
                    return async function (query, bindVars, options) {
                        const result = await self._executeWithRetry(
                            connectionName,
                            async (db) => db.query(query, bindVars, options),
                            'query'
                        );

                        if (result && typeof result.next === 'function') {
                            return self._createCursorProxy(connectionName, result);
                        }

                        return result;
                    };
                }

                // Transaction methods need special handling
                if (prop === 'beginTransaction') {
                    return async function (collections, options) {
                        const transaction = await self._executeWithRetry(
                            connectionName,
                            async (db) => db.beginTransaction(collections, options),
                            'beginTransaction'
                        );

                        return self._createTransactionProxy(connectionName, transaction);
                    };
                }

                if (prop === 'executeTransaction') {
                    return async function (collections, action, options) {
                        return await self._executeWithRetry(
                            connectionName,
                            async (db) => db.executeTransaction(collections, action, options),
                            'executeTransaction'
                        );
                    };
                }

                // Route methods
                if (prop === 'route') {
                    return function (path, headers) {
                        const route = currentDb.route(path, headers);
                        return self._createRouteProxy(connectionName, route);
                    };
                }

                // Standard database methods with retry logic
                const databaseMethods = [
                    'listCollections', 'createCollection', 'dropCollection', 'truncate', 'renameCollection',
                    'listGraphs', 'graphs', 'createGraph', 'dropGraph',
                    'listViews', 'views', 'createView', 'dropView',
                    'listAnalyzers', 'analyzers', 'createAnalyzer', 'dropAnalyzer',
                    'listUsers', 'createUser', 'updateUser', 'replaceUser', 'dropUser',
                    'listDatabases', 'createDatabase', 'dropDatabase', 'useDatabase',
                    'version', 'engine', 'isArangoDatabase', 'name',
                    'exists', 'get', 'post', 'put', 'patch', 'delete', 'head', 'options',
                    'acquireHostList', 'close'
                ];

                if (databaseMethods.includes(prop) || typeof currentDb[prop] === 'function') {
                    return async function (...args) {
                        return await self._executeWithRetry(
                            connectionName,
                            async (db) => db[prop](...args),
                            prop
                        );
                    };
                }

                return currentDb[prop].bind(currentDb);
            }
        });

        if (!this._activeProxies.has(connectionName)) {
            this._activeProxies.set(connectionName, new Set());
        }
        this._activeProxies.get(connectionName).add(proxy);

        logger.debug(`[DB_PROXY] Created self-healing proxy for ${connectionName}. Total proxies: ${this._activeProxies.get(connectionName).size}`);

        return proxy;
    }

    /**
   * ENHANCED: Create a comprehensive self-healing proxy for ArangoDB collections
   * Handles ALL collection methods and return types
   */
    _createCollectionProxy(connectionName, collectionName, targetCollection) {
        const self = this;
        
        return new Proxy(targetCollection, {
          get(target, prop) {
            // The 'target' argument is the real collection object. We will now use it directly.
            const currentCollection = target;
            
            // Pass through non-function properties
            if (typeof currentCollection[prop] !== 'function') {
              return currentCollection[prop];
            }
            
            const operation = async (...args) => {
                // Re-fetch the fresh DB connection on every call to ensure it's not stale
                const freshConnectionInfo = self._connections.get(connectionName);
                if (!freshConnectionInfo) throw new Error(`Connection ${connectionName} not found during operation.`);
                
                // Get the collection object from the fresh DB connection to perform the operation
                const liveCollection = freshConnectionInfo.db.collection(collectionName);
                
                return await liveCollection[prop](...args);
            };
    
            return async function(...args) {
                return await self._executeWithRetry(
                    connectionName,
                    () => operation(...args),
                    `collection.${prop}`
                );
            };
          }
        });
      }

    _createGraphProxy(connectionName, graphName, targetGraph) {
        const self = this;

        return new Proxy({}, {
            get(target, prop) {
                const currentConnectionInfo = self._connections.get(connectionName);
                const currentDb = currentConnectionInfo ? currentConnectionInfo.db : null;
                const currentGraph = currentDb ? currentDb.graph(graphName) : targetGraph;

                if (typeof currentGraph[prop] !== 'function') {
                    return currentGraph[prop];
                }

                if (prop === 'vertexCollection') {
                    return function (collectionName) {
                        const vertexCollection = currentGraph.vertexCollection(collectionName);
                        return self._createVertexCollectionProxy(connectionName, graphName, collectionName, vertexCollection);
                    };
                }

                if (prop === 'edgeCollection') {
                    return function (collectionName) {
                        const edgeCollection = currentGraph.edgeCollection(collectionName);
                        return self._createEdgeCollectionProxy(connectionName, graphName, collectionName, edgeCollection);
                    };
                }

                const graphMethods = [
                    'create', 'drop', 'get', 'exists', 'addVertexCollection', 'removeVertexCollection',
                    'addEdgeDefinition', 'removeEdgeDefinition', 'replaceEdgeDefinition', 'traversal'
                ];

                if (graphMethods.includes(prop) || typeof currentGraph[prop] === 'function') {
                    return async function (...args) {
                        return await self._executeWithRetry(
                            connectionName,
                            async (db) => db.graph(graphName)[prop](...args),
                            `graph.${prop}`
                        );
                    };
                }

                return currentGraph[prop].bind(currentGraph);
            }
        });
    }

    _createViewProxy(connectionName, viewName, targetView) {
        const self = this;

        return new Proxy({}, {
            get(target, prop) {
                const currentConnectionInfo = self._connections.get(connectionName);
                const currentDb = currentConnectionInfo ? currentConnectionInfo.db : null;
                const currentView = currentDb ? currentDb.view(viewName) : targetView;

                if (typeof currentView[prop] !== 'function') {
                    return currentView[prop];
                }

                const viewMethods = [
                    'create', 'drop', 'get', 'exists', 'properties', 'updateProperties', 'replaceProperties', 'rename'
                ];

                if (viewMethods.includes(prop) || typeof currentView[prop] === 'function') {
                    return async function (...args) {
                        return await self._executeWithRetry(
                            connectionName,
                            async (db) => db.view(viewName)[prop](...args),
                            `view.${prop}`
                        );
                    };
                }

                return currentView[prop].bind(currentView);
            }
        });
    }

    _createAnalyzerProxy(connectionName, analyzerName, targetAnalyzer) {
        const self = this;

        return new Proxy({}, {
            get(target, prop) {
                const currentConnectionInfo = self._connections.get(connectionName);
                const currentDb = currentConnectionInfo ? currentConnectionInfo.db : null;
                const currentAnalyzer = currentDb ? currentDb.analyzer(analyzerName) : targetAnalyzer;

                if (typeof currentAnalyzer[prop] !== 'function') {
                    return currentAnalyzer[prop];
                }

                const analyzerMethods = ['create', 'drop', 'get', 'exists'];

                if (analyzerMethods.includes(prop) || typeof currentAnalyzer[prop] === 'function') {
                    return async function (...args) {
                        return await self._executeWithRetry(
                            connectionName,
                            async (db) => db.analyzer(analyzerName)[prop](...args),
                            `analyzer.${prop}`
                        );
                    };
                }

                return currentAnalyzer[prop].bind(currentAnalyzer);
            }
        });
    }

    _createCursorProxy(connectionName, targetCursor) {
        const self = this;

        return new Proxy(targetCursor, {
            get(target, prop) {
                if (typeof target[prop] !== 'function') {
                    return target[prop];
                }

                const cursorMethods = ['next', 'hasNext', 'each', 'every', 'some', 'map', 'reduce', 'all', 'kill'];

                if (cursorMethods.includes(prop)) {
                    return async function (...args) {
                        try {
                            return await target[prop](...args);
                        } catch (error) {
                            if (self._isConnectionError(error)) {
                                logger.warn(`[DB_CURSOR] ${prop} failed due to connection error: ${error.message}`);
                                throw error;
                            }
                            throw error;
                        }
                    };
                }

                return target[prop].bind(target);
            }
        });
    }

    _createTransactionProxy(connectionName, targetTransaction) {
        const self = this;

        return new Proxy(targetTransaction, {
            get(target, prop) {
                if (typeof target[prop] !== 'function') {
                    return target[prop];
                }

                const transactionMethods = ['run', 'commit', 'abort', 'exists', 'get', 'step'];

                if (transactionMethods.includes(prop)) {
                    return async function (...args) {
                        return await self._executeWithRetry(
                            connectionName,
                            async () => target[prop](...args),
                            `transaction.${prop}`
                        );
                    };
                }

                return target[prop].bind(target);
            }
        });
    }

    _createRouteProxy(connectionName, targetRoute) {
        const self = this;

        return new Proxy(targetRoute, {
            get(target, prop) {
                if (typeof target[prop] !== 'function') {
                    return target[prop];
                }

                const routeMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'request'];

                if (routeMethods.includes(prop)) {
                    return async function (...args) {
                        return await self._executeWithRetry(
                            connectionName,
                            async () => target[prop](...args),
                            `route.${prop}`
                        );
                    };
                }

                return target[prop].bind(target);
            }
        });
    }

    _createVertexCollectionProxy(connectionName, graphName, collectionName, targetVertexCollection) {
        const self = this;

        return new Proxy({}, {
            get(target, prop) {
                const currentConnectionInfo = self._connections.get(connectionName);
                const currentDb = currentConnectionInfo ? currentConnectionInfo.db : null;
                const currentVertexCollection = currentDb ? currentDb.graph(graphName).vertexCollection(collectionName) : targetVertexCollection;

                if (typeof currentVertexCollection[prop] !== 'function') {
                    return currentVertexCollection[prop];
                }

                const vertexMethods = ['vertex', 'save', 'replace', 'update', 'remove'];

                if (vertexMethods.includes(prop) || typeof currentVertexCollection[prop] === 'function') {
                    return async function (...args) {
                        return await self._executeWithRetry(
                            connectionName,
                            async (db) => db.graph(graphName).vertexCollection(collectionName)[prop](...args),
                            `vertexCollection.${prop}`
                        );
                    };
                }

                return currentVertexCollection[prop].bind(currentVertexCollection);
            }
        });
    }

    _createEdgeCollectionProxy(connectionName, graphName, collectionName, targetEdgeCollection) {
        const self = this;

        return new Proxy({}, {
            get(target, prop) {
                const currentConnectionInfo = self._connections.get(connectionName);
                const currentDb = currentConnectionInfo ? currentConnectionInfo.db : null;
                const currentEdgeCollection = currentDb ? currentDb.graph(graphName).edgeCollection(collectionName) : targetEdgeCollection;

                if (typeof currentEdgeCollection[prop] !== 'function') {
                    return currentEdgeCollection[prop];
                }

                const edgeMethods = ['edge', 'save', 'replace', 'update', 'remove', 'edges'];

                if (edgeMethods.includes(prop) || typeof currentEdgeCollection[prop] === 'function') {
                    return async function (...args) {
                        return await self._executeWithRetry(
                            connectionName,
                            async (db) => db.graph(graphName).edgeCollection(collectionName)[prop](...args),
                            `edgeCollection.${prop}`
                        );
                    };
                }

                return currentEdgeCollection[prop].bind(currentEdgeCollection);
            }
        });
    }

    async _executeCollectionMethodWithRetry(connectionName, collectionName, methodName, args) {
        return await this._executeWithRetry(
            connectionName,
            async (db) => db.collection(collectionName)[methodName](...args),
            `collection.${methodName}`
        );
    }

    async _executeWithRetry(connectionName, operation, operationName = 'operation') {
        const maxRetries = 3;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.debug(`[DB_EXECUTE] Executing ${operationName} on ${connectionName} (attempt ${attempt})`);

                const connectionInfo = this._connections.get(connectionName);
                if (!connectionInfo) {
                    throw new Error(`No connection found for ${connectionName}`);
                }

                connectionInfo.lastActivity = Date.now();

                const result = await operation(connectionInfo.db);
                logger.debug(`[DB_EXECUTE] ${operationName} completed successfully on ${connectionName}`);
                return result;

            } catch (error) {
                lastError = error;
                logger.warn(`[DB_EXECUTE] ${operationName} failed on ${connectionName} (attempt ${attempt}): ${error.message}`);
                logger.debug(`[DB_EXECUTE] Error details: ${JSON.stringify({
                    code: error.code,
                    name: error.name,
                    status: error.response?.status || error.status,
                    errorNum: error.errorNum,
                    message: error.message
                })}`);

                if (this._isConnectionError(error) && attempt < maxRetries) {
                    logger.warn(`[DB_EXECUTE] Connection error detected, triggering recovery for ${connectionName}`);

                    try {
                        await this._performActiveRecovery(connectionName, error);
                        await this._sleep(500 * attempt);
                    } catch (recoveryError) {
                        logger.error(`[DB_EXECUTE] Recovery failed for ${connectionName}: ${recoveryError.message}`);
                        if (attempt >= maxRetries) {
                            throw recoveryError;
                        }
                    }
                } else if (attempt >= maxRetries) {
                    logger.error(`[DB_EXECUTE] Max retries exceeded for ${operationName} on ${connectionName}`);
                    break;
                } else {
                    logger.error(`[DB_EXECUTE] Non-connection error for ${operationName} on ${connectionName}: ${error.message}`);
                    throw error;
                }
            }
        }

        throw lastError;
    }

    async _performActiveRecovery(name, originalError) {
        const now = Date.now();

        const lastAttempt = this._lastRecoveryAttempt.get(name) || 0;
        if (now - lastAttempt < this.FAILED_RECOVERY_COOLDOWN) {
            const remainingCooldown = Math.round((this.FAILED_RECOVERY_COOLDOWN - (now - lastAttempt)) / 1000);
            logger.info(`[DB_RECOVERY] Recovery for ${name} in cooldown, ${remainingCooldown}s remaining`);
            return;
        }

        const attempts = this._recoveryAttempts.get(name) || 0;
        if (attempts >= this.RECOVERY_RETRY_ATTEMPTS) {
            logger.error(`[DB_RECOVERY] Max recovery attempts (${this.RECOVERY_RETRY_ATTEMPTS}) exceeded for ${name}`);
            this._lastRecoveryAttempt.set(name, now);
            this._recoveryAttempts.set(name, 0);
            await this._closeConnection(name);
            return;
        }

        logger.info(`[DB_RECOVERY] Starting ACTIVE RECOVERY for ${name} (attempt ${attempts + 1}/${this.RECOVERY_RETRY_ATTEMPTS})`);
        logger.info(`[DB_RECOVERY] Original failure: ${originalError.message}`);

        try {
            await this._closeConnection(name);

            if (attempts > 0) {
                const delay = this.RECOVERY_RETRY_DELAY * Math.pow(2, attempts - 1);
                logger.info(`[DB_RECOVERY] Waiting ${delay}ms before recovery attempt`);
                await this._sleep(delay);
            }

            const storedConfig = this._connectionConfigs.get(name) || {};

            logger.info(`[DB_RECOVERY] Attempting to recreate connection: ${name}`);
            const newDb = await this._createNewConnectionWithRetry(name, storedConfig);

            logger.info(`[DB_RECOVERY] ✅ ACTIVE RECOVERY SUCCESSFUL for ${name}`);
            logger.info(`[DB_RECOVERY] Connection ${name} is now available for service requests`);

            const proxyCount = this._activeProxies.get(name)?.size || 0;
            logger.info(`[DB_RECOVERY] 🔄 Updated ${proxyCount} existing proxies with fresh connection`);

            this._recoveryAttempts.delete(name);
            this._lastRecoveryAttempt.delete(name);

        } catch (recoveryError) {
            this._recoveryAttempts.set(name, attempts + 1);
            logger.error(`[DB_RECOVERY] ❌ Recovery attempt ${attempts + 1} failed for ${name}: ${recoveryError.message}`);
        }
    }

    _isConnectionStale(connectionInfo, now) {
        const age = now - connectionInfo.createdAt;
        const idleTime = now - connectionInfo.lastActivity;

        return age > this.MAX_CONNECTION_AGE || idleTime > this.CONNECTION_IDLE_TIMEOUT;
    }

    _startHealthCheckForConnection(name) {
        if (this._healthCheckIntervals.has(name)) {
            clearInterval(this._healthCheckIntervals.get(name));
        }

        const interval = setInterval(async () => {
            await this._performHealthCheck(name);
        }, this.HEALTH_CHECK_INTERVAL);

        this._healthCheckIntervals.set(name, interval);
    }

    async _performHealthCheck(name) {
        if (!this._connections.has(name)) {
            logger.debug(`[DB_HEALTH] No connection found for health check: ${name}`);
            return;
        }

        const connectionInfo = this._connections.get(name);
        const now = Date.now();
        const idleTime = now - connectionInfo.lastActivity;

        logger.info(`[DB_HEALTH] Health check for ${name}: Idle time: ${Math.round(idleTime / 60000)}min`);

        try {
            if (idleTime < this.HEALTH_CHECK_INTERVAL) {
                logger.debug(`[DB_HEALTH] Skipping health check for ${name} - recently active`);
                return;
            }

            logger.info(`[DB_HEALTH] Performing health check for idle connection: ${name}`);
            await this._testConnection(connectionInfo.db, name);
            connectionInfo.lastHealthCheck = now;
            logger.info(`[DB_HEALTH] Health check passed for connection: ${name}`);

        } catch (error) {
            logger.warn(`[DB_HEALTH] Health check failed for ${name}: ${error.message}`);
            await this._performActiveRecovery(name, error);
        }
    }

    async _closeConnection(name) {
        logger.info(`[DB_CLOSE] Closing connection: ${name}`);

        if (this._connections.has(name)) {
            const connectionInfo = this._connections.get(name);
            const age = Date.now() - connectionInfo.createdAt;
            const idleTime = Date.now() - connectionInfo.lastActivity;

            logger.info(`[DB_CLOSE] Connection ${name} stats: Age: ${Math.round(age / 60000)}min, Idle: ${Math.round(idleTime / 60000)}min`);

            this._connections.delete(name);
        }

        if (this._healthCheckIntervals.has(name)) {
            clearInterval(this._healthCheckIntervals.get(name));
            this._healthCheckIntervals.delete(name);
        }

        logger.info(`[DB_CLOSE] Remaining active connections: ${this._connections.size}`);
    }

    _startConnectionCleanup() {
        logger.info(`[DB_CLEANUP] Starting connection cleanup routine`);

        setInterval(async () => {
            const now = Date.now();
            const connectionsToClose = [];

            for (const [name, connectionInfo] of this._connections.entries()) {
                if (this._isConnectionStale(connectionInfo, now)) {
                    connectionsToClose.push(name);
                }
            }

            for (const name of connectionsToClose) {
                logger.info(`[DB_CLEANUP] Cleaning up stale connection: ${name}`);
                await this._closeConnection(name);

                if (name === 'default') {
                    logger.info(`[DB_CLEANUP] Initiating ACTIVE RECOVERY for essential connection: ${name}`);
                    await this._performActiveRecovery(name, new Error('Connection cleanup - proactive recreation'));
                }
            }

            if (connectionsToClose.length > 0) {
                logger.info(`[DB_CLEANUP] Cleaned up ${connectionsToClose.length} stale connections`);
            }
        }, this.HEALTH_CHECK_INTERVAL);
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async closeConnection(name = 'default') {
        logger.info(`Manually closing connection: ${name}`);
        await this._closeConnection(name);
        return true;
    }

    async closeAllConnections() {
        const count = this._connections.size;
        logger.info(`Closing all database connections. Total: ${count}`);

        const connectionNames = Array.from(this._connections.keys());

        for (const name of connectionNames) {
            await this._closeConnection(name);
        }

        this._recoveryAttempts.clear();
        this._lastRecoveryAttempt.clear();
        this._connectionConfigs.clear();
        this._activeProxies.clear();
        this._proxyUpdateCallbacks.clear();

        logger.info(`All connections closed: ${connectionNames.join(', ') || 'none'}`);
    }

    getConnectionStatus() {
        const now = Date.now();
        const connections = Array.from(this._connections.entries()).map(([name, info]) => ({
            name,
            age: now - info.createdAt,
            idleTime: now - info.lastActivity,
            lastHealthCheck: now - info.lastHealthCheck,
            isStale: this._isConnectionStale(info, now),
            recoveryAttempts: this._recoveryAttempts.get(name) || 0,
            lastRecoveryAttempt: this._lastRecoveryAttempt.get(name) || null,
            activeProxies: this._activeProxies.get(name)?.size || 0
        }));

        return {
            dbType: this._dbType,
            totalConnections: this._connections.size,
            totalActiveProxies: Array.from(this._activeProxies.values()).reduce((sum, set) => sum + set.size, 0),
            connections,
            config: {
                connectionIdleTimeout: this.CONNECTION_IDLE_TIMEOUT,
                healthCheckInterval: this.HEALTH_CHECK_INTERVAL,
                maxConnectionAge: this.MAX_CONNECTION_AGE,
                recoveryRetryAttempts: this.RECOVERY_RETRY_ATTEMPTS,
                recoveryRetryDelay: this.RECOVERY_RETRY_DELAY,
                failedRecoveryCooldown: this.FAILED_RECOVERY_COOLDOWN
            },
            recoveryStatus: {
                totalRecoveryAttempts: Array.from(this._recoveryAttempts.values()).reduce((sum, attempts) => sum + attempts, 0),
                connectionsInRecovery: this._recoveryAttempts.size,
                connectionsInCooldown: Array.from(this._lastRecoveryAttempt.entries())
                    .filter(([, lastAttempt]) => Date.now() - lastAttempt < this.FAILED_RECOVERY_COOLDOWN).length
            }
        };
    }

    async pingConnections() {
        logger.info(`Pinging all database connections (${this._connections.size} total)`);
        const results = {};

        for (const [name, connectionInfo] of this._connections.entries()) {
            try {
                const startTime = Date.now();
                await this._testConnection(connectionInfo.db, name);
                const responseTime = Date.now() - startTime;

                results[name] = {
                    status: 'connected',
                    responseTime,
                    age: Date.now() - connectionInfo.createdAt,
                    idleTime: Date.now() - connectionInfo.lastActivity,
                    recoveryAttempts: this._recoveryAttempts.get(name) || 0,
                    activeProxies: this._activeProxies.get(name)?.size || 0
                };
            } catch (error) {
                results[name] = {
                    status: 'error',
                    error: error.message,
                    recoveryAttempts: this._recoveryAttempts.get(name) || 0,
                    activeProxies: this._activeProxies.get(name)?.size || 0
                };

                logger.warn(`[DB_PING] Connection ${name} failed ping test, triggering active recovery`);
                await this._performActiveRecovery(name, error);
            }
        }

        return results;
    }

    async forceRecovery(name = 'default') {
        logger.info(`[DB_RECOVERY] Forcing recovery for connection: ${name}`);

        if (!this._connections.has(name) && !this._connectionConfigs.has(name)) {
            logger.error(`[DB_RECOVERY] Cannot force recovery - no connection or config found for: ${name}`);
            return false;
        }

        this._recoveryAttempts.delete(name);
        this._lastRecoveryAttempt.delete(name);

        await this._performActiveRecovery(name, new Error('Forced recovery requested'));
        return true;
    }

    getRecoveryStatus() {
        const now = Date.now();
        const recoveryInfo = {};

        for (const [name] of this._connectionConfigs.entries()) {
            const attempts = this._recoveryAttempts.get(name) || 0;
            const lastAttempt = this._lastRecoveryAttempt.get(name);
            const inCooldown = lastAttempt && (now - lastAttempt < this.FAILED_RECOVERY_COOLDOWN);

            recoveryInfo[name] = {
                hasConnection: this._connections.has(name),
                recoveryAttempts: attempts,
                lastRecoveryAttempt: lastAttempt ? new Date(lastAttempt).toISOString() : null,
                inCooldown,
                cooldownRemaining: inCooldown ? Math.round((this.FAILED_RECOVERY_COOLDOWN - (now - lastAttempt)) / 1000) : 0,
                nextRecoveryAllowed: inCooldown ? new Date(lastAttempt + this.FAILED_RECOVERY_COOLDOWN).toISOString() : 'immediately',
                activeProxies: this._activeProxies.get(name)?.size || 0
            };
        }

        return {
            dbType: this._dbType,
            recoveryConfig: {
                maxRetryAttempts: this.RECOVERY_RETRY_ATTEMPTS,
                retryDelay: this.RECOVERY_RETRY_DELAY,
                cooldownPeriod: this.FAILED_RECOVERY_COOLDOWN
            },
            connections: recoveryInfo,
            summary: {
                totalConnections: this._connections.size,
                totalConfiguredConnections: this._connectionConfigs.size,
                totalActiveProxies: Array.from(this._activeProxies.values()).reduce((sum, set) => sum + set.size, 0),
                connectionsInRecovery: this._recoveryAttempts.size,
                connectionsInCooldown: Object.values(recoveryInfo).filter(info => info.inCooldown).length
            }
        };
    }

    async executeWithRetry(operation, connectionName = 'default', maxRetries = 3) {
        let lastError;
        const startTime = Date.now();

        logger.info(`[DB_EXECUTE] Starting operation for connection: ${connectionName}`);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const db = await this.getConnection(connectionName);
                const result = await operation(db);

                if (this._connections.has(connectionName)) {
                    const connectionInfo = this._connections.get(connectionName);
                    connectionInfo.lastActivity = Date.now();
                }

                const executionTime = Date.now() - startTime;
                logger.info(`[DB_EXECUTE] Operation completed successfully for ${connectionName} in ${executionTime}ms`);

                return result;
            } catch (error) {
                lastError = error;
                const executionTime = Date.now() - startTime;

                logger.error(`[DB_EXECUTE] Attempt ${attempt}/${maxRetries} failed for ${connectionName} after ${executionTime}ms: ${error.message}`);

                if (this._isConnectionError(error) && attempt < maxRetries) {
                    logger.warn(`[DB_EXECUTE] Connection error detected, will retry after recovery`);
                    await this._performActiveRecovery(connectionName, error);
                    const backoffTime = 1000 * attempt;
                    await this._sleep(backoffTime);
                } else if (attempt >= maxRetries) {
                    logger.error(`[DB_EXECUTE] Max retries exceeded for ${operationName} on ${connectionName}`);
                    break;
                } else {
                    logger.error(`[DB_EXECUTE] Non-connection error, not retrying: ${error.message}`);
                    throw error;
                }
            }
        }

        logger.error(`[DB_EXECUTE] Operation failed permanently for ${connectionName}: ${lastError.message}`);
        throw lastError;
    }

    onConnectionRecovery(connectionName, callback) {
        if (!this._proxyUpdateCallbacks.has(connectionName)) {
            this._proxyUpdateCallbacks.set(connectionName, new Set());
        }
        this._proxyUpdateCallbacks.get(connectionName).add(callback);

        logger.info(`[DB_RECOVERY] Registered recovery callback for ${connectionName}`);
    }

    removeRecoveryCallback(connectionName, callback) {
        const callbacks = this._proxyUpdateCallbacks.get(connectionName);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this._proxyUpdateCallbacks.delete(connectionName);
            }
        }
    }

    getDetailedConnectionInfo(connectionName = 'default') {
        const connectionInfo = this._connections.get(connectionName);
        if (!connectionInfo) {
            return null;
        }

        const now = Date.now();
        return {
            name: connectionName,
            dbType: this._dbType,
            status: 'connected',
            createdAt: new Date(connectionInfo.createdAt).toISOString(),
            lastActivity: new Date(connectionInfo.lastActivity).toISOString(),
            lastHealthCheck: new Date(connectionInfo.lastHealthCheck).toISOString(),
            age: {
                milliseconds: now - connectionInfo.createdAt,
                minutes: Math.round((now - connectionInfo.createdAt) / 60000),
                hours: Math.round((now - connectionInfo.createdAt) / 3600000)
            },
            idleTime: {
                milliseconds: now - connectionInfo.lastActivity,
                minutes: Math.round((now - connectionInfo.lastActivity) / 60000),
                hours: Math.round((now - connectionInfo.lastActivity) / 3600000)
            },
            isStale: this._isConnectionStale(connectionInfo, now),
            config: {
                url: connectionInfo.config.url,
                databaseName: connectionInfo.config.databaseName,
                username: connectionInfo.config.auth.username
            },
            recovery: {
                attempts: this._recoveryAttempts.get(connectionName) || 0,
                lastAttempt: this._lastRecoveryAttempt.get(connectionName)
                    ? new Date(this._lastRecoveryAttempt.get(connectionName)).toISOString()
                    : null,
                inCooldown: this._lastRecoveryAttempt.get(connectionName) &&
                    (now - this._lastRecoveryAttempt.get(connectionName) < this.FAILED_RECOVERY_COOLDOWN)
            },
            proxies: {
                active: this._activeProxies.get(connectionName)?.size || 0,
                callbacks: this._proxyUpdateCallbacks.get(connectionName)?.size || 0
            }
        };
    }

    getHealthSummary() {
        const connections = Array.from(this._connections.keys());
        const now = Date.now();

        let healthyCount = 0;
        let staleCount = 0;
        let totalAge = 0;
        let totalIdleTime = 0;

        connections.forEach(name => {
            const info = this._connections.get(name);
            if (info) {
                if (this._isConnectionStale(info, now)) {
                    staleCount++;
                } else {
                    healthyCount++;
                }
                totalAge += (now - info.createdAt);
                totalIdleTime += (now - info.lastActivity);
            }
        });

        return {
            dbType: this._dbType,
            totalConnections: connections.length,
            healthyConnections: healthyCount,
            staleConnections: staleCount,
            averageAge: connections.length > 0 ? Math.round(totalAge / connections.length / 60000) : 0, // minutes
            averageIdleTime: connections.length > 0 ? Math.round(totalIdleTime / connections.length / 60000) : 0, // minutes
            totalActiveProxies: Array.from(this._activeProxies.values()).reduce((sum, set) => sum + set.size, 0),
            recoveryStatus: {
                totalAttempts: Array.from(this._recoveryAttempts.values()).reduce((sum, attempts) => sum + attempts, 0),
                activeRecoveries: this._recoveryAttempts.size,
                cooldownConnections: Array.from(this._lastRecoveryAttempt.entries())
                    .filter(([, lastAttempt]) => now - lastAttempt < this.FAILED_RECOVERY_COOLDOWN).length
            }
        };
    }

    async performFullHealthCheck() {
        logger.info(`[DB_HEALTH] Starting comprehensive health check for all connections`);

        const results = {
            timestamp: new Date().toISOString(),
            connections: {},
            summary: {
                total: 0,
                healthy: 0,
                failed: 0,
                recovered: 0
            }
        };

        for (const [name, connectionInfo] of this._connections.entries()) {
            results.summary.total++;

            try {
                const startTime = Date.now();
                await this._testConnection(connectionInfo.db, name);
                const responseTime = Date.now() - startTime;

                results[name] = {
                    status: 'healthy',
                    responseTime,
                    lastTest: new Date().toISOString()
                };

                results.summary.healthy++;
                logger.info(`[DB_HEALTH] Connection ${name} is healthy (${responseTime}ms)`);

            } catch (error) {
                logger.warn(`[DB_HEALTH] Connection ${name} failed health check: ${error.message}`);

                results[name] = {
                    status: 'failed',
                    error: error.message,
                    lastTest: new Date().toISOString()
                };

                results.summary.failed++;

                try {
                    await this._performActiveRecovery(name, error);
                    results[name].recoveryAttempted = true;
                    results.summary.recovered++;
                } catch (recoveryError) {
                    results[name].recoveryError = recoveryError.message;
                }
            }
        }

        logger.info(`[DB_HEALTH] Health check complete: ${results.summary.healthy}/${results.summary.total} healthy, ${results.summary.recovered} recovered`);

        return results;
    }

    async cleanupConnection(connectionName) {
        logger.info(`[DB_CLEANUP] Cleaning up all resources for connection: ${connectionName}`);

        await this._closeConnection(connectionName);

        this._recoveryAttempts.delete(connectionName);
        this._lastRecoveryAttempt.delete(connectionName);

        this._connectionConfigs.delete(connectionName);

        this._activeProxies.delete(connectionName);
        this._proxyUpdateCallbacks.delete(connectionName);

        logger.info(`[DB_CLEANUP] All resources cleaned up for: ${connectionName}`);
    }

    setDefaultConfig(config) {
        if (this._dbType === 'arango') {
            logger.info('Updating default ArangoDB configuration');
            this._defaultConfig = { ...this._defaultConfig, ...config };
        } else {
            logger.warn('setDefaultConfig is only applicable for ArangoDB mode.');
        }
    }
}

// Create and export singleton instance
logger.info('Creating enhanced singleton DatabaseService instance with COMPLETE RECOVERY');
const dbService = new DatabaseService();
Object.freeze(dbService);

module.exports = dbService;
