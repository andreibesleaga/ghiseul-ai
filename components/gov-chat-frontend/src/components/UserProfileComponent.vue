// UserProfileComponent.vue with centralized translation function and updated theme variables

<template>
  <div
    class="user-profile-modal"
    :style="dialogThemeStyles"
    :data-themed="isThemeReady"
    ref="modalContainer"
  >
    <div class="overlay" @click="cancel"></div>
    <div class="modal-content">
      <h2 :data-themed="isThemeReady">{{ translate("title") }}</h2>

      <!-- Loading Indicator -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <p>{{ translate("loadingProfile", "Loading user profile...") }}</p>
      </div>

      <!-- Error Message -->
      <div v-else-if="errorMessage" class="error-container">
        <p class="error-message">{{ errorMessage }}</p>
        <button @click="retryLoading" class="retry-btn">
          {{ translate("retryLoading", "Retry") }}
        </button>
      </div>

      <!-- Main content - shown when not loading and no errors -->
      <div v-else>
        <p class="privacy-info" :data-themed="isThemeReady">
          {{ translate("privacyInfo") }}
          <a href="#" class="privacy-link">{{
            translate("privacyPolicyLink")
          }}</a>
        </p>

        <!-- Tabs -->
        <div class="tabs">
          <button
            v-for="(tab, index) in tabs"
            :key="index"
            :class="{ active: activeTab === index }"
            @click="activeTab = index"
          >
            {{ translate(`tabs.tab${index + 1}`) }}
          </button>
        </div>

        <!-- Tab content -->
        <div class="tab-content">
          <!-- Personal Identification Data -->
          <div v-if="activeTab === 0">
            <!-- Profile Icon Section -->
            <div class="profile-icon-section">
              <label>{{ translate("profileIcon") }}</label>
              <div class="profile-icon-container">
                <div class="current-icon" @click="openIconSelector">
                  <img
                    v-if="formData.personalIdentification.profileIcon"
                    :src="formData.personalIdentification.profileIcon"
                    alt="Profile icon"
                  />
                  <div v-else class="icon-placeholder">
                    {{ getInitials(formData.personalIdentification.fullName) }}
                  </div>
                  <div class="icon-overlay">
                    <span>{{ translate("change") }}</span>
                  </div>
                </div>
              </div>

              <!-- Icon Selection Modal -->
              <div
                v-if="showIconSelector"
                class="icon-selector-overlay"
                @click="closeIconSelector"
              >
                <div class="icon-selector-modal" @click.stop>
                  <h4>{{ translate("chooseProfileIcon") }}</h4>

                  <div class="icon-tabs">
                    <button
                      :class="{ active: iconTab === 'preset' }"
                      @click="iconTab = 'preset'"
                    >
                      {{ translate("presetIcons") }}
                    </button>
                    <button
                      :class="{ active: iconTab === 'upload' }"
                      @click="iconTab = 'upload'"
                    >
                      {{ translate("upload") }}
                    </button>
                    <button
                      :class="{ active: iconTab === 'initials' }"
                      @click="iconTab = 'initials'"
                    >
                      {{ translate("initials") }}
                    </button>
                  </div>

                  <div class="icon-content">
                    <!-- Preset Icons -->
                    <div v-if="iconTab === 'preset'" class="preset-icons">
                      <div
                        v-for="(icon, index) in presetIcons"
                        :key="index"
                        class="preset-icon"
                        :class="{
                          selected:
                            formData.personalIdentification.profileIcon ===
                            icon,
                        }"
                        @click="selectPresetIcon(icon)"
                      >
                        <img :src="icon" alt="Preset icon" />
                      </div>
                    </div>

                    <!-- Upload Option -->
                    <div v-if="iconTab === 'upload'" class="upload-icon">
                      <div class="upload-zone" @click="triggerFileUpload">
                        <span v-if="!uploadedImage">{{
                          translate("clickToUpload")
                        }}</span>
                        <img v-else :src="uploadedImage" alt="Uploaded icon" />
                      </div>
                      <input
                        type="file"
                        ref="fileInput"
                        style="display: none"
                        accept="image/*"
                        @change="handleFileUpload"
                      />
                      <button
                        v-if="uploadedImage"
                        class="btn-confirm"
                        @click="confirmUpload"
                      >
                        {{ translate("useThisImage") }}
                      </button>
                    </div>

                    <!-- Initials Option -->
                    <div
                      v-if="iconTab === 'initials'"
                      class="initials-selector"
                    >
                      <div class="initials-preview">
                        <div
                          class="initials-icon"
                          :style="{ backgroundColor: initialsColor }"
                        >
                          {{
                            getInitials(
                              formData.personalIdentification.fullName
                            )
                          }}
                        </div>
                      </div>
                      <div class="color-selector">
                        <div
                          v-for="(color, index) in colorOptions"
                          :key="index"
                          class="color-option"
                          :style="{ backgroundColor: color }"
                          :class="{ selected: initialsColor === color }"
                          @click="initialsColor = color"
                        ></div>
                      </div>
                      <button class="btn-confirm" @click="useInitials">
                        {{ translate("useInitials") }}
                      </button>
                    </div>
                  </div>

                  <div class="icon-selector-footer">
                    <button class="btn-cancel" @click="closeIconSelector">
                      {{ translate("actions.cancel") }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="field-group">
              <label>{{ translate("fields.fullName") }}</label>
              <input
                v-model="formData.personalIdentification.fullName"
                type="text"
                :placeholder="translate('placeholders.fullName')"
              />
            </div>
            <div class="field-group">
              <label>{{ translate("fields.dob") }}</label>
              <input
                v-model="formData.personalIdentification.dob"
                type="date"
              />
            </div>
            <div class="field-group">
              <label>{{ translate("fields.gender") }}</label>
              <select v-model="formData.personalIdentification.gender">
                <option value="">{{ translate("select") }}</option>
                <option value="male">{{ translate("gender.male") }}</option>
                <option value="female">{{ translate("gender.female") }}</option>
                <option value="other">{{ translate("gender.other") }}</option>
                <option value="prefer-not-to-say">
                  {{ translate("gender.preferNot") }}
                </option>
              </select>
            </div>
            <div class="field-group">
              <label>{{ translate("fields.nationality") }}</label>
              <searchable-country-dropdown
                v-model="formData.personalIdentification.nationality"
                :label="''"
                ref="nationalityDropdown"
                :placeholder="translate('placeholders.selectCountry')"
                :search-placeholder="translate('placeholders.searchCountries')"
                :no-results-text="translate('noMatchingCountries')"
                @update:name="updateNationalityName"
                @change="onNationalityChange"
              />
            </div>
          </div>

          <!-- Civil Registration & Documentation -->
          <div v-else-if="activeTab === 1">
            <div class="field-group">
              <label>{{ translate("fields.birthCert") }}</label>
              <input
                v-model="formData.civilRegistration.birthCert"
                type="text"
              />
            </div>
            <div class="field-group">
              <label>{{ translate("fields.citizenship") }}</label>
              <input
                v-model="formData.civilRegistration.citizenship"
                type="text"
              />
            </div>
            <div class="field-group">
              <label>{{ translate("fields.immigration") }}</label>
              <input
                v-model="formData.civilRegistration.immigration"
                type="text"
              />
            </div>
          </div>

          <!-- Address & Residency Information -->
          <div v-else-if="activeTab === 2">
            <div class="field-group">
              <label>{{ translate("fields.currentAddress") }}</label>
              <textarea
                v-model="formData.addressResidency.currentAddress"
              ></textarea>
            </div>
            <div class="field-group">
              <label>{{ translate("fields.postalCode") }}</label>
              <input
                v-model="formData.addressResidency.postalCode"
                type="text"
              />
            </div>
            <div class="field-group">
              <label>{{ translate("fields.country") }}</label>
              <searchable-country-dropdown
                v-model="formData.addressResidency.country"
                :label="''"
                ref="countryDropdown"
                :placeholder="translate('placeholders.selectCountry')"
                :search-placeholder="translate('placeholders.searchCountries')"
                :no-results-text="translate('noMatchingCountries')"
                @update:name="updateCountryName"
                @change="onCountryChange"
              />
            </div>
            <div class="field-group">
              <label>{{ translate("fields.residencyStatus") }}</label>
              <select v-model="formData.addressResidency.residencyStatus">
                <option value="citizen">
                  {{ translate("residencyStatuses.citizen") }}
                </option>
                <option value="permanent-resident">
                  {{ translate("residencyStatuses.permanentResident") }}
                </option>
                <option value="temporary-resident">
                  {{ translate("residencyStatuses.temporaryResident") }}
                </option>
                <option value="other">
                  {{ translate("residencyStatuses.other") }}
                </option>
              </select>
            </div>
          </div>

          <!-- Identity & Travel Documents -->
          <div v-else-if="activeTab === 3">
            <div class="field-group">
              <label>{{ translate("fields.idCard") }}</label>
              <input v-model="formData.identityDocuments.idCard" type="text" />
            </div>
            <div class="field-group">
              <label>{{ translate("fields.passport") }}</label>
              <input
                v-model="formData.identityDocuments.passport"
                type="text"
              />
            </div>
            <div class="field-group">
              <label>{{ translate("fields.driversLicense") }}</label>
              <input
                v-model="formData.identityDocuments.driversLicense"
                type="text"
              />
            </div>
          </div>

          <!-- Health & Medical Records -->
          <div v-else-if="activeTab === 4">
            <div class="field-group">
              <label>{{ translate("fields.bloodType") }}</label>
              <select v-model="formData.healthInfo.bloodType">
                <option value="a-positive">A+</option>
                <option value="a-negative">A-</option>
                <option value="b-positive">B+</option>
                <option value="b-negative">B-</option>
                <option value="ab-positive">AB+</option>
                <option value="ab-negative">AB-</option>
                <option value="o-positive">O+</option>
                <option value="o-negative">O-</option>
              </select>
            </div>
            <div class="field-group">
              <label>{{ translate("fields.organDonor") }}</label>
              <select v-model="formData.healthInfo.organDonor">
                <option value="yes">{{ translate("yesNo.yes") }}</option>
                <option value="no">{{ translate("yesNo.no") }}</option>
              </select>
            </div>
          </div>

          <!-- Employment & Economic Data -->
          <div v-else-if="activeTab === 5">
            <div class="field-group">
              <label>{{ translate("fields.eHistory") }}</label>
              <input
                v-model="formData.employmentInfo.employmentHistory"
                type="text"
              />
            </div>
            <div class="field-group">
              <label>{{ translate("fields.currentEmployer") }}</label>
              <input
                v-model="formData.employmentInfo.currentEmployer"
                type="text"
              />
            </div>
            <div class="field-group">
              <label>{{ translate("fields.tin") }}</label>
              <input v-model="formData.employmentInfo.taxId" type="text" />
            </div>
          </div>

          <!-- Education & Academic Records -->
          <div v-else-if="activeTab === 6">
            <div class="field-group">
              <label>{{ translate("fields.education") }}</label>
              <div class="select-wrapper">
                <input
                  v-if="showEducationSearch"
                  type="text"
                  v-model="educationSearchTerm"
                  class="search-input"
                  :placeholder="translate('placeholders.searchDisciplines')"
                  @input="filterEducationOptions"
                  @blur="handleEducationBlur"
                  @keydown.enter="selectFirstEducationOption"
                  @keydown.down="navigateEducationOptions(1)"
                  @keydown.up="navigateEducationOptions(-1)"
                  ref="educationSearchInput"
                />
                <div
                  v-else
                  class="selected-option"
                  @click="toggleEducationSearch"
                >
                  {{
                    formData.educationRecords.education ||
                    translate("placeholders.selectDiscipline")
                  }}
                </div>
                <div v-if="showEducationSearch" class="options-dropdown">
                  <div
                    v-for="(option, index) in filteredEducationOptions"
                    :key="index"
                    class="option"
                    :class="{ active: index === selectedEducationIndex }"
                    @click="selectEducationOption(option)"
                    @mouseenter="selectedEducationIndex = index"
                  >
                    {{ option }}
                  </div>
                  <div
                    v-if="filteredEducationOptions.length === 0"
                    class="no-results"
                  >
                    {{ translate("noMatchingDisciplines") }}
                  </div>
                </div>
              </div>
            </div>
            <div class="field-group">
              <label>{{ translate("fields.degrees") }}</label>
              <div class="select-wrapper">
                <input
                  v-if="showDegreeSearch"
                  type="text"
                  v-model="degreeSearchTerm"
                  class="search-input"
                  :placeholder="translate('placeholders.searchDegrees')"
                  @input="filterDegreeOptions"
                  @blur="handleDegreeBlur"
                  @keydown.enter="selectFirstDegreeOption"
                  @keydown.down="navigateDegreeOptions(1)"
                  @keydown.up="navigateDegreeOptions(-1)"
                  ref="degreeSearchInput"
                />
                <div v-else class="selected-option" @click="toggleDegreeSearch">
                  {{
                    formData.educationRecords.degrees ||
                    translate("placeholders.selectDegree")
                  }}
                </div>
                <div v-if="showDegreeSearch" class="options-dropdown">
                  <div
                    v-for="(option, index) in filteredDegreeOptions"
                    :key="index"
                    class="option"
                    :class="{ active: index === selectedDegreeIndex }"
                    @click="selectDegreeOption(option)"
                    @mouseenter="selectedDegreeIndex = index"
                  >
                    {{ option }}
                  </div>
                  <div
                    v-if="filteredDegreeOptions.length === 0"
                    class="no-results"
                  >
                    {{ translate("noMatchingDegrees") }}
                  </div>
                </div>
              </div>
            </div>
            <div class="field-group">
              <label>{{ translate("fields.certifications") }}</label>
              <input
                v-model="formData.educationRecords.certifications"
                type="text"
              />
            </div>
            <div class="field-group">
              <label>{{ translate("fields.academicRecords") }}</label>
              <textarea
                v-model="formData.educationRecords.academicRecords"
              ></textarea>
            </div>
          </div>

          <!-- Financial & Tax Data -->
          <div v-else-if="activeTab === 7">
            <div class="field-group">
              <label>{{ translate("fields.incomeTax") }}</label>
              <input v-model="formData.financialInfo.incomeTax" type="text" />
            </div>
            <div class="field-group">
              <label>{{ translate("fields.bankAccounts") }}</label>
              <input
                v-model="formData.financialInfo.bankAccounts"
                type="text"
              />
            </div>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="actions">
          <button class="cancel-btn" @click="cancel" :disabled="isSubmitting">
            {{ translate("actions.cancel") }}
          </button>
          <button
            class="save-btn"
            @click="saveProfile"
            :disabled="isSubmitting"
          >
            {{
              isSubmitting
                ? translate("actions.saving")
                : translate("actions.save")
            }}
          </button>
        </div>
      </div>
    </div>
    <confirm-dialog
      :visible="showConfirmDialog"
      :title="translate('confirmSaveTitle')"
      :message="translate('confirmSave')"
      :confirm-text="translate('actions.save')"
      :cancel-text="translate('actions.cancel')"
      :theme="isDarkMode ? 'dark' : 'light'"
      :parent-styles="dialogThemeStyles"
      @confirm="confirmSave"
      @cancel="cancelSave"
    />
  </div>
</template>

<script>
import userProfileService from "@/services/userProfileService";
import userService from "@/services/userService";
import notificationService from "@/services/notificationService";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import SearchableCountryDropdown from "@/components/SearchableCountryDropdown.vue";

export default {
  name: "UserProfileComponent",
  components: {
    ConfirmDialog,
    SearchableCountryDropdown,
  },
  data() {
    return {
      isThemeReady: false,
      activeTab: 0,
      tabs: [
        { key: "personalIdentification" },
        { key: "civilRegistration" },
        { key: "addressResidency" },
        { key: "identityDocuments" },
        { key: "healthInfo" },
        { key: "employmentInfo" },
        { key: "educationRecords" },
        { key: "financialInfo" },
      ],
      formData: {
        personalIdentification: {
          fullName: "",
          dob: "",
          gender: "",
          nationality: "",
          profileIcon: "",
        },
        civilRegistration: {
          birthCert: "",
          citizenship: "",
          immigration: "",
        },
        addressResidency: {
          currentAddress: "",
          postalCode: "",
          country: "",
          residencyStatus: "",
        },
        identityDocuments: {
          idCard: "",
          passport: "",
          driversLicense: "",
        },
        healthInfo: {
          bloodType: "",
          organDonor: "",
        },
        employmentInfo: {
          employmentHistory: "",
          currentEmployer: "",
          taxId: "",
        },
        educationRecords: {
          education: "",
          degrees: "",
          certifications: "",
          academicRecords: "",
        },
        financialInfo: {
          incomeTax: "",
          bankAccounts: "",
        },
      },
      nationalityName: "",
      countryName: "",
      isLoading: false,
      errorMessage: null,
      currentUserId: "",
      isSubmitting: false,
      showEducationSearch: false,
      educationSearchTerm: "",
      educationOptions: [],
      filteredEducationOptions: [],
      selectedEducationIndex: -1,
      degreeOptions: [],
      showDegreeSearch: false,
      degreeSearchTerm: "",
      filteredDegreeOptions: [],
      selectedDegreeIndex: -1,
      showConfirmDialog: false,
      showIconSelector: false,
      iconTab: "preset",
      presetIcons: [
        "/assets/icons/profile1.png",
        "/assets/icons/profile2.png",
        "/assets/icons/profile3.png",
        "/assets/icons/profile4.png",
        "/assets/icons/profile5.png",
        "/assets/icons/profile6.png",
        "/assets/icons/profile7.png",
        "/assets/icons/profile8.png",
      ],
      uploadedImage: null,
      initialsColor: "#4E97D1",
      colorOptions: [
        "#4E97D1", // Blue
        "#2ECC71", // Green
        "#E74C3C", // Red
        "#F39C12", // Orange
        "#9B59B6", // Purple
        "#1ABC9C", // Teal
        "#34495E", // Dark Blue
        "#D35400", // Burnt Orange
      ],
    };
  },
  computed: {
    isDarkMode() {
      return (
        document.documentElement.getAttribute("data-theme") === "dark" ||
        document.body.getAttribute("data-theme") === "dark"
      );
    },
    dialogThemeStyles() {
      const isDark = this.isDarkMode;
      return {
        "--dialog-background": isDark ? "#2a2a2a" : "#ffffff",
        "--dialog-title-color": isDark ? "#ffffff" : "#333333",
        "--dialog-text-color": isDark ? "rgba(255, 255, 255, 0.8)" : "#666666",
        "--dialog-border-color": isDark ? "#3a3a3a" : "#dcdfe4",
        "--dialog-box-shadow": isDark
          ? "0 4px 12px rgba(0, 0, 0, 0.4)"
          : "0 4px 12px rgba(0, 0, 0, 0.15)",
        "--dialog-overlay-background": isDark
          ? "rgba(0, 0, 0, 0.7)"
          : "rgba(0, 0, 0, 0.5)",
        "--dialog-input-background": isDark ? "#333333" : "#ffffff",
        "--dialog-input-text-color": isDark ? "#f0f0f0" : "#333333",
        "--dialog-input-border-color": isDark ? "#3a3a3a" : "#ddd",
        "--dialog-input-placeholder-color": isDark ? "#8c8c8c" : "#767676",
        "--dialog-tabs-background": isDark ? "#252525" : "#f0f2f5",
        "--dialog-tabs-active-background": isDark ? "#2a2a2a" : "#ffffff",
        "--dialog-tabs-text-color": isDark ? "#f0f0f0" : "#333333",
        "--dialog-tabs-active-text-color": isDark ? "#ffffff" : "#000000",
        "--dialog-tabs-border-color": isDark ? "#3a3a3a" : "#cccccc",
      };
    },
  },
  methods: {
    // Centralized translation function
    translate(key, fallback = "") {
      // Try direct path first
      const fullKey = key.startsWith("userProfile.")
        ? key
        : `userProfile.${key}`;

      // Next try with fields prefix if it's not already there
      let result;
      if (this.$te(fullKey)) {
        result = this.$t(fullKey);
      }
      // If the key doesn't contain "fields." already, try with it
      else if (!key.includes("fields.")) {
        const fieldsKey = `userProfile.fields.${key}`;
        if (this.$te(fieldsKey)) {
          result = this.$t(fieldsKey);
        }
      }

      return result || fallback || key;
    },
    onNationalityChange(code) {
      console.log("Nationality changed to:", code, "Type:", typeof code);
      // Only update if we received a valid code
      if (code !== undefined) {
        this.formData.personalIdentification.nationality = code;
      }
    },

    onCountryChange(code) {
      console.log("Country changed to:", code, "Type:", typeof code);
      // Only update if we received a valid code
      if (code !== undefined) {
        this.formData.addressResidency.country = code;
      }
    },

    updateNationalityName(name) {
      console.log("Updating nationality name:", name);
      this.nationalityName = name || "";

      if (name && !this.formData.personalIdentification.nationality) {
        console.warn(
          "Country name set but code is missing, attempting to find code"
        );
        // Try to find the code from the name (this could be expanded if needed)
      }

      // Store this in localStorage to persist across tab changes
      if (name && this.formData.personalIdentification.nationality) {
        try {
          localStorage.setItem("user_nationality_name", name);
          localStorage.setItem(
            "user_nationality_code",
            this.formData.personalIdentification.nationality
          );
        } catch (e) {
          console.warn("Could not store nationality in localStorage", e);
        }
      }
    },

    updateCountryName(name) {
      console.log("Updating country name:", name);
      this.countryName = name || "";

      if (name && !this.formData.addressResidency.country) {
        console.warn(
          "Country name set but code is missing, attempting to find code"
        );
        // Try to find the code from the name (this could be expanded if needed)
      }

      // Store this in localStorage to persist across tab changes
      if (name && this.formData.addressResidency.country) {
        try {
          localStorage.setItem("user_country_name", name);
          localStorage.setItem(
            "user_country_code",
            this.formData.addressResidency.country
          );
        } catch (e) {
          console.warn("Could not store country in localStorage", e);
        }
      }
    },

    refreshCountryDropdowns() {
      console.log("Refreshing country dropdowns due to locale change");
      this.$nextTick(() => {
        // Refresh nationality dropdown if it exists
        if (this.$refs.nationalityDropdown) {
          this.$refs.nationalityDropdown.loadCountries();
          if (this.formData.personalIdentification.nationality) {
            setTimeout(() => {
              this.$refs.nationalityDropdown.manuallySetCountryName(
                this.formData.personalIdentification.nationality
              );
            }, 200);
          }
        }

        // Refresh country dropdown if it exists
        if (this.$refs.countryDropdown) {
          this.$refs.countryDropdown.loadCountries();
          if (this.formData.addressResidency.country) {
            setTimeout(() => {
              this.$refs.countryDropdown.manuallySetCountryName(
                this.formData.addressResidency.country
              );
            }, 200);
          }
        }
      });
    },

    // New method to restore country data after tab switching
    restoreCountryState() {
      // Try to restore from localStorage
      try {
        const nationalityCode = localStorage.getItem("user_nationality_code");
        const countryCode = localStorage.getItem("user_country_code");
        const nationalityName = localStorage.getItem("user_nationality_name");
        const countryName = localStorage.getItem("user_country_name");

        console.log("Restoring from localStorage:", {
          nationalityCode,
          nationalityName,
          countryCode,
          countryName,
        });

        // Restore nationality if needed
        if (
          nationalityCode &&
          this.activeTab === 0 &&
          this.$refs.nationalityDropdown
        ) {
          if (
            !this.formData.personalIdentification.nationality ||
            this.formData.personalIdentification.nationality !== nationalityCode
          ) {
            console.log("Restoring nationality from localStorage");
            this.formData.personalIdentification.nationality = nationalityCode;
            this.nationalityName = nationalityName || "";
            this.$refs.nationalityDropdown.manuallySetCountryName(
              nationalityCode
            );
          }
        }

        // Restore country if needed
        if (countryCode && this.activeTab === 2 && this.$refs.countryDropdown) {
          if (
            !this.formData.addressResidency.country ||
            this.formData.addressResidency.country !== countryCode
          ) {
            console.log("Restoring country from localStorage");
            this.formData.addressResidency.country = countryCode;
            this.countryName = countryName || "";
            this.$refs.countryDropdown.manuallySetCountryName(countryCode);
          }
        }
      } catch (e) {
        console.warn("Error restoring country state from localStorage", e);
      }
    },

    updateCountryDisplay() {
      // This function ensures the country dropdowns properly display the correct values
      if (this.formData.personalIdentification.nationality) {
        console.log(
          "Setting nationality display for:",
          this.formData.personalIdentification.nationality
        );
        // The SearchableCountryDropdown component will handle this through its value prop
      }

      if (this.formData.addressResidency.country) {
        console.log(
          "Setting country display for:",
          this.formData.addressResidency.country
        );
        // The SearchableCountryDropdown component will handle this through its value prop
      }
    },
    updateTheme() {
      this.isThemeReady = false;
      this.$nextTick(() => {
        this.isThemeReady = true;
      });
    },
    cancel() {
      this.$emit("cancel");
    },
    saveProfile() {
      console.log("Save profile button clicked");
      this.showConfirmDialog = true;
    },
    async confirmSave() {
      this.showConfirmDialog = false;
      this.isSubmitting = true;

      // Safety check to make sure we have a valid user ID
      if (!this.currentUserId) {
        console.error(
          "Missing currentUserId in confirmSave, attempting to retrieve it"
        );
        this.currentUserId = await this.getCurrentUserId();

        if (!this.currentUserId) {
          notificationService.error(
            this.translate(
              "errors.savingFailed",
              "Failed to save profile: Missing user ID"
            )
          );
          this.isSubmitting = false;
          return;
        }
      }

      console.log("Submitting form, currentUserId:", this.currentUserId);

      try {
        const validation = this.validateForm();
        console.log("Form validation result:", validation);

        if (!validation.isValid) {
          notificationService.error(
            this.translate(
              "errors.invalidForm",
              "Please fill all required fields"
            )
          );
          return;
        }

        const profileData = JSON.parse(JSON.stringify(this.formData));
        console.log("Profile data before submission:", profileData);

        console.log("Country data before submission:", {
          nationality: profileData.personalIdentification.nationality,
          nationalityName: this.nationalityName,
          country: profileData.addressResidency.country,
          countryName: this.countryName,
        });

        if (this.formData.personalIdentification.nationality) {
          profileData.personalIdentification.nationality =
            this.formData.personalIdentification.nationality;
          console.log(
            "Explicitly set nationality to:",
            profileData.personalIdentification.nationality
          );
        } else {
          console.warn("Nationality code is missing from form data");
        }

        if (this.formData.addressResidency.country) {
          profileData.addressResidency.country =
            this.formData.addressResidency.country;
          console.log(
            "Explicitly set country to:",
            profileData.addressResidency.country
          );
        } else {
          console.warn("Country code is missing from form data");
        }

        console.log("Profile data being sent to API:", profileData);
        console.log("API URL will be /api/users/" + this.currentUserId);

        const result = await userProfileService.updateProfile(
          this.currentUserId,
          profileData
        );
        console.log("Update profile API response:", result);

        notificationService.success(
          this.translate("saveSuccess", "Profile saved successfully")
        );
        this.$emit("save", profileData);
      } catch (error) {
        console.error("Error saving profile:", error);
        notificationService.error(
          this.translate("errors.savingFailed", "Failed to save profile")
        );
      } finally {
        this.isSubmitting = false;
      }
    },
    cancelSave() {
      this.showConfirmDialog = false;
      console.log("User cancelled save operation");
    },
    onFileChange(e, section, fieldKey) {
      const file = e.target.files[0];
      if (!file) return;

      const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!allowedTypes.includes(file.type)) {
        notificationService.error(
          this.translate("errors.invalidFileType", "Invalid file type")
        );
        return;
      }

      if (file.size > maxSize) {
        notificationService.error(
          this.translate("errors.fileTooLarge", "File is too large")
        );
        return;
      }

      this.formData[section][fieldKey] = file;
    },
    validateForm() {
      const validations = {
        personalIdentification: [
          { field: "fullName", required: true },
          { field: "dob", required: true },
        ],
      };

      const errors = {};

      Object.keys(validations).forEach((section) => {
        validations[section].forEach((validation) => {
          const value = this.formData[section][validation.field];
          if (validation.required && !value) {
            errors[`${section}.${validation.field}`] = this.translate(
              "validation.nameRequired"
            );
          }
        });
      });

      if (this.isTabComplete(this.activeTab)) {
        notificationService.info(
          this.translate("tabComplete", "Tab completed!"),
          1500
        );
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors,
      };
    },
    isTabComplete(tabIndex) {
      const tab = this.tabs[tabIndex];
      if (!tab) return false;
      if (tab.key === "personalIdentification") {
        return (
          !!this.formData.personalIdentification.fullName &&
          !!this.formData.personalIdentification.dob
        );
      }
      return true; // Other tabs considered complete for simplicity
    },
    getCurrentUserId() {
      try {
        const userData = userService.getCurrentUser();
        if (!userData) {
          console.error("No user data available");
          return "";
        }
        let userId = userData.id || userData.userId || userData._id || "";
        if (typeof userId === "string" && userId.includes("/")) {
          userId = userId.split("/").pop();
        }
        console.log("Retrieved user ID:", userId);
        return userId;
      } catch (error) {
        console.error("Error getting current user ID:", error);
        return "";
      }
    },
    async loadUserProfileData() {
      this.isLoading = true;
      this.errorMessage = null;
      try {
        // Get and STORE the user ID in the component property
        this.currentUserId = await this.getCurrentUserId();

        if (!this.currentUserId) {
          throw new Error("Unable to determine current user ID");
        }

        console.log("Loading profile data for user ID:", this.currentUserId);

        const profileData = await userProfileService.getProfile(
          this.currentUserId
        );
        console.log("Retrieved profile data:", profileData);

        if (profileData) {
          // Extract the nationality and country codes before mapping other data
          const nationalityCode =
            profileData.personalIdentification?.nationality || "";
          const countryCode = profileData.addressResidency?.country || "";

          // Map profile data to form data
          Object.keys(this.formData).forEach((section) => {
            if (profileData[section]) {
              Object.keys(this.formData[section]).forEach((field) => {
                if (profileData[section][field] !== undefined) {
                  this.formData[section][field] = profileData[section][field];
                }
              });
            }
          });

          console.log("Form data after population:", this.formData);

          // Store country values to localStorage for tab-switching persistence
          try {
            if (nationalityCode) {
              localStorage.setItem("user_nationality_code", nationalityCode);
            }
            if (countryCode) {
              localStorage.setItem("user_country_code", countryCode);
            }
          } catch (e) {
            console.warn("Could not store country codes in localStorage", e);
          }

          // Ensuring the country dropdowns get initialized with their values
          this.$nextTick(() => {
            // Set nationality dropdown with a delay to ensure component is mounted
            setTimeout(() => {
              if (nationalityCode && this.$refs.nationalityDropdown) {
                console.log(
                  "Setting nationality dropdown with code:",
                  nationalityCode
                );
                this.$refs.nationalityDropdown.manuallySetCountryName(
                  nationalityCode
                );
              }

              if (countryCode && this.$refs.countryDropdown) {
                console.log("Setting country dropdown with code:", countryCode);
                this.$refs.countryDropdown.manuallySetCountryName(countryCode);
              }
            }, 300); // Small delay to ensure components are ready
          });
        }
      } catch (error) {
        console.error("Error loading user profile:", error);
        this.errorMessage = this.translate(
          "errors.loadingFailed",
          "Failed to load profile data"
        );
      } finally {
        this.isLoading = false;
      }
    },
    retryLoading() {
      this.loadUserProfileData();
    },
    loadDegreeOptions() {
      const defaultOptions = this.translate("degreeOptions", [
        "Associate Degree",
        "Bachelor of Arts (BA)",
        "Bachelor of Science (BS)",
        "Bachelor of Engineering (BEng)",
        "Bachelor of Business Administration (BBA)",
        "Bachelor of Fine Arts (BFA)",
        "Bachelor of Education (BEd)",
        "Bachelor of Medicine (MBBS)",
        "Bachelor of Laws (LLB)",
        "Master of Arts (MA)",
        "Master of Science (MS)",
        "Master of Business Administration (MBA)",
        "Master of Engineering (MEng)",
        "Master of Fine Arts (MFA)",
        "Master of Education (MEd)",
        "Master of Laws (LLM)",
        "Master of Public Health (MPH)",
        "Doctor of Philosophy (PhD)",
        "Doctor of Medicine (MD)",
        "Doctor of Education (EdD)",
        "Doctor of Business Administration (DBA)",
        "Doctor of Jurisprudence (JD)",
        "Professional Diploma",
        "Technical Diploma",
        "Vocational Certificate",
        "Graduate Certificate",
        "Post-Graduate Diploma",
        "Post-Doctoral",
      ]);

      this.degreeOptions = Array.isArray(defaultOptions) ? defaultOptions : [];
      const locale = this.$i18n ? this.$i18n.locale : "en";
      this.degreeOptions.sort((a, b) => a.localeCompare(b, locale));
    },
    toggleDegreeSearch() {
      this.showDegreeSearch = true;
      this.degreeSearchTerm = this.formData.educationRecords.degrees || "";
      this.filterDegreeOptions();
      this.$nextTick(() => {
        if (this.$refs.degreeSearchInput) {
          this.$refs.degreeSearchInput.focus();
        }
      });
    },
    filterDegreeOptions() {
      if (!this.degreeSearchTerm) {
        this.filteredDegreeOptions = [...this.degreeOptions];
      } else {
        const searchTerm = this.degreeSearchTerm.toLowerCase();
        this.filteredDegreeOptions = this.degreeOptions.filter((option) =>
          option.toLowerCase().includes(searchTerm)
        );
      }
      this.selectedDegreeIndex = -1;
    },
    selectDegreeOption(option) {
      this.formData.educationRecords.degrees = option;
      this.showDegreeSearch = false;
    },
    handleDegreeBlur(event) {
      if (
        !event.relatedTarget ||
        (event.relatedTarget &&
          !event.relatedTarget.closest(".options-dropdown"))
      ) {
        setTimeout(() => {
          this.showDegreeSearch = false;
        }, 150);
      }
    },
    selectFirstDegreeOption() {
      if (this.filteredDegreeOptions.length > 0) {
        this.selectDegreeOption(this.filteredDegreeOptions[0]);
      }
    },
    navigateDegreeOptions(direction) {
      const optionsLength = this.filteredDegreeOptions.length;
      if (optionsLength > 0) {
        this.selectedDegreeIndex =
          (this.selectedDegreeIndex + direction + optionsLength) %
          optionsLength;
        if (
          this.selectedDegreeIndex >= 0 &&
          this.selectedDegreeIndex < optionsLength
        ) {
          this.$refs.degreeSearchInput.focus();
        }
      }
    },
    loadEducationOptions() {
      const defaultOptions = this.translate("educationOptions", [
        "Accounting",
        "Aerospace Engineering",
        "Agricultural Science",
        "Anthropology",
        "Architecture",
        "Art History",
        "Artificial Intelligence",
        "Astronomy",
        "Astrophysics",
        "Biochemistry",
        "Biomedical Engineering",
        "Biotechnology",
        "Business Administration",
        "Chemical Engineering",
        "Chemistry",
        "Civil Engineering",
        "Communications",
        "Computer Engineering",
        "Computer Science",
        "Construction Management",
        "Criminal Justice",
        "Cybersecurity",
        "Data Science",
        "Dentistry",
        "Economics",
        "Education",
        "Electrical Engineering",
        "Elementary Education",
        "English Literature",
        "Environmental Engineering",
        "Environmental Science",
        "Fashion Design",
        "Film Studies",
        "Finance",
        "Fine Arts",
        "Food Science",
        "Forensic Science",
        "Game Design",
        "Geography",
        "Geology",
        "Graphic Design",
        "Health Administration",
        "History",
        "Hospitality Management",
        "Human Resources",
        "Industrial Design",
        "Industrial Engineering",
        "Information Systems",
        "Information Technology",
        "Interior Design",
        "International Business",
        "International Relations",
        "Journalism",
        "Law",
        "Library Science",
        "Linguistics",
        "Management",
        "Marketing",
        "Materials Science",
        "Mathematics",
        "Mechanical Engineering",
        "Media Studies",
        "Medicine",
        "Meteorology",
        "Microbiology",
        "Music",
        "Nanotechnology",
        "Nursing",
        "Nutrition",
        "Occupational Therapy",
        "Oceanography",
        "Petroleum Engineering",
        "Pharmacy",
        "Philosophy",
        "Photography",
        "Physical Education",
        "Physical Therapy",
        "Physics",
        "Political Science",
        "Psychology",
        "Public Administration",
        "Public Health",
        "Public Relations",
        "Robotics",
        "Secondary Education",
        "Social Work",
        "Sociology",
        "Software Engineering",
        "Special Education",
        "Sports Management",
        "Statistics",
        "Systems Engineering",
        "Theatre Arts",
        "Tourism",
        "Urban Planning",
        "Veterinary Medicine",
        "Web Development",
        "Wildlife Biology",
        "Zoology",
      ]);

      this.educationOptions = Array.isArray(defaultOptions)
        ? defaultOptions
        : [];
      const locale = this.$i18n ? this.$i18n.locale : "en";
      this.educationOptions.sort((a, b) => a.localeCompare(b, locale));
    },
    toggleEducationSearch() {
      this.showEducationSearch = true;
      this.educationSearchTerm = this.formData.educationRecords.education || "";
      this.filterEducationOptions();
      this.$nextTick(() => {
        if (this.$refs.educationSearchInput) {
          this.$refs.educationSearchInput.focus();
        }
      });
    },
    filterEducationOptions() {
      if (!this.educationSearchTerm) {
        this.filteredEducationOptions = [...this.educationOptions];
      } else {
        const searchTerm = this.educationSearchTerm.toLowerCase();
        this.filteredEducationOptions = this.educationOptions.filter((option) =>
          option.toLowerCase().includes(searchTerm)
        );
      }
      this.selectedEducationIndex = -1;
    },
    selectEducationOption(option) {
      this.formData.educationRecords.education = option;
      this.showEducationSearch = false;
    },
    handleEducationBlur(event) {
      if (
        !event.relatedTarget ||
        (event.relatedTarget &&
          !event.relatedTarget.closest(".options-dropdown"))
      ) {
        setTimeout(() => {
          this.showEducationSearch = false;
        }, 150);
      }
    },
    selectFirstEducationOption() {
      if (this.filteredEducationOptions.length > 0) {
        this.selectEducationOption(this.filteredEducationOptions[0]);
      }
    },
    navigateEducationOptions(direction) {
      const optionsLength = this.filteredEducationOptions.length;
      if (optionsLength > 0) {
        this.selectedEducationIndex =
          (this.selectedEducationIndex + direction + optionsLength) %
          optionsLength;
        if (
          this.selectedEducationIndex >= 0 &&
          this.selectedEducationIndex < optionsLength
        ) {
          this.$refs.educationSearchInput.focus();
        }
      }
    },
    openIconSelector() {
      this.showIconSelector = true;
    },
    closeIconSelector() {
      this.showIconSelector = false;
      this.uploadedImage = null;
    },
    getInitials(name) {
      if (!name) return "?";
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
    },
    selectPresetIcon(icon) {
      this.formData.personalIdentification.profileIcon = icon;
      this.closeIconSelector();
    },
    triggerFileUpload() {
      this.$refs.fileInput.click();
    },
    handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      const validTypes = ["image/jpeg", "image/png", "image/gif"];
      if (!validTypes.includes(file.type)) {
        notificationService.error(
          this.translate(
            "errors.invalidFileType",
            "Please upload a valid image (JPEG, PNG, GIF)"
          )
        );
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        notificationService.error(
          this.translate(
            "errors.fileTooLarge",
            "Image size must be less than 2MB"
          )
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        this.uploadedImage = e.target.result;
      };
      reader.readAsDataURL(file);
    },
    confirmUpload() {
      this.formData.personalIdentification.profileIcon = this.uploadedImage;
      this.closeIconSelector();
    },
    useInitials() {
      const canvas = document.createElement("canvas");
      const size = 200;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = this.initialsColor;
      ctx.fillRect(0, 0, size, size);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 80px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        this.getInitials(this.formData.personalIdentification.fullName),
        size / 2,
        size / 2
      );

      this.formData.personalIdentification.profileIcon =
        canvas.toDataURL("image/png");
      this.closeIconSelector();
    },
  },
  watch: {
    "formData.personalIdentification.nationality": {
      handler(newVal) {
        console.log("Nationality model changed to:", newVal);
        // Rely on SearchableCountryDropdown to emit the name via update:name
      },
      immediate: true,
    },
    "formData.addressResidency.country": {
      handler(newVal) {
        console.log("Country model changed to:", newVal);
        // Rely on SearchableCountryDropdown to emit the name via update:name
      },
      immediate: true,
    },
    "$i18n.locale"() {
      this.loadEducationOptions();
      this.loadDegreeOptions();
      this.refreshCountryDropdowns();
    },

    // Watch for tab changes to ensure dropdown state persists
    activeTab: {
      handler(newTabIndex, oldTabIndex) {
        console.log(`Tab changed from ${oldTabIndex} to ${newTabIndex}`);

        // If we're switching to the Personal Identification tab (0)
        if (
          newTabIndex === 0 &&
          this.formData.personalIdentification.nationality
        ) {
          this.$nextTick(() => {
            setTimeout(() => {
              if (this.$refs.nationalityDropdown) {
                console.log("Restoring nationality dropdown after tab switch");
                this.$refs.nationalityDropdown.manuallySetCountryName(
                  this.formData.personalIdentification.nationality
                );
              }
            }, 50);
          });
        }

        // If we're switching to the Address & Residency tab (2)
        if (newTabIndex === 2 && this.formData.addressResidency.country) {
          this.$nextTick(() => {
            setTimeout(() => {
              if (this.$refs.countryDropdown) {
                console.log("Restoring country dropdown after tab switch");
                this.$refs.countryDropdown.manuallySetCountryName(
                  this.formData.addressResidency.country
                );
              }
            }, 50);
          });
        }
      },
    },
  },
  mounted() {
    window.addEventListener("themeChange", this.updateTheme);
    this.$nextTick(() => {
      this.isThemeReady = true;
    });
    this.loadEducationOptions();
    this.loadDegreeOptions();
    this.loadUserProfileData();
  },
  beforeDestroy() {
    window.removeEventListener("themeChange", this.updateTheme);
  },
};
</script>

