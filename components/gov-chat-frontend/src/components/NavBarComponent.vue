<!-- NavBarComponent.vue with logout button and admin role check -->
<template>
  <div class="nav-container">
    <header class="nav-bar">
      <!-- Left section with hamburger menu, logo, and title -->
      <div class="nav-left">
        <!-- Hamburger button for sidebar toggle -->
        <button class="icon-btn hamburger-btn" @click="toggleSidebar" :class="{ 'is-active': isSidebarOpen }"
          aria-label="Toggle sidebar">
          <span class="hamburger-inner"></span>
        </button>

        <!-- Logo container for GENIE.AI configured icon -->
        <div class="logo-container">
          <!-- Display SVG icon from config (file or inline) -->
          <img v-if="config.app.icon.type === 'file'" :src="config.app.icon.value" class="govt-logo" alt="App Icon" />
          <span v-else v-html="config.app.icon.value" class="govt-logo"></span>
        </div>
        <!-- Title from GENIE.AI config - Hide on mobile -->
        <h1 class="brand-name hide-on-mobile">{{ config.app.title }}</h1>

        <!-- Mobile controls - Only shown on mobile devices -->
        <div class="mobile-controls">
          <!-- Status Indicator for Mobile -->
          <div class="status-indicator-container" ref="mobileStatusContainer">
            <button class="status-indicator-btn mobile-status-btn" @click="toggleStatusDropdown"
              aria-label="System Status">
              <span class="status-dot" :class="getStatusDotClass"></span>
              <span class="tooltip">{{ $t('nav.systemStatus') }}</span>
            </button>

            <!-- Status Dropdown (shared with desktop version) -->
            <div v-if="isStatusDropdownOpen" class="status-dropdown">
              <div class="status-dropdown-header">
                <h4>{{ $t('systemStatus.title') }}</h4>
                <div class="status-summary">
                  <span>{{ totalServices }} {{ $t('systemStatus.services') }}</span>
                </div>
              </div>

              <div class="status-counts">
                <div class="status-count-item">
                  <span class="status-dot status-operational"></span>
                  <span class="status-label">{{ $t('systemStatus.operational') }}</span>
                  <span class="status-value">{{ operationalCount }}</span>
                </div>
                <div class="status-count-item">
                  <span class="status-dot status-degraded"></span>
                  <span class="status-label">{{ $t('systemStatus.degraded') }}</span>
                  <span class="status-value">{{ degradedCount }}</span>
                </div>
                <div class="status-count-item">
                  <span class="status-dot status-outage"></span>
                  <span class="status-label">{{ $t('systemStatus.outage') }}</span>
                  <span class="status-value">{{ outageCount }}</span>
                </div>
              </div>

              <div v-if="nextDeadline" class="next-deadline">
                <h4>{{ $t('systemStatus.nextDeadline') }}</h4>
                <div class="deadline-info">
                  <span class="deadline-title">{{ $t('deadlines.taxFiling') }}</span>
                  <span class="deadline-days" :class="{ 'urgent': nextDeadline.daysRemaining < 7 }">
                    {{ nextDeadline.daysRemaining }} {{ $t('systemStatus.days') }}
                  </span>
                </div>
              </div>

              <div class="status-footer">
                <a href="#" @click.prevent="viewStatusPage">
                  {{ $t('systemStatus.viewDetails') }}
                </a>
              </div>
            </div>
          </div>

          <!-- Language Selector for Mobile -->
          <div class="language-select-container mobile-language-select">
            <language-selector />
          </div>

          <!-- Analytics button for Mobile -->
          <button class="icon-btn mobile-btn" @click="$emit('openAnalytics')" aria-label="Analytics"
                 :disabled="!isAdmin" :class="{'disabled-btn': !isAdmin}">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
              <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
            </svg>
            <span class="tooltip">{{ $t('nav.analytics') }}</span>
          </button>

          <!-- Admin button for Mobile -->
          <button class="icon-btn admin-btn mobile-btn" @click="$emit('openAdmin')" aria-label="Administration"
                 :disabled="!isAdmin" :class="{'disabled-btn': !isAdmin}">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            <span class="tooltip">{{ $t('nav.administration') }}</span>
          </button>

          <button class="icon-btn mobile-btn" @click="$emit('openSettings')" aria-label="Settings">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v-.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l-.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z">
              </path>
            </svg>
            <span class="tooltip">{{ $t('nav.settings') }}</span>
          </button>

          <button class="icon-btn user-btn mobile-btn" @click="$emit('openProfile')" aria-label="User profile">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span class="tooltip">{{ $t('nav.userProfile') }}</span>
          </button>

          <!-- ADDED: Logout button for mobile -->
          <button class="icon-btn logout-btn mobile-btn" @click="handleLogout" aria-label="Log out">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span class="tooltip">{{ $t('nav.logout') }}</span>
          </button>
        </div>
      </div>

      <!-- Main navbar area with status - Only visible on desktop -->
      <div class="nav-main desktop-only">
        <!-- Status Indicator -->
        <div class="status-indicator-container" ref="statusContainer">
          <button class="status-indicator-btn" @click="toggleStatusDropdown" aria-label="System Status">
            <span class="status-dot" :class="getStatusDotClass"></span>
            <span class="status-text">{{ statusText }}</span>
            <span class="tooltip">{{ $t('nav.systemStatus') }}</span>
          </button>

          <!-- Status Dropdown -->
          <div v-if="isStatusDropdownOpen" class="status-dropdown">
            <div class="status-dropdown-header">
              <h4>{{ $t('systemStatus.title') }}</h4>
              <div class="status-summary">
                <span>{{ totalServices }} {{ $t('systemStatus.services') }}</span>
              </div>
            </div>

            <div class="status-counts">
              <div class="status-count-item">
                <span class="status-dot status-operational"></span>
                <span class="status-label">{{ $t('systemStatus.operational') }}</span>
                <span class="status-value">{{ operationalCount }}</span>
              </div>
              <div class="status-count-item">
                <span class="status-dot status-degraded"></span>
                <span class="status-label">{{ $t('systemStatus.degraded') }}</span>
                <span class="status-value">{{ degradedCount }}</span>
              </div>
              <div class="status-count-item">
                <span class="status-dot status-outage"></span>
                <span class="status-label">{{ $t('systemStatus.outage') }}</span>
                <span class="status-value">{{ outageCount }}</span>
              </div>
            </div>

            <div v-if="nextDeadline" class="next-deadline">
              <h4>{{ $t('systemStatus.nextDeadline') }}</h4>
              <div class="deadline-info">
                <span class="deadline-title">{{ $t('deadlines.taxFiling') }}</span>
                <span class="deadline-days" :class="{ 'urgent': nextDeadline.daysRemaining < 7 }">
                  {{ nextDeadline.daysRemaining }} {{ $t('systemStatus.days') }}
                </span>
              </div>
            </div>

            <div class="status-footer">
              <a href="#" @click.prevent="viewStatusPage">
                {{ $t('systemStatus.viewDetails') }}
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Right section with language and user controls - Only visible on desktop -->
      <div class="nav-right desktop-only">
        <div class="language-select-container">
          <language-selector />
        </div>

        <!-- Analytics button for Desktop -->
        <button class="icon-btn" @click="$emit('openAnalytics')" aria-label="Analytics"
               :disabled="!isAdmin" :class="{'disabled-btn': !isAdmin}">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
            <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
          </svg>
          <span class="tooltip">{{ $t('nav.analytics') }}</span>
        </button>

        <!-- Admin button for Desktop -->
        <button class="icon-btn admin-btn" @click="$emit('openAdmin')" aria-label="Administration"
               :disabled="!isAdmin" :class="{'disabled-btn': !isAdmin}">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
          <span class="tooltip">{{ $t('nav.administration') }}</span>
        </button>

        <button class="icon-btn" @click="$emit('openSettings')" aria-label="Settings">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v-.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z">
            </path>
          </svg>
          <span class="tooltip">{{ $t('nav.settings') }}</span>
        </button>

        <button class="icon-btn user-btn" @click="$emit('openProfile')" aria-label="User profile">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span class="tooltip">{{ $t('nav.userProfile') }}</span>
        </button>

        <!-- ADDED: Logout button -->
        <button class="icon-btn logout-btn" @click="handleLogout" aria-label="Log out">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span class="tooltip">{{ $t('nav.logout') }}</span>
        </button>
      </div>
    </header>
  </div>
