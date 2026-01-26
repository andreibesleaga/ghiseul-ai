<template>
  <div v-if="visible" class="feedback-dialog">
    <div class="overlay" @click="closeDialog"></div>
    <div class="dialog-content">
      <!-- Two-column layout for more compact appearance -->
      <div class="dialog-header">
        <h4>{{ $t("responseRating.title") }}</h4>
        <p class="note">
          {{ $t("responseRating.note") }}
        </p>
      </div>

      <div class="dialog-layout">
        <!-- Left column -->
        <div class="dialog-column">
          <div class="message-preview">
            <strong>{{ $t("responseRating.chatbotResponse") }}</strong>
            <div class="message-text">{{ message?.content }}</div>
          </div>

          <!-- Thumbs up/down options with SVG icons and skin tone -->
          <div class="thumbs-container">
            <button
              @click="selectThumbFeedback('up')"
              class="thumb-button"
              :class="{ selected: thumbFeedback === 'up' }"
              :aria-label="$t('feedback.positive')"
            >
              <!-- SVG Thumbs Up with skin tone fill -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="thumb-icon"
              >
                <path d="M7 10v12" stroke-width="2" fill="none"></path>
                <path
                  d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"
                  :fill="thumbFeedback === 'up' ? skinToneColor : 'none'"
                ></path>
              </svg>
              <span class="thumb-label">{{ $t("feedback.positive") }}</span>
            </button>

            <button
              @click="selectThumbFeedback('down')"
              class="thumb-button"
              :class="{ selected: thumbFeedback === 'down' }"
              :aria-label="$t('feedback.negative')"
            >
              <!-- SVG Thumbs Down with skin tone fill -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="thumb-icon"
              >
                <path d="M17 14V2" stroke-width="2" fill="none"></path>
                <path
                  d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"
                  :fill="thumbFeedback === 'down' ? skinToneColor : 'none'"
                ></path>
              </svg>
              <span class="thumb-label">{{ $t("feedback.negative") }}</span>
            </button>
          </div>

          <!-- Skin tone selector (more compact) -->
          <div class="skin-tone-selector">
            <div class="skin-tone-options">
              <button
                v-for="(color, index) in skinTones"
                :key="index"
                class="skin-tone-button"
                :class="{ selected: skinToneColor === color }"
                :style="{ backgroundColor: color }"
                @click="skinToneColor = color"
                :aria-label="`Skin tone ${index + 1}`"
              ></button>
            </div>
          </div>
        </div>

        <!-- Right column -->
        <div class="dialog-column">
          <!-- Rating scale section -->
          <p class="rating-title">{{ $t("feedback.promptText") }}</p>
          <div class="rating-group">
            <label
              v-for="rating in 5"
              :key="rating"
              class="rating-option"
              :class="{ selected: selectedRating === rating }"
            >
              <input
                type="radio"
                :value="rating"
                v-model="selectedRating"
                :aria-label="getRatingLabel(rating)"
              />
              <span class="rating-number">{{ rating }}</span>
              <span class="rating-label">{{ getRatingLabel(rating) }}</span>
            </label>
          </div>

          <textarea
            class="feedback-text"
            v-model="feedbackText"
            rows="3"
            :placeholder="$t('responseRating.additionalComments')"
          ></textarea>
        </div>
      </div>

      <div class="actions">
        <button
          class="submit-btn"
          @click="submitFeedback"
          :disabled="!(selectedRating || thumbFeedback)"
        >
          {{ $t("responseRating.submit") }}
        </button>
        <button class="cancel-btn" @click="closeDialog">
          {{ $t("responseRating.cancel") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "ChatResponseFeedbackDialog",
  props: {
    visible: { type: Boolean, default: false },
    message: { type: Object, default: null },
  },
  data() {
    return {
      selectedRating: null,
      thumbFeedback: null,
      feedbackText: "",
      skinToneColor: "#FFCBA4", // Default skin tone
      skinTones: [
        "#FFDBAC", // Light skin tone
        "#F1C27D", // Medium-light skin tone
        "#E0AC69", // Medium skin tone
        "#C68642", // Medium-dark skin tone
        "#8D5524", // Dark skin tone
      ],
    };
  },
  methods: {
    closeDialog() {
      this.selectedRating = null;
      this.thumbFeedback = null;
      this.feedbackText = "";
      this.$emit("close");
    },
    selectThumbFeedback(type) {
      this.thumbFeedback = type;

      // Auto-set rating based on thumb selection (optional)
      if (type === "up") {
        this.selectedRating = 4; // Default "up" to a 4 rating
      } else if (type === "down") {
        this.selectedRating = 2; // Default "down" to a 2 rating
      }
    },
    submitFeedback() {
      // Validate that either a rating or thumb feedback is selected
      if (!this.selectedRating && !this.thumbFeedback) return;

      this.$emit("submit", {
        rating: this.selectedRating,
        thumbFeedback: this.thumbFeedback,
        skinTone: this.skinToneColor,
        text: this.feedbackText,
        message: this.message,
      });

      this.closeDialog();
    },
    getRatingLabel(rating) {
      // Directly access translation data to avoid missing translation issues
      try {
        const locale = this.$i18n.locale;
        const label =
          this.$i18n.messages[locale]?.responseRating?.ratingLabels[rating];
        return label || `Rating ${rating}`;
      } catch (err) {
        console.error("Error getting rating label:", err);
        return `Rating ${rating}`;
      }
    },
  },
  // Focus management for accessibility
  mounted() {
    // Handle escape key press
    this.escHandler = (e) => {
      if (e.key === "Escape" && this.visible) {
        this.closeDialog();
      }
    };
    document.addEventListener("keydown", this.escHandler);

    // Focus the first thumbs button when dialog opens
    this.$nextTick(() => {
      if (this.visible) {
        const firstButton = this.$el.querySelector(".thumb-button");
        if (firstButton) firstButton.focus();
      }
    });
  },
  beforeDestroy() {
    document.removeEventListener("keydown", this.escHandler);
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        // Reset state when dialog is opened
        this.selectedRating = null;
        this.thumbFeedback = null;
        this.feedbackText = "";

        // Focus management
        this.$nextTick(() => {
          const firstButton = this.$el.querySelector(".thumb-button");
          if (firstButton) firstButton.focus();
        });
      }
    },
  },
};
</script>

