<!-- ModalComponent.vue -->
<template>
  <div class="modal-container">
    <!-- Backdrop/overlay with click to dismiss -->
    <div class="modal-overlay" @click="$emit('close')"></div>
    
    <!-- The actual modal dialog -->
    <div 
      class="modal-dialog"
      :class="[size, { 'modal-scrollable': scrollable }]"
      ref="modalDialog"
    >
      <!-- Header section with title and close button -->
      <div class="modal-header">
        <h2 class="modal-title" v-if="title">{{ isTranslationKey ? $t(title) : title }}</h2>
        <button 
          class="close-button" 
          @click="$emit('close')" 
          aria-label="Close"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      
      <!-- Main content area -->
      <div class="modal-body">
        <slot name="body">
          <!-- Default slot for backward compatibility -->
          <slot></slot>
        </slot>
      </div>
      
      <!-- Footer with action buttons -->
      <div class="modal-footer" v-if="$slots.footer">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ModalComponent',
  props: {
    title: {
      type: String,
      default: ''
    },
    size: {
      type: String,
      default: 'medium',
      validator: (value) => ['small', 'medium', 'large', 'xl'].includes(value)
    },
    scrollable: {
      type: Boolean,
      default: true
    },
    isTranslationKey: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      originalOverflow: null
    }
  },
  emits: ['close'],
  mounted() {
    // Prevent body scrolling when modal is open
    this.originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    
    // Trap focus inside modal
    this.trapFocus()
    
    // Add escape key listener
    document.addEventListener('keydown', this.handleEscKey)
  },
  beforeDestroy() {
    // Restore body scrolling when component is destroyed
    document.body.style.overflow = this.originalOverflow
    
    // Remove escape key listener
    document.removeEventListener('keydown', this.handleEscKey)
  },
  methods: {
    handleEscKey(event) {
      if (event.key === 'Escape') {
        this.$emit('close')
      }
    },
    trapFocus() {
      // Implementation of focus trap for accessibility
      const focusableElements = this.$refs.modalDialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      
      if (focusableElements.length > 0) {
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]
        
        // Focus the first element initially
        firstElement.focus()
        
        this.$refs.modalDialog.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            // Shift + Tab on first element -> move to last
            if (e.shiftKey && document.activeElement === firstElement) {
              e.preventDefault()
              lastElement.focus()
            } 
            // Tab on last element -> move to first
            else if (!e.shiftKey && document.activeElement === lastElement) {
              e.preventDefault()
              firstElement.focus()
            }
          }
        })
      }
    }
  }
}
</script>

<style scoped>
.modal-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  transition: opacity 0.3s ease;
}

.modal-dialog {
  position: relative;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 90%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  margin: 1.75rem auto;
  animation: modal-slide-down 0.3s ease-out;
  z-index: 1;
}

@keyframes modal-slide-down {
  from {
    opacity: 0;
    transform: translateY(-30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Modal sizes */
.modal-dialog.small {
  width: 400px;
}

.modal-dialog.medium {
  width: 600px;
}

.modal-dialog.large {
  width: 800px;
}

.modal-dialog.xl {
  width: 1000px;
}

/* Scrollable modal */
.modal-scrollable .modal-body {
  overflow-y: auto;
  max-height: calc(90vh - 120px); /* Accounting for header and footer */
}

/* Header styling */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  color: #333;
  font-weight: 600;
}

.close-button {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  color: #999;
  cursor: pointer;
  transition: color 0.2s;
}

.close-button:hover {
  color: #333;
}

/* Body styling */
.modal-body {
  padding: 20px;
  flex: 1 1 auto;
}

/* Footer styling */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #e0e0e0;
}

/* Mobile responsiveness */
@media screen and (max-width: 576px) {
  .modal-dialog {
    width: 95% !important;
    margin: 1rem auto;
  }
  
  .modal-header {
    padding: 12px 16px;
  }
  
  .modal-body {
    padding: 16px;
  }
  
  .modal-footer {
    padding: 12px 16px;
  }
}
</style>
