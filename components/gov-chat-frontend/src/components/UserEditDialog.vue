<template>
  <div class="modal" :data-theme="theme">
    <div class="overlay" @click="$emit('close')"></div>
    <div class="modal-content">
      <div class="modal-title">
        <h2>{{ translate("admin.userEdit.title", "Edit User") }}</h2>
        <button
          class="close-btn"
          @click="$emit('close')"
          aria-label="Close dialog"
        >
          ×
        </button>
      </div>

      <div class="modal-body">
        <!-- Loading indicator -->
        <div class="loading-overlay" v-if="isLoading">
          <div class="loading-spinner"></div>
          <p>
            {{ translate("admin.userEdit.loading", "Loading user data...") }}
          </p>
        </div>

        <!-- Horizontal layout for sections -->
        <div class="content-wrapper">
          <!-- User Information Section -->
          <div class="user-info-section">
            <h3>
              {{ translate("admin.userEdit.userInfo", "User Information") }}
            </h3>
            <div class="info-grid">
              <div class="info-row">
                <span class="info-label"
                  >{{ translate("admin.userEdit.userId", "User ID") }}:</span
                >
                <span class="info-value">{{
                  userData._key || userData.userId
                }}</span>
              </div>
              <div class="info-row">
                <span class="info-label"
                  >{{
                    translate("admin.userEdit.loginName", "Login Name")
                  }}:</span
                >
                <span class="info-value">{{ userData.loginName }}</span>
              </div>
              <div class="info-row">
                <span class="info-label"
                  >{{
                    translate("admin.userEdit.fullName", "Full Name")
                  }}:</span
                >
                <span class="info-value">{{
                  userData.personalIdentification?.fullName || "-"
                }}</span>
              </div>
              <div class="info-row">
                <span class="info-label"
                  >{{ translate("admin.userEdit.dob", "Date of Birth") }}:</span
                >
                <span class="info-value">{{
                  userData.personalIdentification?.dob || "-"
                }}</span>
              </div>
              <div class="info-row">
                <span class="info-label"
                  >{{ translate("admin.userEdit.email", "Email") }}:</span
                >
                <span class="info-value">{{ userData.email }}</span>
              </div>
              <div class="info-row">
                <span class="info-label"
                  >{{
                    translate("admin.userEdit.emailVerified", "Email Verified")
                  }}:</span
                >
                <span class="info-value">
                  <span
                    :class="[
                      'status-badge',
                      userData.emailVerified ? 'status-good' : 'status-error',
                    ]"
                  ></span>
                  {{
                    userData.emailVerified
                      ? translate("admin.userEdit.verified", "Verified")
                      : translate("admin.userEdit.notVerified", "Not Verified")
                  }}
                </span>
              </div>
              <div class="info-row">
                <span class="info-label"
                  >{{ translate("admin.userEdit.createdAt", "Created") }}:</span
                >
                <span class="info-value">{{
                  formatDate(userData.createdAt)
                }}</span>
              </div>
              <div class="info-row">
                <span class="info-label"
                  >{{
                    translate("admin.userEdit.lastLogin", "Last Login")
                  }}:</span
                >
                <span class="info-value">{{
                  userData.lastLogin
                    ? formatDate(userData.lastLogin)
                    : translate("admin.userEdit.never", "Never")
                }}</span>
              </div>
            </div>
          </div>

          <!-- Account Settings and Admin Actions combined vertically on the right -->
          <div class="settings-actions-wrapper">
            <!-- Account Settings Section -->
            <div class="account-settings-section">
              <h3>
                {{
                  translate(
                    "admin.userEdit.accountSettings",
                    "Account Settings"
                  )
                }}
              </h3>
              <div class="settings-grid">
                <div class="settings-card">
                  <div class="card-header">
                    <h4>
                      {{
                        translate(
                          "admin.userEdit.accountStatus",
                          "Account Status"
                        )
                      }}
                    </h4>
                  </div>
                  <div class="card-body">
                    <div class="toggle-wrapper">
                      <div class="toggle-label">
                        {{
                          translate(
                            "admin.userEdit.accountEnabled",
                            "Account Enabled"
                          )
                        }}
                      </div>
                      <label class="toggle">
                        <input
                          type="checkbox"
                          v-model="userSettings.enabled"
                          :disabled="isCurrentUser || isSaving"
                        />
                        <span class="slider"></span>
                      </label>
                    </div>
                    <div class="setting-hint" v-if="isCurrentUser">
                      {{
                        translate(
                          "admin.userEdit.cannotDisableSelf",
                          "You cannot disable your own account"
                        )
                      }}
                    </div>
                  </div>
                </div>
                <div class="settings-card">
                  <div class="card-header">
                    <h4>
                      {{
                        translate("admin.userEdit.accountRole", "Account Role")
                      }}
                    </h4>
                  </div>
                  <div class="card-body">
                    <div class="toggle-wrapper">
                      <div class="toggle-label">
                        {{
                          translate("admin.userEdit.adminRole", "Admin Role")
                        }}
                      </div>
                      <label class="toggle">
                        <input
                          type="checkbox"
                          v-model="userSettings.isAdmin"
                          :disabled="isCurrentUser || isSaving"
                        />
                        <span class="slider"></span>
                      </label>
                    </div>
                    <div class="setting-hint" v-if="isCurrentUser">
                      {{
                        translate(
                          "admin.userEdit.cannotChangeOwnRole",
                          "You cannot change your own role"
                        )
                      }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Admin Actions Section -->
            <div class="admin-actions-section">
              <h3>
                {{ translate("admin.userEdit.adminActions", "Admin Actions") }}
              </h3>
              <div class="actions-grid">
                <button
                  class="action-button verify-email-button"
                  @click="verifyEmail"
                  :disabled="isSaving"
                >
                  {{ translate("admin.userEdit.verifyEmail", "Verify Email") }}
                </button>
                <button
                  class="action-button reset-password-button"
                  @click="resetPassword"
                  :disabled="!userData.email || isSaving"
                >
                  {{
                    translate(
                      "admin.userEdit.resetPassword",
                      "Send Password Reset"
                    )
                  }}
                </button>
                <button
                  class="action-button force-logout-button"
                  @click="forceLogout"
                  :disabled="!userData.accessToken || isSaving"
                >
                  {{ translate("admin.userEdit.forceLogout", "Force Logout") }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <div class="footer-content">
          <div class="footer-message" v-if="operationMessage">
            <span
              :class="['message', operationSuccess ? 'success' : 'error']"
              >{{ operationMessage }}</span
            >
          </div>
          <div class="footer-actions">
            <button class="btn btn-outline" @click="$emit('close')">
              {{ translate("admin.operations.cancel", "Cancel") }}
            </button>
            <button
              class="btn btn-primary"
              @click="saveChanges"
              :disabled="!hasChanges || isSaving"
            >
              <span class="btn-content">
                <svg
                  v-if="isSaving"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="spin-icon"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                {{ translate("admin.operations.save", "Save Changes") }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
  
  <script>
import userService from "../services/userService";
import userProfileService from "../services/userProfileService";

export default {
  name: "UserEditDialog",
  props: {
    userId: {
      type: String,
      required: true,
    },
    currentUserId: {
      type: String,
      required: true,
    },
    theme: {
      type: String,
      default: "light",
    },
  },
  emits: ["close", "user-updated"],
  data() {
    return {
      // Current locale for translations (copied from AdminDashboard)
      currentLocale: this.getCurrentLanguage(),

      // User data
      userData: {},
      originalUserData: {},

      // User settings that can be modified
      userSettings: {
        enabled: true,
        isAdmin: false,
      },
      originalSettings: {
        enabled: true,
        isAdmin: false,
      },

      // State flags
      isLoading: true,
      isSaving: false,
      operationMessage: "",
      operationSuccess: false,

      // Timestamps for auto-clearing messages
      messageTimer: null,
    };
  },
  computed: {
    isCurrentUser() {
      // Check if the user being edited is the current logged-in user
      return this.userId === this.currentUserId;
    },
    hasChanges() {
      // Check if settings have been changed
      return (
        this.userSettings.enabled !== this.originalSettings.enabled ||
        this.userSettings.isAdmin !== this.originalSettings.isAdmin
      );
    },
  },
  created() {
    // Load user data when component is created
    this.loadUserData();
  },
  beforeUnmount() {
    // Clear any pending timers
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
    }
  },
  methods: {
    // Translation method (copied from AdminDashboard for consistency)
    translate(key, fallback = "") {
      if (!this.$i18n) return fallback;
      try {
        // Force the correct locale
        const translation = this.$i18n.t(key, { locale: this.currentLocale });
        if (translation === key) {
          return fallback || key;
        }
        return translation;
      } catch (e) {
        console.error("Translation error:", e);
        return fallback || key;
      }
    },

    // Get current language (copied from AdminDashboard)
    getCurrentLanguage() {
      // First try to get from i18n instance
      if (this.$i18n && this.$i18n.locale) {
        return this.$i18n.locale;
      }

      // Fallback to localStorage
      try {
        const savedLocale = localStorage.getItem("userLocale");
        if (savedLocale) {
          return savedLocale;
        }
      } catch (e) {
        console.warn("Error accessing localStorage for language:", e);
      }

      // Default to English if nothing else works
      return "en";
    },

    // Format date for display
    formatDate(dateString) {
      if (!dateString) return "-";

      try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat(this.currentLocale, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
      } catch (e) {
        console.error("Date formatting error:", e);
        return dateString;
      }
    },

    // Load user data from the server
    async loadUserData() {
      try {
        this.isLoading = true;
        this.operationMessage = "";

        // Call service to get user data - using userProfileService for detailed profile data
        const userData = await userProfileService.getProfile(this.userId);

        if (userData) {
          this.userData = userData;
          this.originalUserData = { ...userData };

          // Initialize settings based on user data
          this.userSettings.enabled = !this.userData.disabled;
          this.userSettings.isAdmin = this.userData.role === "Admin";

          // Save original settings for comparison
          this.originalSettings.enabled = this.userSettings.enabled;
          this.originalSettings.isAdmin = this.userSettings.isAdmin;
        } else {
          this.showMessage(
            this.translate(
              "admin.userEdit.failedToLoad",
              "Failed to load user data"
            ),
            false
          );
        }
      } catch (error) {
        console.error("Error loading user data:", error);
        this.showMessage(
          this.translate(
            "admin.userEdit.errorLoading",
            "Error loading user data"
          ),
          false
        );
      } finally {
        this.isLoading = false;
      }
    },

    // Save changes to user settings
    async saveChanges() {
      try {
        this.isSaving = true;
        this.operationMessage = "";

        // For debugging
        console.log("Current settings:", {
          enabled: this.userSettings.enabled,
          isAdmin: this.userSettings.isAdmin,
        });
        console.log("Original settings:", {
          enabled: this.originalSettings.enabled,
          isAdmin: this.originalSettings.isAdmin,
        });

        // Track if we have changes to make
        const roleChanged =
          this.userSettings.isAdmin !== this.originalSettings.isAdmin;
        const enabledChanged =
          this.userSettings.enabled !== this.originalSettings.enabled;

        console.log("Changes detected:", { roleChanged, enabledChanged });

        // Prepare update data
        const updateData = {};

        if (roleChanged) {
          updateData.role = this.userSettings.isAdmin ? "Admin" : "User";
        }

        if (enabledChanged) {
          updateData.disabled = !this.userSettings.enabled; // Note: API expects 'disabled' (true when account is disabled)
        }

        console.log("Update data being sent:", updateData);

        // Only proceed if we have changes
        if (Object.keys(updateData).length > 0) {
          // Try to use userProfileService.updateProfile which should handle both properties
          console.log(`Saving changes for user ${this.userId}`);

          try {
            const response = await userProfileService.updateProfile(
              this.userId,
              updateData
            );
            console.log("Response from update:", response);

            if (response && response.success) {
              // Update original settings
              if (roleChanged)
                this.originalSettings.isAdmin = this.userSettings.isAdmin;
              if (enabledChanged)
                this.originalSettings.enabled = this.userSettings.enabled;

              this.showMessage(
                this.translate(
                  "admin.userEdit.saveSuccess",
                  "User settings updated successfully"
                ),
                true
              );

              // Emit event to parent component
              this.$emit("user-updated", {
                userId: this.userId,
                changes: updateData,
              });
            } else {
              let errorMessage = "Failed to update user settings";
              if (response && response.message) {
                errorMessage = response.message;
              }
              this.showMessage(errorMessage, false);
            }
          } catch (error) {
            console.error("Error saving user settings:", error);
            this.showMessage(
              error.message ||
                this.translate(
                  "admin.userEdit.errorSaving",
                  "Error saving user settings"
                ),
              false
            );
          }
        } else {
          console.log("No changes detected, skipping update");
          this.showMessage(
            this.translate("admin.userEdit.noChanges", "No changes to save"),
            true
          );
        }
      } catch (error) {
        console.error("Unexpected error in saveChanges:", error);
        this.showMessage(
          this.translate(
            "admin.userEdit.errorSaving",
            "Error saving user settings"
          ),
          false
        );
      } finally {
        this.isSaving = false;
      }
    },

    // Manually verify user's email
    // Manually verify user's email
    async verifyEmail() {
      try {
        this.isSaving = true;
        this.operationMessage = "";

        // Call the new admin-specific method to resend verification email
        const response = await userService.resendVerificationEmailAdmin(
          this.userId
        );

        if (response && response.success) {
          // Update user data to reflect that email verification is pending
          this.userData.emailVerified = false;
          this.showMessage(
            this.translate(
              "admin.userEdit.verifyEmailSuccess",
              "Verification email sent successfully"
            ),
            true
          );

          // Emit event to parent component
          this.$emit("user-updated", {
            userId: this.userId,
            changes: { emailVerified: false },
          });
        } else {
          this.showMessage(
            this.translate(
              "admin.userEdit.emailVerificationFailed",
              "Failed to send verification email"
            ),
            false
          );
        }
      } catch (error) {
        console.error("Error resending verification email:", error);
        this.showMessage(
          this.translate(
            "admin.userEdit.errorVerifyingEmail",
            "Error sending verification email"
          ),
          false
        );
      } finally {
        this.isSaving = false;
      }
    },

    // Send password reset email
    async resetPassword() {
      try {
        this.isSaving = true;
        this.operationMessage = "";

        // Call service to send password reset email - using existing method
        const response = await userService.initiatePasswordReset(
          this.userData.email
        );

        if (response && response.success) {
          this.showMessage(
            this.translate(
              "admin.userEdit.passwordResetSent",
              "Password reset email sent"
            ),
            true
          );
        } else {
          this.showMessage(
            this.translate(
              "admin.userEdit.passwordResetFailed",
              "Failed to send password reset"
            ),
            false
          );
        }
      } catch (error) {
        console.error("Error sending password reset:", error);
        this.showMessage(
          this.translate(
            "admin.userEdit.errorSendingReset",
            "Error sending password reset"
          ),
          false
        );
      } finally {
        this.isSaving = false;
      }
    },

    // Force user logout by invalidating access token
    async forceLogout() {
      try {
        this.isSaving = true;
        this.operationMessage = "";

        const response = await userService.forceUserLogout(this.userId);
        console.log(
          "[FORCE LOGOUT DEBUG] Response:",
          JSON.stringify(response, null, 2)
        );

        if (response && response.success) {
          this.userData.accessToken = null;
          this.showMessage(
            this.translate(
              "admin.userEdit.logoutForced",
              "User has been logged out"
            ),
            true
          );
          this.$emit("user-updated", {
            userId: this.userId,
            changes: { accessToken: null },
          });
        } else {
          console.warn(
            "[FORCE LOGOUT DEBUG] Unexpected response structure:",
            response
          );
          this.showMessage(
            this.translate(
              "admin.userEdit.logoutFailed",
              "Failed to force logout"
            ),
            false
          );
        }
      } catch (error) {
        console.error(
          "[FORCE LOGOUT DEBUG] Error:",
          error.message,
          error.stack
        );
        this.showMessage(
          this.translate(
            "admin.userEdit.errorForcingLogout",
            "Error forcing logout"
          ),
          false
        );
      } finally {
        this.isSaving = false;
      }
    },

    // Show operation message with auto-clear after 5 seconds
    showMessage(message, isSuccess) {
      this.operationMessage = message;
      this.operationSuccess = isSuccess;

      // Clear any existing timer
      if (this.messageTimer) {
        clearTimeout(this.messageTimer);
      }

      // Set new timer to clear message after 5 seconds
      this.messageTimer = setTimeout(() => {
        this.operationMessage = "";
      }, 5000);
    },
  },
};
</script>
  
 <style scoped>
/* Modal Base Styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.modal-content {
  position: relative;
  width: 90%;
  max-width: 1000px;
  max-height: 90vh;
  background-color: var(--bg-dialog, #ffffff);
  border-radius: 8px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

.modal-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color, #dcdfe4);
}

.modal-title h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary, #333333);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--text-tertiary, #767676);
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background-color: var(--bg-section, rgba(0, 0, 0, 0.05));
  color: var(--text-secondary, #4d4d4d);
}

.modal-body {
  padding: 1rem;
  overflow-y: hidden;
  flex-grow: 1;
  position: relative;
}

.content-wrapper {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  height: 100%;
}

/* User Information Section */
.user-info-section {
  flex: 1;
  background-color: var(--bg-dialog, #ffffff);
  border: 1px solid var(--border-color, #dcdfe4);
  border-radius: 6px;
  padding: 1rem;
}

.user-info-section h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #333333);
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-row {
  display: flex;
  align-items: center;
}

.info-label {
  width: 120px;
  flex-shrink: 0;
  font-weight: 500;
  color: var(--text-secondary, #4d4d4d);
  font-size: 0.8rem;
}

.info-value {
  font-size: 0.8rem;
  color: var(--text-primary, #333333);
}

/* Status badge */
.status-badge {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.status-good {
  background-color: var(--success, #10b981);
}

.status-error {
  background-color: var(--danger, #ef4444);
}

/* Settings and Actions Wrapper */
.settings-actions-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Account Settings Section */
.account-settings-section {
  background-color: var(--bg-dialog, #ffffff);
  border: 1px solid var(--border-color, #dcdfe4);
  border-radius: 6px;
  padding: 1rem;
}

.account-settings-section h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #333333);
}

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.settings-card {
  border: 1px solid var(--border-color, #dcdfe4);
  border-radius: 4px;
}

.card-header {
  background-color: var(--bg-section, rgba(0, 0, 0, 0.02));
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-color, #dcdfe4);
}

.card-header h4 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary, #333333);
}

.card-body {
  padding: 0.75rem;
}

/* Toggle Switch */
.toggle-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-label {
  font-size: 0.8rem;
  color: var(--text-primary, #333333);
}

.toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--switch-track-off, #d0d0d0);
  transition: 0.4s;
  border-radius: 20px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: var(--switch-thumb, #ffffff);
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--switch-track-on, #3b82f6);
}

input:disabled + .slider {
  opacity: 0.5;
  cursor: not-allowed;
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.setting-hint {
  font-size: 0.7rem;
  color: var(--text-tertiary, #767676);
  margin-top: 0.25rem;
  font-style: italic;
}

/* Admin Actions Section */
.admin-actions-section {
  background-color: var(--bg-dialog, #ffffff);
  border: 1px solid var(--border-color, #dcdfe4);
  border-radius: 6px;
  padding: 1rem;
}

.admin-actions-section h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #333333);
}

.actions-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.action-button {
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--border-color, #dcdfe4);
  background-color: var(--bg-dialog, #ffffff);
  color: var(--text-primary, #333333);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-button:hover:not(:disabled) {
  background-color: var(--bg-section, rgba(0, 0, 0, 0.02));
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.verify-email-button {
  border-color: var(--primary, #3b82f6);
  color: var(--primary, #3b82f6);
}

.verify-email-button:hover:not(:disabled) {
  background-color: rgba(59, 130, 246, 0.05);
}

.reset-password-button {
  border-color: var(--warning, #f59e0b);
  color: var(--warning, #f59e0b);
}

.reset-password-button:hover:not(:disabled) {
  background-color: rgba(245, 158, 11, 0.05);
}

.force-logout-button {
  border-color: var(--danger, #ef4444);
  color: var(--danger, #ef4444);
}

.force-logout-button:hover:not(:disabled) {
  background-color: rgba(239, 68, 68, 0.05);
}

/* Modal Footer */
.modal-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color, #dcdfe4);
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-message {
  flex-grow: 1;
  margin-right: 1rem;
}

.footer-actions {
  display: flex;
  gap: 0.5rem;
}

/* Button Styles */
.btn {
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border: none;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--bg-button-primary) !important;
  color: var(--text-button-primary, #ffffff) !important;
}

html[data-theme="dark"][data-v-46520cd6] .modal .btn-primary {
  background-color: var(--bg-button-primary) !important;
  color: var(--text-button-primary, #ffffff) !important;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--primary-dark, #8b3c7a) !important;
}

.btn-outline {
  background-color: transparent;
  border: 1px solid var(--border-color, #dcdfe4);
  color: var(--text-secondary, #4d4d4d);
}

.btn-outline:hover:not(:disabled) {
  background-color: var(--bg-section, rgba(0, 0, 0, 0.02));
}

/* Loading Overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(59, 130, 246, 0.3);
  border-radius: 50%;
  border-top-color: var(--primary, #3b82f6);
  animation: spin 1s linear infinite;
  margin-bottom: 0.75rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spin-icon {
  animation: spin 1s linear infinite;
  margin-right: 4px;
}

.btn-content {
  display: flex;
  align-items: center;
}

/* Status Messages */
.message {
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.message.success {
  background-color: rgba(16, 185, 129, 0.1);
  color: var(--success, #10b981);
}

.message.error {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--danger, #ef4444);
}

/* Dark Mode Adjustments */
[data-theme="dark"] .modal-content,
[data-theme="dark"] .modal-body,
[data-theme="dark"] .user-info-section,
[data-theme="dark"] .account-settings-section,
[data-theme="dark"] .admin-actions-section {
  background-color: #2b2b2b !important;
  border-color: #3d3d3d !important;
}

[data-theme="dark"] .modal-title,
[data-theme="dark"] .modal-footer {
  background-color: #2b2b2b !important;
  border-color: #3d3d3d !important;
}

[data-theme="dark"] .modal-title h2,
[data-theme="dark"] .user-info-section h3,
[data-theme="dark"] .account-settings-section h3,
[data-theme="dark"] .admin-actions-section h3,
[data-theme="dark"] .card-header h4 {
  color: #f8fafc !important;
}

[data-theme="dark"] .info-label {
  color: #bbbbbb !important;
}

[data-theme="dark"] .info-value,
[data-theme="dark"] .toggle-label {
  color: #e0e0e0 !important;
}

[data-theme="dark"] .setting-hint {
  color: #888888 !important;
}

[data-theme="dark"] .action-button,
[data-theme="dark"] .btn-outline {
  background-color: #2b2b2b !important;
  border-color: #3d3d3d !important;
  color: #bbbbbb !important;
}

[data-theme="dark"] .btn-outline:hover:not(:disabled) {
  background-color: #3a3a3a !important;
}

/* Toggle Dark Mode Adjustments */
[data-theme="dark"] .slider {
  background-color: #2b2b2b !important; /* Match dialog background */
}

[data-theme="dark"] input:checked + .slider {
  background-color: #475569 !important; /* Dark slate gray for on state */
}

/* Responsive Adjustments */
@media (max-width: 768px) {
  .content-wrapper {
    flex-direction: column;
  }
  .modal-content {
    max-width: 90%;
  }
  .info-grid,
  .settings-grid,
  .actions-grid {
    gap: 0.4rem;
  }
}
</style>