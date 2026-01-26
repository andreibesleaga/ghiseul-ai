<!-- src/components/EmailVerificationScreen.vue -->
<template>
  <div class="verify-container" :data-theme="theme">
    <div class="verify-card">
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
            $config && $config.app ? $config.app.title : $t("register.appTitle")
          }}
        </h1>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>{{ $t("verification.verifying") }}</p>
      </div>

      <template v-else-if="isVerified">
        <div class="success-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <h2 class="heading">{{ $t("verification.success") }}</h2>
        <p class="message">{{ $t("verification.accountVerified") }}</p>
        <div class="actions">
          <button class="primary-button" @click="$router.push('/login')">
            {{ $t("verification.proceedToLogin") }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="error-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <h2 class="heading">{{ $t("verification.failed") }}</h2>
        <p class="message">
          {{ errorMessage || $t("verification.invalidLink") }}
        </p>
        <div class="actions">
          <button class="primary-button" @click="$router.push('/login')">
            {{ $t("verification.backToLogin") }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import authService from "@//services/authService";

export default {
  name: "EmailVerificationScreen",
  props: {
    token: {
      type: String,
      required: true,
    },
    theme: {
      type: String,
      default: "light",
    },
    verificationStatus: {
      type: String,
      default: null,
    },
    errorType: {
      type: String,
      default: null,
    },
  },
  data() {
    return {
      isLoading: true,
      isVerified: false,
      errorMessage: "",
      verificationAttempted: false,
    };
  },
  created() {
    document.documentElement.setAttribute("data-theme", this.theme);
    this.ensureViewportMeta();
    if (this.$i18n) {
      console.log("[VERIFY] Current locale:", this.$i18n.locale);
      console.log(
        "[VERIFY] Verifying translation:",
        this.$t("verification.verifying")
      );
    }
    if (this.verificationStatus) {
      this.handleVerificationStatus();
    } else {
      this.verifyEmail();
    }
  },
  mounted() {
    this.setMobileHeight();
    window.addEventListener("resize", this.setMobileHeight);
    this.applyTheme();
    this.observeThemeChanges();
    // Debug: Log computed styles and configuration values
    const title = document.querySelector(".verify-card .app-name");
    console.log(
      "[VERIFY] Title text content:",
      title ? title.textContent : "not found"
    );
    console.log(
      "[VERIFY] Title computed color:",
      title ? window.getComputedStyle(title).color : "not found"
    );
    const subtitle = document.querySelector(".heading");
    console.log(
      "[VERIFY] Subtitle computed color:",
      subtitle ? window.getComputedStyle(subtitle).color : "not found"
    );
    const icon = document.querySelector(".app-logo");
    console.log(
      "[VERIFY] Icon source:",
      icon ? icon.querySelector("img")?.src : "fallback"
    );
    console.log(
      "[VERIFY] Icon computed background color:",
      icon ? window.getComputedStyle(icon).backgroundColor : "not found"
    );
    const primaryButton = document.querySelector(".primary-button");
    console.log(
      "[VERIFY] Primary button computed background color:",
      primaryButton
        ? window.getComputedStyle(primaryButton).backgroundColor
        : "not found"
    );
    const message = document.querySelector(".message");
    console.log(
      "[VERIFY] Message computed color:",
      message ? window.getComputedStyle(message).color : "not found"
    );
    const loadingText = document.querySelector(".loading-state p");
    console.log(
      "[VERIFY] Loading text computed color:",
      loadingText ? window.getComputedStyle(loadingText).color : "not found"
    );
    const spinner = document.querySelector(".spinner");
    console.log(
      "[VERIFY] Spinner computed border-top color:",
      spinner ? window.getComputedStyle(spinner).borderTopColor : "not found"
    );
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.setMobileHeight);
    if (this.themeObserver) {
      console.log("[VERIFY] Disconnecting MutationObserver");
      this.themeObserver.disconnect();
    }
  },
  watch: {
    theme(newTheme) {
      console.log(
        "[VERIFY] Theme prop updated:",
        newTheme,
        "source: prop change",
        new Date().toISOString()
      );
      this.applyTheme();
    },
  },
  methods: {
    setMobileHeight() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    },
    ensureViewportMeta() {
      if (!document.querySelector('meta[name="viewport"]')) {
        const meta = document.createElement("meta");
        meta.name = "viewport";
        meta.content =
          "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";
        document.getElementsByTagName("head")[0].appendChild(meta);
      }
    },
    handleVerificationStatus() {
      this.isLoading = false;
      if (this.verificationStatus === "success") {
        this.isVerified = true;
      } else if (this.verificationStatus === "error") {
        this.isVerified = false;
        if (this.errorType === "used") {
          this.errorMessage = this.$t("verification.alreadyUsed");
        } else if (this.errorType === "expired") {
          this.errorMessage = this.$t("verification.expired");
        } else {
          this.errorMessage = this.$t("verification.invalidLink");
        }
      }
    },
    async verifyEmail() {
      if (!this.token || this.verificationAttempted) {
        this.isLoading = false;
        if (!this.token) {
          this.errorMessage = this.$t("verification.missingToken");
        }
        return;
      }
      this.verificationAttempted = true;
      try {
        await authService.verifyEmail(this.token);
        this.isVerified = true;
      } catch (error) {
        console.error("[VERIFY] Email verification error:", error);
        if (
          error.response &&
          error.response.data &&
          error.response.data.message
        ) {
          this.errorMessage = error.response.data.message;
        } else {
          this.errorMessage = this.$t("verification.generalError");
        }
      } finally {
        this.isLoading = false;
      }
    },
    applyTheme() {
      console.log(
        "[VERIFY] Applying theme:",
        this.theme,
        new Date().toISOString()
      );
      const currentTheme = document.documentElement.getAttribute("data-theme");
      if (currentTheme !== this.theme) {
        console.warn(
          "[VERIFY] Theme mismatch: component theme=",
          this.theme,
          "vs DOM theme=",
          currentTheme
        );
      }
      document.documentElement.setAttribute("data-theme", this.theme);
      const title = document.querySelector(".verify-card .app-name");
      console.log(
        "[VERIFY] Title computed color after apply:",
        title ? window.getComputedStyle(title).color : "not found"
      );
      const subtitle = document.querySelector(".heading");
      console.log(
        "[VERIFY] Subtitle computed color after apply:",
        subtitle ? window.getComputedStyle(subtitle).color : "not found"
      );
    },
    observeThemeChanges() {
      console.log(
        "[VERIFY] Setting up MutationObserver, initial theme:",
        this.theme,
        new Date().toISOString()
      );
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === "data-theme") {
            const newTheme =
              document.documentElement.getAttribute("data-theme");
            console.log(
              "[VERIFY] Detected theme change via MutationObserver:",
              newTheme,
              new Date().toISOString()
            );
            if (newTheme !== this.theme) {
              console.log("[VERIFY] Updating component theme to:", newTheme);
              this.theme = newTheme;
              const title = document.querySelector(".verify-card .app-name");
              console.log(
                "[VERIFY] Title computed color after change:",
                title ? window.getComputedStyle(title).color : "not found"
              );
              const subtitle = document.querySelector(".heading");
              console.log(
                "[VERIFY] Subtitle computed color after change:",
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
.verify-container {
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

[data-theme="light"] .verify-container {
  background-color: var(--bg-primary, #f5f7fa);
}

[data-theme="dark"] .verify-container {
  background-color: var(--bg-primary, #1e1e1e);
}

.verify-card {
  width: 100%;
  max-width: 400px;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  padding: 24px;
  text-align: center;
}

[data-theme="light"] .verify-card {
  background-color: var(--bg-secondary, #ffffff);
  color: var(--text-primary, #333333);
}

[data-theme="dark"] .verify-card {
  background-color: var(--bg-secondary, #252525);
  color: var(--text-primary, #f0f0f0);
}

.logo {
  text-align: center;
  margin-bottom: 20px;
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

[data-theme="light"] .verify-card .app-name {
  color: #000000 !important;
}

[data-theme="dark"] .verify-card .app-name {
  color: var(--text-primary, #f0f0f0) !important;
}

.loading-state {
  margin: 30px 0;
  text-align: center;
}

[data-theme="light"] .loading-state p {
  color: var(--text-primary, #333333);
}

[data-theme="dark"] .loading-state p {
  color: var(--text-primary, #f0f0f0);
}

.spinner {
  display: inline-block;
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: var(--bg-button-primary, #2a9d8f);
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.success-icon {
  color: #10b981;
  margin: 24px 0 16px;
}

.error-icon {
  color: #ef4444;
  margin: 24px 0 16px;
}

.heading {
  font-size: 22px;
  margin-bottom: 16px;
  font-weight: 500;
}

[data-theme="light"] .verify-card .heading {
  color: var(--text-secondary, #4d4d4d) !important;
}

[data-theme="dark"] .verify-card .heading {
  color: var(--text-secondary, #b3b3b3) !important;
}

.message {
  margin-bottom: 12px;
  font-size: 16px;
}

[data-theme="light"] .message {
  color: var(--text-primary, #333333);
}

[data-theme="dark"] .message {
  color: var(--text-primary, #f0f0f0);
}

.actions {
  margin: 24px 0;
}

.primary-button {
  background-color: var(--bg-button-primary, #2a9d8f);
  color: var(--text-button-primary, #ffffff);
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

[data-theme="dark"] .primary-button {
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.primary-button:hover {
  background-color: var(--bg-button-primary-hover, #24887d);
}

@media (max-width: 480px) {
  .verify-card {
    padding: 20px 16px;
  }
}
</style>