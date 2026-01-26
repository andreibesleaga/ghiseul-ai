// test-translator.js - Unit and Integration Tests for aql-to-sql.js

const { AqlToSqlTranslator } = require('../aql-to-sql.js'); // Adjust path if needed
const dbService = require('../db-connection-service'); // Adjust path if needed

// --- Test Configuration ---

const RUN_INTEGRATION_TESTS = process.argv.includes('--integration');

// =================================================================
// Test Suite Definition
// =================================================================

const translator = new AqlToSqlTranslator([
    'userSessions',
    'userConversations',
    'conversationCategories',
    'queryMessages',
    'categoryServices',
    'sessionQueries',
    'userFolders',
    'folderConversations'
]);

const testSuite = [
    // --- from admin-dashboard-service.js ---
    {
        description: 'admin-dashboard-service: Get Monthly Active Users (MAU)',
        aql: `FOR s IN sessions FILTER s.startTime >= @oneMonthAgoDate COLLECT userId = s.userId INTO groups RETURN userId`,
        expectedSql: `SELECT * FROM sessions LET s = @this WHERE s.startTime >= :oneMonthAgoDate GROUP BY s.userId SELECT s.userId AS userId, groups AS groups SELECT userId`,
    },
    {
        description: 'admin-dashboard-service: Get Last Month Analytics for Trends',
        aql: `FOR a IN analytics FILTER a.period == 'monthly' AND a.startDate >= @twoMonthsAgoDate AND a.startDate < @oneMonthAgoDate SORT a.startDate DESC LIMIT 1 RETURN a`,
        expectedSql: `SELECT * FROM analytics LET a = @this WHERE a.period == 'monthly' AND a.startDate >= :twoMonthsAgoDate AND a.startDate < :oneMonthAgoDate ORDER BY a.startDate DESC LIMIT 1 SELECT a`,
    },
    {
        description: 'admin-dashboard-service: Get Average Response Time',
        aql: `FOR q IN queries FILTER q.timestamp >= @startDate COLLECT AGGREGATE avgTime = AVERAGE(q.responseTime * 1000), count = COUNT() RETURN { avgTime, count }`,
        expectedSql: `SELECT * FROM queries LET q = @this WHERE q.timestamp >= :startDate GROUP BY SELECT AVERAGE(q.responseTime * 1000) AS avgTime, COUNT(*) AS count SELECT avgTime AS avgTime, count AS count`,
    },
    {
        description: 'admin-dashboard-service: Get Total User Count',
        aql: `RETURN LENGTH(FOR u IN users RETURN 1)`,
        expectedSql: `SELECT COUNT(*) FROM (SELECT * FROM users LET u = @this SELECT 1)`,
    },
    {
        description: 'admin-dashboard-service: Get Active Users (Last Day)',
        aql: `LET oneDayAgo = DATE_SUBTRACT(DATE_NOW(), 1, "day") RETURN LENGTH( FOR s IN sessions FILTER s.startTime >= oneDayAgo OR s.active == true COLLECT userId = s.userId RETURN 1 )`,
        expectedSql: `WITH oneDayAgo AS (DATE_SUB(CURRENT_TIMESTAMP, 1, "day")) SELECT COUNT(*) FROM (SELECT * FROM sessions LET s = @this WHERE s.startTime >= oneDayAgo OR s.active == true GROUP BY s.userId SELECT 1)`,
    },
    {
        description: 'admin-dashboard-service: Search users by name',
        aql: `FOR u IN users FILTER LOWER(u.loginName) LIKE @term SORT u.updatedAt DESC LIMIT @offset, @limit RETURN { _key: u._key, loginName: u.loginName }`,
        expectedSql: `SELECT * FROM users LET u = @this WHERE lower(u.loginName) LIKE :term ORDER BY u.updatedAt DESC LIMIT :limit OFFSET :offset SELECT u._key AS _key, u.loginName AS loginName`,
    },

    // --- from auth-service.js ---
    {
        description: 'auth-service: Get User by Login Name or Email',
        aql: `FOR u IN users FILTER u.loginName == @loginName OR u.email == @email RETURN u`,
        expectedSql: `SELECT * FROM users LET u = @this WHERE u.loginName == :loginName OR u.email == :email SELECT u`,
    },
    {
        description: 'auth-service: Clean up old verification tokens',
        aql: `FOR t IN verificationTokens FILTER t.userId == 'users/123' AND t.used == false REMOVE t IN verificationTokens`,
        expectedSql: `DELETE FROM verificationTokens WHERE userId == 'users/123' AND used == false`,
    },

    // --- from analytics-service.js ---
    {
        description: 'analytics-service: Get Unique Users Count with DISTINCT',
        aql: `LET usersList = ( FOR a IN analytics FILTER a.type == 'query' AND a.timestamp >= @startDate AND a.timestamp <= @endDate RETURN DISTINCT a.userId ) RETURN LENGTH(usersList)`,
        expectedSql: `WITH usersList AS ((SELECT * FROM analytics LET a = @this WHERE a.type == 'query' AND a.timestamp >= :startDate AND a.timestamp <= :endDate SELECT DISTINCT a.userId)) SELECT size(usersList)`,
    },
    {
        description: 'analytics-service: Get Dashboard Analytics (Complex LET and Subqueries)',
        aql: `LET totalQueriesCount = (FOR a IN analytics FILTER a.type == 'query' COLLECT WITH COUNT INTO count RETURN count)[0] LET feedbackStatsData = (LET feedbacksData = (FOR a IN analytics RETURN a) RETURN { total: LENGTH(feedbacksData) }) RETURN { queries_total: totalQueriesCount, feedback: feedbackStatsData }`,
        expectedSql: `WITH totalQueriesCount AS ((SELECT * FROM analytics LET a = @this WHERE a.type == 'query' SELECT COUNT(*) AS count)[0]), feedbackStatsData AS ((WITH feedbacksData AS ((SELECT * FROM analytics LET a = @this SELECT a)) SELECT size(feedbacksData) AS total)) SELECT totalQueriesCount AS queries_total, feedbackStatsData AS feedback`,
    },

    // --- from chat-history-service.js ---
    {
        description: 'chat-history-service: Get User Conversations (Graph Traversal)',
        aql: `FOR edge IN userConversations FILTER edge._from == @userId LET conversation = DOCUMENT(edge._to) FILTER conversation.isArchived == false SORT conversation.updated DESC LIMIT @offset, @limit RETURN conversation`,
        expectedSql: `WITH conversation AS ((SELECT * FROM undefined WHERE _key = :undefined_key LIMIT 1)) SELECT * FROM (SELECT expand(outE('userConversations').in) FROM :userId WHERE _key = SUBSTRING(:userId, POSITION(:userId, '/') + 1)) WHERE conversation.isArchived == false ORDER BY conversation.updated DESC LIMIT :limit OFFSET :offset SELECT conversation`,
    },
    {
        description: 'chat-history-service: Get Conversation Messages',
        aql: `FOR msg IN messages FILTER msg.conversationId == @conversationId SORT msg.sequence ASC RETURN msg`,
        expectedSql: `SELECT * FROM messages LET msg = @this WHERE msg.conversationId == :conversationId ORDER BY msg.sequence ASC SELECT msg`,
    },
    {
        description: 'chat-history-service: Direct update by key',
        aql: `UPDATE { _key: @msgId, readStatus: true } IN messages`,
        expectedSql: `UPDATE messages SET readStatus = true WHERE _key = :msgId`,
    },

    // --- from service-category-service.js ---
    {
        description: 'service-category-service: Get All Categories with Services (Nested Loops)',
        aql: `FOR category IN serviceCategories SORT category.order ASC LET services = (FOR edge IN categoryServices FILTER edge._from == category._id FOR service IN services FILTER service._id == edge._to RETURN service.name) RETURN { name: category.name, services: services }`,
        expectedSql: `SELECT * FROM serviceCategories LET category = @this ORDER BY category.order ASC WITH services AS ((SELECT * FROM categoryServices LET edge = @this WHERE edge._from == category._id SELECT * FROM services LET service = @this WHERE service._id == edge._to SELECT service.name)) SELECT category.name AS name, services AS services`,
    },
];

