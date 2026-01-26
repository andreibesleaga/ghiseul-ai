// consolidated-db-schema.js
// A comprehensive script to initialize and manage database schema for Genie AI

// USAGE (bash):
// # Initialize complete schema with validation rules
// node consolidated-db-schema.js init

// # Only apply schema validation rules to existing collections
// node consolidated-db-schema.js apply-schemas

// # Create only schema structure (collections and indexes)
// node consolidated-db-schema.js create-schema

// # Update only user schema (loginName, encPassword, etc.)
// node consolidated-db-schema.js update-users

// # Add sample chat history data
// node consolidated-db-schema.js add-samples

// # Clean test collections (truncate)
// node consolidated-db-schema.js clean

// # Reset everything - clean and initialize with sample data
// node consolidated-db-schema.js reset

// # disable schema validation for the new queryMessages schema
// node consolidated-db-schema.js disable-querymessages-schema

// # Create folder structure
// node consolidated-db-schema.js create-folder-structure

// # Add sample folder data
// node consolidated-db-schema.js add-folder-samples

// just to link the query collection to the messages collection
// node consolidated-db-schema.js link-query-messages

require('dotenv').config();
const { Database } = require('arangojs');
const crypto = require('crypto');

// ================================================
// DATABASE CONNECTION CONFIGURATION
// ================================================
const config = {
  url: process.env.ARANGO_URL || 'http://localhost:8529',
  databaseName: process.env.ARANGO_DB || 'node-services',
  auth: {
    username: process.env.ARANGO_USERNAME || 'root',
    password: process.env.ARANGO_PASSWORD || 'test'
  }
};

// Initialize ArangoDB connection
const initDB = () => {
  const db = new Database({
    url: config.url,
    databaseName: config.databaseName,
    auth: {
      username: config.auth.username,
      password: config.auth.password
    }
  });

  return db;
};

// ================================================
// SCHEMA DEFINITIONS
// ================================================

// 1. Users Collection Schema
const usersCollection = {
  name: "users",
  schema: {
    rule: {
      type: "object",
      properties: {
        _key: { type: "string" },  // Unique identifier for the user
        loginName: { type: "string" }, // Added for authentication
        accessToken: { type: "string", optional: true }, // Added for authentication
        encPassword: { type: "string" }, // Added for encrypted password storage
        email: { type: "string" }, // Added as seen in the document screenshot
        emailVerified: { type: "boolean", default: true }, // Email verification status
        personalIdentification: {
          type: "object",
          properties: {
            fullName: { type: "string" },
            dob: { type: "string" },
            gender: { type: "string" },
            nationality: { type: "string" },
            maritalStatus: { type: "string" },
            photoUrl: { type: "string", optional: true },
            biometricUrl: { type: "string", optional: true }
          }
        },
        civilRegistration: {
          type: "object",
          optional: true,
          properties: {
            birthCertUrl: { type: "string", optional: true },
            deathCertUrl: { type: "string", optional: true },
            marriageDivorceUrl: { type: "string", optional: true },
            adoptionUrl: { type: "string", optional: true },
            citizenshipUrl: { type: "string", optional: true },
            immigrationUrl: { type: "string", optional: true }
          }
        },
        addressResidency: {
          type: "object",
          properties: {
            currentAddress: { type: "string" },
            previousAddresses: { type: "string", optional: true },
            homeOrRental: { type: "string", optional: true },
            utilityBillsUrl: { type: "string", optional: true },
            landRecordsUrl: { type: "string", optional: true }
          }
        },
        identityTravel: {
          type: "object",
          optional: true,
          properties: {
            idCard: { type: "string", optional: true },
            passport: { type: "string", optional: true },
            driversLicense: { type: "string", optional: true },
            voterId: { type: "string", optional: true },
            ssn: { type: "string", optional: true },
            militaryRecordsUrl: { type: "string", optional: true }
          }
        },
        healthMedical: {
          type: "object",
          optional: true,
          properties: {
            medicalHistory: { type: "string", optional: true },
            vaccinationsUrl: { type: "string", optional: true },
            insuranceDetails: { type: "string", optional: true },
            disability: { type: "string", optional: true },
            organDonor: { type: "string", optional: true },
            prescriptions: { type: "string", optional: true },
            mentalHealth: { type: "string", optional: true }
          }
        },
        employment: {
          type: "object",
          optional: true,
          properties: {
            eHistory: { type: "string", optional: true },
            currentEmployer: { type: "string", optional: true },
            workPermitsUrl: { type: "string", optional: true },
            certificationsUrl: { type: "string", optional: true },
            unemployment: { type: "string", optional: true },
            tin: { type: "string", optional: true },
            businessAffiliations: { type: "string", optional: true }
          }
        },
        education: {
          type: "object",
          optional: true,
          properties: {
            schools: { type: "string", optional: true },
            diplomas: { type: "string", optional: true },
            performance: { type: "string", optional: true },
            scholarships: { type: "string", optional: true }
          }
        },
        financialTax: {
          type: "object",
          optional: true,
          properties: {
            incomeTaxUrl: { type: "string", optional: true },
            bankAccounts: { type: "string", optional: true },
            propertyTaxUrl: { type: "string", optional: true },
            businessTaxUrl: { type: "string", optional: true },
            pensionContribUrl: { type: "string", optional: true },
            loanAidUrl: { type: "string", optional: true }
          }
        },
        socialSecurity: {
          type: "object",
          optional: true,
          properties: {
            pensionStatus: { type: "string", optional: true },
            unemployment: { type: "string", optional: true },
            disability: { type: "string", optional: true },
            childcare: { type: "string", optional: true },
            foodAssistance: { type: "string", optional: true },
            housingAssistance: { type: "string", optional: true }
          }
        },
        criminalLegal: {
          type: "object",
          optional: true,
          properties: {
            policeRecordsUrl: { type: "string", optional: true },
            courtCasesUrl: { type: "string", optional: true },
            finesPenaltiesUrl: { type: "string", optional: true },
            paroleProbation: { type: "string", optional: true },
            citizenshipRevocation: { type: "string", optional: true }
          }
        },
        transportation: {
          type: "object",
          optional: true,
          properties: {
            vehicleReg: { type: "string", optional: true },
            trafficViolationsUrl: { type: "string", optional: true },
            licenseHistory: { type: "string", optional: true },
            publicTransportCard: { type: "string", optional: true }
          }
        },
        civicParticipation: {
          type: "object",
          optional: true,
          properties: {
            voterRegistration: { type: "string", optional: true },
            electionHistory: { type: "string", optional: true },
            partyMembership: { type: "string", optional: true },
            militaryStatus: { type: "string", optional: true },
            publicServiceRoles: { type: "string", optional: true }
          }
        },
        createdAt: { type: "string" },
        updatedAt: { type: "string" }
      },
      required: ["_key", "loginName", "email", "encPassword", "personalIdentification", "addressResidency"]
    },
    level: "moderate",
    message: "User profile document does not match schema"
  }
};

