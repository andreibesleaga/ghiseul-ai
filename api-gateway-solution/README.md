# Kong and NGINX Configuration Guide

This README provides documentation on using the provided scripts to manage and configure Kong (an API gateway) for a Node.js Express backend, and how to set up NGINX as a reverse proxy to route requests correctly between a Vue 3 frontend application and the Express server. The setup assumes a containerized or local environment where Kong is running on `localhost:8001` (Admin API) and `localhost:8000` (Proxy), the Vue app is served on port 8090, and the Express API is on port 3000.

Additionally, this guide includes documentation for the `docker-compose.yaml` file, which orchestrates the deployment of the entire stack, including Kong, databases, Keycloak for authentication, NGINX, and OWASP ZAP for security testing.

## Introduction

- **Kong**: Used as an API gateway to handle routing, authentication (e.g., JWT), rate limiting, CORS, logging, and other plugins for the Express API endpoints under `/api`.
- **NGINX**: Acts as the entry point, handling HTTPS termination, security headers, WebSocket proxying, and routing:
  - Frontend (Vue 3 app) at `/` (proxied to `http://e2e-109-51:8090`).
  - Backend API at `/api/` (proxied through Kong at `http://kong:8000/api/`).
- Scripts automate Kong backups, restores, applies, and rate-limiting management.
- Configuration files include JSON for Kong and `.conf` files for NGINX.
- **Docker Compose**: Manages the containerized services for the full environment.

The system is designed for a production-like setup with security best practices (e.g., CSP, HSTS, CORS).

## Prerequisites

- Docker and Docker Compose installed.
- Tools: `curl`, `jq` (for JSON parsing), `bash`.
- Environment variables (optional):
  - `LOGIN_PASSWORD`: For automated testing in `restore-kong-config.sh`.
- Backup files: Stored in `kong_backups/` directory.
- Custom files: Ensure `./pg_hba.conf`, `./kong_logs`, `./nginx/conf`, `./nginx/certs` are present or created as needed.

## Docker Compose Setup

The `docker-compose.yaml` file defines a multi-container application stack using Docker Compose version 3.8. It sets up a network (`kong-net`) and volumes for data persistence. This configuration integrates Kong as the API gateway, databases (Postgres and Mongo), Keycloak for identity management, NGINX as the reverse proxy, and OWASP ZAP for API security testing.

### Key Services

- **kong-database**: Postgres database for Kong.
  - Image: `postgres:13`.
  - Environment: User `kong`, DB `kong`, Password `k1ngk0ng`.
  - Ports: `5432`.
  - Volume: `kong_data:/var/lib/postgresql/data`; mounts custom `pg_hba.conf` for host-based authentication.
  - Healthcheck: Ensures database readiness.

- **kong**: Kong API gateway.
  - Image: `kong:latest`.
  - Depends on: `kong-database`.
  - Environment: Connects to Postgres; logs to stdout/stderr.
  - Ports: `8000` (proxy), `8443` (HTTPS proxy), `8001` (admin API).
  - Volume: `./kong_logs` for logs.

- **konga**: Web UI for managing Kong.
  - Image: `pantsel/konga:0.14.9`.
  - Depends on: `kong`, `mongo`.
  - Environment: Production mode, Mongo DB connection, token secret, Kong admin URL.
  - Ports: `1337`.

- **mongo**: MongoDB for Konga.
  - Image: `mongo:4.4`.
  - Volume: `mongo_data`.
  - Ports: `27017`.

- **keycloak**: Keycloak identity and access management.
  - Image: `quay.io/keycloak/keycloak:latest`.
  - Depends on: `keycloak-db`.
  - Command: Builds and starts in optimized mode.
  - Environment: Postgres connection, admin credentials (`admin`/`adminpassword`), HTTP enabled.
  - Ports: `8080`.

- **keycloak-db**: Postgres database for Keycloak.
  - Image: `postgres:15`.
  - Environment: DB `keycloak`, User `keycloak`, Password `keycloakpassword`.
  - Volume: `keycloak_data`.

- **nginx**: NGINX reverse proxy.
  - Image: `nginx:latest`.
  - Ports: `80` (HTTP), `443` (HTTPS).
  - Volumes: `./nginx/conf` for configs, `./nginx/certs` for SSL certs, `nginx_conf` and `nginx_certs` for additional persistence.
  - Depends on: `kong`.

- **zap**: OWASP ZAP for automated security testing.
  - Image: `ghcr.io/zaproxy/zaproxy:stable`.
  - Ports: `8095` (mapped to internal 8080).
  - Volume: `zap_data` for working directory.
  - Command: Runs in daemon mode with API key disabled.

