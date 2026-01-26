# GENIE.AI Framework Configuration Guide

This guide provides developers with detailed instructions for configuring the GENIE.AI chatbot framework, used in use cases like Ghișeul Unic AI (a government services chatbot) and NAAT - Noor AI AL Tafsir (a Muslim catbot for Indonesia). The configuration system, driven by JSON files (e.g., `genie-ai-config.json`, `genie-ai-config-huduma.json`, `genie-ai-config-naat.json`), customizes the application’s title, icon, color scheme, chatbot features, and Quick Help button functionalities. This document explains how the configuration system works, how to apply style changes (e.g., navbar gradient, button colors), how to configure Quick Help buttons for specific knowledge areas and prompts, how to create new use cases, and the impact on all screens and components, including how button styles and Quick Help configurations propagate across the application.

## Overview

The GENIE.AI framework powers customizable chatbot applications, with configurations stored in JSON files under `/public/config/`. These files are loaded at runtime by `main.js`, passed to components like `NavBarComponent.vue`, `SideBarComponent.vue`, and various screens, and used to style elements via CSS variables in `theme-variables.css` and component styles. Key configuration aspects include:
- **Application Title and Icon**: Define the navbar and screen titles (e.g., `Ghișeul Unic AI`) and SVG logos.
- **Color Scheme**: Set primary colors for buttons, tabs, and links; navbar gradients; backgrounds; and text styles.
- **Chatbot Features**: Configure welcome messages, bot names, and Quick Help buttons linked to specific knowledge areas and prompts.
- **Custom Settings**: Support use case-specific configurations.

## Configuration Files

Configurations are JSON files in `/public/config/`, validated against a JSON schema. Multiple files can coexist for different use cases in the folder for testing convenience (e.g., `genie-ai-config-huduma.json`, `genie-ai-config-naat.json`), but only the `genie-ai-config.json` will be used by the app.

### Schema
- **`$schema`**: JSON Schema draft-07 (`http://json-schema.org/draft-07/schema#`).
- **Type**: Object with required sections: `app`, `theme`.
- **Properties**:
  - **`app`**:
    - `title` (string): Application title for navbar and screens (default: `GENIE.AI Chatbot`).
    - `icon` (object):
      - `type` (enum: `file`, `inline`): Icon source (default: `file`).
      - `value` (string): SVG file path (e.g., `/public/config/huduma-icon.svg`) or inline SVG.
  - **`theme`**:
    - `primaryColor` (string): Color for buttons, tabs, checkboxes, and links (default: `#4E97D1`).
    - `secondaryColor` (string): Secondary text and highlights (default: `#2C5F8A`).
    - `backgroundColor` (string): Main content background (default: `#f5f7fa`).
    - `textColor` (string): Primary text color (default: `#333333`).
    - `navbar` (object):
      - `gradientStart` (string): Navbar gradient start (default: `#4E97D1`).
      - `gradientEnd` (string): Navbar gradient end (default: `#2C5F8A`).
      - `textColor` (string): Navbar text/icon color (default: `#ffffff`).
  - **`features`**:
    - `chat` (object):
      - `welcomeMessage` (string): Chatbot greeting (default: `Welcome to GENIE.AI!`).
      - `botName` (string): Chatbot name (default: `Genie`).
      - `quickHelp` (object):
        - `buttons` (array): List of Quick Help buttons, each with:
          - `id` (string): Unique identifier.
          - `title` (string): i18n key for button label.
          - `icon` (object): Icon configuration (`type`: `file` or `inline`, `value`: SVG path or content).
          - `category` (string or null): Category ID for knowledge area (null for general).
          - `prompt` (string): i18n key for the prompt sent when clicked.
          - `styles` (object): Custom styles (`backgroundColor`, `hoverColor`, `outlineColor`).
  - **`custom`**: Arbitrary key-value pairs for custom settings.

### Example Configurations