// 2. Sessions Collection
const sessionsCollection = {
  name: "sessions",
  schema: {
    rule: {
      type: "object",
      properties: {
        _key: { type: "string" },  // Session ID
        userId: { type: "string" }, // Reference to users collection
        startTime: { type: "string" }, // ISO date string
        endTime: { type: "string", optional: true }, // ISO date string
        deviceInfo: { type: "object", optional: true },
        ipAddress: { type: "string", optional: true },
        active: { type: "boolean" }
      },
      required: ["_key", "userId", "startTime", "active"]
    },
    level: "moderate",
    message: "Session document does not match schema"
  }
};

// 3. ServiceCategories Collection
const serviceCategoriesCollection = {
  name: "serviceCategories",
  schema: {
    rule: {
      type: "object",
      properties: {
        _key: { type: "string" }, // e.g., "cat1", "cat2"
        nameEN: { type: "string" }, // English name
        nameFR: { type: "string", optional: true }, // French name
        nameSW: { type: "string", optional: true }, // Swahili name
        // Add more languages as needed
        order: { type: "number" } // For sorting categories
      },
      required: ["_key", "nameEN", "order"]
    },
    level: "moderate",
    message: "Service category document does not match schema"
  }
};

// 4. Services Collection
const servicesCollection = {
  name: "services",
  schema: {
    rule: {
      type: "object",
      properties: {
        _key: { type: "string" },
        categoryId: { type: "string" }, // Reference to serviceCategories
        nameEN: { type: "string" },
        nameFR: { type: "string", optional: true },
        nameSW: { type: "string", optional: true },
        // Add more languages as needed
        description: { type: "string", optional: true },
        order: { type: "number" } // For sorting services within a category
      },
      required: ["_key", "categoryId", "nameEN", "order"]
    },
    level: "moderate",
    message: "Service document does not match schema"
  }
};

// 5. Queries Collection
const queriesCollection = {
  name: "queries",
  schema: {
    rule: {
      type: "object",
      properties: {
        _key: { type: "string" },
        userId: { type: "string" }, // Reference to users collection
        sessionId: { type: "string" }, // Reference to sessions collection
        text: { type: "string" }, // The actual query text
        timestamp: { type: "string" }, // ISO date string
        responseTime: { type: "number" }, // Response time in milliseconds
        categoryId: { type: "string", optional: true }, // Reference to serviceCategories
        serviceId: { type: "string", optional: true }, // Reference to services
        isAnswered: { type: "boolean" },
        userFeedback: {
          type: "object",
          optional: true,
          properties: {
            rating: { type: "number" }, // e.g., 1-5 scale
            comment: { type: "string", optional: true },
            providedAt: { type: "string" } // ISO date string
          }
        },
        metadata: {
          type: "object",
          optional: true,
          properties: {
            criteria: { type: "string", optional: true }, // Additional search criteria
            tags: { type: "array", optional: true, items: { type: "string" } }
          }
        }
      },
      required: ["_key", "userId", "sessionId", "text", "timestamp", "isAnswered"]
    },
    level: "moderate",
    message: "Query document does not match schema"
  }
};

// 6. Analytics Collection
const analyticsCollection = {
  name: "analytics",
  schema: {
    rule: {
      type: "object",
      properties: {
        _key: { type: "string" }, // e.g., "daily-2025-03-08", "monthly-2025-03", etc.
        period: { type: "string" }, // "daily", "weekly", "monthly", "all-time"
        startDate: { type: "string" }, // ISO date string
        endDate: { type: "string" }, // ISO date string
        totalQueries: { type: "number" },
        uniqueUsers: { type: "number" },
        averageResponseTime: { type: "number" },
        satisfactionRate: { type: "number" }, // Average of user feedback ratings
        queryDistribution: {
          type: "array",
          items: {
            type: "object",
            properties: {
              categoryId: { type: "string" },
              count: { type: "number" }
            }
          }
        },
        topQueries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              count: { type: "number" }
            }
          }
        },
        lastUpdated: { type: "string" } // ISO date string
      },
      required: ["_key", "period", "startDate", "endDate", "totalQueries", "lastUpdated"]
    },
    level: "moderate",
    message: "Analytics document does not match schema"
  }
};

// 7. Events Collection
const eventsCollection = {
  name: "events",
  schema: {
    rule: {
      type: "object",
      properties: {
        _key: { type: "string" },
        userId: { type: "string" }, // Reference to users collection
        eventType: { type: "string" }, // Type of event (e.g., login, logout, query, feedback)
        timestamp: { type: "string" }, // ISO date string
        details: { type: "object", optional: true } // Event-specific details
      },
      required: ["_key", "userId", "eventType", "timestamp"]
    },
    level: "moderate",
    message: "Event document does not match schema"
  }
};

// 8. Password Reset Tokens Collection
const passwordResetTokensCollection = {
  name: "passwordResetTokens",
  schema: {
    rule: {
      type: "object",
      properties: {
        _key: { type: "string" },
        userId: { type: "string" }, // Reference to users collection
        token: { type: "string" }, // Unique token
        expiresAt: { type: "string" }, // ISO date string
        used: { type: "boolean", default: false }, // Whether token has been used
        createdAt: { type: "string" } // ISO date string
      },
      required: ["_key", "userId", "token", "expiresAt", "createdAt"]
    },
    level: "moderate",
    message: "Password reset token document does not match schema"
  }
};

// 9. Conversations Collection (for Chat History)
const conversationsCollection = {
  name: "conversations",
  schema: {
    rule: {
      type: "object",
      properties: {
        _key: { type: "string" },
        title: { type: "string" }, // Conversation title
        lastMessage: { type: "string" }, // Preview text
        created: { type: "string" }, // ISO date string
        updated: { type: "string" }, // ISO date string
        messageCount: { type: "number" },
        isStarred: { type: "boolean" },
        isArchived: { type: "boolean" },
        category: { type: "string" }, // Primary category name
        tags: { type: "array", items: { type: "string" } } // Context tags
      },
      required: ["_key", "title", "created", "updated", "messageCount", "isStarred", "isArchived"]
    },
    level: "moderate",
    message: "Conversation document does not match schema"
  }
};

