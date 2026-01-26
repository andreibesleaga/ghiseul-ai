#!/bin/bash

# manage-kong-config.sh
# Shell script to manage Kong configuration via Admin API.
#
# Usage: ./manage-kong-config.sh [-b] [-a] [-f] [-d] [-h]
# Switches:
#   -b: Backup current Kong configuration to JSON
#   -a: Apply kong_config.json, prompting for host/port overrides
#   -f: Fix auth routes to bypass JWT and proxy to backend
#   -d: Enable debug mode (verbose output)
#   -h: Display help

# --- Configuration Prompts ---
echo "This script will configure your Kong instance."
echo "Please provide the required connection details."
echo ""

echo "--- Kong Admin API Details ---"
read -p "Enter Kong host [default: localhost]: " KONG_HOST
KONG_HOST=${KONG_HOST:-localhost}
read -p "Enter Kong admin port [default: 8001]: " KONG_PORT
KONG_PORT=${KONG_PORT:-8001}
echo ""

echo "--- Backend Service Details ---"
read -p "Enter 'express-api' service host [default: localhost]: " EXPRESS_API_HOST
EXPRESS_API_HOST=${EXPRESS_API_HOST:-localhost}
read -p "Enter 'express-api' service port [default: 3000]: " EXPRESS_API_PORT
EXPRESS_API_PORT=${EXPRESS_API_PORT:-3000}
echo ""
read -p "Enter 'document-repository' service host [default: localhost]: " DOC_REPO_HOST
DOC_REPO_HOST=${DOC_REPO_HOST:-localhost}
read -p "Enter 'document-repository' service port [default: 3001]: " DOC_REPO_PORT
DOC_REPO_PORT=${DOC_REPO_PORT:-3001}
echo ""

# --- Script Constants ---
KONG_ADMIN_URL="http://${KONG_HOST}:${KONG_PORT}"
CONFIG_FILE="kong_config.json"
BACKUP_DIR="kong_backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/kong_backup_${TIMESTAMP}.json"
LOG_FILE="kong_config.log"

# --- Core Functions ---

# Log function to print messages to console and log file
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check for required dependencies (curl and jq)
check_dependencies() {
    if ! command -v curl >/dev/null 2>&1; then
        log "ERROR: curl is required but not installed. Please install curl."
        exit 1
    fi
    if ! command -v jq >/dev/null 2>&1; then
        log "ERROR: jq is required but not installed. Please install jq."
        exit 1
    fi
}

# Display script usage information
usage() {
    echo "Usage: $0 [-b] [-a] [-f] [-d] [-h]"
    echo "  -b              Backup current Kong configuration to JSON"
    echo "  -a              Apply $CONFIG_FILE (will prompt for service hosts/ports)"
    echo "  -f              Fix auth routes to bypass JWT and proxy to backend"
    echo "  -d              Enable debug mode (verbose output)"
    echo "  -h              Display this help message"
    exit 1
}

# Backup the current Kong configuration
backup_config() {
    log "Backing up current Kong configuration to $BACKUP_FILE"
    mkdir -p "$BACKUP_DIR"

    if ! curl -s --fail -o /dev/null "$KONG_ADMIN_URL"; then
        log "ERROR: Cannot connect to Kong Admin API at $KONG_ADMIN_URL. Please ensure Kong is running."
        exit 1
    fi

    # Helper to fetch all pages of data from a Kong endpoint
    fetch_all() {
        local url="$1"
        local alldata="[]"
        while [ -n "$url" ]; do
            response=$(curl -s -D - "$url")
            body=$(echo "$response" | sed '1,/^\r$/d')
            alldata=$(echo "$alldata" | jq --argjson page_data "$(echo "$body" | jq '.data')" '. + $page_data')
            next_url=$(echo "$response" | grep -i '^Link:' | sed -n 's/.*<>"\(.*\)".*rel="next".*/\1/p')
            url="$next_url"
        done
        echo "$alldata"
    }

    log "Fetching services..."
    services_data=$(fetch_all "$KONG_ADMIN_URL/services")
    log "Fetching routes..."
    routes_data=$(fetch_all "$KONG_ADMIN_URL/routes")
    log "Fetching plugins..."
    plugins_data=$(fetch_all "$KONG_ADMIN_URL/plugins")
    log "Fetching upstreams..."
    upstreams_data=$(fetch_all "$KONG_ADMIN_URL/upstreams")

    log "Fetching targets for all upstreams..."
    targets_data="[]"
    upstream_ids=$(echo "$upstreams_data" | jq -r '.[].id')
    for id in $upstream_ids; do
        targets_for_upstream=$(fetch_all "$KONG_ADMIN_URL/upstreams/$id/targets")
        targets_data=$(echo "$targets_data" | jq --argjson new_targets "$targets_for_upstream" '. += $new_targets')
    done

    # Assemble the final backup JSON
    backup_json=$(jq -n \
        --argjson services "$services_data" \
        --argjson routes "$routes_data" \
        --argjson plugins "$plugins_data" \
        --argjson upstreams "$upstreams_data" \
        --argjson targets "$targets_data" \
        '{_format_version: "3.0", services: $services, routes: $routes, plugins: $plugins, upstreams: $upstreams, targets: $targets}')

    echo "$backup_json" | jq . > "$BACKUP_FILE"
    log "Backup successful: $BACKUP_FILE"
}