#### Ghișeul Unic AI Example (`genie-ai-config-huduma.json`)
```json
{
  "app": {
    "title": "Ghișeul Unic AI",
    "icon": {
      "type": "file",
      "value": "/public/config/huduma-icon.svg"
    }
  },
  "theme": {
    "primaryColor": "#4E97D1",
    "secondaryColor": "#2C5F8A",
    "backgroundColor": "#f5f7fa",
    "textColor": "#333333",
    "navbar": {
      "gradientStart": "#4E97D1",
      "gradientEnd": "#2C5F8A",
      "textColor": "#ffffff"
    }
  },
  "features": {
    "chat": {
      "welcomeMessage": "Welcome to Ghișeul Unic AI, your public service assistant!",
      "botName": "Ghișeul Unic",
      "quickHelp": {
        "buttons": [
          {
            "id": "just-chat",
            "title": "quickhelp.justChat",
            "icon": {
              "type": "file",
              "value": "/config/quickhelp/just-chat.svg"
            },
            "category": null,
            "prompt": "quickhelp.justChatPrompt",
            "styles": {
              "backgroundColor": "#f5f7fa",
              "hoverColor": "#d0e3f5",
              "outlineColor": "#4E97D1"
            }
          },
          {
            "id": "identity-civil",
            "title": "quickhelp.applyForID",
            "icon": {
              "type": "file",
              "value": "/config/quickhelp/identity-civil.svg"
            },
            "category": "1",
            "prompt": "quickhelp.applyForIDPrompt",
            "styles": {
              "backgroundColor": "#f5f7fa",
              "hoverColor": "#d0e3f5",
              "outlineColor": "#4E97D1"
            }
          }
        ]
      }
    }
  },
  "custom": {}
}
```

#### NAAT - Noor AI AL Tafsir Example (`genie-ai-config-naat.json`)
```json
{
  "app": {
    "title": "NAAT - Noor AI AL Tafsir",
    "icon": {
      "type": "file",
      "value": "/public/config/naat-icon.svg"
    }
  },
  "theme": {
    "primaryColor": "#2A9D8F",
    "secondaryColor": "#264653",
    "backgroundColor": "#EAF4F4",
    "textColor": "#1A3C34",
    "navbar": {
      "gradientStart": "#2A9D8F",
      "gradientEnd": "#1A6D62",
      "textColor": "#F8EDEB"
    }
  },
  "features": {
    "chat": {
      "welcomeMessage": "Welcome to NAAT - Noor AI AL Tafsir, your guide to Quranic interpretation!",
      "botName": "Noor",
      "quickHelp": {
        "buttons": [
          {
            "id": "tafsir-overview",
            "title": "quickhelp.tafsirOverview",
            "icon": {
              "type": "file",
              "value": "/config/quickhelp/tafsir-overview.svg"
            },
            "category": "tafsir",
            "prompt": "quickhelp.tafsirOverviewPrompt",
            "styles": {
              "backgroundColor": "#EAF4F4",
              "hoverColor": "#B2DFDB",
              "outlineColor": "#2A9D8F"
            }
          }
        ]
      }
    }
  },
  "custom": {}
}
```

## Managing Configurations

### Modifying Styles
To change styles like navbar gradients, button colors, or other UI elements:
1. **Edit the Config File**:
   - Open the desired config (e.g., `/public/config/genie-ai-config-huduma.json`).
   - Update `theme` properties:
     - **Navbar Gradient**: Set `theme.navbar.gradientStart` and `theme.navbar.gradientEnd` (e.g., `#4E97D1` to `#FF5733`).
     - **Primary Buttons/Tabs/Checkboxes/Links**: Set `theme.primaryColor` (e.g., `#4E97D1` to `#2A9D8F`).
     - **Background**: Set `theme.backgroundColor` (e.g., `#f5f7fa` to `#EAF4F4`).
     - **Primary Text**: Set `theme.textColor` (e.g., `#333333` to `#1A3C34`).
     - **Secondary Text**: Set `theme.secondaryColor` (e.g., `#2C5F8A` to `#264653`).
     - **Navbar Text/Icons**: Set `theme.navbar.textColor` (e.g., `#ffffff` to `#F8EDEB`).
   - Example: To change buttons and tabs to orange:
     ```json
     "theme": {
       "primaryColor": "#FF5733",
       "navbar": {
         "gradientStart": "#FF5733",
         "gradientEnd": "#C82333"
       }
     }
     ```
2. **Test Changes**:
   - Run `npm run serve`.
   - Verify navbar gradient, button colors, and screen styles in the browser.
   - Check console for `Configuration loaded: Object` in `main.js`.
3. **Deploy**:
   - Run `npm run build` to include updated config.
   - Deploy `/public/config/*` to the server, ensuring accessibility.
   - preferrably just use the docker-compose.yaml (docker compose up --build -d)

### Configuring Quick Help Buttons
Quick Help buttons provide quick access to specific knowledge areas and predefined prompts, enhancing user interaction with the chatbot. These buttons are configured in the `features.chat.quickHelp.buttons` array and are displayed in the chat interface (e.g., `ChatScreen.vue`).

