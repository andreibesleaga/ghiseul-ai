<template>
  <div class="category-panel">
    <h4>Public Services</h4>
    <ul>
      <li
        v-for="(category, index) in categories"
        :key="index"
        @click="selectCategory(category)"
      >
        <img :src="category.icon" alt="icon" class="icon" />
        <span>{{ category.name }}</span>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'ServiceCategoryPanelComponent',
  data() {
    return {
      categories: [
        { name: 'Fire', icon: '/icons/fire.png' },
        { name: 'Police', icon: '/icons/police.png' },
        { name: 'Taxation', icon: '/icons/tax.png' },
        { name: 'Building Services', icon: '/icons/building.png' }
        // etc.
      ]
    }
  },
  methods: {
    selectCategory(category) {
      this.$emit('selectCategory', category.name)
    }
  }
}
</script>

<style scoped>
.category-panel {
  margin-bottom: 20px;
}

.category-panel h4 {
  margin-bottom: 10px;
}

.category-panel ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.category-panel li {
  display: flex;
  align-items: center;
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.category-panel li:hover {
  background: #f2f6f9;
}

.icon {
  width: 24px;
  height: 24px;
  margin-right: 8px;
}

.category-panel h4 {
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

[data-theme="dark"] .category-panel h4,
html[data-theme="dark"] .category-panel h4 {
  color: rgba(255, 255, 255, 0.7) !important;
}

[data-theme="dark"] .toggle-icon {
  color: rgba(255, 255, 255, 0.6); /* Slightly muted for visual hierarchy */
}

[data-theme="dark"] .service-tree-list,
[data-theme="dark"] .service-tree-list * {
  color: rgba(255, 255, 255, 0.85) !important;
}
[data-theme="dark"] .node-name {
  color: rgba(255, 255, 255, 0.85) !important;
}

[data-theme="dark"] .node-label {
  color: rgba(255, 255, 255, 0.85) !important;
}

[data-theme="dark"] .node-label:hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

[data-theme="dark"] .toggle-icon {
  color: rgba(255, 255, 255, 0.6) !important;
}

[data-theme="dark"] .service-tree-panel h4 {
  color: rgba(255, 255, 255, 0.7) !important;
}
</style>

