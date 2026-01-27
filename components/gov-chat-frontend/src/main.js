/*****************************************************************************************************
 * main.js
 * 
 * Full file, including:
 * - Importing your App.vue, router, i18n.js, and store
 * - Setting up locale based on user preference or browser
 * - Logging all messages for each locale (only in development mode)
 * - Logging the active locale before and after mount
 * - Theme system integration - Synchronized with ThemeManager.js
 * - Loading genie-ai-config.json from /config folder for GENIE.AI framework customization
 *****************************************************************************************************/

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import store from './store' // Import the Vuex store
import FileDialogSafe from './fileDialogSafe' // Import our custom directive
import '@fortawesome/fontawesome-free/css/all.min.css';
import VueApexCharts from 'vue3-apexcharts'
import './text-fix.css'
import { themeManager } from './utils/ThemeManager'; // Updated import path

// Import theme CSS files
import './theme-variables.css'
import './theme-components.css'

// Fetch configuration for GENIE.AI framework with fallback defaults
let config = {
  app: {
    title: 'Ghiseul AI Romania',
    icon: { type: 'file', value: '/config/genie-ai-icon-light.svg' }
  },
  theme: {
    primaryColor: '#002B7F',
    secondaryColor: '#FCD116',
    backgroundColor: '#f5f7fa',
    textColor: '#333333',
    navbar: {
      gradientStart: '#002B7F',
      gradientEnd: '#CE1126',
      textColor: '#ffffff'
    }
  },
  features: {
    chat: {
      welcomeMessage: 'Bun venit! Cum vă pot ajuta cu serviciile guvernamentale ale României astăzi?',
      botName: 'Genie'
    }
  },
  custom: {}
};
export async function loadConfig() {
  try {
    const response = await fetch('/config/genie-ai-config.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    config = { ...config, ...data }; // Merge fetched config with defaults
    console.log('Configuration loaded:', config);
    console.log('Quick Help config:', config.features?.chat?.quickHelp);

    // Dynamically set CSS variables based on config (FIX: Added for success case)
    const root = document.documentElement;
    if (config.theme) {
      if (config.theme.navbar) {
        root.style.setProperty('--navbar-gradient-start', config.theme.navbar.gradientStart);
        root.style.setProperty('--navbar-gradient-end', config.theme.navbar.gradientEnd);
        root.style.setProperty('--navbar-text-color', config.theme.navbar.textColor);
      }
      root.style.setProperty('--accent-color', config.theme.primaryColor);
      root.style.setProperty('--accent-hover', adjustColor(config.theme.primaryColor, -20));
      root.style.setProperty('--accent-color-secondary', config.theme.secondaryColor);
    }
  } catch (error) {
    console.error('Error loading config:', error);
    console.warn('Using default configuration');

    // Set default CSS variables
    const root = document.documentElement;
    if (config.theme) {
      if (config.theme.navbar) {
        root.style.setProperty('--navbar-gradient-start', config.theme.navbar.gradientStart);
        root.style.setProperty('--navbar-gradient-end', config.theme.navbar.gradientEnd);
        root.style.setProperty('--navbar-text-color', config.theme.navbar.textColor);
      }
      root.style.setProperty('--accent-color', config.theme.primaryColor);
      root.style.setProperty('--accent-hover', adjustColor(config.theme.primaryColor, -20));
      root.style.setProperty('--accent-color-secondary', config.theme.secondaryColor);
    }
  }
  return config;
}

// Helper function to adjust color brightness (for hover states)
function adjustColor(hexColor, percent) {
  let r = parseInt(hexColor.slice(1, 3), 16);
  let g = parseInt(hexColor.slice(3, 5), 16);
  let b = parseInt(hexColor.slice(5, 7), 16);

  // Adjust brightness
  r = Math.min(255, Math.max(0, Math.round(r * (1 + percent / 100))));
  g = Math.min(255, Math.max(0, Math.round(g * (1 + percent / 100))));
  b = Math.min(255, Math.max(0, Math.round(b * (1 + percent / 100))));

  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Initialize configuration before app creation to ensure it's available globally
await loadConfig();

// Determine the initial locale - prioritize:
// 1. Previously saved user preference
// 2. Browser language
// 3. Default to 'en'
const getSavedLocale = () => {
  try {
    return localStorage.getItem('userLocale')
  } catch (e) {
    console.warn('Unable to access localStorage:', e)
    return null
  }
}

const savedLanguage = localStorage.getItem('userLocale');
if (savedLanguage && i18n) {
  i18n.locale = savedLanguage;
  document.documentElement.setAttribute('lang', savedLanguage);
}

// Global language change handler
window.addEventListener('languageChanged', (event) => {
  if (event.detail && event.detail.language) {
    // Force reload the page when language changes from settings
    // This ensures all components get the new translations
    window.location.reload();
  }
});

const getBrowserLocale = () => {
  // Get browser language (e.g. 'en-US' -> 'en')
  const browserLang = navigator.language || navigator.userLanguage
  const shortLang = browserLang.split('-')[0]

  // Check if we support this language
  const supportedLocales = ['en', 'fr', 'ro', 'de', 'es', 'pt', 'ru', 'zh', 'ar', 'th', 'id']
  return supportedLocales.includes(shortLang) ? shortLang : null
}

// Set the initial locale based on our prioritization logic
const savedLocale = getSavedLocale()
const browserLocale = getBrowserLocale()
const initialLocale = savedLocale || browserLocale || 'en'

// Set the locale directly as a string (not as a ref)
i18n.global.locale = initialLocale

// Log information only in development mode
if (process.env.NODE_ENV === 'development') {
  console.log("Available messages:", {
    'en': i18n.global.getLocaleMessage('en'),
    'fr': i18n.global.getLocaleMessage('fr'),
    'ro': i18n.global.getLocaleMessage('ro')
  })
  console.log("Active locale:", i18n.global.locale)
}

// Initialize theme system BEFORE creating the app
const initializeTheme = () => {
  let theme = 'light'; // Default theme

  try {
    // Synchronize with ThemeManager.js for initial theme detection
    const themeInfo = themeManager.getThemeInfo();
    theme = themeInfo.theme || 'light'; // Use ThemeManager's detected theme

    // Override with saved user preference if it exists
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      theme = savedTheme;
    }

    // Apply theme to both HTML and BODY elements to ensure it cascades properly
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);

    console.log('Theme initialized to:', theme);

    // Initialize font size if saved
    const fontSize = localStorage.getItem('fontSize');
    if (fontSize) {
      document.documentElement.style.fontSize = `${parseInt(fontSize) / 50}rem`;
    }
  } catch (e) {
    console.warn('Error initializing theme, defaulting to light theme:', e);
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.setAttribute('data-theme', 'light');
  }
};