// 10. Messages Collection (for Chat History)
const messagesCollection = {
  name: "messages",
  schema: {
    rule: {
      type: "object",
      properties: {
        _key: { type: "string" },
        conversationId: { type: "string" }, // Reference to conversations collection
        content: { type: "string" }, // Message content
        timestamp: { type: "string" }, // ISO date string
        sender: { type: "string" }, // "user" or "assistant"
        sequence: { type: "number" }, // Order in conversation
        readStatus: { type: "boolean" }, // Has user seen this message
        metadata: { type: "object", optional: true } // Additional message metadata
      },
      required: ["_key", "conversationId", "content", "timestamp", "sender", "sequence"]
    },
    level: "moderate",
    message: "Message document does not match schema"
  }
};

// 11. Folders Collection (NEW)
const foldersCollection = {
  name: "folders",
  schema: {
    rule: {
      type: "object",
      properties: {
        _key: { type: "string" },
        userId: { type: "string" }, // Reference to users collection
        name: { type: "string" },   // Name of the folder
        order: { type: "number", optional: true } // For sorting folders
      },
      required: ["_key", "userId", "name"]
    },
    level: "moderate",
    message: "Folder document does not match schema"
  }
};

// Edge Collections

// 12. User Sessions Edge Collection
const userSessionsEdgeCollection = {
  name: "userSessions",
  type: "edge",
  schema: {
    rule: {
      type: "object",
      properties: {
        _from: { type: "string" }, // users/user123
        _to: { type: "string" }, // sessions/session456
        createdAt: { type: "string" }
      },
      required: ["_from", "_to", "createdAt"]
    },
    level: "moderate",
    message: "User-Session edge does not match schema"
  }
};

// 13. Session Queries Edge Collection
const sessionQueriesEdgeCollection = {
  name: "sessionQueries",
  type: "edge",
  schema: {
    rule: {
      type: "object",
      properties: {
        _from: { type: "string" }, // sessions/session456
        _to: { type: "string" }, // queries/query789
        createdAt: { type: "string" }
      },
      required: ["_from", "_to", "createdAt"]
    },
    level: "moderate",
    message: "Session-Query edge does not match schema"
  }
};

// 14. Category Services Edge Collection
const categoryServicesEdgeCollection = {
  name: "categoryServices",
  type: "edge",
  schema: {
    rule: {
      type: "object",
      properties: {
        _from: { type: "string" }, // serviceCategories/cat1
        _to: { type: "string" }, // services/service123
        order: { type: "number" } // For sorting services within a category
      },
      required: ["_from", "_to"]
    },
    level: "moderate",
    message: "Category-Service edge does not match schema"
  }
};

// 15. Query Categories Edge Collection
const queryCategoriesEdgeCollection = {
  name: "queryCategories",
  type: "edge",
  schema: {
    rule: {
      type: "object",
      properties: {
        _from: { type: "string" }, // queries/query789
        _to: { type: "string" }, // serviceCategories/cat1
        confidence: { type: "number", optional: true } // AI confidence in categorization
      },
      required: ["_from", "_to"]
    },
    level: "moderate",
    message: "Query-Category edge does not match schema"
  }
};

// 16. User Conversations Edge Collection (for Chat History)
const userConversationsEdgeCollection = {
  name: "userConversations",
  type: "edge",
  schema: {
    rule: {
      type: "object",
      properties: {
        _from: { type: "string" }, // users/user123
        _to: { type: "string" }, // conversations/conv456
        role: { type: "string" }, // "owner", "viewer", etc.
        lastViewedAt: { type: "string" } // ISO date string
      },
      required: ["_from", "_to", "role"]
    },
    level: "moderate",
    message: "User-Conversation edge does not match schema"
  }
};

// 17. Conversation Categories Edge Collection (for Chat History)
const conversationCategoriesEdgeCollection = {
  name: "conversationCategories",
  type: "edge",
  schema: {
    rule: {
      type: "object",
      properties: {
        _from: { type: "string" }, // conversations/conv456
        _to: { type: "string" }, // serviceCategories/cat1
        relevanceScore: { type: "number" } // How relevant this category is
      },
      required: ["_from", "_to"]
    },
    level: "moderate",
    message: "Conversation-Category edge does not match schema"
  }
};

// 18. Query Messages Edge Collection (links queries to messages)
const queryMessagesEdgeCollection = {
  name: "queryMessages",
  type: "edge",
  schema: {
    rule: {
      type: "object",
      properties: {
        _from: { type: "string" },  // queries/query123
        _to: { type: "string" },    // messages/message456
        responseType: { type: "string" },  // e.g., "primary", "followup", "clarification"
        confidenceScore: { type: "number", optional: true }, // AI confidence in the response
        createdAt: { type: "string" } // ISO date string
      },
      required: ["_from", "_to", "responseType", "createdAt"]
    },
    level: "moderate",
    message: "Query-Message edge does not match schema"
  }
};

// 19. Folder Conversations Edge Collection (NEW)
const folderConversationsEdgeCollection = {
  name: "folderConversations",
  type: "edge",
  schema: {
    rule: {
      type: "object",
      properties: {
        _from: { type: "string" }, // folders/folder123
        _to: { type: "string" }    // conversations/conv456
      },
      required: ["_from", "_to"]
    },
    level: "moderate",
    message: "Folder-Conversation edge does not match schema"
  }
};

// 20. User Folders Edge Collection (NEW)
const userFoldersEdgeCollection = {
  name: "userFolders",
  type: "edge",
  schema: {
    rule: {
      type: "object",
      properties: {
        _from: { type: "string" }, // users/user123
        _to: { type: "string" },   // folders/folder456
        role: { type: "string" },  // "owner", "viewer", "editor", etc.
        sharedBy: { type: "string", optional: true }, // User who shared the folder (for non-owners)
        sharedAt: { type: "string", optional: true }, // When it was shared (for non-owners)
        lastAccessedAt: { type: "string", optional: true } // Last access timestamp
      },
      required: ["_from", "_to", "role"]
    },
    level: "moderate",
    message: "User-Folder edge does not match schema"
  }
};

