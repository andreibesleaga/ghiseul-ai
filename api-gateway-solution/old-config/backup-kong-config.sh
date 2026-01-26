#!/bin/bash

# Configuration variables
KONG_ADMIN_URL="http://localhost:8001"
BACKUP_DIR="./kong-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="kong_backup_${TIMESTAMP}.json"
LOG_FILE="./kong-backups/backup.log"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to check if curl is installed
check_curl() {
    if ! command -v curl &> /dev/null; then
        log_message "ERROR: curl is not installed"
        echo "Error: curl is required but not installed"
        exit 1
    fi
}

# Function to backup Kong configuration
backup_kong() {
    log_message "Starting Kong configuration backup"
    
    # Make API call to export configuration
    response=$(curl -s -X GET "${KONG_ADMIN_URL}/config" -o "${BACKUP_DIR}/${BACKUP_FILE}" 2>&1)
    
    if [ $? -eq 0 ]; then
        log_message "Backup successful: ${BACKUP_FILE}"
        echo "Backup completed successfully: ${BACKUP_DIR}/${BACKUP_FILE}"
        
        # Verify backup file exists and is not empty
        if [ -s "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
            log_message "Backup file verified"
        else
            log_message "ERROR: Backup file is empty or missing"
            echo "Error: Backup file is empty or missing"
            exit 1
        fi
    else
        log_message "ERROR: Backup failed: $response"
        echo "Error: Backup failed. Check ${LOG_FILE} for details"
        exit 1
    fi
}

# Main execution
echo "Starting Kong configuration backup..."

# Check prerequisites
check_curl

# Perform backup
backup_kong

# Optional: Clean up old backups (keep last 7 days)
find "$BACKUP_DIR" -name "kong_backup_*.json" -mtime +7 -delete
log_message "Cleaned up backups older than 7 days"

echo "Backup process completed"
