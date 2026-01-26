<template>
  <div class="searchable-dropdown">
    <label v-if="label">{{ label }}</label>
    <div class="select-wrapper">
      <input v-if="showSearch" type="text" v-model="searchTerm" class="search-input"
        :placeholder="searchPlaceholder" @input="filterOptions" @blur="handleBlur"
        @keydown.enter="selectActiveOption" @keydown.down="navigateOptions(1)" @keydown.up="navigateOptions(-1)"
        ref="searchInput" />
      <div v-else class="selected-option" @click="toggleSearch">
        <span v-if="selectedOption">{{ selectedOption }}</span>
        <span v-else-if="value && displayCode">{{ displayCode }}</span>
        <span v-else>{{ placeholder }}</span>
      </div>
      <div v-if="showSearch" class="options-dropdown">
        <div v-for="(option, index) in filteredOptions" :key="index" class="option"
          :class="{ 'active': index === selectedIndex }" @click="selectOption(option.code, option.name)"
          @mouseenter="selectedIndex = index">
          {{ option.name }}
        </div>
        <div v-if="filteredOptions.length === 0" class="no-results">
          {{ noResultsText }}
        </div>
      </div>
    </div>
    <!-- Add a hidden debugging element that can be toggled via prop -->
    <div v-if="debug" class="debug-info">
      <p><strong>Debug:</strong> value: {{ value }}, selectedOption: {{ selectedOption }}</p>
      <p>displayCode: {{ displayCode }}</p>
      <p>Countries loaded: {{ allCountries.length }}</p>
      <p>Last update: {{ debugInfo.lastUpdated }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SearchableCountrydropdown',
  props: {
    value: {
      type: String,
      default: ''
    },
    label: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: 'Select a country'
    },
    searchPlaceholder: {
      type: String,
      default: 'Search countries...'
    },
    noResultsText: {
      type: String,
      default: 'No matching countries found'
    },
    debug: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      showSearch: false,
      searchTerm: '',
      selectedOption: '',
      selectedIndex: -1,
      allCountries: [],
      filteredOptions: [],
      codeToNameMap: {
        // Default mapping for common countries - more will be added when loadCountries() is called
        'AF': 'Afghanistan',
        'AU': 'Australia',
        'US': 'United States',
        'CA': 'Canada',
        'GB': 'United Kingdom',
        'DE': 'Germany',
        'FR': 'France',
        'JP': 'Japan',
        'CN': 'China',
        'IN': 'India',
        'BR': 'Brazil',
        'RU': 'Russia',
        'ZA': 'South Africa',
        'ID': 'Indonesia'
      },
      debugInfo: {
        renderCount: 0,
        lastUpdated: '',
        valueHistory: []
      },
      isInitialized: false,
      mutationObserver: null
    };
  },
  computed: {
    displayCode() {
      if (!this.value) return '';
      
      // Try to find the name for this code
      const countryName = this.getCountryNameByCode(this.value);
      return countryName || this.value;
    }
  },
  created() {
    console.log(`Dropdown CREATED with value: ${this.value}`);
    this.debugInfo.valueHistory.push(`created: ${this.value}`);
    
    // Load countries first
    this.loadCountries();
  },
  mounted() {
    console.log(`Dropdown MOUNTED with value: ${this.value}, selectedOption: ${this.selectedOption}`);
    this.debugInfo.valueHistory.push(`mounted: ${this.value}`);
    
    // Set initial value after mounting
    if (this.value) {
      this.$nextTick(() => {
        this.manuallySetCountryName(this.value);
      });
    }
    
    // Mark component as initialized
    this.isInitialized = true;
    
    // Add mutation observer to detect when this component is re-attached to DOM
    this.setupMutationObserver();
  },
  
  beforeDestroy() {
    // Clean up the mutation observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
  },
  updated() {
    this.debugInfo.renderCount++;
    this.debugInfo.lastUpdated = new Date().toISOString();
  },
  watch: {
    value: {
      handler(newVal, oldVal) {
        console.log(`Value CHANGED: ${oldVal} -> ${newVal}`);
        this.debugInfo.valueHistory.push(`value changed: ${oldVal} -> ${newVal}`);
        
        if (newVal !== oldVal && this.isInitialized) {
          if (newVal) {
            // Add a slight delay to ensure all data is ready
            this.$nextTick(() => {
              this.manuallySetCountryName(newVal);
            });
          } else {
            this.selectedOption = '';
            this.$emit('update:name', '');
          }
        }
      }
    },
    allCountries: {
      handler(newCountries) {
        console.log(`Countries list UPDATED with ${newCountries.length} countries`);
        
        // Update the code-to-name map
        newCountries.forEach(country => {
          if (country && country.code) {
            this.codeToNameMap[country.code] = country.name;
          }
        });
        
        // Try to update selected option if we have a value
        if (this.value) {
          this.$nextTick(() => {
            this.manuallySetCountryName(this.value);
          });
        }
      }
    }
  },
  methods: {
    setupMutationObserver() {
      // Create a mutation observer to detect when the component is re-attached to DOM
      if (window.MutationObserver) {
        this.mutationObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
              // Check if our component or any parent is being added back to DOM
              let containsSelf = false;
              mutation.addedNodes.forEach(node => {
                if (node.contains && node.contains(this.$el) || (node === this.$el)) {
                  containsSelf = true;
                }
              });
              
              if (containsSelf && this.value) {
                console.log('Dropdown re-attached to DOM, restoring state for:', this.value);
                this.$nextTick(() => {
                  this.manuallySetCountryName(this.value);
                });
              }
            }
          }
        });
        
        // Observe changes to the body element
        this.mutationObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    },

    manuallySetCountryName(code) {
      if (!code) return;
      
      console.log(`Trying to set country name for code: ${code}`);
      const countryName = this.getCountryNameByCode(code);
      
      if (countryName) {
        console.log(`Setting selectedOption to: ${countryName}`);
        this.selectedOption = countryName;
        this.$emit('update:name', countryName);
      } else {
        console.log(`Country name not found for code: ${code}`);
      }
    },
    getCountryNameByCode(code) {
      if (!code) return '';
      
      // Normalize the code to uppercase for consistent lookup
      const normalizedCode = code.toUpperCase();
      
      // Try to find in code-to-name map first (should be fastest)
      if (this.codeToNameMap[normalizedCode]) {
        return this.codeToNameMap[normalizedCode];
      }
      
      // Then try to find in loaded countries
      const country = this.allCountries.find(c => 
        c && c.code && c.code.toUpperCase() === normalizedCode
      );
      
      if (country) {
        // Update the map for future lookups
        this.codeToNameMap[normalizedCode] = country.name;
        return country.name;
      }
      
      return '';
    },
    loadCountries() {
      try {
        console.log('Loading countries');
        let loadedCountries = [];
        
        // Try to get translations if i18n is available
        const hasI18n = this.$i18n && typeof this.$i18n.t === 'function';
        const hasTeMethod = this.$te && typeof this.$te === 'function';
        
        if (hasI18n && hasTeMethod && this.$te('countries')) {
          console.log('Using translated countries from i18n');
          try {
            const translatedCountries = this.$t('countries');
            if (typeof translatedCountries === 'object' && translatedCountries !== null) {
              loadedCountries = Object.keys(translatedCountries).map(code => ({
                code,
                name: translatedCountries[code]
              }));
            } else {
              console.warn('i18n countries not in expected format, using default countries');
              loadedCountries = this.getDefaultCountries();
            }
          } catch (translationError) {
            console.error('Error getting translations:', translationError);
            loadedCountries = this.getDefaultCountries();
          }
        } else {
          console.log('No translations found, using default countries');
          loadedCountries = this.getDefaultCountries();
        }
        
        // Sort countries by name with safe locale fallback
        const locale = hasI18n && this.$i18n.locale ? this.$i18n.locale : 'en';
        
        try {
          loadedCountries.sort((a, b) => 
            a.name.toLowerCase().localeCompare(b.name.toLowerCase(), locale)
          );
        } catch (sortError) {
          console.warn('Error sorting countries, using basic sort:', sortError);
          loadedCountries.sort((a, b) => a.name.localeCompare(b.name));
        }
        
        // Build complete code to name map for faster lookup
        loadedCountries.forEach(country => {
          if (country && country.code) {
            this.codeToNameMap[country.code] = country.name;
          }
        });
        
        // Update the component data
        this.allCountries = loadedCountries;
        this.filteredOptions = [...loadedCountries];
        
        console.log(`Loaded ${loadedCountries.length} countries`);
      } catch (error) {
        console.error('Error loading countries:', error);
        // Fallback to default countries
        this.allCountries = this.getDefaultCountries();
        this.filteredOptions = [...this.allCountries];
      }
    },
    toggleSearch() {
      this.showSearch = true;
      this.searchTerm = this.selectedOption || '';
      this.filterOptions();
      this.$nextTick(() => {
        if (this.$refs.searchInput) {
          this.$refs.searchInput.focus();
        }
      });
    },
    filterOptions() {
      if (!this.searchTerm) {
        this.filteredOptions = [...this.allCountries];
      } else {
        const searchTerm = this.searchTerm.toLowerCase();
        this.filteredOptions = this.allCountries.filter(option =>
          option.name.toLowerCase().includes(searchTerm)
        );
      }
      this.selectedIndex = -1;
    },
    selectOption(code, name) {
      console.log(`User selected: ${name} (${code})`);
      this.selectedOption = name;
      this.showSearch = false;
      this.$emit('input', code);
      this.$emit('update:name', name);
      this.$emit('change', code);
    },
    handleBlur(event) {
      if (!event.relatedTarget || !event.relatedTarget.closest('.options-dropdown')) {
        setTimeout(() => {
          this.showSearch = false;
        }, 150);
      }
    },
    selectActiveOption() {
      if (this.filteredOptions.length > 0 && this.selectedIndex >= 0 && this.selectedIndex < this.filteredOptions.length) {
        const selectedOption = this.filteredOptions[this.selectedIndex];
        this.selectOption(selectedOption.code, selectedOption.name);
      } else if (this.filteredOptions.length > 0) {
        const firstOption = this.filteredOptions[0];
        this.selectOption(firstOption.code, firstOption.name);
      }
    },
    navigateOptions(direction) {
      const optionsLength = this.filteredOptions.length;
      if (optionsLength > 0) {
        this.selectedIndex = (this.selectedIndex + direction + optionsLength) % optionsLength;
        if (this.selectedIndex >= 0 && this.selectedIndex < optionsLength) {
          this.$refs.searchInput.focus();
        }
      }
    },
    getDefaultCountries() {
      return [
        { code: 'AF', name: 'Afghanistan' },
        { code: 'AL', name: 'Albania' },
        { code: 'DZ', name: 'Algeria' },
        { code: 'AD', name: 'Andorra' },
        { code: 'AO', name: 'Angola' },
        { code: 'AG', name: 'Antigua and Barbuda' },
        { code: 'AR', name: 'Argentina' },
        { code: 'AM', name: 'Armenia' },
        { code: 'AU', name: 'Australia' },
        { code: 'AT', name: 'Austria' },
        { code: 'AZ', name: 'Azerbaijan' },
        { code: 'BS', name: 'Bahamas' },
        { code: 'BH', name: 'Bahrain' },
        { code: 'BD', name: 'Bangladesh' },
        { code: 'BB', name: 'Barbados' },
        { code: 'BY', name: 'Belarus' },
        { code: 'BE', name: 'Belgium' },
        { code: 'BZ', name: 'Belize' },
        { code: 'BJ', name: 'Benin' },
        { code: 'BT', name: 'Bhutan' },
        { code: 'BO', name: 'Bolivia' },
        { code: 'BA', name: 'Bosnia and Herzegovina' },
        { code: 'BW', name: 'Botswana' },
        { code: 'BR', name: 'Brazil' },
        { code: 'BN', name: 'Brunei Darussalam' },
        { code: 'BG', name: 'Bulgaria' },
        { code: 'BF', name: 'Burkina Faso' },
        { code: 'BI', name: 'Burundi' },
        { code: 'CV', name: 'Cabo Verde' },
        { code: 'KH', name: 'Cambodia' },
        { code: 'CM', name: 'Cameroon' },
        { code: 'CA', name: 'Canada' },
        { code: 'CF', name: 'Central African Republic' },
        { code: 'TD', name: 'Chad' },
        { code: 'CL', name: 'Chile' },
        { code: 'CN', name: 'China' },
        { code: 'CO', name: 'Colombia' },
        { code: 'KM', name: 'Comoros' },
        { code: 'CG', name: 'Congo' },
        { code: 'CD', name: 'Congo (the Democratic Republic of the)' },
        { code: 'CR', name: 'Costa Rica' },
        { code: 'CI', name: "Cote d'Ivoire" },
        { code: 'HR', name: 'Croatia' },
        { code: 'CU', name: 'Cuba' },
        { code: 'CY', name: 'Cyprus' },
        { code: 'CZ', name: 'Czech Republic' },
        { code: 'DK', name: 'Denmark' },
        { code: 'DJ', name: 'Djibouti' },
        { code: 'DM', name: 'Dominica' },
        { code: 'DO', name: 'Dominican Republic' },
        { code: 'EC', name: 'Ecuador' },
        { code: 'EG', name: 'Egypt' },
        { code: 'SV', name: 'El Salvador' },
        { code: 'GQ', name: 'Equatorial Guinea' },
        { code: 'ER', name: 'Eritrea' },
        { code: 'EE', name: 'Estonia' },
        { code: 'ET', name: 'Ethiopia' },
        { code: 'FI', name: 'Finland' },
        { code: 'FJ', name: 'Fiji' },
        { code: 'FR', name: 'France' },
        { code: 'GA', name: 'Gabon' },
        { code: 'GM', name: 'Gambia' },
        { code: 'GE', name: 'Georgia' },
        { code: 'DE', name: 'Germany' },
        { code: 'GH', name: 'Ghana' },
        { code: 'GR', name: 'Greece' },
        { code: 'GD', name: 'Grenada' },
        { code: 'GT', name: 'Guatemala' },
        { code: 'GN', name: 'Guinea' },
        { code: 'GW', name: 'Guinea-Bissau' },
        { code: 'GY', name: 'Guyana' },
        { code: 'HT', name: 'Haiti' },
        { code: 'HN', name: 'Honduras' },
        { code: 'HU', name: 'Hungary' },
        { code: 'IS', name: 'Iceland' },
        { code: 'IN', name: 'India' },
        { code: 'ID', name: 'Indonesia' },
        { code: 'IR', name: 'Iran (the Islamic Republic of)' },
        { code: 'IQ', name: 'Iraq' },
        { code: 'IE', name: 'Ireland' },
        { code: 'IL', name: 'Israel' },
        { code: 'IT', name: 'Italy' },
        { code: 'JM', name: 'Jamaica' },
        { code: 'JP', name: 'Japan' },
        { code: 'JO', name: 'Jordan' },
        { code: 'KZ', name: 'Kazakhstan' },
        { code: 'KE', name: 'Kenya' },
        { code: 'KI', name: 'Kiribati' },
        { code: 'KP', name: 'Korea (North)' },
        { code: 'KR', name: 'Korea (South)' },
        { code: 'KW', name: 'Kuwait' },
        { code: 'KG', name: 'Kyrgyzstan' },
        { code: 'LA', name: 'Laos' },
        { code: 'LV', name: 'Latvia' },
        { code: 'LB', name: 'Lebanon' },
        { code: 'LS', name: 'Lesotho' },
        { code: 'LR', name: 'Liberia' },
        { code: 'LY', name: 'Libya' },
        { code: 'LI', name: 'Liechtenstein' },
        { code: 'LT', name: 'Lithuania' },
        { code: 'LU', name: 'Luxembourg' },
        { code: 'MG', name: 'Madagascar' },
        { code: 'MW', name: 'Malawi' },
        { code: 'MY', name: 'Malaysia' },
        { code: 'MV', name: 'Maldives' },
        { code: 'ML', name: 'Mali' },
        { code: 'MT', name: 'Malta' },
        { code: 'MH', name: 'Marshall Islands' },
        { code: 'MR', name: 'Mauritania' },
        { code: 'MU', name: 'Mauritius' },
        { code: 'MX', name: 'Mexico' },
        { code: 'FM', name: 'Micronesia' },
        { code: 'MD', name: 'Moldova' },
        { code: 'MC', name: 'Monaco' },
        { code: 'MN', name: 'Mongolia' },
        { code: 'ME', name: 'Montenegro' },
        { code: 'MA', name: 'Morocco' },
        { code: 'MZ', name: 'Mozambique' },
        { code: 'MM', name: 'Myanmar' },
        { code: 'NA', name: 'Namibia' },
        { code: 'NR', name: 'Nauru' },
        { code: 'NP', name: 'Nepal' },
        { code: 'NL', name: 'Netherlands' },
        { code: 'NZ', name: 'New Zealand' },
        { code: 'NI', name: 'Nicaragua' },
        { code: 'NE', name: 'Niger' },
        { code: 'NG', name: 'Nigeria' },
        { code: 'MK', name: 'North Macedonia' },
        { code: 'NO', name: 'Norway' },
        { code: 'OM', name: 'Oman' },
        { code: 'PK', name: 'Pakistan' },
        { code: 'PW', name: 'Palau' },
        { code: 'PS', name: 'Palestine' },
        { code: 'PA', name: 'Panama' },
        { code: 'PG', name: 'Papua New Guinea' },
        { code: 'PY', name: 'Paraguay' },
        { code: 'PE', name: 'Peru' },
        { code: 'PH', name: 'Philippines' },
        { code: 'PL', name: 'Poland' },
        { code: 'PT', name: 'Portugal' },
        { code: 'QA', name: 'Qatar' },
        { code: 'RO', name: 'Romania' },
        { code: 'RU', name: 'Russia' },
        { code: 'RW', name: 'Rwanda' },
        { code: 'KN', name: 'Saint Kitts and Nevis' },
        { code: 'LC', name: 'Saint Lucia' },
        { code: 'VC', name: 'Saint Vincent and the Grenadines' },
        { code: 'WS', name: 'Samoa' },
        { code: 'SM', name: 'San Marino' },
        { code: 'ST', name: 'Sao Tome and Principe' },
        { code: 'SA', name: 'Saudi Arabia' },
        { code: 'SN', name: 'Senegal' },
        { code: 'RS', name: 'Serbia' },
        { code: 'SC', name: 'Seychelles' },
        { code: 'SL', name: 'Sierra Leone' },
        { code: 'SG', name: 'Singapore' },
        { code: 'SK', name: 'Slovakia' },
        { code: 'SI', name: 'Slovenia' },
        { code: 'SB', name: 'Solomon Islands' },
        { code: 'SO', name: 'Somalia' },
        { code: 'ZA', name: 'South Africa' },
        { code: 'SS', name: 'South Sudan' },
        { code: 'ES', name: 'Spain' },
        { code: 'LK', name: 'Sri Lanka' },
        { code: 'SD', name: 'Sudan' },
        { code: 'SR', name: 'Suriname' },
        { code: 'SE', name: 'Sweden' },
        { code: 'CH', name: 'Switzerland' },
        { code: 'SY', name: 'Syria' },
        { code: 'TW', name: 'Taiwan' },
        { code: 'TJ', name: 'Tajikistan' },
        { code: 'TZ', name: 'Tanzania' },
        { code: 'TH', name: 'Thailand' },
        { code: 'TL', name: 'Timor-Leste' },
        { code: 'TG', name: 'Togo' },
        { code: 'TO', name: 'Tonga' },
        { code: 'TT', name: 'Trinidad and Tobago' },
        { code: 'TN', name: 'Tunisia' },
        { code: 'TR', name: 'Turkey' },
        { code: 'TM', name: 'Turkmenistan' },
        { code: 'TV', name: 'Tuvalu' },
        { code: 'UG', name: 'Uganda' },
        { code: 'UA', name: 'Ukraine' },
        { code: 'AE', name: 'United Arab Emirates' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'US', name: 'United States' },
        { code: 'UY', name: 'Uruguay' },
        { code: 'UZ', name: 'Uzbekistan' },
        { code: 'VU', name: 'Vanuatu' },
        { code: 'VA', name: 'Vatican City' },
        { code: 'VE', name: 'Venezuela' },
        { code: 'VN', name: 'Vietnam' },
        { code: 'YE', name: 'Yemen' },
        { code: 'ZM', name: 'Zambia' },
        { code: 'ZW', name: 'Zimbabwe' }
      ];
    }
  }
};
</script>