// Run theme initialization immediately
initializeTheme();

// Create the Vue app
const app = createApp(App)

// Make config available globally for GENIE.AI framework customization (e.g., title, icon, navbar colors)
app.config.globalProperties.$config = config;

// Use router, i18n, and store
app.use(router)
app.use(i18n)
app.use(store) // Register the Vuex store
app.use(FileDialogSafe) // Register our custom directive
app.use(VueApexCharts)

// Create a global method for changing locale
app.config.globalProperties.$setLocale = function (locale) {
  i18n.global.locale = locale
  try {
    localStorage.setItem('userLocale', locale)
  } catch (e) {
    console.warn('Unable to save locale preference:', e)
  }

  // Update HTML lang attribute for accessibility
  document.documentElement.setAttribute('lang', locale)
}

// Mount the app
app.mount('#app')

// *** ADD THIS DEBUG BLOCK ***
console.log('DEBUG: Runtime VUE_APP_CSP_CONNECT_SRC:', process.env.VUE_APP_CSP_CONNECT_SRC);
// Log effective CSP if set via meta (dev server uses header, so this may be null; check Network tab manually)
const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
console.log('DEBUG: CSP from meta tag (if any):', cspMeta ? cspMeta.content : 'None - Check Network headers');

// Log active locale after mount (development only)
if (process.env.NODE_ENV === 'development') {
  console.log("Active locale (after mount):", i18n.global.locale)
}

// Function to set the actual viewport height as a CSS variable
function setViewportHeight() {
  // Get the actual viewport height
  const vh = window.innerHeight * 0.01;
  // Set the value as a CSS variable
  document.documentElement.style.setProperty('--window-height', `${window.innerHeight}px`);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Set initial height
  setViewportHeight();

  // Update on resize
  window.addEventListener('resize', setViewportHeight);

  // For iOS devices, use VisualViewport API if available
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      // Update the CSS variable with the visual viewport height
      document.documentElement.style.setProperty('--window-height', `${window.visualViewport.height}px`);

      // Check if keyboard is likely open (viewport significantly smaller)
      const heightDifference = window.innerHeight - window.visualViewport.height;
      const isKeyboardOpen = heightDifference > 150;

      // Add/remove class
      if (document.body) {
        if (isKeyboardOpen) {
          document.body.classList.add('keyboard-open');
        } else {
          document.body.classList.remove('keyboard-open');
        }
      }
    });
  }
});

// Helper function to detect iOS devices
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Add iOS-specific class if needed
if (isIOS() && document.documentElement) {
  document.documentElement.classList.add('ios-device');
}

// Function to handle Android keyboard behavior
const handleAndroidKeyboard = () => {
  // Detect Android devices
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (!isAndroid) return;

  // Add Android flag to document
  if (document.documentElement) {
    document.documentElement.classList.add('android-device');
  }

  // Store initial window height
  const initialWindowHeight = window.innerHeight;

  // Listen for resize events to detect keyboard
  window.addEventListener('resize', () => {
    const currentHeight = window.innerHeight;
    const heightDifference = initialWindowHeight - currentHeight;

    // If height difference is significant, keyboard is likely open
    if (heightDifference > 150 && document.documentElement) {
      document.documentElement.classList.add('keyboard-open');

      // Set CSS variable for keyboard height
      document.documentElement.style.setProperty('--keyboard-height', `${heightDifference}px`);
      document.documentElement.style.setProperty('--visible-height', `${currentHeight}px`);
    } else if (document.documentElement) {
      document.documentElement.classList.remove('keyboard-open');
      document.documentElement.style.removeProperty('--keyboard-height');
      document.documentElement.style.removeProperty('--visible-height');
    }
  });

  document.addEventListener('focusin', (event) => {
    // Only handle input and textarea elements
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      if (document.documentElement) {
        document.documentElement.classList.add('input-focused');
      }
    }
  });

  document.addEventListener('focusout', (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      // Use timeout to ensure keyboard is fully closed
      setTimeout(() => {
        if (document.documentElement) {
          document.documentElement.classList.remove('input-focused');
        }
      }, 300);
    }
  });
};

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  handleAndroidKeyboard();
});