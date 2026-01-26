#!/bin/bash

# Kong Folder Routes Script
# This script adds folder routes to the existing Kong configuration
# Created on: May 16, 2025

echo "=== Adding Folder Routes to Kong Configuration ==="

# Check if service exists
echo "Checking express-api service..."
SERVICE_INFO=$(curl -s http://localhost:8001/services/express-api)
if ! echo "$SERVICE_INFO" | grep -q "id"; then
  echo "❌ Service express-api does not exist. Please run the kong-config-script.sh script first."
  exit 1
else
  echo "✅ Found express-api service"
fi

# Create folder routes
echo -e "\n[1/4] Creating folder routes..."

# Main folders route
echo "  Creating folder-main-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=folder-main-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/chat/folders" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Check if route was created
if curl -s http://localhost:8001/routes/folder-main-route | grep -q "id"; then
  echo "  ✅ Folder main route created successfully"
else
  echo "  ⚠️ Could not create folder main route - may already exist"
fi

# Folder shared route
echo "  Creating folder-shared-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=folder-shared-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/chat/folders/shared" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Folder search route
echo "  Creating folder-search-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=folder-search-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/chat/folders/search" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Folder reorder route
echo "  Creating folder-reorder-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=folder-reorder-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/chat/folders/reorder" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Create folder detail routes
echo -e "\n[2/4] Creating folder detail routes..."

# Folder with ID route (catch-all for GET, PATCH, DELETE)
echo "  Creating folder-detail-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=folder-detail-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/chat/folders/(?!shared$|search$|reorder$).*" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

if curl -s http://localhost:8001/routes/folder-detail-route | grep -q "id"; then
  echo "  ✅ Folder detail route created successfully"
else
  echo "  ⚠️ Could not create folder detail route - may already exist"
fi

# Create folder-conversation relationship routes
echo -e "\n[3/4] Creating folder-conversation relationship routes..."

# Specific paths for conversation-folder relationships
echo "  Creating conversation-folder-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=conversation-folder-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/chat/conversations/.*/folder" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

echo "  Creating conversation-move-route..."
curl -s -X POST http://localhost:8001/routes \
  --data "name=conversation-move-route" \
  --data "service.name=express-api" \
  --data "paths[]=/api/chat/conversations/.*/move" \
  --data "strip_path=false" \
  --data "preserve_host=true" \
  --data "protocols[]=http" \
  --data "protocols[]=https" > /dev/null

# Ensure upstream target is properly configured
echo -e "\n[4/4] Verifying upstream target configuration..."

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

# Verification
echo -e "\n=== Verification ==="
echo "Verifying all routes for express-api service..."
ROUTES=$(curl -s http://localhost:8001/services/express-api/routes | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
if [ -z "$ROUTES" ]; then
  echo "❌ No routes found for express-api service"
else
  echo "✅ Found the following routes:"
  echo "$ROUTES" | grep -E 'folder|conversation-' | sort | uniq | sed 's/^/  - /'
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
echo "Folder routes have been added to Kong"
echo "The new API endpoints are accessible at:"
echo "  - GET/POST      /api/chat/folders"
echo "  - GET           /api/chat/folders/shared"
echo "  - GET           /api/chat/folders/search"
echo "  - POST          /api/chat/folders/reorder"
echo "  - GET/PATCH/DEL /api/chat/folders/{folderId}"
echo "  - GET           /api/chat/folders/{folderId}/path"
echo "  - POST/DEL      /api/chat/folders/{folderId}/conversations/{conversationId}"
echo "  - GET           /api/chat/conversations/{conversationId}/folder"
echo "  - POST          /api/chat/conversations/{conversationId}/move"
echo "  - POST          /api/chat/folders/{folderId}/share"
echo "  - DEL           /api/chat/folders/{folderId}/share/{targetUserId}"
echo "  - GET           /api/chat/folders/{folderId}/users"
