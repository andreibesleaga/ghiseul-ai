#!/bin/bash

# restore-kong-config.sh
# Shell script to restore Kong configuration from a specified backup file
# Usage: ./restore-kong-config.sh [-b <backup_file>] [-t [jwt_token]] [-h]
# Switches:
#   -b <backup_file>  Path to Kong configuration backup file (required for restoration)
#   -t [jwt_token]    Test endpoints with provided JWT token or prompt for credentials if no token
#   -h                Display help message
# Environment Variables:
#   LOGIN_PASSWORD    Password for testing (optional, used if not prompted)

# Constants
KONG_ADMIN_URL="http://localhost:8001"
KONG_PUBLIC_URL="http://e2e-82-109.ssdcloudindia.net:8000"
USER_ID="2133"
LOG_FILE="kong_restore.log"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check dependencies
if ! command -v curl >/dev/null 2>&1; then
    log "ERROR: curl is required but not installed. Please install curl."
    exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
    log "ERROR: jq is required but not installed. Please install jq."
    exit 1
fi

# Usage function
usage() {
    echo "Usage: $0 [-b <backup_file>] [-t [jwt_token]] [-h]"
    echo "  -b <backup_file>  Path to Kong configuration backup file (required for restoration)"
    echo "  -t [jwt_token]    Test endpoints with provided JWT token or prompt for credentials if no token"
    echo "  -h                Display this help message"
    echo "Environment Variables:"
    echo "  LOGIN_PASSWORD    Password for testing (optional, used if not prompted)"
    exit 1
}

# Clean up existing JWT plugins and credentials
cleanup_jwt() {
    log "Cleaning up existing JWT plugins and credentials"

    # List all routes
    routes=$(curl -s "$KONG_ADMIN_URL/routes" | jq -r '.data[].id')
    for route_id in $routes; do
        plugins=$(curl -s "$KONG_ADMIN_URL/routes/$route_id/plugins" | jq -r '.data[] | select(.name == "jwt") | .id')
        for plugin_id in $plugins; do
            log "Deleting JWT plugin $plugin_id from route $route_id"
            response=$(curl -s -w "\n%{http_code}" -X DELETE "$KONG_ADMIN_URL/routes/$route_id/plugins/$plugin_id")
            http_code=$(echo "$response" | tail -n1)
            if [ "$http_code" -eq 204 ]; then
                log "JWT plugin $plugin_id deleted successfully"
            else
                log "ERROR: Failed to delete JWT plugin $plugin_id with HTTP status $http_code"
            fi
        done
    done

    # List all consumers
    consumers=$(curl -s "$KONG_ADMIN_URL/consumers" | jq -r '.data[].id')
    for consumer_id in $consumers; do
        jwts=$(curl -s "$KONG_ADMIN_URL/consumers/$consumer_id/jwt" | jq -r '.data[].id')
        for jwt_id in $jwts; do
            log "Deleting JWT credential $jwt_id for consumer $consumer_id"
            response=$(curl -s -w "\n%{http_code}" -X DELETE "$KONG_ADMIN_URL/consumers/$consumer_id/jwt/$jwt_id")
            http_code=$(echo "$response" | tail -n1)
            if [ "$http_code" -eq 204 ]; then
                log "JWT credential $jwt_id deleted successfully"
            else
                log "ERROR: Failed to delete JWT credential $jwt_id with HTTP status $http_code"
            fi
        done
    done
}