// Group all schema definitions
const schemaDefinitions = {
  // Document Collections
  users: usersCollection,
  sessions: sessionsCollection,
  serviceCategories: serviceCategoriesCollection,
  services: servicesCollection,
  queries: queriesCollection,
  analytics: analyticsCollection,
  events: eventsCollection,
  passwordResetTokens: passwordResetTokensCollection,
  conversations: conversationsCollection,
  messages: messagesCollection,
  folders: foldersCollection,

  // Edge Collections
  userSessions: userSessionsEdgeCollection,
  sessionQueries: sessionQueriesEdgeCollection,
  categoryServices: categoryServicesEdgeCollection,
  queryCategories: queryCategoriesEdgeCollection,
  userConversations: userConversationsEdgeCollection,
  conversationCategories: conversationCategoriesEdgeCollection,
  queryMessages: queryMessagesEdgeCollection,
  folderConversations: folderConversationsEdgeCollection,
  userFolders: userFoldersEdgeCollection,
};

// ================================================
// COLLECTION DEFINITIONS
// ================================================

// Base collections (document and edge collections)
const baseCollections = {
  // Document Collections
  documentCollections: [
    'users',
    'sessions',
    'queries',
    'analytics',
    'events',
    'services',
    'serviceCategories',
    'passwordResetTokens'
  ],

  // Edge Collections
  edgeCollections: [
    'userSessions',     // users to sessions
    'sessionQueries',   // sessions to queries
    'queryCategories',  // queries to categories
    'categoryServices'  // categories to services
  ]
};

// Chat history collections
const chatHistoryCollections = {
  // Document Collections
  documentCollections: [
    'conversations',   // Stores metadata about each conversation
    'messages'         // Stores individual messages in conversations
  ],

  // Edge Collections
  edgeCollections: [
    'userConversations',       // Links users to their conversations
    'conversationCategories',  // Links conversations to categories
    'queryMessages'            // Links queries to messages
  ]
};

// Folder collections (NEW)
const folderCollections = {
  // Document Collections
  documentCollections: [
    'folders'          // Stores folder information
  ],

  // Edge Collections
  edgeCollections: [
    'folderConversations',      // Links folders to conversations
    'userFolders'           // Links users to folders
  ]
};

// Combine all collections
const allCollections = {
  documentCollections: [
    ...baseCollections.documentCollections,
    ...chatHistoryCollections.documentCollections,
    ...folderCollections.documentCollections
  ],
  edgeCollections: [
    ...baseCollections.edgeCollections,
    ...chatHistoryCollections.edgeCollections,
    ...folderCollections.edgeCollections
  ]
};

// ================================================
// INDEX DEFINITIONS
// ================================================

// Define all indexes to ensure for each collection
const collectionIndexes = {
  users: [
    { fields: ['email'], unique: true, name: 'email_idx' },
    { fields: ['loginName'], unique: true, name: 'loginName_idx' },
    { fields: ['emailVerified'], name: 'emailVerified_idx' }
  ],

  sessions: [
    { fields: ['userId'], name: 'userId_idx' },
    { fields: ['expiresAt'], name: 'expiresAt_idx' }
  ],

  queries: [
    { fields: ['timestamp'], name: 'timestamp_idx' },
    { fields: ['text'], name: 'text_idx' },
    { fields: ['responseTime'], name: 'responseTime_idx' },
    { fields: ['isAnswered'], name: 'isAnswered_idx' },
    { fields: ['timestamp', 'userId'], name: 'timeseries_idx' },
    { fields: ['categoryId'], name: 'categoryId_idx' }
  ],

  analytics: [
    { fields: ['timestamp', 'type'], name: 'timestamp_type_idx' },
    { fields: ['queryId'], name: 'queryId_idx' },
    { fields: ['type'], name: 'type_idx' },
    { fields: ['userId'], name: 'userId_idx' },
    { fields: ['type', 'timestamp', 'data.isAnswered'], name: 'dashboard_query_idx' },
    { fields: ['type', 'timestamp', 'data.rating'], name: 'feedback_idx' },
    { fields: ['type', 'timestamp', 'data.categoryId'], name: 'category_idx' }
  ],

  events: [
    { fields: ['timestamp'], name: 'timestamp_idx' },
    { fields: ['userId'], name: 'userId_idx' },
    { fields: ['eventType'], name: 'eventType_idx' }
  ],

  serviceCategories: [
    { fields: ['nameEN'], name: 'nameEN_idx' }
  ],

  passwordResetTokens: [
    { fields: ['userId'], name: 'userId_idx' },
    { fields: ['token'], unique: true, name: 'token_idx' },
    { fields: ['expiresAt'], name: 'expiresAt_idx' },
    { fields: ['used'], name: 'used_idx' }
  ],

  // Chat History indexes
  conversations: [
    { fields: ['updated'], name: 'updated_idx' },
    { fields: ['isStarred'], name: 'isStarred_idx' },
    { fields: ['isArchived'], name: 'isArchived_idx' },
    { fields: ['title'], name: 'title_idx' },
    { fields: ['tags'], name: 'tags_idx' },
    { fields: ['category'], name: 'category_idx' }
  ],

  messages: [
    { fields: ['conversationId'], name: 'conversationId_idx' },
    { fields: ['timestamp'], name: 'timestamp_idx' },
    { fields: ['sequence'], name: 'sequence_idx' },
    { fields: ['sender'], name: 'sender_idx' }
  ],

  userConversations: [
    { fields: ['_from'], name: 'from_idx' }
  ],

  conversationCategories: [
    { fields: ['_to'], name: 'to_idx' }
  ],

  queryMessages: [
    { fields: ['_from'], name: 'from_idx' },   // For finding messages for a specific query
    { fields: ['_to'], name: 'to_idx' },       // For finding queries related to a message
    { fields: ['responseType'], name: 'responseType_idx' }  // For filtering by response type
  ],

  // Folder indexes (NEW)
  folders: [
    { fields: ['userId'], name: 'userId_idx' },
    { fields: ['name'], name: 'name_idx' },
    { fields: ['order'], name: 'order_idx' }
  ],

  folderConversations: [
    { fields: ['_from'], name: 'from_idx' },  // For finding conversations in a folder
    { fields: ['_to'], name: 'to_idx' }       // For finding folders containing a conversation
  ],

  userFolders: [
    { fields: ['_from'], name: 'from_idx' },  // For finding folders for a user
    { fields: ['_to'], name: 'to_idx' },      // For finding users with access to a folder
    { fields: ['role'], name: 'role_idx' }    // For filtering by role type
  ],
};

// ================================================
// HELPER FUNCTIONS
// ================================================

/**
 * Test the database connection
 */
async function testConnection(db) {
  try {
    console.log("Testing connection to ArangoDB...");
    const info = await db.version();
    console.log(`Connected to ArangoDB version: ${info.version}`);
    return true;
  } catch (error) {
    console.error("Connection test failed:", error.message);
    throw new Error(`Authentication failed. Please check your ArangoDB credentials.`);
  }
}

