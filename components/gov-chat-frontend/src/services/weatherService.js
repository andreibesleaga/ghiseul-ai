import httpService from './httpService';

export default {
  /**
   * Fetch weather data for a location
   * @param {Object} locationData - Location data { latitude, longitude, userId }
   * @returns {Promise<Object>} Weather data
   */
  async getWeather(locationData) {
    try {
      const response = await httpService.post('weather', {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        userId: locationData.userId
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching weather:', error);
      throw error;
    }
  }
};