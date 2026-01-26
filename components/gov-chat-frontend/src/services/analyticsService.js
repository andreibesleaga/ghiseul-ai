// src/services/analyticsService.js
import httpService from './httpService';

/**
 * Service for interacting with the Analytics API
 */
class AnalyticsService {
  /**
   * Base URL for the analytics API endpoints
   */
  constructor() {
    this.baseUrl = process.env.VUE_APP_API_URL || '/api';
    this.$i18n = null; // Will be set after initialization
  }

  /**
   * Set i18n instance for localization
   * @param {Object} i18n - Vue i18n instance
   */
  setI18n(i18n) {
    this.$i18n = i18n;
  }

  /**
   * Get current locale or fallback to default
   * @param {string} overrideLocale - Optional locale to override the service's locale
   * @returns {string} Current locale
   */
  getCurrentLocale(overrideLocale = null) {
    if (overrideLocale) {
      return overrideLocale;
    }
    return this.$i18n ? this.$i18n.locale : 'en';
  }

  /**
   * Get unique users count directly
   * @param {string} startDate - Start date (ISO string)
   * @param {string} endDate - End date (ISO string)
   * @param {string} locale - Locale override (optional)
   * @returns {Promise<number>} Count of unique users
   */
  async getUniqueUsersCount(startDate, endDate, locale = null) {
    try {
      const currentLocale = this.getCurrentLocale(locale);
      console.log(`Directly getting unique users count from ${startDate} to ${endDate} with locale: ${currentLocale}`);

      const response = await httpService.get('analytics/metric/uniqueUsers', {
        params: {
          startDate,
          endDate,
          locale: currentLocale
        }
      });

      console.log("Unique users direct response:", response.data);

      return typeof response.data.value === 'number' ? response.data.value : 0;
    } catch (error) {
      console.error('Error getting unique users count:', error);
      return 0;
    }
  }

  /**
   * Get dashboard analytics data
   * @param {string} period - Time period (daily, weekly, monthly, all-time)
   * @param {string} date - Selected date (YYYY-MM-DD)
   * @param {string} locale - Locale override (optional)
   * @returns {Promise<Object>} Dashboard analytics data
   */
  async getDashboardAnalytics(period, date, locale = null) {
    try {
      // Calculate start and end dates based on period and date
      const { startDate, endDate } = this.calculateDateRange(period, date);

      // Get current locale from parameter, instance, or fallback
      const currentLocale = this.getCurrentLocale(locale);

      console.log(`Fetching dashboard analytics with locale: ${currentLocale}`);

      const response = await httpService.get('analytics/dashboard', {
        params: {
          startDate,
          endDate,
          locale: currentLocale // Pass locale to the API
        }
      });

      return this.transformDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard analytics:', error);
      throw error;
    }
  }

  /**
   * Get comparison data for trends
   * @param {string} metric - Metric name
   * @param {string} currentPeriod - Current period type
   * @param {string} currentDate - Current date
   * @param {string} previousPeriod - Previous period type
   * @param {string} previousDate - Previous date
   * @param {string} locale - Locale override (optional)
   * @returns {Promise<Object>} Comparison data
   */
  async getComparisonData(metric, currentPeriod, currentDate, previousPeriod, previousDate, locale = null) {
    try {
      // Calculate date ranges for current and previous periods
      const current = this.calculateDateRange(currentPeriod, currentDate);
      const previous = this.calculateDateRange(previousPeriod, previousDate);

      // Get current locale
      const currentLocale = this.getCurrentLocale(locale);

      // Map frontend metric names to backend API metric names
      const metricMap = {
        'totalQueries': 'totalQueries',
        'uniqueUsers': 'uniqueUsers',
        'averageResponseTime': 'averageResponseTime',
        'satisfactionRate': 'satisfactionRate'
      };

      const apiMetric = metricMap[metric] || metric;

      // Get current period data
      const currentResponse = await httpService.get(`analytics/metric/${apiMetric}`, {
        params: {
          startDate: current.startDate,
          endDate: current.endDate,
          locale: currentLocale
        }
      });

      // Get previous period data
      const previousResponse = await httpService.get(`analytics/metric/${apiMetric}`, {
        params: {
          startDate: previous.startDate,
          endDate: previous.endDate,
          locale: currentLocale
        }
      });

      console.log(`Response for ${metric}:`, {
        current: currentResponse.data,
        previous: previousResponse.data
      });

      return {
        current: currentResponse.data.value,
        previous: previousResponse.data.value
      };
    } catch (error) {
      console.error(`Error fetching comparison data for ${metric}:`, error);
      return { current: null, previous: null };
    }
  }

