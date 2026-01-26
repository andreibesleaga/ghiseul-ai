# GENIE.AI - RAG Chatbot Framework Backend

This repository contains the backend services that power the GENIE.AI RAG (Retrieval-Augmented Generation) chatbot framework. GENIE.AI is a comprehensive enterprise chatbot platform that leverages OPEA (Open Platform for Enterprise AI) for LLM hosting and access, providing intelligent conversational AI capabilities with advanced user management, analytics, and administrative tools.

## Table of Contents

- [Overview](#overview)
- [Application Architecture](#application-architecture)
- [Bootstrap Process](#bootstrap-process)
- [OPEA Integration](#opea-integration)
- [Service Architecture](#service-architecture)
- [Controllers & Middleware](#controllers--middleware)
- [Shared Libraries](#shared-libraries)
- [Service Dependencies](#service-dependencies)
- [Database Schema](#database-schema)
- [Security System](#security-system)
- [API Layer](#api-layer)
- [Setup and Configuration](#setup-and-configuration)
- [Development](#development)
- [Deployment](#deployment)
- [Security Considerations](#security-considerations)

## Overview

GENIE.AI is designed as a microservices-based RAG chatbot framework that provides:

- **RAG-Powered Conversations**: Intelligent responses using OPEA's LLM hosting platform
- **Knowledge Base Management**: Service categorization and retrieval for context-aware responses
- **Conversation Management**: Persistent chat history with folder organization and threading
- **Advanced Analytics**: Real-time monitoring of chatbot performance and user interactions
- **Multi-language Support**: Internationalized responses and content management
- **Enterprise Features**: User management, security scanning, and administrative dashboards

## Application Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        VUE[Vue.js Frontend]
        MOBILE[Mobile Apps]
        API_CLIENTS[API Clients]
    end
    
    subgraph "Express Application (index.js)"
        SECURITY[Security Middleware]
        CORS[CORS Configuration]
        ROUTES[Route Mounting]
        ERROR[Error Handling]
    end
    
    subgraph "Controllers Layer"
        AUTH_CTRL[Auth Controller]
        ANALYTICS_CTRL[Analytics Controller]
        ADMIN_CTRL[Admin Controller]
    end
    
    subgraph "Middleware Layer"
        AUTH_MW[Auth Middleware]
        SECURITY_MW[Security Middleware]
        RATE_LIMIT[Rate Limiting]
    end
    
    subgraph "RAG Pipeline"
        direction LR
        QS[Query Service]
        RETRIEVAL[Knowledge Retrieval]
        OPEA[OPEA Platform]
        CONTEXT[Context Assembly]
    end
    
    subgraph "Core Services"
        AS[Analytics Service]
        CHS[Chat History Service]
        SCS[Service Category Service]
        UPS[User Profile Service]
        SS[Session Service]
        AUTHS[Auth Service]
    end
    
    subgraph "Infrastructure Services"
        ADS[Admin Dashboard]
        SES[Security Scan Service]
        LS[Logs Service]
        DBS[Database Operations]
        ES[Email Service]
        WS[Weather Service]
    end
    
    subgraph "Shared Libraries"
        LOGGER[Logger]
        DB_SERVICE[DB Service]
        SECURITY_LIB[Security Headers]
        MIDDLEWARE_LIB[Security Middleware]
    end
    
    subgraph "OPEA Integration"
        LLM[LLM Models]
        EMBED[Embedding Models]
        VECTOR[Vector Store]
        RERANK[Reranking Service]
    end
    
    subgraph "Data Layer"
        ARANGO[(ArangoDB)]
        FILES[File Storage]
        LOGS[Log Files]
    end
    
    VUE --> SECURITY
    MOBILE --> SECURITY
    API_CLIENTS --> SECURITY
    SECURITY --> CORS
    CORS --> ROUTES
    ROUTES --> AUTH_CTRL
    ROUTES --> ANALYTICS_CTRL
    ROUTES --> ADMIN_CTRL
    
    AUTH_CTRL --> AUTH_MW
    AUTH_MW --> AUTHS
    ANALYTICS_CTRL --> AS
    ADMIN_CTRL --> ADS
    
    QS --> RETRIEVAL
    RETRIEVAL --> SCS
    RETRIEVAL --> VECTOR
    QS --> CONTEXT
    CONTEXT --> OPEA
    OPEA --> LLM
    OPEA --> EMBED
    OPEA --> RERANK
    
    QS --> CHS
    QS --> AS
    AUTHS --> UPS
    AUTHS --> SS
    
    AS --> ARANGO
    CHS --> ARANGO
    SCS --> ARANGO
    UPS --> ARANGO
    UPS --> FILES
    SS --> ARANGO
    
    ADS --> ARANGO
    SES --> LOGS
    LS --> LOGS
    DBS --> ARANGO
    ES --> SMTP[Email Provider]
    WS --> WEATHER_API[Weather API]
    
    LOGGER --> LOGS
    DB_SERVICE --> ARANGO
    SECURITY_LIB --> SECURITY_MW
    MIDDLEWARE_LIB --> AUTH_MW
    
    style OPEA fill:#ff9999
    style QS fill:#99ccff
    style LOGGER fill:#ffcc99
    style DB_SERVICE fill:#ffcc99
```

## Bootstrap Process

The GENIE.AI backend follows a structured bootstrap process managed by `index.js`:

### Bootstrap Sequence Diagram

```mermaid
sequenceDiagram
    participant Main as index.js
    participant Shared as Shared Libraries
    participant DB as Database Service
    participant Services as Service Layer
    participant Routes as Route Layer
    participant Express as Express App
    
    Main->>Shared: Import shared-lib components
    Shared-->>Main: logger, dbService, security
    
    Main->>Express: Initialize Express app
    Main->>Express: Configure security middleware
    Main->>Express: Configure CORS
    Main->>Express: Configure static serving
    
    Main->>Main: Call initializeServices()
    Main->>DB: Test database connection
    DB-->>Main: Connection validated
    
    Main->>Services: Import all services
    Note over Services: Import auth, analytics, query, etc.
    Services-->>Main: Service instances
    
    Main->>Services: Initialize services in order
    Note over Services: session → auth → userProfile → query → analytics
    Services-->>Main: Initialized services
    
    Main->>Services: Set service dependencies
    Note over Services: Inject dependencies via setters
    Services-->>Main: Dependencies configured
    
    Main->>Routes: Load and mount routes
    Routes->>Services: Receive service instances
    Routes-->>Main: Routes mounted
    
    Main->>Express: Start HTTP server
    Express-->>Main: Server listening on port
    
    Note over Main: Application ready to serve requests
```

### Detailed Bootstrap Steps

#### 1. Environment Validation
```javascript
// Validate required environment variables
const requiredEnvVars = ['ARANGO_URL', 'ARANGO_DB', 'ARANGO_USERNAME', 'ARANGO_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
```

#### 2. Express Application Setup
```javascript
const app = express();

// Security configuration
app.disable('etag');
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Apply security middleware
app.use(securityHeaders);
app.use(helmet(cspOptions));
app.use(cors(corsOptions));
```

#### 3. Service Initialization Pipeline
```javascript
async function initializeServices() {
  // Step 1: Database connection test
  const defaultConnection = await dbService.getConnection('default');
  
  // Step 2: Import services with error handling
  const services = await importAllServices();
  
  // Step 3: Initialize in dependency order
  const initOrder = [
    { service: sessionService, name: 'SessionService' },
    { service: authService, name: 'AuthService', 
      preInit: () => authService.setSessionService(sessionService) },
    { service: serviceCategoryService, name: 'ServiceCategoryService' },
    // ... additional services
  ];
  
  // Step 4: Set cross-service dependencies
  queryService.setAnalyticsService(analyticsService);
  queryService.setChatHistoryService(chatHistoryService);
  
  return services;
}
```

#### 4. Route Configuration
```javascript
const routeConfigs = [
  { file: 'auth-routes', paths: ['/api/auth'], service: authService },
  { file: 'query-routes', paths: ['/api/queries'], service: queryService },
  { file: 'analytics-routes', paths: ['/api/analytics'], service: analyticsService },
  // ... additional routes
];

// Mount routes with services
for (const config of routeConfigs) {
  const routeInstance = require(`./routes/${config.file}`)(config.service);
  app.use(config.paths[0], routeInstance);
}
```

## OPEA Integration

GENIE.AI leverages OPEA (Open Platform for Enterprise AI) as the core AI engine for LLM processing.

### OPEA Request Flow Diagram

```mermaid
sequenceDiagram
    participant Client
    participant QueryService
    participant KnowledgeBase
    participant OPEA
    participant LLM
    participant Database
    
    Client->>QueryService: User Query
    QueryService->>Database: Store Query Record
    QueryService->>KnowledgeBase: Retrieve Context
    Note over KnowledgeBase: Vector similarity search
    KnowledgeBase-->>QueryService: Relevant Documents
    
    QueryService->>QueryService: Assemble Prompt
    Note over QueryService: Query + Context + Instructions
    
    QueryService->>OPEA: POST /v1/chatqna
    Note over QueryService,OPEA: {messages: "enhanced_prompt", stream: false}
    
    OPEA->>LLM: Process Enhanced Query
    LLM-->>OPEA: Generated Response
    OPEA-->>QueryService: Response Content
    
    QueryService->>Database: Update Query with Response
    QueryService->>Database: Record Analytics
    QueryService-->>Client: Final Response
    
    Note over Client,Database: End-to-end RAG pipeline complete
```

### OPEA Configuration

```javascript
// OPEA Service Configuration
const opeaHost = process.env.OPEA_HOST || 'e2e-109-198';
const opeaPort = process.env.OPEA_PORT || '8888';
const opeaUrl = `http://${opeaHost}:${opeaPort}/v1/chatqna`;

// OPEA Request Implementation
const opeaPayload = {
  messages: enhancedPrompt,  // User query + retrieved context
  stream: false
};

const opeaResponse = await axios.post(opeaUrl, opeaPayload);
const responseContent = opeaResponse.data.choices[0].message.content;
```

## Service Architecture

### Service Component Diagram

```mermaid
graph TB
    subgraph "Singleton Services (Stateful)"
        QS[Query Service<br/>OPEA Integration]
        AS[Analytics Service<br/>Metrics & KPIs]
        CHS[Chat History Service<br/>Conversations]
        SS[Session Service<br/>User Sessions]
        UPS[User Profile Service<br/>User Management]
        SCS[Service Category Service<br/>Knowledge Base]
        AUTHS[Auth Service<br/>Authentication]
    end
    
    subgraph "Utility Services (Stateless)"
        ES[Email Service<br/>Notifications]
        WS[Weather Service<br/>External Data]
        LS[Logs Service<br/>Log Analysis]
    end
    
    subgraph "Administrative Services (Hybrid)"
        ADS[Admin Dashboard<br/>System Monitoring]
        SES[Security Scan Service<br/>Threat Detection]
        DBS[Database Operations<br/>Maintenance]
    end
    
    subgraph "External Integrations"
        OPEA[OPEA Platform<br/>LLM Hosting]
        SMTP[Email Provider]
        WEATHER_API[Weather APIs]
    end
    
    QS -.-> OPEA
    QS --> AS
    QS --> CHS
    UPS --> SS
    AUTHS --> SS
    AS --> SCS
    CHS --> AS
    ES -.-> SMTP
    WS -.-> WEATHER_API
    ADS --> LS
    ADS --> SES
    
    style QS fill:#ff9999
    style OPEA fill:#ffcccc
    style AS fill:#99ff99
    style CHS fill:#99ccff
```

### Service Types Classification

| Service Type | Pattern | State Management | Initialization | OPEA Role |
|--------------|---------|------------------|----------------|-----------|
| **Singleton Services** | Single instance per application | Internal state + DB connections | `await service.init()` | Core RAG pipeline |
| **Utility Services** | Functional, minimal state | Configuration only | Simple instantiation | Data augmentation |
| **Administrative Services** | Hybrid stateless/cached | Performance caching | Init + periodic cleanup | Monitoring & security |

### Service Dependency Injection

```javascript
// Dependency injection pattern used throughout
class QueryService {
  setAnalyticsService(analyticsService) {
    this.analyticsService = analyticsService;
  }
  
  setChatHistoryService(chatHistoryService) {
    this.chatHistoryService = chatHistoryService;
  }
}

// Bootstrap process sets dependencies
queryService.setAnalyticsService(analyticsService);
queryService.setChatHistoryService(chatHistoryService);
```

## Controllers & Middleware

### Controller Architecture

```mermaid
graph TB
    subgraph "Request Flow"
        REQUEST[HTTP Request]
        MIDDLEWARE[Middleware Chain]
        CONTROLLER[Controller]
        SERVICE[Service Layer]
        RESPONSE[HTTP Response]
    end
    
    subgraph "Controller Types"
        AUTH_CTRL[Auth Controller<br/>Authentication & Authorization]
        ANALYTICS_CTRL[Analytics Controller<br/>Metrics & Dashboards]
        ADMIN_CTRL[Admin Controller<br/>System Administration]
    end
    
    subgraph "Middleware Chain"
        SECURITY_MW[Security Middleware<br/>Headers & CSP]
        AUTH_MW[Auth Middleware<br/>JWT Validation]
        ADMIN_MW[Admin Middleware<br/>Role Verification]
        RATE_MW[Rate Limiting<br/>DOS Protection]
    end
    
    REQUEST --> SECURITY_MW
    SECURITY_MW --> AUTH_MW
    AUTH_MW --> ADMIN_MW
    ADMIN_MW --> RATE_MW
    RATE_MW --> AUTH_CTRL
    RATE_MW --> ANALYTICS_CTRL
    RATE_MW --> ADMIN_CTRL
    
    AUTH_CTRL --> SERVICE
    ANALYTICS_CTRL --> SERVICE
    ADMIN_CTRL --> SERVICE
    SERVICE --> RESPONSE
    
    style AUTH_MW fill:#ffcc99
    style ADMIN_MW fill:#ff9999
    style SECURITY_MW fill:#99ccff
```

### Authentication Middleware Flow

```mermaid
sequenceDiagram
    participant Client
    participant AuthMW as Auth Middleware
    participant AuthService
    participant UserService
    participant Controller
    
    Client->>AuthMW: Request with JWT Token
    AuthMW->>AuthMW: Extract Bearer Token
    AuthMW->>AuthService: verifyToken(token)
    AuthService-->>AuthMW: Decoded User Data
    
    AuthMW->>UserService: getUserProfile(userId)
    UserService-->>AuthMW: User Details + Role
    
    AuthMW->>AuthMW: Validate Token Against DB
    Note over AuthMW: Check accessToken match<br/>Check account status
    
    AuthMW->>AuthMW: Attach req.user
    AuthMW->>Controller: next()
    Controller-->>Client: Authorized Response
    
    Note over AuthMW,Controller: User context available<br/>for entire request
```

### Controller Implementations

#### Auth Controller
```javascript
class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  async login(req, res) {
    const { loginName, encPassword } = req.body;
    const result = await this.authService.login(loginName, encPassword);
    res.json(result);
  }
  
  async register(req, res) {
    const userData = req.body;
    userData.frontendUrl = getFrontendUrl(req);
    userData.backendUrl = getBackendUrl(req);
    const result = await this.authService.register(userData);
    res.status(201).json(result);
  }
}
```

#### Analytics Controller
```javascript
class AnalyticsController {
  constructor(analyticsService) {
    this.analyticsService = analyticsService;
  }

  async getDashboardAnalytics(req, res) {
    const { startDate, endDate, locale } = req.query;
    const dashboardData = await this.analyticsService
      .getDashboardAnalytics(startDate, endDate, locale);
    res.json(dashboardData);
  }
}
```

### Middleware Chain Configuration

```javascript
// Security middleware stack
app.use(securityHeaders);
app.use(helmet(cspOptions));
app.use(cors(corsOptions));
app.use(SecurityMiddleware.applySecurityMiddleware);

// Request processing middleware
app.use(bodyParser.json());
app.use(morgan(customFormat));

// Route-specific middleware
app.use('/api/admin', authMiddleware.authenticate, authMiddleware.isAdmin);
app.use('/api/users', authMiddleware.authenticate);
```

## Shared Libraries

### Shared Library Architecture

```mermaid
graph TB
    subgraph "Shared Library (shared-lib/index.js)"
        LOGGER[Logger<br/>Winston-based]
        DB_SERVICE[Database Service<br/>ArangoDB Connection]
        SECURITY_HEADERS[Security Headers<br/>CSP & HSTS]
        SECURITY_MW[Security Middleware<br/>Request Validation]
        KEY_HANDLER[Key Handler<br/>Document Keys]
    end
    
    subgraph "Service Injection Points"
        SERVICES[All Services]
        ROUTES[Route Handlers]
        MIDDLEWARE[Middleware Chain]
        CONTROLLERS[Controllers]
    end
    
    subgraph "External Dependencies"
        WINSTON[Winston Logger]
        ARANGODB[ArangoDB Client]
        HELMET[Helmet Security]
    end
    
    LOGGER --> WINSTON
    DB_SERVICE --> ARANGODB
    SECURITY_HEADERS --> HELMET
    
    LOGGER --> SERVICES
    LOGGER --> ROUTES
    LOGGER --> MIDDLEWARE
    LOGGER --> CONTROLLERS
    
    DB_SERVICE --> SERVICES
    SECURITY_HEADERS --> MIDDLEWARE
    SECURITY_MW --> MIDDLEWARE
    KEY_HANDLER --> SERVICES
    
    style LOGGER fill:#99ccff
    style DB_SERVICE fill:#ffcc99
    style SECURITY_HEADERS fill:#99ff99
```

### Shared Library Components

#### Logger Service
```javascript
// Centralized logging with Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});
```

#### Database Service
```javascript
// Singleton database connection manager
class DatabaseService {
  async getConnection(name = 'default') {
    if (!this.connections[name]) {
      this.connections[name] = new Database({
        url: process.env.ARANGO_URL,
        databaseName: process.env.ARANGO_DB,
        auth: {
          username: process.env.ARANGO_USERNAME,
          password: process.env.ARANGO_PASSWORD
        }
      });
    }
    return this.connections[name];
  }
}
```

#### Security Headers
```javascript
// Standardized security headers
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 
    'max-age=31536000; includeSubDomains; preload');
  next();
};
```

### Library Injection Pattern

```javascript
// Services import shared libraries
const { logger, dbService, securityHeaders } = require('../shared-lib');

class ServiceExample {
  constructor() {
    this.logger = logger;        // Injected logger
    this.dbService = dbService;  // Injected DB service
  }
  
  async init() {
    this.db = await this.dbService.getConnection('default');
    this.logger.info('Service initialized with shared DB connection');
  }
}
```

## Service Dependencies

### Dependency Graph

```mermaid
graph TD
    subgraph "Initialization Order (Top to Bottom)"
        SHARED[Shared Libraries]
        DB[Database Service]
        SESSION[Session Service]
        AUTH[Auth Service]
        USER[User Profile Service]
        CATEGORY[Service Category Service]
        QUERY[Query Service]
        ANALYTICS[Analytics Service]
        CHAT[Chat History Service]
        ADMIN[Admin Dashboard Service]
    end
    
    subgraph "Runtime Dependencies (Arrows show injection)"
        AUTH --> SESSION
        USER --> SESSION
        QUERY --> ANALYTICS
        QUERY --> CHAT
        QUERY --> CATEGORY
        CHAT --> ANALYTICS
        ADMIN --> LOGS[Logs Service]
        ADMIN --> SECURITY[Security Service]
    end
    
    subgraph "External Integrations"
        QUERY -.-> OPEA[OPEA Platform]
        EMAIL[Email Service] -.-> SMTP[SMTP Provider]
        WEATHER[Weather Service] -.-> API[Weather API]
    end
    
    SHARED --> DB
    DB --> SESSION
    SESSION --> AUTH
    AUTH --> USER
    DB --> CATEGORY
    CATEGORY --> QUERY
    QUERY --> ANALYTICS
    ANALYTICS --> CHAT
    CHAT --> ADMIN
    
    style SHARED fill:#ffcc99
    style OPEA fill:#ff9999
    style QUERY fill:#99ccff
```

### Dependency Injection Implementation

```javascript
// Step 1: Initialize core services
await sessionService.init();
await authService.init();

// Step 2: Set immediate dependencies
authService.setSessionService(sessionService);
userProfileService.setSessionService(sessionService);

// Step 3: Initialize dependent services
await userProfileService.init();
await queryService.init();
await analyticsService.init();

// Step 4: Set cross-service dependencies
queryService.setAnalyticsService(analyticsService);
queryService.setChatHistoryService(chatHistoryService);
chatHistoryService.setAnalyticsService(analyticsService);
```

### Service Communication Patterns

#### 1. Direct Method Calls (Primary Pattern)
```javascript
// Query Service calling Analytics Service
await this.analyticsService.recordQuery(queryDoc);
```

#### 2. Event-Driven Communication (Future Enhancement)
```javascript
// Potential event-driven pattern
eventBus.emit('query.created', { queryId, userId, metrics });
```

#### 3. Database-Mediated Communication
```javascript
// Services communicate via shared database state
await this.db.collection('analytics').save(analyticsRecord);
```

## Database Schema

### ArangoDB Collections Overview

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : creates
    USERS ||--o{ CONVERSATIONS : owns
    USERS ||--o{ FOLDERS : organizes
    CONVERSATIONS ||--o{ MESSAGES : contains
    QUERIES ||--o{ MESSAGES : generates
    QUERIES }o--|| CATEGORIES : belongs_to
    CATEGORIES ||--o{ SERVICES : contains
    CONVERSATIONS }o--|| FOLDERS : organized_in
    QUERIES ||--o{ ANALYTICS : tracked_by
    USERS ||--o{ QUERIES : submits
    
    USERS {
        string _key PK
        string loginName UK
        string email UK
        string encPassword
        boolean emailVerified
        object personalIdentification
        object addressResidency
        datetime createdAt
        datetime updatedAt
    }
    
    QUERIES {
        string _key PK
        string userId FK
        string sessionId FK
        string text
        string response
        boolean isAnswered
        number responseTime
        string categoryId FK
        datetime timestamp
    }
    
    CONVERSATIONS {
        string _key PK
        string title
        string lastMessage
        datetime created
        datetime updated
        number messageCount
        boolean isStarred
        boolean isArchived
    }
    
    MESSAGES {
        string _key PK
        string conversationId FK
        string content
        string sender
        number sequence
        boolean readStatus
        datetime timestamp
    }
    
    CATEGORIES {
        string _key PK
        string catCode UK
        number order
    }
```

### Collections by Purpose

#### Core RAG Collections
- `queries` - User queries and OPEA responses
- `conversations` - Multi-turn conversation threads  
- `messages` - Individual messages in conversations
- `queryMessages` - Links queries to conversation responses

#### Knowledge Base Collections
- `serviceCategories` - Knowledge categories for context retrieval
- `services` - Specific knowledge items within categories
- `serviceCategoryTranslations` - Multi-language category names
- `serviceTranslations` - Localized service descriptions

#### User Management Collections
- `users` - User profiles and authentication data
- `sessions` - Active user sessions with expiration
- `userSessions` - User-session relationship edges
- `verificationTokens` - Email verification tokens
- `passwordResetTokens` - Password reset tokens

#### Analytics Collections
- `analytics` - Query metrics and response analytics
- `events` - System events and user interactions

#### Organization Collections
- `folders` - Conversation folder structure
- `folderConversations` - Folder-conversation relationships
- `userFolders` - User folder permissions

## Security System

### Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        TRANSPORT[Transport Security<br/>HTTPS/TLS]
        HEADERS[Security Headers<br/>CSP, HSTS, XSS Protection]
        AUTH[Authentication<br/>JWT Tokens]
        AUTHZ[Authorization<br/>Role-based Access]
        INPUT[Input Validation<br/>Sanitization]
        AUDIT[Audit Logging<br/>Security Events]
    end
    
    subgraph "Security Components"
        JWT[JWT Service<br/>Token Management]
        SCAN[Security Scanner<br/>Threat Detection]
        RATE[Rate Limiter<br/>DDoS Protection]
        ENCRYPT[Encryption<br/>Data Protection]
    end
    
    subgraph "Security Monitoring"
        LOGS[Security Logs<br/>Centralized Logging]
        ALERTS[Alert System<br/>Incident Response]
        METRICS[Security Metrics<br/>Dashboards]
    end
    
    TRANSPORT --> HEADERS
    HEADERS --> AUTH
    AUTH --> AUTHZ
    AUTHZ --> INPUT
    INPUT --> AUDIT
    
    AUTH --> JWT
    HEADERS --> RATE
    INPUT --> SCAN
    AUTHZ --> ENCRYPT
    
    SCAN --> LOGS
    RATE --> ALERTS
    JWT --> METRICS
    
    style TRANSPORT fill:#ff9999
    style AUTH fill:#99ccff
    style SCAN fill:#ffcc99
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant DB as Database
    participant Session as Session Service
    
    Client->>Gateway: Login Request
    Gateway->>Auth: Validate Credentials
    Auth->>DB: Check User Credentials
    DB-->>Auth: User Data
    
    alt Valid Credentials
        Auth->>Auth: Generate JWT Token
        Auth->>Session: Create Session
        Session->>DB: Store Session
        Auth-->>Gateway: JWT + User Data
        Gateway-->>Client: Success + Token
    else Invalid Credentials
        Auth-->>Gateway: Authentication Failed
        Gateway-->>Client: 401 Unauthorized
    end
    
    Note over Client,DB: Subsequent requests include JWT in Authorization header
    
    Client->>Gateway: Authenticated Request + JWT
    Gateway->>Auth: Verify JWT Token
    Auth->>DB: Validate Token Against Stored Data
    
    alt Valid Token
        DB-->>Auth: Token Valid
        Auth-->>Gateway: User Context
        Gateway->>Gateway: Process Request
        Gateway-->>Client: Response
    else Invalid Token
        Auth-->>Gateway: Token Invalid
        Gateway-->>Client: 401 Unauthorized
    end
```

### Security Features

#### JWT Token Security
```javascript
// JWT token generation with user context
const token = jwt.sign({
  userId: user._key,
  loginName: user.loginName,
  email: user.email
}, process.env.JWT_SECRET, { 
  expiresIn: process.env.JWT_EXPIRES_IN || '24h' 
});
```

#### Role-Based Authorization
```javascript
// Admin middleware checking user roles
async function isAdmin(req, res, next) {
  const user = await authService.getUserById(req.user.userId);
  const isAdmin = parseInt(user._key) <= 10 || user.role === 'Admin';
  
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
```

#### Security Headers
```javascript
// Content Security Policy
const cspOptions = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "cdn.jsdelivr.net"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: ["'self'", "https://api.open-meteo.com"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"]
  }
};
```

## API Layer

### API Structure

```mermaid
graph TB
    subgraph "API Endpoints"
        AUTH_API["/api/auth<br/>Authentication"]
        QUERY_API["/api/queries<br/>RAG Queries"]
        CHAT_API["/api/chat-history<br/>Conversations"]
        ANALYTICS_API["/api/analytics<br/>Metrics"]
        ADMIN_API["/api/admin<br/>Administration"]
        USER_API["/api/users<br/>User Management"]
    end
    
    subgraph "Route Handlers"
        AUTH_ROUTES[auth-routes.js]
        QUERY_ROUTES[query-routes.js]
        CHAT_ROUTES[chat-history-routes.js]
        ANALYTICS_ROUTES[analytics-routes.js]
        ADMIN_ROUTES[admin-routes.js]
        USER_ROUTES[user-routes.js]
    end
    
    subgraph "Middleware Stack"
        SECURITY_MW[Security Middleware]
        AUTH_MW[Auth Middleware]
        ADMIN_MW[Admin Middleware]
        VALIDATE_MW[Validation Middleware]
    end
    
    AUTH_API --> AUTH_ROUTES
    QUERY_API --> QUERY_ROUTES
    CHAT_API --> CHAT_ROUTES
    ANALYTICS_API --> ANALYTICS_ROUTES
    ADMIN_API --> ADMIN_ROUTES
    USER_API --> USER_ROUTES
    
    AUTH_ROUTES --> SECURITY_MW
    QUERY_ROUTES --> AUTH_MW
    CHAT_ROUTES --> AUTH_MW
    ANALYTICS_ROUTES --> AUTH_MW
    ADMIN_