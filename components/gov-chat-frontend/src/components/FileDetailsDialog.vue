<template>
  <div class="dialog-backdrop" @click="$emit('close')"></div>
  <div class="dialog-container">
    <div v-if="isLoading || isFetchingData" class="loading-overlay">
      <div class="loading-spinner"></div>
      <span>{{ translate("details.loading", "Loading File Details...") }}</span>
    </div>

    <template v-if="!isLoading && !isFetchingData && file">
      <div class="dialog-header">
        <h2 class="dialog-title">
          {{ translate("details.title", "File Details") }}
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
            viewBox="0 0 24 24"
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

      <!-- NEW: Tab Navigation -->
      <div class="tab-nav">
        <button
          :class="['tab-btn', { active: activeTab === 'details' }]"
          @click="activeTab = 'details'"
        >
          {{ translate("details.tabs.details", "Details") }}
        </button>
        <button
          v-if="file.dataprep.status?.toLowerCase() !== 'pending'"
          :class="['tab-btn', { active: activeTab === 'ingestionLog' }]"
          @click="switchToLogTab"
        >
          {{ translate("details.tabs.ingestionLog", "Ingestion Log") }}
        </button>
      </div>

      <!-- Tab Content -->
      <div class="dialog-body">
        <!-- Details Tab Content -->
        <div
          v-if="activeTab === 'details'"
          class="tab-content tab-content-details"
        >
          <div class="form-section">
            <div class="form-group">
              <label for="file-name">{{
                translate("details.fileName", "File Name")
              }}</label>
              <input
                id="file-name"
                type="text"
                class="form-input"
                v-model="editableFile.file_name"
                :disabled="!isMetadataEditable"
                :class="{
                  'is-invalid':
                    !editableFile.file_name.trim() && isMetadataEditable,
                }"
              />
            </div>
            <div class="form-group">
              <label for="author">{{
                translate("details.author", "Author")
              }}</label>
              <input
                id="author"
                type="text"
                class="form-input"
                v-model="editableFile.author"
                :disabled="!isMetadataEditable"
                :class="{
                  'is-invalid':
                    !editableFile.author.trim() && isMetadataEditable,
                }"
              />
            </div>
            <div class="form-group">
              <label>{{ translate("details.labels", "Labels") }}</label>

              <div class="select-all-container">
                <input
                  type="checkbox"
                  id="select-all-labels"
                  v-model="areAllLabelsSelected"
                  :disabled="!isMetadataEditable"
                />
                <label for="select-all-labels">{{
                  translate("details.selectAll", "Select All")
                }}</label>
              </div>

              <div class="labels-container">
                <div v-if="isHierarchyLoading" class="loading-state-small">
                  {{ translate("details.loadingLabels", "Loading labels...") }}
                </div>
                <div
                  v-for="category in knowledgeHierarchy"
                  :key="category.catKey"
                  class="label-category"
                >
                  <strong>{{ category.name }}</strong>
                  <div
                    v-for="service in category.children"
                    :key="service._key"
                    class="label-item"
                  >
                    <input
                      type="checkbox"
                      :id="'label-' + service._key"
                      :value="service.name"
                      v-model="editableFile.labels"
                      :disabled="!isMetadataEditable"
                    />
                    <label :for="'label-' + service._key">{{
                      service.name
                    }}</label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="info-section">
            <div class="info-item">
              <span class="info-label">{{
                translate("details.status", "Status")
              }}</span>
              <span
                :class="['status-tag', getStatusClass(file.dataprep.status)]"
              >
                {{ file.dataprep.status }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">{{
                translate("details.fileId", "File ID")
              }}</span>
              <span>{{ file.file_id }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{
                translate("details.fileType", "File Type")
              }}</span>
              <span>{{ file.file_type }}</span>
            </div>

            <div class="info-item" v-if="fileViewUrl">
              <span class="info-label">{{
                translate("details.viewFile", "View File")
              }}</span>
              <a
                href="#"
                @click.prevent="handleViewFile"
                rel="noopener noreferrer"
                class="file-view-link"
              >
                {{
                  isExternalUrl(file.source_url)
                    ? translate("details.visitLink", "Visit External Link")
                    : translate("details.openFile", "Open file in new tab")
                }}
              </a>
            </div>
            <div class="info-item">
              <span class="info-label">{{
                translate("details.fileSize", "File Size")
              }}</span>
              <span>{{ formatFileSize(file.file_size) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{
                translate("details.uploadDate", "Upload Date")
              }}</span>
              <span>{{ new Date(file.upload_date).toLocaleString() }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{
                translate("details.hash", "SHA256 Hash")
              }}</span>
              <span class="info-hash">{{ file.file_hash }}</span>
            </div>
          </div>
        </div>

        <!-- Ingestion Log Tab Content -->
        <div
          v-if="activeTab === 'ingestionLog'"
          class="tab-content ingestion-log-tab"
        >
          <div class="log-actions">
            <button
              class="btn btn-outline"
              @click="fetchIngestionLogs"
              :disabled="isLogLoading"
            >
              <svg
                v-if="!isLogLoading"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M23 4v6h-6"></path>
                <path
                  d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"
                ></path></svg
              >
              <span v-if="isLogLoading" class="btn-spinner"></span>
              {{
                isLogLoading
                  ? translate("common.loading", "Loading...")
                  : translate("common.refresh", "Refresh")
              }}
            </button>
            <div class_="kill-actions">
              <span class="kill-label">{{
                translate("details.log.killActions", "Kill Actions:")
              }}</span>
              <button
                class="btn btn-danger"
                @click="handleKillDocument"
                :disabled="file.dataprep.status?.toLowerCase() !== 'ingesting'"
              >
                {{
                  translate("details.log.killDocument", "Kill This Document")
                }}
              </button>
              <button
                class="btn btn-danger"
                @click="handleKillProcess"
                :disabled="file.dataprep.status?.toLowerCase() !== 'ingesting'"
              >
                {{
                  translate("details.log.killProcess", "Kill Ingestion Process")
                }}
              </button>
            </div>
          </div>
          <div class="log-table-container">
            <table class="log-table">
              <thead>
                <tr>
                  <th>
                    {{ translate("details.log.timestamp", "Timestamp") }}
                  </th>
                  <th>{{ translate("details.log.level", "Level") }}</th>
                  <th>{{ translate("details.log.stage", "Stage") }}</th>
                  <th>{{ translate("details.log.message", "Message") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="isLogLoading">
                  <td colspan="4" class="log-state">
                    {{
                      translate("details.log.loadingLogs", "Loading logs...")
                    }}
                  </td>
                </tr>
                <tr
                  v-if="!isLogLoading && ingestionLogs.length === 0"
                >
                  <td colspan="4" class="log-state">
                    {{ translate("details.log.noLogs", "No logs found.") }}
                  </td>
                </tr>
                <tr v-for="(log, index) in ingestionLogs" :key="index">
                  <td data-label="Timestamp">
                    {{ new Date(log.timestamp).toLocaleString() }}
                  </td>
                  <td data-label="Level">
                    <span :class="['log-level', getLogLevelClass(log.level)]">{{
                      log.level
                    }}</span>
                  </td>
                  <td data-label="Stage">{{ log.stage }}</td>
                  <td data-label="Message">{{ log.message }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button
          class="btn btn-danger"
          @click="handleDelete"
          :disabled="file.dataprep.status?.toLowerCase() === 'ingested'"
        >
          {{ translate("common.delete", "Delete") }}
        </button>
        <div class="footer-actions">
          <button class="btn btn-outline" @click="$emit('close')">
            {{ translate("common.cancel", "Cancel") }}
          </button>
          <button
            class="btn btn-secondary"
            @click="handleSave"
            :disabled="isSaveDisabled"
            v-if="activeTab === 'details'"
          >
            {{ translate("details.buttons.saveMetadata", "Save Metadata") }}
          </button>
          <button
            :class="mainAction.class"
            @click="mainAction.handler"
            :disabled="mainAction.disabled"
            v-if="activeTab === 'details'"
          >
            {{ mainAction.text }}
          </button>
        </div>
      </div>
    </template>

    <!-- Confirmation Dialog -->
    <ConfirmDialog
      :visible="confirmDialog.visible"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :confirmText="confirmDialog.confirmText"
      :cancelText="confirmDialog.cancelText"
      :secondaryText="confirmDialog.secondaryText"
      @confirm="confirmDialog.onConfirm"
      @cancel="confirmDialog.onCancel"
      @secondary="confirmDialog.onSecondary"
    />
  </div>
</template>

<script>
import documentFileService from "../services/documentFileService.js";
import serviceTreeService from "../services/serviceTreeService.js";
import { eventBus } from "../eventBus.js";
import ConfirmDialog from "./ConfirmDialog.vue"; // Import ConfirmDialog

export default {
  name: "FileDetailsDialog",
  components: {
    ConfirmDialog, // Register ConfirmDialog
  },
  props: {
    fileId: {
      type: String,
      required: true,
    },
  },
  emits: ["close", "file-updated", "action-triggered"],
  data() {
    return {
      isLoading: true,
      isFetchingData: true,
      isHierarchyLoading: true,
      file: null,
      editableFile: {
        file_name: "",
        author: "",
        labels: [],
      },
      knowledgeHierarchy: [],
      englishKnowledgeHierarchy: [],
      currentLocale: this.$i18n?.locale || "en",
      areAllLabelsSelected: false,
      activeTab: "details", // New tab state
      ingestionLogs: [], // New state for logs
      isLogLoading: false, // New loading state for logs
      confirmDialog: { // New state for confirmation dialog
        visible: false,
        title: "",
        message: "",
        confirmText: "OK",
        cancelText: "Cancel",
        secondaryText: "",
        onConfirm: () => {},
        onCancel: () => {},
        onSecondary: () => {},
      },
    };
  },
  computed: {
    isSaveDisabled() {
      if (!this.isMetadataEditable) return true;
      if (!this.editableFile.file_name || !this.editableFile.file_name.trim())
        return true;
      if (!this.editableFile.author || !this.editableFile.author.trim())
        return true;
      if (this.isHierarchyLoading || this.englishKnowledgeHierarchy.length === 0)
        return true;
      return false;
    },
    isMetadataEditable() {
      // Per spec, metadata is editable unless 'Ingested'.
      // Allow editing for 'Pending', 'Retracted', 'Ingestion Error', 'Ingested with Warnings'
      // UPDATED: Use toLowerCase() for reliable comparison
      return this.file && this.file.dataprep.status?.toLowerCase() !== "ingested";
    },
    mainAction() {
      if (!this.file) return {};
      // UPDATED: Use toLowerCase() for reliable comparison
      const status = this.file.dataprep.status ? this.file.dataprep.status.toLowerCase() : '';
      
      // Spec 4.2: Ingest button disabled if no labels
      const hasLabels = this.editableFile.labels.length > 0;
      
      // UPDATED: Check lowercase statuses
      if (status === "ingested" || status === "ingested with warnings") {
        return {
          text: this.translate("details.buttons.retract", "Retract"),
          class: "btn btn-warning",
          disabled: false,
          handler: this.handleRetract,
        };
      }
      return {
        text: this.translate("details.buttons.ingest", "Ingest"),
        class: "btn btn-success",
        // Disable ingest if metadata is invalid OR no labels are selected (Sec 4.2)
        disabled: this.isSaveDisabled || !hasLabels, 
        handler: this.handleIngest,
      };
    },
    allLabelNames() {
      if (!this.knowledgeHierarchy) {
        return [];
      }
      return this.knowledgeHierarchy.flatMap((category) =>
        category.children ? category.children.map((service) => service.name) : []
      );
    },
    fileViewUrl() {
      if (!this.file) return null;
      if (this.isExternalUrl(this.file.source_url)) {
        return this.file.source_url;
      }
      if (this.file.file_id) {
        return `/api/files/${this.file.file_id}/viewbrowser`;
      }
      return this.file.source_url || null;
    },
  },
  watch: {
    fileId: {
      immediate: true,
      handler(newId) {
        if (newId) {
          this.fetchData(newId);
        }
      },
    },
    "$i18n.locale"(newLocale) {
      if (newLocale && newLocale !== this.currentLocale) {
        this.currentLocale = newLocale;
        this.fetchData(this.fileId);
      }
    },
    areAllLabelsSelected(newValue) {
      if (this.isMetadataEditable) {
        this.editableFile.labels = newValue ? [...this.allLabelNames] : [];
      }
    },
    "editableFile.labels"(newLabels) {
      if (this.allLabelNames.length > 0) {
        const allSelected = this.allLabelNames.every((label) =>
          newLabels.includes(label)
        );
        this.areAllLabelsSelected =
          allSelected && newLabels.length === this.allLabelNames.length;
      } else {
        this.areAllLabelsSelected = false;
      }
    },
  },
  methods: {
    translate(key, fallback) {
      if (this.$i18n && this.$i18n.t) {
        const translation = this.$i18n.t(key, this.currentLocale);
        if (translation === key) {
          return fallback || key;
        }
        return translation;
      }
      return fallback || key;
    },
    isExternalUrl(url) {
      if (!url) return false;
      const isHttp = url.startsWith("http://") || url.startsWith("https://");
      const isOtherProtocol =
        url.startsWith("file:") ||
        url.startsWith("ftp:") ||
        url.startsWith("smb:");
      const isPlaceholder = url.includes("<HOST>") || url.includes("<PORT>");
      return isHttp && !isPlaceholder && !isOtherProtocol;
    },
    async fetchData(id) {
      this.isFetchingData = true;
      this.isLoading = true;
      this.isHierarchyLoading = true;
      try {
        const [fileResponse, hierarchyResponse, englishHierarchyResponse] =
          await Promise.all([
            documentFileService.getFileMetadata(id),
            serviceTreeService.getAdminCategories(this.currentLocale),
            serviceTreeService.getAdminCategories("en"),
          ]);

        this.file = fileResponse;
        const initialLabelsInCurrentLocale = this.mapEnglishToLocale(
          fileResponse.labels || [],
          hierarchyResponse,
          englishHierarchyResponse
        );
        this.editableFile = {
          file_name: this.file.file_name,
          author: this.file.author || "",
          labels: initialLabelsInCurrentLocale,
        };

        this.knowledgeHierarchy = hierarchyResponse;
        this.englishKnowledgeHierarchy = englishHierarchyResponse;

        // If file status is not pending, fetch logs immediately
        // UPDATED: Use toLowerCase() for reliable comparison
        if (this.file.dataprep.status?.toLowerCase() !== "pending") {
          this.fetchIngestionLogs();
        }

      } catch (error) {
        console.error("Error fetching data for FileDetailsDialog:", error);
        this.showNotification(
          this.translate(
            "details.notifications.loadError",
            "Failed to load file details."
          ),
          "error"
        );
        this.$emit("close");
      } finally {
        this.isLoading = false;
        this.isHierarchyLoading = false;
        this.isFetchingData = false;
      }
    },
    mapEnglishToLocale(englishLabels, localeHierarchy, englishHierarchy) {
      if (!englishLabels || englishLabels.length === 0 || !localeHierarchy || !englishHierarchy) {
        return [];
      }
      const localeLabels = [];
      const englishServiceMap = new Map();
      englishHierarchy.forEach((engCategory, catIndex) => {
        if (engCategory.children && localeHierarchy[catIndex] && localeHierarchy[catIndex].children) {
          engCategory.children.forEach((engService, servIndex) => {
            const localeService = localeHierarchy[catIndex].children[servIndex];
            if (localeService) {
              const keyToMatch = engService._key || `idx_${catIndex}_${servIndex}`;
              const localeKey = localeService._key || `idx_${catIndex}_${servIndex}`;
              if (keyToMatch === localeKey) {
                englishServiceMap.set(engService.name, localeService.name);
              }
            }
          });
        }
      });
      englishLabels.forEach((engLabel) => {
        if (englishServiceMap.has(engLabel)) {
          localeLabels.push(englishServiceMap.get(engLabel));
        } else {
          console.warn(`Could not map English label "${engLabel}" to current locale "${this.currentLocale}". Using English name.`);
          localeLabels.push(engLabel);
        }
      });
      return localeLabels;
    },
    getEnglishLabelNames(selectedLocaleLabels) {
      if (!selectedLocaleLabels || selectedLocaleLabels.length === 0 || this.englishKnowledgeHierarchy.length === 0 || this.knowledgeHierarchy.length === 0) {
        return [];
      }
      const englishLabels = [];
      const localeServiceMap = new Map();
      this.knowledgeHierarchy.forEach((localeCategory) => {
        if (localeCategory.children) {
          localeCategory.children.forEach((localeService) => {
            const englishService = this.findServiceInHierarchy(this.englishKnowledgeHierarchy, localeService._key, localeService.name);
            if (englishService) {
              localeServiceMap.set(localeService.name, englishService.name);
            } else {
              console.warn(`Could not find English equivalent for locale service: ${localeService.name} (Key: ${localeService._key})`);
            }
          });
        }
      });
      selectedLocaleLabels.forEach((localeLabel) => {
        if (localeServiceMap.has(localeLabel)) {
          englishLabels.push(localeServiceMap.get(localeLabel));
        } else {
          console.warn(`Could not map selected locale label "${localeLabel}" back to English.`);
          const directMatch = this.findServiceInHierarchy(this.englishKnowledgeHierarchy, null, localeLabel);
          if (directMatch) {
            englishLabels.push(directMatch.name);
          } else {
            englishLabels.push(localeLabel);
          }
        }
      });
      return [...new Set(englishLabels)];
    },
    findServiceInHierarchy(hierarchy, serviceKey, serviceName) {
      for (const category of hierarchy) {
        if (category.children) {
          for (const service of category.children) {
            if (serviceKey && service._key && service._key === serviceKey) {
              return service;
            }
            if (!serviceKey && service.name === serviceName) {
              return service;
            }
          }
        }
      }
      return null;
    },
    async handleSave() {
      if (this.isSaveDisabled) {
        this.showNotification(
          this.translate(
            "details.notifications.validationError",
            "File Name and Author are required, or labels are still loading."
          ),
          "error"
        );
        return false; // Return false on failure
      }

      const englishLabelsToSave = this.getEnglishLabelNames(
        this.editableFile.labels
      );

      const updates = {
        file_name: this.editableFile.file_name.trim(),
        author: this.editableFile.author.trim(),
        labels: englishLabelsToSave,
      };
      try {
        await documentFileService.updateFile(this.fileId, updates);
        this.showNotification(
          this.translate(
            "details.notifications.saveSuccess",
            "Metadata updated successfully."
          ),
          "success"
        );
        this.$emit("file-updated", { fileId: this.fileId, ...updates });
        return true; // Return true on success
      } catch (error) {
        this.showNotification(
          this.translate(
            "details.notifications.saveError",
            "Failed to save metadata."
          ),
          "error"
        );
        return false; // Return false on failure
      }
    },
    async handleViewFile() {
      if (this.isExternalUrl(this.file?.source_url)) {
        console.log(`Opening external source URL: ${this.file.source_url}`);
        window.open(this.file.source_url, "_blank", "noopener,noreferrer");
        return;
      }

      let token = null;
      try {
        const userDataString = localStorage.getItem("user");
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          token = userData?.accessToken;
        }

        if (!token) {
          console.error("Authentication token not found in user data.");
          this.showNotification(
            this.translate(
              "details.notifications.tokenError",
              "Authentication token not found. Cannot view file."
            ),
            "error"
          );
          return;
        }

        if (!this.fileViewUrl) {
          console.error("File view URL is not available.");
          this.showNotification(
            this.translate(
              "details.notifications.viewError",
              "Could not determine file view URL."
            ),
            "error"
          );
          return;
        }

        const response = await fetch(this.fileViewUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to fetch file: ${response.status} ${response.statusText}. Response: ${errorText}`
          );
        }

        const blob = await response.blob();
        const fileURL = URL.createObjectURL(blob);
        window.open(fileURL, "_blank", "noopener,noreferrer");
      } catch (error) {
        console.error("Error viewing file:", error);
        this.showNotification(
          this.translate(
            "details.notifications.viewError",
            "Could not load file for viewing."
          ) + ` Error: ${error.message}`,
          "error"

        );
      }
    },

    // --- Action Handlers using ConfirmDialog ---
    
    async handleIngest() {
      // Spec 4.2: Label constraint check
      if (this.editableFile.labels.length === 0) {
        this.showNotification(
          this.translate(
            "details.notifications.ingestLabelRequired",
            "Please select at least one label before ingesting."
          ),
          "error"
        );
        return;
      }
      
      // Spec 4.2: Save before ingest
      this.showNotification(
        this.translate(
          "details.notifications.ingestSaving",
          "Saving metadata before ingestion..."
        ),
        "info"
      );
      const saveSuccess = await this.handleSave();

      if (saveSuccess) {
        // Show ingest confirmation
        this.confirmDialog = {
          visible: true,
          title: this.translate("details.confirm.ingestTitle", "Confirm Ingestion"),
          message: this.translate(
            "details.confirm.ingest",
            "Are you sure you want to ingest this file? This will start the data processing pipeline."
          ),
          confirmText: this.translate("common.ingest", "Ingest"),
          cancelText: this.translate("common.cancel", "Cancel"),
          onConfirm: this.confirmIngest,
          onCancel: this.closeConfirm,
        };
      } else {
         this.showNotification(
          this.translate(
            "details.notifications.ingestSaveFailed",
            "Failed to save metadata. Ingestion cancelled."
          ),
          "error"
        );
      }
    },
    async confirmIngest() {
      this.closeConfirm();
      this.isLoading = true;
      try {
        await documentFileService.ingestFile(this.fileId);
        this.showNotification(
          this.translate(
            "details.notifications.ingestSuccess",
            "File has been successfully queued for ingestion."
          ),
          "success"
        );
        this.$emit("action-triggered", {
          action: "ingest",
          fileId: this.fileId,
        });
        this.$emit("close");
      } catch (error) {
        this.showNotification(
          this.translate(
            "details.notifications.ingestError",
            "Failed to start ingestion process."
          ) + ` Error: ${error.message}`,
          "error"
        );
      } finally {
        this.isLoading = false;
      }
    },

    handleRetract() {
      this.confirmDialog = {
        visible: true,
        title: this.translate("details.confirm.retractTitle", "Confirm Retraction"),
        message: this.translate(
          "details.confirm.retract",
          "Are you sure you want to retract this file?"
        ),
        confirmText: this.translate("common.retract", "Retract"),
        cancelText: this.translate("common.cancel", "Cancel"),
        onConfirm: this.confirmRetract,
        onCancel: this.closeConfirm,
      };
    },
    async confirmRetract() {
      this.closeConfirm();
      this.isLoading = true;
      try {
        await documentFileService.retractMultipleFiles([this.file.file_id]);
        this.showNotification(
          this.translate(
            "details.notifications.retractSuccess",
            "File has been retracted."
          ),
          "success"
        );
        this.$emit("action-triggered", {
          action: "retract",
          fileId: this.file.file_id,
        });
        this.$emit("close");
      } catch (error) {
        this.showNotification(
          this.translate(
            "details.notifications.retractError",
            "Failed to retract file."
          ) + ` Error: ${error.message}`,
          "error"
        );
      } finally {
        this.isLoading = false;
      }
    },

    handleDelete() {
      this.confirmDialog = {
        visible: true,
        title: this.translate("details.confirm.deleteTitle", "Confirm Deletion"),
        message: this.translate(
          "details.confirm.delete",
          "Are you sure you want to permanently delete this file? This action cannot be undone."
        ),
        confirmText: this.translate("common.delete", "Delete"),
        cancelText: this.translate("common.cancel", "Cancel"),
        onConfirm: this.confirmDelete,
        onCancel: this.closeConfirm,
      };
    },
    async confirmDelete() {
      this.closeConfirm();
      this.isLoading = true;
      try {
        await documentFileService.deleteFile(this.file.file_id);
        this.showNotification(
          this.translate(
            "details.notifications.deleteSuccess",
            "File deleted successfully."
          ),
          "success"
        );
        this.$emit("action-triggered", {
          action: "delete",
          fileId: this.file.file_id,
        });
        this.$emit("close");
      } catch (error) {
        this.showNotification(
          this.translate(
            "details.notifications.deleteError",
            "Failed to delete file."
          ) + ` Error: ${error.message}`,
          "error"
        );
      } finally {
        this.isLoading = false;
      }
    },

    // --- Kill Action Handlers (UI Only) ---
    handleKillDocument() {
      this.confirmDialog = {
        visible: true,
        title: this.translate("details.confirm.killDocTitle", "Kill Document Ingestion"),
        message: this.translate(
          "details.confirm.killDoc",
          "Are you sure you want to kill the ingestion task for THIS document? The process will attempt a graceful rollback."
        ),
        confirmText: this.translate("details.log.killDocument", "Kill This Document"),
        cancelText: this.translate("common.cancel", "Cancel"),
        onConfirm: this.confirmKillDocument,
        onCancel: this.closeConfirm,
      };
    },
    confirmKillDocument() {
      this.closeConfirm();
      console.warn("KILL DOCUMENT Requested (Backend not implemented)");
      this.showNotification(
        this.translate(
          "details.notifications.killDocSent",
          "Kill request for this document has been sent."
        ),
        "info"
      );
      // TODO: Call backend service when available
    },
    
    handleKillProcess() {
       this.confirmDialog = {
        visible: true,
        title: this.translate("details.confirm.killProcTitle", "Kill ENTIRE Ingestion Process"),
        message: this.translate(
          "details.confirm.killProc",
          "WARNING: This will kill the entire backend ingestion service, affecting ALL files currently processing. Are you absolutely sure?"
        ),
        confirmText: this.translate("details.log.killProcess", "Kill Ingestion Process"),
        cancelText: this.translate("common.cancel", "Cancel"),
        onConfirm: this.confirmKillProcess,
        onCancel: this.closeConfirm,
      };
    },
    confirmKillProcess() {
      this.closeConfirm();
      console.warn("KILL PROCESS Requested (Backend not implemented)");
      this.showNotification(
        this.translate(
          "details.notifications.killProcSent",
          "Kill request for the ingestion process has been sent."
        ),
        "warning"
      );
      // TODO: Call backend service when available
    },
    
    closeConfirm() {
      this.confirmDialog.visible = false;
    },

    // --- Log Tab Methods ---
    switchToLogTab() {
      this.activeTab = 'ingestionLog';
      // Fetch logs when switching to the tab for the first time
      if (this.ingestionLogs.length === 0) {
        this.fetchIngestionLogs();
      }
    },
    async fetchIngestionLogs() {
      this.isLogLoading = true;
      try {
        const response = await documentFileService.getIngestionLogs(this.fileId);
        this.ingestionLogs = response.data || [];
      } catch (error) {
        console.error("Error fetching ingestion logs:", error);
        this.showNotification(
          this.translate(
            "details.notifications.logError",
            "Failed to fetch ingestion logs."
          ),
          "error"
        );
        this.ingestionLogs = []; // Clear logs on error
      } finally {
        this.isLogLoading = false;
      }
    },
    getLogLevelClass(level) {
      if (level === "ERROR") return "log-level-error";
      if (level === "WARN") return "log-level-warn";
      return "log-level-info";
    },

    // --- Util Methods ---
    getStatusClass(status) {
      // Added new states from Sec 3.1
      // UPDATED: Use toLowerCase() for reliable comparison
      const lowerStatus = status ? status.toLowerCase() : '';

      if (lowerStatus === "ingested") return "status-ingested";
      if (lowerStatus === "pending") return "status-pending";
      if (lowerStatus === "retracted") return "status-retracted";
      if (lowerStatus === "ingesting") return "status-ingesting";
      if (lowerStatus === "ingestion error") return "status-error";
      if (lowerStatus === "ingested with warnings") return "status-warn";
      return "status-pending"; // Default
    },
    formatFileSize(bytes) {
      if (bytes == null || bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
      if (bytes < 1) return `${bytes} Bytes`;
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      const index = Math.min(i, sizes.length - 1);
      return (
        parseFloat((bytes / Math.pow(k, index)).toFixed(2)) + " " + sizes[index]
      );
    },
    showNotification(message, type = "success") {
      eventBus.$emit("notification:show", { message, type });
    },
  },
};
</script>

<style scoped>
/* Styles for tabs, log table, and new statuses */
.tab-nav {
  display: flex;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  padding: 0 1.5rem;
  flex-shrink: 0;
}
.tab-btn {
  padding: 0.75rem 1rem;
  border: none;
  background-color: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tab-btn.active {
  color: var(--primary, #3b82f6);
  border-bottom-color: var(--primary, #3b82f6);
}
.tab-btn:hover:not(.active) {
  color: var(--text-primary);
}

.dialog-body {
  padding: 0; /* Remove padding as content will have its own */
  overflow-y: auto;
  display: flex; /* Use flex to manage content */
  flex-direction: column;
}

.tab-content {
  padding: 1.5rem;
  overflow-y: auto;
}
.tab-content-details {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
}

/* Ingestion Log Tab Styles */
.ingestion-log-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.log-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}
.kill-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.kill-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary);
}
.btn-spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 0.5em;
}

.log-table-container {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}
.log-table {
  width: 100%;
  border-collapse: collapse;
}
.log-table th,
.log-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.9rem;
}
.log-table th {
  background-color: var(--bg-section);
  font-weight: 600;
  color: var(--text-secondary);
}
.log-table td {
  color: var(--text-primary);
  vertical-align: top;
}
.log-table tr:last-child td {
  border-bottom: none;
}
.log-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  font-style: italic;
}
.log-level {
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 0.8rem;
  white-space: nowrap;
}
.log-level-info {
  color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.1);
}
.log-level-warn {
  color: #f59e0b;
  background-color: rgba(245, 158, 11, 0.1);
}
.log-level-error {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
}

/* Base styles from original file */
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
  max-width: 800px;
  background-color: var(--bg-dialog, #fff);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  z-index: 1051;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
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
  justify-content: center;
  align-items: center;
  min-height: 400px;
  gap: 1rem;
  z-index: 10;
}
[data-theme="dark"] .loading-overlay {
  background-color: rgba(30, 41, 59, 0.8);
  color: var(--text-primary);
}
.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-color, rgba(0, 0, 0, 0.1));
  border-top-color: var(--primary, #3b82f6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
[data-theme="dark"] .loading-spinner {
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--primary);
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  flex-shrink: 0;
}
.dialog-title {
  font-size: 1.25rem;
  color: var(--text-primary, #333);
  margin: 0;
}
.dialog-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0.25rem;
  line-height: 1;
}

/* Responsive grid for smaller screens */
@media (max-width: 768px) {
  .tab-content-details {
    grid-template-columns: 1fr; /* Stack columns on smaller screens */
    gap: 1.5rem;
  }
  .log-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .kill-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .kill-actions .btn {
    width: 100%;
  }
}
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color, #e2e8f0);
  flex-shrink: 0;
}
.footer-actions {
  display: flex;
  gap: 0.75rem;
}
.btn {
  padding: 0.6rem 1rem;
  border-radius: 0.375rem;
  border: none;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1.2;
  gap: 0.5rem; /* Gap between icon/spinner and text */
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--bg-button-disabled, #ccc);
  border-color: var(--border-button-disabled, #ccc);
  color: var(--text-button-disabled, #666);
}
.btn-primary {
  background-color: var(--primary, #3b82f6);
  color: white;
}
.btn-primary:hover:not(:disabled) {
  background-color: var(--primary-dark, #2563eb);
}
.btn-secondary {
  background-color: var(--secondary, #64748b);
  color: white;
}
.btn-secondary:hover:not(:disabled) {
  background-color: #475569;
}
.btn-success {
  background-color: var(--success, #10b981);
  color: white;
}
.btn-success:hover:not(:disabled) {
  background-color: #059669;
}
.btn-warning {
  background-color: var(--warning, #f59e0b);
  color: #1f2937;
}
.btn-warning:hover:not(:disabled) {
  background-color: #d97706;
}
.btn-danger {
  background-color: var(--danger, #ef4444);
  color: white;
}
.btn-danger:hover:not(:disabled) {
  background-color: #dc2626;
}
.btn-outline {
  background-color: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}
.btn-outline:hover:not(:disabled) {
  background-color: var(--bg-section);
  border-color: var(--border-color-hover, #cbd5e1);
}
.btn-outline:disabled {
  background-color: transparent;
  border-color: var(--border-button-disabled, #ccc);
  color: var(--text-button-disabled, #999);
}
[data-theme="dark"] .btn-warning {
  color: #1f2937;
}
[data-theme="dark"] .btn-outline {
  color: var(--text-secondary-dark, #cbd5e1);
  border-color: var(--border-color-dark, #4b5563);
}
[data-theme="dark"] .btn-outline:hover:not(:disabled) {
  background-color: var(--bg-section-dark, #374151);
  border-color: var(--border-color-hover-dark, #6b7280);
}
[data-theme="dark"] .btn:disabled {
  background-color: var(--bg-button-disabled-dark, #4b5563);
  border-color: var(--border-button-disabled-dark, #4b5563);
  color: var(--text-button-disabled-dark, #9ca3af);
}
[data-theme="dark"] .btn-outline:disabled {
  background-color: transparent;
  border-color: var(--border-button-disabled-dark, #4b5563);
  color: var(--text-button-disabled-dark, #6b7280);
}
.form-group {
  margin-bottom: 1.5rem;
}
.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-secondary);
}
.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-input, var(--border-color));
  border-radius: 4px;
  background-color: var(--bg-input, #fff);
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.form-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}
.form-input:disabled {
  background-color: var(--bg-input-disabled, var(--bg-section));
  color: var(--text-tertiary);
  cursor: not-allowed;
  border-color: var(--border-input-disabled, var(--border-color));
}
.form-input.is-invalid {
  border-color: var(--danger, #ef4444);
  box-shadow: 0 0 0 1px var(--danger, #ef4444);
}
.info-section {
  background-color: var(--bg-section);
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid var(--border-color);
}
.info-item {
  display: flex;
  flex-direction: column;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}
.info-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.info-item > span:not(.info-label):not(.status-tag) {
  color: var(--text-primary);
}
.info-hash {
  word-break: break-all;
  font-family: monospace;
  font-size: 0.85rem;
  background-color: var(--bg-code, #f3f4f6);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  color: var(--text-code, #374151);
  border: 1px solid var(--border-code, var(--border-color));
}
[data-theme="dark"] .info-hash {
  background-color: var(--bg-code-dark, #374151);
  color: var(--text-code-dark, #e5e7eb);
  border-color: var(--border-code-dark, #4b5563);
}
.select-all-container {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
  cursor: pointer;
}
.select-all-container input[type="checkbox"] {
  margin-right: 0.5rem;
  cursor: pointer;
  height: 1rem;
  width: 1rem;
}
.select-all-container label {
  margin-bottom: 0;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
}
.select-all-container input[type="checkbox"]:disabled + label {
  color: var(--text-tertiary);
  cursor: not-allowed;
}
.labels-container {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-input, var(--border-color));
  padding: 0.75rem;
  border-radius: 4px;
  background-color: var(--bg-input, #fff);
}
.loading-state-small {
  font-style: italic;
  color: var(--text-secondary);
  text-align: center;
  padding: 1rem;
}
.label-category {
  margin-bottom: 0.75rem;
}
.label-category strong {
  font-size: 0.9rem;
  color: var(--text-primary);
  display: block;
  margin-bottom: 0.25rem;
}
.label-item {
  display: flex;
  align-items: center;
  margin-top: 0.5rem;
  padding-left: 0.5rem;
  cursor: pointer;
}
.label-item input[type="checkbox"] {
  margin-right: 0.5rem;
  cursor: pointer;
  height: 1rem;
  width: 1rem;
}
.label-item label {
  margin-bottom: 0;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  font-size: 0.9rem;
}
.label-item input[type="checkbox"]:disabled + label {
  color: var(--text-tertiary);
  cursor: not-allowed;
}
.status-tag {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
  text-transform: uppercase;
  border: 1px solid transparent;
}
.status-ingested {
  background-color: rgba(16, 185, 129, 0.1);
  color: var(--success, #10b981);
  border-color: rgba(16, 185, 129, 0.3);
}
.status-pending {
  background-color: rgba(245, 158, 11, 0.1);
  color: var(--warning, #f59e0b);
  border-color: rgba(245, 158, 11, 0.3);
}
.status-retracted {
  background-color: rgba(100, 116, 139, 0.1);
  color: var(--secondary, #64748b);
  border-color: rgba(100, 116, 139, 0.3);
}
/* New Statuses */
.status-ingesting {
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--primary, #3b82f6);
  border-color: rgba(59, 130, 246, 0.3);
}
.status-error {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--danger, #ef4444);
  border-color: rgba(239, 68, 68, 0.3);
}
.status-warn {
  background-color: rgba(245, 158, 11, 0.1);
  color: var(--warning, #f59e0b);
  border-color: rgba(245, 158, 11, 0.3);
}

[data-theme="dark"] .status-ingested {
  background-color: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.5);
}
[data-theme="dark"] .status-pending,
[data-theme="dark"] .status-warn {
  background-color: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.5);
}
[data-theme="dark"] .status-retracted {
  background-color: rgba(100, 116, 139, 0.2);
  border-color: rgba(100, 116, 139, 0.5);
}
[data-theme="dark"] .status-ingesting {
  background-color: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
}
[data-theme="dark"] .status-error {
  background-color: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.file-view-link {
  color: var(--primary, #3b82f6);
  text-decoration: none;
  font-weight: 500;
  word-break: break-all;
  cursor: pointer;
  transition: color 0.2s;
}
.file-view-link:hover {
  text-decoration: underline;
  color: var(--primary-dark, #2563eb);
}
</style>
