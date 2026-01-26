<template>
  <div class="modal-backdrop" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <slot name="header">
          <h3>{{ translateIfKey(title) }}</h3>
        </slot>
        <button class="close-button" @click="$emit('close')" aria-label="Close">
          ×
        </button>
      </div>

      <div class="modal-body">
        <slot name="body">
          <p>{{ translateIfKey(message) }}</p>
        </slot>
      </div>

      <div class="modal-footer">
        <slot name="footer">
          <button @click="$emit('close')" class="cancel-btn">
            {{ translateIfKey(cancelText) }}
          </button>
          <button @click="$emit('confirm')" class="primary-btn">
            {{ translateIfKey(confirmText) }}
          </button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "ModalDialog",

  props: {
    title: {
      type: String,
      default: "Dialog",
    },
    message: {
      type: String,
      default: "",
    },
    cancelText: {
      type: String,
      default: "Cancel",
    },
    confirmText: {
      type: String,
      default: "Confirm",
    },
    useTranslation: {
      type: Boolean,
      default: false,
    },
  },

  methods: {
    translateIfKey(key) {
      if (this.useTranslation && key) {
        return this.$t(key);
      }
      return key;
    },
  },

  mounted() {
    document.body.classList.add("modal-open");

    // Allow ESC key to close the modal
    this.handleEscKey = (e) => {
      if (e.key === "Escape") {
        this.$emit("close");
      }
    };
    document.addEventListener("keydown", this.handleEscKey);
  },

  beforeUnmount() {
    document.body.classList.remove("modal-open");
    document.removeEventListener("keydown", this.handleEscKey);
  },
};
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1050;
}

[data-theme="dark"] .modal-backdrop,
html[data-theme="dark"] .modal-backdrop {
  background-color: rgba(0, 0, 0, 0.7);
}

.modal-content {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #333;
}

[data-theme="dark"] .modal-content,
html[data-theme="dark"] .modal-content {
  background-color: #333;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  color: #ffffff;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

[data-theme="dark"] .modal-header,
html[data-theme="dark"] .modal-header {
  border-bottom: 1px solid #444;
}

.modal-header h3,
.modal-header ::v-slotted(h3) {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
}

[data-theme="dark"] .modal-header h3,
[data-theme="dark"] .modal-header ::v-slotted(h3),
html[data-theme="dark"] .modal-header h3,
html[data-theme="dark"] .modal-header ::v-slotted(h3) {
  color: #ffffff !important; /* Ensure title text is white */
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  line-height: 1;
}

[data-theme="dark"] .close-button,
html[data-theme="dark"] .close-button {
  color: #ccc;
}

.close-button:hover {
  color: #333;
}

[data-theme="dark"] .close-button:hover,
html[data-theme="dark"] .close-button:hover {
  color: #ffffff;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.modal-body p,
.modal-body ::v-slotted(p) {
  color: #333;
  margin: 8px 0;
}

[data-theme="dark"] .modal-body p,
[data-theme="dark"] .modal-body ::v-slotted(p),
html[data-theme="dark"] .modal-body p,
html[data-theme="dark"] .modal-body ::v-slotted(p) {
  color: #ffffff !important; /* Ensure message text is white */
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

[data-theme="dark"] .modal-footer,
html[data-theme="dark"] .modal-footer {
  border-top: 1px solid #444;
}

.cancel-btn,
.primary-btn,
.danger-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.cancel-btn {
  background-color: var(--bg-button-secondary);
  border: none;
  color: var(--text-button-secondary);
}

.cancel-btn:hover {
  background-color: var(--bg-button-secondary-hover);
}

.primary-btn {
  background-color: var(--bg-button-primary);
  border: none;
  color: var(--text-button-primary);
}

.primary-btn:hover {
  background-color: var(--bg-button-primary-hover);
}

.primary-btn:disabled {
  background-color: #ddd;
  color: #999;
  cursor: not-allowed;
}

[data-theme="dark"] .primary-btn:disabled,
html[data-theme="dark"] .primary-btn:disabled {
  background-color: #555;
  color: rgba(255, 255, 255, 0.5);
}

.danger-btn {
  background-color: #e53935;
  border: none;
  color: white;
}

[data-theme="dark"] .danger-btn,
html[data-theme="dark"] .danger-btn {
  background-color: #e53935;
  color: #ffffff;
}

.danger-btn:hover {
  background-color: #c62828;
}

[data-theme="dark"] .danger-btn:hover,
html[data-theme="dark"] .danger-btn:hover {
  background-color: #c62828;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  color: #333;
  font-weight: 500;
  margin-bottom: 8px;
  display: block;
}

[data-theme="dark"] .form-group label,
html[data-theme="dark"] .form-group label {
  color: #ffffff;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  color: #333;
  font-size: 1rem;
}

[data-theme="dark"] .form-group input,
[data-theme="dark"] .form-group select,
html[data-theme="dark"] .form-group input,
html[data-theme="dark"] .form-group select {
  background-color: #444;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.warning-text {
  color: #e53935 !important;
}

:global(body.modal-open) {
  overflow: hidden;
}
</style>