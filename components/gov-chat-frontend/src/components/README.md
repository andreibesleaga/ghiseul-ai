# GENIE.AI - Vue.js Component Library

This repository contains a comprehensive set of Vue.js components designed for the GENIE.AI RAG framework. The framework provides users with easy access to build a RAG based chatbot with extensive capabilities including, logging, security, analytics dashboards, and user profile management.

## Table of Contents

- [Overview](#overview)
- [Core Components](#core-components)
- [Component Interactions](#component-interactions)
- [Features](#features)
- [Technical Details](#technical-details)

## Overview

The GENIE.AI framework is a suite of pre-assembled Vue.js application components designed to provide users with easy access to build a RAG based chatbot with extensive capabilities including, logging, security, analytics dashboards, and user profile management through a chat-based interface. The application includes:

- A chat interface for interacting with government services.
- A collapsible sidebar with a service tree for navigation and a tab for saved chat history.
- Multiple analytics dashboards for tracking system and usage metrics.
- Robust user profile and application settings management.
- A complete authentication flow including registration, email verification, and password reset.
- Extensive multilingual support.

## Core Components

The application is broken down into the following functional categories:

### Main Layout & Structure

-   **`SplashScreen.vue`**: The initial loading screen displayed when the application starts.
-   **`NavBarComponent.vue`**: Main navigation bar at the top, featuring a sidebar toggle, system status indicator, language selection, and access to Analytics, Admin, Settings, and Profile panels.
-   **`SideBarComponent.vue`**: The primary left sidebar which acts as a container for the service tree and chat history tabs.
-   **`RightSideBarComponent.vue`**: A right-hand sidebar that displays contextual information, such as related documents and FAQs based on the chat content.
-   **`ChatBotComponent.vue`**: The central component of the application, providing the main user interface for chat interactions.

### Authentication & User Screens

-   **`LoginScreen.vue`**: Handles user login with username/password, social login options, and links to registration/password reset.
-   **`RegisterScreen.vue`**: The user registration form for creating a new account.
-   **`RegistrationSuccessScreen.vue`**: A confirmation page shown after a user successfully registers, prompting them to check their email.
-   **`EmailVerificationScreen.vue`**: The screen that handles the verification of a user's email address via a token sent to them.
-   **`PasswordResetInitiateScreen.vue`**: The first step in the password reset process where the user enters their email address.
-   **`PasswordResetConfirmScreen.vue`**: The second step where the user enters a new password after validating a reset token.

### Chat Interface

-   **`ChatBotComponent.vue`**: The main chat window, managing message display, user input, context from the service tree, loading states, and quick help prompts.
-   **`ChatResponseFeedbackDialog.vue`**: A dialog for users to provide detailed feedback and ratings on the chatbot's responses.
-   **`ChatFolders.vue`**: An advanced component for managing saved conversations. It includes features for creating folders, searching, starring, and archiving chats.
-   **`ChatHistoryComponent.vue`**: A simpler, likely legacy, component for displaying a list of past chats.

### Sidebar & Navigation

-   **`ServiceTreeContainer.vue`**: A wrapper component responsible for loading and managing the data for the service tree.
-   **`ServiceTreePanelComponent.vue`**: Renders the hierarchical tree of government services, allowing users to expand, collapse, search, and select nodes to use as context in their chat queries.
-   **`ServiceCategoryPanelComponent.vue`**: A simpler component that displays a list of top-level service categories with icons.
-   **`WeatherPanel.vue`**: A widget displayed at the bottom of the sidebar that shows current weather and a forecast based on user location.

### User Profile & Settings

-   **`UserProfileContainer.vue`**: A container that fetches and manages the data for the user profile, handling loading and error states.
-   **`UserProfileComponent.vue`**: A comprehensive, multi-tab modal for users to view and edit their extensive personal data, including identity, address, health, and employment information.
-   **`PersonalIdentificationTab.vue`**: A specific tab from the `UserProfileComponent`, handling personal details like name, date of birth, and document uploads.
-   **`OldUserProfileComponent.vue`**: An older, deprecated version of the user profile modal.
-   **`SettingsComponent.vue`**: A dialog for managing application-level settings such as display language, theme (light/dark), font size, and notifications. It also includes account management actions like changing email, resetting data, and deleting the account.

### Analytics & Dashboards

-   **`AdminDashboard.vue`**: A comprehensive administration panel for system monitoring. It includes system health status, resource usage, database management, log viewing, and security scanning tools.
-   **`AnalyticsDashboard.vue`**: A dashboard focused on key performance indicators and user engagement metrics, such as total queries, unique users, response times, and user satisfaction.
-   **`UnifiedAnalytics.vue`**: A detailed, modal-based analytics dashboard that combines usage trends, top queries, service usage distribution, and user satisfaction analysis into a single view.
-   **`AnalyticsComponent.vue`**: A simpler, likely older version of the analytics modal.
-   **`UsageTrendChart.vue`**: A reusable chart component that visualizes usage trends (queries, unique users) over different time periods.

### Reusable Utility Components

-   **`ModalDialog.vue`** & **`ModalComponent.vue`**: Two reusable modal/dialog components for displaying information or forms in an overlay.
-   **`ConfirmDialog.vue`**: A specialized dialog for asking the user for confirmation before performing an action.
-   **`ContextMenu.vue`**: Renders a context menu (e.g., right-click menu) for additional actions on items like saved chats.
-   **`FileUploadComponent.vue`**: A basic component for handling file uploads.
-   **`LanguageSelector.vue`**: A dropdown component that allows users to switch the application's language.
-   **`SearchableCountryDropdown.vue`**: An advanced dropdown component with search functionality specifically for selecting a country.
-   **`LogSearchDialog.vue`**: A dialog within the Admin Dashboard for searching, filtering, and exporting system logs.
-   **`OperationResultsModal.vue`**: A modal used in the Admin Dashboard to display the results of administrative operations like database backups or re-indexing.
-   **`UserEditDialog.vue`**: A dialog used within the Admin Dashboard for administrators to view and manage individual user details, status, and roles.

## Component Interactions

The components interact with each other through the following mechanisms:

1.  **Parent-Child Communication**:
    -   Props flow down from parent to child components (e.g., `SideBarComponent` passing `isOpen` status).
    -   Events flow up from child to parent components (e.g., `ChatResponseFeedbackDialog` emitting a `submit` event to `ChatBotComponent`).

2.  **Event Bus**:
    -   Components communicate across the hierarchy using a shared `eventBus` for cross-component communication.
    -   Key events include `treeNodeSelected` (from `ServiceTreePanelComponent` to `ChatBotComponent`), `contextItemRemoved`, `load-conversation` (from `ChatFolders` to `ChatBotComponent`), and `chat-deleted`.

3.  **Vuex Store**:
    -   Components access and manage shared application state via a Vuex store.
    -   This is primarily used for managing chat history, saved folders, and user information, allowing components like `ChatBotComponent` and `ChatFolders` to interact with the same data source.

## Features

### Chat Interface

The chat interface allows users to:
-   Ask questions and receive answers rendered from Markdown to secure HTML.
-   Select context from the service tree for more specific answers.
-   Provide feedback on bot responses, including ratings and comments.
-   View related documents and sources for the bot's answers in a dedicated sidebar.
-   Save conversations to history and organize them into folders.
-   Export chat conversations to PDF for offline use.

### Service Tree & Navigation

-   Hierarchical navigation of service categories and knowledge areas.
-   Search functionality to quickly find specific services.
-   Selection of services to add them as context to the chat query.
-   Expandable and collapsible sections for ease of use.

### Analytics & Administration

-   A comprehensive **Admin Dashboard** with real-time system health monitoring, resource usage (CPU, memory), database management actions, log searching, and security scanning.
-   A user-facing **Analytics Dashboard** showing usage trends, user satisfaction metrics, top queries, and service usage distribution.
-   Detailed charts for user satisfaction, including a gauge and a heatmap, in the **Unified Analytics** view.

### User Profile & Settings

-   A secure, multi-tabbed interface for managing extensive personal data across 8 categories, including identity, address, health, and education.
-   Functionality for users to manage their application experience, including theme (light/dark), language, and font size.
-   Account management features such as changing email, initiating a password reset, resetting all user data, and permanently deleting the account.

### Multilingual Support

-   The application is fully internationalized using Vue i18n.
-   Users can switch languages on-the-fly via a dropdown in the navigation bar.
-   Supports English, French, Romanian, and can be extended to other languages by adding new translation files.

## Technical Details

### Component Structure

-   Each component follows Vue.js best practices with a clear separation of template, script, and style sections.
-   Scoped styles are used to ensure component-specific styling does not leak and affect other parts of the application.
-   Props include validation and default values to ensure robust and predictable component behavior.

### State Management

-   A combination of local component state for UI logic and a centralized Vuex store for shared application state (e.g., chat history, user session) is used.
-   User preferences like theme and language are persisted to localStorage.

### Event Handling

-   A combination of standard props/events and a global `eventBus` allows for both tightly-coupled parent-child communication and loosely-coupled communication between distant components.

### Responsive Design

-   Layouts are designed to be mobile-friendly, with features like a collapsible sidebar and responsive grid systems for dashboards.
-   Specific fixes are implemented to handle the on-screen keyboard on Android devices, ensuring a smooth user experience during text input.