<template>
  <div class="dialog-backdrop" @click="$emit('close')"></div>
  <div class="dialog-container">
    <div class="dialog-header">
      <h2 class="dialog-title">
        {{ translate("uploadDialog.title", "Upload Files") }}
      </h2>
      <button
        class="dialog-close-btn"
        @click="$emit('close')"
        :aria-label="translate('details.close', 'Close')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="dialog-body">
      <div
        class="drop-zone"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="handleDrop"
        @click="openFileDialog"
        :class="{ 'drag-over': isDragging }"
      >
        <input
          type="file"
          ref="fileInput"
          @change="handleFileSelect"
          multiple
          hidden
          :accept="allowedExtensions.join(',')"
        />
        <p>
          {{
            translate(
              "uploadDialog.dropzone",
              "Drag & drop files here, or click to select"
            )
          }}
        </p>
      </div>
      <p class="form-hint">{{ translate('uploadDialog.allowedTypesLabel', 'Allowed types:') }} {{ allowedExtensions.join(", ") }}</p>

      <div class="file-list-container" v-if="files.length > 0">
        <ul class="file-list">
          <li v-for="(file, index) in files" :key="index" class="file-item">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
            <button class="remove-file-btn" @click="removeFile(index)">
              {{ translate("uploadDialog.remove", "Remove") }}
            </button>
          </li>
        </ul>
      </div>

      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
      </div>

    <div class="dialog-footer">
      <button class="btn btn-outline" @click="$emit('close')">
        {{ translate("common.cancel", "Cancel") }}
      </button>
      <button
        class="btn btn-primary"
        @click="handleUpload"
        :disabled="files.length === 0 || isUploading"
      >
        <span v-if="isUploading">{{
          translate("uploadDialog.uploading", "Uploading...")
        }}</span>
        <span v-else>{{
          translate("uploadDialog.buttonUpload", `Upload {count} File(s)`).replace('{count}', files.length)
        }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import documentFileService from "../services/documentFileService.js";
import { eventBus } from "../eventBus.js";

export default {
  name: "UploadFilesDialog",
  emits: ["close", "files-uploaded"],
  data() {
    return {
      files: [],
      isDragging: false,
      isUploading: false,
      errorMessage: "", // --- ADDED ---
      // MODIFIED per Spec 4.2
      allowedExtensions: [
        ".pdf",
        ".docx",
        ".xlsx",
        ".md",
        ".html",
        ".txt",
      ],
    };
  },
  methods: {
    // --- ADDED: Translation Method ---
    translate(key, fallback) {
      if (this.$i18n && this.$i18n.t) {
        const translation = this.$i18n.t(key);
        if (translation === key) {
          return fallback || key;
        }
        return translation;
      }
      return fallback || key;
    },
    // --- Existing Methods ---
    openFileDialog() {
      this.$refs.fileInput.click();
    },
    handleFileSelect(event) {
      this.errorMessage = ""; // --- ADDED ---
      this.addFiles([...event.target.files]);
      event.target.value = "";
    },
    handleDrop(event) {
      this.isDragging = false;
      this.errorMessage = ""; // --- ADDED ---
      event.preventDefault();
      const droppedFiles = [];
      if (event.dataTransfer.items) {
        for (let i = 0; i < event.dataTransfer.items.length; i++) {
          const item = event.dataTransfer.items[i];
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) {
              droppedFiles.push(file);
            }
          }
        }
      } else {
        droppedFiles.push(...event.dataTransfer.files);
      }
      if (droppedFiles.length > 0) {
        this.addFiles(droppedFiles);
      } else {
        // --- UPDATED ---
        const errorMsg = this.translate('uploadDialog.notifications.dropError', "Only files can be dropped. Please check you are dragging a valid file from your computer.");
        this.errorMessage = errorMsg; // --- ADDED ---
        this.showNotification(errorMsg, "error");
      }
    },
    addFiles(newFiles) {
      // Clear previous validation errors when adding new files
      this.errorMessage = ""; // --- ADDED ---

      newFiles.forEach((file) => {
        const extension = "." + file.name.split(".").pop().toLowerCase();

        if (!this.allowedExtensions.includes(extension)) {
          // --- UPDATED ---
          const errorMsg = this.translate('uploadDialog.notifications.typeNotAllowed', `File type "{extension}" is not allowed.`).replace('{extension}', extension);
          this.errorMessage = errorMsg; // --- ADDED ---
          this.showNotification(errorMsg, "error");
          return;
        }

        if (file.name.toLowerCase().endsWith(".url")) {
          // --- UPDATED ---
          const errorMsg = this.translate('uploadDialog.notifications.shortcutUnsupported', "Shortcut files (.url) are not supported. Please drag the actual file.");
          this.errorMessage = errorMsg; // --- ADDED ---
          this.showNotification(errorMsg, "error");
          return;
        }

        if (
          this.files.some((f) => f.name === file.name && f.size === file.size)
        ) {
          // UPDATED
          this.showNotification(
            this.translate('uploadDialog.notifications.duplicate', `File "{fileName}" has already been added.`).replace('{fileName}', file.name),
            "info"
          );
          return;
        }

        this.files.push(file);
      });
    },
    removeFile(index) {
      this.files.splice(index, 1);
      this.errorMessage = ""; // --- ADDED ---
    },
    onDragOver() {
      this.isDragging = true;
    },
    onDragLeave() {
      this.isDragging = false;
    },
    formatFileSize(bytes) {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    },
    async handleUpload() {
      this.isUploading = true;
      this.errorMessage = ""; // --- ADDED ---
      const successfulUploads = [];

      for (const file of this.files) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          await documentFileService.uploadFile(formData);
          successfulUploads.push(file.name);
          // UPDATED
          this.showNotification(
            this.translate('uploadDialog.notifications.uploadSuccess', `Successfully uploaded {fileName}`).replace('{fileName}', file.name),
            "success"
          );
        } catch (error) {
          // --- THIS IS THE KEY FIX ---
          // Robustly extract the specific error message from the backend.
          const backendMessage =
            error.response?.data?.message || // 1. Check for { message: "..." } in data
            (typeof error.response?.data === 'string' ? error.response.data : null) || // 2. Check if data *is* the message string
            error.message || // 3. Check the top-level error message
            this.translate('uploadDialog.notifications.uploadFailed', `Failed to upload {fileName}.`).replace('{fileName}', file.name); // 4. Fallback

          // --- UPDATED ---
          this.errorMessage = backendMessage; // --- ADDED: Show error in the dialog box
          this.showNotification(backendMessage, "error");
          
          console.error(`Error uploading ${file.name}. Displayed message:`, backendMessage);
          console.error(`Full error object for ${file.name}:`, error);
          if (error.response) {
            console.error("Error response data:", error.response.data);
          }
          // --- END FIX ---
        }
      }
      this.isUploading = false;
      if (successfulUploads.length > 0) {
        this.$emit("files-uploaded", successfulUploads);
      }
      // Only close if ALL files were uploaded successfully
      if (successfulUploads.length === this.files.length && this.files.length > 0) {
        this.$emit("close");
      }
    },
    showNotification(message, type = "success") {
      eventBus.$emit("notification:show", { message, type });
    },
  },
};
</script>

