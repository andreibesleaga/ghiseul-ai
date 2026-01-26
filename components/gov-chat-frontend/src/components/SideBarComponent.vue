<template>
  <aside
    class="side-bar"
    :class="{
      'side-bar-open': isOpen,
      'keyboard-active': isKeyboardActive,
      'android-device': isAndroid,
    }"
    :data-theme="$route.meta.theme || 'light'"
    ref="sideBar"
  >
    <div
      class="mobile-sidebar-overlay"
      v-if="isOpen"
      @click="closeOverlay"
    ></div>

    <div class="sidebar-inner">
      <div class="sidebar-tabs">
        <button
          class="tab-button"
          :class="{ 'tab-button-active': activeTab === 'services' }"
          @click="activeTab = 'services'"
        >
          <i class="fas fa-list"></i>
          {{ $t("sidebar.governmentServices") }}
        </button>
        <button
          class="tab-button"
          :class="{ 'tab-button-active': activeTab === 'history' }"
          @click="activeTab = 'history'"
        >
          <i class="fas fa-history"></i>
          {{ $t("sidebar.savedChats") }}
        </button>
      </div>

      <div class="sidebar-content-wrapper">
        <div class="sidebar-content" ref="sidebarContent">
          <div v-if="activeTab === 'services'" class="services-list">
            <service-tree-panel-component
              ref="serviceTree"
              @keyboard-focus="handleKeyboardFocus"
              @keyboard-blur="handleKeyboardBlur"
            />
          </div>

          <div v-else-if="activeTab === 'history'" class="chat-history">
            <div class="chat-sub-tabs" :key="currentLocale">
              <button
                class="chat-sub-tab"
                :class="{ active: activeSubTab === 'all' }"
                @click="activeSubTab = 'all'"
              >
                {{ getTabLabel("all") }}
              </button>
              <button
                class="chat-sub-tab"
                :class="{ active: activeSubTab === 'folders' }"
                @click="activeSubTab = 'folders'"
              >
                {{ getTabLabel("folders") }}
              </button>
              <button
                class="chat-sub-tab"
                :class="{ active: activeSubTab === 'starred' }"
                @click="activeSubTab = 'starred'"
              >
                {{ getTabLabel("starred") }}
              </button>
              <button
                class="chat-sub-tab"
                :class="{ active: activeSubTab === 'archived' }"
                @click="activeSubTab = 'archived'"
              >
                {{ getTabLabel("archived") }}
              </button>
            </div>

            <chat-folders
              :active-tab="activeSubTab"
              @open-chat="openChat"
              @locale-changed="handleLocaleChange"
            />
          </div>
        </div>

        <div
          class="weather-container"
          :class="{ 'hide-on-keyboard': isKeyboardActive }"
          v-show="!isKeyboardActive"
        >
          <weather-panel class="weather-panel-fixed" />
        </div>
      </div>
    </div>
  </aside>
</template>

<script>
import ServiceTreePanelComponent from "./ServiceTreePanelComponent.vue";
import ChatFolders from "./ChatFolders.vue";
import WeatherPanel from "./WeatherPanel.vue";

