/**
 * dialogThemeUtils.js (FIXED)
 * Provides utility functions for theming dialogs across the application
 */

import { themeManager } from './ThemeManager';

/**
 * Generate CSS variables for dialog theming
 * @returns {Object} CSS variables object
 */
export function generateDialogThemeVariables() {
    // Add safeguards to ensure theme detection works correctly
    let dialogTheme;
    
    try {
        // Attempt to get the dialog theme
        dialogTheme = themeManager.getDialogTheme();
    } catch (error) {
        console.warn('Error getting dialog theme:', error);
        // Fallback to a basic theme structure
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark' || 
                          document.body.getAttribute('data-theme') === 'dark' ||
                          document.documentElement.classList.contains('dark-mode') ||
                          document.body.classList.contains('dark-mode');
        
        dialogTheme = {
            modal: {
                background: isDarkMode ? '#2a2a2a' : '#ffffff',
                textColor: isDarkMode ? '#f0f0f0' : '#333333',
                titleColor: isDarkMode ? '#ffffff' : '#333333',
                borderColor: isDarkMode ? '#3a3a3a' : '#dcdfe4',
                boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.15)'
            },
            overlay: {
                background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)'
            },
            buttons: {
                primary: {
                    background: '#4E97D1',
                    textColor: '#ffffff',
                    hoverBackground: '#3a7da0'
                },
                secondary: {
                    background: isDarkMode ? '#3a3a3a' : '#cccccc',
                    textColor: isDarkMode ? '#e0e0e0' : '#333333',
                    hoverBackground: isDarkMode ? '#4a4a4a' : '#bbbbbb'
                }
            },
            input: {
                background: isDarkMode ? '#333333' : '#ffffff',
                textColor: isDarkMode ? '#f0f0f0' : '#333333',
                borderColor: isDarkMode ? '#3a3a3a' : '#ddd',
                placeholderColor: isDarkMode ? '#8c8c8c' : '#767676'
            },
            tabs: {
                background: isDarkMode ? '#252525' : '#f0f2f5',
                activeBackground: isDarkMode ? '#2a2a2a' : '#ffffff',
                textColor: isDarkMode ? '#f0f0f0' : '#333333',
                activeTextColor: isDarkMode ? '#ffffff' : '#000000',
                borderColor: isDarkMode ? '#3a3a3a' : '#cccccc'
            }
        };
    }
    
    return {
        // Modal styles
        '--dialog-background': dialogTheme.modal.background,
        '--dialog-title-color': dialogTheme.modal.titleColor,
        '--dialog-text-color': dialogTheme.modal.textColor,
        '--dialog-border-color': dialogTheme.modal.borderColor,
        '--dialog-box-shadow': dialogTheme.modal.boxShadow,
        
        // Overlay styles
        '--dialog-overlay-background': dialogTheme.overlay.background,
        
        // Button styles
        '--dialog-primary-button-bg': dialogTheme.buttons.primary.background,
        '--dialog-primary-button-text': dialogTheme.buttons.primary.textColor,
        '--dialog-primary-button-hover-bg': dialogTheme.buttons.primary.hoverBackground,
        
        '--dialog-secondary-button-bg': dialogTheme.buttons.secondary.background,
        '--dialog-secondary-button-text': dialogTheme.buttons.secondary.textColor,
        '--dialog-secondary-button-hover-bg': dialogTheme.buttons.secondary.hoverBackground,
        
        // Input styles
        '--dialog-input-background': dialogTheme.input.background,
        '--dialog-input-text-color': dialogTheme.input.textColor,
        '--dialog-input-border-color': dialogTheme.input.borderColor,
        '--dialog-input-placeholder-color': dialogTheme.input.placeholderColor,
        
        // Tabs styles
        '--dialog-tabs-background': dialogTheme.tabs.background,
        '--dialog-tabs-active-background': dialogTheme.tabs.activeBackground,
        '--dialog-tabs-text-color': dialogTheme.tabs.textColor,
        '--dialog-tabs-active-text-color': dialogTheme.tabs.activeTextColor,
        '--dialog-tabs-border-color': dialogTheme.tabs.borderColor
    };
}

/**
 * Apply theme variables to a DOM element
 * @param {HTMLElement} element - Element to apply theme to
 */
export function applyDialogTheme(element) {
    if (!element) return;
    
    const themeVariables = generateDialogThemeVariables();
    
    Object.entries(themeVariables).forEach(([key, value]) => {
        element.style.setProperty(key, value);
    });
}

/**
 * Dynamically load dialog theming into a component
 * @param {Vue.Component} component - Vue component to theme
 */
export function useDialogTheme(component) {
    // Safety check
    if (!component) return;
    
    const themeVariables = generateDialogThemeVariables();
    
    // Add computed property for theme styles
    component.computed = component.computed || {};
    component.computed.dialogThemeStyles = () => themeVariables;
    
    // Add mounted hook to update when theme changes
    const originalMounted = component.mounted || (() => {});
    component.mounted = function() {
        // Call original mounted first
        originalMounted.call(this);
        
        // Listen for theme changes
        window.addEventListener('themeChange', () => {
            // Force component update
            this.$forceUpdate();
        });
    };
    
    // Clean up listeners when component is destroyed
    const originalBeforeDestroy = component.beforeDestroy || (() => {});
    component.beforeDestroy = function() {
        // Call original beforeDestroy first
        originalBeforeDestroy.call(this);
        
        // Remove event listener
        window.removeEventListener('themeChange', () => {});
    };
}

/**
 * Create CSS class for dialog theming
 * @returns {string} CSS class for dialog theming
 */
export function createDialogThemeClass() {
    const themeVariables = generateDialogThemeVariables();
    const className = `dialog-theme-${themeManager.currentTheme || 'light'}`;
    
    // Create a style element
    const styleElement = document.createElement('style');
    styleElement.textContent = `
.${className} {
    ${Object.entries(themeVariables)
        .map(([key, value]) => `${key}: ${value};`)
        .join('\n')}
}`;
    
    // Append to document head
    document.head.appendChild(styleElement);
    
    return className;
}

export default {
    generateDialogThemeVariables,
    applyDialogTheme,
    useDialogTheme,
    createDialogThemeClass
};