// =================================================================
// Test Runner Logic with Detailed Failure Analysis
// =================================================================

class TestRunner {
    constructor() {
        this.total = 0;
        this.passed = 0;
        this.failed = 0;
        this.db = null;
    }

    async initializeDbService() {
        if (!RUN_INTEGRATION_TESTS) return;
        console.log('\n--- Initializing DB Service for Integration Tests ---');
        try {
            this.db = await dbService.getConnection('translator-integration-test');
            console.log(`Successfully got DB connection via service for mode: '${process.env.DB_TYPE}'`);
        } catch (error) {
            console.error('\x1b[31m%s\x1b[0m', `FATAL: Could not get DB connection from service. Integration tests will be skipped.`);
            console.error(error.message);
            this.db = null;
        }
    }

    async run() {
        console.log('--- AQL-to-SQL Translator Test Runner ---');
        await this.initializeDbService();

        for (const test of testSuite) {
            this.total++;
            console.log(`\n[TEST ${this.total}] ${test.description}`);
            console.log(`   AQL: ${test.aql}`);

            try {
                const { sql } = translator.translateQuery(test.aql, {});
                console.log(`-> SQL: ${sql}`);

                if (sql.trim() !== test.expectedSql.trim()) {
                    // MODIFIED: Call detailed failure analysis
                    this.fail(`Translation mismatch!`, test.expectedSql, sql);
                    continue;
                }

                if (RUN_INTEGRATION_TESTS && this.db && test.integration) {
                    await this.runIntegrationTest(test.integration, sql);
                } else {
                    this.pass('Translation successful (Unit Test)');
                }

            } catch (error) {
                this.fail(`An unexpected error occurred during translation.`);
                console.error(error);
            }
        }
        this.printSummary();
        if (this.db) {
            console.log('DB Service connection released.');
        }
    }

