#!/bin/bash

# Kong Fix Routes and Plugins Script
# This script fixes issues with routes and plugins in Kong configuration

echo "=== Fixing Kong Configuration ==="

# Check if service exists
SERVICE_INFO=$(curl -s http://localhost:8001/services/express-api)
if ! echo "$SERVICE_INFO" | grep -q "id"; then
  echo "❌ express-api service doesn't exist. Creating it first..."
  curl -s -X POST http://localhost:8001/services \
    --data "name=express-api" \
    --data "host=e2e-109-51" \
    --data "port=3000" \
    --data "protocol=http" > /dev/null
  echo "✅ express-api service created"
else
  echo "✅ express-api service exists"
fi

# Get service ID
SERVICE_ID=$(curl -s http://localhost:8001/services/express-api | grep -o '"id":"[^"]*"' | head -1 | cut -d':' -f3 | tr -d '"')
echo "Service ID: $SERVICE_ID"

# Fix routes
echo -e "\n[1/2] Fixing routes directly..."

# Admin route
echo "  Creating admin-route..."
curl -X POST http://localhost:8001/routes \
  --data "name=admin-route" \
  --data "service.id=$SERVICE_ID" \
  --data "paths[]=/api/admin" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https"

# Analytics route
echo "  Creating analytics-route..."
curl -X POST http://localhost:8001/routes \
  --data "name=analytics-route" \
  --data "service.id=$SERVICE_ID" \
  --data "paths[]=/api/analytics" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https"

# Authentication routes
echo "  Creating auth-route..."
curl -X POST http://localhost:8001/routes \
  --data "name=auth-route" \
  --data "service.id=$SERVICE_ID" \
  --data "paths[]=/api/auth" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https"

# Database operations routes
echo "  Creating database-operations-route..."
curl -X POST http://localhost:8001/routes \
  --data "name=database-operations-route" \
  --data "service.id=$SERVICE_ID" \
  --data "paths[]=/api/database" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https"

# Logger routes
echo "  Creating logger-route..."
curl -X POST http://localhost:8001/routes \
  --data "name=logger-route" \
  --data "service.id=$SERVICE_ID" \
  --data "paths[]=/api/logger" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https"

# Query routes
echo "  Creating query-route..."
curl -X POST http://localhost:8001/routes \
  --data "name=query-route" \
  --data "service.id=$SERVICE_ID" \
  --data "paths[]=/api/queries" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https"

# Security routes
echo "  Creating security-route..."
curl -X POST http://localhost:8001/routes \
  --data "name=security-route" \
  --data "service.id=$SERVICE_ID" \
  --data "paths[]=/api/security" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https"

# Service category routes
echo "  Creating service-category-route..."
curl -X POST http://localhost:8001/routes \
  --data "name=service-category-route" \
  --data "service.id=$SERVICE_ID" \
  --data "paths[]=/api/service-categories" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https"

# Service routes
echo "  Creating service-route..."
curl -X POST http://localhost:8001/routes \
  --data "name=service-route" \
  --data "service.id=$SERVICE_ID" \
  --data "paths[]=/api/services" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https"

# Session routes
echo "  Creating session-route..."
curl -X POST http://localhost:8001/routes \
  --data "name=session-route" \
  --data "service.id=$SERVICE_ID" \
  --data "paths[]=/api/sessions" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https"

# User routes
echo "  Creating user-route..."
curl -X POST http://localhost:8001/routes \
  --data "name=user-route" \
  --data "service.id=$SERVICE_ID" \
  --data "paths[]=/api/users" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https"

# Fallback route for any other API paths
echo "  Creating api-fallback route..."
curl -X POST http://localhost:8001/routes \
  --data "name=api-fallback" \
  --data "service.id=$SERVICE_ID" \
  --data "paths[]=/api" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https"

echo "✅ Routes created successfully"

# Create plugins
echo -e "\n[2/2] Adding plugins..."

# CORS plugin
echo "  Adding CORS plugin..."
curl -X POST http://localhost:8001/plugins \
  --data "name=cors" \
  --data "service.id=$SERVICE_ID" \
  --data "config.origins=*" \
  --data "config.methods=GET,POST,PUT,PATCH,DELETE,OPTIONS" \
  --data "config.headers=Accept,Accept-Version,Accept-Language,Content-Length,Content-MD5,Content-Type,Date,X-Auth-Token,Authorization,X-Requested-With" \
  --data "config.credentials=true" \
  --data "config.max_age=3600" \
  --data "config.preflight_continue=false"

# Rate limiting plugin
echo "  Adding Rate Limiting plugin..."
curl -X POST http://localhost:8001/plugins \
  --data "name=rate-limiting" \
  --data "service.id=$SERVICE_ID" \
  --data "config.minute=100" \
  --data "config.hour=1000" \
  --data "config.policy=local" \
  --data "config.fault_tolerant=true" \
  --data "config.hide_client_headers=false"

# Fix upstream target
echo -e "\n[+] Fixing upstream target..."
UPSTREAM_ID=$(curl -s http://localhost:8001/upstreams/express-api-servers | grep -o '"id":"[^"]*"' | head -1 | cut -d':' -f3 | tr -d '"')

if [ -z "$UPSTREAM_ID" ]; then
  echo "  Creating upstream express-api-servers..."
  curl -X POST http://localhost:8001/upstreams \
    --data "name=express-api-servers" \
    --data "algorithm=round-robin" \
    --data "slots=10000"
  UPSTREAM_ID=$(curl -s http://localhost:8001/upstreams/express-api-servers | grep -o '"id":"[^"]*"' | head -1 | cut -d':' -f3 | tr -d '"')
fi

echo "  Deleting any existing targets..."
for target_id in $(curl -s http://localhost:8001/upstreams/express-api-servers/targets | grep -o '"id":"[^"]*"' | cut -d':' -f3 | tr -d '"'); do
  curl -X DELETE http://localhost:8001/upstreams/express-api-servers/targets/$target_id > /dev/null
done

echo "  Adding target e2e-109-51:3000..."
curl -X POST http://localhost:8001/upstreams/express-api-servers/targets \
  --data "target=e2e-109-51:3000" \
  --data "weight=100"

echo "✅ Configuration fixes applied successfully"
echo "Please run the test script again to verify the fixes"
