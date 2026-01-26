# GENIE.AI - Project Coding Standards Specification

## 1\. Introduction

This document defines the coding standards and best practices for the GENIE.AI project. Adhering to these standards is mandatory for all contributors to ensure the codebase remains readable, consistent, and maintainable. The goal is to produce reliable, scalable code that is easy to debug and extend.

This specification covers the full technology stack, including general principles, JavaScript, Vue 3, Node.js (Express), Python, Bash scripting, data formats, internationalization, OPEA patterns, documentation, and Docker configurations.

## 2\. Table of Contents

  - [3. General Principles](https://www.google.com/search?q=%233-general-principles)
  - [4. JavaScript (General Standards)](https://www.google.com/search?q=%234-javascript-general-standards)
  - [5. Frontend: Vue 3 Standards](https://www.google.com/search?q=%235-frontend-vue-3-standards)
  - [6. Backend: Node.js & Express Standards](https://www.google.com/search?q=%236-backend-nodejs--express-standards)
  - [7. Backend: Python Standards](https://www.google.com/search?q=%237-backend-python-standards)
  - [8. Scripting: Bash Standards](https://www.google.com/search?q=%238-scripting-bash-standards)
  - [9. Data & Schema (JSON / ArangoDB)](https://www.google.com/search?q=%239-data--schema-json--arangodb)
  - [10. Internationalization (i18n) System](https://www.google.com/search?q=%2310-internationalization-i18n-system)
  - [11. OPEA Integration & RAG Pattern Standards](https://www.google.com/search?q=%2311-opea-integration--rag-pattern-standards)
  - [12. Documentation Standards](https://www.google.com/search?q=%2312-documentation-standards)
  - [13. DevOps: Docker & Docker Compose Standards](https://www.google.com/search?q=%2313-devops-docker--docker-compose-standards)

## 3\. General Principles

  - **Clarity and Simplicity**: Code must be written to be as easy to understand as possible. Prefer clear, straightforward logic over clever, complex one-liners.

  - **Separation of Concerns**: Each script, module, and component should have a single, well-defined responsibility. This is evident in the project's structure, which uses separate scripts for schema creation, data population, and database maintenance.

  - **Configuration over Hardcoding**: Application settings (e.g., database credentials, file paths, API keys) must be managed via environment variables (loaded from a `.env` file) with sensible defaults provided in the code.

  - **Robustness and Safety**: Scripts that perform write operations must be designed to be safe. This includes checking for prerequisites, handling errors gracefully, and asking for user confirmation before proceeding with destructive actions.

## 4\. JavaScript (General Standards)

These standards apply to all JavaScript code, both frontend (Vue) and backend (Node.js).

  - **Linter & Formatter**: ESLint and Prettier must be used to enforce style consistency. A shared configuration should be committed to the repository.

  - **Language Version**: Code should be written in ECMAScript 6 (ES6) or later.

  - **Variables**:

      - Use `const` by default for all variable declarations.
      - Use `let` only for variables that must be reassigned, such as loop counters. Avoid `var`.

  - **Modules**:

      - **Node.js Scripts**: Use the CommonJS module system (`require`, `module.exports`) for consistency with existing scripts.
      - **Vue 3 / Express App**: Use ES Modules (`import`/`export`) for application code.

  - **Style**:

      - **Indentation**: 2 spaces.
      - **Semicolons**: Mandatory.
      - **Quotes**: Single quotes (`'`).
      - **Naming**: `camelCase` for variables and functions; `PascalCase` for classes.

## 5\. Frontend: Vue 3 Standards

  - **Composition API with `<script setup>`**: All new components must use the Composition API with the `<script setup>` syntax for better logic organization, reusability, and TypeScript support.

  - **Component Structure**: Single File Components (`.vue`) must be organized with the following order: `<script setup>`, `<template>`, `<style scoped>`.

  - **Component Naming**: Component files must be named in `PascalCase` (e.g., `ServiceCategoryTree.vue`). When used in templates, they should be self-closing and also in `PascalCase` (e.g., `<ServiceCategoryTree />`).

  - **Props**:

      - Props must be declared using `defineProps` with detailed definitions (type, required, default, validator).
      - Prop names must be `camelCase`.

  - **Events**:

      - Custom event names must be `kebab-case` (e.g., `item-selected`).
      - Events must be declared using `defineEmits`.

  - **State Management**: For cross-component state management, **Pinia** is the official state management library. It is mandatory for managing global state like user authentication, conversation history, etc.

  - **Styling**: All component styles must be `scoped` using the `<style scoped>` tag to prevent CSS conflicts. For global styles, use a dedicated `main.css` file imported in `main.js`.

  - **Routing**: Use **Vue Router** for all client-side routing. Route definitions should be modular and lazy-loaded to improve initial page load performance.

## 6\. Backend: Node.js & Express Standards

  - **Project Structure**: Express applications must follow a structured layout:

    ```
    /src
    ├── api / (or /routes)
    ├── config /
    ├── controllers /
    ├── middleware /
    ├── services /
    ├── models / (if applicable)
    └── server.js
    ```

  - **RESTful API Design**:

      - **Endpoints**: Use plural nouns for resources (e.g., `/users`, `/conversations`).
      - **HTTP Verbs**: Use standard HTTP verbs correctly (GET, POST, PUT, PATCH, DELETE).
      - **Status Codes**: Return appropriate HTTP status codes (e.g., `200` OK, `201` Created, `400` Bad Request, `404` Not Found, `500` Internal Server Error).
      - **JSON Responses**: API responses must be in JSON and follow a consistent structure: `{ "success": true, "data": [...] }` or `{ "success": false, "error": { "message": "..." } }`.

  - **Routing**: Use `express.Router()` to define routes in separate files within the `/api` directory.

  - **Controllers and Services**:

      - **Controllers**: Should only handle HTTP request/response logic (parsing input, validating data, calling services, sending response).
      - **Services**: Should contain the core business logic, including interactions with the database layer. Controllers must not directly access the database.

  - **Asynchronous Operations**: All asynchronous route handlers and middleware must handle Promises correctly, either by using a global async error handling middleware or wrapping logic in `try...catch` blocks.

  - **Middleware**: Use middleware for cross-cutting concerns like authentication, request logging, and validation.

## 7\. Backend: Python Standards

  - **Style Guide**: All Python code must strictly adhere to the **PEP 8** style guide.

  - **Tooling**:

      - **Formatter**: `black` must be used to auto-format all Python code.
      - **Linter**: `flake8` or a similar linter must be used to check for style and logical errors.

  - **Dependency Management**: Use `pip` with a `requirements.txt` file. The file should be generated with pinned versions (`pip freeze > requirements.txt`).

  - **Virtual Environments**: All Python development must occur within a dedicated virtual environment (e.g., using `venv`).

  - **Typing**: Use Python's standard type hints for all function signatures and variable declarations in new code.

  - **Docstrings**: All modules, classes, and functions must have Google-style docstrings.

## 8\. Scripting: Bash Standards

  - **Shebang**: All scripts must begin with `#!/bin/bash`.

  - **Safety**: Scripts should start with `set -euo pipefail` to ensure they exit immediately on errors or unbound variables.

  - **Error Handling**: Check for required arguments and file/directory existence, exiting with a non-zero status code and a clear error message on failure.

  - **User Feedback**: Use `echo` to inform the user of the script's progress. Use visual separators for readability.

  - **Variables**: Use `snake_case` for variable names. Quote variables (`"$my_var"`) to prevent word splitting and globbing issues.

## 9\. Data & Schema (JSON / ArangoDB)

  - **Formatting**: All JSON files must be well-formed and pretty-printed with an indent of 2 spaces.

  - **Naming Convention**: Object keys in JSON documents must use `camelCase`.

  - **Data Exports**: Data exports must include a `metadata` object detailing the export version, source, and timestamp, and a `data` object containing the exported collections.

  - **Schema Validation**: ArangoDB collections should have schema validation rules defined where data structure is critical (e.g., `serviceCategories`, `users`). Schemas must be defined using the JSON Schema standard.

  - **Keys**: For user-generated content like `serviceCategories`, the `_key` should be a URL-friendly "slug" derived from its name (e.g., "Public Safety" -\> `public-safety`). System-generated documents or child entities (like `services`) can use numeric keys.

## 10\. Internationalization (i18n) System

  - **Source of Truth**: The English name (`nameEN`) in core collections like `serviceCategories` and `services` is the source of truth and the primary key for RAG system compatibility.

  - **Database Architecture**:

      - Translations must be stored in dedicated translation collections (`serviceCategoryTranslations`, `serviceTranslations`).
      - An edge must link the source document to its translation documents.
      - Translation document keys must follow the pattern `${sourceKey}_${languageCode}` (e.g., `1_FR`) for easy identification.

  - **Frontend Implementation**:

      - Use the **`vue-i18n`** library for managing translations in the Vue 3 application.
      - Use structured, descriptive keys in translation files (e.g., `page.home.title`). Do not embed raw strings in components.

## 11\. OPEA Integration & RAG Pattern Standards

  - **Contextual Labeling**: All user interactions that provide context (e.g., selecting a service category in the UI) must pass both the stable English label (`nameEN`) and the user's current language-specific label to the backend. The `nameEN` serves as a reliable identifier for the RAG system, while the translated label provides natural language context for the LLM.

  - **Standardized Data Flow**: The RAG pattern must follow this standard flow:

    1.  **Vue 3 Frontend**: Captures user query and contextual labels.
    2.  **Node.js/Express Backend**: Acts as a Backend-for-Frontend (BFF), receiving the request and securely calling the RAG service.
    3.  **Python RAG Service**: Receives the query and context. Uses the context to perform a vector search or filtered query against ArangoDB to retrieve relevant documents.
    4.  **Prompt Augmentation**: The retrieved documents are used to augment the prompt sent to the LLM.
    5.  **Response Generation**: The LLM generates a response, which is streamed back through the stack to the user.

## 12\. Documentation Standards

### 12.1. In-Code Documentation

  - **File Header Docblocks**: Every executable script (`.js`, `.sh`) must begin with a comprehensive block comment explaining its purpose, usage, prerequisites, and environment variables.

  - **Functions & Classes**: All public functions and classes must have JSDoc (for JS) or Google-style (for Python) docstrings explaining what they do, their parameters, and what they return.

### 12.2. README Files

  - **Structure**: `README.md` files must be well-structured with a clear hierarchy of headings, lists, tables, and code blocks.

  - **Content**: The root `README.md` for a component (e.g., the scripts directory) must provide:

      - A high-level overview of the component's role.
      - A summary table of all scripts/modules and their functions.
      - Detailed, step-by-step "Workflows" for common user goals.
      - Clear instructions for prerequisites and initial setup.
      - Use of warnings (`⚠️`) and notes (`📝`) to call out critical information.

## 13\. DevOps: Docker & Docker Compose Standards

  - **Image Versioning**: Always pin specific image versions (e.g., `arangodb/arangodb:3.12.4`) in `compose.yaml` files. Do not use the `latest` tag.

  - **Configuration**:

      - **Secrets**: Use environment variables (`${ARANGO_PASSWORD}`) for secrets like passwords.
      - **Data Persistence**: Use Docker volumes to persist database data. Map volumes to clear, absolute paths on the host (e.g., `/root/arango_data`).
      - **Networking**: Use explicitly named bridge networks for inter-service communication.

  - **Resilience**: Set a `restart: unless-stopped` policy on all long-running services.

  - **File Naming**: Use the standard `compose.yaml` for Docker Compose configurations and `Dockerfile` for container definitions.