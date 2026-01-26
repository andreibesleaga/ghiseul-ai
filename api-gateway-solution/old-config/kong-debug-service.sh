#!/bin/bash

# Debug Kong Service Script
# This script helps troubleshoot issues with Kong service configuration

echo "=== Debugging Kong Configuration ==="

# 1. Check Kong Status
echo -e "\n[1/5] Checking Kong status..."
KONG_STATUS=$(curl -s http://localhost:8001 | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
if [ -z "$KONG_STATUS" ]; then
  echo "❌ Unable to get Kong status"
else
  echo "✅ Kong is running version: $KONG_STATUS"
fi

# 2. Check all services
echo -e "\n[2/5] Checking all services..."
SERVICES=$(curl -s http://localhost:8001/services)
echo "Raw services response:"
echo "$SERVICES" | head -20
echo "..."

# Check if express-api exists and get its info
echo -e "\nChecking express-api service..."
EXPRESS_API=$(curl -s http://localhost:8001/services/express-api)
echo "Raw express-api response:"
echo "$EXPRESS_API"

# Extract and display important fields
echo -e "\nExtracting fields from express-api service:"
echo "$EXPRESS_API" | grep -o '"id":"[^"]*"' | head -1
echo "$EXPRESS_API" | grep -o '"host":"[^"]*"' | head -1
echo "$EXPRESS_API" | grep -o '"port":[^,}]*' | head -1
echo "$EXPRESS_API" | grep -o '"protocol":"[^"]*"' | head -1

# 3. Check all routes
echo -e "\n[3/5] Checking all routes..."
ROUTES=$(curl -s http://localhost:8001/routes)
echo "Routes count: $(echo "$ROUTES" | grep -o '"id"' | wc -l)"
echo "First few routes:"
echo "$ROUTES" | head -20
echo "..."

# Check if any routes are associated with express-api
echo -e "\nChecking routes for express-api service..."
EXPRESS_API_ROUTES=$(curl -s http://localhost:8001/services/express-api/routes)
echo "Express API routes count: $(echo "$EXPRESS_API_ROUTES" | grep -o '"id"' | wc -l)"
echo "Express API routes:"
echo "$EXPRESS_API_ROUTES" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | sort | uniq

# 4. Check all plugins
echo -e "\n[4/5] Checking all plugins..."
PLUGINS=$(curl -s http://localhost:8001/plugins)
echo "Plugins count: $(echo "$PLUGINS" | grep -o '"id"' | wc -l)"
echo "First few plugins:"
echo "$PLUGINS" | head -20
echo "..."

# Check if any plugins are associated with express-api
echo -e "\nChecking plugins for express-api service..."
EXPRESS_API_PLUGINS=$(curl -s http://localhost:8001/services/express-api/plugins)
echo "Express API plugins count: $(echo "$EXPRESS_API_PLUGINS" | grep -o '"id"' | wc -l)"
echo "Express API plugins:"
echo "$EXPRESS_API_PLUGINS" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | sort | uniq

# 5. Test API accessibility
echo -e "\n[5/5] Testing API accessibility..."
echo "Testing /api/users endpoint..."
USERS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/users)
echo "Status code: $USERS_STATUS"

echo "Testing /api/admin/system-health endpoint..."
ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/admin/system-health)
echo "Status code: $ADMIN_STATUS"

echo -e "\n=== Debugging Summary ==="
echo "1. Kong Status: $([ ! -z "$KONG_STATUS" ] && echo "✅ Running" || echo "❌ Issue detected")"
echo "2. Express API Service: $(echo "$EXPRESS_API" | grep -q '"id"' && echo "✅ Exists" || echo "❌ Missing")"
echo "3. Express API Routes: $(echo "$EXPRESS_API_ROUTES" | grep -q '"id"' && echo "✅ Configured" || echo "❌ Missing")"
echo "4. Express API Plugins: $(echo "$EXPRESS_API_PLUGINS" | grep -q '"id"' && echo "✅ Configured" || echo "❌ Missing")"
echo "5. API Accessibility: $([ "$USERS_STATUS" == "200" ] && echo "✅ Working" || echo "⚠️ Issues detected")"

echo -e "\nNext Steps:"
echo "1. If service is missing, create it with: curl -X POST http://localhost:8001/services --data \"name=express-api\" --data \"host=e2e-109-51\" --data \"port=3000\" --data \"protocol=http\""
echo "2. If routes are missing, run the updated fix script"
echo "3. If plugins are missing, add them manually or with the script"
echo "4. If all else fails, try removing all configurations and starting over"
