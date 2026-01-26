// src/components/UserProfileContainer.vue
<template>
  <div>
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-container">
      <div class="spinner"></div>
      <p>{{ $t('loading.message', 'Loading user profile...') }}</p>
    </div>
    
    <!-- Error state -->
    <div v-else-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <button @click="retryLoading" class="retry-button">
        {{ $t('error.retry', 'Retry') }}
      </button>
    </div>
    
    <!-- Profile component -->
    <UserProfileComponent
      v-else
      v-model="profileData"
      @save="saveProfile"
      @cancel="handleCancel"
    />
  </div>
</template>

<script>
import UserProfileComponent from './UserProfileComponent.vue';
import { userProfileService, fileService } from '../services';

export default {
  name: 'UserProfileContainer',
  components: {
    UserProfileComponent
  },
  props: {
    userId: {
      type: String,
      required: true
    },
    isNewUser: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      profileData: this.getEmptyProfile(),
      isLoading: false,
      isSaving: false,
      error: null
    };
  },
  created() {
    if (!this.isNewUser) {
      this.loadUserProfile();
    }
  },
  methods: {
    /**
     * Load the user profile from the backend
     */
    async loadUserProfile() {
      this.isLoading = true;
      this.error = null;
      
      try {
        const profileData = await userProfileService.getProfile(this.userId);
        this.profileData = this.processProfileDataForDisplay(profileData);
      } catch (error) {
        console.error('Error loading user profile:', error);
        this.error = this.$t('error.loadingProfile', 'Failed to load user profile. Please try again.');
      } finally {
        this.isLoading = false;
      }
    },
    
    /**
     * Process profile data from the backend for display in the component
     */
    processProfileDataForDisplay(data) {
      // Deep clone to avoid modifying the original
      const processedData = JSON.parse(JSON.stringify(data));
      
      // Process file URLs to File objects if needed
      // This is just a placeholder - in a real implementation,
      // you would handle any data transformation needed
      
      return processedData;
    },
    
    /**
     * Save the user profile
     */
    async saveProfile(profileData) {
      this.isSaving = true;
      this.error = null;
      
      try {
        let savedProfile;
        
        if (this.isNewUser) {
          savedProfile = await userProfileService.createProfile(profileData);
          
          // Emit event to notify parent component of the new user ID
          this.$emit('user-created', savedProfile._key);
        } else {
          savedProfile = await userProfileService.updateProfile(this.userId, profileData);
        }
        
        // Success notification
        this.$emit('saved', savedProfile);
        
        // Update local data with saved profile
        this.profileData = this.processProfileDataForDisplay(savedProfile);
      } catch (error) {
        console.error('Error saving user profile:', error);
        this.error = this.$t('error.savingProfile', 'Failed to save user profile. Please try again.');
        this.$emit('error', error);
      } finally {
        this.isSaving = false;
      }
    },
    
    /**
     * Handle cancel button click
     */
    handleCancel() {
      this.$emit('cancel');
    },
    
    /**
     * Retry loading after an error
     */
    retryLoading() {
      if (this.isNewUser) {
        this.profileData = this.getEmptyProfile();
        this.error = null;
      } else {
        this.loadUserProfile();
      }
    },
    
    /**
     * Get an empty profile structure
     */
    getEmptyProfile() {
      return {
        personalIdentification: {
          fullName: '',
          dob: '',
          gender: '',
          nationality: '',
          maritalStatus: '',
          photo: null,
          biometric: null
        },
        civilRegistration: {
          birthCert: null,
          deathCert: null,
          marriageDivorce: null,
          adoption: null,
          citizenship: null,
          immigration: null
        },
        addressResidency: {
          currentAddress: '',
          previousAddresses: '',
          homeOrRental: '',
          utilityBills: null,
          landRecords: null
        },
        identityTravel: {
          idCard: '',
          passport: '',
          driversLicense: '',
          voterId: '',
          ssn: '',
          militaryRecords: null
        },
        healthMedical: {
          medicalHistory: '',
          vaccinations: null,
          insuranceDetails: '',
          disability: '',
          organDonor: '',
          prescriptions: '',
          mentalHealth: ''
        },
        employment: {
          eHistory: '',
          currentEmployer: '',
          workPermits: null,
          certifications: null,
          unemployment: '',
          tin: '',
          businessAffiliations: ''
        },
        education: {
          schools: '',
          diplomas: '',
          performance: '',
          scholarships: ''
        },
        financialTax: {
          incomeTax: null,
          bankAccounts: '',
          propertyTax: null,
          businessTax: null,
          pensionContrib: null,
          loanAid: null
        },
        socialSecurity: {
          pensionStatus: '',
          unemployment: '',
          disability: '',
          childcare: '',
          foodAssistance: '',
          housingAssistance: ''
        },
        criminalLegal: {
          policeRecords: null,
          courtCases: null,
          finesPenalties: null,
          paroleProbation: '',
          citizenshipRevocation: ''
        },
        transportation: {
          vehicleReg: '',
          trafficViolations: null,
          licenseHistory: '',
          publicTransportCard: ''
        },
        civicParticipation: {
          voterRegistration: '',
          electionHistory: '',
          partyMembership: '',
          militaryStatus: '',
          publicServiceRoles: ''
        }
      };
    }
  }
};
</script>

<style scoped>
.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 4px solid #4E97D1;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  color: #d32f2f;
  margin-bottom: 20px;
}

.retry-button {
  padding: 8px 16px;
  background-color: #4E97D1;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.retry-button:hover {
  background-color: #3a7da0;
}
</style>
