// src/App.vue
<template>
  <div
    id="app"
    :class="{ 'sidebar-collapsed': !isSidebarOpen }"
    :data-theme="theme"
  >
    <!-- Fallback loading state -->
    <div v-if="isLoading" class="loading-screen">
      Loading...
    </div>

    <!-- Public routes (no auth required) -->
    <router-view v-else-if="!isLoading && $route.meta.requiresAuth === false" :theme="theme" />

    <!-- 
      --- THIS IS THE FIX ---
      Authenticated app content
      Added "&& currentUser" to the v-else-if.
      This guarantees no child component will render until the user object is fully loaded.
    -->
    <template v-else-if="!isLoading && isAuthenticated && currentUser">
      <!-- Top navigation bar -->
      <nav-bar-component
        :is-sidebar-open="isSidebarOpen"
        @toggleSidebar="toggleSidebar"
        @openAnalytics="showAnalytics = true"
        @openProfile="showUserProfile = true"
        @openSettings="showSettings = true"
        @logout="handleLogout"
        @open-admin="showAdminDashboard = true"
        :config="$config"
      />

      <div class="main-container">
        <!-- Sidebar (collapsible) -->
        <side-bar-component :is-open="isSidebarOpen" />

        <!-- Main content area with router view -->
        <main class="content-area">
          <router-view />
        </main>
      </div>

      <!-- Modal Dialogs -->
      <unified-analytics-component
        v-if="showAnalytics"
        @close="showAnalytics = false"
      />
      <user-profile-component
        v-if="showUserProfile"
        @cancel="showUserProfile = false"
        @save="handleProfileSave"
      />
      <settings-component
        v-if="showSettings"
        @close="showSettings = false"
        @themeChanged="handleThemeChange"
      />
      <AdminDashboard
        v-if="showAdminDashboard"
        @close="showAdminDashboard = false"
      />
    </template>

    <!-- Login screen for unauthenticated users on auth-required routes -->
    <login-screen
      v-else-if="!isLoading && !isAuthenticated && $route.meta.requiresAuth !== false"
      @login-success="handleLoginSuccess"
      :theme="theme"
    />

    <!-- Global notification component -->
    <div
      v-if="notification.visible"
      class="notification"
      :class="notification.type"
      @click="hideNotification"
    >
      {{ notification.message }}
    </div>

    <!-- Splash screen (controlled via auth state) -->
    <splash-screen v-if="showSplash" @splash-complete="showSplash = false" />
  </div>
</template>

<script>
import NavBarComponent from "./components/NavBarComponent.vue";
import SideBarComponent from "./components/SideBarComponent.vue";
import UnifiedAnalyticsComponent from "./components/UnifiedAnalytics.vue";
import UserProfileComponent from "./components/UserProfileComponent.vue";
import SettingsComponent from "./components/SettingsComponent.vue";
import LoginScreen from "./components/LoginScreen.vue";
import AdminDashboard from "./components/AdminDashboard.vue";
import SplashScreen from "./components/SplashScreen.vue";
import { mapGetters } from "vuex";
import { eventBus } from "./eventBus.js";
import chatHistoryService from "./services/chatHistoryService";
import userService from "./services/userService";

