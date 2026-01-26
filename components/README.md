# **Application Docker Compose Setup**

This document provides a detailed guide to the docker-compose.yaml file used for deploying the application. This setup defines a multi-container application consisting of a frontend, backend, document repository, database, cache, and virus scanning services.

## **1\. Overview**

The docker-compose.yaml file orchestrates the build and deployment of six main services:

* **frontend**: The user-facing web application (Vue.js), built from the ./gov-chat-frontend directory.  
* **backend**: The server-side application (Node.js) that handles business logic, API requests, and database connections, built from ./gov-chat-backend.  
* **document-repository**: A separate (Node.js) service for handling file uploads, ingestion, and security, built from ./document-repository.  
* **arango-vector-db**: The ArangoDB database instance, configured with experimental vector index support.  
* **redis-cache**: A Redis instance used for caching, particularly for frontend translations.  
* **clamav**: A ClamAV antivirus service used by the document-repository to scan uploads.

All services are designed to connect to an external Docker network named chatqna\_default for inter-service communication.

## **2\. Prerequisites**

Before running this setup, ensure the following prerequisites are met:

1. **Docker and Docker Compose**: Must be installed on your system.  
2. **Source Code**: The necessary source code directories must be present relative to the docker-compose.yaml file:  
   * ./gov-chat-frontend/  
   * ./gov-chat-backend/Dockerfile  
   * ./document-repository/Dockerfile  
3. **External Docker Network**: The services rely on a pre-existing network. Create it with the following command:  
   Bash  
   docker network create chatqna\_default

4. **Environment Files**: The services require environment files for configuration and secrets. Create the following files with their respective content:  
   * ./gov-chat-frontend/.env  
   * ./gov-chat-backend/.env  
   * ./document-repository/.env  
5. **Host Environment Variable**: The arango-vector-db service requires the ARANGO\_PASSWORD variable to be set in your host shell environment before running docker-compose up. This password should match the ARANGO\_PASSWORD variable in the ./gov-chat-backend/.env file.  
   Bash  
   export ARANGO\_PASSWORD=test \# Or your chosen password

## **3\. Usage**

### **Starting the Services**

To build and start all services in detached mode, run the following command from the same directory as the docker-compose.yaml file:

Bash

docker-compose up \-d \--build

### **Stopping the Services**

To stop and remove the containers, run:

Bash

docker-compose down

### **Viewing Logs**

To view the real-time logs for all services, run:

Bash

docker-compose logs \-f

To view logs for a specific service, add the service name (e.g., docker-compose logs \-f backend).

## **4\. Service Details**

### **4.1. frontend Service**

This service runs the user interface of the application.

* **Build**: The container image is built using the Dockerfile located in the ./gov-chat-frontend directory.  
* **Restart Policy**: The service is configured to restart automatically unless it is explicitly stopped (restart: unless-stopped).  
* **Ports**: The frontend is accessible on the host machine at port **8090**. This maps to port 8090 inside the container.  
* **Dependencies**: The frontend service will only start after the backend service has started successfully (depends\_on: \- backend).  
* **Environment File**: Loads configuration from ./gov-chat-frontend/.env.

#### **Frontend Configuration Parameters**

| Variable | Description | Example Value |
| :---- | :---- | :---- |
| NODE\_ENV | Sets the Node.js environment. | development |
| VUE\_APP\_API\_URL | The public-facing URL of the backend API. | https/e2e-82-109.ssdcloudindia.net:443/api |
| VUE\_APP\_CSP\_CONNECT\_SRC | Content Security Policy connect-src directive for the Vue app. | "self http://localhost:3000..." |
| CSP\_CONNECT\_SRC | Content Security Policy connect-src directive (likely for the server). | "'self' http://locahost..." |
| CORS\_ALLOWED\_ORIGINS | Comma-separated list of allowed origins for CORS. | "http://localhost,https://localhost..." |

### **4.2. backend Service**

This service runs the Node.js server that provides the application's API and business logic.

* **Build**: The image is built using the Dockerfile located in the ./gov-chat-backend/ directory.  
* **Restart Policy**: Configured to restart automatically unless explicitly stopped (restart: unless-stopped).  
* **Ports**: The backend API is accessible on the host machine at port **3000**.  
* **Dependencies**: The backend service will only start after the redis-cache service is healthy (depends\_on: redis-cache).  
* **Volumes**: The service uses several bind mounts to persist data:  
  * ./database\_backups:/app/database\_backups: Persists automated database backups.  
  * ./logs:/app/logs: Persists application logs.  
  * ./data:/app/data: A volume for general application data persistence.  
  * ./gov-chat-backend/Uploads:/app/Uploads: Persists user-uploaded files.  