# Restore configuration
restore_config() {
    local backup_file="$1"
    if [ ! -f "$backup_file" ]; then
        log "ERROR: Backup file $backup_file not found"
        exit 1
    fi

    log "Restoring Kong configuration from $backup_file"

    # Clean up existing JWT plugins and credentials
    cleanup_jwt

    # Read JSON config
    config_json=$(cat "$backup_file")

    errors=0

    # Update or create service
    service=$(echo "$config_json" | jq -r '.services[0]')
    service_name=$(echo "$service" | jq -r '.name')
    log "Processing service $service_name"
    response=$(curl -s -w "\n%{http_code}" -X PUT "$KONG_ADMIN_URL/services/$service_name" \
        -H "Content-Type: application/json" \
        -d "$(echo "$service" | jq 'del(.id, .routes, .plugins, .created_at, .updated_at)')")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        log "Service $service_name processed successfully"
        service_id=$(curl -s "$KONG_ADMIN_URL/services/$service_name" | jq -r '.id')
    else
        log "ERROR: Failed to process service $service_name with HTTP status $http_code"
        log "Response: $body"
        errors=$((errors + 1))
        exit 1
    fi

    # Update or create routes
    while IFS= read -r route; do
        route_name=$(echo "$route" | jq -r '.name')
        log "Processing route $route_name"
        route_payload=$(echo "$route" | jq --arg sid "$service_id" 'del(.id, .plugins, .created_at, .updated_at) | .service = {id: $sid}')
        existing_route=$(curl -s "$KONG_ADMIN_URL/routes/$route_name")
        if [ "$(echo "$existing_route" | jq -r '.id // empty')" ]; then
            response=$(curl -s -w "\n%{http_code}" -X PUT "$KONG_ADMIN_URL/routes/$route_name" \
                -H "Content-Type: application/json" \
                -d "$route_payload")
        else
            response=$(curl -s -w "\n%{http_code}" -X POST "$KONG_ADMIN_URL/services/$service_name/routes" \
                -H "Content-Type: application/json" \
                -d "$route_payload")
        fi
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n -1)
        if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
            log "Route $route_name processed successfully"
        else
            log "ERROR: Failed to process route $route_name with HTTP status $http_code"
            log "Response: $body"
            errors=$((errors + 1))
            continue
        fi

        # Update or create route-specific plugins
        plugins_count=$(echo "$route" | jq '.plugins | length')
        if [ "$plugins_count" -eq 0 ]; then
            log "No plugins found for route $route_name"
        else
            while IFS= read -r plugin; do
                plugin_name=$(echo "$plugin" | jq -r '.name')
                log "Processing plugin $plugin_name for route $route_name"
                existing_plugins=$(curl -s "$KONG_ADMIN_URL/routes/$route_name/plugins")
                plugin_exists=$(echo "$existing_plugins" | jq -r --arg name "$plugin_name" '.data[] | select(.name == $name) | .id')
                if [ -n "$plugin_exists" ]; then
                    log "Plugin $plugin_name already exists for route $route_name, skipping"
                    continue
                fi
                plugin_payload=$(echo "$plugin" | jq 'del(.id, .created_at, .updated_at)')
                response=$(curl -s -w "\n%{http_code}" -X POST "$KONG_ADMIN_URL/routes/$route_name/plugins" \
                    -H "Content-Type: application/json" \
                    -d "$plugin_payload")
                http_code=$(echo "$response" | tail -n1)
                body=$(echo "$response" | head -n -1)
                if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
                    log "Plugin $plugin_name for route $route_name processed successfully"
                else
                    log "WARNING: Failed to process plugin $plugin_name for route $route_name with HTTP status $http_code"
                    log "Response: $body"
                    errors=$((errors + 1))
                    continue
                fi
            done < <(echo "$route" | jq -c '.plugins[]?')
        fi
    done < <(echo "$config_json" | jq -c '.routes[]')

    # Add user-admin-route
    log "Adding user-admin-route"
    existing_route=$(curl -s "$KONG_ADMIN_URL/routes/user-admin-route")
    if [ -z "$(echo "$existing_route" | jq -r '.id // empty')" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$KONG_ADMIN_URL/services/$service_name/routes" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "user-admin-route",
                "paths": ["/api/users/admin/users"],
                "strip_path": false,
                "preserve_host": true,
                "protocols": ["http", "https"]
            }')
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n -1)
        if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
            log "Route user-admin-route added successfully"
        else
            log "ERROR: Failed to add route user-admin-route with HTTP status $http_code"
            log "Response: $body"
            errors=$((errors + 1))
        fi
    else
        log "Route user-admin-route already exists, skipping"
    fi

    # Update or create service plugins
    while IFS= read -r plugin; do
        plugin_name=$(echo "$plugin" | jq -r '.name')
        log "Processing service plugin $plugin_name"
        existing_plugins=$(curl -s "$KONG_ADMIN_URL/services/$service_name/plugins")
        plugin_exists=$(echo "$existing_plugins" | jq -r --arg name "$plugin_name" '.data[] | select(.name == $name) | .id')
        if [ -n "$plugin_exists" ]; then
            log "Service plugin $plugin_name already exists for service $service_name, skipping"
            continue
        fi
        plugin_payload=$(echo "$plugin" | jq --arg sid "$service_id" 'del(.id, .created_at, .updated_at) | .service = {id: $sid}')
        response=$(curl -s -w "\n%{http_code}" -X POST "$KONG_ADMIN_URL/services/$service_name/plugins" \
            -H "Content-Type: application/json" \
            -d "$plugin_payload")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n -1)
        if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
            log "Service plugin $plugin_name processed successfully"
        else
            log "WARNING: Failed to process service plugin $plugin_name with HTTP status $http_code"
            log "Response: $body"
            errors=$((errors + 1))
            continue
        fi
    done < <(echo "$config_json" | jq -c '.plugins[] | select(.service?)')

    # Update or create global plugins
    while IFS= read -r plugin; do
        plugin_name=$(echo "$plugin" | jq -r '.name')
        log "Processing global plugin $plugin_name"
        existing_plugins=$(curl -s "$KONG_ADMIN_URL/plugins")
        plugin_exists=$(echo "$existing_plugins" | jq -r --arg name "$plugin_name" '.data[] | select(.name == $name and .service == null and (.route == null or .route.id == "'$(echo "$plugin" | jq -r '.route.id // empty')'")) | .id')
        if [ -n "$plugin_exists" ]; then
            log "Global plugin $plugin_name already exists, skipping"
            continue
        fi
        plugin_payload=$(echo "$plugin" | jq 'del(.id, .created_at, .updated_at)')
        response=$(curl -s -w "\n%{http_code}" -X POST "$KONG_ADMIN_URL/plugins" \
            -H "Content-Type: application/json" \
            -d "$plugin_payload")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n -1)
        if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
            log "Global plugin $plugin_name processed successfully"
        else
            log "WARNING: Failed to process global plugin $plugin_name with HTTP status $http_code"
            log "Response: $body"
            errors=$((errors + 1))
            continue
        fi
    done < <(echo "$config_json" | jq -c '.plugins[] | select(.service? | not)')

    # Update or create upstreams
    while IFS= read -r upstream; do
        upstream_name=$(echo "$upstream" | jq -r '.name')
        log "Processing upstream $upstream_name"
        upstream_payload=$(echo "$upstream" | jq 'del(.targets, .id, .created_at, .updated_at)')
        response=$(curl -s -w "\n%{http_code}" -X PUT "$KONG_ADMIN_URL/upstreams/$upstream_name" \
            -H "Content-Type: application/json" \
            -d "$upstream_payload")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n -1)
        if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
            log "Upstream $upstream_name processed successfully"
        else
            log "ERROR: Failed to process upstream $upstream_name with HTTP status $http_code"
            log "Response: $body"
            errors=$((errors + 1))
            continue
        fi
    done < <(echo "$config_json" | jq -c '.upstreams[]')

    # Add upstream target
    log "Adding target e2e-109-51:3000 for upstream express-api-servers"
    existing_targets=$(curl -s "$KONG_ADMIN_URL/upstreams/express-api-servers/targets")
    target_exists=$(echo "$existing_targets" | jq -r '.data[] | select(.target == "e2e-109-51:3000" and .weight == 100) | .id')
    if [ -z "$target_exists" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$KONG_ADMIN_URL/upstreams/express-api-servers/targets" \
            -H "Content-Type: application/json" \
            -d '{"target":"e2e-109-51:3000","weight":100}')
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n -1)
        if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
            log "Target e2e-109-51:3000 added successfully"
        else
            log "ERROR: Failed to add target e2e-109-51:3000 with HTTP status $http_code"
            log "Response: $body"
            errors=$((errors + 1))
        fi
    else
        log "Target e2e-109-51:3000 already exists, skipping"
    fi

    # Patch rate-limiting
    log "Patching global rate-limiting plugin"
    response=$(curl -s -w "\n%{http_code}" -X PATCH "$KONG_ADMIN_URL/plugins/13e146bb-0dff-4bfa-a9ca-95b8189ffb03" \
        -H "Content-Type: application/json" \
        -d '{
            "config": {
                "minute": 1000,
                "hour": 10000
            }
        }')
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    if [ "$http_code" -eq 200 ]; then
        log "Global rate-limiting plugin patched successfully"
    else
        log "ERROR: Failed to patch global rate-limiting plugin with HTTP status $http_code"
        log "Response: $body"
        errors=$((errors + 1))
    fi

    if [ "$errors" -eq 0 ]; then
        log "Configuration restored successfully"
    else
        log "Configuration restored with $errors warnings/errors, but continuing"
    fi
}