/**
 * Check if the database exists, create if it doesn't
 */
async function ensureDatabase(db) {
  try {
    console.log(`Ensuring database '${config.databaseName}' exists...`);
    const databases = await db.listDatabases();

    if (!databases.includes(config.databaseName)) {
      console.log(`Creating database '${config.databaseName}'...`);
      await db.createDatabase(config.databaseName);
      console.log(`Database '${config.databaseName}' created.`);
    } else {
      console.log(`Database '${config.databaseName}' already exists.`);
    }

    return true;
  } catch (error) {
    console.error(`Error ensuring database existence:`, error);
    throw error;
  }
}

/**
 * Create a collection if it doesn't exist
 */
async function ensureCollection(db, collectionName, isEdgeCollection = false) {
  try {
    const collection = db.collection(collectionName);

    if (await collection.exists()) {
      console.log(`Collection '${collectionName}' already exists.`);
    } else {
      console.log(`Creating ${isEdgeCollection ? 'edge' : 'document'} collection: ${collectionName}`);

      // Options for collection creation
      const options = {
        waitForSync: true
      };

      // If it's an edge collection, set the type
      if (isEdgeCollection) {
        options.type = 3; // Type 3 for edge collection
      }

      await collection.create(options);
      console.log(`Collection '${collectionName}' created.`);

      // If there's a schema definition for this collection, apply it
      if (schemaDefinitions[collectionName]) {
        await applyCollectionSchema(db, collectionName);
      }
    }

    return collection;
  } catch (error) {
    console.error(`Error creating collection '${collectionName}':`, error);
    throw error;
  }
}

/**
 * Apply schema validation rule to a collection
 */
async function applyCollectionSchema(db, collectionName) {
  try {
    // Check if there's a schema definition for this collection
    if (!schemaDefinitions[collectionName]) {
      console.log(`No schema definition found for collection '${collectionName}'.`);
      return false;
    }

    const schemaDefinition = schemaDefinitions[collectionName];

    // Check if the collection exists
    const collection = db.collection(collectionName);
    if (!(await collection.exists())) {
      console.log(`Collection '${collectionName}' does not exist, cannot apply schema.`);
      return false;
    }

    console.log(`Applying schema validation rule to collection '${collectionName}'...`);

    // Get collection properties to check if schema validation is already set
    const properties = await collection.properties();

    // Skip if schema is already defined
    if (properties.schema && properties.schema.rule) {
      console.log(`Schema validation already exists for collection '${collectionName}'.`);
      return true;
    }

    // Apply the schema validation rule
    await collection.properties({
      schema: schemaDefinition.schema
    });

    console.log(`Schema validation applied to collection '${collectionName}'.`);
    return true;
  } catch (error) {
    console.error(`Error applying schema to collection '${collectionName}':`, error);
    return false;
  }
}

/**
 * Create an index on a collection if it doesn't exist
 */
async function ensureIndex(collection, fields, options = {}) {
  try {
    const indexName = options.name || `idx_${fields.join('_')}`;

    // Prepare index options
    const indexOptions = {
      type: 'persistent',
      fields: fields,
      name: indexName,
      sparse: false,
      ...options
    };

    // Create the index
    const indexInfo = await collection.ensureIndex(indexOptions);

    console.log(`Index '${indexName}' on ${collection.name}: ${indexInfo.isNewlyCreated ? 'created' : 'already exists'}`);
    return indexInfo;
  } catch (error) {
    console.error(`Error creating index on collection ${collection.name} for fields [${fields.join(', ')}]:`, error);
    throw error;
  }
}

/**
 * Function to generate a default encrypted password for user migration
 */
function generateDefaultEncPassword(userKey) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256')
    .update(`default_password_${userKey}_${salt}`)
    .digest('hex');

  return `${salt}:${hash}`;
}

// ================================================
// SCHEMA MANAGEMENT FUNCTIONS
// ================================================

/**
 * Create all collections and indexes for the application
 */
async function createSchemaStructure() {
  const db = initDB();

  try {
    // 1. Test the connection
    await testConnection(db);

    // 2. Ensure database exists
    //await ensureDatabase(db);

    console.log('Creating base schema structure...');

    // 3. Create document collections
    for (const collectionName of allCollections.documentCollections) {
      await ensureCollection(db, collectionName, false);
    }

    // 4. Create edge collections
    for (const collectionName of allCollections.edgeCollections) {
      await ensureCollection(db, collectionName, true);
    }

    // 5. Create indexes for each collection
    console.log('Creating indexes for all collections...');

    for (const [collectionName, indexes] of Object.entries(collectionIndexes)) {
      const collection = db.collection(collectionName);

      if (await collection.exists()) {
        for (const indexDef of indexes) {
          await ensureIndex(collection, indexDef.fields, {
            unique: indexDef.unique || false,
            name: indexDef.name
          });
        }
      } else {
        console.log(`Skipping indexes for non-existent collection: ${collectionName}`);
      }
    }

    // 6. Ensure all collections have schema validation applied
    console.log('Applying schema validation rules to collections...');
    for (const collectionName of Object.keys(schemaDefinitions)) {
      await applyCollectionSchema(db, collectionName);
    }

    console.log('Schema structure creation completed successfully.');
    return true;
  } catch (error) {
    console.error('Error creating schema structure:', error);
    throw error;
  }
}

/**
 * Update user schema to ensure required authentication fields
 */
