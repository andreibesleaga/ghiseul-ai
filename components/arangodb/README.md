# ArangoDB Directory

This directory contains configuration and scripts for managing an ArangoDB instance using Docker. ArangoDB is a multi-model database that supports document, graph, and key-value data models. In this setup, it is configured with experimental vector index support enabled, which is useful for vector search applications (e.g., in AI or similarity-based queries).

The setup uses Docker Compose to run ArangoDB in a container named `arango-vector-db`. The database files are persisted in the host directory `/root/arango_data`.

**Prerequisites:**
- Docker and Docker Compose must be installed on your system.
- Set the environment variable `ARANGO_PASSWORD` (e.g., `export ARANGO_PASSWORD=test`) before starting the container. The provided scripts assume a root password of `test` for simplicity; update them if you use a different password.
- Check to see that the required docker network chatqna_default exists. If not then create it with: `docker network create chatqna_default`

## Starting the ArangoDB Server

To start the ArangoDB server in detached mode:

```
docker compose up -d
```

This command uses the `compose.yaml` file (which is a Docker Compose configuration file) to launch the service. The container will run ArangoDB version 3.12.4 with the following key configurations:
- Exposed on port `8529` (mapped to the host's port `8529`).
- Root password set via the `ARANGO_PASSWORD` environment variable.
- Persistent volume mounted at `/root/arango_data` on the host to `/var/lib/arangodb3` in the container.
- Experimental vector index feature enabled via the command flag `--experimental-vector-index=true`.
- Connected to a custom bridge network named `chatqna_default` (external network, assuming it's created elsewhere in your setup).
- Restart policy set to `unless-stopped` for automatic recovery.

The `compose.yaml` file defines a single service `arango-vector-db` and references an external network `chatqna_default`. For more details on Docker Compose options, see the [Docker Compose documentation](https://docs.docker.com/compose/).

If the container is already running, verify its status:

```
docker ps
```

This should list the `arango-vector-db` container. To check logs:

```
docker logs arango-vector-db
```

## Database Files

The database files are stored in `/root/arango_data` on the host machine. This directory is mounted as a volume to the container, ensuring data persistence even if the container is stopped or removed.

## Backup and Restore

Backups and restores are handled via shell scripts (`dump.sh` and `restore.sh`) that interact with the ArangoDB container using `arangodump` and `arangorestore` tools. These scripts support all databases, including the system database (`_system`).

### Creating a Backup (`dump.sh`)

Use `sh dump.sh` to create a timestamped backup of all databases.

- **How it works:**
  - Fetches a list of all databases (including `_system`) using `arangosh`.
  - Creates a backup directory at `/root/arango_backups/<timestamp>` (e.g., `/root/arango_backups/20250811123456`).
  - For each database, runs `arangodump` inside a temporary container to export data, structure, and system collections to the backup directory.
  - Includes system collections with the `--include-system-collections true` flag.

- **Example usage:**
  ```
  sh dump.sh
  ```

- **Output:** A message indicating the backup directory, e.g., "Backup completed in: /root/arango_backups/20250811123456".

Backups are stored in `/root/arango_backups/`. List available backups with `ls /root/arango_backups/`.

For more on `arangodump`, see the [ArangoDB Dump Documentation](https://docs.arangodb.com/3.12/operations/backup-and-restore/arangodump/).

### Restoring from a Backup (`restore.sh`)

Use `sh restore.sh <backup_time>` to restore databases from a specific backup, where `<backup_time>` is the timestamp of the backup directory (e.g., `20250811123456`).

- **How it works:**
  - Checks if the provided backup directory exists in `/root/arango_backups/`.
  - For each database sub-directory in the backup, runs `arangorestore` inside a temporary container to import data.
  - Restores to the specified database, creating it if it doesn't exist (`--create-database true`).
  - Includes system collections with the `--include-system-collections true` flag.
  - Connects to the running ArangoDB server at `tcp://arango-vector-db:8529` with username `root` and password `test`.

- **Example usage:**
  ```
  sh restore.sh 20250811123456
  ```

- **Output:** Messages for each database restored, ending with "Restore completed from: /root/arango_backups/<backup_time>".

If the backup directory doesn't exist, the script lists available backups and exits.

**Warning:** Restoration will overwrite existing data in the target databases. Always back up current data first.

For more on `arangorestore`, see the [ArangoDB Restore Documentation](https://docs.arangodb.com/3.12/operations/backup-and-restore/arangorestore/).

## ArangoDB Configuration and References

- **Version:** 3.12.4 (as specified in `compose.yaml`).
- **Experimental Features:** Vector indexes are enabled. For details, refer to [ArangoDB Vector Search Documentation](https://docs.arangodb.com/3.12/aql/functions/vector/).
- **Server Options:** Customized via the `command` in `compose.yaml`. See [ArangoDB Server Options](https://docs.arangodb.com/3.12/components/arangodb-server/options/) for a full list.
- **Accessing the Database:** Use the ArangoDB web interface at `http://localhost:8529` (login with `root` and your password). Or connect via tools like `arangosh`.
- **Official Documentation:** 
  - [ArangoDB Manual](https://docs.arangodb.com/3.12/)
  - [Docker Setup Guide](https://docs.arangodb.com/3.12/deployment/docker/)
  - [Backup and Restore Overview](https://docs.arangodb.com/3.12/operations/backup-and-restore/)

If you encounter issues, check the container logs or consult the ArangoDB community forums.


# ArangoDB Directory

Use `docker-compose up -d` to start the ArangoDB server.

If it's already running, verify with `docker ps` and `docker logs arango-vector-db`.

See the `/root/arango_data` directory for the database files (attached to the container).

Use `sh dump.sh` to dump the database to `/root/arango_backups/`

Use `sh restore.sh <backup_time>` to restore the database from a backup.

The backup time is the timestamp of the backup you want to restore from.