<style scoped>
/* Styles are identical to the provided file and omitted here for brevity */
.dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1050;
}
.dialog-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 600px;
  background-color: var(--bg-dialog, #fff);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  z-index: 1051;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}
.dialog-title {
  font-size: 1.25rem;
  color: var(--text-primary, #333);
}
.dialog-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
}
.dialog-body {
  padding: 1.5rem;
  overflow-y: auto;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color, #e2e8f0);
}
.btn {
  padding: 0.6rem 1rem;
  border-radius: 0.375rem;
  border: none;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-primary {
  background-color: #3b82f6;
  color: white;
}
.btn-primary:hover {
  background-color: #2563eb;
}
.btn-primary:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}
.btn-outline {
  background-color: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}
.btn-outline:hover {
  background-color: var(--bg-section);
}

/* Component-specific styles */
.drop-zone {
  border: 2px dashed var(--border-color, #d1d5db);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}
.drop-zone.drag-over {
  background-color: rgba(59, 130, 246, 0.05);
  border-color: #3b82f6;
}
.form-hint {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin-top: 0.5rem;
  text-align: center;
}
.file-list-container {
  margin-top: 1rem;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}
.file-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.file-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}
.file-item:last-child {
  border-bottom: none;
}
.file-name {
  flex-grow: 1;
  font-size: 0.9rem;
  color: var(--text-primary);
  /* Added for better truncation */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 1rem;
}
.file-size {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin: 0 1rem;
  white-space: nowrap; /* Prevent size wrapping */
}
.remove-file-btn {
  color: var(--danger, #ef4444);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.2rem; /* Add padding for easier clicking */
}

/* --- ADDED: Error Message Style --- */
.error-message {
  margin-top: 1rem;
  color: var(--danger, #ef4444);
  background-color: rgba(239, 68, 68, 0.1);
  padding: 0.75rem;
  border-radius: 4px;
}
</style>