async function updateUserSchema() {
  const db = initDB();

  try {
    console.log('Starting user schema update...');

    // Get the users collection
    const usersCollection = db.collection('users');

    // Check if collection exists
    if (!(await usersCollection.exists())) {
      console.log('Users collection does not exist, skipping user schema update.');
      return false;
    }

    // Count users missing authentication fields
    const cursor = await db.query(`
        RETURN {
          missingLoginName: LENGTH(FOR doc IN users FILTER !HAS(doc, "loginName") RETURN 1),
          missingAccessToken: LENGTH(FOR doc IN users FILTER !HAS(doc, "accessToken") RETURN 1),
          missingEncPassword: LENGTH(FOR doc IN users FILTER !HAS(doc, "encPassword") RETURN 1),
          missingEmailVerified: LENGTH(FOR doc IN users FILTER !HAS(doc, "emailVerified") RETURN 1),
          total: LENGTH(FOR doc IN users RETURN 1)
        }
      `);
    const [stats] = await cursor.all();

    console.log(`Found ${stats.total} total users`);
    console.log(`${stats.missingLoginName} users missing loginName field`);
    console.log(`${stats.missingAccessToken} users missing accessToken field`);
    console.log(`${stats.missingEncPassword} users missing encPassword field`);
    console.log(`${stats.missingEmailVerified} users missing emailVerified field`);

    // Update users missing loginName
    if (stats.missingLoginName > 0) {
      console.log('Updating users missing loginName...');
      const loginNameCursor = await db.query(`
          FOR doc IN users
            FILTER !HAS(doc, "loginName")
            UPDATE doc WITH { 
              loginName: HAS(doc, "email") ? doc.email : CONCAT("user_", doc._key)
            } IN users
            RETURN NEW
        `);

      const loginNameResult = await loginNameCursor.all();
      console.log(`Added loginName to ${loginNameResult.length} user documents`);
    }

    // Update users missing accessToken
    if (stats.missingAccessToken > 0) {
      console.log('Updating users missing accessToken...');
      const accessTokenCursor = await db.query(`
          FOR doc IN users
            FILTER !HAS(doc, "accessToken")
            UPDATE doc WITH { 
              accessToken: null 
            } IN users
            RETURN NEW
        `);

      const accessTokenResult = await accessTokenCursor.all();
      console.log(`Added accessToken to ${accessTokenResult.length} user documents`);
    }

    // Update users missing encPassword
    if (stats.missingEncPassword > 0) {
      console.log('Updating users missing encPassword...');

      // Get all users missing the encPassword field
      const usersCursor = await db.query(`
          FOR doc IN users
            FILTER !HAS(doc, "encPassword")
            RETURN { _key: doc._key }
        `);

      const usersToUpdate = await usersCursor.all();
      console.log(`Found ${usersToUpdate.length} users needing encPassword updates`);

      let updatedCount = 0;

      // Update each user with a unique default encrypted password
      for (const user of usersToUpdate) {
        const encPassword = generateDefaultEncPassword(user._key);

        await usersCollection.update(user._key, {
          encPassword: encPassword
        });

        updatedCount++;

        if (updatedCount % 50 === 0) {
          console.log(`Updated encPassword for ${updatedCount}/${usersToUpdate.length} users...`);
        }
      }

      console.log(`Added encPassword to ${updatedCount} user documents`);
    }

    // Fix email verification field
    console.log('Ensuring correct email verification field exists...');

    // Remove isEmailVerified, ensure emailVerified exists and set it to true
    const emailVerifiedCursor = await db.query(`
        FOR user IN users
          LET updatedUser = MERGE(
            UNSET(user, 'isEmailVerified'),
            { emailVerified: HAS(user, "emailVerified") ? user.emailVerified : true }
          )
          UPDATE user WITH updatedUser IN users
          RETURN { 
            _key: user._key, 
            email: user.email, 
            oldIsEmailVerified: user.isEmailVerified,
            newEmailVerified: HAS(user, "emailVerified") ? user.emailVerified : true 
          }
      `);

    const emailVerifiedResult = await emailVerifiedCursor.all();
    console.log(`Updated emailVerified on ${emailVerifiedResult.length} user documents`);

    console.log('User schema update completed successfully.');
    return true;
  } catch (error) {
    console.error('Error updating user schema:', error);
    throw error;
  }
}

/**
 * Add sample data for chat history testing
 */
async function addChatHistorySampleData() {
  const db = initDB();

  try {
    console.log('Adding chat history sample data...');

    // Create sample conversation
    const conversationsCollection = db.collection('conversations');
    const messagesCollection = db.collection('messages');
    const userConversationsCollection = db.collection('userConversations');
    const conversationCategoriesCollection = db.collection('conversationCategories');

    // Check if we need to add sample data
    const sampleDataCheckCursor = await db.query(`
        RETURN {
          conversations: LENGTH(FOR c IN conversations RETURN c),
          messages: LENGTH(FOR m IN messages RETURN m)
        }
      `);

    const [dataStats] = await sampleDataCheckCursor.all();

    if (dataStats.conversations > 0) {
      console.log(`Found ${dataStats.conversations} existing conversations and ${dataStats.messages} messages.`);
      console.log('Skipping sample data creation.');
      return false;
    }

    // Check if a user exists
    const userCursor = await db.query(`
        FOR u IN users
        LIMIT 1
        RETURN u
      `);

    const users = await userCursor.all();
    if (users.length === 0) {
      console.log('No users found. Please create users first.');
      return false;
    }

    const userId = users[0]._id;
    console.log(`Using user: ${userId}`);

    // Check if a service category exists
    const categoryCursor = await db.query(`
        FOR cat IN serviceCategories
        LIMIT 1
        RETURN cat
      `);

    const categories = await categoryCursor.all();
    if (categories.length === 0) {
      console.log('No service categories found. Please create service categories first.');
      return false;
    }

    const categoryId = categories[0]._id;
    console.log(`Using category: ${categoryId}`);

    // Create sample conversation
    const now = new Date().toISOString();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60000).toISOString();

    const conversation = {
      title: "National ID Application",
      lastMessage: "I need information on how to apply for a national ID card",
      created: fiveMinutesAgo,
      updated: now,
      messageCount: 2,
      isStarred: false,
      isArchived: false,
      category: "Identity & Civil Registration",
      tags: ["National ID Cards", "Birth Registration"]
    };

    const conversationMeta = await conversationsCollection.save(conversation);
    console.log(`Created sample conversation: ${conversationMeta._id}`);

    // Link user to conversation
    const userConversationEdge = {
      _from: userId,
      _to: conversationMeta._id,
      role: 'owner',
      lastViewedAt: now
    };

    await userConversationsCollection.save(userConversationEdge);
    console.log(`Linked user ${userId} to conversation ${conversationMeta._id}`);

    // Link conversation to category
    const conversationCategoryEdge = {
      _from: conversationMeta._id,
      _to: categoryId,
      relevanceScore: 1.0
    };

    await conversationCategoriesCollection.save(conversationCategoryEdge);
    console.log(`Linked conversation ${conversationMeta._id} to category ${categoryId}`);

    // Add sample messages
    const message1 = {
      conversationId: conversationMeta._key,
      content: "I need information on how to apply for a national ID card",
      timestamp: fiveMinutesAgo,
      sender: "user",
      sequence: 1,
      readStatus: true
    };

    await messagesCollection.save(message1);
    console.log('Added user message to conversation');

    const message2 = {
      conversationId: conversationMeta._key,
      content: "To apply for a National ID card, you'll need to visit your nearest Ghișeul Unic with your birth certificate and passport-sized photos. The application process is free for first-time applicants. Would you like more specific information about the requirements or the application process?",
      timestamp: now,
      sender: "assistant",
      sequence: 2,
      readStatus: true
    };

    await messagesCollection.save(message2);
    console.log('Added assistant message to conversation');

    console.log('Sample data inserted successfully');
    return true;
  } catch (error) {
    console.error('Error adding chat history sample data:', error);
    return false;
  }
}