    async runIntegrationTest(integration, sql) {
        try {
            if (integration.setup) {
                for (const cmd of [].concat(integration.setup)) {
                    await this.db.query(cmd);
                }
            }
            const result = await this.db.query(sql);
            this.pass(`Translation and Execution successful (Integration Test)`);
        } catch (error) {
            this.fail(`Integration test execution failed!`);
            console.error('  Error:', error.message);
        } finally {
            if (integration.teardown) {
                try {
                    for (const cmd of [].concat(integration.teardown)) {
                        await this.db.query(cmd);
                    }
                } catch (teardownError) {
                    console.error('  WARNING: Teardown failed:', teardownError.message);
                }
            }
        }
    }

    pass(message) {
        console.log('\x1b[32m%s\x1b[0m', `  ✓ PASSED: ${message}`);
        this.passed++;
    }

    // MODIFIED: fail method now accepts expected and actual values for detailed analysis
    fail(message, expected, actual) {
        console.log('\x1b[31m%s\x1b[0m', `  ✗ FAILED: ${message}`);
        this.failed++;
        
        if (expected && actual) {
            console.log('   \x1b[36mExpected:\x1b[0m', expected);
            console.log('   \x1b[36mActual  :\x1b[0m', actual);
            this.analyzeFailure(expected, actual);
        }
    }

    // NEW: Detailed failure analysis function
    analyzeFailure(expected, actual) {
        console.log('   \x1b[33m--- Failure Analysis ---');
        
        // Normalize whitespace for better comparison
        const normExpected = expected.replace(/\s+/g, ' ');
        const normActual = actual.replace(/\s+/g, ' ');

        const checks = [
            { name: 'Missing `GROUP BY` clause', regex: /GROUP BY/, expected: true },
            { name: 'Missing `ORDER BY` clause', regex: /ORDER BY/, expected: true },
            { name: 'Incorrect `LIMIT` translation (should contain OFFSET)', regex: /LIMIT \S+ OFFSET \S+/, expected: true },
            { name: 'Incorrect `SORT` keyword (should be `ORDER BY`)', regex: /\bSORT\b/, expected: false },
            { name: 'Incorrect `COLLECT` keyword (should be `GROUP BY` or similar)', regex: /\bCOLLECT\b/, expected: false },
            { name: 'Missing subquery parentheses `()`', regex: /\(/, expected: true },
            { name: 'Missing `WITH` clause for LET statement', regex: /^WITH/, expected: true },
            { name: 'Missing contextual `LET` clause for FOR loop', regex: /LET \w+ = @this/, expected: true },
            { name: 'Incorrect `REMOVE` translation (should be `DELETE FROM`)', regex: /^DELETE FROM/, expected: true },
            { name: 'Incorrect `UPDATE` translation (should contain `SET`)', regex: /\bSET\b/, expected: true },
            { name: 'Incorrect variable prefixing (e.g., `t.userId` vs `userId`)', regex: /\w+\.userId/, expected: false },
        ];

        let issuesFound = 0;
        for (const check of checks) {
            const expectedMatch = normExpected.match(check.regex);
            const actualMatch = normActual.match(check.regex);

            if (check.expected && expectedMatch && !actualMatch) {
                console.log(`     \x1b[31m- Missing feature:\x1b[0m ${check.name}.`);
                issuesFound++;
            } else if (!check.expected && !expectedMatch && actualMatch) {
                console.log(`     \x1b[31m- Incorrect keyword:\x1b[0m ${check.name}.`);
                issuesFound++;
            }
        }
        
        // Specific check for variable prefixing in Test 8
        if (normActual.includes('t.userId')) {
             console.log(`     \x1b[31m- Incorrect variable prefixing:\x1b[0m Found 't.userId' where 'userId' was expected.`);
             issuesFound++;
        }

        if (issuesFound === 0) {
            console.log('     \x1b[33m- General structure or logic mismatch. Review the query structure and clause order.\x1b[0m');
        }
        console.log('   \x1b[33m--------------------------\x1b[0m');
    }

    printSummary() {
        console.log('\n-----------------------------------------');
        console.log('--- Test Summary ---');
        const color = this.failed > 0 ? '\x1b[31m' : '\x1b[32m';
        console.log(`${color}%s\x1b[0m`, `Total: ${this.total} | Passed: ${this.passed} | Failed: ${this.failed}`);
        console.log('-----------------------------------------');
        if (this.failed > 0) {
            process.exit(1);
        }
    }
}

// --- Run the tests ---
const runner = new TestRunner();
runner.run();