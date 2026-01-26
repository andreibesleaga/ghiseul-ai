#!/bin/bash

# Configuration
KONG_ADMIN_URL="http://localhost:8001"  # Update with your Kong Admin API URL
OUTPUT_FILE="kong_timeout_report.txt"   # Output file for the report

# Function to check if required tools are installed
check_requirements() {
  if ! command -v curl &> /dev/null; then
    echo "Error: curl is not installed. Please install curl."
    exit 1
  fi
  if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install jq."
    exit 1
  fi
}

# Function to query Kong services and extract timeout settings
query_timeouts() {
  echo "Querying Kong services for timeout settings..."
  echo "Kong Timeout Report - $(date)" > "$OUTPUT_FILE"
  echo "=====================================" >> "$OUTPUT_FILE"

  # Fetch all services from Kong Admin API
  response=$(curl -s "$KONG_ADMIN_URL/services")

  # Check if the API call was successful
  if [[ $? -ne 0 ]]; then
    echo "Error: Failed to connect to Kong Admin API at $KONG_ADMIN_URL"
    exit 1
  fi

  # Parse the response to check for valid JSON
  if ! echo "$response" | jq . > /dev/null 2>&1; then
    echo "Error: Invalid response from Kong Admin API"
    exit 1
  fi

  # Extract service data
  services=$(echo "$response" | jq -r '.data[]')

  if [[ -z "$services" ]]; then
    echo "No services found in Kong."
    echo "No services found." >> "$OUTPUT_FILE"
    return
  fi

  # Iterate through each service
  echo "$services" | jq -c '.' | while read -r service; do
    service_name=$(echo "$service" | jq -r '.name // "Unnamed"')
    service_id=$(echo "$service" | jq -r '.id')
    connect_timeout=$(echo "$service" | jq -r '.connect_timeout // "Not set"')
    read_timeout=$(echo "$service" | jq -r '.read_timeout // "Not set"')
    write_timeout=$(echo "$service" | jq -r '.write_timeout // "Not set"')

    # Append to output file
    {
      echo "Service: $service_name (ID: $service_id)"
      echo "  Connect Timeout: $connect_timeout ms"
      echo "  Read Timeout: $read_timeout ms"
      echo "  Write Timeout: $write_timeout ms"
      echo "-------------------------------------"
    } >> "$OUTPUT_FILE"

    # Print to console
    echo "Service: $service_name"
    echo "  Connect Timeout: $connect_timeout ms"
    echo "  Read Timeout: $read_timeout ms"
    echo "  Write Timeout: $write_timeout ms"
    echo "-------------------------------------"
  done

  echo "Report generated at $OUTPUT_FILE"
}

# Main execution
check_requirements
query_timeouts
