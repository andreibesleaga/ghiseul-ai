<template>
  <div 
    class="context-menu"
    :style="{
      top: `${adjustedPosition.y}px`,
      left: `${adjustedPosition.x}px`
    }"
    ref="menu"
  >
    <slot></slot>
  </div>
</template>

<script>
export default {
  name: 'ContextMenu',
  
  props: {
    position: {
      type: Object,
      required: true,
      validator: (value) => {
        return typeof value.x === 'number' && typeof value.y === 'number';
      }
    }
  },
  
  data() {
    return {
      adjustedPosition: {
        x: this.position.x,
        y: this.position.y
      }
    };
  },
  
  mounted() {
    document.addEventListener('click', this.handleOutsideClick);
    
    // Adjust position if menu would go off-screen
    this.$nextTick(() => {
      if (!this.$refs.menu) return;
      
      const menu = this.$refs.menu;
      const rect = menu.getBoundingClientRect();
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Adjust horizontal position if needed
      if (rect.right > viewportWidth) {
        this.adjustedPosition.x = Math.max(0, this.position.x - rect.width);
      }
      
      // Adjust vertical position if needed
      if (rect.bottom > viewportHeight) {
        this.adjustedPosition.y = Math.max(0, this.position.y - rect.height);
      }
    });
  },
  
  beforeUnmount() {
    document.removeEventListener('click', this.handleOutsideClick);
  },
  
  methods: {
    handleOutsideClick(event) {
      // Check if click is outside of the menu
      if (this.$refs.menu && !this.$refs.menu.contains(event.target)) {
        this.$emit('close');
      }
    }
  }
};
</script>

<style scoped>
.context-menu {
  position: fixed;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  min-width: 180px;
  padding: 4px 0;
  z-index: 1060;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
