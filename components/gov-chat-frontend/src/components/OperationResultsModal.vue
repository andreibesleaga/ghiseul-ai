<template>
  <div class="modal" :data-theme="theme">
    <div class="overlay" @click="$emit('close')"></div>
    <div class="modal-content">
      <div class="modal-title">
        <h2>{{ title }}</h2>
        <button class="close-btn" @click="$emit('close')" aria-label="Close dialog">×</button>
      </div>
      
      <div class="modal-body">
        <!-- Operation success/failure status -->
        <div :class="['result-status', results.success ? 'status-success' : 'status-error']">
          <div class="status-icon">{{ results.success ? '✓' : '✗' }}</div>
          <div class="status-message">{{ results.message }}</div>
        </div>
        
        <!-- Operation details: Backup results -->
        <div v-if="operation === 'backupDatabase' && results.success" class="result-details">
          <div class="result-section">
            <h3>{{ translate('admin.operations.backupDetails', 'Backup Details') }}</h3>
            <div class="detail-item">
              <div class="detail-label">{{ translate('admin.operations.backupFile', 'Backup File') }}:</div>
              <div class="detail-value">{{ results.backupFile }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">{{ translate('admin.operations.backupLocation', 'Location') }}:</div>
              <div class="detail-value">{{ results.backupLocation }}</div>
            </div>
            <div class="detail-item" v-if="results.size">
              <div class="detail-label">{{ translate('admin.operations.backupSize', 'Size') }}:</div>
              <div class="detail-value">{{ results.size }}</div>
            </div>
          </div>
        </div>
        
        <!-- Operation details: Reindex results -->
        <div v-if="operation === 'reindexDatabase' && results.success && results.results" class="result-details">
          <div class="result-section">
            <h3>{{ translate('admin.operations.reindexResults', 'Reindex Results') }}</h3>
            <div class="table-container">
              <table class="results-table">
                <thead>
                  <tr>
                    <th>{{ translate('admin.operations.collection', 'Collection') }}</th>
                    <th>{{ translate('admin.operations.status', 'Status') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in results.results" :key="index">
                    <td>{{ item.collection }}</td>
                    <td>
                      <span :class="['status-badge', item.status === 'success' ? 'badge-success' : 'badge-error']">
                        {{ item.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <!-- Operation details: Optimize results -->
        <div v-if="operation === 'optimizeDatabase' && results.success && results.results" class="result-details">
          <div class="result-section">
            <h3>{{ translate('admin.operations.optimizeResults', 'Optimization Results') }}</h3>
            <div class="table-container">
              <table class="results-table">
                <thead>
                  <tr>
                    <th>{{ translate('admin.operations.collection', 'Collection') }}</th>
                    <th>{{ translate('admin.operations.status', 'Status') }}</th>
                    <th>{{ translate('admin.operations.indexSuggestions', 'Index Suggestions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in results.results" :key="index">
                    <td>{{ item.collection }}</td>
                    <td>
                      <span :class="['status-badge', item.status === 'success' ? 'badge-success' : 'badge-error']">
                        {{ item.status }}
                      </span>
                    </td>
                    <td>
                      <ul v-if="item.indexSuggestions && item.indexSuggestions.length">
                        <li v-for="(suggestion, i) in item.indexSuggestions" :key="i">
                          {{ suggestion }}
                        </li>
                      </ul>
                      <span v-else>-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <!-- Generic error details -->
        <div v-if="!results.success && results.error" class="result-details error-details">
          <div class="result-section">
            <h3>{{ translate('admin.operations.errorDetails', 'Error Details') }}</h3>
            <pre class="error-message">{{ results.error }}</pre>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-primary" @click="$emit('close')">
          {{ translate('admin.operations.close', 'Close') }}
        </button>
      </div>
    </div>
  </div>
</template>
  
  <script>
  export default {
    name: 'OperationResultsModal',
    props: {
      operation: {
        type: String,
        required: true
      },
      results: {
        type: Object,
        required: true
      }
    },
    emits: ['close'],
    data() {
      return {
        // Current locale for translations
        currentLocale: this.getCurrentLanguage()
      };
    },
    computed: {
      title() {
        const operationTitles = {
          reindexDatabase: this.translate('admin.operations.reindexTitle', 'Database Reindex Results'),
          backupDatabase: this.translate('admin.operations.backupTitle', 'Database Backup Results'),
          optimizeDatabase: this.translate('admin.operations.optimizeTitle', 'Database Optimization Results')
        };
        
        return operationTitles[this.operation] || this.translate('admin.operations.resultsTitle', 'Operation Results');
      },
      theme() {
        // Get theme from document
        return document.documentElement.getAttribute('data-theme') || 'light';
      }
    },
    methods: {
      // Translation method - copied from AdminDashboard for consistency
      translate(key, fallback = '') {
        if (!this.$i18n) return fallback;
        try {
          // Force the correct locale
          const translation = this.$i18n.t(key, { locale: this.currentLocale });
          if (translation === key) {
            return fallback || key;
          }
          return translation;
        } catch (e) {
          console.error('Translation error:', e);
          return fallback || key;
        }
      },
      
      // Get current language from i18n or localStorage - also copied from AdminDashboard
      getCurrentLanguage() {
        // First try to get from i18n instance
        if (this.$i18n && this.$i18n.locale) {
          return this.$i18n.locale;
        }
        
        // Fallback to localStorage
        try {
          const savedLocale = localStorage.getItem('userLocale');
          if (savedLocale) {
            return savedLocale;
          }
        } catch (e) {
          console.warn('Error accessing localStorage for language:', e);
        }
        
        // Default to English if nothing else works
        return 'en';
      }
    }
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
  }

  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
  }

  .modal-content {
    position: relative;
    width: 90%;
    max-width: 700px;
    max-height: 90vh;
    background-color: var(--bg-dialog, #ffffff);
    border-radius: 8px;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    z-index: 1101;
  }

  .modal-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color, #dcdfe4);
  }

  .modal-title h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary, #333333);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    color: var(--text-tertiary, #767676);
    padding: 0;
    width: 28px;
    height: 28px;
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
    padding: 1.5rem;
    overflow-y: auto;
    flex-grow: 1;
    max-height: calc(90vh - 130px);
  }

  .modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-color, #dcdfe4);
    display: flex;
    justify-content: flex-end;
  }

  /* Result Status Styles */
  .result-status {
    display: flex;
    align-items: center;
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1.5rem;
  }

  .status-success {
    background-color: rgba(16, 185, 129, 0.1);
  }

  .status-error {
    background-color: rgba(239, 68, 68, 0.1);
  }

  .status-icon {
    font-size: 1.5rem;
    margin-right: 1rem;
  }

  .status-success .status-icon {
    color: var(--success, #10b981);
  }

  .status-error .status-icon {
    color: var(--danger, #ef4444);
  }

  .status-message {
    font-size: 1rem;
    font-weight: 500;
  }

  .status-success .status-message {
    color: var(--success, #10b981);
  }

  .status-error .status-message {
    color: var(--danger, #ef4444);
  }

  /* Result Details Styles */
  .result-details {
    margin-bottom: 1.5rem;
  }

  .result-section h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: var(--text-primary, #333333);
  }

  .detail-item {
    display: flex;
    margin-bottom: 0.5rem;
  }

  .detail-label {
    font-weight: 500;
    width: 120px;
    min-width: 120px;
    color: var(--text-secondary, #4d4d4d);
  }

  .detail-value {
    color: var(--text-primary, #333333);
  }

  /* Table Styles */
  .table-container {
    overflow-x: auto;
    max-height: 300px;
    border: 1px solid var(--border-color, #dcdfe4);
    border-radius: 4px;
  }

  .results-table {
    width: 100%;
    border-collapse: collapse;
  }

  .results-table th,
  .results-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color, #dcdfe4);
    text-align: left;
  }

  .results-table th {
    font-weight: 600;
    background-color: var(--bg-section, rgba(0, 0, 0, 0.02));
    color: var(--text-secondary, #4d4d4d);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: capitalize;
  }

  .badge-success {
    background-color: rgba(16, 185, 129, 0.1);
    color: var(--success, #10b981);
  }

  .badge-error {
    background-color: rgba(239, 68, 68, 0.1);
    color: var(--danger, #ef4444);
  }

  /* Error Details */
  .error-details {
    background-color: rgba(239, 68, 68, 0.05);
    border-radius: 6px;
    padding: 1rem;
  }

  .error-message {
    margin: 0;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
    color: var(--danger, #ef4444);
    font-family: monospace;
    white-space: pre-wrap;
    overflow-x: auto;
  }

  /* Button Styles */
  .btn {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-primary {
    background-color: var(--bg-button-primary, #3b82f6);
    color: var(--text-button-primary, #ffffff);
  }

  .btn-primary:hover {
    background-color: var(--primary-dark, #2563eb);
  }

  /* Dark mode adjustments (handled by CSS variables) */
  [data-theme="dark"] .results-table th {
    background-color: rgba(255, 255, 255, 0.05);
  }

  [data-theme="dark"] .error-message {
    background-color: rgba(0, 0, 0, 0.2);
  }

  [data-theme="dark"] .status-success {
    background-color: rgba(16, 185, 129, 0.2);
  }

  [data-theme="dark"] .status-error {
    background-color: rgba(239, 68, 68, 0.2);
  }

  [data-theme="dark"] .badge-success {
    background-color: rgba(16, 185, 129, 0.2);
  }

  [data-theme="dark"] .badge-error {
    background-color: rgba(239, 68, 68, 0.2);
  }
/* In OperationResultsModal.vue */
.modal {
  /* This fixes the overall modal background */
  background-color: rgba(0, 0, 0, 0.5);
}

[data-theme="dark"] .modal-content {
  /* This should match exactly the dark background in AdminDashboard.vue */
  background-color: #1e1e1e; /* or #202020 - match exactly what AdminDashboard uses */
}

/* Also fix the table headers and other elements */
[data-theme="dark"] .results-table th {
  background-color: #292727; /* Slightly lighter than the main background */
}

/* Make sure the status badges maintain proper contrast */
[data-theme="dark"] .status-badge {
  color: white;
}

/* Fix the error details background if needed */
[data-theme="dark"] .error-details {
  background-color: rgba(239, 68, 68, 0.1);
}

/* Title text styling for dark mode */
[data-theme="dark"] .modal-title h2,
[data-theme="dark"] .result-section h3 {
  color: #ffffff !important; /* Force white color for all headings */
}

/* Make sure the h2 (Database Optimization Results) is white */
[data-theme="dark"] h2 {
  color: #ffffff !important;
}

/* Make the subtitle text (Optimization Results) white too */
[data-theme="dark"] .result-details h3,
[data-theme="dark"] .modal-body h3 {
  color: #ffffff !important;
}

</style>