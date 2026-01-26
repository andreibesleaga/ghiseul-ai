<!-- PersonalIdentificationTab.vue -->
<template>
  <div class="tab-panel">
    <h3 class="tab-title">{{ $t('userProfile.tabs.tab1') }}</h3>
    
    <div class="form-grid">
      <div class="form-group">
        <label for="fullName">{{ $t('userProfile.fields.fullName') }} *</label>
        <input 
          id="fullName"
          v-model="localData.fullName" 
          type="text"
          class="form-control"
          :placeholder="$t('userProfile.placeholders.fullName')"
          @input="updateFormData"
        />
        <small v-if="validationErrors.fullName" class="error-text">
          {{ validationErrors.fullName }}
        </small>
      </div>
      
      <div class="form-group">
        <label for="dob">{{ $t('userProfile.fields.dob') }} *</label>
        <input 
          id="dob"
          v-model="localData.dob" 
          type="date"
          class="form-control"
          @change="updateFormData"
        />
        <small v-if="validationErrors.dob" class="error-text">
          {{ validationErrors.dob }}
        </small>
      </div>
      
      <div class="form-group">
        <label for="gender">{{ $t('userProfile.fields.gender') }}</label>
        <select 
          id="gender"
          v-model="localData.gender" 
          class="form-control"
          @change="updateFormData"
        >
          <option value="">{{ $t('userProfile.select') }}</option>
          <option value="male">{{ $t('userProfile.gender.male') }}</option>
          <option value="female">{{ $t('userProfile.gender.female') }}</option>
          <option value="other">{{ $t('userProfile.gender.other') }}</option>
          <option value="prefer-not">{{ $t('userProfile.gender.preferNot') }}</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="nationality">{{ $t('userProfile.fields.nationality') }}</label>
        <input 
          id="nationality"
          v-model="localData.nationality" 
          type="text"
          class="form-control"
          :placeholder="$t('userProfile.placeholders.nationality')"
          @input="updateFormData"
        />
      </div>
      
      <div class="form-group">
        <label for="maritalStatus">{{ $t('userProfile.fields.maritalStatus') }}</label>
        <select 
          id="maritalStatus"
          v-model="localData.maritalStatus" 
          class="form-control"
          @change="updateFormData"
        >
          <option value="">{{ $t('userProfile.select') }}</option>
          <option value="single">{{ $t('userProfile.maritalStatus.single') }}</option>
          <option value="married">{{ $t('userProfile.maritalStatus.married') }}</option>
          <option value="divorced">{{ $t('userProfile.maritalStatus.divorced') }}</option>
          <option value="widowed">{{ $t('userProfile.maritalStatus.widowed') }}</option>
          <option value="other">{{ $t('userProfile.maritalStatus.other') }}</option>
        </select>
      </div>
    </div>
    
    <div class="file-upload-section">
      <h4>{{ $t('userProfile.documentUpload') }}</h4>
      
      <div class="file-upload-row">
        <div class="file-upload-group">
          <label for="photo">{{ $t('userProfile.fields.photograph') }}</label>
          <div class="file-input-wrapper">
            <div 
              v-if="photoPreview" 
              class="file-preview"
            >
              <img :src="photoPreview" alt="Photo preview" class="image-preview" />
              <button type="button" class="remove-file" @click="removeFile('photo')">×</button>
            </div>
            <label v-else class="file-upload-label" for="photo">
              <span class="upload-icon">+</span>
              <span>{{ $t('userProfile.uploadPhoto') }}</span>
            </label>
            <input 
              id="photo"
              type="file" 
              accept="image/*" 
              @change="onFileChange($event, 'photo')"
              class="hidden-input"
            />
          </div>
          <small class="help-text">{{ $t('userProfile.photoRequirements') }}</small>
        </div>
        
        <div class="file-upload-group">
          <label for="biometric">{{ $t('userProfile.fields.biometric') }}</label>
          <div class="file-input-wrapper">
            <div 
              v-if="biometricPreview" 
              class="file-preview file-document"
            >
              <span class="file-name">{{ biometricFileName }}</span>
              <button type="button" class="remove-file" @click="removeFile('biometric')">×</button>
            </div>
            <label v-else class="file-upload-label" for="biometric">
              <span class="upload-icon">+</span>
              <span>{{ $t('userProfile.uploadFile') }}</span>
            </label>
            <input 
              id="biometric"
              type="file" 
              accept=".pdf,.jpg,.png" 
              @change="onFileChange($event, 'biometric')"
              class="hidden-input"
            />
          </div>
          <small class="help-text">{{ $t('userProfile.biometricRequirements') }}</small>
        </div>
      </div>
    </div>
    
    <div class="required-notice">
      * {{ $t('userProfile.requiredFields') }}
    </div>
  </div>
</template>

