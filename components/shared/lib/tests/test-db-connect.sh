#!/bin/bash

# =================================================================
# Integration Test Runner for Polyglot Database Service
# =================================================================
# This script configures and runs the multi-process integration test
# against a LIVE, RUNNING database instance.
#
# INSTRUCTIONS:
# 1.  Fill in the connection details for the database you want to test below.
# 2.  Set the DB_TYPE variable to either "arango" or "arcade".
# 3.  Make this script executable: `chmod +x run-integration-test.sh`
# 4.  Run the script: `./run-integration-test.sh`
# =================================================================

echo "Setting up environment for LIVE database integration test..."

# --- Configure ArangoDB Connection ---
# (Used when DB_TYPE is set to 'arango')
export ARANGO_URL="http://localhost:8529"
export ARANGO_DB="test-node-services"
export ARANGO_USER="root"
export ARANGO_PASSWORD="test" # <-- IMPORTANT: SET YOUR PASSWORD

# --- Configure ArcadeDB Connection ---
# (Used when DB_TYPE is set to 'arcade')
export ARCADE_URL="http://localhost:2480"
export ARCADE_DB="mynewdb" # <-- IMPORTANT: SET YOUR DATABASE NAME
export ARCADE_USER="root"
export ARCADE_PASSWORD="playwithdata" # <-- IMPORTANT: SET YOUR PASSWORD


# --- CHOOSE THE DATABASE TO TEST ---
# Change this value to 'arango' to test against ArangoDB
#export DB_TYPE="arcade"
export DB_TYPE="arango"


# --- Run the Test ---
echo "Starting integration test against '${DB_TYPE}'..."
echo "--------------------------------------------------"

node stress-test.js

# --- Cleanup ---
echo "--------------------------------------------------"
echo "Test run complete. Unsetting environment variables."

unset ARANGO_URL
unset ARANGO_DB
unset ARANGO_USER
unset ARANGO_PASSWORD
unset ARCADE_URL
unset ARCADE_DB
unset ARCADE_USER
unset ARCADE_PASSWORD
unset DB_TYPE