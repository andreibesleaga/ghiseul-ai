<template>
  <div class="weather-panel" :data-theme="$route.meta.theme || 'light'" :key="$i18n.locale">
    <div class="weather-header">
      <h4>{{ weatherTitle }}</h4>
      <div class="weather-location">
        {{ location || weatherLocationLoading }}
        <button @click="refreshWeather" class="refresh-btn" :title="weatherRefresh">
          <i class="fas fa-sync-alt" :class="{ 'rotating': isLoading }"></i>
        </button>
      </div>
    </div>
    
    <div v-if="isLoading" class="weather-loading">
      <i class="fas fa-spinner fa-pulse"></i>
      {{ weatherLoading }}
    </div>
    
    <div v-else-if="errorKey" class="weather-error">
      <i class="fas fa-exclamation-triangle"></i>
      {{ $t(`sidebar.${errorKey}`) }}
    </div>
    
    <div v-else class="weather-content">
      <div class="current-weather">
        <div class="current-icon">
          <i :class="getWeatherIcon(currentWeather.condition)"></i>
        </div>
        <div class="current-details">
          <div class="current-temp">{{ currentWeather.temperature }}°C</div>
          <div class="current-condition">{{ getTranslatedCondition(currentWeather.condition) }}</div>
        </div>
        <div class="current-info">
          <div class="info-item">
            <i class="fas fa-tint"></i> {{ currentWeather.humidity }}%
          </div>
          <div class="info-item">
            <i class="fas fa-wind"></i> {{ currentWeather.windSpeed }} km/h
          </div>
        </div>
      </div>
      
      <div class="forecast-list">
        <div v-for="(day, index) in formattedForecast" :key="index" class="forecast-day">
          <div class="day-name">{{ day.formattedDate }}</div>
          <div class="day-icon">
            <i :class="day.iconClass"></i>
          </div>
          <div class="day-temp">
            <span class="temp-high">{{ day.highTemp }}°</span>
            <span class="temp-low">{{ day.lowTemp }}°</span>
          </div>
          <div class="day-condition">{{ day.translatedCondition }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'; // FIX: Import Vuex getters
import weatherService from '@/services/weatherService'; // Adjust path as needed
// FIX: No longer need authService, will get user from Vuex store
// import authService from '@/services/authService'; 

export default {
  name: 'WeatherPanel',
  
  data() {
    return {
      location: null,
      isLoading: true, // Start in loading state until auth is checked
      errorKey: null,
      currentWeather: {
        temperature: 0,
        condition: '',
        humidity: 0,
        windSpeed: 0
      },
      forecast: []
    };
  },
  
  computed: {
    // FIX: Map isAuthenticated and user getters from Vuex store
    ...mapGetters(['isAuthenticated', 'user']),

    weatherTitle() {
      return this.$t('sidebar.weatherTitle');
    },
    weatherLoading() {
      return this.$t('sidebar.weatherLoading');
    },
    weatherLocationLoading() {
      return this.$t('sidebar.weatherLocationLoading');
    },
    weatherRefresh() {
      return this.$t('sidebar.weatherRefresh');
    },
    formattedForecast() {
      return this.forecast.map(day => ({
        ...day,
        formattedDate: this.formatDay(day.date),
        iconClass: this.getWeatherIcon(day.condition),
        translatedCondition: this.getTranslatedCondition(day.condition)
      }));
    }
  },
  
  watch: {
    '$i18n.locale': {
      handler() {
        // Only refresh if already authenticated
        if (this.isAuthenticated) {
          this.getWeather();
        }
        this.$forceUpdate();
      },
      // Do not use immediate: true here, let the auth watcher handle it
    },

    // FIX: Add a watcher for authentication
    isAuthenticated: {
      handler(isAuthed) {
        if (isAuthed) {
          // User is authenticated, NOW we can get the weather
          this.getWeather();
        } else {
          // User is not authenticated (e.g., logged out)
          this.isLoading = false;
          this.errorKey = 'weatherAuthRequired'; // You may need to add this translation key
          this.location = null;
        }
      },
      immediate: true // Check auth state immediately when component loads
    }
  },
  
  created() {
    // FIX: Removed this.getWeather() from here.
    // The isAuthenticated watcher will now handle the initial call.
  },
  
  methods: {
    async getWeather() {
      // Extra safety check
      if (!this.isAuthenticated) {
        this.isLoading = false;
        this.errorKey = 'weatherAuthRequired';
        return;
      }

      this.isLoading = true;
      this.errorKey = null;
      this.location = null;

      try {
        if (navigator.geolocation) {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
          });
          const { latitude, longitude } = position.coords;
          
          // FIX: Get userId from the Vuex store 'user' object
          const userId = this.user?._key || null;
          const locale = this.$i18n.locale;

          const weatherData = await weatherService.getWeather({ latitude, longitude, userId, locale });
          this.location = weatherData.location;
          this.currentWeather = weatherData.current;
          this.forecast = weatherData.forecast;
        } else {
          this.errorKey = 'weatherGeolocationUnsupported';
        }
      } catch (error) {
        console.warn('Weather fetch error:', error);
        this.errorKey = 'weatherErrorDefault';
      } finally {
        this.isLoading = false;
      }
    },
    
    async refreshWeather() {
      // The watcher will prevent this from running if not authed,
      // but an explicit check is good practice.
      if (this.isAuthenticated) {
        await this.getWeather();
      }
    },
    
    formatDay(date) {
      return new Date(date).toLocaleDateString(this.$i18n.locale, { weekday: 'short' });
    },
    
    getTranslatedCondition(condition) {
      if (!condition) return '';
      const conditionLower = condition.toLowerCase();
      const key = this.getConditionKey(conditionLower);
      const translationKey = `sidebar.weatherConditions.${key}`;
      return this.$te(translationKey) ? this.$t(translationKey) : condition;
    },
    
    getConditionKey(conditionLower) {
      if (conditionLower.includes('thunder')) return 'thunderstorm';
      if (conditionLower.includes('shower')) return 'shower';
      if (conditionLower.includes('rain')) return 'rain';
      if (conditionLower.includes('snow')) return 'snow';
      if (conditionLower.includes('overcast')) return 'overcast';
      if (conditionLower.includes('cloudy')) return 'cloudy';
      if (conditionLower.includes('partly')) return 'partlycloudy';
      return 'clear';
    },
    
    getWeatherIcon(condition) {
      const conditionLower = condition.toLowerCase();
      
      if (conditionLower.includes('thunder')) {
        return 'fas fa-bolt';
      } else if (conditionLower.includes('rain') || conditionLower.includes('shower')) {
        return 'fas fa-cloud-rain';
      } else if (conditionLower.includes('snow')) {
        return 'fas fa-snowflake';
      } else if (conditionLower.includes('cloudy') || conditionLower.includes('overcast')) {
        return 'fas fa-cloud';
      } else if (conditionLower.includes('partly')) {
        return 'fas fa-cloud-sun';
      } else {
        return 'fas fa-sun';
      }
    }
  }
};
</script>

