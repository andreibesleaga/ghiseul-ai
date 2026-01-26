// stress-test.js - a multi-threaded stress tester for the new polyglot database connecftion service
const { fork } = require('child_process');
const path = require('path');

// --- Configuration ---
const NUM_WORKERS = 500; // Number of independent services to simulate
const POLL_INTERVAL_SECONDS = 5; // How often to check health
const TEST_DURATION_SECONDS = 1200; // How long the test should run

console.log('--- Database Connection Service INTEGRATION Test ---');
console.log(`!!! IMPORTANT: This test requires a LIVE database connection. !!!`);
console.log(`Testing in '${process.env.DB_TYPE || 'arango'}' mode.`);
console.log(`Simulating ${NUM_WORKERS} services for ${TEST_DURATION_SECONDS} seconds...`);
console.log('--------------------------------------------------');

if (!process.env.DB_TYPE) {
    console.error("FATAL: DB_TYPE environment variable is not set. Exiting.");
    process.exit(1);
}

const workers = [];
const workerStats = {};

// --- Test Summary Reporting ---
let totalChecks = 0;
let successfulChecks = 0;
let failedChecks = 0;
let isExiting = false;

function printSummaryAndExit() {
    // Prevent this function from running multiple times during shutdown
    if (isExiting) return;
    isExiting = true;

    console.log('\n--------------------------------------------------');
    console.log('--- Test Summary ---');
    console.log(`Database Mode: ${process.env.DB_TYPE}`);
    console.log(`Test Duration: ${TEST_DURATION_SECONDS} seconds`);
    console.log(`Total Health Checks Performed: ${totalChecks}`);
    console.log(`Successful Checks: ${successfulChecks}`);
    console.log(`Failed Checks: ${failedChecks}`);
    console.log('--------------------------------------------------');

    // --- ROBUST WORKER CLEANUP ---
    const activeWorkers = workers.filter(w => !w.killed);
    let workersToKill = activeWorkers.length;

    if (workersToKill === 0) {
        console.log('All workers already terminated. Exiting.');
        process.exit(0);
    }

    console.log(`Terminating ${workersToKill} active worker processes...`);

    activeWorkers.forEach(worker => {
        // Listen for the 'exit' event on each worker
        worker.on('exit', () => {
            workersToKill--;
            console.log(`Worker PID ${worker.pid} terminated. ${workersToKill} remaining.`);
            if (workersToKill === 0) {
                console.log('All workers terminated successfully. Test finished.');
                process.exit(0);
            }
        });
        // Send the termination signal
        worker.kill('SIGTERM');
    });

    // Failsafe: If workers don't exit after 5 seconds, force exit the main process
    setTimeout(() => {
        console.error('Failsafe timeout reached. Some workers may not have terminated. Forcing exit.');
        process.exit(1);
    }, 5000);
}

// --- Spawn Worker Processes ---
for (let i = 0; i < NUM_WORKERS; i++) {
    const workerId = `Service-${i + 1}`;
    const workerEnv = { ...process.env, WORKER_ID: workerId };

    // This now forks the worker directly without any mocking.
    const worker = fork(path.join(__dirname, 'test-worker.js'), { env: workerEnv });
    
    // Initialize stats object immediately to prevent crash on premature exit
    workerStats[worker.pid] = { id: workerId, status: 'Spawning...', checks: 0, failures: 0 };

    worker.on('message', (message) => {
        if (message.status === 'ready') {
            console.log(`[${workerId}] is ready and connected.`);
            workerStats[worker.pid].status = 'Connected';
        }
        if (message.status === 'health_report') {
            totalChecks++;
            workerStats[worker.pid].checks++;
            if (message.healthy) {
                successfulChecks++;
                workerStats[worker.pid].status = `Healthy (Latency: ${message.latency}ms)`;
            } else {
                failedChecks++;
                workerStats[worker.pid].failures++;
                workerStats[worker.pid].status = `UNHEALTHY: ${message.error}`;
            }
        }
    });

    worker.on('exit', (code) => {
        console.error(`[${workerId}] exited unexpectedly with code ${code}.`);
        workerStats[worker.pid].status = 'Exited';
    });
    
    worker.on('error', (err) => {
        console.error(`[${workerId}] encountered an error:`, err);
    });

    workers.push(worker);
}

// --- Health Check Polling ---
const pollingInterval = setInterval(() => {
    console.log('\n--- Performing Health Checks ---');
    workers.forEach(worker => {
        if (!worker.killed) {
            worker.send({ command: 'health-check' });
        }
    });
    // Log current status table
    setTimeout(() => console.table(Object.values(workerStats)), 500);
}, POLL_INTERVAL_SECONDS * 1000);


// --- Test Duration Timer ---
const mainTimeout = setTimeout(() => {
    console.log('\nTest duration reached. Shutting down...');
    clearInterval(pollingInterval);
    printSummaryAndExit();
}, TEST_DURATION_SECONDS * 1000);


// --- GRACEFUL SHUTDOWN HANDLING ---
// Ensure all workers are terminated if the main process is interrupted.
function gracefulShutdown(signal) {
    console.log(`\n[Main Process] Received ${signal}. Shutting down gracefully...`);
    clearTimeout(mainTimeout);
    clearInterval(pollingInterval);
    printSummaryAndExit();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Catches Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Catches `kill` command