# Apply configuration from the JSON file
apply_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        log "ERROR: Configuration file $CONFIG_FILE not found."
        exit 1
    fi

    log "Applying configuration from $CONFIG_FILE"
    log "Using Kong Admin API at: $KONG_ADMIN_URL"
    log "Setting 'express-api' to: ${EXPRESS_API_HOST}:${EXPRESS_API_PORT}"
    log "Setting 'document-repository' to: ${DOC_REPO_HOST}:${DOC_REPO_PORT}"

    config_json=$(cat "$CONFIG_FILE")
    errors=0

    # Apply services
    while IFS= read -r service; do
        service_name=$(echo "$service" | jq -r '.name')
        log "Processing service: $service_name"
        
        modified_service="$service"
        if [ "$service_name" == "express-api" ]; then
            modified_service=$(echo "$service" | jq --arg h "$EXPRESS_API_HOST" --argjson p "$EXPRESS_API_PORT" '.host = $h | .port = $p')
        elif [ "$service_name" == "document-repository" ]; then
            modified_service=$(echo "$service" | jq --arg h "$DOC_REPO_HOST" --argjson p "$DOC_REPO_PORT" '.host = $h | .port = $p')
        fi
        
        payload=$(echo "$modified_service" | jq 'del(.id, .created_at, .updated_at)')
        
        response=$(curl -s -w "\n%{http_code}" -X PUT "$KONG_ADMIN_URL/services/$service_name" -H "Content-Type: application/json" -d "$payload")
        http_code=$(echo "$response" | tail -n1)
        if [[ "$http_code" -eq 200 || "$http_code" -eq 201 ]]; then
            log "Service '$service_name' applied successfully."
        else
            log "ERROR applying service '$service_name'. HTTP Status: $http_code. Response: $(echo "$response" | head -n -1)"
            errors=$((errors + 1))
        fi
    done < <(echo "$config_json" | jq -c '.services[]')

    # Apply routes
    while IFS= read -r route; do
        route_name=$(echo "$route" | jq -r '.name')
        log "Processing route: $route_name"
        payload=$(echo "$route" | jq 'del(.id, .created_at, .updated_at, .plugins)')
        
        response=$(curl -s -w "\n%{http_code}" -X PUT "$KONG_ADMIN_URL/routes/$route_name" -H "Content-Type: application/json" -d "$payload")
        http_code=$(echo "$response" | tail -n1)
        
        if [[ "$http_code" -eq 200 || "$http_code" -eq 201 ]]; then
            log "Route '$route_name' applied successfully."
            # Apply plugins nested under this route
            if jq -e '.plugins | length > 0' <<< "$route" > /dev/null; then
                while IFS= read -r plugin; do
                    plugin_name=$(echo "$plugin" | jq -r '.name')
                    log "Processing plugin '$plugin_name' for route '$route_name'"
                    plugin_payload=$(echo "$plugin" | jq --arg rn "$route_name" '.route = {name: $rn} | del(.id, .created_at, .updated_at)')
                    
                    # Find if plugin already exists for this route
                    existing_plugin_id=$(curl -s "$KONG_ADMIN_URL/routes/$route_name/plugins" | jq -r --arg pn "$plugin_name" '.data[] | select(.name == $pn) | .id')
                    
                    if [ -n "$existing_plugin_id" ]; then
                        # Update existing plugin
                        plugin_response=$(curl -s -w "\n%{http_code}" -X PATCH "$KONG_ADMIN_URL/plugins/$existing_plugin_id" -H "Content-Type: application/json" -d "$plugin_payload")
                    else
                        # Create new plugin
                        plugin_response=$(curl -s -w "\n%{http_code}" -X POST "$KONG_ADMIN_URL/routes/$route_name/plugins" -H "Content-Type: application/json" -d "$plugin_payload")
                    fi
                    
                    plugin_http_code=$(echo "$plugin_response" | tail -n1)
                    if [[ "$plugin_http_code" -eq 200 || "$plugin_http_code" -eq 201 ]]; then
                        log "Plugin '$plugin_name' for route '$route_name' applied successfully."
                    else
                        log "ERROR applying plugin '$plugin_name' for route '$route_name'. HTTP Status: $plugin_http_code. Response: $(echo "$plugin_response" | head -n -1)"
                        errors=$((errors + 1))
                    fi
                done < <(echo "$route" | jq -c '.plugins[]')
            fi
        else
            log "ERROR applying route '$route_name'. HTTP Status: $http_code. Response: $(echo "$response" | head -n -1)"
            errors=$((errors + 1))
        fi
    done < <(echo "$config_json" | jq -c '.routes[]')

    # Apply global and service-scoped plugins from the top-level 'plugins' array
    while IFS= read -r plugin; do
        plugin_name=$(echo "$plugin" | jq -r '.name')
        payload=$(echo "$plugin" | jq 'del(.id, .created_at, .updated_at)')
        
        # Determine scope: service or global
        if jq -e '.service' <<< "$plugin" > /dev/null; then
            service_name=$(echo "$plugin" | jq -r '.service.name')
            log "Processing plugin '$plugin_name' for service '$service_name'"
            endpoint="$KONG_ADMIN_URL/services/$service_name/plugins"
        else
            log "Processing global plugin '$plugin_name'"
            endpoint="$KONG_ADMIN_URL/plugins"
        fi

        # Find if plugin already exists in the correct scope
        existing_plugin_id=$(curl -s "$endpoint" | jq -r --arg pn "$plugin_name" '.data[] | select(.name == $pn) | .id')

        if [ -n "$existing_plugin_id" ]; then
             response=$(curl -s -w "\n%{http_code}" -X PATCH "$KONG_ADMIN_URL/plugins/$existing_plugin_id" -H "Content-Type: application/json" -d "$payload")
        else
             response=$(curl -s -w "\n%{http_code}" -X POST "$endpoint" -H "Content-Type: application/json" -d "$payload")
        fi

        http_code=$(echo "$response" | tail -n1)
        if [[ "$http_code" -eq 200 || "$http_code" -eq 201 ]]; then
            log "Plugin '$plugin_name' applied successfully."
        else
            log "ERROR applying plugin '$plugin_name'. HTTP Status: $http_code. Response: $(echo "$response" | head -n -1)"
            errors=$((errors + 1))
        fi
    done < <(echo "$config_json" | jq -c '.plugins[]')

    # Apply upstreams
    while IFS= read -r upstream; do
        upstream_name=$(echo "$upstream" | jq -r '.name')
        log "Processing upstream: $upstream_name"
        payload=$(echo "$upstream" | jq 'del(.id, .created_at, .updated_at)')
        
        response=$(curl -s -w "\n%{http_code}" -X PUT "$KONG_ADMIN_URL/upstreams/$upstream_name" -H "Content-Type: application/json" -d "$payload")
        http_code=$(echo "$response" | tail -n1)
        if [[ "$http_code" -eq 200 || "$http_code" -eq 201 ]]; then
            log "Upstream '$upstream_name' applied successfully."
        else
            log "ERROR applying upstream '$upstream_name'. HTTP Status: $http_code. Response: $(echo "$response" | head -n -1)"
            errors=$((errors + 1))
        fi
    done < <(echo "$config_json" | jq -c '.upstreams[]')

    # Apply targets
    while IFS= read -r target; do
        target_address=$(echo "$target" | jq -r '.target')
        target_upstream_id=$(echo "$target" | jq -r '.upstream.id')
        
        # Find upstream name from config using its ID
        upstream_name=$(echo "$config_json" | jq -r --arg id "$target_upstream_id" '.upstreams[] | select(.id == $id) | .name')
        
        if [ -z "$upstream_name" ]; then
            log "WARNING: Could not find upstream for target '$target_address'. Skipping."
            continue
        fi

        final_target_address="$target_address"
        # Override the target address if it belongs to the express-api upstream
        if [ "$upstream_name" == "express-api-servers" ]; then
            final_target_address="${EXPRESS_API_HOST}:${EXPRESS_API_PORT}"
            log "Overriding target for upstream '$upstream_name' to '$final_target_address'"
        fi

        # Clear existing targets for this upstream to ensure a clean state
        log "Clearing existing targets for upstream '$upstream_name'..."
        existing_target_ids=$(curl -s "$KONG_ADMIN_URL/upstreams/$upstream_name/targets" | jq -r '.data[].id')
        for id in $existing_target_ids; do
            curl -s -X DELETE "$KONG_ADMIN_URL/upstreams/$upstream_name/targets/$id" > /dev/null
        done
        
        log "Adding target '$final_target_address' to upstream '$upstream_name'"
        payload=$(echo "$target" | jq --arg t "$final_target_address" '.target = $t | del(.id, .created_at, .upstream)')
        response=$(curl -s -w "\n%{http_code}" -X POST "$KONG_ADMIN_URL/upstreams/$upstream_name/targets" -H "Content-Type: application/json" -d "$payload")
        http_code=$(echo "$response" | tail -n1)
        if [ "$http_code" -eq 201 ]; then
            log "Target '$final_target_address' added successfully."
        else
            log "ERROR adding target '$final_target_address'. HTTP Status: $http_code. Response: $(echo "$response" | head -n -1)"
            errors=$((errors + 1))
        fi
    done < <(echo "$config_json" | jq -c '.targets[]')

    if [ "$errors" -eq 0 ]; then
        log "✅ Configuration applied successfully."
    else
        log "❌ Configuration applied with $errors errors. Please check the log."
        exit 1
    fi
}

