#!/bin/bash

# Fetch all databases from ArangoDB, including system databases
all_databases=$(docker run --rm --network chatqna_default arangodb/arangodb:3.12 \
    arangosh --server.endpoint tcp://arango-vector-db:8529 \
    --server.username root \
    --server.password test \
    --javascript.execute-string "print(db._databases())" \
    )


# Parse the JSON array to get all database names (including _system)
databases=$(echo "$all_databases" | sed 's/\[//g' | sed 's/\]//g' | sed 's/,/ /g' | tr -d '"')

echo "Databases: $databases"

# Create backup directory
time=$(date +%Y%m%d%H%M%S)
backup_dir="/root/arango_backups/$time"
mkdir -p "$backup_dir"

echo "Creating backup in: $backup_dir"

# Dump each database
for db in $databases; do
  db=$(echo $db | xargs) # trim whitespace
  if [ -n "$db" ]; then
    echo "--------------------------------"
    echo "Dumping database: $db"
    mkdir -p "$backup_dir/$db"
    docker run --rm --network chatqna_default --volumes-from arango-vector-db \
      -v "$backup_dir/$db:/backups" \
      arangodb/arangodb:3.12 \
      arangodump \
        --server.endpoint tcp://arango-vector-db:8529 \
        --server.username root \
        --server.password test \
        --output-directory /backups \
        --include-system-collections true \
        --server.database "$db"
  fi
done

echo "Backup completed in: $backup_dir"
