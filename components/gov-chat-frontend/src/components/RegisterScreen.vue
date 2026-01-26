<!-- src/components/RegisterScreen.vue -->
<template>
  <div class="register-container" :data-theme="theme">
    <div class="register-card">
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

      <h2 class="register-heading">{{ $t("register.createAccount") }}</h2>

      <form @submit.prevent="handleRegister" class="register-form">
        <div class="form-group">
          <label for="username" class="form-label">{{
            $t("register.username")
          }}</label>
          <input
            v-model="username"
            type="text"
            id="username"
            :placeholder="$t('register.usernamePlaceholder')"
            class="form-control"
            required
          />
          <p v-if="usernameError" class="error-message">{{ usernameError }}</p>
        </div>

        <div class="form-group">
          <label for="email" class="form-label">{{
            $t("register.email")
          }}</label>
          <input
            v-model="email"
            type="email"
            id="email"
            :placeholder="$t('register.emailPlaceholder')"
            class="form-control"
            required
          />
          <p v-if="emailError" class="error-message">{{ emailError }}</p>
        </div>

        <div class="form-group">
          <label for="password" class="form-label">{{
            $t("register.password")
          }}</label>
          <input
            v-model="password"
            type="password"
            id="password"
            :placeholder="$t('register.passwordPlaceholder')"
            class="form-control"
            required
          />
          <p v-if="passwordError" class="error-message">{{ passwordError }}</p>
        </div>

        <div class="form-group">
          <label for="confirmPassword" class="form-label">{{
            $t("register.confirmPassword")
          }}</label>
          <input
            v-model="confirmPassword"
            type="password"
            id="confirmPassword"
            :placeholder="$t('register.confirmPasswordPlaceholder')"
            class="form-control"
            required
          />
          <p v-if="confirmPasswordError" class="error-message">
            {{ confirmPasswordError }}
          </p>
        </div>

        <div class="terms-checkbox">
          <label class="terms">
            <input type="checkbox" v-model="acceptTerms" required />
            <span
              >{{ $t("register.acceptTerms") }}
              <a href="#" class="terms-link">{{
                $t("register.termsOfService")
              }}</a></span
            >
          </label>
          <p v-if="termsError" class="error-message">{{ termsError }}</p>
        </div>

        <button type="submit" class="register-button" :disabled="isSubmitting">
          {{
            isSubmitting
              ? $t("register.processing")
              : $t("register.registerButton")
          }}
        </button>
      </form>

      <div class="login-link">
        <p>
          {{ $t("register.alreadyHaveAccount") }}
          <router-link to="/login" class="login-link-text">{{
            $t("register.loginNow")
          }}</router-link>
        </p>
      </div>

      <div class="register-footer">
        <p class="terms-policy">{{ $t("register.privacyNotice") }}</p>
        <div class="language-selector">
          <language-selector />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import authService from "@/services/authService";
import LanguageSelector from "@/components/LanguageSelector.vue";

