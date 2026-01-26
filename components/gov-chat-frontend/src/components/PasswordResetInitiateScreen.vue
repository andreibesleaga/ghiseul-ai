<!-- src/components/PasswordResetInitiateScreen.vue -->
<template>
  <div
    class="password-reset-initiate-container"
    :class="{ embedded: isEmbedded }"
    :data-theme="theme"
  >
    <div class="password-reset-initiate-card">
      <div class="logo">
        <div class="app-logo">
          <img
            :src="$config.app.icon.value"
            alt="App Icon"
            class="ui-icon"
            v-if="
              $config &&
              $config.app &&
              $config.app.icon &&
              $config.app.icon.type === 'file'
            "
          />
          <div class="app-logo-fallback" v-else></div>
        </div>
        <h1 class="app-name">
          {{
            $config && $config.app
              ? $config.app.title
              : $t("passwordReset.appTitle")
          }}
        </h1>
      </div>

      <h2 class="password-reset-initiate-heading">
        {{ $t("passwordReset.resetPassword") }}
      </h2>

      <!-- Success message after submitting email -->
      <div v-if="resetRequested" class="success-message">
        <p>{{ $t("passwordReset.resetRequestSuccess") }}</p>
        <p>
          {{
            $t(
              "passwordReset.checkEmail",
              "Please check your email for further instructions."
            )
          }}
        </p>
      </div>

      <!-- Email Form -->
      <form
        v-else
        @submit.prevent="handleInitiateReset"
        class="password-reset-initiate-form"
      >
        <!-- Force email label to always be visible by setting display -->
        <div class="form-group">
          <label for="email" class="form-label" style="display: block">
            {{ $t("passwordReset.emailLabel") }}
          </label>
          <input
            v-model="email"
            type="email"
            id="email"
            :placeholder="$t('passwordReset.emailPlaceholder')"
            class="form-control"
            required
            @focus="emailError = ''"
          />
          <p v-if="emailError" class="error-message">{{ emailError }}</p>
        </div>

        <button
          type="submit"
          class="reset-initiate-button"
          :disabled="isSubmitting || !isValidEmail"
        >
          <span v-if="isSubmitting" class="button-spinner"></span>
          {{
            isSubmitting
              ? $t("passwordReset.processing")
              : $t("passwordReset.resetButton")
          }}
        </button>
      </form>

      <div class="login-link">
        <p>
          {{ $t("passwordReset.rememberPassword") }}
          <router-link to="/login" class="login-link-text">
            {{ $t("passwordReset.backToLogin") }}
          </router-link>
        </p>
      </div>

      <div class="password-reset-initiate-footer">
        <p class="support-message">{{ $t("passwordReset.supportMessage") }}</p>
        <div class="language-selector">
          <language-selector />
        </div>
      </div>

      <!-- Cancel button for embedded mode -->
      <div v-if="isEmbedded" class="modal-footer">
        <button class="cancel-button" @click="cancelReset">
          {{ $t("common.cancel") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import passwordService from "@/services/passwordService";
import userService from "@/services/userService";
import LanguageSelector from "@/components/LanguageSelector.vue";

export default {
  name: "PasswordResetInitiateScreen",
  components: {
    LanguageSelector,
  },
  props: {
    isEmbedded: {
      type: Boolean,
      default: false,
    },
    prefilledEmail: {
      type: String,
      default: "",
    },
    theme: {
      type: String,
      default: "light",
    },
  },
  data() {
    return {
      email: this.prefilledEmail || "",
      emailError: "",
      isSubmitting: false,
      resetRequested: false,
    };
  },
  computed: {
    isValidEmail() {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(this.email);
    },
  },
  created() {
    this.setCurrentUserEmail();
    document.documentElement.setAttribute("data-theme", this.theme);
    this.error = "";
    if (this.$route.query.error) {
      this.error = this.$route.query.error;
    }
    if (this.$i18n) {
      console.log("[RESET] Current locale:", this.$i18n.locale);
      console.log(
        "[RESET] Email label translation:",
        this.$t("passwordReset.emailLabel")
      );
    }
  },
  mounted() {
    this.setMobileHeight();
    window.addEventListener("resize", this.setMobileHeight);
    this.applyTheme();
    this.observeThemeChanges();
    // Debug: Log computed styles and configuration values
    const title = document.querySelector(
      ".password-reset-initiate-card .app-name"
    );
    console.log(
      "[RESET] Title text content:",
      title ? title.textContent : "not found"
    );
    console.log(
      "[RESET] Title computed color:",
      title ? window.getComputedStyle(title).color : "not found"
    );
    const subtitle = document.querySelector(".password-reset-initiate-heading");
    console.log(
      "[RESET] Subtitle computed color:",
      subtitle ? window.getComputedStyle(subtitle).color : "not found"
    );
    const icon = document.querySelector(".app-logo");
    console.log(
      "[RESET] Icon source:",
      icon ? icon.querySelector("img")?.src : "fallback"
    );
    console.log(
      "[RESET] Icon computed background color:",
      icon ? window.getComputedStyle(icon).backgroundColor : "not found"
    );
    const button = document.querySelector(".reset-initiate-button");
    console.log(
      "[RESET] Button computed background color:",
      button ? window.getComputedStyle(button).backgroundColor : "not found"
    );
    const formField = document.querySelector(".form-control");
    console.log(
      "[RESET] Form field computed background color:",
      formField
        ? window.getComputedStyle(formField).backgroundColor
        : "not found"
    );
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.setMobileHeight);
    if (this.themeObserver) {
      console.log("[RESET] Disconnecting MutationObserver");
      this.themeObserver.disconnect();
    }
  },
  watch: {
    theme(newTheme) {
      console.log(
        "[RESET] Theme prop updated:",
        newTheme,
        "source: prop change",
        new Date().toISOString()
      );
      this.applyTheme();
    },
  },
  methods: {
    setCurrentUserEmail() {
      if (!this.email && this.isEmbedded) {
        try {
          const currentUser = userService.getCurrentUserInfo();
          if (currentUser && currentUser.email) {
            this.email = currentUser.email;
          }
        } catch (error) {
          console.warn("[RESET] Could not fetch current user email:", error);
        }
      }
    },
    async handleInitiateReset() {
      this.emailError = "";
      if (!this.isValidEmail) {
        this.emailError = this.$t("passwordReset.invalidEmail");
        return;
      }
      this.isSubmitting = true;
      try {
        const response = await passwordService.initiateReset(this.email);
        console.log("[RESET] Password reset initiated successfully");
        this.resetRequested = true;
        if (this.isEmbedded) {
          setTimeout(() => {
            this.$emit("reset-initiated", this.email);
          }, 2000);
        }
      } catch (error) {
        console.error("[RESET] Password reset initiation failed:", error);
        this.resetRequested = true;
        if (this.isEmbedded) {
          setTimeout(() => {
            this.$emit("reset-initiated", this.email);
          }, 2000);
        }
      } finally {
        this.isSubmitting = false;
      }
    },
    cancelReset() {
      this.$emit("cancel");
    },
    setMobileHeight() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    },
    applyTheme() {
      console.log(
        "[RESET] Applying theme:",
        this.theme,
        new Date().toISOString()
      );
      const currentTheme = document.documentElement.getAttribute("data-theme");
      if (currentTheme !== this.theme) {
        console.warn(
          "[RESET] Theme mismatch: component theme=",
          this.theme,
          "vs DOM theme=",
          currentTheme
        );
      }
      document.documentElement.setAttribute("data-theme", this.theme);
      const title = document.querySelector(
        ".password-reset-initiate-card .app-name"
      );
      console.log(
        "[RESET] Title computed color after apply:",
        title ? window.getComputedStyle(title).color : "not found"
      );
      const subtitle = document.querySelector(
        ".password-reset-initiate-heading"
      );
      console.log(
        "[RESET] Subtitle computed color after apply:",
        subtitle ? window.getComputedStyle(subtitle).color : "not found"
      );
    },
    observeThemeChanges() {
      console.log(
        "[RESET] Setting up MutationObserver, initial theme:",
        this.theme,
        new Date().toISOString()
      );
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === "data-theme") {
            const newTheme =
              document.documentElement.getAttribute("data-theme");
            console.log(
              "[RESET] Detected theme change via MutationObserver:",
              newTheme,
              new Date().toISOString()
            );
            if (newTheme !== this.theme) {
              console.log("[RESET] Updating component theme to:", newTheme);
              this.theme = newTheme;
              const title = document.querySelector(
                ".password-reset-initiate-card .app-name"
              );
              console.log(
                "[RESET] Title computed color after change:",
                title ? window.getComputedStyle(title).color : "not found"
              );
              const subtitle = document.querySelector(
                ".password-reset-initiate-heading"
              );
              console.log(
                "[RESET] Subtitle computed color after change:",
                subtitle ? window.getComputedStyle(subtitle).color : "not found"
              );
            }
          }
        });
      });
      observer.observe(document.documentElement, { attributes: true });
      this.themeObserver = observer;
    },
  },
};
</script>