# Fix auth routes by ensuring they exist and have no JWT plugin
fix_auth() {
    log "Fixing auth routes..."
    errors=0
    auth_routes=("auth-login-route" "auth-refresh-route" "auth-route")

    for route_name in "${auth_routes[@]}"; do
        log "Checking JWT plugin for route: $route_name"
        plugin_id=$(curl -s "$KONG_ADMIN_URL/routes/$route_name/plugins" | jq -r '.data[] | select(.name=="jwt") | .id')
        if [ -n "$plugin_id" ]; then
            log "Found and removing JWT plugin from '$route_name'..."
            response=$(curl -s -w "\n%{http_code}" -X DELETE "$KONG_ADMIN_URL/plugins/$plugin_id")
            http_code=$(echo "$response" | tail -n1)
            if [ "$http_code" -ne 204 ]; then
                log "ERROR removing JWT plugin from '$route_name'. HTTP Status: $http_code"
                errors=$((errors + 1))
            fi
        fi
    done
    
    # Correctly formatted JSON payloads for auth routes
    auth_login_payload='{"name": "auth-login-route", "paths": ["/api/auth/login"], "methods": ["POST"], "strip_path": false, "preserve_host": true, "protocols": ["http", "https"], "service": {"name": "express-api"}}'
    auth_refresh_payload='{"name": "auth-refresh-route", "paths": ["/api/auth/refresh-token"], "methods": ["POST"], "strip_path": false, "preserve_host": true, "protocols": ["http", "https"], "service": {"name": "express-api"}}'
    auth_route_payload='{"name": "auth-route", "paths": ["/api/auth"], "strip_path": false, "preserve_host": true, "protocols": ["http", "https"], "service": {"name": "express-api"}}'

    # Ensure routes exist using PUT (create or update)
    log "Ensuring 'auth-login-route' exists..."
    response=$(curl -s -w "\n%{http_code}" -X PUT "$KONG_ADMIN_URL/routes/auth-login-route" -H "Content-Type: application/json" -d "$auth_login_payload")
    [[ "$(echo "$response" | tail -n1)" -lt 300 ]] || { log "ERROR: Failed to ensure auth-login-route"; errors=$((errors+1)); }

    log "Ensuring 'auth-refresh-route' exists..."
    response=$(curl -s -w "\n%{http_code}" -X PUT "$KONG_ADMIN_URL/routes/auth-refresh-route" -H "Content-Type: application/json" -d "$auth_refresh_payload")
    [[ "$(echo "$response" | tail -n1)" -lt 300 ]] || { log "ERROR: Failed to ensure auth-refresh-route"; errors=$((errors+1)); }
    
    log "Ensuring 'auth-route' exists..."
    response=$(curl -s -w "\n%{http_code}" -X PUT "$KONG_ADMIN_URL/routes/auth-route" -H "Content-Type: application/json" -d "$auth_route_payload")
    [[ "$(echo "$response" | tail -n1)" -lt 300 ]] || { log "ERROR: Failed to ensure auth-route"; errors=$((errors+1)); }

    if [ "$errors" -eq 0 ]; then
        log "✅ Auth routes fixed successfully."
    else
        log "❌ Auth routes fixed with $errors errors."
        exit 1
    fi
}

# --- Main Execution ---

check_dependencies

if [ "$#" -eq 0 ]; then
    log "ERROR: No operation specified."
    usage
fi

BACKUP=false
APPLY=false
FIX_AUTH=false
DEBUG=false
while getopts "bafdh" opt; do
    case $opt in
        b) BACKUP=true ;;
        a) APPLY=true ;;
        f) FIX_AUTH=true ;;
        d) DEBUG=true ;;
        h) usage ;;
        \?) log "ERROR: Invalid option: -$OPTARG"; usage ;;
    esac
done

if [ "$DEBUG" = true ]; then
    log "Debug mode enabled."
    set -x
fi

if [ "$BACKUP" = true ]; then
    backup_config
fi
if [ "$APPLY" = true ]; then
    apply_config
fi
if [ "$FIX_AUTH" = true ]; then
    fix_auth
fi

if [ "$DEBUG" = true ]; then
    set +x
fi

log "Operation completed."
exit 0