<style scoped>
/* Theme variables */
:root {
  --bg-button-primary-hover: #3a7da0; /* Fallback, overridden by config */
  --bg-button-primary-disabled: #b3d1f5; /* Fallback */
}
[data-theme="dark"] {
  --bg-button-primary-hover: #3a7da0;
  --bg-button-primary-disabled: #b3d1f5;
}

/* Dialog container */
.feedback-dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: dialogFadeIn 0.2s ease-out;
}

.overlay {
  position: absolute;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.dialog-content {
  position: relative;
  background: var(--bg-dialog);
  width: 700px;
  max-width: 90%;
  max-height: 90vh;
  margin: 0 auto;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  overflow-y: auto;
}

.dialog-header {
  margin-bottom: 16px;
}

h4 {
  margin: 0 0 8px;
  font-size: 20px;
  color: var(--text-primary);
  text-align: center;
}
[data-theme="dark"] .dialog-header h4 {
  color: var(--text-primary) !important;
}

.note {
  font-size: 0.85rem;
  margin-bottom: 0;
  color: var(--text-secondary);
  text-align: center;
}
[data-theme="dark"] .note {
  color: var(--text-secondary);
}

/* Two-column layout */
.dialog-layout {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
}

.dialog-column {
  flex: 1;
  min-width: 0;
}

.message-preview {
  margin-bottom: 12px;
}

.message-text {
  background: #f7f7f7;
  padding: 10px;
  border-radius: 12px;
  margin-top: 4px;
  max-height: 120px;
  overflow-y: auto;
  font-size: 0.9rem;
  color: #444;
  border-left: 3px solid #e0e0e0;
}
[data-theme="dark"] .message-text {
  background: var(--bg-input);
  border-left-color: var(--border-color);
  color: var(--text-primary);
}

/* Thumbs up/down section */
.thumbs-container {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.thumb-button {
  background: #f5f9ff;
  border: 2px solid #e0e0e0;
  border-radius: 14px;
  padding: 8px;
  flex: 1;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
}
[data-theme="dark"] .thumb-button {
  background: var(--bg-section);
  border-color: var(--border-color);
}

.thumb-button .thumb-icon {
  margin-bottom: 4px;
  color: #555;
  transition: all 0.2s ease;
}
[data-theme="dark"] .thumb-button .thumb-icon {
  color: var(--text-secondary);
}

.thumb-button .thumb-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.thumb-button:hover {
  border-color: #bbbbbb;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.thumb-button.selected {
  border-color: var(--bg-button-primary);
  background-color: rgba(74, 144, 226, 0.1);
}
[data-theme="dark"] .thumb-button.selected {
  background: rgba(59, 130, 246, 0.1);
}

.thumb-button.selected .thumb-icon {
  color: var(--bg-button-primary);
}

.thumb-button.selected .thumb-label {
  color: var(--text-secondary);
}
[data-theme="dark"] .thumb-button.selected .thumb-label {
  color: var(--text-secondary);
}

/* Skin tone selector */
.skin-tone-selector {
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
}

.skin-tone-options {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.skin-tone-button {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.2s ease;
}
[data-theme="dark"] .skin-tone-button {
  border-color: var(--border-color);
}

.skin-tone-button:hover {
  transform: scale(1.1);
}

.skin-tone-button.selected {
  border-color: var(--bg-button-primary);
  transform: scale(1.1);
  box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.3);
}

/* Rating section */
.rating-title {
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0 0 8px;
}
[data-theme="dark"] .rating-title {
  color: var(--text-secondary);
}

.rating-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
  gap: 6px;
}

.rating-option {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}
[data-theme="dark"] .rating-option {
  border-color: var(--border-color);
}

.rating-option:hover {
  background-color: #f5f5f5;
  border-color: #d0d0d0;
}
[data-theme="dark"] .rating-option:hover {
  background: var(--bg-section);
  border-color: var(--border-color);
}

.rating-option.selected {
  background-color: #f0f7ff;
  border-color: var(--bg-button-primary);
}
[data-theme="dark"] .rating-option.selected {
  background: rgba(59, 130, 246, 0.1);
}

.rating-option input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.rating-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: #e8e8e8;
  border-radius: 50%;
  margin-right: 10px;
  font-weight: bold;
  color: #555;
  transition: all 0.2s ease;
}
[data-theme="dark"] .rating-number {
  background: var(--bg-section);
  color: var(--text-secondary);
}

