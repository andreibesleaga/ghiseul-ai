#!/bin/bash

# Kong Configuration Script for Express API on port 3000
# This script configures Kong to proxy requests to e2e-109-51:3000

echo "=== Starting Kong Configuration ==="
echo "Target Express API: e2e-109-51:3000"

# Create express-api service
echo -e "\n[1/3] Creating express-api service..."
curl -s -X POST http://localhost:8001/services \
  --data "name=express-api" \
  --data "host=e2e-109-51" \
  --data "port=3000" \
  --data "protocol=http" \
  --data "connect_timeout=60000" \
  --data "read_timeout=60000" \
  --data "write_timeout=60000" \
  --data "retries=5" > /dev/null

if [ $? -eq 0 ]; then
  echo "✅ Service created successfully"
else
  echo "❌ Failed to create service"
  exit 1
fi

# Create routes
echo -e "\n[2/3] Creating routes..."

# Admin route
echo "  Creating admin-route..."
curl -s -X POST http://localhost:8001/services/express-api/routes \
  --data "name=admin-route" \
  --data "paths[]=/api/admin" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Analytics route
echo "  Creating analytics-route..."
curl -s -X POST http://localhost:8001/services/express-api/routes \
  --data "name=analytics-route" \
  --data "paths[]=/api/analytics" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Authentication routes
echo "  Creating auth-route..."
curl -s -X POST http://localhost:8001/services/express-api/routes \
  --data "name=auth-route" \
  --data "paths[]=/api/auth" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Database operations routes
echo "  Creating database-operations-route..."
curl -s -X POST http://localhost:8001/services/express-api/routes \
  --data "name=database-operations-route" \
  --data "paths[]=/api/database" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Logger routes
echo "  Creating logger-route..."
curl -s -X POST http://localhost:8001/services/express-api/routes \
  --data "name=logger-route" \
  --data "paths[]=/api/logger" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Query routes
echo "  Creating query-route..."
curl -s -X POST http://localhost:8001/services/express-api/routes \
  --data "name=query-route" \
  --data "paths[]=/api/queries" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Security routes
echo "  Creating security-route..."
curl -s -X POST http://localhost:8001/services/express-api/routes \
  --data "name=security-route" \
  --data "paths[]=/api/security" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Service category routes
echo "  Creating service-category-route..."
curl -s -X POST http://localhost:8001/services/express-api/routes \
  --data "name=service-category-route" \
  --data "paths[]=/api/service-categories" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Service routes
echo "  Creating service-route..."
curl -s -X POST http://localhost:8001/services/express-api/routes \
  --data "name=service-route" \
  --data "paths[]=/api/services" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Session routes
echo "  Creating session-route..."
curl -s -X POST http://localhost:8001/services/express-api/routes \
  --data "name=session-route" \
  --data "paths[]=/api/sessions" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# User routes
echo "  Creating user-route..."
curl -s -X POST http://localhost:8001/services/express-api/routes \
  --data "name=user-route" \
  --data "paths[]=/api/users" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Fallback route for any other API paths
echo "  Creating api-fallback route..."
curl -s -X POST http://localhost:8001/services/express-api/routes \
  --data "name=api-fallback" \
  --data "paths[]=/api" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

echo "✅ All routes created successfully"

# Create plugins
echo -e "\n[3/3] Adding plugins..."

# CORS plugin
echo "  Adding CORS plugin..."
curl -s -X POST http://localhost:8001/services/express-api/plugins \
  --data "name=cors" \
  --data "config.origins=*" \
  --data "config.methods=GET,POST,PUT,PATCH,DELETE,OPTIONS" \
  --data "config.headers=Accept,Accept-Version,Accept-Language,Content-Length,Content-MD5,Content-Type,Date,X-Auth-Token,Authorization,X-Requested-With" \
  --data "config.credentials=true" \
  --data "config.max_age=3600" \
  --data "config.preflight_continue=false" > /dev/null

# Rate limiting plugin
echo "  Adding Rate Limiting plugin..."
curl -s -X POST http://localhost:8001/services/express-api/plugins \
  --data "name=rate-limiting" \
  --data "config.minute=100" \
  --data "config.hour=1000" \
  --data "config.policy=local" \
  --data "config.fault_tolerant=true" \
  --data "config.hide_client_headers=false" > /dev/null

# Request transformer plugin
echo "  Adding Request Transformer plugin..."
curl -s -X POST http://localhost:8001/services/express-api/plugins \
  --data "name=request-transformer" \
  --data "config.add.headers[]=X-Kong-Proxy: true" > /dev/null

# Response transformer plugin
echo "  Adding Response Transformer plugin..."
curl -s -X POST http://localhost:8001/services/express-api/plugins \
  --data "name=response-transformer" \
  --data "config.add.headers[]=X-Powered-By: Kong" \
  --data "config.add.headers[]=X-Kong-Proxy-Latency: \${latency}" > /dev/null

# Request termination plugin (disabled by default)
echo "  Adding Request Termination plugin (disabled)..."
curl -s -X POST http://localhost:8001/services/express-api/plugins \
  --data "name=request-termination" \
  --data "config.status_code=503" \
  --data "config.message=API is currently under maintenance. Please try again later." \
  --data "enabled=false" > /dev/null

# File log plugin
echo "  Adding File Log plugin..."
curl -s -X POST http://localhost:8001/services/express-api/plugins \
  --data "name=file-log" \
  --data "config.path=/var/log/kong/api.log" \
  --data "config.reopen=true" > /dev/null

echo "✅ All plugins added successfully"

# Create upstream
echo -e "\n[+] Creating upstream and target..."
curl -s -X POST http://localhost:8001/upstreams \
  --data "name=express-api-servers" \
  --data "algorithm=round-robin" \
  --data "slots=10000" > /dev/null

# Add target to the upstream
curl -s -X POST http://localhost:8001/upstreams/express-api-servers/targets \
  --data "target=e2e-109-51:3000" \
  --data "weight=100" > /dev/null

echo "✅ Upstream and target created successfully"

# Verify configuration
echo -e "\n=== Verifying Configuration ==="
echo "Services:"
curl -s http://localhost:8001/services | grep -o '"name":"[^"]*"' | cut -d':' -f3 | tr -d '"'

echo -e "\nRoutes:"
curl -s http://localhost:8001/routes | grep -o '"name":"[^"]*"' | cut -d':' -f3 | tr -d '"'

echo -e "\nPlugins:"
curl -s http://localhost:8001/plugins | grep -o '"name":"[^"]*"' | cut -d':' -f3 | tr -d '"' | sort | uniq -c

echo -e "\n=== Configuration Complete ==="
echo "Your Express API on e2e-109-51:3000 should now be accessible through Kong at:"
echo "  - http://localhost:8000/api/..."
echo "  - https://localhost:8443/api/... (if SSL is configured)"
echo -e "\nTest your configuration with:"
echo "  curl -i http://localhost:8000/api/users"
echo "  curl -i http://localhost:8000/api/admin/system-health"
