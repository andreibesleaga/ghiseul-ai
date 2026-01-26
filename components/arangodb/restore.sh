#!/bin/bash

# Check if backup time parameter is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <backup_time>"
  echo "Example: $0 20250619194410"
  exit 1
fi

backup_time=$1
backup_dir="/root/arango_backups/$backup_time"

# Check if backup directory exists
if [ ! -d "$backup_dir" ]; then
  echo "Backup directory $backup_dir does not exist"
  echo "Available backups:"
  ls -la /root/arango_backups/ 2>/dev/null || echo "No backups directory found"
  exit 1
fi

echo "Restoring from backup: $backup_time"
echo "Backup directory: $backup_dir"

# Iterate over database backups and restore them
for db_dir in "$backup_dir"/*; do
  if [ -d "$db_dir" ]; then
    db=$(basename "$db_dir")
    echo "--------------------------------"
    echo "Restoring database: $db"
    
    docker run --rm --network chatqna_default \
      -v "$backup_dir/$db:/restore" \
      arangodb/arangodb:3.12 \
      arangorestore \
        --server.endpoint tcp://arango-vector-db:8529 \
        --server.username root \
        --server.password test \
        --input-directory /restore \
        --include-system-collections true \
        --server.database "$db" \
        --create-database true
  fi
done

echo "Restore completed from: $backup_dir"