/**
 * Create folder structure and related collections
 */
async function createFolderStructure() {
  const db = initDB();

  try {
    console.log('Creating folder structure...');

    // 1. Create folders collection
    await ensureCollection(db, 'folders', false);
    console.log('Created folders collection');

    // 2. Create folderConversations edge collection
    await ensureCollection(db, 'folderConversations', true);
    console.log('Created folderConversations edge collection');

    //2.5 Creare the userFolders edge collection
    await ensureCollection(db, 'userFolders', true);
    console.log('Created userFolders edge collection');

    // 3. Create indexes for folder collections
    console.log('Creating indexes for folder collections...');

    // Indexes for folders collection
    const foldersCollection = db.collection('folders');
    if (await foldersCollection.exists()) {
      for (const indexDef of collectionIndexes.folders) {
        await ensureIndex(foldersCollection, indexDef.fields, {
          unique: indexDef.unique || false,
          name: indexDef.name
        });
      }
    }

    // Indexes for folderConversations collection
    const folderConversationsCollection = db.collection('folderConversations');
    if (await folderConversationsCollection.exists()) {
      for (const indexDef of collectionIndexes.folderConversations) {
        await ensureIndex(folderConversationsCollection, indexDef.fields, {
          unique: indexDef.unique || false,
          name: indexDef.name
        });
      }
    }

    // Indexes for userFolders collection
    const userFoldersCollection = db.collection('userFolders');
    if (await userFoldersCollection.exists()) {
      for (const indexDef of collectionIndexes.userFolders) {
        await ensureIndex(userFoldersCollection, indexDef.fields, {
          unique: indexDef.unique || false,
          name: indexDef.name
        });
      }
    }

    // 4. Apply schema validation
    await applyCollectionSchema(db, 'folders');
    await applyCollectionSchema(db, 'folderConversations');
    await applyCollectionSchema(db, 'userFolders');

    console.log('Folder structure created successfully');
    return true;
  } catch (error) {
    console.error('Error creating folder structure:', error);
    throw error;
  }
}

/**
 * Add sample folder data for testing
 */
async function addFolderSampleData() {
  const db = initDB();

  try {
    console.log('Adding folder sample data...');

    const foldersCollection = db.collection('folders');
    const folderConversationsCollection = db.collection('folderConversations');

    // Check if we already have folders
    const folderCountCursor = await db.query(`
      RETURN LENGTH(FOR f IN folders RETURN f)
    `);
    const [folderCount] = await folderCountCursor.all();

    if (folderCount > 0) {
      console.log(`Found ${folderCount} existing folders. Skipping sample data creation.`);
      return false;
    }

    // Check if a user exists
    const userCursor = await db.query(`
      FOR u IN users
      LIMIT 1
      RETURN u
    `);

    const users = await userCursor.all();
    if (users.length === 0) {
      console.log('No users found. Please create users first.');
      return false;
    }

    const userId = users[0]._id;
    const userKey = users[0]._key;
    console.log(`Using user: ${userId}`);

    // Check if conversations exist
    const conversationsCursor = await db.query(`
      FOR c IN conversations
      LIMIT 5
      RETURN c
    `);

    const conversations = await conversationsCursor.all();
    if (conversations.length === 0) {
      console.log('No conversations found. Please create conversations first.');
      return false;
    }

    // Create sample folders
    const sampleFolders = [
      { name: "Important", order: 1 },
      { name: "Work", order: 2 },
      { name: "Personal", order: 3 }
    ];

    console.log('Creating sample folders...');

    const createdFolders = [];
    for (const folderData of sampleFolders) {
      const folder = {
        _key: `folder_${userKey}_${folderData.name.toLowerCase().replace(/\s+/g, '_')}`,
        userId: userKey,
        name: folderData.name,
        order: folderData.order
      };

      const folderMeta = await foldersCollection.save(folder);
      createdFolders.push(folderMeta);
      console.log(`Created folder: ${folderMeta._id}`);
    }

    // Add conversations to folders
    console.log('Adding conversations to folders...');

    // Add the first conversation to "Important" folder
    if (conversations.length > 0 && createdFolders.length > 0) {
      const edge = {
        _from: createdFolders[0]._id,  // Important folder
        _to: `conversations/${conversations[0]._key}`
      };

      await folderConversationsCollection.save(edge);
      console.log(`Added conversation ${conversations[0]._key} to folder ${createdFolders[0].name}`);
    }

    // Add some conversations to "Work" folder if available
    if (conversations.length > 1 && createdFolders.length > 1) {
      for (let i = 1; i < Math.min(3, conversations.length); i++) {
        const edge = {
          _from: createdFolders[1]._id,  // Work folder
          _to: `conversations/${conversations[i]._key}`
        };

        await folderConversationsCollection.save(edge);
        console.log(`Added conversation ${conversations[i]._key} to folder ${createdFolders[1].name}`);
      }
    }

    // NEW: Link user to folder with userFolders edge
    const userFolderEdge = {
      _from: userId,
      _to: folderMeta._id,
      role: 'owner',
      lastAccessedAt: new Date().toISOString()
    };

    await userFoldersCollection.save(userFolderEdge);
    console.log(`Linked user ${userId} to folder ${folderMeta._id} as owner`);

    console.log('Folder sample data added successfully');
    return true;
  } catch (error) {
    console.error('Error adding folder sample data:', error);
    return false;
  }
}

/**
 * Create sample query-message relationships
 */
