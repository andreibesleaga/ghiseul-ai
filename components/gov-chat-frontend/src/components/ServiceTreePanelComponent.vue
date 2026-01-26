<!-- ServiceTreePanelComponent.vue with Android keyboard fix -->
<template>
  <div class="service-tree-panel" ref="treePanel">
    <h4>{{ $t("sidebar.governmentServices") }}</h4>

    <div class="search-container" ref="searchContainer">
      <input
        v-model="searchQuery"
        class="search-box"
        type="text"
        :placeholder="$t('sidebar.searchPlaceholder')"
        @input="performSearch"
        @focus="handleInputFocus"
        @blur="handleBlur"
      />
      <button
        class="expand-collapse-btn"
        @click="toggleAllNodes"
        :title="isAnyNodeExpanded ? 'Collapse All' : 'Expand All'"
      >
        {{ isAnyNodeExpanded ? "−" : "+" }}
      </button>
    </div>

    <div class="tree-list-container" ref="treeListContainer">
      <ul class="service-tree-list">
        <li v-for="node in nodes" :key="node.catKey">
          <div class="node-label" @click="toggleNode(node)">
            <span
              v-if="node.children && node.children.length > 0"
              class="toggle-icon"
            >
              {{ node.expanded ? "▼" : "▶" }}
            </span>
            <span class="node-name">{{ node.name }}</span>
          </div>

          <ul
            v-if="node.expanded && node.children && node.children.length > 0"
            class="child-list"
          >
            <li
              v-for="(childName, cIndex) in node.children"
              :key="cIndex"
              @click.stop="toggleChildSelection(node.catKey, childName, cIndex)"
              :class="{ selected: isChildSelected(node.catKey, cIndex) }"
            >
              <div class="node-label child-row">
                <span class="toggle-icon placeholder"></span>
                <span class="node-name">{{ childName }}</span>
              </div>
            </li>
          </ul>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { eventBus } from "../eventBus.js";
import serviceTreeService from "../services/serviceTreeService.js";

