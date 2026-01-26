#!/bin/bash

# Kong Admin API Base URL
KONG_ADMIN_URL="http://localhost:8001"

# Rate-limiting plugin details from the configuration
RATE_LIMIT_PLUGIN_ID="13e146bb-0dff-4bfa-a9ca-95b8189ffb03"
SERVICE_ID="453cb927-f3d0-4b68-8791-3165dc046719"

# Function to format JSON response
format_json() {
    echo "$1" | python3 -m json.tool
}

# Function to modify rate limiting plugin state
modify_rate_limiting() {
    local ACTION=$1
    local ENABLED_STATE=$([ "$ACTION" = "enable" ] && echo "true" || echo "false")
    
    echo "==== Rate Limiting Plugin Management ===="
    echo "Action: $ACTION rate limiting"
    
    RESPONSE=$(curl -s -X PATCH "$KONG_ADMIN_URL/plugins/$RATE_LIMIT_PLUGIN_ID" \
         -H "Content-Type: application/json" \
         -d "{\"enabled\": $ENABLED_STATE}")
    
    if [ $? -eq 0 ]; then
        echo -e "\n==== Plugin Configuration ===="
        format_json "$RESPONSE"
        
        echo -e "\n==== Summary ===="
        echo "Status: Rate limiting plugin $ACTION successful"
        echo "Current State: $(echo "$RESPONSE" | grep -o '"enabled":[^,}]*' | cut -d: -f2)"
    else
        echo "Failed to $ACTION rate limiting plugin."
        return 1
    fi
}

# Function to check current plugin status
check_plugin_status() {
    echo "==== Rate Limiting Plugin Status ===="
    
    RESPONSE=$(curl -s "$KONG_ADMIN_URL/plugins/$RATE_LIMIT_PLUGIN_ID")
    
    echo -e "\n==== Plugin Configuration ===="
    format_json "$RESPONSE"
    
    echo -e "\n==== Rate Limit Details ===="
    echo "Requests per Minute: $(echo "$RESPONSE" | grep -o '"minute":[^,}]*' | cut -d: -f2)"
    echo "Requests per Hour: $(echo "$RESPONSE" | grep -o '"hour":[^,}]*' | cut -d: -f2)"
    echo "Policy: $(echo "$RESPONSE" | grep -o '"policy":"[^"]*"' | cut -d\" -f4)"
    echo "Enabled: $(echo "$RESPONSE" | grep -o '"enabled":[^,}]*' | cut -d: -f2)"
}

# Check input argument
case "$1" in
    disable)
        modify_rate_limiting "disable"
        ;;
    enable)
        modify_rate_limiting "enable"
        ;;
    status)
        check_plugin_status
        ;;
    *)
        echo "Usage: $0 {disable|enable|status}"
        echo "  disable: Disable rate-limiting plugin"
        echo "  enable:  Enable rate-limiting plugin"
        echo "  status:  Check plugin status"
        exit 1
        ;;
esac

exit 0