1. **Edit the Config File**:
   - Open the desired config (e.g., `/public/config/genie-ai-config.json`).
   - Add or update entries in `features.chat.quickHelp.buttons`:
     - **id**: Unique identifier for the button (e.g., `just-chat`).
     - **title**: i18n key for the button label (e.g., `quickhelp.justChat`).
     - **icon**: Specify icon `type` (`file` or `inline`) and `value` (SVG path or content).
     - **category**: Category ID for the knowledge area (e.g., `1` for civil services, `null` for general queries).
     - **prompt**: i18n key for the prompt sent to the chatbot when clicked (e.g., `quickhelp.justChatPrompt`).
     - **styles**: Define `backgroundColor`, `hoverColor`, and `outlineColor` for button styling.
   - Example: Adding a button for job search assistance:
     ```json
     "features": {
       "chat": {
         "quickHelp": {
           "buttons": [
             {
               "id": "employment-labor",
               "title": "quickhelp.findJobs",
               "icon": {
                 "type": "file",
                 "value": "/config/quickhelp/employment-labor.svg"
               },
               "category": "4",
               "prompt": "quickhelp.findJobsPrompt",
               "styles": {
                 "backgroundColor": "#D3E0EA",
                 "hoverColor": "#A3BFFA",
                 "outlineColor": "#87CEEB"
               }
             }
           ]
         }
       }
     }
     ```
2. **Add Icon**:
   - Place the SVG icon (e.g., `employment-labor.svg`) in `/public/config/quickhelp/`.
3. **Update i18n**:
   - Add translations for `title` and `prompt` in the i18n resource files (e.g., `en.json`):
     ```json
     "quickhelp": {
       "findJobs": "Find Jobs",
       "findJobsPrompt": "Can you help me find job opportunities?"
     }
     ```
4. **Test Changes**:
   - Run `npm run serve`.
   - Verify the button appears in the chat interface, displays the correct label and icon, and sends the intended prompt when clicked.
   - Check console for `Configuration loaded: Object` in `main.js`.
5. **Deploy**:
   - Run `npm run build` to include updated config and SVG files.
   - Deploy `/public/config/*` to the server, ensuring accessibility.

### Creating a New Use Case
To configure a new chatbot (e.g., "EcoChat"):
1. **Duplicate Config**:
   - Copy `genie-ai-config.json` to `/public/config/ecochat-config.json`.
   - Update:
     ```json
     "app": {
       "title": "EcoChat",
       "icon": { "type": "file", "value": "/public/config/ecochat-icon.svg" }
     },
     "theme": {
       "primaryColor": "#28A745",
       "secondaryColor": "#1E7E34",
       "backgroundColor": "#E6F4EA",
       "textColor": "#1A3C34",
       "navbar": {
         "gradientStart": "#28A745",
         "gradientEnd": "#1E7E34",
         "textColor": "#ffffff"
       }
     },
     "features": {
       "chat": {
         "welcomeMessage": "Welcome to EcoChat, your sustainability assistant!",
         "botName": "Eco",
         "quickHelp": {
           "buttons": [
             {
               "id": "sustainability-tips",
               "title": "quickhelp.sustainabilityTips",
               "icon": {
                 "type": "file",
                 "value": "/config/quickhelp/sustainability-tips.svg"
               },
               "category": "eco",
               "prompt": "quickhelp.sustainabilityTipsPrompt",
               "styles": {
                 "backgroundColor": "#E6F4EA",
                 "hoverColor": "#C3E6CB",
                 "outlineColor": "#28A745"
               }
             }
           ]
         }
       }
     }
     ```
2. **Add Icons**:
   - Place `ecochat-icon.svg` and Quick Help SVGs (e.g., `sustainability-tips.svg`) in `/public/config/` or `/public/config/quickhelp/`.
3. **Update i18n**:
   - Add translations for Quick Help buttons in i18n files (e.g., `en.json`):
     ```json
     "quickhelp": {
       "sustainabilityTips": "Sustainability Tips",
       "sustainabilityTipsPrompt": "Provide tips for sustainable living"
     }
     ```
4. **Update `main.js`**:
   - Set `VUE_APP_CONFIG_FILE=/public/config/ecochat-config.json` in `.env`:
     ```javascript
     const configFile = process.env.VUE_APP_CONFIG_FILE || '/public/config/genie-ai-config.json';
     const response = await fetch(configFile);
     ```