<style scoped>
.password-reset-initiate-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  padding: 16px;
  padding-top: env(safe-area-inset-top, 16px);
  padding-bottom: env(safe-area-inset-bottom, 16px);
  box-sizing: border-box;
}

[data-theme="light"] .password-reset-initiate-container {
  background-color: var(--bg-primary, #f5f7fa);
}

[data-theme="dark"] .password-reset-initiate-container {
  background-color: var(--bg-primary, #1e1e1e);
}

.password-reset-initiate-container.embedded {
  background-color: transparent;
  min-height: auto;
  max-height: none;
  padding: 0;
  margin: 0;
  width: 100%;
  height: 100%;
}

.password-reset-initiate-card {
  width: 100%;
  max-width: 400px;
  max-height: 95vh;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  padding: 24px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

[data-theme="light"] .password-reset-initiate-card {
  background-color: var(--bg-secondary, #ffffff);
  color: var(--text-primary, #333333);
}

[data-theme="dark"] .password-reset-initiate-card {
  background-color: var(--bg-secondary, #252525);
  color: var(--text-primary, #f0f0f0);
}

.embedded .password-reset-initiate-card {
  max-height: none;
  box-shadow: none;
}

.logo {
  text-align: center;
  margin-bottom: 16px;
}

.app-logo {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: var(--bg-button-primary, #2a9d8f);
  margin-bottom: 10px;
}

.app-logo:has(.ui-icon) {
  background-color: transparent;
}

.ui-icon {
  width: 60px;
  height: 60px;
  display: block;
  margin: 0 auto;
}

.app-logo-fallback {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: var(--bg-button-primary, #2a9d8f);
}

.app-name {
  font-size: 28px;
  margin: 0;
  font-weight: bold;
}

[data-theme="light"] .password-reset-initiate-card .app-name {
  color: #000000 !important;
}

[data-theme="dark"] .password-reset-initiate-card .app-name {
  color: var(--text-primary, #f0f0f0) !important;
}

.password-reset-initiate-heading {
  text-align: center;
  font-size: 18px;
  margin-top: 0;
  margin-bottom: 20px;
  font-weight: 500;
}

[data-theme="light"]
  .password-reset-initiate-card
  .password-reset-initiate-heading {
  color: var(--text-secondary, #4d4d4d) !important;
}

[data-theme="dark"]
  .password-reset-initiate-card
  .password-reset-initiate-heading {
  color: var(--text-secondary, #b3b3b3) !important;
}

.password-reset-initiate-form {
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 14px;
}

.form-label {
  display: block !important;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
}

[data-theme="light"] .form-label {
  color: var(--text-primary, #333333) !important;
}

[data-theme="dark"] .form-label {
  color: var(--text-primary, #f0f0f0) !important;
}

.form-control {
  width: 100%;
  padding: 12px;
  font-size: 15px;
  border: none;
  border-radius: 8px;
  transition: background-color 0.2s, box-shadow 0.2s;
}

[data-theme="light"] .form-control {
  background-color: var(--bg-tertiary, #f0f2f5) !important;
  color: var(--text-primary, #333333) !important;
}

[data-theme="dark"] .form-control {
  background-color: var(--bg-input, #333333) !important;
  color: var(--text-primary, #f0f0f0) !important;
}

.form-control:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg-button-primary, #2a9d8f);
}

[data-theme="light"] .form-control:focus {
  background-color: var(--bg-primary, #f5f7fa) !important;
}

[data-theme="dark"] .form-control:focus {
  background-color: var(--bg-input, #2a2a2a) !important;
}

.reset-initiate-button {
  width: 100%;
  padding: 12px;
  background-color: var(--bg-button-primary, #2a9d8f);
  color: var(--text-button-primary, #ffffff);
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
  margin-top: 8px;
}

[data-theme="dark"] .reset-initiate-button {
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.reset-initiate-button:hover:not(:disabled) {
  background-color: var(--bg-button-primary-hover, #24887d);
}

.reset-initiate-button:disabled {
  background-color: var(--bg-button-primary, #2a9d8f);
  cursor: not-allowed;
  opacity: 0.7;
}

.button-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s infinite linear;
  margin-right: 8px;
  vertical-align: middle;
}

.error-message {
  color: #ff6b6b;
  font-size: 12px;
  margin-top: 4px;
  margin-bottom: 0;
}

.success-message {
  background-color: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  margin-bottom: 16px;
}

.success-message p {
  margin: 8px 0;
  color: #4ade80;
}

.login-link {
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
}

[data-theme="light"] .login-link {
  color: var(--text-secondary, #4d4d4d);
}

[data-theme="dark"] .login-link {
  color: var(--text-secondary, #b3b3b3);
}

.login-link-text {
  color: var(--bg-button-primary, #2a9d8f);
  text-decoration: none;
  cursor: pointer;
  font-weight: 500;
}

.login-link-text:hover {
  text-decoration: underline;
}

.password-reset-initiate-footer {
  margin-top: auto;
  padding-top: 10px;
  text-align: center;
  font-size: 11px;
}

.support-message {
  margin-bottom: 10px;
}

[data-theme="light"] .support-message {
  color: var(--text-muted, #6c757d);
}

[data-theme="dark"] .support-message {
  color: var(--text-muted, #9ca3af);
}

.language-selector {
  margin-top: 8px;
}

.language-selector :deep(select) {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 14px;
  padding-right: 28px;
  cursor: pointer;
}

[data-theme="light"] .language-selector :deep(select) {
  background-color: var(--bg-input, #ffffff);
  color: var(--text-primary, #333333);
  border: 1px solid var(--border-input, #dcdfe4);
}

[data-theme="dark"] .language-selector :deep(select) {
  background-color: var(--bg-input, #333333);
  color: var(--text-primary, #f0f0f0);
  border: 1px solid var(--border-input, #3a3a3a);
}

.language-selector :deep(select:focus) {
  outline: none;
  border-color: var(--bg-button-primary, #2a9d8f);
}

.modal-footer {
  text-align: center;
  margin-top: 16px;
}

.cancel-button {
  padding: 8px 16px;
  background-color: transparent;
  color: #4e97d1;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid #4e97d1;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.cancel-button:hover {
  background-color: rgba(78, 151, 209, 0.1);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 480px) {
  .password-reset-initiate-card {
    padding: 20px 16px;
    max-height: 92vh;
  }

  .embedded .password-reset-initiate-card {
    max-height: none;
  }
}
</style>