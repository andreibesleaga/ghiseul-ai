<!-- src/components/PasswordResetConfirmScreen.vue -->
<template>
  <div class="password-reset-confirm-container" :data-theme="theme">
    <div class="password-reset-confirm-card">
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
              : $t("app.name", "Ghiseul AI Romania")
          }}
        </h1>
      </div>

      <h2 class="password-reset-confirm-heading">
        {{ $t("passwordReset.resetPassword", "Reset Password") }}
      </h2>

      <!-- Success message after password reset -->
      <div v-if="resetSuccess" class="success-message">
        <p>
          {{
            $t(
              "passwordResetConfirm.resetSuccess",
              "Password reset successful!"
            )
          }}
        </p>
        <div class="checkmark-circle">
          <div class="checkmark"></div>
        </div>
        <p>
          {{
            $t("passwordResetConfirm.redirecting", "Redirecting to login...")
          }}
        </p>
      </div>

      <!-- Token Validation Section -->
      <div v-else-if="!isTokenValidated" class="token-validation-form">
        <!-- Show if token needs to be entered manually -->
        <div v-if="!isValidatingToken" class="form-group">
          <label for="resetToken" class="form-label">{{
            $t("passwordResetConfirm.tokenLabel", "Reset Token")
          }}</label>
          <input
            v-model="manualToken"
            type="text"
            id="resetToken"
            :placeholder="
              $t(
                'passwordResetConfirm.tokenPlaceholder',
                'Enter your reset token'
              )
            "
            class="form-control"
            required
            @focus="tokenError = ''"
          />
          <p v-if="tokenError" class="error-message">{{ tokenError }}</p>
        </div>

        <!-- Loading state while validating token -->
        <div v-else class="loading-state">
          <div class="loading-spinner"></div>
          <p>
            {{
              $t(
                "passwordResetConfirm.validatingToken",
                "Validating your token..."
              )
            }}
          </p>
        </div>

        <button
          v-if="!isValidatingToken"
          @click="validateToken"
          class="validate-token-button"
          :disabled="!manualToken || isValidatingToken"
        >
          {{ $t("passwordResetConfirm.validateButton", "Validate Token") }}
        </button>
      </div>

      <!-- Password Reset Form -->
      <form
        v-else-if="!resetSuccess"
        @submit.prevent="handlePasswordReset"
        class="password-reset-confirm-form"
      >
        <div class="form-group">
          <label for="newPassword" class="form-label">
            {{ $t("passwordResetConfirm.newPasswordLabel", "New Password") }}
          </label>
          <input
            v-model="newPassword"
            type="password"
            id="newPassword"
            :placeholder="
              $t(
                'passwordResetConfirm.newPasswordPlaceholder',
                'Enter your new password'
              )
            "
            class="form-control"
            required
            @focus="newPasswordError = ''"
          />
          <p v-if="newPasswordError" class="error-message">
            {{ newPasswordError }}
          </p>

          <!-- Password strength indicator -->
          <div
            v-if="newPassword && passwordStrength"
            class="password-strength-indicator"
          >
            <div class="strength-label">
              {{
                $t(
                  "passwordResetConfirm.passwordStrength",
                  "Password Strength"
                )
              }}:
              <span :class="'strength-' + passwordStrength.score">
                {{ getStrengthLabel(passwordStrength.score) }}
              </span>
            </div>
            <div class="strength-bar-container">
              <div
                class="strength-bar"
                :class="'strength-' + passwordStrength.score"
                :style="{ width: passwordStrength.score * 25 + '%' }"
              ></div>
            </div>
            <ul
              v-if="passwordStrength.feedback.suggestions.length > 0"
              class="strength-suggestions"
            >
              <li
                v-for="(suggestion, index) in passwordStrength.feedback
                  .suggestions"
                :key="index"
              >
                {{
                  $t(
                    "passwordResetConfirm.passwordSuggestions." + suggestion,
                    suggestion
                  )
                }}
              </li>
            </ul>
          </div>
        </div>

        <div class="form-group">
          <label for="confirmNewPassword" class="form-label">
            {{
              $t(
                "passwordResetConfirm.confirmNewPasswordLabel",
                "Confirm New Password"
              )
            }}
          </label>
          <input
            v-model="confirmNewPassword"
            type="password"
            id="confirmNewPassword"
            :placeholder="
              $t(
                'passwordResetConfirm.confirmNewPasswordPlaceholder',
                'Confirm your new password'
              )
            "
            class="form-control"
            required
            @focus="confirmNewPasswordError = ''"
          />
          <p v-if="confirmNewPasswordError" class="error-message">
            {{ confirmNewPasswordError }}
          </p>
        </div>

        <button
          type="submit"
          class="reset-confirm-button"
          :disabled="
            isSubmitting || (passwordStrength && passwordStrength.score < 3)
          "
        >
          <span v-if="isSubmitting" class="button-spinner"></span>
          {{
            isSubmitting
              ? $t("passwordResetConfirm.processing", "Processing...")
              : $t("passwordResetConfirm.resetButton", "Reset Password")
          }}
        </button>
      </form>

      <div class="login-link">
        <p>
          {{
            $t(
              "passwordResetConfirm.rememberedPassword",
              "Remembered your password?"
            )
          }}
          <router-link to="/login" class="login-link-text">
            {{ $t("passwordResetConfirm.backToLogin", "Back to Login") }}
          </router-link>
        </p>
      </div>

      <div class="password-reset-confirm-footer">
        <p class="support-message">
          {{
            $t(
              "passwordResetConfirm.supportMessage",
              "If you need assistance, please contact support."
            )
          }}
        </p>
        <div class="language-selector">
          <select v-model="selectedLocale" @change="changeLocale">
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="ro">Română</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import authService from "@/services/authService";
import passwordService from "@/services/passwordService";