export default {
  name: "App",
  components: {
    NavBarComponent,
    SideBarComponent,
    UnifiedAnalyticsComponent,
    UserProfileComponent,
    SettingsComponent,
    LoginScreen,
    AdminDashboard,
    SplashScreen,
  },

  data() {
    return {
      isSidebarOpen: true,
      showAnalytics: false,
      showUserProfile: false,
      showSettings: false,
      showAdminDashboard: false,
      theme: "light",
      notification: {
        visible: false,
        message: "",
        type: "success",
        timer: null,
      },
      showSplash: false,
      isLoading: true,
    };
  },
  computed: {
    // --- ADDED THIS GETTER ---
    ...mapGetters(["isAuthenticated", "currentUser"]),
  },
  watch: {
    isAuthenticated(newVal) {
      if (newVal) {
        console.log("isAuthenticated changed to true, loading folders and triggering splash");
        this.loadFoldersOnAuth();
        // Show splash screen with a slight delay to ensure DOM readiness
        setTimeout(() => {
          this.showSplash = true;
          console.log("Splash screen displayed");
          // Auto-hide splash after 3 seconds
          setTimeout(() => {
            this.showSplash = false;
            console.log("Splash screen hidden");
          }, 3000);
        }, 100);
      }
    },
    showSplash(newVal) {
      console.log("showSplash changed to:", newVal);
    },
  },
  // --- REPLACED YOUR MOUNTED HOOK WITH THIS ---
  async mounted() {
    console.log("App.vue mounted");
    
    try {
      // Wait for the auth state to be determined
      await this.$store.dispatch("initAuth");
      console.log("initAuth completed, isAuthenticated:", this.isAuthenticated);

      // If authenticated, ALSO wait for critical data to load
      // This "await" is critical
      if (this.isAuthenticated) {
        console.log("User is authenticated, now loading folders...");
        await this.loadFoldersOnAuth();
        console.log("Folders loaded.");
      }
      
      // Only set loading to false AFTER all essential data is ready
      this.isLoading = false;

    } catch (error) {
      console.error("Critical initAuth or loadFolders failed:", error);
      this.isLoading = false; // Still stop loading on error
      this.showNotification({
        message: "Failed to initialize application",
        type: "error",
        duration: 5000,
      });
    }

    // The rest of your original mounted hook
    const savedSidebarState = localStorage.getItem("sidebarOpen");
    if (savedSidebarState !== null) {
      this.isSidebarOpen = savedSidebarState === "true";
    }

    this.initTheme();
    this.initFontSize();
    this.checkScreenSize();
    window.addEventListener("resize", this.checkScreenSize);
    this.setupSystemThemeListener();
    eventBus.$on("notification:show", this.showNotification);
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.checkScreenSize);
    if (this.systemThemeListener) {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .removeEventListener("change", this.systemThemeListener);
    }
    eventBus.$off("notification:show", this.showNotification);
  },
  methods: {
    showNotification(payload) {
      if (this.notification.timer) {
        clearTimeout(this.notification.timer);
      }
      this.notification = {
        visible: true,
        message: payload.message,
        type: payload.type || "success",
        timer: null,
      };
      console.log("Showing notification:", payload);
      this.notification.timer = setTimeout(() => {
        this.hideNotification();
      }, payload.duration || 3000);
    },
    hideNotification() {
      this.notification.visible = false;
      if (this.notification.timer) {
        clearTimeout(this.notification.timer);
        this.notification.timer = null;
      }
      console.log("Notification hidden");
    },

    initTheme() {
      const currentTheme =
        document.documentElement.getAttribute("data-theme") || "light";
      this.theme = currentTheme;
      console.log("App component synchronized theme to:", this.theme);
    },

    initFontSize() {
      try {
        const fontSize = localStorage.getItem("fontSize");
        if (fontSize) {
          document.documentElement.style.fontSize = `${
            parseInt(fontSize) / 50
          }rem`;
        }
      } catch (e) {
        console.warn("Unable to get font size preference:", e);
      }
    },

    setupSystemThemeListener() {
      if (this.theme === "system" && window.matchMedia) {
        this.systemThemeListener = (e) => {
          document.documentElement.setAttribute("data-theme", "system");
          document.body.setAttribute("data-theme", "system");
          console.log("System theme changed");
        };
        window
          .matchMedia("(prefers-color-scheme: dark)")
          .addEventListener("change", this.systemThemeListener);
      }
    },

    handleThemeChange(newTheme) {
      console.log("Theme changed to:", newTheme);
      this.theme = newTheme;
      document.documentElement.setAttribute("data-theme", newTheme);
      document.body.setAttribute("data-theme", newTheme);
      try {
        localStorage.setItem("theme", newTheme);
      } catch (e) {
        console.warn("Unable to save theme preference:", e);
      }
      if (newTheme === "system") {
        this.setupSystemThemeListener();
      } else if (this.systemThemeListener) {
        window
          .matchMedia("(prefers-color-scheme: dark)")
          .removeEventListener("change", this.systemThemeListener);
        this.systemThemeListener = null;
      }
    },

    // --- REPLACED YOUR loadFoldersOnAuth METHOD WITH THIS ---
    async loadFoldersOnAuth() {
      try {
        // This will now correctly get the user from Vuex
        const user = this.currentUser; 
        console.log("loadFoldersOnAuth: Current user from store:", user);

        const userId = user?._key || user?.id;
        if (!userId) {
          // This should no longer happen because of the mounted hook's await
          console.warn("loadFoldersOnAuth called, but user not ready.");
          return; 
        }

        const response = await chatHistoryService.getUserFolders(userId);
        console.log("loadFoldersOnAuth: getUserFolders response:", response);
        let foldersArray = Array.isArray(response)
          ? response
          : response?.folders || [];
        const processedFolders = foldersArray
          .filter((folder) => folder && (folder._key || folder.id))
          .map((folder) => ({
            id: folder._key || folder.id,
            name: folder.name || "Unnamed Folder",
            description: folder.description || "",
            isDefault: folder.isDefault || false,
            createdAt: folder.createdAt || new Date().toISOString(),
          }));
        const defaultFolder = {
          id: "default",
          name: "All Chats",
          isDefault: true,
          createdAt: new Date().toISOString(),
        };
        const allFolders = [defaultFolder, ...processedFolders];
        await this.$store.dispatch("chatHistory/setFolders", allFolders);
        console.log(
          "loadFoldersOnAuth: Dispatched setFolders with:",
          allFolders
        );
        const vuexFolders = this.$store.getters["chatHistory/getAllFolders"];
        console.log(
          "loadFoldersOnAuth: Vuex folders after dispatch:",
          vuexFolders
        );
      } catch (error) {
        console.error("loadFoldersOnAuth: Error loading folders:", error);
        const defaultFolder = {
          id: "default",
          name: "All Chats",
          isDefault: true,
          createdAt: new Date().toISOString(),
        };
        await this.$store.dispatch("chatHistory/setFolders", [defaultFolder]);
        console.log(
          "loadFoldersOnAuth: Fallback to default folder:",
          defaultFolder
        );
        this.showNotification({
          message: "Failed to load folders. Using default folder.",
          type: "error",
          duration: 5000,
        });
      }
    },

    handleLoginSuccess(userData) {
      console.log("handleLoginSuccess: Received userData:", userData);
      document.documentElement.setAttribute("data-theme", this.theme);
      document.body.setAttribute("data-theme", this.theme);
      this.loadFoldersOnAuth();
    },

    async handleLogout() {
      try {
        await this.$store.dispatch("logout");
        await this.$store.dispatch("chatHistory/clearFolders");
        console.log("handleLogout: Folders cleared from Vuex store");
        try {
          localStorage.removeItem("chatHistory");
          console.log("handleLogout: Cleared chatHistory from localStorage");
        } catch (e) {
          console.error(
            "handleLogout: Error clearing chatHistory from localStorage:",
            e
          );
        }
      } catch (error) {
        console.error("handleLogout: Error during logout:", error);
        try {
          localStorage.removeItem("chatHistory");
          console.log(
            "handleLogout: Cleared chatHistory from localStorage on error"
          );
        } catch (e) {
          console.error(
            "handleLogout: Error clearing chatHistory from localStorage:",
            e
          );
        }
      }
    },

    toggleSidebar() {
      this.isSidebarOpen = !this.isSidebarOpen;
      try {
        localStorage.setItem("sidebarOpen", this.isSidebarOpen.toString());
      } catch (e) {
        console.warn("Unable to save sidebar state:", e);
      }
    },

    checkScreenSize() {
      if (window.innerWidth < 768 && this.isSidebarOpen) {
        this.isSidebarOpen = false;
      }
    },

    handleProfileSave(profileData) {
      console.log("Profile saved:", profileData);
      this.showUserProfile = false;
    },

    openAdminDashboard() {
      this.showAdminDashboard = true;
    },
  },
};
</script>