export default {
  name: "SideBarComponent",
  components: {
    ServiceTreePanelComponent,
    ChatFolders,
    WeatherPanel,
  },
  props: {
    isOpen: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      activeTab: "services",
      activeSubTab: "all",
      searchQuery: "",
      isKeyboardActive: false,
      initialHeight: 0,
      isMobileDevice: false,
      isAndroid: false,
      sidebarHeight: 0,
      currentLocale: "en",
    };
  },
  mounted() {
    this.initialHeight = window.innerHeight;
    this.sidebarHeight = this.$refs.sideBar
      ? this.$refs.sideBar.offsetHeight
      : 0;
    this.checkDevice();
    window.addEventListener("resize", this.handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        this.handleVisualViewportResize
      );
    }
    if (this.isAndroid) {
      document.body.classList.add("android-device");
    }
    if (this.$i18n) {
      this.currentLocale = this.$i18n.locale;
    }
    // Debug: Log active tab computed background color
    const activeTab = document.querySelector(".tab-button-active");
    console.log(
      "[SIDEBAR] Active tab computed background color:",
      activeTab
        ? window.getComputedStyle(activeTab).backgroundColor
        : "not found"
    );
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.handleResize);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener(
        "resize",
        this.handleVisualViewportResize
      );
    }
    if (this.isAndroid) {
      document.body.classList.remove("android-device");
    }
  },
  methods: {
    handleLocaleChange(newLocale) {
      console.log("[SideBar] Locale changed to:", newLocale);
      this.currentLocale = newLocale;
      this.$forceUpdate();
    },
    checkDevice() {
      this.isMobileDevice =
        window.innerWidth <= 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
      this.isAndroid = /Android/i.test(navigator.userAgent);
    },
    handleResize() {
      this.checkDevice();
      if (this.isMobileDevice) {
        if (this.isAndroid && this.isKeyboardActive) {
          this.handleAndroidKeyboard();
        } else {
          const heightDifference = this.initialHeight - window.innerHeight;
          const isKeyboardLikelyOpen = heightDifference > 150;
          if (isKeyboardLikelyOpen !== this.isKeyboardActive) {
            this.isKeyboardActive = isKeyboardLikelyOpen;
            if (isKeyboardLikelyOpen && this.isAndroid) {
              this.handleAndroidKeyboard();
            }
          }
        }
      }
    },
    handleAndroidKeyboard() {
      if (!this.$refs.sideBar || !this.$refs.sidebarContent) return;
      const keyboardHeight = this.initialHeight - window.innerHeight;
      if (keyboardHeight > 150) {
        const viewportHeight = window.innerHeight;
        const headerHeight = 60;
        const tabsHeight = 40;
        const availableHeight = viewportHeight - headerHeight - tabsHeight;
        const minContentHeight = Math.max(250, availableHeight * 0.7);
        this.$refs.sidebarContent.style.maxHeight = `${minContentHeight}px`;
        this.$refs.sidebarContent.style.height = `${minContentHeight}px`;
      }
    },
    handleVisualViewportResize() {
      if (window.visualViewport && this.isMobileDevice) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        this.isKeyboardActive = viewportHeight < windowHeight * 0.75;
      }
    },
    handleKeyboardFocus() {
      this.isKeyboardActive = true;
      document.body.classList.add("keyboard-open");
      if (this.isAndroid) {
        this.handleAndroidKeyboard();
        this.$nextTick(() => {
          if (this.$refs.sidebarContent) {
            this.$refs.sidebarContent.scrollTop = 0;
          }
        });
      }
    },
    handleKeyboardBlur() {
      setTimeout(() => {
        this.isKeyboardActive = false;
        document.body.classList.remove("keyboard-open");
        if (this.isAndroid && this.$refs.sidebarContent) {
          this.$refs.sidebarContent.style.maxHeight = "";
          this.$refs.sidebarContent.style.height = "";
        }
      }, 300);
    },
    getTabLabel(tabKey) {
      if (this.$t && typeof this.$t === "function") {
        try {
          const i18nKey = `sidebar.tab.${tabKey}`;
          const translation = this.$t(i18nKey);
          if (translation && translation !== i18nKey) {
            return translation;
          }
        } catch (error) {
          console.warn(`[SIDEBAR] Translation error for tab: ${tabKey}`, error);
        }
      }
      return tabKey.charAt(0).toUpperCase() + tabKey.slice(1);
    },
    openChat(chatId) {
      this.$emit("open-chat", chatId);
    },
    closeOverlay() {
      this.$emit("close-sidebar");
    },
  },
};
</script>

<style scoped>
/* Base styles - applied to all themes */
.side-bar {
  width: 450px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  height: 100%;
  color: var(--text-primary);
  overflow: hidden !important;
  transition: transform 0.3s ease, width 0.3s ease;
}

.sidebar-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1001;
  background: var(--bg-sidebar);
  color: var(--text-primary);
  overflow: hidden !important;
  width: 100%;
}

.sidebar-section-title,
.sidebar-header h3 {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sidebar-section h3,
.sidebar-header h3 {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 10px 16px;
}

/* Mobile overlay */
.mobile-sidebar-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

/* Tabs styling */
.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-light);
  background-color: var(--bg-tertiary);
  padding: 0;
  flex-shrink: 0;
  width: 100%;
}

.tab-button {
  flex: 1;
  padding: 10px 0;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background-color 0.2s, color 0.2s;
}

.tab-button i {
  font-size: 1rem;
  color: var(--text-tertiary);
}