export default {
  name: "ServiceTreePanelComponent",

  data() {
    return {
      searchQuery: "",
      selectedNodes: {},
      nodes: [],
      currentLocale: "en",
      isAndroid: false,
    };
  },

  computed: {
    isAnyNodeExpanded() {
      return this.nodes.some((node) => node.expanded);
    },
  },

  created() {
    // Set initial locale
    if (this.$i18n && this.$i18n.locale) {
      this.currentLocale = this.$i18n.locale;
    }

    // Watch for locale changes
    if (this.$i18n) {
      this.$watch(
        () => this.$i18n.locale,
        (newLocale) => {
          console.log("Locale changed to:", newLocale);
          this.currentLocale = newLocale;
          // Reload categories when locale changes
          this.loadCategories(newLocale);
        }
      );
    }

    // Initial load of categories
    this.loadCategories(this.currentLocale);

    // Detect Android
    this.isAndroid = /Android/i.test(navigator.userAgent);
  },

  mounted() {
    console.log("ServiceTreePanel - mounted");
    eventBus.$on("contextItemRemoved", this.handleContextItemRemoved);

    // Add Android keyboard detection
    if (/Android/i.test(navigator.userAgent)) {
      const originalHeight = window.innerHeight;

      // Listen for resize events (keyboard opening/closing)
      window.addEventListener("resize", () => {
        // If keyboard is likely open (height decreased significantly)
        if (window.innerHeight < originalHeight * 0.75) {
          // Force sidebar open
          const sideBar = document.querySelector(".side-bar");
          if (sideBar) {
            sideBar.classList.add("side-bar-open");
            sideBar.style.transform = "translateX(0)";
            sideBar.style.display = "block";
            sideBar.style.position = "fixed";
            sideBar.style.top = "60px"; // Adjust based on your header height
            sideBar.style.bottom = "0";
            sideBar.style.zIndex = "9999";
          }

          // Add fixed position to sidebar content
          const sidebarContent = document.querySelector(".sidebar-content");
          if (sidebarContent) {
            sidebarContent.style.display = "block";
            sidebarContent.style.overflow = "auto";
            sidebarContent.style.height = "auto";
            sidebarContent.style.maxHeight = "70vh";
          }

          // Hide any elements that might interfere
          const weatherContainer = document.querySelector(".weather-container");
          if (weatherContainer) {
            weatherContainer.style.display = "none";
          }
        } else {
          // Restore normal state
          const sideBar = document.querySelector(".side-bar");
          if (sideBar) {
            sideBar.style.position = "";
            sideBar.style.top = "";
            sideBar.style.bottom = "";
            sideBar.style.zIndex = "";
          }

          const sidebarContent = document.querySelector(".sidebar-content");
          if (sidebarContent) {
            sidebarContent.style.overflow = "";
            sidebarContent.style.height = "";
            sidebarContent.style.maxHeight = "";
          }

          const weatherContainer = document.querySelector(".weather-container");
          if (weatherContainer) {
            weatherContainer.style.display = "";
          }
        }
      });
    }
  },

  beforeUnmount() {
    eventBus.$off("contextItemRemoved", this.handleContextItemRemoved);
  },

  methods: {
    // Handle focus on search input
    handleInputFocus() {
      // Specifically for Android devices
      if (/Android/i.test(navigator.userAgent)) {
        // Prevent the sidebar from being toggled/closed when keyboard opens
        const sideBar = document.querySelector(".side-bar");
        if (sideBar) {
          // Force sidebar to stay open regardless of toggle state
          sideBar.style.transform = "translateX(0)";

          // Store original width to restore it later
          sideBar._originalWidth = sideBar.style.width;

          // Ensure sidebar has proper width
          sideBar.style.width = "85%";
          sideBar.style.maxWidth = "320px";

          // Set a high z-index to keep it above other elements
          sideBar.style.zIndex = "9999";
        }

        // Force the sidebar content to stay visible
        const sidebarContent = document.querySelector(".sidebar-content");
        if (sidebarContent) {
          sidebarContent.style.display = "block";
          sidebarContent.style.visibility = "visible";
        }

        // Add a flag to body to indicate keyboard is open
        document.body.classList.add("android-keyboard-open");
      }
    },

    // Handle blur on search input
    handleInputBlur() {
      // For Android devices
      if (/Android/i.test(navigator.userAgent)) {
        // Use timeout to ensure keyboard has fully closed
        setTimeout(() => {
          // Restore sidebar to its original state
          const sideBar = document.querySelector(".side-bar");
          if (sideBar) {
            // If sidebar is meant to be closed, restore transform
            if (!sideBar.classList.contains("side-bar-open")) {
              sideBar.style.transform = "translateX(-100%)";
            } else {
              sideBar.style.transform = "";
            }

            // Restore original width if it was stored
            if (sideBar._originalWidth !== undefined) {
              sideBar.style.width = sideBar._originalWidth;
              delete sideBar._originalWidth;
            } else {
              sideBar.style.width = "";
            }

            sideBar.style.maxWidth = "";
            sideBar.style.zIndex = "";
          }

          // Remove the flag from body
          document.body.classList.remove("android-keyboard-open");
        }, 300);
      }
    },
    // Load categories from the API
    async loadCategories(locale) {
      try {
        const categories = await serviceTreeService.getAllCategories(locale);
        console.log("Raw API response:", categories);

        // Verify each category has the expected properties
        if (!categories || !Array.isArray(categories)) {
          throw new Error("Invalid API response format");
        }

        // Check categories without using unused index variable
        categories.forEach((cat) => {
          if (!cat.name) {
            console.warn(
              `Category ${cat.catKey || "unknown"} is missing name property:`,
              cat
            );
          }
        });

        // Process the API response - just add expanded property
        this.nodes = categories.map((category) => ({
          ...category,
          expanded: false,
        }));

        console.log("Categories loaded:", this.nodes);
      } catch (error) {
        console.error("Error loading categories:", error);
      }
    },

    // Handle focus on search input - for Android keyboard issues
    handleInputFocus() {
      // Only apply on Android
      if (this.isAndroid) {
        // Force the sidebar content to remain visible
        const sidebarContent = document.querySelector(".sidebar-content");
        if (sidebarContent) {
          sidebarContent.style.position = "fixed";
          sidebarContent.style.top = "60px";
          sidebarContent.style.bottom = "0";
          sidebarContent.style.left = "0";
          sidebarContent.style.width = "85%";
          sidebarContent.style.maxWidth = "320px";
          sidebarContent.style.zIndex = "9999";
          sidebarContent.style.backgroundColor = "var(--bg-sidebar, #222)";
          sidebarContent.style.overflowY = "auto";
        }

        // Show the weather container
        const weatherContainer = document.querySelector(".weather-container");
        if (weatherContainer) {
          weatherContainer.style.display = "none";
        }
      }
    },

    // Handle blur on search input
    handleInputBlur() {
      // Reset styles after delay to ensure keyboard closed
      if (this.isAndroid) {
        setTimeout(() => {
          // Reset sidebar content position
          const sidebarContent = document.querySelector(".sidebar-content");
          if (sidebarContent) {
            sidebarContent.style.position = "";
            sidebarContent.style.top = "";
            sidebarContent.style.bottom = "";
            sidebarContent.style.left = "";
            sidebarContent.style.width = "";
            sidebarContent.style.maxWidth = "";
            sidebarContent.style.zIndex = "";
            sidebarContent.style.backgroundColor = "";
            sidebarContent.style.overflowY = "";
          }

          // Show the weather container
          const weatherContainer = document.querySelector(".weather-container");
          if (weatherContainer) {
            weatherContainer.style.display = "";
          }
        }, 300);
      }
    },

    toggleNode(node) {
      node.expanded = !node.expanded;
    },

    toggleAllNodes() {
      const shouldExpand = !this.isAnyNodeExpanded;
      this.nodes.forEach((node) => {
        node.expanded = shouldExpand;
      });
    },

    handleContextItemRemoved(item) {
      if (!item || !item.category || !item.service) return;

      const catKey = item.category;
      const children =
        this.nodes.find((n) => n.catKey === catKey)?.children || [];
      const childIndex = children.findIndex(
        (child) => String(child) === String(item.service)
      );

      if (childIndex !== -1 && this.selectedNodes[catKey]) {
        // Filter out the removed index
        const nodeSelection = this.selectedNodes[catKey] || [];
        this.selectedNodes[catKey] = nodeSelection.filter(
          (idx) => idx !== childIndex
        );
      }
    },

    toggleChildSelection(catKey, childName, childIndex) {
      // Initialize array if needed
      if (!this.selectedNodes[catKey]) {
        this.selectedNodes[catKey] = [];
      }

      // Toggle selection
      let isSelected;
      const index = this.selectedNodes[catKey].indexOf(childIndex);

      if (index === -1) {
        // Add it
        this.selectedNodes[catKey].push(childIndex);
        isSelected = true;
      } else {
        // Remove it
        this.selectedNodes[catKey].splice(index, 1);
        isSelected = false;
      }

      // Notify chat component
      eventBus.$emit("treeNodeSelected", {
        category: catKey,
        service: childName,
        selected: isSelected,
      });
    },

    isChildSelected(catKey, childIndex) {
      return this.selectedNodes[catKey]?.includes(childIndex) || false;
    },

    performSearch() {
      const query = this.searchQuery.toLowerCase();

      this.nodes.forEach((node) => {
        const categoryName = (node.name || "").toLowerCase();
        const childNames = (node.children || []).map((name) =>
          typeof name === "string" ? name.toLowerCase() : ""
        );

        if (!query) {
          node.expanded = false;
        } else {
          const matchesCategory = categoryName.includes(query);
          const matchesChild = childNames.some((name) => name.includes(query));
          node.expanded = matchesCategory || matchesChild;
        }
      });
    },
  },
};
</script>