</template>

<script>
import LanguageSelector from '@/components/LanguageSelector.vue'

export default {
  name: 'NavBarComponent',
  components: {
    LanguageSelector
  },
  emits: ['toggleSidebar', 'openAnalytics', 'openProfile', 'openSettings', 'viewStatusPage', 'logout', 'openAdmin'],
  props: {
    isSidebarOpen: {
      type: Boolean,
      default: true
    },
    sidebarWidth: {
      type: Number,
      default: 250 // Default sidebar width in pixels
    },
    // GENIE.AI configuration for title, icon, and navbar styling
    config: {
      type: Object,
      required: true,
      default: () => ({
        app: { title: 'Genie AI Romania', icon: { type: 'file', value: '/config/genie-ai-icon-light.svg' } },
        theme: { navbar: { textColor: '#ffffff' } }
      })
    }
  },
  data() {
    return {
      isStatusDropdownOpen: false,
      currentUser: null,
      // Sample system status data - would be fetched from an API
      systemStatus: {
        overall: 'degraded', // 'operational', 'degraded', or 'outage'
        services: [
          { name: 'Portal e-Guvernare', status: 'operational' },
          { name: 'Sistem Taxe ANAF', status: 'degraded' },
          { name: 'Cerere Buletin', status: 'outage' },
          { name: 'Înregistrare Firme', status: 'operational' },
          { name: 'Permis de Conducere', status: 'operational' }
        ]
      },
      // Sample next deadline - would be personalized
      nextDeadline: {
        titleKey: 'taxFiling',
        daysRemaining: 12
      }
    }
  },
  computed: {
    operationalCount() {
      return this.systemStatus.services.filter(s => s.status === 'operational').length;
    },
    degradedCount() {
      return this.systemStatus.services.filter(s => s.status === 'degraded').length;
    },
    outageCount() {
      return this.systemStatus.services.filter(s => s.status === 'outage').length;
    },
    totalServices() {
      return this.systemStatus.services.length;
    },
    getStatusDotClass() {
      switch (this.systemStatus.overall) {
        case 'operational': return 'status-operational';
        case 'degraded': return 'status-degraded';
        case 'outage': return 'status-outage';
        default: return '';
      }
    },
    statusText() {
      // Show in user's language
      switch (this.systemStatus.overall) {
        case 'operational': return this.$t('systemStatus.allOperational');
        case 'degraded': return this.$t('systemStatus.someIssues');
        case 'outage': return this.$t('systemStatus.majorIssues');
        default: return this.$t('systemStatus.checking');
      }
    },
    // Compute if the user has admin role
    isAdmin() {
      // Debug the user object and its role value
      console.log('Current user:', this.currentUser);

      if (!this.currentUser) {
        console.log('No user found');
        return false;
      }

      // Check for role in various formats/locations
      const userRole = this.currentUser.role ||
        (this.currentUser.user && this.currentUser.user.role) ||
        '';

      console.log('User role:', userRole);

      // Case-insensitive comparison for 'admin', 'Admin', etc.
      return typeof userRole === 'string' &&
        userRole.toLowerCase() === 'admin';
    }
  },
  watch: {
    // Watch for locale changes and close/reopen dropdown to force refresh
    '$i18n.locale'(newLocale) {
      this.currentLocale = newLocale;

      // Only do this if the dropdown is open
      if (this.isStatusDropdownOpen) {
        // Briefly close and reopen to force re-render with new translations
        const wasOpen = this.isStatusDropdownOpen;
        this.isStatusDropdownOpen = false;

        // Use nextTick to ensure Vue updates the DOM first
        this.$nextTick(() => {
          if (wasOpen) {
            // Small delay to ensure DOM updates
            setTimeout(() => {
              this.isStatusDropdownOpen = true;
            }, 50);
          }
        });
      }
    }
  },
  mounted() {
    // Close dropdown when clicking outside
    document.addEventListener('click', this.handleClickOutside);

    // Get current user from local storage
    this.getCurrentUserFromStorage();

    // In a real app, you would fetch the system status from an API here
    // this.fetchSystemStatus();
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  },

  methods: {
    // Get current user info from localStorage
    getCurrentUserFromStorage() {
      try {
        console.log('Checking localStorage for user data...');

        // Try the standard 'user' key first
        let userStr = localStorage.getItem('user');

        // Log raw data for debugging
        console.log('Raw user data from localStorage:', userStr);

        if (!userStr) {
          // Check alternative keys if the main one isn't found
          console.log('Checking alternative token key...');
          userStr = localStorage.getItem('token');
          console.log('Raw token data:', userStr);
        }

        if (userStr) {
          // Parse the user data
          this.currentUser = JSON.parse(userStr);
          console.log('Parsed user data:', this.currentUser);

          // Check different possible structures
          if (this.currentUser.user) {
            console.log('User data is nested in .user property');
          }

          // Check role information
          const role = this.currentUser.role ||
            (this.currentUser.user && this.currentUser.user.role);
          console.log('Detected role:', role);
        } else {
          console.log('No user found in localStorage');
        }
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }
    },
    
    //Logout handler that properly handles backend and frontend
    async handleLogout() {
      try {
        console.log('Logout started');

        // Import userService
        const userService = require('../services/userService').default;

        // Call the userService logout method which handles the API call
        try {
          console.log('Calling userService.logout()');
          await userService.logout();
          console.log('Logout API called successfully via userService');
        } catch (apiError) {
          console.error('Error calling logout API:', apiError);
        }

        // Clear local storage (even though userService should do this as well)
        localStorage.removeItem('user');
        localStorage.removeItem('token');

        // Emit the event before navigation
        this.$emit('logout');

        // Navigate using window.location
        console.log('Redirecting to login page');
        window.location.href = '/login';

      } catch (error) {
        console.error('Logout error:', error);

        // Still clear storage and redirect on error
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    },
    toggleSidebar() {
      this.$emit('toggleSidebar')
    },
    toggleStatusDropdown() {
      this.isStatusDropdownOpen = !this.isStatusDropdownOpen;
    },
    handleClickOutside(event) {
      // Handle both desktop and mobile status containers
      const desktopContainer = this.$refs.statusContainer;
      const mobileContainer = this.$refs.mobileStatusContainer;

      if ((desktopContainer && !desktopContainer.contains(event.target)) &&
        (mobileContainer && !mobileContainer.contains(event.target))) {
        this.isStatusDropdownOpen = false;
      }
    },
    viewStatusPage() {
      this.$emit('viewStatusPage');
      this.isStatusDropdownOpen = false;
    }
  }
}
</script>

<style scoped>
/* Base styles - applied to all themes */
.nav-container {
  position: relative;
}

/* Navbar styling with GENIE.AI configured gradient and text color */
.nav-bar {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, var(--navbar-gradient-start, #4E97D1), var(--navbar-gradient-end, #2C5F8A));
  color: var(--navbar-text-color, #fff);
  height: 60px;
  padding: 0 16px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
  position: relative;
  z-index: 20;
}

.nav-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.nav-main {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 120px;
}

.nav-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 210px;
}

/* Brand name styling */
.brand-name {
  margin: 0 0 0 12px;
  font-size: 1.2rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Logo styling and animations */
.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-left: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
}

/* Adjusted for GENIE.AI configured SVG icon */
.govt-logo {
  height: 40px;
  width: 40px;
  color: white;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  transition: transform 0.3s ease;
}

.logo-container:hover .govt-logo {
  transform: scale(1.08);
}

/* Logo animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideDown {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes pulse {
  0% { opacity: 0.8; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.08); }
  100% { opacity: 0.8; transform: scale(1); }
}

@keyframes rotateIn {
  from { transform: rotate(-15deg); opacity: 0; }
  to { transform: rotate(0deg); opacity: 1; }
}

@keyframes shimmer {
  0% { stroke-dashoffset: 200; }
  100% { stroke-dashoffset: 0; }
}

.logo-base {
  fill: url(#logoGradient);
  animation: fadeIn 1.2s ease-out forwards;
}

.logo-roof {
  animation: rotateIn 1s ease-out 0.3s both;
  transform-origin: center;
}

.logo-pillars {
  animation: slideDown 0.8s ease-out 0.6s both;
}

.logo-steps {
  animation: slideDown 0.7s ease-out 0.9s both;
}

.logo-outline {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  animation: shimmer 2s ease-out 1.2s forwards;
}

.logo-glow {
  animation: pulse 3s ease-in-out infinite;
}

.logo-star {
  animation: pulse 2s ease-in-out infinite;
  transform-origin: center;
}

/* Status Indicator */
.status-indicator-container {
  position: relative;
  margin-left: auto;
  margin-right: 10px;
}

.status-indicator-btn {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: white;
  height: 36px;
  padding: 0 14px;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  font-size: 0.85rem;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.status-indicator-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
  transition: transform 0.2s ease;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
}

.status-indicator-btn:hover .status-dot {
  transform: scale(1.1);
}

.status-text {
  white-space: nowrap;
  font-weight: 500;
}

.status-operational {
  background-color: #10b981; /* Green */
}

.status-degraded {
  background-color: #f59e0b; /* Yellow/Orange */
}

.status-outage {
  background-color: #ef4444; /* Red */
}

/* Status Dropdown */
.status-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 260px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  color: #333;
  font-size: 0.85rem;
  z-index: 30;
  overflow: hidden;
  animation: dropdownFadeIn 0.2s ease-out;
}

@keyframes dropdownFadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.status-dropdown-header {
  padding: 14px 16px;
  border-bottom: 1px solid #eee;
  background: #f8f9fa;
}

.status-dropdown-header h4 {
  margin: 0 0 6px 0;
  font-weight: 600;
  color: #333;
  font-size: 1rem;
}

.status-summary {
  display: flex;
  justify-content: space-between;
  color: #666;
  font-size: 0.8rem;
}

.status-counts {
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
}

.status-count-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  padding: 4px 0;
  transition: background-color 0.2s;
  border-radius: 4px;
}