5. **Test and Deploy**:
   - Run `npm run serve` to verify styles, chatbot settings, and Quick Help buttons.
   - Deploy updated config, SVG files, and i18n resources.

## How Configuration Works

### Loading and Distribution
- **Loading** (`main.js`):
  - Fetches the config file using `fetch` and merges with defaults:
    ```javascript
    let config = {
      app: { title: 'GENIE.AI Chatbot', icon: { type: 'file', value: '/public/config/default-icon.svg' } },
      theme: { primaryColor: '#4E97D1', secondaryColor: '#2C5F8A', backgroundColor: '#f5f7fa', textColor: '#333333', navbar: { gradientStart: '#4E97D1', gradientEnd: '#2C5F8A', textColor: '#ffffff' } },
      features: { chat: { welcomeMessage: 'Welcome to GENIE.AI!', botName: 'Genie', quickHelp: { buttons: [] } } },
      custom: {}
    };
    async function loadConfig() {
      try {
        const response = await fetch(process.env.VUE_APP_CONFIG_FILE || '/public/config/genie-ai-config.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        config = { ...config, ...data };
        console.log('Configuration loaded:', config);
      } catch (error) {
        console.error('Error loading config:', error);
      }
    }
    await loadConfig();
    app.config.globalProperties.$config = config;
    ```
- **Distribution** (`App.vue`):
  - Passes `$config` to components via props:
    ```html
    <nav-bar-component :config="$config" />
    <chat-screen :config="$config" />
    ```

### Applying Styles
- **CSS Variables** (`theme-variables.css`):
  - Maps config to variables, including Quick Help button styles:
    ```css
    :root {
      --bg-button-primary: var(--primary-color, #4E97D1);
      --text-secondary: var(--secondary-color, #2C5F8A);
      --bg-primary: var(--background-color, #f5f7fa);
      --text-primary: var(--text-color, #333333);
      --bg-navbar: linear-gradient(135deg, var(--navbar-gradient-start, #4E97D1), var(--navbar-gradient-end, #2C5F8A));
      --text-navbar: var(--navbar-text-color, #ffffff);
    }
    [data-theme="dark"] {
      --bg-primary: #1e1e1e;
      --text-primary: #f0f0f0;
      --text-secondary: #b3b3b3;
    }
    ```
- **Button Style Propagation**:
  - The `theme.primaryColor` is mapped to `--bg-button-primary`, which is applied to:
    - **Buttons**: Across all screens and components using `.primary-button`, `.login-button`, `.btn-primary`, or similar (e.g., "Login" button in `LoginScreen.vue`, "Save" button in `SettingsComponent.vue`).
    - **Tabs**: Active tabs in `SideBarComponent.vue` (`.tab-button-active`).
    - **Checkboxes**: In `LoginScreen.vue` (`.remember-me input`) and `RegisterScreen.vue` (`.terms input`).
    - **Links**: Navigation links like `.forgot-password-text`, `.login-link-text`, `.terms-link` in authentication screens.
    - **Spinners**: Loading indicators in `EmailVerificationScreen.vue` (`.spinner`).
  - Quick Help buttons use their own `styles` properties (`backgroundColor`, `hoverColor`, `outlineColor`) defined in the config, applied via inline styles or component-specific CSS in `ChatScreen.vue`.
  - This ensures a consistent primary color for interactive elements and customizable styles for Quick Help buttons throughout the application, including:
    - **Authentication Screens**: `LoginScreen.vue`, `PasswordResetInitiateScreen.vue`, `RegistrationSuccessScreen.vue`, `EmailVerificationScreen.vue`, `PasswordResetConfirmScreen.vue`, `RegisterScreen.vue`.
    - **Navigation Components**: `SideBarComponent.vue` (tabs), `NavBarComponent.vue` (potential buttons).
    - **Chat Interface**: `ChatScreen.vue` (Quick Help buttons).
    - **SettingsComponent.vue**: Buttons for saving theme/language settings.
    - **UserProfileComponent.vue**: Buttons for profile updates.
    - **Modal Dialogs**: Confirmation, error, or action dialogs using `.primary-button`.
    - **AdminDashboard.vue and Related Components**: Buttons for administrative actions (e.g., user management, analytics).
  - Example: Changing `theme.primaryColor` from `#4E97D1` to `#FF5733` updates all buttons, tabs, checkboxes, links, and spinners to orange, while Quick Help buttons retain their configured styles.