  /**
   * Get time series data for charts
   * @param {string} metricType - Type of metric (queries, users, etc.)
   * @param {string} interval - Interval for data points (hourly, daily, monthly)
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {string} locale - Locale override (optional)
   * @returns {Promise<Array>} Time series data
   */
  async getTimeSeriesData(metricType, interval, startDate, endDate, locale = null) {
    try {
      // Get current locale
      const currentLocale = this.getCurrentLocale(locale);

      console.log(`Fetching time series data for ${metricType}, interval ${interval}, locale: ${currentLocale}`);

      const response = await httpService.get(`analytics/timeseries/${metricType}`, {
        params: {
          interval,
          startDate,
          endDate,
          locale: currentLocale
        }
      });

      if (!response.data || !Array.isArray(response.data)) {
        console.warn(`Invalid response format for ${metricType} time series:`, response.data);
        return this.getFallbackTimeSeriesData(interval);
      }

      // Process the data to ensure it's valid
      return response.data.map(item => ({
        timestamp: item.timestamp || '',
        dateLabel: this.formatDateLabel(item.timestamp, interval),
        value: typeof item.value === 'number' ? item.value : 0,
        userCount: typeof item.userCount === 'number' ? item.userCount : 0
      }));
    } catch (error) {
      console.error('Error fetching time series data:', error);
      return this.getFallbackTimeSeriesData(interval);
    }
  }

  /**
   * Get fallback time series data
   * @param {string} interval - Time interval
   * @returns {Array} Sample time series data
   */
  getFallbackTimeSeriesData(interval) {
    const result = [];
    const now = new Date();
    let count = 0;

    // Determine number of data points based on interval
    switch (interval) {
      case 'hourly':
        count = 24;
        break;
      case 'daily':
        count = 30;
        break;
      case 'weekly':
        count = 12;
        break;
      case 'monthly':
        count = 12;
        break;
      default:
        count = 30;
    }

    // Generate sample data
    for (let i = 0; i < count; i++) {
      const date = new Date(now);

      // Adjust date based on interval
      switch (interval) {
        case 'hourly':
          date.setHours(date.getHours() - (count - i - 1));
          break;
        case 'daily':
          date.setDate(date.getDate() - (count - i - 1));
          break;
        case 'weekly':
          date.setDate(date.getDate() - (count - i - 1) * 7);
          break;
        case 'monthly':
          date.setMonth(date.getMonth() - (count - i - 1));
          break;
        default:
          date.setDate(date.getDate() - (count - i - 1));
      }

      // Format date label
      const dateLabel = this.formatDateLabel(date, interval);

      // Generate random value
      const value = Math.floor(Math.random() * 500) + 500;

      // Add data point
      result.push({
        timestamp: date.toISOString(),
        dateLabel,
        value,
        userCount: Math.floor(value * 0.2) // 20% of value
      });
    }

    return result;
  }