async function createSampleQueryMessagesEdge() {
  const db = initDB();

  try {
    console.log('Creating sample query-message relationship...');

    // Check if queryMessages collection exists
    const queryMessagesCollection = db.collection('queryMessages');
    if (!(await queryMessagesCollection.exists())) {
      console.log('queryMessages collection does not exist. Creating it...');
      await ensureCollection(db, 'queryMessages', true);
    }

    // Check if we have any messages and queries to link
    const checkCursor = await db.query(`
      RETURN {
        messages: LENGTH(FOR m IN messages FILTER m.sender == "assistant" RETURN m),
        queries: LENGTH(FOR q IN queries RETURN q)
      }
    `);

    const [counts] = await checkCursor.all();

    if (counts.messages === 0 || counts.queries === 0) {
      console.log('No assistant messages or queries found to create sample relationships.');
      return false;
    }

    // Get the first query and assistant message
    const queryCursor = await db.query(`
      FOR q IN queries
      SORT q.timestamp DESC
      LIMIT 1
      RETURN q
    `);

    const [query] = await queryCursor.all();

    const messageCursor = await db.query(`
      FOR m IN messages
      FILTER m.sender == "assistant"
      SORT m.timestamp DESC
      LIMIT 1
      RETURN m
    `);

    const [message] = await messageCursor.all();

    if (!query || !message) {
      console.log('Could not find a suitable query and message to link.');
      return false;
    }

    // Check if a relationship already exists
    const existingCursor = await db.query(`
      FOR edge IN queryMessages
      FILTER edge._from == @queryId AND edge._to == @messageId
      RETURN edge
    `, {
      queryId: `queries/${query._key}`,
      messageId: `messages/${message._key}`
    });

    const existingEdges = await existingCursor.all();

    if (existingEdges.length > 0) {
      console.log('A relationship between this query and message already exists.');
      return false;
    }

    // Create the edge
    const edge = {
      _from: `queries/${query._key}`,
      _to: `messages/${message._key}`,
      responseType: "primary",
      confidenceScore: 0.95,
      createdAt: new Date().toISOString()
    };

    await queryMessagesCollection.save(edge);
    console.log(`Created query-message relationship between query ${query._key} and message ${message._key}`);

    return true;
  } catch (error) {
    console.error('Error creating sample query-message relationship:', error);
    return false;
  }
}

/**
 * Disable schema validation for queryMessages collection
 */
async function disableQueryMessagesSchemaValidation() {
  try {
    const db = initDB();
    const queryMessagesCollection = db.collection('queryMessages');

    console.log('Temporarily disabling schema validation for queryMessages collection...');

    // Remove the schema validation
    await queryMessagesCollection.properties({
      schema: null
    });

    console.log('Schema validation disabled successfully for queryMessages collection.');
    return true;
  } catch (error) {
    console.error('Error disabling schema validation for queryMessages:', error);
    return false;
  }
}

/**
 * Clean test collections by truncating them
 */
async function cleanTestCollections() {
  const db = initDB();

  // Collections that should be cleaned before tests
  const collectionsToClean = [
    'users',
    'queries',
    'sessions',
    'events',
    'analytics',
    'userSessions',
    'sessionQueries',
    'queryCategories',
    'conversations',
    'messages',
    'userConversations',
    'conversationCategories',
    'queryMessages',
    'folders',              // Added for folder cleanup
    'folderConversations'   // Added for folder cleanup
  ];

  console.log('Cleaning test collections...');

  for (const collectionName of collectionsToClean) {
    try {
      const collection = db.collection(collectionName);
      if (await collection.exists()) {
        console.log(`Truncating collection: ${collectionName}`);
        await collection.truncate();
      } else {
        console.log(`Collection doesn't exist, skipping: ${collectionName}`);
      }
    } catch (error) {
      console.error(`Error cleaning collection ${collectionName}:`, error);
    }
  }

  console.log('Database cleanup completed');
  return true;
}

/**
 * Main function to initialize and update the entire database schema
 */
async function initializeAndUpdateSchema(options = {}) {
  try {
    console.log('Starting database schema initialization and update...');

    // Create database structure (collections and indexes)
    await createSchemaStructure();

    // Update user schema if needed
    if (options.updateUsers !== false) {
      await updateUserSchema();
    }

    // Add sample data if requested
    if (options.addSampleData === true) {
      await addChatHistorySampleData();
    }

    console.log('Database schema initialization and update completed successfully.');
    return true;
  } catch (error) {
    console.error('Error initializing and updating schema:', error);
    throw error;
  }
}

// ================================================
// COMMAND LINE INTERFACE
// ================================================

// Run the script with command line arguments
async function main() {
  try {
    const args = process.argv.slice(2);
    const command = args[0] || 'init';

    switch (command) {
      case 'init':
        // Initialize and update schema
        await initializeAndUpdateSchema();
        break;

      case 'create-schema':
        // Only create schema structure without updating users
        await createSchemaStructure();
        break;

      case 'update-users':
        // Only update user schema
        await updateUserSchema();
        break;

      case 'apply-schemas':
        // Only apply schema validation rules
        console.log('Applying schema validation rules to all collections...');
        const db = initDB();
        for (const collectionName of Object.keys(schemaDefinitions)) {
          await applyCollectionSchema(db, collectionName);
        }
        console.log('Schema validation rules applied successfully.');
        break;

      case 'add-samples':
        // Add sample data
        await addChatHistorySampleData();
        break;

      case 'link-query-messages':
        // Create sample query-message relationships
        await createSampleQueryMessagesEdge();
        break;

      case 'clean':
        // Clean test collections
        await cleanTestCollections();
        break;

      case 'reset':
        // Clean and initialize
        await cleanTestCollections();
        await initializeAndUpdateSchema({ addSampleData: true });
        break;

      case 'disable-querymessages-schema':
        await disableQueryMessagesSchemaValidation();
        break;

      case 'create-folder-structure':
        // Create folder structure
        await createFolderStructure();
        break;

      case 'add-folder-samples':
        // Add sample folder data
        await addFolderSampleData();
        break;

      default:
        console.log(`Unknown command: ${command}`);
        console.log('Available commands:');
        console.log('  init                    - Initialize and update schema');
        console.log('  create-schema           - Only create schema structure');
        console.log('  update-users            - Only update user schema');
        console.log('  apply-schemas           - Only apply schema validation rules');
        console.log('  add-samples             - Add sample chat history data');
        console.log('  link-query-messages     - Create sample query-message relationships');
        console.log('  clean                   - Clean test collections');
        console.log('  reset                   - Clean and initialize with sample data');
        console.log('  create-folder-structure - Create folder collections and indexes');
        console.log('  add-folder-samples      - Add sample folder data');
        console.log('  disable-querymessages-schema - Disable schema validation for queryMessages');
    }

    console.log('Operation completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script if executed directly
if (require.main === module) {
  main();
}

// Export functions for use in other scripts
module.exports = {
  initializeAndUpdateSchema,
  createSchemaStructure,
  updateUserSchema,
  addChatHistorySampleData,
  cleanTestCollections,
  applyCollectionSchema,
  createFolderStructure,
  addFolderSampleData,
  config,
  allCollections,
  chatHistoryCollections,
  folderCollections,
  schemaDefinitions
};