<style scoped>
.service-tree-panel {
  margin-bottom: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  font-size: inherit; /* CHANGED from 0.625rem */
  overflow-y: auto;
  position: relative;
  z-index: 10;
}

.service-tree-panel h4 {
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
  font-size: 0.75rem; /* This can remain as it's a title */
  flex-shrink: 0;
}

.search-container {
  position: relative;
  display: flex;
  margin-bottom: 8px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 20;
  background-color: var(--bg-sidebar, #fff);
  padding: 4px 0;
}

.search-box {
  flex: 1;
  padding: 6px;
  font-size: inherit; /* CHANGED from 0.625rem */
  border: 1px solid #ccc;
  border-radius: 4px;
  outline: none;
  padding-right: 30px;
}

.expand-collapse-btn {
  position: absolute;
  right: 0;
  height: 100%;
  width: 28px;
  background: #f5f5f5;
  border: 1px solid #ccc;
  border-left: none;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: bold;
  color: #555;
  padding: 0;
  transition: background-color 0.2s;
}

.expand-collapse-btn:hover {
  background-color: #e5e5e5;
}

.tree-list-container {
  flex-grow: 1;
  overflow-y: auto;
  min-height: 200px;
  transition: height 0.3s ease;
}

.service-tree-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.service-tree-list li {
  list-style: none !important;
}

.node-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.node-label:hover {
  background-color: #f0f0f0;
}

.toggle-icon {
  width: 18px;
  text-align: center;
  margin-right: 4px;
  color: #666;
  font-size: inherit; /* CHANGED from 0.625rem */
}

.toggle-icon.placeholder {
  visibility: hidden;
}

.node-name {
  flex: 1;
  color: #333;
  font-size: inherit; /* CHANGED from 0.625rem */
}

.child-list {
  margin-left: 18px;
  border-left: 1px dashed #ccc;
  padding-left: 8px;
  margin-top: 2px;
  list-style-type: none !important;
}

.child-list li {
  list-style-type: none !important;
}

.child-list li::before {
  content: none !important;
}

.selected .node-label {
  background-color: rgba(78, 151, 209, 0.3);
  border-left: 2px solid var(--accent-color);
}

ul {
  list-style-type: none !important;
}

li {
  list-style-type: none !important;
}

/* Dark mode specific styles */
[data-theme="dark"] .service-tree-panel h4 {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem; /* Ensure consistency */
}

[data-theme="dark"] .search-container {
  background-color: var(--bg-sidebar);
}

[data-theme="dark"] .search-box {
  background-color: var(--bg-input) !important;
  color: var(--text-primary) !important;
  border: 1px solid var(--border-input) !important;
}

[data-theme="dark"] .expand-collapse-btn {
  background-color: var(--bg-button-secondary) !important;
  color: var(--text-button-secondary) !important;
  border: 1px solid var(--border-light);
  border-radius: 4px;
}

[data-theme="dark"] .node-name {
  color: var(--text-primary);
}

/* Restored missing dark mode styles */
[data-theme="dark"] .service-tree-list,
[data-theme="dark"] .service-tree-list * {
  color: rgba(255, 255, 255, 0.85) !important;
}

[data-theme="dark"] .node-label {
  color: rgba(255, 255, 255, 0.85) !important;
}

[data-theme="dark"] .toggle-icon {
  color: rgba(255, 255, 255, 0.6) !important;
}

/* Mobile specific styles */
@media screen and (max-width: 768px) {
  .search-container {
    position: sticky;
    top: 0;
    z-index: 30;
    padding: 8px 0;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }

  .tree-list-container {
    min-height: 200px;
  }
}

/* Additional dark mode title styles */
[data-theme="dark"] h4,
[data-theme="dark"] .service-tree-panel h4,
[data-theme="dark"] .service-categories-title,
[data-theme="dark"] .knowledge-areas-title {
  color: rgba(255, 255, 255, 0.7) !important;
}

[data-theme="dark"] .sidebar-section-title,
[data-theme="dark"] .sidebar-header h3 {
  color: rgba(255, 255, 255, 0.7) !important;
}

[data-theme="dark"] .node-label:hover {
  background-color: #4a4a4a !important;
}
</style>