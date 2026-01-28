#!/bin/bash
set -e

# setup_genie_env.sh
# Script to setup initial DB and configurations for GENIE.AI (Steps 4-7 of Installation Guide)
# Should be run AFTER 'start-6gb-gpu.sh' or 'docker compose up' has started the containers.

echo "=================================================="
echo "GENIE.AI Initial Environment Setup Script"
echo "Based on Installation & Configuration Guide (Steps 4-7)"
echo "=================================================="

# Directories
REPO_ROOT="$(pwd)"
SCRIPTS_DIR="$REPO_ROOT/components/gov-chat-backend/scripts/new-schema-scripts"
KONG_CONFIG_DIR="$REPO_ROOT/api-gateway-solution/new-config"

# Check dependencies
echo "Checking dependencies..."
if ! command -v jq &> /dev/null; then
    echo "jq is required but not installed. Installing jq..."
    sudo apt-get update && sudo apt-get install -y jq
fi
if ! command -v npm &> /dev/null; then
    echo "npm is required but not installed. Please install Node.js and npm first."
    exit 1
fi

# Load Environment Variables from .env if needed
if [ -f "$REPO_ROOT/.env" ]; then
    export $(grep -v '^#' "$REPO_ROOT/.env" | xargs)
fi

echo "=================================================="
echo "Step 4: Infrastructure Configuration"
echo "=================================================="

# 4.1 ArangoDB Database Initialization
echo "--> 4.1 Initializing ArangoDB database 'genie-ai'..."
# Wait for ArangoDB to be ready (just in case)
echo "Waiting for ArangoDB..."
ARANGO_HOST="http://127.0.0.1:8529"
until curl -s -f -u root:${ARANGO_PASSWORD} "$ARANGO_HOST/_api/version" > /dev/null; do
    echo "  ArangoDB not ready yet. Retrying in 2s..."
    sleep 2
done

# Check if DB exists, if not create it
DB_CHECK=$(curl -s -u root:${ARANGO_PASSWORD} "$ARANGO_HOST/_api/database/genie-ai" | jq .error)
if [ "$DB_CHECK" == "true" ]; then
    echo "  Creating database 'genie-ai'..."
    curl -s -f -X POST -u root:${ARANGO_PASSWORD} "$ARANGO_HOST/_api/database" \
        -d '{"name": "genie-ai"}' \
        -H "Content-Type: application/json"
    echo "  Database 'genie-ai' created."
else
    echo "  Database 'genie-ai' already exists."
fi

# 4.2 Kong API Gateway Configuration
echo "--> 4.2 Configuring Kong API Gateway..."

echo "  Bootstrapping Kong database (Postgres)..."
# We use 'docker compose' or 'docker-compose' depending on availability
DOCKER_COMPOSE="docker compose"
if ! $DOCKER_COMPOSE version &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
fi

$DOCKER_COMPOSE exec -T kong-database psql -U kong postgres -c "CREATE DATABASE kong;" || true
$DOCKER_COMPOSE exec -T kong-database psql -U kong postgres -c "GRANT ALL PRIVILEGES ON DATABASE kong TO kong;" || true
$DOCKER_COMPOSE run --rm kong kong migrations bootstrap || true
$DOCKER_COMPOSE restart kong
echo "  Waiting for Kong to restart..."
sleep 10

echo "  Applying Kong Configuration using manage-kong-config.sh..."
cd "$KONG_CONFIG_DIR"
chmod +x manage-kong-config.sh

# Inputs for the script:
# Kong Host: localhost
# Kong Port: 8001
# Express API Host: backend
# Express API Port: 3000
# Doc Repo Host: document-repository
# Doc Repo Port: 3001
INPUTS="localhost
8001
backend
3000
document-repository
3001"

echo "$INPUTS" | ./manage-kong-config.sh -a

echo "  Fixing Auth Routes (Step 4.2 Fix)..."
echo "$INPUTS" | ./manage-kong-config.sh -f

cd "$REPO_ROOT"

# 4.3 Nginx Configuration (Single Node Default)
echo "--> 4.3 Setting up Nginx Configuration..."
if [ -f "$REPO_ROOT/api-gateway-solution/nginx/default.conf-single-node" ]; then
    cp "$REPO_ROOT/api-gateway-solution/nginx/default.conf-single-node" "$REPO_ROOT/api-gateway-solution/nginx/default.conf"
    echo "  Copied default.conf-single-node to default.conf"
else
    echo "  Warning: default.conf-single-node not found. Skipping."
fi


echo "=================================================="
echo "Step 5: Knowledge Base Population & User Setup"
echo "=================================================="

# 5.1 Prepare Script Environment
echo "--> 5.1 Preparing Schema Scripts..."
cd "$SCRIPTS_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing arangojs..."
    npm install arangojs
fi

# 5.2 Create Database Schema
echo "--> 5.2 Creating Database Schema..."
# ARANGO_URL needs to be localhost for the script running on host
export ARANGO_URL="http://127.0.0.1:8529" 
export ARANGO_DATABASE="genie-ai"
export ARANGO_USER="root"
# Password is loaded from .env above

node arango-schema-creator.js ./arango-schema.json

# 5.3 Create Initial User Accounts
echo "--> 5.3 Creating Initial User Accounts..."
# Pipe 'Y' to confirm execution
echo "Y" | node create-genie-ai-admin-account.js
echo "Y" | node create-genie-ai-manager-account.js

cd "$REPO_ROOT"


echo "=================================================="
echo "Step 6: Final Verification and Launch"
echo "=================================================="
echo "Restarting services to ensure all configs are picked up..."
$DOCKER_COMPOSE down
$DOCKER_COMPOSE up -d

echo "=================================================="
echo "Setup Complete!"
echo "You can now proceed to Step 7 (Post-Launch Configuration) using the Admin Dashboard."
echo "Admin Dashboard: http://localhost:8091" # Frontend port usually 8091 per .env
echo "Login: Admin / ADMINadmin (or as set in script logs)"
echo "=================================================="