.rating-option.selected .rating-number {
  background: var(--bg-button-primary);
  color: var(--text-button-primary);
}

.rating-label {
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
[data-theme="dark"] .rating-option.selected .rating-label {
  color: var(--text-secondary);
}

.feedback-text {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: 10px;
  font-size: 0.9rem;
  height: 80px;
  resize: vertical;
  font-family: inherit;
}
[data-theme="dark"] .feedback-text {
  background: var(--bg-input);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.feedback-text:focus {
  outline: none;
  border-color: var(--bg-button-primary);
}

/* Actions */
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.submit-btn,
.cancel-btn {
  padding: 10px 16px;
  border: none;
  cursor: pointer;
  border-radius: 10px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.submit-btn {
  background-color: var(--bg-button-primary);
  color: var(--text-button-primary);
  min-width: 100px;
}
.submit-btn:hover:not(:disabled) {
  background-color: var(--bg-button-primary-hover);
}
.submit-btn:disabled {
  background-color: var(--bg-button-primary-disabled);
  cursor: not-allowed;
}

.cancel-btn {
  background: #f0f0f0;
  color: #555;
}
[data-theme="dark"] .cancel-btn {
  background: var(--bg-section);
  color: var(--text-secondary);
}
.cancel-btn:hover {
  background: #e0e0e0;
}
[data-theme="dark"] .cancel-btn:hover {
  background: var(--bg-button-secondary);
}

/* Responsive adjustments */
@media (max-width: 700px) {
  .dialog-layout {
    flex-direction: column;
    gap: 16px;
  }

  .dialog-content {
    padding: 16px;
    max-height: 90vh;
  }

  h4 {
    font-size: 18px;
    margin-bottom: 8px;
  }

  .thumbs-container {
    flex-direction: row;
  }

  .thumb-button {
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    padding: 8px 12px;
  }

  .thumb-button .thumb-icon {
    margin-right: 8px;
    margin-bottom: 0;
  }

  .feedback-text {
    height: 60px;
  }
}

@keyframes dialogFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