<style scoped>
/* Styles remain unchanged */
.weather-panel {
  margin-top: 15px;
  background-color: var(--bg-card);
  border-radius: 10px;
  color: var(--text-primary);
  padding: 12px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  font-size: 0.9rem;
}

.weather-header h4 {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

[data-theme="dark"] .weather-header h4,
html[data-theme="dark"] .weather-header h4 {
  color: rgba(255, 255, 255, 0.7) !important;
}

.weather-location {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--text-secondary);
}

.refresh-btn {
  background: none;
  border: none;
  color: var(--accent-color);
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s;
  padding: 3px;
}

.refresh-btn:hover {
  opacity: 1;
  color: var(--accent-hover);
}

.rotating {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.weather-loading, .weather-error {
  text-align: center;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}

.current-weather {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-light);
}

.current-icon {
  font-size: 1.8rem;
  margin-right: 8px;
  color: var(--accent-color);
}

.current-details {
  flex-grow: 1;
}

.current-temp {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.current-condition {
  color: var(--text-secondary);
}

.current-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: var(--text-secondary);
}

.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-item i {
  color: var(--accent-color);
}

.forecast-list {
  display: flex;
  justify-content: space-between;
}

.forecast-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  flex: 1;
  padding: 3px;
}

.day-name {
  color: var(--text-secondary);
  margin-bottom: 3px;
}

.day-icon {
  font-size: 1rem;
  margin: 3px 0;
  color: var(--accent-color);
}

.day-temp {
  display: flex;
  gap: 4px;
}

.temp-high {
  font-weight: 600;
  color: var(--text-primary);
}

.temp-low {
  color: var(--text-secondary);
}

.day-condition {
  color: var(--text-secondary);
  font-size: 0.8rem;
  margin-top: 2px;
}
</style>