.tab-button:hover {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.tab-button-active {
  background-color: var(--bg-button-primary, #2a9d8f);
  color: var(--text-button-primary, #ffffff);
}

.tab-button-active i {
  color: var(--text-button-primary, #ffffff);
}

/* New wrapper to control the layout of content + weather */
.sidebar-content-wrapper {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  height: 0;
  overflow: hidden;
  width: 100%;
}

/* Scrollable container */
.sidebar-content {
  flex-grow: 1;
  overflow-y: auto !important;
  display: flex;
  flex-direction: column;
  padding: 10px;
  padding-bottom: 0;
  margin-bottom: 0;
  background: var(--bg-sidebar);
  color: var(--text-primary);
  width: 100%;
}

.services-list,
.chat-history {
  flex-grow: 1;
  overflow: visible !important;
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* Container for weather panel */
.weather-container {
  flex-shrink: 0;
  background: var(--bg-sidebar);
  border-top: 1px solid var(--border-light);
  padding: 10px;
  margin-top: 5px;
  width: 100%;
}

/* Hide weather panel when keyboard is active on mobile */
.weather-container.hide-on-keyboard {
  display: none;
}

.weather-panel-fixed {
  width: 100%;
}

/* Special styles for when keyboard is active */
.side-bar.keyboard-active .sidebar-content {
  height: 100%;
  flex-grow: 1;
}

/* Android-specific styles */
.side-bar.android-device.keyboard-active {
  position: fixed !important;
  height: auto !important;
  bottom: auto !important;
}

/* Chat sub-tabs styling */
.chat-sub-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 10px;
  background-color: var(--bg-secondary, #f5f7fa);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  width: 100%;
}

.chat-sub-tabs::-webkit-scrollbar {
  display: none;
}

.chat-sub-tab {
  flex: 1;
  min-width: 75px;
  padding: 10px 15px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text-tertiary);
  text-align: center;
  white-space: nowrap;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.chat-sub-tab.active {
  color: var(--accent-color, #4e97d1);
  border-bottom: 2px solid var(--accent-color, #4e97d1);
  font-weight: 500;
}

.chat-sub-tab:hover:not(.active) {
  background-color: var(--bg-tertiary, #f0f0f0);
  color: var(--text-secondary);
}

/* Search box styling */
.search-container {
  display: flex;
  margin-bottom: 15px;
  padding: 5px;
  width: 100%;
}

.search-box {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-input, #ddd);
  border-radius: 4px 0 0 4px;
  font-size: 0.9rem;
  background-color: var(--bg-input, #fff);
  color: var(--text-primary, #333);
}

.search-btn {
  background: var(--accent-color, #4e97d1);
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  padding: 0 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-btn:hover {
  background: var(--accent-hover, #3a7da0);
}

/* Empty state styling */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-tertiary, #888);
  text-align: center;
  width: 100%;
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 10px;
  opacity: 0.5;
}

.empty-state p {
  margin: 5px 0;
  font-size: 0.9rem;
}

/* All chats and folders content styling */
.all-chats-content,
.folders-content {
  padding: 0;
  width: 100%;
}

/* Mobile: offscreen unless side-bar-open is set */
@media screen and (max-width: 768px) {
  .side-bar {
    position: fixed;
    top: 60px;
    left: 0;
    height: calc(100vh - 60px);
    width: 90%;
    max-width: 480px;
    transform: translateX(-100%);
    z-index: 15;
    box-shadow: none;
  }

  .side-bar.side-bar-open {
    transform: translateX(0);
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.3);
  }

  .side-bar.side-bar-open.keyboard-active.android-device {
    height: auto !important;
    bottom: auto !important;
    transform: translateX(0) !important;
  }

  .mobile-sidebar-overlay {
    display: block;
  }

  .tab-button {
    padding: 12px 0;
  }

  .side-bar.keyboard-active .sidebar-content {
    padding-bottom: 50px;
  }

  .side-bar.android-device.keyboard-active .sidebar-content {
    height: auto !important;
    min-height: 200px;
    max-height: 70vh;
  }

  .chat-sub-tab {
    padding: 8px 12px;
    font-size: 0.8rem;
  }
}

/* Desktop: if not open, set width=0 or transform */
@media screen and (min-width: 769px) {
  .side-bar {
    position: relative;
    transform: translateX(0);
    width: 450px;
    z-index: 5;
  }

  .side-bar:not(.side-bar-open) {
    width: 0;
    padding: 0;
    overflow: hidden;
  }

  .mobile-sidebar-overlay {
    display: none;
  }
}

/* Theme Styles - Dark and System Mode */
[data-theme="dark"] .tab-button:hover:not(.tab-button-active) {
  background-color: rgba(78, 151, 209, 0.15);
  color: rgba(255, 255, 255, 0.9);
}

[data-theme="dark"] .tab-button {
  color: rgba(255, 255, 255, 0.7);
}

[data-theme="dark"] .tab-button i {
  color: rgba(255, 255, 255, 0.7);
}

[data-theme="dark"] .chat-sub-tabs {
  background-color: #2a2a2a;
  border-bottom-color: #444;
}

[data-theme="dark"] .chat-sub-tab {
  color: rgba(255, 255, 255, 0.7);
}

[data-theme="dark"] .chat-sub-tab.active {
  color: #4e97d1;
  border-bottom: 2px solid #4e97d1;
  font-weight: 500;
}

[data-theme="dark"] .chat-sub-tab:hover:not(.active) {
  background-color: #333;
}

[data-theme="dark"] .sidebar-tabs {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

[data-theme="dark"] .sidebar-section-title,
[data-theme="dark"] .sidebar-header h3 {
  color: rgba(255, 255, 255, 0.7);
}

[data-theme="dark"] .sidebar-content::-webkit-scrollbar {
  width: 8px;
  background-color: #2a2a2a;
}

[data-theme="dark"] .sidebar-content::-webkit-scrollbar-track {
  background-color: #2a2a2a;
}

[data-theme="dark"] .sidebar-content::-webkit-scrollbar-thumb {
  background-color: rgba(100, 100, 100, 0.3);
  border-radius: 4px;
}

[data-theme="dark"] .sidebar-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(150, 150, 150, 0.4);
}

[data-theme="dark"] .sidebar-content {
  scrollbar-color: rgba(100, 100, 100, 0.3) #2a2a2a;
  scrollbar-width: thin;
}

[data-theme="dark"] .search-box {
  background-color: #333;
  color: var(--text-primary);
  border-color: #444;
}

[data-theme="dark"] .empty-state {
  color: rgba(255, 255, 255, 0.5);
}
</style>