- **Component Styles**:
  - Components apply `--bg-button-primary` via scoped styles or `theme-components.css`:
    ```css
    .primary-button {
      background-color: var(--bg-button-primary);
      color: var(--text-button-primary, #ffffff);
    }
    ```
  - Quick Help buttons in `ChatScreen.vue` apply styles dynamically:
    ```css
    .quick-help-button {
      background-color: v-bind('button.styles.backgroundColor');
      border-color: v-bind('button.styles.outlineColor');
    }
    .quick-help-button:hover {
      background-color: v-bind('button.styles.hoverColor');
    }
    ```

## Screen and Component-Specific Configuration Impacts

Configuration changes, including Quick Help buttons, affect the following screens and components:
1. **LoginScreen.vue**:
   - **Title**: `app.title` in `.app-name` (e.g., `Ghișeul Unic AI`).
   - **Icon**: `app.icon.value` in `.app-logo` (e.g., `/config/huduma-icon.svg`).
   - **Colors**:
     - Login button (`.login-button`): `--bg-button-primary` (`theme.primaryColor`).
     - Remember Me checkbox (`.remember-me input`): `--bg-button-primary`.
     - Forgot Password link (`.forgot-password-text`): `--bg-button-primary`.
     - Background: `--bg-primary` (`theme.backgroundColor`).
     - Text: `--text-primary` (`theme.textColor`), `--text-secondary` (`theme.secondaryColor`).
2. **PasswordResetInitiateScreen.vue**:
   - **Title**: `app.title`.
   - **Icon**: `app.icon.value`.
   - **Colors**:
     - Reset Password button (`.reset-initiate-button`): `--bg-button-primary`.
     - Login link (`.login-link-text`): `--bg-button-primary`.
     - Background: `--bg-primary`.
     - Text: `--text-primary`, `--text-secondary`.
3. **RegistrationSuccessScreen.vue**:
   - **Title**: `app.title`.
   - **Icon**: `app.icon.value`.
   - **Colors**:
     - Back to Login button (`.primary-button`): `--bg-button-primary`.
     - Resend Verification link (`.text-button`): `--bg-button-primary`.
     - Background: `--bg-primary`.
     - Text: `--text-primary`, `--text-secondary`.
4. **EmailVerificationScreen.vue**:
   - **Title**: `app.title`.
   - **Icon**: `app.icon.value`.
   - **Colors**:
     - Proceed/Back to Login button (`.primary-button`): `--bg-button-primary`.
     - Spinner (`.spinner`): `border-top-color: --bg-button-primary`.
     - Background: `--bg-primary`.
     - Text: `--text-primary`, `--text-secondary`.
5. **PasswordResetConfirmScreen.vue**:
   - **Title**: `app.title`.
   - **Icon**: `app.icon.value`.
   - **Colors**:
     - Validate Token/Reset Password buttons (`.validate-token-button`, `.reset-confirm-button`): `--bg-button-primary`.
     - Login link (`.login-link-text`): `--bg-button-primary`.
     - Background: `--bg-primary`.
     - Text: `--text-primary`, `--text-secondary`.
6. **RegisterScreen.vue**:
   - **Title**: `app.title`.
   - **Icon**: `app.icon.value`.
   - **Colors**:
     - Register button (`.register-button`): `--bg-button-primary`.
     - Accept Terms checkbox (`.terms input`): `--bg-button-primary`.
     - Login/Terms links (`.login-link-text`, `.terms-link`): `--bg-button-primary`.
     - Background: `--bg-primary`.
     - Text: `--text-primary`, `--text-secondary`.
7. **ChatScreen.vue**:
   - **Quick Help Buttons**:
     - Rendered from `features.chat.quickHelp.buttons`, displaying label (`title`), icon, and applying `styles`.
     - Clicking a button sends the `prompt` to the chatbot, filtered by `category` for specific knowledge areas.
   - **Colors**:
     - Chat interface background: `--bg-primary` (`theme.backgroundColor`).
     - Text: `--text-primary` (`theme.textColor`), `--text-secondary` (`theme.secondaryColor`).
8. **SideBarComponent.vue**:
   - **Colors**:
     - Active tabs (`.tab-button-active` for "Government Services", "Saved Chats"): `--bg-button-primary`.
     - Background: `--bg-primary`.
     - Text: `--text-primary`.
9. **SettingsComponent.vue**:
   - **Colors**:
     - Save buttons (e.g., for theme/language settings, typically `.primary-button`): `--bg-button-primary`.
     - Background: `--bg-primary`.
     - Text: `--text-primary`, `--text-secondary`.
