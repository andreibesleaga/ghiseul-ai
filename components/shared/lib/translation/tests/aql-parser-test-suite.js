/**
 * @file aql-parser-test-suite.js
 * @description Main test runner for the AQL parser. It imports and runs tests
 * from individual statement test files.
 */

// Assuming aql-parser.js is in the same directory or accessible via module resolution.
const { AqlParser } = require('../aql-parser.js');
const { getForStatementTests } = require('./aql-for-parser-test.js');
const { getFilterStatementTests } = require('./aql-filter-parser-test.js');
const { getSortStatementTests } = require('./aql-sort-parser-test.js');
const { getLimitStatementTests } = require('./aql-limit-parser-test.js');
const { getLetStatementTests } = require('./aql-let-parser-test.js');

// --- Test Runner Logic ---

class TestRunner {
    constructor() {
        this.parser = new AqlParser();
        this.total = 0;
        this.passed = 0;
        this.failed = 0;
    }

    // A simple deep object comparison function for validation
    isEqual(obj1, obj2) {
        return JSON.stringify(obj1) === JSON.stringify(obj2);
    }

    run(testSuiteName, tests) {
        console.log(`\n--- Running: ${testSuiteName} ---`);

        for (const test of tests) {
            this.total++;
            let result;
            try {
                const ir = this.parser.parse(test.aql);
                
                result = ir.body; 

                const expected = Array.isArray(test.expected) ? test.expected : [test.expected];

                if (this.isEqual(result, expected)) {
                    this.passed++;
                } else {
                    this.failed++;
                    console.log(`  ✗ FAILED: ${test.description}`);
                    console.log(`     AQL: ${test.aql}`);
                    console.log(`     Expected: ${JSON.stringify(expected, null, 2)}`);
                    console.log(`     Actual:   ${JSON.stringify(result, null, 2)}`);
                }
            } catch (error) {
                this.failed++;
                console.log(`  ✗ ERROR: ${test.description}`);
                console.log(`     AQL: ${test.aql}`);
                console.error(error);
            }
        }
    }

    printSummary() {
        console.log('\n-----------------------------------------');
        console.log('--- Parser Test Summary ---');
        const color = this.failed > 0 ? '\x1b[31m' : '\x1b[32m';
        console.log(`${color}%s\x1b[0m`, `Total: ${this.total} | Passed: ${this.passed} | Failed: ${this.failed}`);
        console.log('-----------------------------------------');
        if (this.failed > 0) {
            process.exit(1); // Exit with error code if any tests fail
        }
    }
}

// --- Main Execution ---

const runner = new TestRunner();

const allTests = [
    { name: 'FOR Statement Tests', tests: getForStatementTests() },
    { name: 'FILTER Statement Tests', tests: getFilterStatementTests() },
    { name: 'SORT Statement Tests', tests: getSortStatementTests() },
    { name: 'LIMIT Statement Tests', tests: getLimitStatementTests() },
    { name: 'LET Statement Tests', tests: getLetStatementTests() }
];

allTests.forEach(({ name, tests }) => {
    runner.run(name, tests);
});

runner.printSummary();
