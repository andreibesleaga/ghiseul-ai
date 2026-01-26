const axios = require('axios');
const { Database, aql } = require('arangojs');
const { logger, dbService } = require('../shared-lib');

class WeatherService {
  constructor() {
    this.dbService = dbService;
    this.db = null;
    this.weatherRequests = null;
    this.analyticsService = null;
    this.initialized = false;
    this.serverLocation = null; // Set in init
    logger.info('WeatherService constructor called');
  }

  /**
   * Initialize the WeatherService
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      logger.debug('WeatherService already initialized, skipping');
      return;
    }
    try {
      // Fetch server location from ipapi.co
      logger.debug('WeatherService.fetching_server_location');
      const geoResponse = await axios.get('https://ipapi.co/json/');
      logger.debug('WeatherService.server_location_response', {
        status: geoResponse.status,
        data: geoResponse.data
      });
      this.serverLocation = {
        latitude: geoResponse.data.latitude || 0,
        longitude: geoResponse.data.longitude || 0,
        city: geoResponse.data.city ? `${geoResponse.data.city}, ${geoResponse.data.country_name}` : 'Unknown'
      };
      if (this.serverLocation.latitude === 0 && this.serverLocation.longitude === 0) {
        logger.warn('Server location fetch failed; using default coordinates (0, 0)');
      }
      logger.info('WeatherService.server_location_set', { serverLocation: this.serverLocation });

      this.db = await this.dbService.getConnection('default');
      this.weatherRequests = this.db.collection('weatherRequests');
      this.initialized = true;
      logger.info('WeatherService initialized successfully');
    } catch (error) {
      logger.error(`Error initializing WeatherService: ${error.message}`, {
        stack: error.stack,
        statusCode: error.response?.status,
        responseData: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Set the analytics service
   * @param {Object} analyticsService - Analytics service instance
   */
  setAnalyticsService(analyticsService) {
    this.analyticsService = analyticsService;
    logger.info('WeatherService.analytics_service_set');
  }

  /**
   * Get city name from coordinates using nominatim.openstreetmap.org
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {Promise<string>} City name
   */
  async getCityName(latitude, longitude) {
    try {
      logger.debug('WeatherService.fetching_city_name', { latitude, longitude });
      const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: {
          format: 'json',
          lat: latitude,
          lon: longitude,
          zoom: 10 // City-level detail
        },
        headers: {
          'User-Agent': 'GovernmentServicesAPI/1.0 (contact: fordenk@gmail.com)'
        }
      });
      logger.debug('WeatherService.city_name_response', {
        status: response.status,
        data: response.data
      });
      const address = response.data.address;
      const city = address.city || address.town || address.village || address.county || 'Unknown';
      return `${city}, ${address.country || 'Unknown'}`;
    } catch (error) {
      logger.error('WeatherService.get_city_name_failed', {
        error: error.message,
        stack: error.stack,
        statusCode: error.response?.status,
        responseData: error.response?.data
      });
      return 'Unknown';
    }
  }

  /**
   * Fetch weather data for a location
   * @param {Object} locationData - Location data { latitude, longitude, userId }
   * @returns {Promise<Object>} Weather data
   */
  async getWeather(locationData) {
    const startTime = Date.now();
    try {
      logger.info('WeatherService.get_weather_start', { locationData });

      // Validate and format coordinates
      let latitude = parseFloat(locationData.latitude) || this.serverLocation.latitude;
      let longitude = parseFloat(locationData.longitude) || this.serverLocation.longitude;
      const userId = locationData.userId;

      // Round to 4 decimal places to avoid Open-Meteo precision issues
      latitude = Math.round(latitude * 10000) / 10000;
      longitude = Math.round(longitude * 10000) / 10000;

      // Validate coordinates
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        logger.warn('WeatherService.invalid_coordinates', { latitude, longitude });
        latitude = this.serverLocation.latitude;
        longitude = this.serverLocation.longitude;
      }

      // Get city name for the coordinates
      const city = latitude !== this.serverLocation.latitude || longitude !== this.serverLocation.longitude
        ? await this.getCityName(latitude, longitude)
        : this.serverLocation.city;

      logger.debug('WeatherService.location_selected', { latitude, longitude, city });

      // Open-Meteo API request
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=4`;
      logger.debug('WeatherService.api_request', { weatherUrl });

      // Fetch weather data
      logger.debug('WeatherService.fetching_weather');
      const response = await axios.get(weatherUrl);
      logger.debug('WeatherService.weather_response', {
        status: response.status,
        data: response.data
      });

      // Parse weather data
      const weatherCodeToCondition = (code) => {
        if ([61, 63, 65, 66, 67].includes(code)) return 'Rain';
        if ([71, 73, 75, 77].includes(code)) return 'Snow';
        if ([51, 53, 55].includes(code)) return 'Drizzle';
        if ([95, 96, 99].includes(code)) return 'Thunderstorm';
        if ([3].includes(code)) return 'Cloudy';
        if ([2].includes(code)) return 'Partly Cloudy';
        if ([0, 1].includes(code)) return 'Clear';
        return 'Unknown';
      };

      const weatherData = {
        location: city,
        current: {
          temperature: Math.round(response.data.current.temperature_2m),
          condition: weatherCodeToCondition(response.data.current.weather_code),
          humidity: response.data.current.relative_humidity_2m,
          windSpeed: Math.round(response.data.current.wind_speed_10m)
        },
        forecast: response.data.daily.time.slice(1, 4).map((date, index) => ({
          date: new Date(date).toISOString(),
          condition: weatherCodeToCondition(response.data.daily.weather_code[index + 1]),
          highTemp: Math.round(response.data.daily.temperature_2m_max[index + 1]),
          lowTemp: Math.round(response.data.daily.temperature_2m_min[index + 1])
        }))
      };

      // Store request in ArangoDB
      const requestDoc = {
        userId: userId || null,
        latitude,
        longitude,
        city,
        timestamp: new Date().toISOString()
      };
      logger.debug('WeatherService.saving_request', { requestDoc });
      const request = await this.weatherRequests.save(requestDoc);
      const requestId = request._key;

      // Record in analytics
      if (this.analyticsService) {
        try {
          logger.debug('WeatherService.recording_analytics', { requestId });
          await this.analyticsService.recordWeatherRequest({
            _key: requestId,
            userId: userId || null,
            city,
            timestamp: requestDoc.timestamp
          });
          logger.info('WeatherService.analytics_recorded', { requestId });
        } catch (error) {
          logger.error('WeatherService.record_analytics_failed', { requestId, error: error.message });
        }
      }

      logger.info('WeatherService.weather_fetched', {
        requestId,
        city,
        durationMs: Date.now() - startTime
      });
      return weatherData;
    } catch (error) {
      logger.error('WeatherService.get_weather_failed', {
        error: error.message,
        stack: error.stack,
        statusCode: error.response?.status,
        responseData: error.response?.data,
        durationMs: Date.now() - startTime
      });
      throw error;
    }
  }
}

// Singleton instance
const instance = new WeatherService();
module.exports = instance;