# Test endpoints
test_endpoints() {
    local jwt_token="$1"
    if [ -z "$jwt_token" ]; then
        log "No JWT token provided, prompting for username and password"
        read -p "Enter username (email): " username
        if [ -z "$username" ]; then
            log "ERROR: Username is required"
            exit 1
        fi
        read -s -p "Enter password: " password
        echo
        if [ -z "$password" ]; then
            if [ -n "$LOGIN_PASSWORD" ]; then
                log "Using LOGIN_PASSWORD from environment variable"
                password="$LOGIN_PASSWORD"
            else
                log "ERROR: Password is required"
                exit 1
            fi
        fi

        log "Obtaining new JWT token via login for $username"
        response=$(curl -s -w "\n%{http_code}" -X POST "$KONG_PUBLIC_URL/api/auth/login" \
            -H "Content-Type: application/json" \
            -d "{\"email\": \"$username\", \"password\": \"$password\"}")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n -1)
        if [ "$http_code" -eq 200 ]; then
            jwt_token=$(echo "$body" | jq -r '.accessToken')
            log "SUCCESS: Obtained JWT token (first 10 chars: ${jwt_token:0:10}...)"
        else
            log "ERROR: Failed to obtain JWT token with HTTP status $http_code"
            log "Response: $body"
            exit 1
        fi
    else
        log "Using provided JWT token (first 10 chars: ${jwt_token:0:10}...)"
    fi

    # Test 1: POST /api/auth/logout
    log "Testing POST /api/auth/logout"
    response=$(curl -s -w "\n%{http_code}" -X POST "$KONG_PUBLIC_URL/api/auth/logout" \
        -H "Authorization: Bearer $jwt_token" \
        -H "Content-Type: application/json" \
        -d '{}')
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    if [ "$http_code" -eq 200 ]; then
        log "SUCCESS: /api/auth/logout returned 200"
        log "Response: $body"
    else
        log "ERROR: /api/auth/logout failed with status $http_code"
        log "Response: $body"
        exit 1
    fi

    # Test 2: POST /api/users/admin/users/2133/force-logout
    log "Testing POST /api/users/admin/users/$USER_ID/force-logout"
    response=$(curl -s -w "\n%{http_code}" -X POST "$KONG_PUBLIC_URL/api/users/admin/users/$USER_ID/force-logout" \
        -H "Authorization: Bearer $jwt_token" \
        -H "Content-Type: application/json" \
        -d '{}')
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    if [ "$http_code" -eq 200 ]; then
        log "SUCCESS: /api/users/admin/users/$USER_ID/force-logout returned 200"
        log "Response: $body"
    else
        log "ERROR: /api/users/admin/users/$USER_ID/force-logout failed with status $http_code"
        log "Response: $body"
        exit 1
    fi

    # Test 3: GET /api/service-categories
    log "Testing GET /api/service-categories?locale=en"
    response=$(curl -s -w "\n%{http_code}" "$KONG_PUBLIC_URL/api/service-categories?locale=en" \
        -H "Authorization: Bearer $jwt_token")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    if [ "$http_code" -eq 200 ]; then
        log "SUCCESS: /api/service-categories returned 200"
        log "Response: $body"
    else
        log "ERROR: /api/service-categories failed with status $http_code"
        log "Response: $body"
        exit 1
    fi
}

# Parse command-line options
BACKUP_FILE=""
TEST_TOKEN=""
TEST_MODE=false
while getopts "b:t::h" opt; do
    case $opt in
        b)
            BACKUP_FILE="$OPTARG"
            ;;
        t)
            TEST_TOKEN="${OPTARG:-}"
            TEST_MODE=true
            ;;
        h)
            usage
            ;;
        \?)
            log "ERROR: Invalid option: -$OPTARG"
            usage
            ;;
        :)
            if [ "$OPTARG" = "t" ]; then
                TEST_TOKEN=""
                TEST_MODE=true
            else
                log "ERROR: Option -$OPTARG requires an argument"
                usage
            fi
            ;;
    esac
done

# Execute operations
if [ "$TEST_MODE" = false ] && [ -z "$BACKUP_FILE" ]; then
    log "ERROR: Backup file is required. Use -b <backup_file>"
    usage
elif [ "$TEST_MODE" = true ]; then
    test_endpoints "$TEST_TOKEN"
elif [ -n "$BACKUP_FILE" ]; then
    restore_config "$BACKUP_FILE"
fi

log "Operation completed successfully"
exit 0