10. **UserProfileComponent.vue**:
    - **Colors**:
      - Update profile buttons (e.g., `.primary-button`): `--bg-button-primary`.
      - Background: `--bg-primary`.
      - Text: `--text-primary`, `--text-secondary`.
11. **Modal Dialogs**:
    - **Colors**:
      - Action buttons (e.g., "Confirm", "Cancel" in `.primary-button`): `--bg-button-primary`.
      - Background: `--bg-primary`.
      - Text: `--text-primary`, `--text-secondary`.
12. **AdminDashboard.vue and Related Components**:
    - **Colors**:
      - Administrative buttons (e.g., user management, analytics, typically `.primary-button`): `--bg-button-primary`.
      - Background: `--bg-primary`.
      - Text: `--text-primary`, `--text-secondary`.

## Theme Integration

The framework supports light, dark, and system themes via `ThemeManager.js`. Configuration colors are applied consistently:
- **Primary Colors**: `theme.primaryColor` (`--bg-button-primary`) is uniform across modes for buttons, tabs, checkboxes, and links.
- **Navbar Gradient**: `theme.navbar.gradientStart` and `theme.navbar.gradientEnd` adjust for dark mode in `theme-variables.css`.
- **Quick Help Buttons**: Use their own `styles` properties, ensuring consistent appearance across themes.
- **User Preference**: Set in `SettingsComponent.vue`, saved to `localStorage` (`theme` key).
- **System Theme**: Uses `prefers-color-scheme` if no preference is set.

## Troubleshooting

- **Config File Errors**:
  - Ensure `/public/config/*.json` and SVGs are in `dist/public/config/` after `npm run build`.
  - Check server configuration (e.g., Nginx: `location /public { root /path/to/dist; }`).
- **Quick Help Errors**:
  - Verify `features.chat.quickHelp.buttons` entries have valid `id`, `title`, `icon`, `category`, `prompt`, and `styles`.
  - Ensure SVG icons exist in `/public/config/quickhelp/` and i18n keys are defined.
- **Component Errors**:
  - If `Cannot read properties of undefined`, verify `main.js` loads config and components use `this.$config` defensively.
- **Style Issues**:
  - Inspect elements (e.g., `.primary-button`, `.nav-bar`, `.quick-help-button`) to confirm `--bg-button-primary` or Quick Help styles.
  - Ensure `theme-variables.css` isn’t overridden.
- **Theme Conflicts**:
  - Check `localStorage.getItem('theme')` and `ThemeManager.js` (GitLab issue #1).

## Deployment

- **Build**: Include `/public/config/*.json`, SVGs, and i18n files in `npm run build`.
- **Server**: Serve `/public/config/*` as static files.
- **Environment**: Use `VUE_APP_CONFIG_FILE` for different configs.
- **Versioning**: Commit configs to Git, version as needed.

## Extending Configuration

To add new styles or features (e.g., sidebar colors or new Quick Help categories):
1. Update schema:
   ```json
   "theme": {
     "sidebar": {
       "backgroundColor": { "type": "string", "default": "#f0f2f5" }
     }
   },
   "features": {
     "chat": {
       "quickHelp": {
         "categories": {
           "type": "array",
           "items": {
             "type": "object",
             "properties": {
               "id": { "type": "string" },
               "name": { "type": "string" }
             }
           }
         }
       }
     }
   }
   ```
2. Update components:
   ```javascript
   computed: { 
     sidebarBg() { return this.$config.theme.sidebar.backgroundColor; },
     quickHelpCategories() { return this.$config.features.chat.quickHelp.categories; }
   }
   ```
3. Update `theme-variables.css` or component styles:
   ```css
   --sidebar-bg: var(--sidebar-background-color, #f0f2f5);
   ```
4. Deploy updated config, code, and i18n resources.

## Summary

The GENIE.AI framework’s configuration system enables seamless customization of chatbot applications, with `theme.primaryColor` ensuring consistent button styles across all screens, modals, and components like `SettingsComponent.vue` and `AdminDashboard.vue`. The `features.chat.quickHelp` configuration allows developers to define Quick Help buttons that link to specific knowledge areas and prompts, enhancing user interaction in `ChatScreen.vue`. Developers can tailor UI, features, and Quick Help functionalities for new use cases by modifying JSON configs. For support, refer to GitLab issues or contact the development team.