* **Environment File**: It loads additional environment variables from ./gov-chat-backend/.env.

#### **Backend Configuration Parameters**

| Variable | Description | Example Value |
| :---- | :---- | :---- |
| **Application** |  |  |
| NODE\_ENV | Sets the Node.js environment. | production |
| PORT | The internal port the Express server listens on. | 3000 |
| API\_PREFIX | The base path for all API routes. | /api |
| APP\_NAME | The name of the application, used in emails. | Genie AI |
| FRONTEND\_URL | The public URL of the frontend, for generating links. | https://genie-ai.itu.int/ |
| LOG\_LEVEL | The verbosity of application logs. | debug |
| OPENWEATHERMAP\_API\_KEY | API key for the OpenWeatherMap service. | b115ccced... |
| **ArangoDB** |  |  |
| ARANGO\_URL | Connection URL for the ArangoDB instance. | http://arango-vector-db:8529 |
| ARANGO\_DB | The name of the database to use. | node-services |
| ARANGO\_USERNAME | Username for the ArangoDB connection. | root |
| ARANGO\_PASSWORD | **(Secret)** Password for the ArangoDB connection. | test |
| **Database Backup** |  |  |
| BACKUP\_DIR | Internal directory for storing database backups. | ./database\_backups |
| MAX\_BACKUPS | Maximum number of backups to retain. | 5 |
| BACKUP\_FORMAT | Format for the backups. | json |
| COMPRESS\_BACKUPS | Whether to compress backups. | true |
| **Session & Auth** |  |  |
| JWT\_SECRET | **(Secret)** Long, random string for signing JSON Web Tokens. | UJeFROw+yRJe... |
| JWT\_EXPIRES\_IN | Expiration time for JSON Web Tokens. | 24h |
| SESSION\_SECRET | **(Secret)** Long, random string for signing session cookies. | default-session-secret |
| SESSION\_EXPIRATION\_TIME | Duration of a user session in milliseconds (30 mins). | 1800000 |
| **File Uploads** |  |  |
| UPLOAD\_DIR | Internal directory where uploaded files are stored. | ./uploads |
| MAX\_FILE\_SIZE | Maximum allowed size for file uploads (5 MB). | 5242880 |
| **CORS & CSP** |  |  |
| CORS\_ORIGIN | The URL of the frontend allowed to make requests. | https://e2e-82-109.ssdcloudindia.net/ |
| CORS\_ALLOWED\_ORIGINS | A regex/list of allowed origins. | http://localhost:8090... |
| CSP\_CONNECT\_SRC | Content Security Policy connect-src directive for the backend. | "'self' http://localhost:3000..." |
| **Email Service** |  |  |
| EMAIL\_HOST | SMTP host for the email service. | smtp.itu.ch |
| EMAIL\_PORT | SMTP port for the email service. | 587 |
| EMAIL\_SECURE | Whether to use a secure connection (TLS). | false |
| EMAIL\_USER | **(Secret)** Username for the email service. | genie-ai |
| EMAIL\_PASSWORD | **(Secret)** Password for the email service. | gLp+Ek)Vf) |
| EMAIL\_FROM | Email address from which application emails are sent. | noreply@genie-ai.itu.int |
| **Translation Cache** |  |  |
| TRANSLATION\_THREADS | Number of translation threads. | 4 |
| TRANSLATION\_BATCHES | Number of translation batches. | 5 |
| TRANSLATION\_CACHE | Enable/disable translation cache. | on |
| TRANSLATION\_CACHE\_PATH | Path for cache. | /cache/translations |
| TRANSLATION\_CACHE\_PASSWORD | **(Secret)** Password for the Redis cache. | \!@\#$$5678 |
| TRANSLATION\_CACHE\_HOST | Hostname of the Redis service. | redis-cache |
| TRANSLATION\_CACHE\_PORT | Port of the Redis service. | 6379 |
| **OPEA Integration** |  |  |
| OPEA\_HOST | Hostname of the OPEA service for RAG. | e2e-109-198 |
| OPEA\_PORT | Port for the OPEA service. | 8888 |
| CONTEXT\_OPTION | Configuration option for context handling. | conversation-with-context-labels |

### **4.3. document-repository Service**

This service handles document uploads, validation, and ingestion.

* **Build**: The image is built using the Dockerfile located in the ./document-repository/ directory.  
* **Restart Policy**: Configured to restart automatically unless explicitly stopped (restart: unless-stopped).  
* **Ports**: The service is accessible on the host machine at port **3001**.  
* **Dependencies**: This service will only start after the clamav service has started (depends\_on: \- clamav).  
* **Volumes**:  
  * ./logs:/app/logs: Persists application logs.  
  * doc\_repo\_uploads:/app/uploads: Uses a named volume to persist file uploads.  
