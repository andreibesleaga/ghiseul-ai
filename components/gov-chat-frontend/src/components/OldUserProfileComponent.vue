<!-- UserProfileComponent.vue -->
<template>
    <div class="user-profile-modal">
      <div class="overlay" @click="cancel"></div>
      <div class="modal-content">
        <!-- i18n for title and privacy info -->
        <h2>{{ $t('userProfile.title') }}</h2>
        <p class="privacy-info">
          {{ $t('userProfile.privacyInfo') }}
          <a href="#" class="privacy-link">{{ $t('userProfile.privacyPolicyLink') }}</a>
        </p>
  
        <!-- Tabs -->
        <div class="tabs">
          <button
            v-for="(tab, index) in tabs"
            :key="index"
            :class="{ active: activeTab === index }"
            @click="activeTab = index"
          >
            {{ $t(`userProfile.tabs.${tab.key}`) }}
          </button>
        </div>
  
        <!-- Tab content -->
        <div class="tab-content">
          <!-- 1) Personal Identification Data -->
          <div v-if="activeTab === 0">
            <div class="field-group">
              <label>{{ $t('userProfile.fields.fullName') }}</label>
              <input v-model="formData.personalIdentification.fullName" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.dob') }}</label>
              <input v-model="formData.personalIdentification.dob" type="date" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.gender') }}</label>
              <input v-model="formData.personalIdentification.gender" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.nationality') }}</label>
              <input v-model="formData.personalIdentification.nationality" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.maritalStatus') }}</label>
              <input v-model="formData.personalIdentification.maritalStatus" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.photograph') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'personalIdentification', 'photo')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.biometric') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'personalIdentification', 'biometric')"
              />
            </div>
          </div>
  
          <!-- 2) Civil Registration & Documentation -->
          <div v-else-if="activeTab === 1">
            <div class="field-group">
              <label>{{ $t('userProfile.fields.birthCert') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'civilRegistration', 'birthCert')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.deathCert') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'civilRegistration', 'deathCert')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.marriageDivorce') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'civilRegistration', 'marriageDivorce')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.adoption') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'civilRegistration', 'adoption')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.citizenship') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'civilRegistration', 'citizenship')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.immigration') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'civilRegistration', 'immigration')"
              />
            </div>
          </div>
  
          <!-- 3) Address & Residency Information -->
          <div v-else-if="activeTab === 2">
            <div class="field-group">
              <label>{{ $t('userProfile.fields.currentAddress') }}</label>
              <input v-model="formData.addressResidency.currentAddress" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.previousAddresses') }}</label>
              <textarea
                v-model="formData.addressResidency.previousAddresses"
              ></textarea>
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.homeOrRental') }}</label>
              <input v-model="formData.addressResidency.homeOrRental" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.utilityBills') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'addressResidency', 'utilityBills')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.landRecords') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'addressResidency', 'landRecords')"
              />
            </div>
          </div>
  
          <!-- 4) Identity & Travel Documents -->
          <div v-else-if="activeTab === 3">
            <div class="field-group">
              <label>{{ $t('userProfile.fields.idCard') }}</label>
              <input v-model="formData.identityTravel.idCard" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.passport') }}</label>
              <input v-model="formData.identityTravel.passport" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.driversLicense') }}</label>
              <input v-model="formData.identityTravel.driversLicense" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.voterId') }}</label>
              <input v-model="formData.identityTravel.voterId" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.ssn') }}</label>
              <input v-model="formData.identityTravel.ssn" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.militaryRecords') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'identityTravel', 'militaryRecords')"
              />
            </div>
          </div>
  
          <!-- 5) Health & Medical Records -->
          <div v-else-if="activeTab === 4">
            <div class="field-group">
              <label>{{ $t('userProfile.fields.medicalHistory') }}</label>
              <textarea
                v-model="formData.healthMedical.medicalHistory"
              ></textarea>
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.vaccinations') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'healthMedical', 'vaccinations')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.insuranceDetails') }}</label>
              <input v-model="formData.healthMedical.insuranceDetails" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.disability') }}</label>
              <input v-model="formData.healthMedical.disability" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.organDonor') }}</label>
              <input v-model="formData.healthMedical.organDonor" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.prescriptions') }}</label>
              <textarea
                v-model="formData.healthMedical.prescriptions"
              ></textarea>
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.mentalHealth') }}</label>
              <textarea
                v-model="formData.healthMedical.mentalHealth"
              ></textarea>
            </div>
          </div>
  
          <!-- 6) Employment & Economic Data -->
          <div v-else-if="activeTab === 5">
            <div class="field-group">
              <label>{{ $t('userProfile.fields.eHistory') }}</label>
              <textarea v-model="formData.employment.eHistory"></textarea>
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.currentEmployer') }}</label>
              <input v-model="formData.employment.currentEmployer" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.workPermits') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'employment', 'workPermits')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.certifications') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'employment', 'certifications')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.unemployment') }}</label>
              <input v-model="formData.employment.unemployment" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.tin') }}</label>
              <input v-model="formData.employment.tin" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.businessAffiliations') }}</label>
              <textarea
                v-model="formData.employment.businessAffiliations"
              ></textarea>
            </div>
          </div>
  
          <!-- 7) Education & Academic Records -->
          <div v-else-if="activeTab === 6">
            <div class="field-group">
              <label>{{ $t('userProfile.fields.schools') }}</label>
              <textarea v-model="formData.education.schools"></textarea>
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.diplomas') }}</label>
              <textarea v-model="formData.education.diplomas"></textarea>
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.performance') }}</label>
              <textarea v-model="formData.education.performance"></textarea>
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.scholarships') }}</label>
              <textarea v-model="formData.education.scholarships"></textarea>
            </div>
          </div>
  
          <!-- 8) Financial & Tax Data -->
          <div v-else-if="activeTab === 7">
            <div class="field-group">
              <label>{{ $t('userProfile.fields.incomeTax') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'financialTax', 'incomeTax')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.bankAccounts') }}</label>
              <input v-model="formData.financialTax.bankAccounts" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.propertyTax') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'financialTax', 'propertyTax')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.businessTax') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'financialTax', 'businessTax')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.pensionContrib') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'financialTax', 'pensionContrib')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.loanAid') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'financialTax', 'loanAid')"
              />
            </div>
          </div>
  
          <!-- 9) Social Security & Welfare -->
          <div v-else-if="activeTab === 8">
            <div class="field-group">
              <label>{{ $t('userProfile.fields.pensionStatus') }}</label>
              <textarea
                v-model="formData.socialSecurity.pensionStatus"
              ></textarea>
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.unemployment') }}</label>
              <input v-model="formData.socialSecurity.unemployment" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.disability') }}</label>
              <input v-model="formData.socialSecurity.disability" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.childcare') }}</label>
              <input v-model="formData.socialSecurity.childcare" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.foodAssistance') }}</label>
              <input v-model="formData.socialSecurity.foodAssistance" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.housingAssistance') }}</label>
              <input v-model="formData.socialSecurity.housingAssistance" type="text" />
            </div>
          </div>
  
          <!-- 10) Criminal & Legal Records -->
          <div v-else-if="activeTab === 9">
            <div class="field-group">
              <label>{{ $t('userProfile.fields.policeRecords') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'criminalLegal', 'policeRecords')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.courtCases') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'criminalLegal', 'courtCases')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.finesPenalties') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'criminalLegal', 'finesPenalties')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.paroleProbation') }}</label>
              <input
                v-model="formData.criminalLegal.paroleProbation"
                type="text"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.citizenshipRevocation') }}</label>
              <input
                v-model="formData.criminalLegal.citizenshipRevocation"
                type="text"
              />
            </div>
          </div>
  
          <!-- 11) Transportation & Mobility -->
          <div v-else-if="activeTab === 10">
            <div class="field-group">
              <label>{{ $t('userProfile.fields.vehicleReg') }}</label>
              <input v-model="formData.transportation.vehicleReg" type="text" />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.trafficViolations') }}</label>
              <input
                type="file"
                v-file-dialog-safe
                @change="onFileChange($event, 'transportation', 'trafficViolations')"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.licenseHistory') }}</label>
              <input
                v-model="formData.transportation.licenseHistory"
                type="text"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.publicTransportCard') }}</label>
              <input
                v-model="formData.transportation.publicTransportCard"
                type="text"
              />
            </div>
          </div>
  
          <!-- 12) Civic & Political Participation -->
          <div v-else-if="activeTab === 11">
            <div class="field-group">
              <label>{{ $t('userProfile.fields.voterRegistration') }}</label>
              <input
                v-model="formData.civicParticipation.voterRegistration"
                type="text"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.electionHistory') }}</label>
              <textarea
                v-model="formData.civicParticipation.electionHistory"
              ></textarea>
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.partyMembership') }}</label>
              <input
                v-model="formData.civicParticipation.partyMembership"
                type="text"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.militaryStatus') }}</label>
              <input
                v-model="formData.civicParticipation.militaryStatus"
                type="text"
              />
            </div>
            <div class="field-group">
              <label>{{ $t('userProfile.fields.publicServiceRoles') }}</label>
              <textarea
                v-model="formData.civicParticipation.publicServiceRoles"
              ></textarea>
            </div>
          </div>
        </div>
  
        <!-- Action buttons -->
        <div class="actions">
          <button class="cancel-btn" @click="cancel">
            {{ $t('userProfile.actions.cancel') }}
          </button>
          <button class="save-btn" @click="saveProfile">
            {{ $t('userProfile.actions.save') }}
          </button>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  export default {
    name: 'UserProfileComponent',
    data() {
      return {
        activeTab: 0,
        tabs: [
          { key: 'tab1' },
          { key: 'tab2' },
          { key: 'tab3' },
          { key: 'tab4' },
          { key: 'tab5' },
          { key: 'tab6' },
          { key: 'tab7' },
          { key: 'tab8' },
          { key: 'tab9' },
          { key: 'tab10' },
          { key: 'tab11' },
          { key: 'tab12' }
        ],
        formData: {
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
        }
      };
    },
    methods: {
      cancel() {
        this.$emit('cancel');
      },
      saveProfile() {
        // Emit a deep copy to avoid direct mutation
        const copy = JSON.parse(JSON.stringify(this.formData));
        this.$emit('save', copy);
      },
      onFileChange(e, section, fieldKey) {
        const file = e.target.files[0];
        if (!file) return;
        this.formData[section][fieldKey] = file;
      }
    }
  };
  </script>
  
  <style scoped>
  /* Force label to appear in black text if any global style is hiding them */
  label {
    display: inline-block !important;
    color: #000 !important;
  }
  
  .user-profile-modal {
    position: fixed;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    z-index: 9999;
  }
  .overlay {
    position: absolute;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
  }
  .modal-content {
    position: relative;
    background: #fff;
    width: 900px;
    max-width: 90%;
    margin: 40px auto;
    padding: 20px;
    border-radius: 8px;
    overflow-y: auto;
    max-height: 90vh;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .privacy-info {
    font-size: 0.9rem;
    margin-bottom: 16px;
  }
  .privacy-link {
    color: #4E97D1;
    text-decoration: underline;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 10px;
    border-bottom: 1px solid #ccc;
    max-height: 120px;
    overflow-y: auto;
  }
  .tabs button {
    margin-right: 4px;
    padding: 8px 12px;
    background: #eee;
    border: 1px solid #ccc;
    border-bottom: none;
    cursor: pointer;
    border-radius: 4px 4px 0 0;
    white-space: nowrap;
  }
  .tabs button:hover {
    background: #ddd;
  }
  .tabs button.active {
    background: #fff;
    font-weight: bold;
    border-bottom: 2px solid #fff;
  }
  .tab-content {
    border: 1px solid #ccc;
    border-top: none;
    padding: 10px;
    border-radius: 0 4px 4px 4px;
    background: #fff;
    min-height: 300px;
  }
  .field-group {
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
  }
  .field-group input[type="text"],
  .field-group input[type="date"],
  .field-group textarea {
    padding: 6px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  .actions {
    margin-top: 20px;
    text-align: right;
  }
  .cancel-btn,
  .save-btn {
    margin-left: 8px;
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  .cancel-btn {
    background: #ccc;
    color: #333;
  }
  .cancel-btn:hover {
    background: #bbb;
  }
  .save-btn {
    background: #4E97D1;
    color: #fff;
  }
  .save-btn:hover {
    background: #3a7da0;
  }
  </style>
  