  /**
   * Format date label based on interval
   * @param {string|Date} timestamp - Date to format
   * @param {string} interval - Time interval
   * @returns {string} Formatted date label
   */
  formatDateLabel(timestamp, interval) {
    if (!timestamp) return '';

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (isNaN(date.getTime())) return String(timestamp);

    try {
      // Get current locale for formatting
      const locale = this.$i18n ? this.$i18n.locale : 'en';

      switch (interval) {
        case 'hourly':
          return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        case 'daily':
          return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
        case 'weekly':
          return `Week ${Math.ceil((date.getDate() + 6 - date.getDay()) / 7)} ${date.toLocaleDateString(locale, { month: 'short' })}`;
        case 'monthly':
          return date.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
        default:
          return date.toLocaleDateString(locale);
      }
    } catch (error) {
      console.warn('Error formatting date label:', error);
      return String(timestamp);
    }
  }

  /**
   * Transform time series data for charts
   * @param {Array} data - Raw time series data
   * @param {string} interval - Data interval
   * @returns {Array} Transformed time series data
   */
  transformTimeSeriesData(data, interval) {
    // Safety check for input data
    if (!data || !Array.isArray(data)) return [];

    // Filter out invalid entries
    const validData = data.filter(item => item && item.timestamp);

    // Get current locale for formatting
    const locale = this.$i18n ? this.$i18n.locale : 'en';

    return validData.map(item => {
      // Format date label based on interval
      let dateLabel;
      try {
        const date = new Date(item.timestamp);

        if (!isNaN(date.getTime())) {
          switch (interval) {
            case 'hourly':
              dateLabel = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
              break;

            case 'daily':
              dateLabel = date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
              break;

            case 'weekly':
              const weekNum = this.getWeekNumber(date);
              dateLabel = `W${weekNum} ${date.toLocaleDateString(locale, { month: 'short' })}`;
              break;

            case 'monthly':
              dateLabel = date.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
              break;

            default:
              dateLabel = date.toLocaleDateString(locale);
          }
        } else {
          dateLabel = item.timestamp;
        }
      } catch (error) {
        console.warn(`Error formatting date label for ${item.timestamp}:`, error);
        dateLabel = item.timestamp;
      }

      return {
        timestamp: item.timestamp,
        dateLabel,
        value: typeof item.value === 'number' ? item.value : 0
      };
    });
  }

