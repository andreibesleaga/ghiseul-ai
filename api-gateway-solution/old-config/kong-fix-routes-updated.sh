#!/bin/bash

# Kong Fix Routes and Plugins Script (Updated)
# This script fixes issues with routes and plugins in Kong configuration

echo "=== Fixing Kong Configuration ==="

# Check if service exists and get its ID properly
echo "Checking express-api service..."
SERVICE_INFO=$(curl -s http://localhost:8001/services/express-api)
SERVICE_ID=$(echo "$SERVICE_INFO" | grep -o '"id":"[^"]*"' | head -1 | cut -d '"' -f 4)

if [ -z "$SERVICE_ID" ]; then
  echo "❌ Cannot find service ID. Service ID appears to be empty or not available."
  echo "Full service info: $SERVICE_INFO"
  echo "Creating service again to ensure it exists..."
  
  CREATE_RESPONSE=$(curl -s -X POST http://localhost:8001/services \
    --data "name=express-api" \
    --data "host=e2e-109-51" \
    --data "port=3000" \
    --data "protocol=http")
  
  SERVICE_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d '"' -f 4)
  
  if [ -z "$SERVICE_ID" ]; then
    echo "❌ Failed to create service. Response: $CREATE_RESPONSE"
    echo "Please check if the service name 'express-api' is already taken."
    echo "Will try using service name directly instead of ID..."
  else
    echo "✅ Created service with ID: $SERVICE_ID"
  fi
else
  echo "✅ Found express-api service with ID: $SERVICE_ID"
fi

# Use service name since ID extraction might be failing
echo -e "\n[1/3] Creating routes using service name..."

# Admin route
echo "  Creating admin-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=admin-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/admin" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Analytics route
echo "  Creating analytics-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=analytics-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/analytics" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Authentication routes
echo "  Creating auth-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=auth-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/auth" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Database operations routes
echo "  Creating database-operations-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=database-operations-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/database" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Logger routes
echo "  Creating logger-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=logger-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/logger" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Query routes
echo "  Creating query-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=query-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/queries" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Security routes
echo "  Creating security-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=security-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/security" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Service category routes
echo "  Creating service-category-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=service-category-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/service-categories" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Service routes
echo "  Creating service-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=service-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/services" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Session routes
echo "  Creating session-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=session-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/sessions" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# User routes
echo "  Creating user-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=user-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/users" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Fallback route for any other API paths
echo "  Creating api-fallback route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=api-fallback" \
  --data "service.name=express-api" \
  --data "paths[]=/api" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

echo "✅ Routes creation attempted"

# Create plugins
echo -e "\n[2/3] Adding plugins using service name..."

# CORS plugin
echo "  Adding CORS plugin..."
curl -s -X POST http://localhost:8001/plugins \
  --data "name=cors" \
  --data "service.name=express-api" \
  --data "config.origins=*" \
  --data "config.methods=GET" \
  --data "config.methods=POST" \
  --data "config.methods=PUT" \
  --data "config.methods=PATCH" \
  --data "config.methods=DELETE" \
  --data "config.methods=OPTIONS" \
  --data "config.headers=Accept" \
  --data "config.headers=Accept-Version" \
  --data "config.headers=Accept-Language" \
  --data "config.headers=Content-Length" \
  --data "config.headers=Content-MD5" \
  --data "config.headers=Content-Type" \
  --data "config.headers=Date" \
  --data "config.headers=X-Auth-Token" \
  --data "config.headers=Authorization" \
  --data "config.headers=X-Requested-With" \
  --data "config.credentials=true" \
  --data "config.max_age=3600" \
  --data "config.preflight_continue=false" > /dev/null

# Rate limiting plugin
echo "  Adding Rate Limiting plugin..."
curl -s -X POST http://localhost:8001/plugins \
  --data "name=rate-limiting" \
  --data "service.name=express-api" \
  --data "config.minute=100" \
  --data "config.hour=1000" \
  --data "config.policy=local" \
  --data "config.fault_tolerant=true" \
  --data "config.hide_client_headers=false" > /dev/null

# Fix upstream target
echo -e "\n[3/3] Fixing upstream target..."

# Check if upstream exists
UPSTREAM_INFO=$(curl -s http://localhost:8001/upstreams/express-api-servers)
if ! echo "$UPSTREAM_INFO" | grep -q "id"; then
  echo "  Creating upstream express-api-servers..."
  curl -s -X POST http://localhost:8001/upstreams \
    --data "name=express-api-servers" \
    --data "algorithm=round-robin" \
    --data "slots=10000" > /dev/null
else
  echo "  Upstream express-api-servers already exists"
fi

# First, delete any active and inactive targets
ACTIVE_TARGETS=$(curl -s http://localhost:8001/upstreams/express-api-servers/targets)
if echo "$ACTIVE_TARGETS" | grep -q "e2e-109-51:3000"; then
  echo "  Target e2e-109-51:3000 already exists"
else
  echo "  Adding target e2e-109-51:3000..."
  curl -s -X POST http://localhost:8001/upstreams/express-api-servers/targets \
    --data "target=e2e-109-51:3000" \
    --data "weight=100" > /dev/null
fi

echo -e "\n✅ Configuration fixes applied successfully"
echo "Verifying routes..."
ROUTES=$(curl -s http://localhost:8001/services/express-api/routes | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
if [ -z "$ROUTES" ]; then
  echo "❌ No routes found for express-api service"
else
  echo "✅ Found the following routes:"
  echo "$ROUTES" | sort | uniq | sed 's/^/  - /'
fi

echo "Verifying plugins..."
PLUGINS=$(curl -s http://localhost:8001/services/express-api/plugins | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
if [ -z "$PLUGINS" ]; then
  echo "❌ No plugins found for express-api service"
else
  echo "✅ Found the following plugins:"
  echo "$PLUGINS" | sort | uniq | sed 's/^/  - /'
fi

echo -e "\nPlease run the test script to verify the complete configuration:"
echo "./kong-test-script.sh"
