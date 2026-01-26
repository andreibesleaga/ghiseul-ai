<template>
  <div class="settings-overlay">
    <div
      class="settings-dialog"
      :key="'settings-dialog-' + currentLocale"
      :style="dialogThemeStyles"
    >
      <div class="dialog-header">
        <h2 class="header-title" :data-themed="isThemeReady">
          {{ translate("settings.title", "Settings") }}
        </h2>
        <div class="header-actions">
          <button class="btn-close" @click="close">
            {{ translate("settings.close", "Close") }}
          </button>
          <button class="btn-save" @click="save">
            {{ translate("settings.saveSettings", "Save Settings") }}
          </button>
        </div>
      </div>

      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <p>
          {{
            translate("settings.loadingUserInfo", "Loading user information...")
          }}
        </p>
      </div>

      <div v-else-if="errorMessage" class="error-container">
        <p class="error-message">{{ errorMessage }}</p>
        <button @click="fetchUserData" class="btn-retry">
          {{ translate("settings.retry", "Retry") }}
        </button>
      </div>

      <div v-else>
        <div class="profile-section">
          <div class="account-avatar">
            <div class="avatar-placeholder" v-if="!userAvatar">
              {{
                userData.name
                  ? userData.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .substring(0, 2)
                  : "?"
              }}
            </div>
            <img
              v-else
              :src="userAvatar"
              alt="User avatar"
              class="avatar-image"
            />
          </div>
          <div class="account-details">
            <div class="user-name">
              {{ userData.name || translate("settings.userName", "User") }}
            </div>
            <div class="user-email">
              {{ userData.email || "email@example.com" }}
            </div>
            <div class="account-type">
              {{
                userData.accountType ||
                translate("settings.standardAccount", "Standard Account")
              }}
            </div>
          </div>
        </div>

        <div class="settings-grid">
          <div class="settings-box">
            <h3 class="section-title">
              {{ translate("settings.display", "Display") }}
            </h3>

            <div class="setting-item">
              <label class="section-label">{{
                translate("settings.displayLanguage", "Display Language")
              }}</label>
              <language-selector v-model="settings.language" />
            </div>

            <div class="setting-item">
              <label class="section-label">{{
                translate("settings.theme", "Theme")
              }}</label>
              <div class="theme-buttons">
                <button
                  class="theme-toggle"
                  :class="{ active: settings.theme === 'light' }"
                  @click="applyTheme('light')"
                >
                  {{ translate("settings.themes.light", "Light") }}
                </button>
                <button
                  class="theme-toggle"
                  :class="{ active: settings.theme === 'dark' }"
                  @click="applyTheme('dark')"
                >
                  {{ translate("settings.themes.dark", "Dark") }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <label class="section-label">{{
                translate("settings.fontSize", "Font Size")
              }}</label>
              <div class="slider-container">
                <input
                  type="range"
                  min="30"
                  max="100"
                  v-model.number="settings.fontSize"
                  class="slider"
                />
                <span class="slider-value">{{ settings.fontSize }}%</span>
              </div>
            </div>
          </div>

          <div class="settings-box">
            <h3 class="section-title">
              {{ translate("settings.notifications", "Notifications") }}
            </h3>

            <div class="setting-item">
              <div class="toggle-row">
                <label class="section-label">{{
                  translate("settings.emailUpdates", "Email Updates")
                }}</label>
                <div
                  class="switch"
                  @click="settings.emailUpdates = !settings.emailUpdates"
                >
                  <div
                    class="switch-track"
                    :class="{ active: settings.emailUpdates }"
                  >
                    <div class="switch-thumb"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="setting-item">
              <div class="toggle-row">
                <label class="section-label">{{
                  translate(
                    "settings.soundNotifications",
                    "Sound Notifications"
                  )
                }}</label>
                <div
                  class="switch"
                  @click="
                    settings.soundNotifications = !settings.soundNotifications
                  "
                >
                  <div
                    class="switch-track"
                    :class="{ active: settings.soundNotifications }"
                  >
                    <div class="switch-thumb"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="account-management-section">
          <h3 class="section-title">
            {{ translate("settings.accountManagement", "Account Management") }}
          </h3>

          <div class="account-management-grid">
            <div class="management-row">
              <div class="management-col">
                <label class="section-label">{{
                  translate("settings.emailAddress", "Email Address")
                }}</label>
                <div class="input-with-button">
                  <input
                    type="email"
                    class="text-input"
                    v-model="userData.email"
                    :disabled="!isEditingEmail"
                    :placeholder="
                      translate(
                        'settings.emailAddressPlaceholder',
                        'Your email address'
                      )
                    "
                  />
                  <button
                    class="btn-secondary"
                    @click="toggleEmailEdit"
                    :disabled="isEmailUpdating"
                  >
                    {{
                      isEditingEmail
                        ? translate("settings.save", "Save")
                        : translate("settings.edit", "Edit")
                    }}
                  </button>
                </div>
                <p v-if="emailError" class="error-text">{{ emailError }}</p>
              </div>

              <div class="management-col">
                <label class="section-label">{{
                  translate("settings.password", "Password")
                }}</label>
                <button
                  class="btn-secondary full-width"
                  @click="initiatePasswordChange"
                >
                  {{ translate("settings.changePassword", "Change Password") }}
                </button>
              </div>
            </div>

            <div class="management-row">
              <div class="management-col">
                <button
                  class="btn-secondary full-width"
                  @click="confirmResetUserData"
                >
                  {{ translate("settings.resetUserData", "Reset User Data") }}
                </button>
                <p class="description-text">
                  {{
                    translate(
                      "settings.resetUserDataDesc",
                      "This will clear all your profile data and chat history."
                    )
                  }}
                </p>
              </div>

              <div class="management-col">
                <button
                  class="btn-danger full-width"
                  @click="confirmDeleteAccount"
                >
                  {{ translate("settings.deleteAccount", "Delete Account") }}
                </button>
                <p class="description-text danger-text">
                  {{
                    translate(
                      "settings.deleteAccountDesc",
                      "This will permanently delete your account and all associated data."
                    )
                  }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal" v-if="showEmailConfirmModal">
        <div class="modal-content" :data-theme="settings.theme">
          <h3 class="modal-title" :data-themed="true">
            {{
              translate("settings.confirmEmailChange", "Confirm Email Change")
            }}
          </h3>

          <div class="modal-body">
            <p :data-themed="true">
              {{
                translate("settings.changingEmailTo", "Changing your email to")
              }}
              <strong>{{ newEmail }}</strong>
              {{ translate("settings.will", "will") }}:
            </p>
            <ul>
              <li>
                {{
                  translate(
                    "settings.logOutSystem",
                    "Log you out of the system"
                  )
                }}
              </li>
              <li>
                {{
                  translate(
                    "settings.sendVerificationLink",
                    "Send a verification link to your new email"
                  )
                }}
              </li>
              <li>
                {{
                  translate(
                    "settings.requireVerification",
                    "Require verification before you can log in again"
                  )
                }}
              </li>
            </ul>

            <div class="form-group">
              <label for="confirmPassword" :data-themed="true"
                >{{
                  translate(
                    "settings.enterPasswordConfirm",
                    "Enter your password to confirm"
                  )
                }}:</label
              >
              <input
                v-model="emailChangePassword"
                type="password"
                id="confirmPassword"
                :placeholder="
                  translate(
                    'settings.currentPasswordPlaceholder',
                    'Your current password'
                  )
                "
                class="text-input"
                required
              />
              <p v-if="emailChangeError" class="error-text">
                {{ emailChangeError }}
              </p>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-close" @click="cancelEmailChange">
              {{ translate("settings.cancel", "Cancel") }}
            </button>
            <button
              class="btn-save"
              @click="confirmEmailChange"
              :disabled="!emailChangePassword || isEmailUpdating"
            >
              {{
                isEmailUpdating
                  ? translate("settings.processing", "Processing...")
                  : translate("settings.confirmChange", "Confirm Change")
              }}
            </button>
          </div>
        </div>
      </div>

      <div class="modal" v-if="showPasswordReset">
        <PasswordResetInitiateScreen
          :prefilledEmail="userData.email"
          :isEmbedded="true"
          @reset-initiated="handlePasswordResetInitiated"
          @cancel="cancelPasswordReset"
        />
      </div>
    </div>
  </div>

  <div class="modal" v-if="showDeleteAccountModal">
    <div class="modal-content">
      <h3 class="modal-title">
        {{
          translate(
            "settings.confirmAccountDeletion",
            "Confirm Account Deletion"
          )
        }}
      </h3>
      <div class="modal-body">
        <p class="warning-text">
          {{
            translate(
              "settings.accountDeletionWarning",
              "Warning: This action is permanent and cannot be undone."
            )
          }}
        </p>

        <div class="form-group">
          <label for="deleteReason">{{
            translate(
              "settings.deletionReason",
              "Reason for deletion (optional):"
            )
          }}</label>
          <textarea
            v-model="deleteAccountReason"
            id="deleteReason"
            rows="3"
            class="text-input"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="confirmDeletePassword">{{
            translate(
              "settings.enterPasswordConfirm",
              "Enter your password to confirm:"
            )
          }}</label>
          <input
            v-model="deleteAccountPassword"
            type="password"
            id="confirmDeletePassword"
            class="text-input"
            required
          />
          <p v-if="deleteAccountError" class="error-text">
            {{ deleteAccountError }}
          </p>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-close" @click="cancelAccountDeletion">
          {{ translate("settings.cancel", "Cancel") }}
        </button>
        <button
          class="btn-danger"
          @click="processAccountDeletion"
          :disabled="!deleteAccountPassword || isDeletingAccount"
        >
          {{
            isDeletingAccount
              ? translate("settings.deleting", "Deleting...")
              : translate("settings.permanentlyDeleteAccount", "Delete Account")
          }}
        </button>
      </div>
    </div>
  </div>

  <ConfirmDialog
    :visible="showResetDataConfirm"
    :title="resetDataDialog.title"
    :message="resetDataDialog.message"
    :confirm-text="resetDataDialog.confirmText"
    :cancel-text="resetDataDialog.cancelText"
    :theme="getCurrentTheme()"
    :parent-styles="{ maxWidth: '450px' }"
    @confirm="handleResetDataConfirm"
    @cancel="handleResetDataCancel"
  />

  <ConfirmDialog
    :visible="showDeleteAccountConfirm"
    :title="deleteAccountDialog.title"
    :message="deleteAccountDialog.message"
    :confirm-text="deleteAccountDialog.confirmText"
    :cancel-text="deleteAccountDialog.cancelText"
    :theme="getCurrentTheme()"
    :parent-styles="{ maxWidth: '450px' }"
    @confirm="handleDeleteAccountConfirm"
    @cancel="handleDeleteAccountCancel"
  />
</template>

<script>
// Import the user service to handle user-related API calls and data management
import userService from "@/services/userService";

// Import the PasswordResetInitiateScreen component for initiating password reset flows
import PasswordResetInitiateScreen from "@/components/PasswordResetInitiateScreen.vue";

// Import the notifications service to display user feedback messages (success, error, info)
import notificationService from "@/services/notificationService";

// Import the theme manager utilities to handle theme application and persistence
import { themeManager } from "@/utils/ThemeManager";

// Import the ConfirmDialog component for displaying confirmation dialogs
import ConfirmDialog from "@/components/ConfirmDialog.vue";

// Import LanguageSelector component
import LanguageSelector from "@/components/LanguageSelector.vue";

export default {
  name: "SettingsComponent",
  components: {
    PasswordResetInitiateScreen,
    ConfirmDialog,
    LanguageSelector,
  },
  data() {
    return {
      currentLocale: this.$i18n ? this.$i18n.locale : "en",
      isLoading: true,
      errorMessage: null,
      isThemeReady: false,
      currentUserId: "",
      themeEnforcementInterval: null, // Track interval ID here
      settings: {
        language: this.getCurrentLanguage(),
        theme: this.getCurrentTheme(),
        fontSize: this.getSavedFontSize(),
        emailUpdates: this.getSavedPreference("emailUpdates", false),
        soundNotifications: this.getSavedPreference("soundNotifications", true),
      },
      userData: {
        name: "",
        email: "",
        accountType: "",
        userId: "",
        createdAt: "",
      },
      userAvatar: null,
      isEditingEmail: false,
      emailError: null,
      newEmail: "",
      isEmailUpdating: false,
      showEmailConfirmModal: false,
      emailChangePassword: "",
      emailChangeError: null,
      showPasswordReset: false,
      showDeleteAccountModal: false,
      deleteAccountPassword: "",
      deleteAccountReason: "",
      deleteAccountError: null,
      isDeletingAccount: false,
      showResetDataConfirm: false,
      showDeleteAccountConfirm: false,
      resetDataDialog: {
        title: "",
        message: "",
        confirmText: "",
        cancelText: "",
      },
      deleteAccountDialog: {
        title: "",
        message: "",
        confirmText: "",
        cancelText: "",
      },
    };
  },
  computed: {
    isDarkMode() {
      console.log(
        "[SETTINGS] Computing isDarkMode, settings.theme:",
        this.settings.theme
      );
      return this.settings.theme === "dark";
    },
    dialogThemeStyles() {
      const isDark = this.isDarkMode;
      console.log("[SETTINGS] Computing dialogThemeStyles, isDark:", isDark);
      return {
        "--dialog-background": isDark ? "#2a2a2a" : "#ffffff",
        "--dialog-title-color": isDark ? "#f0f0f0" : "#333333",
        "--dialog-text-color": isDark ? "rgba(255, 255, 255, 0.8)" : "#666666",
        "--dialog-border-color": isDark ? "#3a3a3a" : "#dcdfe4",
        "--dialog-box-shadow": isDark
          ? "0 4px 12px rgba(0, 0, 0, 0.4)"
          : "0 4px 12px rgba(0, 0, 0, 0.15)",
        "--dialog-overlay-background": isDark
          ? "rgba(0, 0, 0, 0.7)"
          : "rgba(0, 0, 0, 0.5)",
      };
    },
  },
  created() {
    console.log("[SETTINGS] Initializing currentLocale...");
    this.currentLocale = this.$i18n ? this.$i18n.locale : "en";
    console.log("[SETTINGS] currentLocale initialized to:", this.currentLocale);

    console.log("[SETTINGS] Component created, fetching user data...");
    this.fetchUserData();

    console.log("[SETTINGS] Initializing dialog texts...");
    this.updateDialogTexts();

    console.log("[SETTINGS] Initial settings.theme:", this.settings.theme);
    console.log(
      "[SETTINGS] Initial DOM data-theme:",
      document.documentElement.getAttribute("data-theme")
    );

    console.log("[SETTINGS] Setting up watcher for settings.language...");
    this.$watch("settings.language", (newVal) => {
      console.log("[SETTINGS] settings.language changed to:", newVal);
      if (this.$i18n) {
        console.log("[SETTINGS] Updating i18n locale...");
        this.$i18n.locale = newVal;
        console.log("[SETTINGS] Updating currentLocale to:", newVal);
        this.currentLocale = newVal;
        console.log(
          "[SETTINGS] Forcing component re-render for language update..."
        );
        this.$forceUpdate();
        if (this.$root) {
          console.log("[SETTINGS] Forcing root component re-render...");
          this.$root.$forceUpdate();
        }
      }
    });

    console.log("[SETTINGS] Setting up watcher for $i18n.locale...");
    if (this.$i18n) {
      this.$watch("$i18n.locale", (newLocale) => {
        console.log("Locale changed in Settings:", newLocale);
        this.currentLocale = newLocale;
        if (this.settings && this.settings.language !== newLocale) {
          console.log("[SETTINGS] Syncing settings.language to:", newLocale);
          this.settings.language = newLocale;
        }
        console.log(
          "[SETTINGS] Forcing component re-render for external locale change..."
        );
        this.$forceUpdate();
      });
    }
  },
  mounted() {
    console.log("[SETTINGS] Adding theme change event listener...");
    window.addEventListener("themeChange", this.updateTheme);

    console.log("[SETTINGS] Forcing theme application on mount...");
    this.applyTheme(this.settings.theme);

    // Continuously enforce theme to handle external overrides
    // FIXED: Assigned to 'this' instead of const, removed $once
    console.log("[SETTINGS] Setting up theme enforcement interval...");
    this.themeEnforcementInterval = setInterval(() => {
      const currentDomTheme =
        document.documentElement.getAttribute("data-theme") || "light";
      if (currentDomTheme !== this.settings.theme) {
        console.log(
          "[SETTINGS] Theme mismatch detected! DOM data-theme:",
          currentDomTheme,
          "Settings theme:",
          this.settings.theme
        );
        console.log("[SETTINGS] Re-applying settings.theme...");
        this.applyTheme(this.settings.theme);
      }
    }, 100);

    console.log("[SETTINGS] Scheduling theme readiness update...");
    this.$nextTick(() => {
      console.log("[SETTINGS] Setting isThemeReady to true...");
      this.isThemeReady = true;
    });

    console.log("[SETTINGS] Forcing i18n update on mount...");
    if (this.$i18n) {
      const savedLanguage = localStorage.getItem("userLocale") || "en";
      console.log(
        "[SETTINGS] Saved language from localStorage:",
        savedLanguage
      );
      console.log("[SETTINGS] Setting i18n locale to:", savedLanguage);
      this.$i18n.locale = savedLanguage;
      console.log("[SETTINGS] Setting settings.language to:", savedLanguage);
      this.settings.language = savedLanguage;
      console.log("[SETTINGS] Scheduling $forceUpdate after i18n update...");
      this.$nextTick(() => {
        console.log(
          "[SETTINGS] Forcing component re-render after i18n update..."
        );
        this.$forceUpdate();
      });
    }

    console.log("Current locale:", this.$i18n.locale);
    console.log("Available locales:", this.$i18n.availableLocales);
    console.log(
      "Sample translation for deleteAccount:",
      this.$i18n.t("settings.deleteAccount"),
      this.$i18n.te("settings.deleteAccount") ? "exists" : "missing"
    );
  },
  // FIXED: Added beforeUnmount to replace $once('hook:beforeDestroy')
  beforeUnmount() {
    if (this.themeEnforcementInterval) {
      console.log("[SETTINGS] Cleaning up theme enforcement interval...");
      clearInterval(this.themeEnforcementInterval);
      this.themeEnforcementInterval = null;
    }
    console.log("[SETTINGS] Removing theme change event listener...");
    window.removeEventListener("themeChange", this.updateTheme);
  },
  methods: {
    getCurrentTheme() {
      console.log("[SETTINGS] Getting current theme...");
      let theme = localStorage.getItem("theme") || "light";
      console.log("[SETTINGS] Theme from localStorage:", theme);

      if (theme === "system") {
        console.log(
          "[SETTINGS] Theme set to 'system', checking OS preference..."
        );
        theme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
        console.log("[SETTINGS] Resolved system theme to:", theme);
      }
      return theme;
    },
    getCurrentLanguage() {
      console.log("[SETTINGS] Getting current language...");

      if (this.$i18n && this.$i18n.locale) {
        console.log("[SETTINGS] Language from i18n:", this.$i18n.locale);
        return this.$i18n.locale;
      }

      try {
        const savedLocale = localStorage.getItem("userLocale");
        if (savedLocale) {
          console.log("[SETTINGS] Language from localStorage:", savedLocale);
          return savedLocale;
        }
      } catch (e) {
        console.warn(
          "[SETTINGS] Error accessing localStorage for language:",
          e
        );
      }

      console.log("[SETTINGS] Defaulting to language: 'en'");
      return "en";
    },
    getSavedFontSize() {
      console.log("[SETTINGS] Getting saved font size...");
      try {
        const fontSize = localStorage.getItem("fontSize");
        if (fontSize) {
          console.log("[SETTINGS] Font size from localStorage:", fontSize);
          return parseInt(fontSize);
        }
        console.log("[SETTINGS] No font size found, defaulting to 50%");
        return 50;
      } catch (e) {
        console.warn(
          "[SETTINGS] Error accessing localStorage for font size:",
          e
        );
        return 50;
      }
    },
    getSavedPreference(key, defaultValue) {
      console.log(`[SETTINGS] Getting saved preference for ${key}...`);
      try {
        const value = localStorage.getItem(key);
        if (value !== null) {
          console.log(`[SETTINGS] Preference ${key} from localStorage:`, value);
          return JSON.parse(value);
        }
        console.log(
          `[SETTINGS] No preference for ${key}, defaulting to:`,
          defaultValue
        );
        return defaultValue;
      } catch (e) {
        console.warn(`[SETTINGS] Error accessing localStorage for ${key}:`, e);
        return defaultValue;
      }
    },
    translate(key, fallback = "") {
      console.log("[SETTINGS] Translating key:", key);
      if (!this.$i18n) {
        console.log(
          "[SETTINGS] No i18n instance, returning fallback:",
          fallback
        );
        return fallback;
      }
      try {
        console.log("[SETTINGS] Using locale:", this.currentLocale);
        const translation = this.$i18n.t(key, { locale: this.currentLocale });
        if (translation === key) {
          console.log(
            "[SETTINGS] Translation not found, using fallback:",
            fallback || key
          );
          return fallback || key;
        }
        console.log("[SETTINGS] Translation found:", translation);
        return translation;
      } catch (e) {
        console.error("[SETTINGS] Translation error:", e);
        console.log(
          "[SETTINGS] Returning fallback due to error:",
          fallback || key
        );
        return fallback || key;
      }
    },
    updateTheme() {
      console.log("[SETTINGS] Theme change event triggered");
      const currentTheme =
        document.documentElement.getAttribute("data-theme") || "light";
      console.log("[SETTINGS] Current theme from DOM:", currentTheme);
      if (this.settings.theme !== currentTheme) {
        console.log(
          "[SETTINGS] Updating settings.theme to match DOM:",
          currentTheme
        );
        this.settings.theme = currentTheme;
      }
      console.log("[SETTINGS] Resetting theme readiness...");
      this.isThemeReady = false;
      this.$nextTick(() => {
        console.log("[SETTINGS] Setting theme readiness to true...");
        this.isThemeReady = true;
        console.log(
          "[SETTINGS] Forcing component update after theme change..."
        );
        this.$forceUpdate();
      });
    },
    applyTheme(theme) {
      console.log("[SETTINGS] Theme button clicked:", theme);
      console.log("[SETTINGS] Updating settings.theme to:", theme);
      this.settings.theme = theme;
      console.log("[SETTINGS] Saving theme to localStorage...");
      localStorage.setItem("theme", theme);
      console.log("[SETTINGS] Theme saved successfully");
      try {
        console.log("[SETTINGS] Applying theme with ThemeManager...");
        if (themeManager && typeof themeManager.setTheme === "function") {
          console.log("[SETTINGS] Using ThemeManager.setTheme...");
          themeManager.setTheme(theme);
          console.log("[SETTINGS] Theme applied via ThemeManager");
        } else {
          console.log("[SETTINGS] ThemeManager unavailable, using fallback...");
          const effectiveTheme =
            theme === "system"
              ? window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light"
              : theme;
          console.log(
            "[SETTINGS] Effective theme resolved to:",
            effectiveTheme
          );
          console.log("[SETTINGS] Setting data-theme attribute on document...");
          document.documentElement.setAttribute("data-theme", effectiveTheme);
          document.body.setAttribute("data-theme", effectiveTheme);
          if (effectiveTheme === "dark") {
            console.log("[SETTINGS] Applying dark mode classes...");
            document.documentElement.classList.add("dark-mode");
            document.documentElement.classList.remove("light-mode");
            document.body.classList.remove("light-mode");
            document.body.classList.add("dark-mode");
          } else {
            console.log("[SETTINGS] Applying light mode classes...");
            document.documentElement.classList.remove("dark-mode");
            document.documentElement.classList.add("light-mode");
            document.body.classList.remove("dark-mode");
            document.body.classList.add("light-mode");
          }
          console.log("[SETTINGS] Fallback theme application completed");
        }
      } catch (e) {
        console.warn("[SETTINGS] Error applying theme:", e);
      }
      console.log("[SETTINGS] Emitting themeChanged event with theme:", theme);
      this.$emit("themeChanged", theme);
      console.log(
        "[SETTINGS] Forcing component re-render after theme change..."
      );
      this.$forceUpdate();
    },
    updateDialogTexts() {
      console.log("[SETTINGS] Updating dialog texts for current locale...");
      this.resetDataDialog = {
        title: this.translate("settings.resetUserDataTitle", "Reset User Data"),
        message: this.translate(
          "settings.confirmResetUserData",
          "Are you sure you want to reset all your profile data? This will clear all your profile information and chat history, but keep your account credentials."
        ),
        confirmText: this.translate("settings.reset", "Reset"),
        cancelText: this.translate("settings.cancel", "Cancel"),
      };
      this.deleteAccountDialog = {
        title: this.translate("settings.deleteAccountTitle", "Delete Account"),
        message: this.translate(
          "settings.confirmDeleteAccount",
          "Are you sure you want to delete your account? This action cannot be undone."
        ),
        confirmText: this.translate("settings.delete", "Delete"),
        cancelText: this.translate("settings.cancel", "Cancel"),
      };
      console.log("[SETTINGS] Dialog texts updated:", {
        resetDataDialog: this.resetDataDialog,
        deleteAccountDialog: this.deleteAccountDialog,
      });
    },
    async fetchUserData() {
      console.log("[SETTINGS] Fetching user data...");
      this.isLoading = true;
      this.errorMessage = null;
      try {
        console.log("[SETTINGS] Checking for cached user data...");
        let userData = userService.getCurrentUser();
        if (!userData) {
          console.log("[SETTINGS] No cached data, fetching from API...");
          userData = await userService.getCurrentUserInfo();
          console.log("[SETTINGS] User data fetched from API:", userData);
        } else {
          console.log(
            "[SETTINGS] Using cached data, refreshing in background..."
          );
          userService.refreshUserData().catch((err) => {
            console.warn("[SETTINGS] Background refresh failed:", err);
          });
        }
        console.log("[SETTINGS] Extracting user ID...");
        let userId = userData.id || userData.userId || userData._id || "";
        if (typeof userId === "string" && userId.includes("/")) {
          userId = userId.split("/").pop();
        }
        this.currentUserId = userId;
        console.log(
          "[SETTINGS] Stored user ID for authentication:",
          this.currentUserId
        );
        console.log("[SETTINGS] Updating userData state...");
        this.userData = {
          name:
            userData.fullName ||
            userData.loginName ||
            userData.username ||
            this.translate("settings.user"),
          email: userData.email || "",
          accountType:
            userData.accountType ||
            userData.role ||
            this.translate("settings.standardAccount"),
          userId: this.currentUserId,
          createdAt: userData.createdAt || "",
        };
        console.log("[SETTINGS] userData updated:", this.userData);
        if (userData.avatarUrl) {
          console.log("[SETTINGS] Setting user avatar:", userData.avatarUrl);
          this.userAvatar = userData.avatarUrl;
        }
      } catch (error) {
        console.error("[SETTINGS] Error fetching user data:", error);
        notificationService.error(this.translate("settings.unableToLoadUser"));
        console.log("[SETTINGS] Attempting to use fallback user data...");
        const fallbackUser = userService.getCurrentUser();
        if (fallbackUser) {
          console.log("[SETTINGS] Fallback user data found:", fallbackUser);
          let userId =
            fallbackUser.id || fallbackUser.userId || fallbackUser._id || "";
          if (typeof userId === "string" && userId.includes("/")) {
            userId = userId.split("/").pop();
          }
          this.currentUserId = userId;
          console.log("[SETTINGS] Fallback user ID:", this.currentUserId);
          this.userData = {
            name:
              fallbackUser.fullName ||
              fallbackUser.loginName ||
              this.translate("settings.user"),
            email: fallbackUser.email || "",
            accountType:
              fallbackUser.accountType || this.translate("settings.account"),
            userId: this.currentUserId,
            createdAt: fallbackUser.createdAt || "",
          };
          console.log("[SETTINGS] Fallback userData set:", this.userData);
        }
      } finally {
        console.log("[SETTINGS] Setting isLoading to false");
        this.isLoading = false;
      }
    },
    close() {
      console.log("[SETTINGS] Closing dialog without saving...");
      this.$emit("close");
    },
    save() {
      console.log("[SETTINGS] Saving settings...");
      notificationService.info(
        this.translate("settings.savingSettings", "Saving your settings..."),
        1000
      );
      const isChangingLanguage =
        this.$i18n && this.$i18n.locale !== this.settings.language;
      console.log("[SETTINGS] Is language changing?:", isChangingLanguage);
      if (this.$i18n) {
        console.log(
          "[SETTINGS] Saving language preference:",
          this.settings.language
        );
        this.$i18n.locale = this.settings.language;
        try {
          localStorage.setItem("userLocale", this.settings.language);
          console.log("[SETTINGS] Language preference saved to localStorage");
        } catch (e) {
          console.warn("[SETTINGS] Error saving language preference:", e);
        }
      }
      console.log("[SETTINGS] Applying theme to DOM:", this.settings.theme);
      document.documentElement.setAttribute("data-theme", this.settings.theme);
      document.body.setAttribute("data-theme", this.settings.theme);
      try {
        localStorage.setItem("theme", this.settings.theme);
        console.log("[SETTINGS] Theme preference saved to localStorage");
      } catch (e) {
        console.warn("[SETTINGS] Error saving theme preference:", e);
      }
      console.log("[SETTINGS] Saving font size:", this.settings.fontSize);
      try {
        localStorage.setItem("fontSize", this.settings.fontSize.toString());
        document.documentElement.style.fontSize = `${
          this.settings.fontSize / 50
        }rem`;
        console.log("[SETTINGS] Font size applied and saved");
      } catch (e) {
        console.warn("[SETTINGS] Error saving font size:", e);
      }
      console.log("[SETTINGS] Saving notification preferences...");
      try {
        localStorage.setItem(
          "emailUpdates",
          JSON.stringify(this.settings.emailUpdates)
        );
        localStorage.setItem(
          "soundNotifications",
          JSON.stringify(this.settings.soundNotifications)
        );
        console.log("[SETTINGS] Notification preferences saved:", {
          emailUpdates: this.settings.emailUpdates,
          soundNotifications: this.settings.soundNotifications,
        });
      } catch (e) {
        console.warn("[SETTINGS] Error saving notification preferences:", e);
      }
      console.log(
        "[SETTINGS] Emitting themeChanged event:",
        this.settings.theme
      );
      this.$emit("themeChanged", this.settings.theme);
      notificationService.success(
        this.translate("settings.settingsSaved", "Settings saved successfully!")
      );
      console.log("[SETTINGS] Closing dialog after saving...");
      this.$emit("close");
      if (isChangingLanguage) {
        console.log("[SETTINGS] Language changed, scheduling page reload...");
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    },
    confirmResetUserData() {
      console.log("[SETTINGS] Showing reset user data confirmation...");
      this.showResetDataConfirm = true;
    },
    handleResetDataConfirm() {
      console.log("[SETTINGS] User confirmed reset user data...");
      this.showResetDataConfirm = false;
      this.resetUserData();
    },
    handleResetDataCancel() {
      console.log("[SETTINGS] User cancelled reset user data...");
      this.showResetDataConfirm = false;
    },
    async resetUserData() {
      console.log("[SETTINGS] Resetting user data...");
      try {
        this.isLoading = true;
        console.log("[SETTINGS] Calling userService.resetUserData...");
        const response = await userService.resetUserData();
        console.log("[SETTINGS] Reset user data response:", response);
        notificationService.success(
          this.translate(
            "settings.userDataReset",
            "Your profile data has been successfully reset."
          )
        );
        console.log("[SETTINGS] Refreshing user data after reset...");
        await this.fetchUserData();
        console.log(
          "[SETTINGS] Clearing localStorage except theme and language..."
        );
        const themeValue = localStorage.getItem("theme");
        const langValue = localStorage.getItem("userLocale");
        localStorage.clear();
        if (themeValue) localStorage.setItem("theme", themeValue);
        if (langValue) localStorage.setItem("userLocale", langValue);
        console.log("[SETTINGS] Restored theme and language to localStorage");
      } catch (e) {
        console.error("[SETTINGS] Error resetting user data:", e);
        notificationService.error(
          this.translate(
            "settings.failedToResetUserData",
            "Failed to reset your profile data. Please try again later."
          )
        );
      } finally {
        console.log("[SETTINGS] Setting isLoading to false after reset...");
        this.isLoading = false;
      }
    },
    toggleEmailEdit() {
      console.log("[SETTINGS] Toggling email edit state...");
      if (this.isEditingEmail) {
        console.log("[SETTINGS] Saving email changes...");
        this.prepareEmailChange();
      } else {
        console.log("[SETTINGS] Enabling email editing...");
        this.isEditingEmail = true;
        this.newEmail = this.userData.email;
        console.log("[SETTINGS] Original email stored:", this.newEmail);
      }
    },
    confirmDeleteAccount() {
      console.log("[SETTINGS] Showing delete account confirmation...");
      this.showDeleteAccountConfirm = true;
    },
    handleDeleteAccountConfirm() {
      console.log("[SETTINGS] User confirmed delete account...");
      this.showDeleteAccountConfirm = false;
      this.showDeleteAccountModal = true;
    },
    handleDeleteAccountCancel() {
      console.log("[SETTINGS] User cancelled delete account...");
      this.showDeleteAccountConfirm = false;
    },
    async processAccountDeletion() {
      console.log("[SETTINGS] Processing account deletion...");
      if (!this.deleteAccountPassword) {
        console.log("[SETTINGS] Password missing for account deletion");
        notificationService.error(
          this.translate(
            "settings.pleaseEnterPassword",
            "Please enter your password to confirm deletion"
          )
        );
        return;
      }
      try {
        console.log("[SETTINGS] Initiating account deletion...");
        this.isDeletingAccount = true;
        this.deleteAccountError = null;
        console.log("[SETTINGS] Calling userService.deleteAccount...");
        await userService.deleteAccount(
          this.deleteAccountPassword,
          this.deleteAccountReason
        );
        console.log("[SETTINGS] Account deletion successful");
        notificationService.success(
          this.translate(
            "settings.accountDeletedSuccess",
            "Your account has been deleted successfully."
          )
        );
        console.log("[SETTINGS] Closing delete account modal...");
        this.showDeleteAccountModal = false;
        console.log("[SETTINGS] Redirecting to login page...");
        window.location.href = "/login";
      } catch (error) {
        console.error("[SETTINGS] Error deleting account:", error);
        if (error.response && error.response.status === 403) {
          console.log("[SETTINGS] Incorrect password for account deletion");
          notificationService.error(
            this.translate("settings.incorrectPassword", "Incorrect password")
          );
        } else {
          console.log("[SETTINGS] General error during account deletion");
          notificationService.error(
            this.translate(
              "settings.accountDeletionFailed",
              "Failed to delete account. Please try again later."
            )
          );
        }
      } finally {
        console.log("[SETTINGS] Setting isDeletingAccount to false...");
        this.isDeletingAccount = false;
      }
    },
    cancelAccountDeletion() {
      console.log("[SETTINGS] Cancelling account deletion...");
      this.showDeleteAccountModal = false;
      this.deleteAccountPassword = "";
      this.deleteAccountReason = "";
      this.deleteAccountError = null;
      console.log("[SETTINGS] Account deletion cancelled, state reset");
    },
    initiatePasswordChange() {
      console.log("[SETTINGS] Initiating password change...");
      this.showPasswordReset = true;
    },
    handlePasswordResetInitiated(email) {
      console.log("[SETTINGS] Password reset initiated for:", email);
      setTimeout(() => {
        console.log("[SETTINGS] Closing password reset modal...");
        this.showPasswordReset = false;
        notificationService.success(
          this.translate(
            "settings.passwordResetInitiated",
            "A password reset link has been sent to your email address."
          )
        );
      }, 1500);
    },
    cancelPasswordReset() {
      console.log("[SETTINGS] Cancelling password reset...");
      this.showPasswordReset = false;
    },
    async prepareEmailChange() {
      console.log("[SETTINGS] Preparing email change...");
      this.emailError = null;
      console.log("[SETTINGS] Validating email format...");
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.userData.email)) {
        console.log("[SETTINGS] Invalid email format:", this.userData.email);
        notificationService.error(this.translate("settings.enterValidEmail"));
        return;
      }
      if (this.userData.email === this.newEmail) {
        console.log("[SETTINGS] Email unchanged, exiting edit mode...");
        this.isEditingEmail = false;
        return;
      }
      try {
        console.log(
          `[SETTINGS] Checking availability for ${this.userData.email}`
        );
        const isAvailable = await userService.checkEmailAvailability(
          this.userData.email
        );
        console.log("[SETTINGS] Email availability check result:", isAvailable);
        if (!isAvailable) {
          console.log("[SETTINGS] Email already in use:", this.userData.email);
          notificationService.error(
            this.translate("settings.emailAlreadyInUse")
          );
          return;
        }
        console.log("[SETTINGS] Email available, proceeding with change...");
        this.newEmail = this.userData.email;
        this.showEmailConfirmModal = true;
      } catch (error) {
        console.error("[SETTINGS] Error checking email availability:", error);
        notificationService.error(
          this.translate("settings.unableToVerifyEmail")
        );
      }
    },
    async confirmEmailChange() {
      console.log("[SETTINGS] Confirming email change...");
      if (!this.emailChangePassword) {
        console.log("[SETTINGS] Password missing for email change");
        notificationService.error(
          this.translate("settings.pleaseEnterPassword")
        );
        return;
      }
      console.log("[SETTINGS] Setting isEmailUpdating to true...");
      this.isEmailUpdating = true;
      this.emailChangeError = null;
      try {
        console.log(
          "[SETTINGS] Confirming email change to:",
          this.userData.email
        );
        console.log(
          "[SETTINGS] Using userId for authentication:",
          this.currentUserId
        );
        console.log("[SETTINGS] Calling userService.updateEmail...");
        const response = await userService.updateEmail(
          this.userData.email,
          this.emailChangePassword,
          this.currentUserId
        );
        console.log("[SETTINGS] Email update response:", response);
        notificationService.info(
          this.translate("settings.checkNewEmailVerification")
        );
        console.log("[SETTINGS] Closing email change modal...");
        this.showEmailConfirmModal = false;
        this.isEditingEmail = false;
        console.log("[SETTINGS] Scheduling logout after email change...");
        setTimeout(() => {
          userService
            .logout()
            .then(() => {
              console.log(
                "[SETTINGS] Logout successful, redirecting to login..."
              );
              window.location.href = "/login";
            })
            .catch((err) => {
              console.error("[SETTINGS] Logout error:", err);
              console.log("[SETTINGS] Redirecting to login despite error...");
              window.location.href = "/login";
            });
        }, 1500);
      } catch (error) {
        console.error("[SETTINGS] Error updating email:", error);
        notificationService.error(
          this.translate("settings.failedToUpdateEmail")
        );
      } finally {
        console.log("[SETTINGS] Setting isEmailUpdating to false...");
        this.isEmailUpdating = false;
      }
    },
    cancelEmailChange() {
      console.log("[SETTINGS] Cancelling email change...");
      this.showEmailConfirmModal = false;
      this.emailChangePassword = "";
      this.emailChangeError = null;
      console.log("[SETTINGS] Email change cancelled, state reset");
    },
  },
  watch: {
    "settings.theme"(newTheme) {
      console.log("[SETTINGS] settings.theme changed to:", newTheme);
      this.$forceUpdate();
    },
    "settings.language": function () {
      console.log("[SETTINGS] Language changed, updating dialog texts...");
      this.updateDialogTexts();
    },
    currentLocale: function () {
      console.log(
        "[SETTINGS] Current locale changed, updating dialog texts..."
      );
      this.updateDialogTexts();
    },
  },
};
</script>

<style scoped>
/* Settings dialog styling */
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--dialog-overlay-background, rgba(0, 0, 0, 0.5));
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.settings-dialog {
  width: 800px;
  height: auto;
  max-width: 95vw;
  max-height: 95vh;
  border-radius: 8px;
  background-color: var(--dialog-background, #ffffff) !important;
  box-shadow: var(--dialog-box-shadow, 0 4px 12px rgba(0, 0, 0, 0.15));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* Header with buttons */
.dialog-header {
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--dialog-border-color, #dcdfe4);
}

.header-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.header-title[data-themed="true"] {
  color: var(--dialog-title-color, #333333) !important;
}

/* Fallback override for dark mode */
[data-theme="dark"]
  .settings-dialog
  .dialog-header
  .header-title[data-themed="true"] {
  color: #f0f0f0 !important;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

/* Loading indicator */
.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  height: 300px;
  color: var(--dialog-text-color, #666666);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: var(--bg-button-primary, #4e97d1);
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Error container */
.error-container {
  padding: 2rem;
  text-align: center;
}

.error-message {
  color: var(--text-danger, #dc3545);
  margin-bottom: 1rem;
}

.btn-retry {
  padding: 0.5rem 1.5rem;
  background-color: var(--bg-button-secondary, #d1d5db);
  color: var(--text-button-secondary, #333333);
  border: 1px solid var(--dialog-border-color, #dcdfe4);
  border-radius: 4px;
  cursor: pointer;
}

/* Profile section */
.profile-section {
  padding: 1rem 1.5rem;
  background-color: var(--bg-section, rgba(0, 0, 0, 0.02));
  display: flex;
  align-items: center;
  gap: 1rem;
}

.account-avatar {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-button-primary, #4e97d1);
  color: white;
  font-size: 1.5rem;
  font-weight: 500;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.account-details {
  flex: 1;
}

.user-name {
  font-size: 1.25rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
  color: var(--dialog-title-color, #333333);
}

.user-email {
  color: var(--text-secondary, #4d4d4d);
  margin-bottom: 0.25rem;
}

.account-type {
  color: var(--text-tertiary, #767676);
  font-size: 0.875rem;
  font-weight: 500;
}

/* Main settings area */
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  padding: 1rem 1.5rem;
}

.settings-box {
  background-color: var(--bg-section, rgba(0, 0, 0, 0.02));
  border-radius: 6px;
  padding: 1rem;
}

.section-title {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--dialog-title-color, #333333) !important;
}

/* Fallback override for dark mode */
[data-theme="dark"] .settings-dialog .section-title {
  color: #f0f0f0 !important;
}

.setting-item {
  margin-bottom: 1rem;
}

.section-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 1rem;
  font-weight: 400;
  color: var(--dialog-text-color, #666666);
}

/* Override text colors for dark mode */
[data-theme="dark"] .settings-dialog .section-label {
  color: rgba(255, 255, 255, 0.8) !important;
}

/* Toggle row */
.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Account management */
.account-management-section {
  padding: 0 1.5rem 1rem;
}

.account-management-grid {
  background-color: var(--bg-section, rgba(0, 0, 0, 0.02));
  padding: 1rem;
  border-radius: 6px;
  display: grid;
  gap: 1rem;
}

.management-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.management-row:last-child {
  margin-bottom: 0;
}

.management-col {
  min-width: 0;
}

/* Error text */
.error-text {
  color: var(--text-danger, #dc3545);
  font-size: 0.875rem;
  margin-top: 0.25rem;
  margin-bottom: 0;
}

/* Theme buttons styling */
.theme-buttons {
  display: flex;
  gap: 0.5rem;
}

.theme-toggle {
  flex: 1;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  text-align: center;
  font-weight: 500;
  transition: all 0.2s;
  background-color: var(--bg-button-secondary, #d1d5db);
  color: var(--text-button-secondary, #333333);
  border: 1px solid var(--dialog-border-color, #dcdfe4);
}

.theme-toggle.active {
  background-color: var(--bg-button-primary, #4e97d1) !important;
  color: var(--text-button-primary, #ffffff) !important;
  border-color: var(--bg-button-primary, #4e97d1) !important;
}

/* Dropdown styling */
.dropdown {
  width: 100%;
  padding: 0.5rem;
  border-radius: 4px;
  background-color: var(--bg-input, #ffffff);
  color: var(--text-primary, #333333);
  border: 1px solid var(--dialog-border-color, #dcdfe4);
}

/* Slider styling */
.slider-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--slider-track, #e9ecef);
  outline: none;
  border-radius: 2px;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--slider-thumb, #4e97d1);
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--slider-thumb, #4e97d1);
  cursor: pointer;
  border: none;
}

.slider-value {
  min-width: 3rem;
  text-align: right;
  color: var(--dialog-text-color, #666666);
}

/* Switch toggle */
.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
  cursor: pointer;
}

.switch-track {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--switch-track-off, #d0d0d0);
  border-radius: 12px;
  transition: 0.4s;
}

.switch-thumb {
  position: absolute;
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: var(--switch-thumb, #ffffff);
  border-radius: 50%;
  transition: 0.4s;
}

.switch-track.active .switch-thumb {
  transform: translateX(26px);
}

.switch-track.active {
  background-color: var(--switch-track-on, #4e97d1);
}

/* Text input styling */
.text-input {
  width: 100%;
  padding: 0.5rem;
  border-radius: 4px;
  background-color: var(--bg-input, #ffffff);
  color: var(--text-primary, #333333);
  border: 1px solid var(--dialog-border-color, #dcdfe4);
}

.input-with-button {
  display: flex;
  gap: 0.5rem;
}

.input-with-button .text-input {
  flex: 1;
}

/* Buttons */
.btn-close,
.btn-save,
.btn-secondary {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  border: none;
  transition: all 0.2s;
}

.btn-secondary {
  background-color: var(--bg-button-secondary, #d1d5db);
  color: var(--text-button-secondary, #333333);
  border: 1px solid var(--dialog-border-color, #dcdfe4);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.full-width {
  width: 100%;
}

.btn-danger {
  width: 100%;
  padding: 0.6rem 1.25rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  border: none;
  background-color: var(--bg-danger, #dc3545);
  color: white;
  transition: all 0.2s;
}

.btn-danger:hover {
  background-color: var(--bg-danger-hover, #c82333);
}

.btn-save {
  background-color: var(--bg-button-primary, #4e97d1);
  color: var(--text-button-primary, #ffffff);
}

/* Removed hardcoded dark mode override for btn-save */
/* Let btn-save use theme variables defined in theme-variables.css */

.btn-close {
  background-color: var(--bg-button-secondary, #d1d5db);
  color: var(--text-button-secondary, #333333);
}

/* Override button colors for dark mode */
[data-theme="dark"] .settings-dialog .btn-close {
  background-color: #444444 !important;
  color: #f0f0f0 !important;
}

.description-text {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-tertiary, #767676);
}

.danger-text {
  color: var(--text-danger, #dc3545);
}

/* Modal styling */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--dialog-overlay-background, rgba(0, 0, 0, 0.5));
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  width: 450px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  background-color: var(--dialog-background, #ffffff);
  border-radius: 8px;
  box-shadow: var(--dialog-box-shadow, 0 4px 12px rgba(0, 0, 0, 0.15));
}

.modal-title {
  padding: 1rem 1.5rem;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  border-bottom: 1px solid var(--dialog-border-color, #dcdfe4);
  color: var(--dialog-title-color, #333333);
}

.modal-body {
  padding: 1.5rem;
  color: var(--dialog-text-color, #666666);
}

/* Override text colors for dark mode */
[data-theme="dark"] .settings-dialog .modal-body {
  color: rgba(255, 255, 255, 0.8) !important;
}

.modal-body ul {
  margin-top: 0.5rem;
  margin-bottom: 1.5rem;
  padding-left: 1.5rem;
}

.modal-body ul li {
  margin-bottom: 0.5rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  border-top: 1px solid var(--dialog-border-color, #dcdfe4);
}

/* Password Reset Dialog Styles */
.password-reset-modal {
  width: 400px;
  padding: 1.5rem;
  color: #fff;
  background-color: #333;
}

.logo {
  text-align: center;
  margin-bottom: 1rem;
}

.app-logo {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: var(--bg-button-primary, #4e97d1);
  margin-bottom: 0.5rem;
}

.vue-logo {
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-bottom: 16px solid #fff;
}

.app-name {
  font-size: 1.5rem;
  color: #fff;
  margin: 0;
  font-weight: 500;
}

.password-reset-heading {
  text-align: center;
  font-size: 1.2rem;
  margin-top: 0;
  margin-bottom: 1.5rem;
  font-weight: 500;
  color: #ddd;
}

.password-reset-form {
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #ddd;
  font-weight: 500;
}

.form-control {
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-size: 0.9375rem;
  border: none;
  border-radius: 6px;
  background-color: #222;
  color: #fff;
  transition: background-color 0.2s;
}

.form-control:focus {
  outline: none;
  background-color: #2a2a2a;
}

.error-message {
  color: #ff6b6b;
  font-size: 0.75rem;
  margin-top: 0.25rem;
  margin-bottom: 0;
}

.reset-button {
  width: 100%;
  padding: 0.625rem;
  background-color: var(--bg-button-primary, #4e97d1);
  color: var(--text-button-primary, #ffffff);
  font-size: 0.9375rem;
  font-weight: bold;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.reset-button:hover:not(:disabled) {
  background-color: var(--bg-button-primary-hover, #3a7da0);
}

.reset-button:disabled {
  background-color: #3a7da8;
  cursor: not-allowed;
  opacity: 0.7;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .settings-dialog {
    width: 95vw;
    height: 90vh;
    max-height: 90vh;
    overflow-y: auto;
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }

  .management-row {
    grid-template-columns: 1fr;
  }

  .account-management-grid {
    display: flex;
    flex-direction: column;
  }

  .dialog-header {
    position: sticky;
    top: 0;
    background-color: var(--dialog-background, #ffffff);
    z-index: 10;
  }

  .input-with-button {
    flex-wrap: wrap;
  }

  .input-with-button .text-input {
    width: calc(100% - 70px);
  }

  .input-with-button .btn-secondary {
    width: 60px;
  }
}

/* Password strength indicator */
.password-strength-indicator {
  margin-top: 0.5rem;
  font-size: 0.75rem;
}

.strength-label {
  margin-bottom: 0.25rem;
  color: #ddd;
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
  margin-bottom: 0.5rem;
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
  margin: 0.5rem 0 0;
  color: #aaa;
}

.strength-suggestions li {
  margin-bottom: 0.25rem;
  line-height: 1.2;
  font-size: 0.75rem;
}

.strength-suggestions li::before {
  content: "• ";
  color: var(--bg-button-primary, #4e97d1);
}

.password-reset-modal-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2001;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--dialog-overlay-background, rgba(0, 0, 0, 0.5));
}

.warning-text {
  color: var(--text-warning, #f5a623);
  font-weight: 500;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background-color: rgba(245, 166, 35, 0.1);
  border-left: 3px solid var(--text-warning, #f5a623);
  border-radius: 4px;
}

/* Add themed styles for modal components */
.modal-content[data-theme="dark"] {
  background-color: var(--dialog-background, #2a2a2a);
  color: var(--dialog-text-color, rgba(255, 255, 255, 0.8));
}

.modal-content[data-theme="dark"] .modal-title,
.modal-content[data-theme="dark"] label[data-themed="true"] {
  color: var(--dialog-title-color, #f0f0f0);
}

.modal-content[data-theme="dark"] .modal-footer {
  border-top-color: var(--dialog-border-color, #444444);
}

.modal-content[data-theme="dark"] .modal-title {
  border-bottom-color: var(--dialog-border-color, #444444);
}

.modal-content[data-theme="dark"] .text-input {
  background-color: var(--bg-input, #333333);
  color: var(--text-primary, #f0f0f0);
  border-color: var(--dialog-border-color, #555555);
}

.modal-title[data-themed="true"] {
  color: var(--dialog-title-color, #333333);
}

.modal-content[data-theme="dark"] .modal-title[data-themed="true"],
.modal-content[data-theme="dark"] p[data-themed="true"] {
  color: var(--dialog-title-color, #f0f0f0);
}
</style>