  /**
   * Get week number of the year
   * @param {Date} date - Date object
   * @returns {number} Week number
   */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Calculate start and end date for a given period
   * @param {string} period - Time period (daily, weekly, monthly, all-time)
   * @param {string} date - Selected date (YYYY-MM-DD)
   * @returns {Object} Start and end date
   */
  calculateDateRange(period, date) {
    const endDate = date ? new Date(date) : new Date();
    let startDate = new Date(endDate);

    switch (period) {
      case 'daily':
        // Just this day
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'weekly':
        // Last 7 days
        startDate.setDate(endDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'monthly':
        // Last 30 days
        startDate.setDate(endDate.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'all-time':
        // All data (use a very old start date)
        startDate = new Date('2020-01-01');
        break;
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }

  /**
   * Transform dashboard data for UI display
   * @param {Object} data - Raw API response data
   * @returns {Object} Transformed dashboard data
   */
  transformDashboardData(data) {
    // Default values if data is missing
    const defaultData = {
      totalQueries: 0,
      uniqueUsers: 0,
      averageResponseTime: 0,
      satisfactionRate: 0,
      queryDistribution: [],
      topQueries: []
    };

    if (!data) return defaultData;

    console.log("Dashboard data received:", data);

    // Extract the unique users count
    let uniqueUsers = data.users && typeof data.users.activeCount === 'number' ? data.users.activeCount : 0;
    console.log("Unique users count from API:", uniqueUsers);

    // Transform the data from the API response structure
    return {
      totalQueries: data.queries?.total || 0,
      uniqueUsers,
      averageResponseTime: data.queries?.avgResponseTime || 0,
      satisfactionRate: data.feedback?.positivePercentage || 0,

      // Transform category distribution
      queryDistribution: (data.categories || []).map(cat => ({
        categoryId: cat.categoryId,
        name: cat.name,
        count: cat.count
      })),

      // Top queries from the response
      topQueries: data.topQueries || []
    };
  }

  /**
   * Format a value for display
   * @param {number} value - Value to format
   * @param {string} format - Format type (number, time, percent)
   * @param {string} locale - Locale for formatting
   * @returns {string} Formatted value
   */
  formatValue(value, format = 'number', locale = null) {
    if (value === null || value === undefined) return '—';

    // Get current locale
    const currentLocale = locale || (this.$i18n ? this.$i18n.locale : 'en');

    switch (format) {
      case 'number':
        return value.toLocaleString(currentLocale);

      case 'time':
        // Format as seconds with 1 decimal place
        return `${value.toFixed(1)}s`;

      case 'percent':
        return `${value.toFixed(1)}%`;

      case 'milliseconds':
        // Format as whole milliseconds with 'ms' suffix
        return `${Math.round(value)}ms`;

      default:
        return String(value);
    }
  }

  /**
   * Calculate percentage change between two values
   * @param {number} current - Current value
   * @param {number} previous - Previous value
   * @returns {number} Percentage change
   */
  calculatePercentChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  /**
   * Get CSS class for trend indicator
   * @param {number} change - Percentage change
   * @param {boolean} isInverse - Whether less is better (e.g., response time)
   * @returns {string} CSS class
   */
  getTrendColor(change, isInverse = false) {
    if (!change) return 'neutral';

    const isPositive = change > 0;

    if (isInverse) {
      return isPositive ? 'negative' : 'positive';
    }

    return isPositive ? 'positive' : 'negative';
  }

  /**
   * Get satisfaction heatmap data
   * @param {string} period - Time period (daily, weekly, monthly, all-time)
   * @param {string} date - Selected date (YYYY-MM-DD)
   * @param {string} locale - Locale override (optional)
   * @returns {Promise<Array>} Satisfaction heatmap data
   */
  async getSatisfactionHeatmap(period, date, locale = null) {
    try {
      // Calculate start and end dates based on period and date
      const { startDate, endDate } = this.calculateDateRange(period, date);

      // Get current locale from parameter, instance, or fallback
      const currentLocale = this.getCurrentLocale(locale);

      console.log(`Fetching satisfaction heatmap with locale: ${currentLocale}`);

      // Make API call to get the satisfaction heatmap data
      const response = await httpService.get('analytics/satisfaction/heatmap', {
        params: {
          startDate,
          endDate,
          locale: currentLocale
        }
      });

      if (!response.data || !Array.isArray(response.data)) {
        console.warn('Invalid response format for satisfaction heatmap:', response.data);
        return this.getFallbackSatisfactionHeatmap(currentLocale);
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching satisfaction heatmap data:', error);
      return this.getFallbackSatisfactionHeatmap(this.getCurrentLocale(locale));
    }
  }

  /**
   * Get fallback satisfaction heatmap data
   * @param {string} locale - Locale for translations
   * @returns {Array} Sample satisfaction heatmap data
   */
  getFallbackSatisfactionHeatmap(locale = 'en') {
    // Define knowledge areas based on locale
    const getLocalizedAreas = () => {
      if (locale === 'fr') {
        return [
          'Immigration et Citoyenneté',
          'Entreprise et Commerce',
          'Identité et État Civil',
          'Sécurité Sociale et Retraites',
          'Éducation et Apprentissage',
          'Emploi et Services du Travail',
          'Santé et Services Sociaux'
        ];
      } else if (locale === 'ro') {
        return [
          'Imigrație și Cetățenie',
          'Afaceri și Comerț',
          'Identitate și Înregistrare Civilă',
          'Securitate Socială și Pensii',
          'Educație și Învățare',
          'Angajare și Servicii de Muncă',
          'Sănătate și Servicii Sociale'
        ];
      } else {
        // Default to English
        return [
          'Immigration & Citizenship',
          'Business & Trade',
          'Identity & Civil Registration',
          'Social Security & Pensions',
          'Education & Learning',
          'Employment & Labor Services',
          'Health & Social Services'
        ];
      }
    };

    // Define time periods based on locale
    const getLocalizedPeriods = () => {
      if (locale === 'fr') {
        return [
          'Il y a 4 semaines',
          'Il y a 3 semaines',
          'Il y a 2 semaines',
          'Semaine dernière',
          'Actuel'
        ];
      } else if (locale === 'ro') {
        return [
          'Acum 4 săptămâni',
          'Acum 3 săptămâni',
          'Acum 2 săptămâni',
          'Săptămâna trecută',
          'Curent'
        ];
      } else {
        // Default to English
        return [
          '4 Weeks Ago',
          '3 Weeks Ago',
          '2 Weeks Ago',
          'Last Week',
          'Current'
        ];
      }
    };

    const areas = getLocalizedAreas();
    const periods = getLocalizedPeriods();

    // Generate sample data for each area and time period
    return areas.map(area => {
      const data = {};
      data.name = area;
      data.data = periods.map((period, index) => {
        // Generate random satisfaction scores that trend slightly upward
        let baseScore = 75 + Math.floor(Math.random() * 15);
        // Add a small upward trend (with some randomness)
        baseScore += index * (1 + Math.random());
        // Ensure score doesn't exceed 100
        const score = Math.min(Math.round(baseScore), 100);

        return {
          x: period,
          y: score
        };
      });
      return data;
    });
  }

  /**
   * Get satisfaction gauge data
   * @param {string} period - Time period (daily, weekly, monthly, all-time)
   * @param {string} date - Selected date (YYYY-MM-DD)
   * @param {string} locale - Locale override (optional)
   * @returns {Promise<Object>} Satisfaction gauge data
   */
  async getSatisfactionGauge(period, date, locale = null) {
    try {
      // Calculate start and end dates based on period and date
      const { startDate, endDate } = this.calculateDateRange(period, date);

      // Get current locale from parameter, instance, or fallback
      const currentLocale = this.getCurrentLocale(locale);

      console.log(`Fetching satisfaction gauge with locale: ${currentLocale}`, { startDate, endDate });

      // Make API call to get the satisfaction gauge data
      const response = await httpService.get('analytics/satisfaction/gauge', {
        params: {
          startDate,
          endDate,
          locale: currentLocale
        }
      });

      console.log('[SatisfactionGauge] Raw API response:', response);

      if (!response.data || typeof response.data.currentValue !== 'number') {
        console.warn('Invalid gauge data response:', response.data);
        throw new Error(`Invalid gauge data response: ${JSON.stringify(response.data)}`);
      }

      const gaugeData = {
        currentValue: response.data.currentValue,
        previousValue: response.data.previousValue || 0,
        changePercentage: response.data.changePercentage || 0,
        target: response.data.target || 85,
        historicalData: Array.isArray(response.data.historicalData) ? response.data.historicalData : []
      };

      console.log('[SatisfactionGauge] Processed gauge data:', gaugeData);

      return gaugeData;
    } catch (error) {
      console.error('Error fetching satisfaction gauge data:', error);
      throw error; // No fallback to force real data
    }
  }

  /**
   * Record a query in analytics
   * @param {Object} queryDoc - Query document
   * @returns {Promise<Object>} The created analytics record
   */
  async recordQuery(queryDoc) {
    try {
      const response = await httpService.post(`${this.baseUrl}/analytics/query`, queryDoc);
      return response.data;
    } catch (error) {
      console.error('Error recording query in analytics:', error);
      throw error;
    }
  }

  /**
   * Record feedback in analytics
   * @param {String} queryId - Query ID
   * @param {Object} feedback - Feedback data
   * @returns {Promise<Object>} The created analytics record
   */
  async recordFeedback(queryId, feedback) {
    try {
      const response = await httpService.post(`${this.baseUrl}/analytics/feedback`, {
        queryId,
        feedback
      });
      return response.data;
    } catch (error) {
      console.error('Error recording feedback in analytics:', error);
      throw error;
    }
  }

}

export default new AnalyticsService();