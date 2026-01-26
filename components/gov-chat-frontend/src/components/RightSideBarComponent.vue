<template>
  <div class="sidebar" :class="{ collapsed: sidebarCollapsed }">
    <div class="sidebar-header">
      <h3 v-if="!sidebarCollapsed">{{ $t("sidebar.title") }}</h3>
      <button @click="toggleSidebar" class="sidebar-toggle">
        <i
          class="fas"
          :class="sidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'"
        ></i>
      </button>
    </div>

    <div v-if="!sidebarCollapsed">
      <div class="sidebar-section">
        <h4 class="section-title">
          <i class="fas fa-file-alt"></i>
          {{ $t("sidebar.relatedDocs") }}
        </h4>
        <div class="related-documents">
          <div
            v-for="doc in relatedDocuments"
            :key="doc.id"
            class="document-item"
          >
            <div class="document-header" @click="openDocument(doc)">
              <div class="document-icon">
                <i :class="documentIconClass(doc)"></i>
              </div>
              <div class="document-info">
                <div class="document-title">{{ doc.title }}</div>
                <div class="document-url-link">
                  {{ getDisplayUrl(doc) }}
                </div>
              </div>
            </div>
            <div class="document-details">
              <div class="detail-item" v-if="doc.documentName">
                <span class="detail-label">Document Name:</span>
                <span class="detail-value">{{ doc.documentName }}</span>
              </div>
              <div class="detail-item" v-if="doc.fileName">
                <span class="detail-label">File Name:</span>
                <span class="detail-value">{{ doc.fileName }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">{{ $t("sidebar.id") }}:</span>
                <span class="detail-value">{{ doc.id }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">{{ $t("sidebar.labels") }}:</span>
                <span class="detail-value small-text">{{
                  formatLabels(doc)
                }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label"
                  >{{ $t("sidebar.confidence") }}:</span
                >
                <span class="detail-value">{{ formatScore(doc.score) }}</span>
              </div>
            </div>
          </div>
          <div v-if="relatedDocuments.length === 0" class="empty-state">
            {{ $t("sidebar.noDocuments") }}
          </div>
        </div>
      </div>
      <div class="sidebar-section">
        <h4 class="section-title">
          <i class="fas fa-question-circle"></i>
          {{ $t("sidebar.faq") }}
        </h4>
        <div class="faq-list">
          <div
            v-for="(faq, index) in frequentlyAskedQuestions"
            :key="index"
            class="faq-item"
          >
            <div
              class="faq-question"
              @click="toggleFaq(index)"
              :class="{ active: expandedFaqs.includes(index) }"
            >
              <span v-html="faq.question"></span>
              <i
                class="fas"
                :class="
                  expandedFaqs.includes(index)
                    ? 'fa-chevron-up'
                    : 'fa-chevron-down'
                "
              ></i>
            </div>
            <div
              class="faq-answer"
              v-if="expandedFaqs.includes(index)"
              v-html="faq.answer"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import authService from "@/services/authService";
import { marked } from "marked";
import DOMPurify from "dompurify";

export default {
  name: "RightSideBarComponent",

  props: {
    currentChatId: {
      type: String,
      default: null,
    },
    currentLocale: {
      type: String,
      default: "en",
    },
    relatedDocuments: {
      type: Array,
      default: () => [],
    },
  },

  data() {
    return {
      sidebarCollapsed: false,
      expandedFaqs: [],
      frequentlyAskedQuestions: [],
    };
  },

  watch: {
    currentLocale: {
      handler() {
        this.loadFaqContent();
      },
      immediate: true,
    },
  },

  methods: {
    async loadFaqContent() {
      try {
        const response = await fetch("/FAQ.md");
        if (!response.ok) {
          throw new Error("FAQ.md not found");
        }
        let markdown = await response.text();

        if (this.currentLocale !== "en") {
          markdown = await this.translateMarkdown(markdown);
        }

        const tokens = marked.lexer(markdown);
        const faqs = [];
        let currentQuestion = null;
        let currentAnswer = "";

        tokens.forEach((token) => {
          if (token.type === "heading" && token.depth === 2) {
            if (currentQuestion) {
              faqs.push({
                question: DOMPurify.sanitize(
                  marked.parseInline(currentQuestion)
                ),
                answer: DOMPurify.sanitize(marked.parse(currentAnswer.trim())),
              });
            }
            currentQuestion = token.text;
            currentAnswer = "";
          } else if (currentQuestion) {
            currentAnswer += token.raw;
          }
        });

        if (currentQuestion) {
          faqs.push({
            question: DOMPurify.sanitize(marked.parseInline(currentQuestion)),
            answer: DOMPurify.sanitize(marked.parse(currentAnswer.trim())),
          });
        }

        this.frequentlyAskedQuestions = faqs;
      } catch (error) {
        console.error("Failed to load or parse FAQ content:", error);
        this.frequentlyAskedQuestions = [
          { question: "Error", answer: "Could not load FAQ content." },
        ];
      }
    },

    async translateMarkdown(markdown) {
      const authToken = this.getAuthToken();
      if (!authToken) {
        console.error("No auth token found, cannot translate FAQ.");
        return markdown; // Fallback to English
      }

      try {
        const response = await fetch("/api/translate/markdown", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            markdown,
            source_lang: "en",
            target_lang: this.currentLocale,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.translated_markdown;
      } catch (error) {
        console.error("Translation failed:", error);
        return markdown; // Fallback to English
      }
    },

    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      this.$emit("sidebar-toggle", this.sidebarCollapsed);
    },

    toggleFaq(index) {
      if (this.expandedFaqs.includes(index)) {
        this.expandedFaqs = this.expandedFaqs.filter((i) => i !== index);
      } else {
        this.expandedFaqs.push(index);
      }
    },

    isExternalUrl(url) {
      if (!url) return false;
      const isHttp = url.startsWith("http://") || url.startsWith("https://");
      const isPlaceholder = url.includes("<HOST>") || url.includes("<PORT>");
      // A URL is considered external only if it's a valid HTTP link AND not a placeholder.
      return isHttp && !isPlaceholder;
    },

    async openDocument(doc) {
      if (this.isExternalUrl(doc.url)) {
        console.log(`Opening external URL: ${doc.url}`);
        window.open(doc.url, "_blank");
        this.$emit("open-document", doc);
        return;
      }

      const authToken = this.getAuthToken();
      if (!authToken) {
        console.error(
          "Authentication token not found. Unable to open internal document."
        );
        return;
      }

      const fileUrl = `${window.location.origin}/api/files/${doc.id}/viewbrowser`;

      try {
        const response = await fetch(fileUrl, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Network response was not ok: ${response.statusText}`
          );
        }

        const fileBlob = await response.blob();
        const blobUrl = URL.createObjectURL(fileBlob);
        window.open(blobUrl, "_blank");

        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        this.$emit("open-document", doc);
      } catch (error) {
        console.error(
          "There was a problem fetching the internal document:",
          error
        );
      }
    },

    getAuthToken() {
      const user = authService.getCurrentUser();
      return user ? user.accessToken : null;
    },

    getDisplayUrl(doc) {
      if (!doc) return "";
      if (this.isExternalUrl(doc.url)) {
        return doc.url;
      }
      if (doc.id) {
        return `${window.location.origin}/api/files/${doc.id}/viewbrowser`;
      }
      return doc.url || ""; // Fallback to show the original placeholder if no ID
    },

    formatFileSize(bytes) {
      if (!bytes) return "0 B";
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    },

    formatScore(score) {
      if (typeof score !== "number" || isNaN(score))
        return this.$t("sidebar.unknown");
      return (score * 100).toFixed(2) + "%";
    },

    formatLabels(doc) {
      if (!doc.categoryLabel) return this.$t("sidebar.unknown");
      const services = doc.serviceLabels?.join(", ") || "";
      return `${doc.categoryLabel}${services ? ":" + services : ""}`;
    },
  },
};
</script>

<style scoped>
/* Sidebar Styles */
.sidebar {
  width: 320px;
  background: var(--bg-sidebar, #f8fafc);
  border-left: 1px solid var(--border-color, #e2e8f0);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
}

.sidebar.collapsed {
  width: 50px;
  overflow: visible;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
}

.sidebar.collapsed .sidebar-header {
  padding: 16px 0;
  justify-content: center;
  border-bottom: none;
}

.sidebar-toggle {
  background: none;
  border: none;
  color: var(--text-tertiary, #64748b);
  cursor: pointer;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
  z-index: 10;
}

.sidebar-toggle:hover {
  background: var(--bg-tertiary, #e2e8f0);
  color: var(--text-secondary, #334155);
}

.sidebar-section {
  padding: 16px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary, #475569);
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title i {
  font-size: 0.9rem;
  color: var(--text-tertiary, #64748b);
}

.related-documents {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.document-item {
  background: var(--bg-card, #fff);
  border-radius: 6px;
  padding: 12px;
  transition: all 0.2s ease;
  border: 1px solid var(--border-light, #e5e7eb);
}

.document-header {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  margin-bottom: 8px;
}

.document-header:hover {
  color: var(--accent-color, #4e97d1);
}

.document-icon {
  font-size: 1.2rem;
  color: var(--text-tertiary, #64748b);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.document-info {
  flex: 1;
  overflow: hidden;
}

.document-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary, #334155);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.document-url-link {
  font-size: 0.75rem;
  color: var(--accent-color, #4e97d1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-decoration: none;
}

.document-header:hover .document-url-link {
  text-decoration: underline;
}

.document-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--text-secondary, #475569);
  padding-top: 8px;
  border-top: 1px solid var(--border-light, #e5e7eb);
}

.detail-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.detail-label {
  font-weight: 500;
  color: var(--text-primary, #334155);
  white-space: nowrap;
}

.detail-value {
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-value.small-text {
  font-size: 0.75rem;
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.faq-item {
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 6px;
  overflow: hidden;
}

.faq-question {
  padding: 12px;
  background: var(--bg-card, #fff);
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary, #334155);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.faq-question:hover,
.faq-question.active {
  background: var(--bg-tertiary, #f0f7ff);
}

.faq-question i {
  font-size: 0.8rem;
  color: var(--text-tertiary, #64748b);
  transition: transform 0.2s;
}
.faq-question.active i {
  transform: rotate(180deg);
}

.faq-answer {
  padding: 12px;
  font-size: 0.85rem;
  color: var(--text-secondary, #475569);
  background: var(--bg-tertiary, #f8fafc);
  border-top: 1px solid var(--border-light, #e2e8f0);
  line-height: 1.5;
}

.faq-answer :deep(p:first-child) {
  margin-top: 0;
}
.faq-answer :deep(p:last-child) {
  margin-bottom: 0;
}
.faq-answer :deep(ul),
.faq-answer :deep(ol) {
  padding-left: 20px;
}

.empty-state {
  text-align: center;
  padding: 16px;
  color: var(--text-muted, #94a3b8);
  font-size: 0.9rem;
  font-style: italic;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(100%);
  }

  .sidebar.visible {
    transform: translateX(0);
  }

  .sidebar.collapsed {
    transform: translateX(calc(100% - 50px));
  }
}

[data-theme="dark"] .section-title,
html[data-theme="dark"] .section-title {
  color: rgba(255, 255, 255, 0.9) !important;
}

[data-theme="dark"] .document-title,
html[data-theme="dark"] .document-title,
[data-theme="dark"] .faq-question,
html[data-theme="dark"] .faq-question,
[data-theme="dark"] .detail-label,
html[data-theme="dark"] .detail-label {
  color: rgba(255, 255, 255, 0.9) !important;
}

[data-theme="dark"] .detail-value,
html[data-theme="dark"] .detail-value,
[data-theme="dark"] .document-meta,
html[data-theme="dark"] .document-meta {
  color: rgba(255, 255, 255, 0.7) !important;
}

[data-theme="dark"] .empty-state,
html[data-theme="dark"] .empty-state {
  color: rgba(255, 255, 255, 0.6) !important;
}

[data-theme="dark"] .sidebar-header h3,
html[data-theme="dark"] .sidebar-header h3 {
  color: rgba(255, 255, 255, 0.9) !important;
}
</style>