.status-count-item:hover {
  background-color: #f8f9fa;
}

.status-count-item:last-child {
  margin-bottom: 0;
}

.status-label {
  flex: 1;
  margin-left: 8px;
  color: #555;
}

.status-value {
  font-weight: 600;
  color: #333;
  background: #f5f5f5;
  border-radius: 12px;
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
}

.next-deadline {
  padding: 14px 16px;
  border-bottom: 1px solid #eee;
}

.next-deadline h4 {
  margin: 0 0 8px 0;
  font-weight: 600;
  color: #333;
  font-size: 1rem;
}

.deadline-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-radius: 4px;
}

.deadline-info:hover {
  background-color: #f8f9fa;
}

.deadline-title {
  color: #555;
}

.deadline-days {
  font-weight: 600;
  color: #2563eb; /* Blue */
  background: #eef2ff;
  padding: 4px 10px;
  border-radius: 12px;
}

.deadline-days.urgent {
  color: #ef4444; /* Red */
  background: #fee2e2;
}

.status-footer {
  padding: 12px 16px;
  text-align: center;
  background: #f9fafb;
}

.status-footer a {
  color: #2563eb;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 4px;
  transition: background-color 0.2s;
  display: inline-block;
}

.status-footer a:hover {
  text-decoration: none;
  background-color: #e0e7ff;
}