<style scoped>
/* Inherit styles from the parent UserProfileComponent for consistency */
.searchable-dropdown {
    display: flex;
    flex-direction: column;
}

.searchable-dropdown label {
    margin-bottom: 4px;
    font-weight: 500;
    font-size: 0.95rem;
}

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
    content: '▼';
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
    background-color: var(--dialog-primary-button-bg, #4E97D1);
    color: var(--dialog-primary-button-text, #ffffff);
}

.no-results {
    padding: 10px;
    text-align: center;
    color: #999;
    font-style: italic;
}

/* Focus styles */
.search-input:focus {
    border-color: var(--dialog-primary-button-bg, #4E97D1);
    box-shadow: 0 0 0 2px rgba(78, 151, 209, 0.2);
    outline: none;
}

/* Dark theme adjustments */
:deep([data-theme="dark"]) .options-dropdown,
:deep(.dark-mode) .options-dropdown {
    background-color: var(--dialog-input-background, #333333);
    border-color: var(--dialog-input-border-color, #3a3a3a);
}

:deep([data-theme="dark"]) .option:hover,
:deep(.dark-mode) .option:hover,
:deep([data-theme="dark"]) .option.active,
:deep(.dark-mode) .option.active {
    background-color: var(--dialog-primary-button-bg, #4E97D1);
}

:deep([data-theme="dark"]) .no-results,
:deep(.dark-mode) .no-results {
    color: #777;
}

.unmatched-value {
    font-style: italic;
    opacity: 0.8;
}
</style>