* **Environment File**: Loads configuration from ./document-repository/.env.

#### **Document Repository Configuration Parameters**

| Variable | Description | Example Value |
| :---- | :---- | :---- |
| **Service** |  |  |
| HOST | Host address the service binds to. | 0.0.0.0 |
| PORT | Internal port the service listens on. | 3001 |
| NODE\_ENV | Sets the Node.js environment. | development |
| **ArangoDB** |  |  |
| ARANGO\_URL | Connection URL for the ArangoDB instance. | http://91.203.132.51:8529 |
| ARANGO\_USERNAME | Username for the ArangoDB connection. | root |
| ARANGO\_PASSWORD | **(Secret)** Password for the ArangoDB connection. | test |
| ARANGO\_DB\_NAME | The name of the database to use. | node-services |
| **Document Ingestion** |  |  |
| DOCUMENT\_INGESTION\_LANGUAGE | Default language for document ingestion. | en |
| **Data Prep Service** |  |  |
| DATAPREP\_HOST | Hostname of the data preparation service. | http://91.203.132.198 |
| DATAPREP\_PORT | Port of the data preparation service. | 6007 |
| **File Uploads** |  |  |
| MAX\_FILES\_UPLOAD | Maximum number of files in a single upload. | 10 |
| MAX\_FILE\_SIZE | Maximum file size (50 MB). | 52428800 |
| UPLOAD\_DIR | Internal directory for storing uploads. | ./uploads |
| **Security** |  |  |
| JWT\_SECRET | **(Secret)** JWT secret for token validation. | default-jwt-secret |
| JWT\_EXPIRATION | Expiration time for JSON Web Tokens. | 24h |
| BCRYPT\_ROUNDS | Cost factor for bcrypt hashing. | 10 |
| **Clamscan (Virus Scanning)** |  |  |
| VIRUS\_SCANNING | Enable/disable virus scanning. | true |
| CLAMSCAN\_HOST | Hostname of the ClamAV service. | 127.0.0.1 |
| CLAMSCAN\_PORT | Port of the ClamAV service. | 3310 |
| CLAMSCAN\_TIMEOUT | Timeout for scan requests (ms). | 60000 |
| CLAMSCAN\_ACTIVE | Enable/disable the clamscan module. | true |
| **Logging** |  |  |
| LOG\_LEVEL | The verbosity of application logs. | info |
| LOG\_FILE | The name of the log file. | app.log |

### **4.4. arango-vector-db Service**

This service runs the ArangoDB database.

* **Image**: arangodb/arangodb:3.12.4  
* **Restart Policy**: restart: unless-stopped  
* **Ports**: Exposes the ArangoDB interface on the host at port **8529**.  
* **Volumes**: Persists database data to /root/arango\_data on the host machine.  
* **Environment**:  
  * ARANGO\_ROOT\_PASSWORD: **(Secret)** This is set using the ${ARANGO\_PASSWORD} variable from the host's shell environment.  
* **Command**: Starts ArangoDB with the \--experimental-vector-index=true flag to enable vector search capabilities.

### **4.5. redis-cache Service**

This service provides a Redis cache, primarily for the backend's translation service.

* **Image**: redis:7-alpine  
* **Restart Policy**: restart: unless-stopped  
* **Ports**: Exposes Redis on the host at port **6379** (optional, for debugging).  
* **Volumes**: Persists Redis data using the named volume redis\_data.  
* **Command**:  
  * redis-server \--appendonly yes \--maxmemory-policy noeviction \--requirepass "\!@\#$$5678"  
  * This command starts Redis with AOF persistence, no eviction, and a **hardcoded password**.  
  * **Note**: The password \!@\#$$5678 must match the TRANSLATION\_CACHE\_PASSWORD in the backend service's .env file.  
* **Healthcheck**: Includes a healthcheck to ensure Redis is responsive before dependent services (like backend) are started.

### **4.6. clamav Service**

This service provides on-demand antivirus scanning.

* **Image**: clamav/clamav  
* **Ports**: Exposes the ClamAV daemon on the host at port **3310**. This port is used by the document-repository service.

## **5\. Networking**

* **chatqna\_default**: This file defines a single network named chatqna\_default.  
* **External Network**: It is configured as external: true, which means Docker Compose will not create this network. You must create it manually (see Prerequisites). This setup is useful when integrating these services into a larger system with a shared network.  
* **Service Communication**: Services can communicate with each other on this network using their service names as hostnames (e.g., backend can reach the database at http://arango-vector-db:8529).