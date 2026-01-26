<!-- src/components/RegistrationSuccessScreen.vue -->
<template>
  <div class="registration-success-container" :data-theme="theme">
    <div class="registration-success-card">
      <div class="logo">
        <div class="app-logo">
          <img
            :src="$config.app.icon.value"
            alt="Logo"
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
            $config && $config.app ? $config.app.title : $t("register.title")
          }}
        </h1>
      </div>

      <div class="success-indicator">
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
          <path d="M22 11.2V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>

      <h2 class="heading">{{ $t("register.registrationSuccess") }}</h2>

      <p class="message">
        {{ $t("register.verificationEmailSent", { email: email }) }}
      </p>
      <p class="sub-message">{{ $t("register.checkEmailInstructions") }}</p>

      <div class="actions">
        <button class="primary-button" @click="$router.push('/login')">
          {{ $t("register.backToLogin") }}
        </button>
      </div>

      <div class="footer">
        <p>{{ $t("register.noEmailReceived") }}</p>
        <button
          class="text-button"
          @click="resendVerification"
          :disabled="isResending"
        >
          {{
            isResending
              ? $t("register.resendingVerification")
              : $t("register.resendVerification")
          }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import authService from "@/services/authService";

export default {
  name: "RegistrationSuccessScreen",
  props: {
    theme: {
      type: String,
      default: "light",
    },
  },
  data() {
    return {
      email: "",
      isResending: false,
    };
  },
  created() {
    this.email = this.$route.query.email || "";
    document.documentElement.setAttribute("data-theme", this.theme);
    this.ensureViewportMeta();
    this.setMobileHeight();
    if (this.$i18n) {
      console.log("[REG_SUCCESS] Current locale:", this.$i18n.locale);
      console.log(
        "[REG_SUCCESS] Registration success translation:",
        this.$t("register.registrationSuccess")
      );
    }
  },
  mounted() {
    window.addEventListener("resize", this.setMobileHeight);
    this.applyTheme();
    this.observeThemeChanges();
    // Debug: Log computed styles and configuration values
    const title = document.querySelector(
      ".registration-success-card .app-name"
    );
    console.log(
      "[REG_SUCCESS] Title text content:",
      title ? title.textContent : "not found"
    );
    console.log(
      "[REG_SUCCESS] Title computed color:",
      title ? window.getComputedStyle(title).color : "not found"
    );
    const subtitle = document.querySelector(".heading");
    console.log(
      "[REG_SUCCESS] Subtitle computed color:",
      subtitle ? window.getComputedStyle(subtitle).color : "not found"
    );
    const icon = document.querySelector(".app-logo");
    console.log(
      "[REG_SUCCESS] Icon source:",
      icon ? icon.querySelector("img")?.src : "fallback"
    );
    console.log(
      "[REG_SUCCESS] Icon computed background color:",
      icon ? window.getComputedStyle(icon).backgroundColor : "not found"
    );
    const primaryButton = document.querySelector(".primary-button");
    console.log(
      "[REG_SUCCESS] Primary button computed background color:",
      primaryButton
        ? window.getComputedStyle(primaryButton).backgroundColor
        : "not found"
    );
    const message = document.querySelector(".message");
    console.log(
      "[REG_SUCCESS] Message computed color:",
      message ? window.getComputedStyle(message).color : "not found"
    );
    const subMessage = document.querySelector(".sub-message");
    console.log(
      "[REG_SUCCESS] Sub-message computed color:",
      subMessage ? window.getComputedStyle(subMessage).color : "not found"
    );
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.setMobileHeight);
    if (this.themeObserver) {
      console.log("[REG_SUCCESS] Disconnecting MutationObserver");
      this.themeObserver.disconnect();
    }
  },
  watch: {
    theme(newTheme) {
      console.log(
        "[REG_SUCCESS] Theme prop updated:",
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
    async resendVerification() {
      if (this.isResending || !this.email) return;
      this.isResending = true;
      try {
        await authService.resendVerificationEmail(this.email);
        alert(this.$t("register.verificationResent"));
      } catch (error) {
        console.error("[REG_SUCCESS] Error resending verification:", error);
        alert(this.$t("register.verificationResendFailed"));
      } finally {
        this.isResending = false;
      }
    },
    applyTheme() {
      console.log(
        "[REG_SUCCESS] Applying theme:",
        this.theme,
        new Date().toISOString()
      );
      const currentTheme = document.documentElement.getAttribute("data-theme");
      if (currentTheme !== this.theme) {
        console.warn(
          "[REG_SUCCESS] Theme mismatch: component theme=",
          this.theme,
          "vs DOM theme=",
          currentTheme
        );
      }
      document.documentElement.setAttribute("data-theme", this.theme);
      const title = document.querySelector(
        ".registration-success-card .app-name"
      );
      console.log(
        "[REG_SUCCESS] Title computed color after apply:",
        title ? window.getComputedStyle(title).color : "not found"
      );
      const subtitle = document.querySelector(".heading");
      console.log(
        "[REG_SUCCESS] Subtitle computed color after apply:",
        subtitle ? window.getComputedStyle(subtitle).color : "not found"
      );
    },
    observeThemeChanges() {
      console.log(
        "[REG_SUCCESS] Setting up MutationObserver, initial theme:",
        this.theme,
        new Date().toISOString()
      );
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === "data-theme") {
            const newTheme =
              document.documentElement.getAttribute("data-theme");
            console.log(
              "[REG_SUCCESS] Detected theme change via MutationObserver:",
              newTheme,
              new Date().toISOString()
            );
            if (newTheme !== this.theme) {
              console.log(
                "[REG_SUCCESS] Updating component theme to:",
                newTheme
              );
              this.theme = newTheme;
              const title = document.querySelector(
                ".registration-success-card .app-name"
              );
              console.log(
                "[REG_SUCCESS] Title computed color after change:",
                title ? window.getComputedStyle(title).color : "not found"
              );
              const subtitle = document.querySelector(".heading");
              console.log(
                "[REG_SUCCESS] Subtitle computed color after change:",
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
.registration-success-container {
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

[data-theme="light"] .registration-success-container {
  background-color: var(--bg-primary, #f5f7fa);
}

[data-theme="dark"] .registration-success-container {
  background-color: var(--bg-primary, #1e1e1e);
}

.registration-success-card {
  width: 100%;
  max-width: 400px;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  padding: 24px;
  text-align: center;
}

[data-theme="light"] .registration-success-card {
  background-color: var(--bg-secondary, #ffffff);
  color: var(--text-primary, #333333);
}

[data-theme="dark"] .registration-success-card {
  background-color: var(--bg-secondary, #252525);
  color: var(--text-primary, #f0f0f0);
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

[data-theme="light"] .registration-success-card .app-name {
  color: #000000 !important;
}

[data-theme="dark"] .registration-success-card .app-name {
  color: var(--text-primary, #f0f0f0) !important;
}

.success-indicator {
  color: #10b981;
  margin: 24px 0 16px;
}

.heading {
  font-size: 22px;
  margin-bottom: 16px;
  font-weight: 500;
}

[data-theme="light"] .registration-success-card .heading {
  color: var(--text-secondary, #4d4d4d) !important;
}

[data-theme="dark"] .registration-success-card .heading {
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

.sub-message {
  margin-bottom: 24px;
  font-size: 14px;
}

[data-theme="light"] .sub-message {
  color: var(--text-muted, #6c757d);
}

[data-theme="dark"] .sub-message {
  color: var(--text-muted, #9ca3af);
}

.actions {
  margin-bottom: 24px;
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

.footer {
  border-top: 1px solid var(--border-light, #333333);
  padding-top: 16px;
  font-size: 14px;
}

[data-theme="light"] .footer {
  border-top: 1px solid var(--border-light, #e5e7eb);
}

[data-theme="light"] .footer {
  color: var(--text-muted, #6c757d);
}

[data-theme="dark"] .footer {
  color: var(--text-muted, #9ca3af);
}

.text-button {
  background: none;
  border: none;
  color: var(--bg-button-primary, #2a9d8f);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
  margin-top: 4px;
}

.text-button:hover:not(:disabled) {
  text-decoration: underline;
}

.text-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .registration-success-card {
    padding: 20px 16px;
  }
}
</style>