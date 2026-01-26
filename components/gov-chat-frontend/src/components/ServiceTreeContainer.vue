// src/components/ServiceTreeContainer.vue
<template>
  <div class="service-tree-container">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <p>{{ $t('loading.services', 'Loading services...') }}</p>
    </div>
    
    <!-- Error state overlay (non-blocking) -->
    <div v-if="error" class="error-banner">
      <p>{{ error }}</p>
      <button @click="loadCategories" class="retry-button">
        {{ $t('error.retry', 'Retry') }}
      </button>
    </div>
    
    <!-- Service Tree Panel Component -->
    <ServiceTreePanelComponent
      ref="serviceTree"
      :key="componentKey"
      @selection-change="handleSelectionChange"
    />
  </div>
</template>

<script>
import ServiceTreePanelComponent from './ServiceTreePanelComponent.vue';
import { serviceTreeService } from '../services';
import { eventBus } from '../eventBus.js';

export default {
  name: 'ServiceTreeContainer',
  components: {
    ServiceTreePanelComponent
  },
  props: {
    userId: {
      type: String,
      required: false
    },
    locale: {
      type: String,
      default: 'en'
    }
  },
  data() {
    return {
      isLoading: false,
      error: null,
      selectedServices: [],
      componentKey: 0 // Used to force component re-render
    };
  },
  watch: {
    locale() {
      // Reload categories when locale changes
      this.loadCategories();
    }
  },
  created() {
    this.loadCategories();
    
    // Load user preferences if userId is provided
    if (this.userId) {
      this.loadUserPreferences();
    }
    
    // Listen for external requests to reload the tree
    eventBus.$on('reload-service-tree', this.loadCategories);
  },
  beforeUnmount() {
    eventBus.$off('reload-service-tree', this.loadCategories);
  },
  methods: {
    /**
     * Load service categories from backend
     */
    async loadCategories() {
      this.isLoading = true;
      this.error = null;
      
      try {
        // Get categories from service
        const categories = await serviceTreeService.getAllCategories(this.locale);
        
        // Force re-render of the component with new data
        this.componentKey += 1;
        
        // Wait for the next tick to ensure the component is rendered
        this.$nextTick(() => {
          if (this.$refs.serviceTree) {
            // Set nodes on the tree component
            this.$refs.serviceTree.nodes = categories;
            
            // If we have user preferences, restore selected nodes
            if (this.selectedServices && this.selectedServices.length > 0) {
              this.restoreSelectedServices();
            }
          }
        });
      } catch (error) {
        console.error('Error loading service categories:', error);
        this.error = this.$t('error.loadingServices', 'Failed to load services. Please try again.');
      } finally {
        this.isLoading = false;
      }
    },
    
    /**
     * Load user preferences for selected services
     */
    async loadUserPreferences() {
      if (!this.userId) return;
      
      try {
        const selectedServices = await serviceTreeService.getUserSelectedServices(this.userId);
        this.selectedServices = selectedServices;
        
        // If the component is already loaded, restore selections
        if (this.$refs.serviceTree) {
          this.restoreSelectedServices();
        }
      } catch (error) {
        console.error('Error loading user preferences:', error);
        // Non-critical error, can be ignored
      }
    },
    
    /**
     * Restore selected services from saved preferences
     */
    restoreSelectedServices() {
      if (!this.$refs.serviceTree || !this.selectedServices || this.selectedServices.length === 0) {
        return;
      }
      
      // First expand the nodes that have selections
      this.selectedServices.forEach(service => {
        const nodeIndex = this.$refs.serviceTree.nodes.findIndex(
          node => node.catKey === service.category
        );
        
        if (nodeIndex !== -1) {
          // Expand the node
          this.$refs.serviceTree.nodes[nodeIndex].expanded = true;
          
          // Select the service
          const categoryKey = service.category;
          const serviceName = service.service;
          
          // Find the index of the service
          const children = this.$refs.serviceTree.getCatChildren(categoryKey);
          const childIndex = children.findIndex(child => child === serviceName);
          
          if (childIndex !== -1) {
            // Initialize selection array if needed
            if (!this.$refs.serviceTree.selectedNodes[categoryKey]) {
              this.$refs.serviceTree.selectedNodes[categoryKey] = [];
            }
            
            // Add to selection
            if (!this.$refs.serviceTree.selectedNodes[categoryKey].includes(childIndex)) {
              this.$refs.serviceTree.selectedNodes[categoryKey].push(childIndex);
            }
          }
        }
      });
    },
    
    /**
     * Handle selection changes in the tree
     */
    handleSelectionChange(selection) {
      // Add to or remove from selected services
      if (selection.selected) {
        this.selectedServices.push(selection);
      } else {
        this.selectedServices = this.selectedServices.filter(
          s => !(s.category === selection.category && s.service === selection.service)
        );
      }
      
      // Emit event for parent components
      this.$emit('selection-change', this.selectedServices);
      
      // Save user preferences if userId is provided
      if (this.userId) {
        this.saveUserPreferences();
      }
    },
    
    /**
     * Save user preferences for selected services
     */
    async saveUserPreferences() {
      if (!this.userId) return;
      
      try {
        await serviceTreeService.saveSelectedServices(this.userId, this.selectedServices);
      } catch (error) {
        console.error('Error saving user preferences:', error);
        // Non-critical error, can be ignored
      }
    },
    
    /**
     * Get current selected services
     * @returns {Array} Selected services
     */
    getSelectedServices() {
      return this.selectedServices;
    },
    
    /**
     * Expand all nodes in the tree
     */
    expandAll() {
      if (this.$refs.serviceTree) {
        this.$refs.serviceTree.toggleAllNodes(true);
      }
    },
    
    /**
     * Collapse all nodes in the tree
     */
    collapseAll() {
      if (this.$refs.serviceTree) {
        this.$refs.serviceTree.toggleAllNodes(false);
      }
    },
    
    /**
     * Search the tree
     * @param {String} query - Search query
     */
    search(query) {
      if (this.$refs.serviceTree) {
        this.$refs.serviceTree.searchQuery = query;
        this.$refs.serviceTree.performSearch();
      }
    }
  }
};
</script>

<style scoped>
.service-tree-container {
  position: relative;
  height: 100%;
  font-size: inherit; /* Added to ensure inheritance */
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  font-size: 0.875rem; /* Explicit rem for clarity */
}

.error-banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background-color: #ffebee;
  color: #d32f2f;
  padding: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 90;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  font-size: 0.875rem; /* Explicit rem for clarity */
}

.error-banner p {
  margin: 0;
}

.spinner {
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 3px solid #4E97D1;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.retry-button {
  padding: 4px 8px;
  background-color: #d32f2f;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem; /* Changed from 12px */
}

.retry-button:hover {
  background-color: #b71c1c;
}
</style>