/* Button styling */
.icon-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  cursor: pointer;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 10px;
  position: relative;
  transition: all 0.2s ease;
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.icon-btn:hover {
  background-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}

.icon-btn:active {
  transform: translateY(0);
}

.icon-btn svg {
  width: 22px;
  height: 22px;
  transition: transform 0.2s ease;
}

.icon-btn:hover svg {
  transform: scale(1.1);
}

/* Disabled button styling */
.icon-btn:disabled, .disabled-btn {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: none;
}

.icon-btn:disabled:hover, .disabled-btn:hover {
  transform: none;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: none;
}

.icon-btn:disabled svg, .disabled-btn svg {
  opacity: 0.6;
}

.icon-btn:disabled:hover svg, .disabled-btn:hover svg {
  transform: none;
}

/* Logout button styling */
.logout-btn {
  background: rgba(255, 255, 255, 0.1);
}

.logout-btn:hover {
  background-color: rgba(239, 68, 68, 0.25); /* Subtle red on hover */
}

/* Tooltip styling */
.tooltip {
  position: absolute;
  bottom: -34px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  pointer-events: none;
  z-index: 40;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.tooltip::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 8px;
  height: 8px;
  background: rgba(0, 0, 0, 0.8);
}

.icon-btn:hover .tooltip {
  opacity: 1;
  visibility: visible;
}