export default {
  name: "PasswordResetConfirmScreen",
  props: {
    theme: {
      type: String,
      default: "light",
    },
    token: {
      type: String,
      default: "",
    },
  },
  data() {
    return {
      TEST_TOKENS: {
        valid: "dev_reset_token_2023",
        expired: "expired_reset_token",
        invalid: "invalid_reset_token",
      },
      manualToken: this.token || "",
      isTokenValidated: false,
      isValidatingToken: false,
      tokenError: "",
      newPassword: "",
      confirmNewPassword: "",
      newPasswordError: "",
      confirmNewPasswordError: "",
      passwordStrength: null,
      isSubmitting: false,
      resetSuccess: false,
      selectedLocale: this.$i18n ? this.$i18n.locale : "en",
    };
  },
  watch: {
    newPassword(newValue) {
      if (!newValue) {
        this.passwordStrength = null;
        return;
      }
      this.calculatePasswordStrength(newValue);
    },
    theme(newTheme) {
      console.log(
        "[RESET_CONFIRM] Theme prop updated:",
        newTheme,
        "source: prop change",
        new Date().toISOString()
      );
      this.applyTheme();
    },
  },
  created() {
    document.documentElement.setAttribute("data-theme", this.theme);
    if (this.token) {
      this.validateToken();
    }
    if (this.$i18n) {
      console.log("[RESET_CONFIRM] Current locale:", this.$i18n.locale);
      console.log(
        "[RESET_CONFIRM] Token label translation:",
        this.$t("passwordResetConfirm.tokenLabel")
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
      ".password-reset-confirm-card .app-name"
    );
    console.log(
      "[RESET_CONFIRM] Title text content:",
      title ? title.textContent : "not found"
    );
    console.log(
      "[RESET_CONFIRM] Title computed color:",
      title ? window.getComputedStyle(title).color : "not found"
    );
    const subtitle = document.querySelector(".password-reset-confirm-heading");
    console.log(
      "[RESET_CONFIRM] Subtitle computed color:",
      subtitle ? window.getComputedStyle(subtitle).color : "not found"
    );
    const icon = document.querySelector(".app-logo");
    console.log(
      "[RESET_CONFIRM] Icon source:",
      icon ? icon.querySelector("img")?.src : "fallback"
    );
    console.log(
      "[RESET_CONFIRM] Icon computed background color:",
      icon ? window.getComputedStyle(icon).backgroundColor : "not found"
    );
    const validateButton = document.querySelector(".validate-token-button");
    console.log(
      "[RESET_CONFIRM] Validate button computed background color:",
      validateButton
        ? window.getComputedStyle(validateButton).backgroundColor
        : "not found"
    );
    const resetButton = document.querySelector(".reset-confirm-button");
    console.log(
      "[RESET_CONFIRM] Reset button computed background color:",
      resetButton
        ? window.getComputedStyle(resetButton).backgroundColor
        : "not found"
    );
    const formField = document.querySelector(".form-control");
    console.log(
      "[RESET_CONFIRM] Form field computed background color:",
      formField
        ? window.getComputedStyle(formField).backgroundColor
        : "not found"
    );
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.setMobileHeight);
    if (this.themeObserver) {
      console.log("[RESET_CONFIRM] Disconnecting MutationObserver");
      this.themeObserver.disconnect();
    }
  },
  methods: {
    calculatePasswordStrength(password) {
      let score = 0;
      if (password.length >= 8) score += 1;
      if (/[A-Z]/.test(password)) score += 1;
      if (/[a-z]/.test(password)) score += 1;
      if (/[0-9]/.test(password)) score += 1;
      if (/[^A-Za-z0-9]/.test(password)) score += 1;
      score = Math.min(score, 4);
      const suggestions = this.getStaticSuggestions(password, score);
      this.passwordStrength = {
        score,
        feedback: { suggestions },
      };
    },
    getStaticSuggestions(password, score) {
      const suggestions = [];
      if (score < 4) {
        if (password.length < 8) suggestions.push("atLeast8Chars");
        if (!/[A-Z]/.test(password)) suggestions.push("addUppercase");
        if (!/[a-z]/.test(password)) suggestions.push("addLowercase");
        if (!/[0-9]/.test(password)) suggestions.push("addNumbers");
        if (!/[^A-Za-z0-9]/.test(password)) suggestions.push("addSpecialChars");
      }
      return suggestions;
    },
    async validateToken() {
      this.tokenError = "";
      this.isValidatingToken = true;
      const token = this.manualToken || this.token;
      if (!token) {
        this.tokenError = this.$t(
          "passwordResetConfirm.noTokenProvided",
          "Please enter a reset token"
        );
        this.isValidatingToken = false;
        return;
      }
      try {
        if (
          process.env.NODE_ENV === "development" &&
          token === this.TEST_TOKENS.valid
        ) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          this.isTokenValidated = true;
          this.isValidatingToken = false;
          return;
        }
        if (
          process.env.NODE_ENV === "development" &&
          token === this.TEST_TOKENS.expired
        ) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          this.tokenError = this.$t(
            "passwordResetConfirm.expiredToken",
            "This reset token has expired"
          );
          this.isValidatingToken = false;
          return;
        }
        const response = await passwordService.validateToken(token);
        if (response && response.valid) {
          this.isTokenValidated = true;
        } else {
          if (response.expired) {
            this.tokenError = this.$t(
              "passwordResetConfirm.expiredToken",
              "This reset token has expired"
            );
          } else if (response.used) {
            this.tokenError = this.$t(
              "passwordResetConfirm.usedToken",
              "This reset token has already been used"
            );
          } else {
            this.tokenError = this.$t(
              "passwordResetConfirm.invalidToken",
              "Invalid reset token"
            );
          }
        }
      } catch (error) {
        console.error("[RESET_CONFIRM] Token validation error:", error);
        this.tokenError = this.$t(
          "passwordResetConfirm.validationError",
          "Could not validate token, please try again"
        );
      } finally {
        this.isValidatingToken = false;
      }
    },
    validatePasswords() {
      this.newPasswordError = "";
      this.confirmNewPasswordError = "";
      if (this.passwordStrength && this.passwordStrength.score < 3) {
        this.newPasswordError = this.$t(
          "passwordResetConfirm.passwordTooWeak",
          "Password is too weak. Please choose a stronger password."
        );
        return false;
      }
      if (this.newPassword !== this.confirmNewPassword) {
        this.confirmNewPasswordError = this.$t(
          "passwordResetConfirm.passwordsDoNotMatch",
          "Passwords do not match"
        );
        return false;
      }
      return true;
    },
    async handlePasswordReset() {
      if (!this.validatePasswords()) {
        return;
      }
      this.isSubmitting = true;
      try {
        const token = this.manualToken || this.token;
        if (
          process.env.NODE_ENV === "development" &&
          token === this.TEST_TOKENS.valid
        ) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          this.resetSuccess = true;
          setTimeout(() => {
            this.$router.push("/login");
          }, 3000);
          return;
        }
        const response = await passwordService.resetPassword(
          token,
          this.newPassword
        );
        if (response && response.success) {
          this.resetSuccess = true;
          setTimeout(() => {
            this.$router.push("/login");
          }, 3000);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (error) {
        console.error("[RESET_CONFIRM] Password reset failed:", error);
        if (error.response && error.response.status === 410) {
          this.tokenError = this.$t(
            "passwordResetConfirm.expiredToken",
            "This reset token has expired"
          );
          this.isTokenValidated = false;
        } else if (error.response && error.response.status === 409) {
          this.tokenError = this.$t(
            "passwordResetConfirm.usedToken",
            "This reset token has already been used"
          );
          this.isTokenValidated = false;
        } else {
          alert(
            this.$t(
              "passwordResetConfirm.resetFailed",
              "Password reset failed. Please try again."
            )
          );
        }
      } finally {
        this.isSubmitting = false;
      }
    },
    getStrengthLabel(score) {
      const labels = [
        this.$t("passwordResetConfirm.strengthLabels.veryWeak", "Very Weak"),
        this.$t("passwordResetConfirm.strengthLabels.weak", "Weak"),
        this.$t("passwordResetConfirm.strengthLabels.fair", "Fair"),
        this.$t("passwordResetConfirm.strengthLabels.good", "Good"),
        this.$t("passwordResetConfirm.strengthLabels.strong", "Strong"),
      ];
      return labels[Math.min(score, 4)];
    },
    changeLocale() {
      if (this.$i18n) {
        this.$i18n.locale = this.selectedLocale;
        try {
          localStorage.setItem("userLocale", this.selectedLocale);
        } catch (e) {
          console.warn("[RESET_CONFIRM] Error saving language preference:", e);
        }
      } else if (typeof this.$setLocale === "function") {
        this.$setLocale(this.selectedLocale);
      }
    },
    setMobileHeight() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    },
    applyTheme() {
      console.log(
        "[RESET_CONFIRM] Applying theme:",
        this.theme,
        new Date().toISOString()
      );
      const currentTheme = document.documentElement.getAttribute("data-theme");
      if (currentTheme !== this.theme) {
        console.warn(
          "[RESET_CONFIRM] Theme mismatch: component theme=",
          this.theme,
          "vs DOM theme=",
          currentTheme
        );
      }
      document.documentElement.setAttribute("data-theme", this.theme);
      const title = document.querySelector(
        ".password-reset-confirm-card .app-name"
      );
      console.log(
        "[RESET_CONFIRM] Title computed color after apply:",
        title ? window.getComputedStyle(title).color : "not found"
      );
      const subtitle = document.querySelector(
        ".password-reset-confirm-heading"
      );
      console.log(
        "[RESET_CONFIRM] Subtitle computed color after apply:",
        subtitle ? window.getComputedStyle(subtitle).color : "not found"
      );
    },
    observeThemeChanges() {
      console.log(
        "[RESET_CONFIRM] Setting up MutationObserver, initial theme:",
        this.theme,
        new Date().toISOString()
      );
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === "data-theme") {
            const newTheme =
              document.documentElement.getAttribute("data-theme");
            console.log(
              "[RESET_CONFIRM] Detected theme change via MutationObserver:",
              newTheme,
              new Date().toISOString()
            );
            if (newTheme !== this.theme) {
              console.log(
                "[RESET_CONFIRM] Updating component theme to:",
                newTheme
              );
              this.theme = newTheme;
              const title = document.querySelector(
                ".password-reset-confirm-card .app-name"
              );
              console.log(
                "[RESET_CONFIRM] Title computed color after change:",
                title ? window.getComputedStyle(title).color : "not found"
              );
              const subtitle = document.querySelector(
                ".password-reset-confirm-heading"
              );
              console.log(
                "[RESET_CONFIRM] Subtitle computed color after change:",
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
.password-reset-confirm-container {
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

[data-theme="light"] .password-reset-confirm-container {
  background-color: var(--bg-primary, #f5f7fa);
}

[data-theme="dark"] .password-reset-confirm-container {
  background-color: var(--bg-primary, #1e1e1e);
}

.password-reset-confirm-card {
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

[data-theme="light"] .password-reset-confirm-card {
  background-color: var(--bg-secondary, #ffffff);
  color: var(--text-primary, #333333);
}

[data-theme="dark"] .password-reset-confirm-card {
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

[data-theme="light"] .password-reset-confirm-card .app-name {
  color: #000000 !important;
}

[data-theme="dark"] .password-reset-confirm-card .app-name {
  color: var(--text-primary, #f0f0f0) !important;
}

.password-reset-confirm-heading {
  text-align: center;
  font-size: 18px;
  margin-top: 0;
  margin-bottom: 20px;
  font-weight: 500;
}

[data-theme="light"]
  .password-reset-confirm-card
  .password-reset-confirm-heading {
  color: var(--text-secondary, #4d4d4d) !important;
}

[data-theme="dark"]
  .password-reset-confirm-card
  .password-reset-confirm-heading {
  color: var(--text-secondary, #b3b3b3) !important;
}

.token-validation-form,
.password-reset-confirm-form {
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
}

[data-theme="light"] .form-control:focus {
  background-color: var(--bg-primary, #f5f7fa) !important;
}

[data-theme="dark"] .form-control:focus {
  background-color: var(--bg-input, #2a2a2a) !important;
}

.validate-token-button,
.reset-confirm-button {
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

[data-theme="dark"] .validate-token-button,
[data-theme="dark"] .reset-confirm-button {
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.validate-token-button:hover:not(:disabled),
.reset-confirm-button:hover:not(:disabled) {
  background-color: var(--bg-button-primary-hover, #24887d);
}

.validate-token-button:disabled,
.reset-confirm-button:disabled {
  background-color: var(--bg-button-primary, #2a9d8f);
  cursor: not-allowed;
  opacity: 0.7;
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

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  border-top-color: #4e97d1;
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 12px;
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

.password-reset-confirm-footer {
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

.language-selector select {
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

[data-theme="light"] .language-selector select {
  background-color: var(--bg-input, #ffffff);
  color: var(--text-primary, #333333);
  border: 1px solid var(--border-input, #dcdfe4);
}

[data-theme="dark"] .language-selector select {
  background-color: var(--bg-input, #333333);
  color: var(--text-primary, #f0f0f0);
  border: 1px solid var(--border-input, #3a3a3a);
}

.language-selector select:focus {
  outline: none;
  border-color: var(--bg-button-primary, #2a9d8f);
}

.password-strength-indicator {
  margin-top: 8px;
  font-size: 12px;
}

.strength-label {
  margin-bottom: 4px;
}

.strength-0 {
  color: #ff4d4d;
}
.strength-1 {
  color: #ffa64d;
}
.strength-2 {
  color: #ffcc00;
}
.strength-3 {
  color: #80cc33;
}
.strength-4 {
  color: #47d147;
}

.strength-bar-container {
  height: 4px;
  background-color: #444;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.strength-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.strength-bar.strength-0 {
  background-color: #ff4d4d;
}
.strength-bar.strength-1 {
  background-color: #ffa64d;
}
.strength-bar.strength-2 {
  background-color: #ffcc00;
}
.strength-bar.strength-3 {
  background-color: #80cc33;
}
.strength-bar.strength-4 {
  background-color: #47d147;
}

.strength-suggestions {
  list-style-type: none;
  padding-left: 0;
  margin: 8px 0 0;
  color: #aaa;
}

.strength-suggestions li {
  margin-bottom: 4px;
  line-height: 1.2;
}

.strength-suggestions li::before {
  content: "• ";
  color: #4e97d1;
}

.checkmark-circle {
  width: 56px;
  height: 56px;
  position: relative;
  display: block;
  vertical-align: top;
  margin: 20px auto;
  background-color: rgba(16, 185, 129, 0.1);
  border-radius: 50%;
}

.checkmark {
  height: 28px;
  width: 14px;
  display: block;
  stroke-width: 2;
  stroke: #4ade80;
  stroke-miterlimit: 10;
  margin: 14px auto;
  box-shadow: inset 0px 0px 0px #4ade80;
  animation: fill 0.4s ease-in-out 0.4s forwards,
    scale 0.3s ease-in-out 0.9s both;
  position: relative;
  top: 0;
  right: 0;
  transform: rotate(45deg);
  border-bottom: 3px solid #4ade80;
  border-right: 3px solid #4ade80;
}

@keyframes fill {
  100% {
    box-shadow: inset 0px 0px 0px 30px #4ade80;
  }
}

@keyframes scale {
  0%,
  100% {
    transform: rotate(45deg) scale(1);
  }
  50% {
    transform: rotate(45deg) scale(1.2);
  }
}

@media (max-width: 480px) {
  .password-reset-confirm-card {
    padding: 20px 16px;
    max-height: 92vh;
  }
}
</style>