### Networks and Volumes

- **Network**: All services connected to `kong-net` (bridge driver) for internal communication.
- **Volumes**: Persistent storage for databases (`kong_data`, `mongo_data`, `keycloak_data`), NGINX configs/certs (`nginx_conf`, `nginx_certs`), ZAP data (`zap_data`), and Kong logs.

### Usage

1. **Start the Stack**:
   ```bash
   docker-compose up -d
   ```
   - This starts all services in detached mode.
   - Wait for healthchecks (e.g., Kong database) to pass.

2. **Stop the Stack**:
   ```bash
   docker-compose down
   ```
   - Add `-v` to remove volumes (data loss warning).

3. **Logs**:
   ```bash
   docker-compose logs -f <service_name>  # e.g., kong
   ```

4. **Access Points**:
   - Kong Proxy: `http://localhost:8000`
   - Kong Admin API: `http://localhost:8001`
   - Konga UI: `http://localhost:1337`
   - Keycloak: `http://localhost:8080`
   - NGINX: `http://localhost:80` or `https://localhost:443`
   - ZAP: `http://localhost:8095` (API at `/UI/`)

5. **Configuration Notes**:
   - Customize environment variables (e.g., passwords) in production.
   - Ensure `./pg_hba.conf` allows necessary host-based access.
   - For Keycloak, initial setup via admin UI; bootstrap admin is `admin`/`adminpassword`.
   - NGINX mounts local configs and certs; generate self-signed certs if needed (e.g., via OpenSSL).
   - ZAP runs without API key for easy access; secure in production.

6. **Troubleshooting**:
   - Check dependencies: Use `docker-compose ps` to verify service status.
   - Database issues: Ensure healthchecks pass; inspect logs.
   - Network: Services communicate via service names (e.g., `kong-database`).
   - Volumes: Persistent data survives restarts; backup volumes regularly.

This setup provides a complete, secure environment for developing and testing the API gateway with frontend/backend integration.

## Kong Configuration Scripts

These scripts interact with Kong's Admin API (`http://localhost:8001`). They handle backups, applies, restores, and plugin management. Kong configs are in declarative JSON format (e.g., `kong_config.json`).

### 1. manage-kong-config.sh

This script backs up, applies, or fixes Kong configurations.

- **Usage**: `./manage-kong-config.sh [-b] [-a] [-f] [-h]`
  - `-b`: Backup current Kong config to `kong_backups/kong_backup_<timestamp>.json`.
  - `-a`: Apply config from `kong_config.json` (creates/updates services, routes, plugins, upstreams, targets).
  - `-f`: Fix auth routes (`/api/auth`, `/api/auth/login`, `/api/auth/refresh-token`) to bypass JWT and proxy directly to the backend.
  - `-h`: Show help.

- **How it works**:
  - Backup: Fetches services, routes, plugins, upstreams, and targets via API and saves to JSON.
  - Apply: Processes `kong_config.json` to update/create entities (e.g., service `express-api`, routes like `api-fallback`, plugins like `rate-limiting`).
  - Fix Auth: Removes JWT plugins from auth routes and ensures they exist without auth for login/refresh flows.
  - Logs to `kong_config.log`.

- **Example**:
  ```bash
  ./manage-kong-config.sh -b  # Backup current config
  ./manage-kong-config.sh -a  # Apply kong_config.json
  ./manage-kong-config.sh -f  # Fix auth routes
  ```

### 2. restore-kong-config.sh

Restores Kong config from a backup JSON file and optionally tests endpoints.

- **Usage**: `./restore-kong-config.sh [-b <backup_file>] [-t [jwt_token]] [-h]`
  - `-b <backup_file>`: Path to backup JSON (required for restore).
  - `-t [jwt_token]`: Test endpoints (prompts for credentials if no token; uses `LOGIN_PASSWORD` env if set).
  - `-h`: Show help.

- **How it works**:
  - Cleans up existing JWT plugins/credentials.
  - Restores services, routes, plugins, upstreams from backup.
  - Patches global rate-limiting plugin.
  - Tests (if `-t`): Logs in (if needed), tests `/api/auth/logout`, `/api/users/admin/users/2133/force-logout`, `/api/service-categories?locale=en`.
  - Logs to `kong_restore.log`.

- **Example**:
  ```bash
  ./restore-kong-config.sh -b kong_backups/kong_backup_20250527_162608.json  # Restore from backup
  ./restore-kong-config.sh -t eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Test with JWT token
  ./restore-kong-config.sh -t  # Test and prompt for credentials
  ```

### 3. kong-rate-limit.sh

Manages the rate-limiting plugin (ID: `13e146bb-0dff-4bfa-a9ca-95b8189ffb03`) on service `express-api`.