.status-indicator-btn .tooltip {
  bottom: -34px;
}

.status-indicator-btn:hover .tooltip {
  opacity: 1;
  visibility: visible;
}

/* Hamburger menu styling */
.hamburger-btn {
  position: relative;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.hamburger-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.hamburger-inner {
  position: relative;
  width: 18px;
  height: 2px;
  background-color: white;
  transition: background-color 0.3s ease;
}

.hamburger-inner::before,
.hamburger-inner::after {
  content: '';
  position: absolute;
  left: 0;
  width: 18px;
  height: 2px;
  background-color: white;
  transition: transform 0.3s ease;
}

.hamburger-inner::before {
  top: -5px;
}

.hamburger-inner::after {
  bottom: -5px;
}

/* Centered X state */
.hamburger-btn.is-active .hamburger-inner {
  background-color: transparent;
  transform: translateX(0);
}

.hamburger-btn.is-active .hamburger-inner::before {
  transform: translateY(5px) rotate(45deg);
  top: 0;
}

.hamburger-btn.is-active .hamburger-inner::after {
  transform: translateY(-5px) rotate(-45deg);
  bottom: 0;
}

/* Language dropdown styling */
.language-select-container {
  position: relative;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  width: 120px;
  margin-right: 10px;
  transition: background-color 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.language-select-container:hover {
  background: rgba(255, 255, 255, 0.25);
}

.language-select-container :deep(select) {
  width: 100%;
  padding: 8px 10px;
  padding-right: 28px;
  border: none;
  background: transparent;
  color: white;
  font-size: 0.9rem;
  font-weight: 500;
  appearance: none;
  cursor: pointer;
  height: 36px;
}

.language-select-container :deep(select option) {
  background: #4E97D1;
  color: white;
  padding: 8px;
  font-weight: 500;
}

.select-arrow {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid white;
  pointer-events: none;
}

/* Mobile controls and responsive styles */
.mobile-controls {
  display: none;
  align-items: center;
  margin-left: auto;
}

.mobile-status-btn {
  padding: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  justify-content: center;
}

.mobile-status-btn .status-dot {
  margin-right: 0;
}

.mobile-language-select {
  width: 60px;
  margin-left: 8px;
  margin-right: 0;
}

.mobile-btn {
  width: 36px;
  height: 36px;
  margin-left: 8px;
}

.mobile-btn svg {
  width: 20px;
  height: 20px;
}

/* Desktop vs Mobile display control */
.desktop-only {
  display: flex;
}

/* Hide elements on mobile */
.hide-on-mobile {
  display: block;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .brand-name {
    font-size: 1.1rem;
  }

  .status-text {
    font-size: 0.8rem;
  }
}

@media (max-width: 900px) {
  .status-text {
    display: none;
  }

  .status-indicator-btn {
    padding: 0 10px;
    width: 36px;
  }

  .status-dot {
    margin-right: 0;
  }

  .brand-name {
    font-size: 1rem;
    max-width: 300px;
  }

  .icon-btn {
    margin-left: 8px;
  }
}

@media (max-width: 768px) {
  /* Hide desktop controls and show mobile controls */
  .desktop-only {
    display: none;
  }

  .hide-on-mobile {
    display: none;
  }

  .mobile-controls {
    display: flex;
  }

  .govt-logo {
    height: 36px;
    width: 36px;
  }

  .nav-bar {
    padding: 0 12px;
  }

  .status-dropdown {
    width: 240px;
    right: -40px;
  }

  .status-dropdown::before {
    content: '';
    position: absolute;
    top: -4px;
    right: 50px;
    width: 8px;
    height: 8px;
    background: white;
    transform: rotate(45deg);
  }

  .mobile-language-select :deep(select) {
    width: 100%;
    padding: 8px 10px;
    padding-right: 28px;
    border: none;
    background: transparent;
    color: white;
    font-size: 0.9rem;
    font-weight: 500;
    appearance: none;
    cursor: pointer;
    height: 36px;
  }

  .mobile-language-select :deep(select option) {
    background: #4E97D1;
    color: white;
    padding: 8px;
    font-weight: 500;
  }
}

@media (max-width: 600px) {
  .govt-logo {
    height: 32px;
    width: 32px;
  }

  .icon-btn {
    width: 36px;
    height: 36px;
  }

  .icon-btn svg {
    width: 20px;
    height: 20px;
  }

  .hamburger-btn {
    width: 36px;
    height: 36px;
  }

  .tooltip {
    display: none;
  }
}

@media (max-width: 480px) {
  .govt-logo {
    height: 32px;
    width: 32px;
  }

  .nav-bar {
    height: 54px;
  }

  /* Position status dropdown on small screens */
  .status-dropdown {
    width: 220px;
    right: -30px;
  }

  .status-dropdown::before {
    right: 40px;
  }

  /* Space mobile controls more compactly */
  .mobile-btn {
    margin-left: 6px;
    width: 32px;
    height: 32px;
  }

  .mobile-status-btn {
    width: 32px;
    height: 32px;
  }

  .mobile-language-select {
    width: 50px;
    margin-left: 6px;
  }
}

/* Theme Styles - Dark and System Mode */
/* Dark mode - applied to both explicit dark theme and system dark mode */
.nav-bar[data-theme="dark"],
html[data-theme="dark"] .nav-bar,
.nav-bar[data-theme="system"].dark-mode,
html[data-theme="system"].dark-mode .nav-bar {
  background: linear-gradient(135deg, var(--navbar-gradient-start, #1e3a58), var(--navbar-gradient-end, #0f1c2b));
}

/* Buttons and Controls - Dark Mode */
[data-theme="dark"] .icon-btn,
[data-theme="dark"] .hamburger-btn,
[data-theme="dark"] .status-indicator-btn,
[data-theme="dark"] .language-select-container,
html[data-theme="dark"] .icon-btn,
html[data-theme="dark"] .hamburger-btn,
html[data-theme="dark"] .status-indicator-btn,
html[data-theme="dark"] .language-select-container,
[data-theme="system"].dark-mode .icon-btn,
[data-theme="system"].dark-mode .hamburger-btn,
[data-theme="system"].dark-mode .status-indicator-btn,
[data-theme="system"].dark-mode .language-select-container,
html[data-theme="system"].dark-mode .icon-btn,
html[data-theme="system"].dark-mode .hamburger-btn,
html[data-theme="system"].dark-mode .status-indicator-btn,
html[data-theme="system"].dark-mode .language-select-container {
  background: rgba(255, 255, 255, 0.08);
}

/* Button Hover States - Dark Mode */
[data-theme="dark"] .icon-btn:hover,
[data-theme="dark"] .hamburger-btn:hover,
[data-theme="dark"] .status-indicator-btn:hover,
[data-theme="dark"] .language-select-container:hover,
html[data-theme="dark"] .icon-btn:hover,
html[data-theme="dark"] .hamburger-btn:hover,
html[data-theme="dark"] .status-indicator-btn:hover,
html[data-theme="dark"] .language-select-container:hover,
[data-theme="system"].dark-mode .icon-btn:hover,
[data-theme="system"].dark-mode .hamburger-btn:hover,
[data-theme="system"].dark-mode .status-indicator-btn:hover,
[data-theme="system"].dark-mode .language-select-container:hover,
html[data-theme="system"].dark-mode .icon-btn:hover,
html[data-theme="system"].dark-mode .hamburger-btn:hover,
html[data-theme="system"].dark-mode .status-indicator-btn:hover,
html[data-theme="system"].dark-mode .language-select-container:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* Status Dropdown - Dark Mode */
[data-theme="dark"] .status-dropdown,
html[data-theme="dark"] .status-dropdown,
[data-theme="system"].dark-mode .status-dropdown,
html[data-theme="system"].dark-mode .status-dropdown {
  background: #1f2937;
  border: 1px solid #374151;
}

[data-theme="dark"] .status-dropdown-header,
html[data-theme="dark"] .status-dropdown-header,
[data-theme="system"].dark-mode .status-dropdown-header,
html[data-theme="system"].dark-mode .status-dropdown-header {
  background: #111827;
  border-bottom: 1px solid #374151;
}

[data-theme="dark"] .status-dropdown-header h4,
[data-theme="dark"] .next-deadline h4,
html[data-theme="dark"] .status-dropdown-header h4,
html[data-theme="dark"] .next-deadline h4,
[data-theme="system"].dark-mode .status-dropdown-header h4,
[data-theme="system"].dark-mode .next-deadline h4,
html[data-theme="system"].dark-mode .status-dropdown-header h4,
html[data-theme="system"].dark-mode .next-deadline h4 {
  color: rgba(255, 255, 255, 0.9);
}

[data-theme="dark"] .status-dropdown .status-label,
[data-theme="dark"] .deadline-title,
html[data-theme="dark"] .status-dropdown .status-label,
html[data-theme="dark"] .deadline-title,
[data-theme="system"].dark-mode .status-dropdown .status-label,
[data-theme="system"].dark-mode .deadline-title,
html[data-theme="system"].dark-mode .status-dropdown .status-label,
html[data-theme="system"].dark-mode .deadline-title {
  color: rgba(255, 255, 255, 0.7);
}

[data-theme="dark"] .status-summary,
html[data-theme="dark"] .status-summary,
[data-theme="system"].dark-mode .status-summary,
html[data-theme="system"].dark-mode .status-summary {
  color: rgba(255, 255, 255, 0.5);
}

[data-theme="dark"] .status-count-item:hover,
[data-theme="dark"] .deadline-info:hover,
html[data-theme="dark"] .status-count-item:hover,
html[data-theme="dark"] .deadline-info:hover,
[data-theme="system"].dark-mode .status-count-item:hover,
[data-theme="system"].dark-mode .deadline-info:hover,
html[data-theme="system"].dark-mode .status-count-item:hover,
html[data-theme="system"].dark-mode .deadline-info:hover {
  background-color: #111827;
}

[data-theme="dark"] .status-value,
html[data-theme="dark"] .status-value,
[data-theme="system"].dark-mode .status-value,
html[data-theme="system"].dark-mode .status-value {
  background: #374151;
  color: rgba(255, 255, 255, 0.9);
}

[data-theme="dark"] .status-footer,
html[data-theme="dark"] .status-footer,
[data-theme="system"].dark-mode .status-footer,
html[data-theme="system"].dark-mode .status-footer {
  background: #111827;
  border-top: 1px solid #374151;
}

[data-theme="dark"] .status-footer a,
html[data-theme="dark"] .status-footer a,
[data-theme="system"].dark-mode .status-footer a,
html[data-theme="system"].dark-mode .status-footer a {
  color: #60a5fa;
}

[data-theme="dark"] .status-footer a:hover,
html[data-theme="dark"] .status-footer a:hover,
[data-theme="system"].dark-mode .status-footer a:hover,
html[data-theme="system"].dark-mode .status-footer a:hover {
  background-color: #1e3a58;
}

/* Fix dropdown arrow in dark mode */
[data-theme="dark"] .status-dropdown::before,
html[data-theme="dark"] .status-dropdown::before,
[data-theme="system"].dark-mode .status-dropdown::before,
html[data-theme="system"].dark-mode .status-dropdown::before {
  background: #111827;
}
</style>