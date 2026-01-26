#!/bin/bash

# Kong Test Script
# Use this script to test your Kong configuration

echo "=== Testing Kong Configuration ==="

# Check if Kong is running
echo "Checking if Kong Admin API is accessible..."
KONG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001)
if [ "$KONG_STATUS" != "200" ]; then
  echo "❌ Kong Admin API is not accessible at http://localhost:8001"
  echo "Make sure Kong is running and the admin API is exposed on port 8001"
  exit 1
else
  echo "✅ Kong Admin API is accessible"
fi

# Testing express-api service configuration
echo -e "\nChecking express-api service configuration..."
SERVICE_INFO=$(curl -s http://localhost:8001/services/express-api)
if echo "$SERVICE_INFO" | grep -q "host.*e2e-109-51" && echo "$SERVICE_INFO" | grep -q "port.*3000"; then
  echo "✅ express-api service is properly configured"
else
  echo "❌ express-api service is not properly configured or doesn't exist"
  echo "Service info: $SERVICE_INFO"
fi

# Testing routes
echo -e "\nChecking routes..."
ROUTES=$(curl -s http://localhost:8001/services/express-api/routes | grep -o '"name":"[^"]*"' | cut -d':' -f3 | tr -d '"')
if [ -z "$ROUTES" ]; then
  echo "❌ No routes found for express-api service"
else
  echo "✅ Found the following routes:"
  echo "$ROUTES" | sed 's/^/  - /'
fi

# Testing plugins
echo -e "\nChecking plugins..."
PLUGINS=$(curl -s http://localhost:8001/services/express-api/plugins | grep -o '"name":"[^"]*"' | cut -d':' -f3 | tr -d '"')
if [ -z "$PLUGINS" ]; then
  echo "❌ No plugins found for express-api service"
else
  echo "✅ Found the following plugins:"
  echo "$PLUGINS" | sed 's/^/  - /'
fi

# Testing upstream and target
echo -e "\nChecking upstream configuration..."
UPSTREAM_INFO=$(curl -s http://localhost:8001/upstreams/express-api-servers)
if echo "$UPSTREAM_INFO" | grep -q "name.*express-api-servers"; then
  echo "✅ express-api-servers upstream is properly configured"
  
  TARGETS=$(curl -s http://localhost:8001/upstreams/express-api-servers/targets | grep -o '"target":"[^"]*"' | cut -d':' -f3 | tr -d '"')
  if echo "$TARGETS" | grep -q "e2e-109-51:3000"; then
    echo "✅ Target e2e-109-51:3000 is properly configured"
  else
    echo "❌ Target e2e-109-51:3000 is not properly configured or doesn't exist"
    echo "Targets: $TARGETS"
  fi
else
  echo "❌ express-api-servers upstream is not properly configured or doesn't exist"
fi

# Test HTTP endpoints through Kong
echo -e "\nTesting API endpoints through Kong proxy..."

echo -e "\n1. Testing /api/health endpoint..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health)
echo "  Status code: $HEALTH_STATUS"

echo -e "\n2. Testing /api/users endpoint..."
USERS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/users)
echo "  Status code: $USERS_STATUS"

echo -e "\n3. Testing /api/admin/system-health endpoint..."
ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/admin/system-health)
echo "  Status code: $ADMIN_STATUS"

echo -e "\n=== Test Summary ==="
echo "Kong Admin API: $([ "$KONG_STATUS" == "200" ] && echo "✅ Accessible" || echo "❌ Not accessible")"
echo "express-api service: $(curl -s http://localhost:8001/services/express-api | grep -q "host.*e2e-109-51" && echo "✅ Configured" || echo "❌ Not configured")"
echo "Routes: $([ -z "$ROUTES" ] && echo "❌ None found" || echo "✅ $(echo "$ROUTES" | wc -l) found")"
echo "Plugins: $([ -z "$PLUGINS" ] && echo "❌ None found" || echo "✅ $(echo "$PLUGINS" | wc -l) found")"
echo "Upstream: $(curl -s http://localhost:8001/upstreams/express-api-servers | grep -q "name.*express-api-servers" && echo "✅ Configured" || echo "❌ Not configured")"
echo "API Health Endpoint: $([ "$HEALTH_STATUS" == "200" ] && echo "✅ Accessible" || echo "⚠️ Returned $HEALTH_STATUS")"
echo "API Users Endpoint: $([ "$USERS_STATUS" == "200" ] && echo "✅ Accessible" || echo "⚠️ Returned $USERS_STATUS")"
echo "API Admin Endpoint: $([ "$ADMIN_STATUS" == "200" ] && echo "✅ Accessible" || echo "⚠️ Returned $ADMIN_STATUS")"