<script>
export default {
  name: 'PersonalIdentificationTab',
  props: {
    formData: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      localData: {
        fullName: this.formData.personalIdentification.fullName || '',
        dob: this.formData.personalIdentification.dob || '',
        gender: this.formData.personalIdentification.gender || '',
        nationality: this.formData.personalIdentification.nationality || '',
        maritalStatus: this.formData.personalIdentification.maritalStatus || '',
        photo: this.formData.personalIdentification.photo || null,
        biometric: this.formData.personalIdentification.biometric || null
      },
      photoPreview: null,
      biometricFileName: '',
      biometricPreview: null,
      validationErrors: {
        fullName: '',
        dob: ''
      },
      debounceTimer: null
    }
  },
  mounted() {
    this.initializeFilePreview()
    this.validateFields()
  },
  methods: {
    initializeFilePreview() {
      // If photo file exists from props, create preview
      if (this.localData.photo instanceof File) {
        this.createPhotoPreview(this.localData.photo)
      } else if (this.localData.photo) {
        // Handle existing photo from server (string URL)
        this.photoPreview = this.localData.photo
      }
      
      // If biometric file exists
      if (this.localData.biometric instanceof File) {
        this.biometricFileName = this.localData.biometric.name
        this.biometricPreview = true
      } else if (this.localData.biometric) {
        // Handle existing biometric from server
        this.biometricFileName = this.$t('userProfile.existingFile')
        this.biometricPreview = true
      }
    },
    onFileChange(event, fieldName) {
      const file = event.target.files[0]
      if (!file) return
      
      this.localData[fieldName] = file
      
      if (fieldName === 'photo') {
        this.createPhotoPreview(file)
      } else if (fieldName === 'biometric') {
        this.biometricFileName = file.name
        this.biometricPreview = true
      }
      
      this.updateFormData()
    },
    createPhotoPreview(file) {
      // Revoke previous preview URL to prevent memory leaks
      if (this.photoPreview && this.photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(this.photoPreview)
      }
      
      // Create a new preview
      this.photoPreview = URL.createObjectURL(file)
    },
    removeFile(fieldName) {
      if (fieldName === 'photo') {
        if (this.photoPreview && this.photoPreview.startsWith('blob:')) {
          URL.revokeObjectURL(this.photoPreview)
        }
        this.photoPreview = null
      } else if (fieldName === 'biometric') {
        this.biometricFileName = ''
        this.biometricPreview = null
      }
      
      this.localData[fieldName] = null
      this.updateFormData()
    },
    validateFields() {
      // Reset validation errors
      this.validationErrors = {
        fullName: '',
        dob: ''
      }
      
      // Validate full name
      if (!this.localData.fullName.trim()) {
        this.validationErrors.fullName = this.$t('userProfile.validation.nameRequired')
      }
      
      // Validate date of birth
      if (!this.localData.dob) {
        this.validationErrors.dob = this.$t('userProfile.validation.dobRequired')
      } else {
        const dobDate = new Date(this.localData.dob)
        const today = new Date()
        
        if (dobDate > today) {
          this.validationErrors.dob = this.$t('userProfile.validation.dobFuture')
        }
      }
      
      return !Object.values(this.validationErrors).some(error => error)
    },
    updateFormData() {
      // Debounce updates to prevent excessive emissions
      clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        this.validateFields()
        
        // Emit update with only the changes for this section
        this.$emit('update:form-data', 'personalIdentification', this.localData)
      }, 300)
    }
  },
  beforeDestroy() {
    // Clean up any blob URLs
    if (this.photoPreview && this.photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(this.photoPreview)
    }
  }
}
</script>

<style scoped>
.tab-panel {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.tab-title {
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
  font-size: 1.25rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.form-group {
  margin-bottom: 16px;
}

label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-control:focus {
  border-color: #4E97D1;
  outline: none;
}

.error-text {
  display: block;
  color: #f44336;
  font-size: 0.85rem;
  margin-top: 4px;
}

.file-upload-section {
  margin-top: 24px;
  background: #f9f9f9;
  padding: 16px;
  border-radius: 4px;
}

.file-upload-section h4 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 1.1rem;
  color: #555;
}

.file-upload-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.file-upload-group {
  margin-bottom: 16px;
}

.file-input-wrapper {
  margin-top: 8px;
  margin-bottom: 8px;
  height: 120px;
}

.file-upload-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border: 2px dashed #ccc;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.file-upload-label:hover {
  border-color: #4E97D1;
  background: rgba(78, 151, 209, 0.05);
}

.upload-icon {
  font-size: 24px;
  margin-bottom: 8px;
  color: #999;
}

.hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.file-preview {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #ddd;
}

.image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-document {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
  border: 1px solid #ddd;
}

.file-name {
  max-width: 80%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9rem;
  padding: 0 10px;
}

.remove-file {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s;
}

.remove-file:hover {
  background: rgba(0, 0, 0, 0.7);
}

.help-text {
  display: block;
  font-size: 0.85rem;
  color: #777;
  margin-top: 4px;
}

.required-notice {
  margin-top: 24px;
  font-size: 0.9rem;
  color: #666;
  font-style: italic;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
