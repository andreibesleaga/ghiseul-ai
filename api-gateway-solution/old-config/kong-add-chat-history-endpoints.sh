#!/bin/bash

# Kong Chat History Routes Script
# This script adds chat history routes to the existing Kong configuration
# Created on: May 13, 2025

echo "=== Adding Chat History Routes to Kong Configuration ==="

# Check if service exists
echo "Checking express-api service..."
SERVICE_INFO=$(curl -s http://localhost:8001/services/express-api)
if ! echo "$SERVICE_INFO" | grep -q "id"; then
  echo "❌ Service express-api does not exist. Please run the kong-fix-routes-updated.sh script first."
  exit 1
else
  echo "✅ Found express-api service"
fi

# Create chat history route
echo -e "\n[1/3] Creating chat history route..."
echo "  Creating chat-history-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=chat-history-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/chat" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Verify route creation
ROUTE_CHECK=$(curl -s http://localhost:8001/routes/chat-history-route)
if echo "$ROUTE_CHECK" | grep -q "id"; then
  echo "✅ Chat history route created successfully"
else
  echo "❌ Failed to create chat history route"
  echo "Attempting to check if route already exists by different path..."
  EXISTING_ROUTES=$(curl -s http://localhost:8001/services/express-api/routes | grep -o '"paths":\[\"/api/chat\"\]')
  if [ -n "$EXISTING_ROUTES" ]; then
    echo "  Note: A route for /api/chat already exists"
  fi
fi

# Create route-specific plugins
echo -e "\n[2/3] Adding plugins for chat history route..."

# Check if route exists before adding plugins
if curl -s http://localhost:8001/routes/chat-history-route | grep -q "id"; then
  # Add plugins to the route
  echo "  Adding CORS plugin to chat-history-route..."
  curl -s -X POST http://localhost:8001/routes/chat-history-route/plugins \
    --data "name=cors" \
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

  echo "  Adding Rate Limiting plugin to chat-history-route..."
  curl -s -X POST http://localhost:8001/routes/chat-history-route/plugins \
    --data "name=rate-limiting" \
    --data "config.minute=100" \
    --data "config.hour=1000" \
    --data "config.policy=local" \
    --data "config.fault_tolerant=true" \
    --data "config.hide_client_headers=false" > /dev/null

  echo "  Adding File Log plugin to chat-history-route..."
  curl -s -X POST http://localhost:8001/routes/chat-history-route/plugins \
    --data "name=file-log" \
    --data "config.path=/var/log/kong/api.log" \
    --data "config.reopen=true" > /dev/null
  
  echo "✅ Plugins added to chat-history-route"
else
  echo "❌ Cannot add plugins: chat-history-route not found"
fi

# Ensure upstream target is properly configured
echo -e "\n[3/3] Verifying upstream target configuration..."

# Check if the upstream exists
UPSTREAM_INFO=$(curl -s http://localhost:8001/upstreams/express-api-servers)
if ! echo "$UPSTREAM_INFO" | grep -q "id"; then
  echo "  Creating upstream express-api-servers..."
  curl -s -X POST http://localhost:8001/upstreams \
    --data "name=express-api-servers" \
    --data "algorithm=round-robin" \
    --data "slots=10000" > /dev/null
  
  echo "  Adding target e2e-109-51:3000 to express-api-servers..."
  curl -s -X POST http://localhost:8001/upstreams/express-api-servers/targets \
    --data "target=e2e-109-51:3000" \
    --data "weight=100" > /dev/null
else
  echo "  Upstream express-api-servers already exists"
  
  # Check if the target exists
  TARGETS=$(curl -s http://localhost:8001/upstreams/express-api-servers/targets/active)
  if echo "$TARGETS" | grep -q "e2e-109-51:3000"; then
    echo "  Target e2e-109-51:3000 already exists"
  else
    echo "  Adding target e2e-109-51:3000 to express-api-servers..."
    curl -s -X POST http://localhost:8001/upstreams/express-api-servers/targets \
      --data "target=e2e-109-51:3000" \
      --data "weight=100" > /dev/null
  fi
fi

echo -e "\n=== Verification ==="
echo "Verifying all routes for express-api service..."
ROUTES=$(curl -s http://localhost:8001/services/express-api/routes | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
if [ -z "$ROUTES" ]; then
  echo "❌ No routes found for express-api service"
else
  echo "✅ Found the following routes:"
  echo "$ROUTES" | sort | uniq | sed 's/^/  - /'
fi

echo -e "\nVerifying plugins for chat-history-route..."
PLUGINS=$(curl -s http://localhost:8001/routes/chat-history-route/plugins | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
if [ -z "$PLUGINS" ]; then
  echo "  No route-specific plugins found for chat-history-route"
  echo "  This is normal if the service-level plugins are being used instead"
else
  echo "✅ Found the following plugins for chat-history-route:"
  echo "$PLUGINS" | sort | uniq | sed 's/^/  - /'
fi

echo -e "\nVerifying upstream targets..."
TARGETS=$(curl -s http://localhost:8001/upstreams/express-api-servers/targets/active | grep -o '"target":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TARGETS" ]; then
  echo "❌ No active targets found for express-api-servers"
else
  echo "✅ Found the following active targets:"
  echo "$TARGETS" | sort | uniq | sed 's/^/  - /'
fi

echo -e "\n=== Summary ==="
echo "Chat history routes have been added to Kong"
echo "The new API endpoints are accessible at: /api/chat/*"
echo "Example endpoints:"
echo "  - GET    /api/chat/conversations"
echo "  - GET    /api/chat/conversations/{conversationId}"
echo "  - POST   /api/chat/conversations"
echo "  - GET    /api/chat/search"
echo "  - GET    /api/chat/recent"
echo "  - GET    /api/chat/stats"