<style>
/* Global styling */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  line-height: 1.6;
  color: var(--text-primary, #333);
  background-color: var(--bg-primary, #f5f7fa);
}

/* App layout */
#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  transition: margin-left 0.3s ease;
  background-color: var(--bg-primary, #f5f7fa);
}

/* Loading screen */
.loading-screen {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: var(--bg-primary, #f5f7fa);
  color: var(--text-primary, #333);
  font-size: 1.5rem;
}

/* Notification styles (fallback for eventBus-based notifications) */
.notification {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  padding: 16px 20px;
  color: white;
  font-weight: 500;
  line-height: 1.8;
  z-index: 9000; /* Lower than NotificationSystem.vue and SplashScreen.vue */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: notification-fadeIn 0.3s ease;
  cursor: pointer;
  text-align: center;
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
}

.notification.success {
  background-color: #10b981;
}

.notification.error {
  background-color: #ef4444;
}

.notification.info {
  background-color: #3b82f6;
}

.notification.warning {
  background-color: #f59e0b;
}

@keyframes notification-fadeIn {
  from {
    opacity: 0;
    transform: translateY(-100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive adjustments */
@media screen and (min-width: 768px) {
  #app.sidebar-collapsed .content-area {
    margin-left: 0;
  }
}

@media screen and (max-width: 768px) {
  .content-area {
    margin-left: 0 !important;
  }
}

/* Animation transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
