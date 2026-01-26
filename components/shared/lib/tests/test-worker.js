// test-worker.js - tests the real polyglot database connection service (worker thread)

const dbService = require('../db-connection-service-polyglot');
const workerId = process.env.WORKER_ID || 'UnknownWorker';

let dbConnection;

async function initialize() {
    try {
        // Each worker gets its own named connection from the mocked service
        dbConnection = await dbService.getConnection(workerId);
        process.send({ status: 'ready' });
    } catch (error) {
        console.error(`[${workerId}] Failed to get initial DB connection:`, error);
        process.exit(1);
    }
}

async function performHealthCheck() {
    if (!dbConnection) {
        process.send({ status: 'health_report', healthy: false, error: 'No DB connection object' });
        return;
    }

    const startTime = Date.now();
    try {
        // Use a method that exists on both the real driver and our adapter
        await dbConnection.query('RETURN 1');
        const latency = Date.now() - startTime;
        process.send({ status: 'health_report', healthy: true, latency });
    } catch (error) {
        const latency = Date.now() - startTime;
        process.send({ status: 'health_report', healthy: false, error: error.message, latency });
    }
}

// Listen for commands from the main runner
process.on('message', (message) => {
    if (message.command === 'health-check') {
        performHealthCheck();
    }
});

// Initialize the worker
initialize();