export default {
  name: "RegisterScreen",
  components: {
    LanguageSelector,
  },
  props: {
    theme: {
      type: String,
      default: "light",
    },
  },
  data() {
    return {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
      isSubmitting: false,
      usernameError: "",
      emailError: "",
      passwordError: "",
      confirmPasswordError: "",
      termsError: "",
    };
  },
  created() {
    console.log("[REGISTER] RegisterScreen component created");
    document.documentElement.setAttribute("data-theme", this.theme);
    this.ensureViewportMeta();
    if (this.$i18n) {
      console.log("[REGISTER] Current locale:", this.$i18n.locale);
      console.log(
        "[REGISTER] Create account translation:",
        this.$t("register.createAccount")
      );
    }
  },
  mounted() {
    this.setMobileHeight();
    window.addEventListener("resize", this.setMobileHeight);
    this.applyTheme();
    this.observeThemeChanges();
    // Debug: Log computed styles and configuration values
    const title = document.querySelector(".register-card .app-name");
    console.log(
      "[REGISTER] Title text content:",
      title ? title.textContent : "not found"
    );
    console.log(
      "[REGISTER] Title computed color:",
      title ? window.getComputedStyle(title).color : "not found"
    );
    const subtitle = document.querySelector(".register-heading");
    console.log(
      "[REGISTER] Subtitle computed color:",
      subtitle ? window.getComputedStyle(subtitle).color : "not found"
    );
    const icon = document.querySelector(".app-logo");
    console.log(
      "[REGISTER] Icon source:",
      icon ? icon.querySelector("img")?.src : "fallback"
    );
    console.log(
      "[REGISTER] Icon computed background color:",
      icon ? window.getComputedStyle(icon).backgroundColor : "not found"
    );
    const formField = document.querySelector(".form-control");
    console.log(
      "[REGISTER] Form field computed background color:",
      formField
        ? window.getComputedStyle(formField).backgroundColor
        : "not found"
    );
    const checkbox = document.querySelector(".terms input");
    console.log(
      "[REGISTER] Checkbox computed background color:",
      checkbox ? window.getComputedStyle(checkbox).backgroundColor : "not found"
    );
    const registerButton = document.querySelector(".register-button");
    console.log(
      "[REGISTER] Register button computed background color:",
      registerButton
        ? window.getComputedStyle(registerButton).backgroundColor
        : "not found"
    );
    const loginLink = document.querySelector(".login-link-text");
    console.log(
      "[REGISTER] Login link computed color:",
      loginLink ? window.getComputedStyle(loginLink).color : "not found"
    );
    const termsLink = document.querySelector(".terms-link");
    console.log(
      "[REGISTER] Terms link computed color:",
      termsLink ? window.getComputedStyle(termsLink).color : "not found"
    );
    const footer = document.querySelector(".terms-policy");
    console.log(
      "[REGISTER] Footer computed color:",
      footer ? window.getComputedStyle(footer).color : "not found"
    );
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.setMobileHeight);
    if (this.themeObserver) {
      console.log("[REGISTER] Disconnecting MutationObserver");
      this.themeObserver.disconnect();
    }
  },
  watch: {
    theme(newTheme) {
      console.log(
        "[REGISTER] Theme prop updated:",
        newTheme,
        "source: prop change",
        new Date().toISOString()
      );
      this.applyTheme();
    },
    username() {
      this.usernameError = "";
    },
    email() {
      this.emailError = "";
    },
    password() {
      this.passwordError = "";
      if (this.confirmPassword) {
        this.confirmPasswordError =
          this.password !== this.confirmPassword
            ? this.$t("register.passwordsDoNotMatch")
            : "";
      }
    },
    confirmPassword() {
      this.confirmPasswordError =
        this.password !== this.confirmPassword
          ? this.$t("register.passwordsDoNotMatch")
          : "";
    },
    acceptTerms() {
      this.termsError = "";
    },
  },
  methods: {
    setMobileHeight() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.setProperty("--vh", `${vh}px`);
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
    goToLogin() {
      this.$router.push("/login");
    },
    validateUsername(username) {
      if (username.length < 3) {
        return this.$t("register.usernameMinLength");
      }
      const validUsernameRegex = /^[a-zA-Z0-9_.-]+$/;
      if (!validUsernameRegex.test(username)) {
        return (
          this.$t("register.usernameInvalidChars") ||
          "Username can only contain letters, numbers, underscores, dots and hyphens"
        );
      }
      return "";
    },
    validateForm() {
      let isValid = true;
      this.usernameError = "";
      this.emailError = "";
      this.passwordError = "";
      this.confirmPasswordError = "";
      this.termsError = "";
      const usernameError = this.validateUsername(this.username);
      if (usernameError) {
        this.usernameError = usernameError;
        isValid = false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.email)) {
        this.emailError = this.$t("register.invalidEmail");
        isValid = false;
      }
      const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(this.password)) {
        this.passwordError = this.$t("register.passwordRequirements");
        isValid = false;
      }
      if (this.password !== this.confirmPassword) {
        this.confirmPasswordError = this.$t("register.passwordsDoNotMatch");
        isValid = false;
      }
      if (!this.acceptTerms) {
        this.termsError = this.$t("register.mustAcceptTerms");
        isValid = false;
      }
      return isValid;
    },
    async handleRegister() {
      if (!this.validateForm()) {
        return;
      }
      this.isSubmitting = true;
      try {
        const userData = {
          loginName: this.username,
          email: this.email,
          password: this.password,
        };
        const response = await authService.register(userData);
        console.log("[REGISTER] User registered successfully:", response);
        this.$router.push({
          path: "/registration-success",
          query: { email: this.email },
        });
      } catch (error) {
        console.error("[REGISTER] Registration error:", error);
        if (error.response) {
          const { status, data } = error.response;
          if (status === 409 || status === 400) {
            const errorMessage = data.message || "";
            if (
              errorMessage.toLowerCase().includes("username already exists") ||
              (errorMessage.toLowerCase().includes("username") &&
                errorMessage.toLowerCase().includes("exists")) ||
              (data.field && data.field.toLowerCase() === "username") ||
              errorMessage.toLowerCase().includes("loginname")
            ) {
              this.usernameError = this.$t("register.usernameExists");
            } else if (
              errorMessage.toLowerCase().includes("email already exists") ||
              (errorMessage.toLowerCase().includes("email") &&
                errorMessage.toLowerCase().includes("exists")) ||
              (data.field && data.field.toLowerCase() === "email")
            ) {
              this.emailError = this.$t("register.emailExists");
            } else if (
              errorMessage.includes("username") ||
              errorMessage.includes("fordendk")
            ) {
              this.usernameError = this.$t("register.usernameExists");
            } else {
              this.usernameError = this.$t("register.registrationFailed");
            }
          } else {
            this.usernameError = this.$t("register.registrationFailed");
          }
        } else if (error.message && error.message.includes("Network Error")) {
          this.usernameError = this.$t("register.networkError");
        } else {
          this.usernameError = this.$t("register.registrationFailed");
        }
      } finally {
        this.isSubmitting = false;
      }
    },
    applyTheme() {
      console.log(
        "[REGISTER] Applying theme:",
        this.theme,
        new Date().toISOString()
      );
      const currentTheme = document.documentElement.getAttribute("data-theme");
      if (currentTheme !== this.theme) {
        console.warn(
          "[REGISTER] Theme mismatch: component theme=",
          this.theme,
          "vs DOM theme=",
          currentTheme
        );
      }
      document.documentElement.setAttribute("data-theme", this.theme);
      const title = document.querySelector(".register-card .app-name");
      console.log(
        "[REGISTER] Title computed color after apply:",
        title ? window.getComputedStyle(title).color : "not found"
      );
      const subtitle = document.querySelector(".register-heading");
      console.log(
        "[REGISTER] Subtitle computed color after apply:",
        subtitle ? window.getComputedStyle(subtitle).color : "not found"
      );
    },
    observeThemeChanges() {
      console.log(
        "[REGISTER] Setting up MutationObserver, initial theme:",
        this.theme,
        new Date().toISOString()
      );
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === "data-theme") {
            const newTheme =
              document.documentElement.getAttribute("data-theme");
            console.log(
              "[REGISTER] Detected theme change via MutationObserver:",
              newTheme,
              new Date().toISOString()
            );
            if (newTheme !== this.theme) {
              console.log("[REGISTER] Updating component theme to:", newTheme);
              this.theme = newTheme;
              const title = document.querySelector(".register-card .app-name");
              console.log(
                "[REGISTER] Title computed color after change:",
                title ? window.getComputedStyle(title).color : "not found"
              );
              const subtitle = document.querySelector(".register-heading");
              console.log(
                "[REGISTER] Subtitle computed color after change:",
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
.register-container {
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

[data-theme="light"] .register-container {
  background-color: var(--bg-primary, #f5f7fa);
}

[data-theme="dark"] .register-container {
  background-color: var(--bg-primary, #1e1e1e);
}

.register-card {
  width: 100%;
  max-width: 400px;
  max-height: 95vh;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  padding: 24px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

[data-theme="light"] .register-card {
  background-color: var(--bg-secondary, #ffffff);
  color: var(--text-primary, #333333);
}

[data-theme="dark"] .register-card {
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

[data-theme="light"] .register-card .app-name {
  color: #000000 !important;
}

[data-theme="dark"] .register-card .app-name {
  color: var(--text-primary, #f0f0f0) !important;
}

.register-heading {
  text-align: center;
  font-size: 18px;
  margin-top: 0;
  margin-bottom: 20px;
  font-weight: 500;
}

[data-theme="light"] .register-card .register-heading {
  color: var(--text-secondary, #4d4d4d) !important;
}

[data-theme="dark"] .register-card .register-heading {
  color: var(--text-secondary, #b3b3b3) !important;
}

.register-form {
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 14px;
}

.form-label {
  display: block;
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
  padding: 10px 12px;
  font-size: 15px;
  border: none;
  border-radius: 8px;
  transition: background-color 0.2s;
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

.error-message {
  color: #ff6b6b;
  font-size: 12px;
  margin-top: 4px;
  margin-bottom: 0;
}

.terms-checkbox {
  margin-bottom: 16px;
}

.terms {
  display: flex;
  align-items: flex-start;
  cursor: pointer;
  font-size: 13px;
}

[data-theme="light"] .terms {
  color: var(--text-secondary, #4d4d4d);
}

[data-theme="dark"] .terms {
  color: var(--text-secondary, #b3b3b3);
}

.terms input {
  appearance: none;
  background-color: var(--bg-button-primary, #2a9d8f) !important;
  border: 1px solid #ffffff;
  width: 16px;
  height: 16px;
  position: relative;
  margin-right: 8px;
  margin-top: 3px;
}

.terms input:checked::after {
  content: "\2713";
  color: #ffffff;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
}

.terms-link {
  color: var(--bg-button-primary, #2a9d8f);
  text-decoration: none;
}

.terms-link:hover {
  text-decoration: underline;
}

.register-button {
  width: 100%;
  padding: 10px;
  background-color: var(--bg-button-primary, #2a9d8f);
  color: var(--text-button-primary, #ffffff);
  font-size: 15px;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

[data-theme="dark"] .register-button {
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.register-button:hover:not(:disabled) {
  background-color: var(--bg-button-primary-hover, #24887d);
}

.register-button:disabled {
  background-color: var(--bg-button-primary, #2a9d8f);
  cursor: not-allowed;
  opacity: 0.7;
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

.register-footer {
  margin-top: auto;
  padding-top: 10px;
  text-align: center;
  font-size: 11px;
}

.terms-policy {
  margin-bottom: 10px;
}

[data-theme="light"] .terms-policy {
  color: var(--text-muted, #6c757d);
}

[data-theme="dark"] .terms-policy {
  color: var(--text-muted, #9ca3af);
}

.language-selector {
  margin-top: 8px;
}

.language-selector :deep(select) {
  padding: 6px 12px;
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

@media (max-width: 480px) {
  .register-card {
    padding: 20px 16px;
    max-height: 92vh;
  }

  .app-logo {
    width: 50px;
    height: 50px;
  }

  .ui-icon {
    width: 50px;
    height: 50px;
  }

  .app-logo-fallback {
    width: 50px;
    height: 50px;
  }

  .app-name {
    font-size: 24px;
  }

  .register-container {
    padding: 10px;
  }
}

@media (min-height: 800px) {
  .register-card {
    padding: 24px;
    max-height: 760px;
  }
}
</style>