- **Usage**: `./kong-rate-limit.sh {disable|enable|status}`
  - `disable`: Disable the plugin.
  - `enable`: Enable the plugin.
  - `status`: Check current config (limits, policy, enabled state).

- **How it works**:
  - Patches plugin enabled state via API.
  - Formats responses with `python3 -m json.tool`.

- **Example**:
  ```bash
  ./kong-rate-limit.sh status   # View current rate limits (e.g., 1000/min, 10000/hour)
  ./kong-rate-limit.sh disable  # Disable rate limiting
  ```

## NGINX Configuration

NGINX handles external traffic, enforces security, and routes requests. Config files: `default.conf` (main server block) and `security-headers.conf` (shared headers).

### Setup

1. Place `default.conf` in `/etc/nginx/conf.d/` (or include it in `nginx.conf`).
2. Place `security-headers.conf` in `/etc/nginx/conf.d/`.
3. Ensure SSL certs are in `/etc/nginx/certs/`.
4. Reload NGINX: `nginx -s reload`.

### Key Configuration Details

- **HTTP to HTTPS Redirect**: All HTTP (port 80) redirects to HTTPS (port 443).
- **SSL/TLS**: Uses modern ciphers, session caching, and provided certs.
- **Security Headers**: Included via `security-headers.conf`:
  - X-Content-Type-Options, X-Frame-Options, X-XSS-Protection.
  - Strict-Transport-Security (HSTS with preload).
  - Referrer-Policy, Permissions-Policy.
  - Comprehensive CSP (Content Security Policy) allowing specific sources (e.g., self, cdnjs for styles/scripts, WebSockets).
  - CORS: Restricted to `https://e2e-82-109.ssdcloudindia.net`.
  - Hides server info (X-Powered-By, Server).

- **Routing**:
  - `/ws`: Proxies WebSockets to `http://e2e-109-51:8090/ws` (Vue app, clears compression extensions).
  - `/Uploads/`: Serves uploads with strict security headers.
  - `/*.txt|xml` (e.g., robots.txt): Cached with headers.
  - `/`: Proxies to Vue 3 app (`http://e2e-109-51:8090`), with WebSocket support and custom Host header (`genie-ai.itu.int`). CSP allows WebSockets and fonts.
  - `/api/`: Proxies to Kong (`http://kong:8000/api/`), handles OPTIONS (CORS preflight), timeouts (300s+). CSP is stricter for API.

- **Blocking**:
  - Denies access to dotfiles (e.g., `.git`) and sensitive paths.

### Example NGINX Config Snippet (from default.conf)

```nginx
server {
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/nginx/certs/server.crt;
    ssl_certificate_key /etc/nginx/certs/server.key;

    include conf.d/security-headers.conf;

    location / {
        proxy_pass http://e2e-109-51:8090;
        # ... (proxy settings, CSP overrides)
    }

    location /api/ {
        proxy_pass http://kong:8000/api/;
        # ... (CORS, timeouts, CSP)
    }
}
```

## Usage Examples

1. **Full Kong Setup**:
   ```bash
   ./manage-kong-config.sh -b  # Backup current config
   ./manage-kong-config.sh -a  # Apply kong_config.json
   ./manage-kong-config.sh -f  # Fix auth routes
   ```

2. **Restore and Test**:
   ```bash
   ./restore-kong-config.sh -b <backup.json>  # Restore from backup
   ./restore-kong-config.sh -t  # Test and prompt for credentials
   ```

3. **NGINX Routing Test**:
   - Access frontend: `https://e2e-82-109.ssdcloudindia.net/` (should load Vue app).
   - API call: `curl https://e2e-82-109.ssdcloudindia.net/api/auth/login` (proxied via Kong to Express).

## Logs

- Kong scripts log to `kong_config.log` and `kong_restore.log`.
- Review for errors (e.g., HTTP 400/404 during apply/restore).

## Troubleshooting

- **Kong API Errors**: Ensure Kong is running and Admin API is accessible. Check logs for schema violations.
- **NGINX Errors**: Verify cert paths, reload NGINX, check `/var/log/nginx/error.log`. Test CSP with browser dev tools.
- **JWT/Auth Issues**: Use `-f` in `manage-kong-config.sh` to bypass for login routes.
- **Timeouts**: Adjust proxy timeouts if requests hang.
- **CORS/CSP Blocks**: Inspect browser console; adjust origins/sources in configs.
- **Docker Issues**: Check `docker-compose logs` for startup errors; ensure ports are free; verify volume mounts.

For questions, refer to Kong docs (konghq.com) or NGINX docs (nginx.org).