<style scoped>
/* Base Modal Styling */
.user-profile-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
  /* Set default colors for light mode regardless of theme detection */
  color: #333333;
}

/* Apply theme variables only as overrides */
.user-profile-modal[data-themed="true"] {
  color: var(--dialog-text-color, #333333);
}

/* Other existing styles remain unchanged */
.overlay {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: var(--dialog-overlay-background, rgba(0, 0, 0, 0.5));
}

.modal-content {
  position: relative;
  background-color: var(--dialog-background, #ffffff);
  width: 900px;
  max-width: 90%;
  margin: 40px auto;
  padding: 20px;
  border-radius: 8px;
  overflow-y: auto;
  max-height: 90vh;
  box-shadow: var(--dialog-box-shadow, 0 4px 12px rgba(0, 0, 0, 0.15));
  border: 1px solid var(--dialog-border-color, #dcdfe4);
}

/* Title and Info Styling - add explicit color */
h2 {
  color: #333333;
  margin-bottom: 10px;
}

h2[data-themed="true"] {
  color: var(--dialog-title-color, #333333);
}

.privacy-info {
  font-size: 0.9rem;
  margin-bottom: 16px;
  color: #666666;
}

.privacy-info[data-themed="true"] {
  color: var(--dialog-text-color, #666666);
}

/* Tabs Styling */
.tabs {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--dialog-tabs-border-color, #cccccc);
  max-height: 120px;
  overflow-y: auto;
  background-color: var(--dialog-tabs-background, #ffffff);
}

.tabs button {
  margin-right: 4px;
  padding: 8px 12px;
  background-color: var(--dialog-tabs-background, #ffffff);
  color: var(--dialog-tabs-text-color, #000000);
  border: 1px solid var(--dialog-tabs-border-color, #cccccc);
  border-bottom: none;
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  white-space: nowrap;
}

.tabs button:hover {
  background-color: var(--dialog-tabs-hover-background, #f0f0f0);
}

.tabs button.active {
  background-color: var(--dialog-tabs-active-background, #ffffff);
  color: var(--dialog-tabs-active-text-color, #000000);
  font-weight: bold;
  border-bottom: 2px solid var(--dialog-tabs-active-background, #ffffff);
}

/* Field Group Styling */
.tab-content {
  border: 1px solid var(--dialog-tabs-border-color, #cccccc);
  border-top: none;
  padding: 10px;
  border-radius: 0 0 4px 4px;
  background-color: var(--dialog-background, #ffffff);
  min-height: 300px;
}

.field-group {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
}

.field-group label {
  margin-bottom: 4px;
  color: var(--dialog-text-color, #333333);
}

.field-group input,
.field-group textarea {
  padding: 6px;
  border: 1px solid var(--dialog-input-border-color, #ddd);
  border-radius: 4px;
  background-color: var(--dialog-input-background, #ffffff);
  color: var(--dialog-input-text-color, #333333);
}

.field-group input::placeholder,
.field-group textarea::placeholder {
  color: var(--dialog-input-placeholder-color, #767676);
}

/* Action Buttons Styling */
.actions {
  margin-top: 20px;
  text-align: right;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cancel-btn,
.save-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.cancel-btn {
  background-color: var(--bg-button-secondary, #cccccc);
  color: var(--text-button-secondary, #333333);
}

.cancel-btn:hover {
  background-color: var(--bg-button-secondary-hover, #bbbbbb);
}

.save-btn {
  background-color: var(--bg-button-primary, #4e97d1);
  color: var(--text-button-primary, #ffffff);
}

.save-btn:hover {
  background-color: var(--bg-button-primary-hover, #3a7da0);
}

/* Dark Mode Specific Overrides */
[data-theme="dark"] .user-profile-modal,
.dark-mode .user-profile-modal {
  background-color: var(--dialog-background, #2a2a2a);
  color: var(--dialog-text-color, #f0f0f0);
}

[data-theme="dark"] h2,
.dark-mode h2 {
  color: #ffffff !important;
}

[data-theme="dark"] .privacy-info,
.dark-mode .privacy-info {
  color: rgba(255, 255, 255, 0.8) !important;
}

/* Loading spinner */
.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  min-height: 200px;
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
  color: #dc3545;
  margin-bottom: 1rem;
}

.retry-btn {
  padding: 0.5rem 1.5rem;
  background-color: var(--bg-button-secondary, #cccccc);
  color: var(--text-button-secondary, #333333);
  border: 1px solid var(--dialog-tabs-border-color, #cccccc);
  border-radius: 4px;
  cursor: pointer;
}

.retry-btn:hover {
  background-color: var(--bg-button-secondary-hover, #bbbbbb);
}

/* Disabled button styles */
.save-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Searchable dropdown styles */
.select-wrapper {
  position: relative;
  width: 100%;
}

.search-input {
  width: 100%;
  padding: 6px;
  border: 1px solid var(--dialog-input-border-color, #ddd);
  border-radius: 4px;
  background-color: var(--dialog-input-background, #ffffff);
  color: var(--dialog-input-text-color, #333333);
}

.selected-option {
  width: 100%;
  padding: 6px;
  border: 1px solid var(--dialog-input-border-color, #ddd);
  border-radius: 4px;
  background-color: var(--dialog-input-background, #ffffff);
  color: var(--dialog-input-text-color, #333333);
  cursor: pointer;
  display: flex;
  align-items: center;
  position: relative;
}

.selected-option:after {
  content: "▼";
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.8em;
  color: var(--dialog-input-text-color, #888);
}

.options-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background-color: var(--dialog-input-background, #ffffff);
  border: 1px solid var(--dialog-input-border-color, #ddd);
  border-radius: 0 0 4px 4px;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.option {
  padding: 6px 10px;
  cursor: pointer;
}

.option:hover,
.option.active {
  background-color: var(--bg-button-primary, #4e97d1);
  color: var(--text-button-primary, #ffffff);
}

.no-results {
  padding: 10px;
  text-align: center;
  color: #999;
  font-style: italic;
}

/* Dark theme adjustments */
[data-theme="dark"] .options-dropdown,
.dark-mode .options-dropdown {
  background-color: var(--dialog-input-background, #333333);
  border-color: var(--dialog-input-border-color, #3a3a3a);
}

[data-theme="dark"] .option:hover,
.dark-mode .option:hover,
[data-theme="dark"] .option.active,
.dark-mode .option.active {
  background-color: var(--bg-button-primary, #4e97d1);
}

[data-theme="dark"] .no-results,
.dark-mode .no-results {
  color: #777;
}

/* Add these to your UserProfileComponent.vue style section */
.tabs button.active {
  border-bottom: 2px solid var(--bg-button-primary, #4e97d1);
  /* Optional: add a faint background to active tab */
  background-color: rgba(var(--bg-button-primary-rgb, 78, 151, 209), 0.1);
}

/* Add a subtle border to the sections */
.tab-content {
  border-left: 3px solid var(--bg-button-primary, #4e97d1);
}

/* Add color focus to input fields on focus */
.field-group input:focus,
.field-group textarea:focus,
.field-group select:focus {
  border-color: var(--bg-button-primary, #4e97d1);
  box-shadow: 0 0 0 2px rgba(var(--bg-button-primary-rgb, 78, 151, 209), 0.2);
  outline: none;
}

/* Better spacing */
.field-group {
  margin-bottom: 18px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(125, 125, 125, 0.1);
}

/* Improved typography */
.field-group label {
  font-weight: 500;
  margin-bottom: 6px;
  font-size: 0.95rem;
  color: var(--dialog-title-color, #333333);
}

/* Make the title more prominent */
h2 {
  font-size: 1.75rem;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--dialog-border-color, #eaeaea);
  padding-bottom: 12px;
}

/* Visual feedback on tab hover */
.tabs button:hover:not(.active) {
  background-color: rgba(0, 0, 0, 0.05);
}

[data-theme="dark"] .tabs button:hover:not(.active) {
  background-color: rgba(255, 255, 255, 0.05);
}

/* Slight animation on buttons */
.cancel-btn,
.save-btn {
  transition: transform 0.1s ease;
}

.cancel-btn:hover,
.save-btn:hover {
  transform: translateY(-1px);
}

/* Add icon styles for fields that could benefit from them */
.field-group input[type="date"] {
  position: relative;
  padding-right: 30px; /* Space for calendar icon */
}

/* Add a slight background to the active tab's content area */
.tab-content {
  background: linear-gradient(
    to bottom,
    rgba(var(--bg-button-primary-rgb, 78, 151, 209), 0.05) 0%,
    transparent 100px
  );
  padding: 15px;
}

/* Better button styling */
.save-btn {
  padding: 10px 24px;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.cancel-btn {
  background-color: transparent;
  border: 1px solid var(--bg-button-secondary, #cccccc);
}

/* Better hover effects */
.save-btn:hover {
  background-color: var(--bg-button-primary-hover, #3a7da0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Profile Icon Styles */
.profile-icon-section {
  margin-bottom: 20px;
}

.profile-icon-container {
  display: flex;
  align-items: center;
  margin-top: 10px;
}

.current-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  background-color: var(--bg-button-secondary, #cccccc);
}

.current-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
  color: white;
}

.icon-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.current-icon:hover .icon-overlay {
  opacity: 1;
}

/* Icon Selector Modal */
.icon-selector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 11000;
}

.icon-selector-modal {
  background-color: var(--dialog-background, #ffffff);
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.icon-selector-modal h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: var(--dialog-title-color, #333333);
}

.icon-tabs {
  display: flex;
  border-bottom: 1px solid var(--dialog-border-color, #eaeaea);
  margin-bottom: 15px;
}

.icon-tabs button {
  padding: 8px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--dialog-text-color, #333333);
}

.icon-tabs button.active {
  border-bottom: 2px solid var(--bg-button-primary, #4e97d1);
  color: var(--bg-button-primary, #4e97d1);
}

.icon-content {
  min-height: 250px;
}

/* Preset Icons */
.preset-icons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-bottom: 15px;
}

.preset-icon {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.preset-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preset-icon.selected,
.preset-icon:hover {
  border-color: var(--bg-button-primary, #4e97d1);
}

/* Upload Zone */
.upload-zone {
  border: 2px dashed var(--dialog-border-color, #ddd);
  border-radius: 8px;
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-bottom: 15px;
  position: relative;
}

.upload-zone img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* Initials Selector */
.initials-selector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.initials-preview {
  margin-bottom: 10px;
}

.initials-icon {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  font-weight: bold;
  color: white;
}

.color-selector {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 15px;
}

.color-option {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.2s;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  border-color: #ddd;
  transform: scale(1.1);
}

.icon-selector-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.btn-confirm {
  background-color: var(--bg-button-primary, #4e97d1);
  color: var(--text-button-primary, #ffffff);
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-cancel {
  background-color: var(--bg-button-secondary, #cccccc);
  color: var(--text-button-secondary, #333333);
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 10px;
}

/* Dark Mode Adjustments */
[data-theme="dark"] .icon-selector-modal h4,
[data-theme="dark"] .icon-tabs button {
  color: var(--dialog-text-color-dark, #ffffff);
}

[data-theme="dark"] .icon-tabs button.active {
  color: var(--bg-button-primary, #4e97d1);
}

[data-theme="dark"] .upload-zone {
  border-color: var(--dialog-border-color-dark, #444);
  color: var(--dialog-text-color-dark, #ccc);
}

[data-theme="dark"] .color-option.selected {
  border-color: #555;
}
</style>