<template>
  <div
    class="analytics-dashboard"
    :key="'dashboard-' + currentLocale"
    :data-theme="theme"
  >
    <div class="dashboard-header">
      <h2>{{ $t("analytics.title") }}</h2>

      <!-- Period selector -->
      <div class="period-selector" style="color: #000; font-weight: 600">
        <label style="color: #000; font-weight: 600"
          >{{ $t("analytics.period") }}:</label
        >
        <select v-model="selectedPeriod" @change="loadAnalytics">
          <option value="daily">{{ $t("analytics.periods.daily") }}</option>
          <option value="weekly">{{ $t("analytics.periods.weekly") }}</option>
          <option value="monthly">{{ $t("analytics.periods.monthly") }}</option>
          <option value="all-time">
            {{ $t("analytics.periods.allTime") }}
          </option>
        </select>

        <!-- Date picker (hidden for all-time) -->
        <div v-if="selectedPeriod !== 'all-time'" class="date-picker">
          <input
            type="date"
            v-model="selectedDate"
            @change="loadAnalytics"
            :max="todayStr"
            :placeholder="$t('analytics.tooltips.selectDate')"
          />
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="loading-container">
      <div class="spinner"></div>
      <p>{{ $t("analytics.status.loading") }}</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <button @click="loadAnalytics" class="retry-button">
        {{ $t("analytics.retry") }}
      </button>
    </div>

    <!-- Dashboard content -->
    <div v-else class="dashboard-content">
      <!-- Key metrics summary -->
      <div class="metrics-summary">
        <div class="metric-card">
          <h3 style="color: #000; font-weight: 600">
            {{ $t("analytics.metrics.totalQueries") }}
          </h3>
          <div class="metric-value" style="color: #000; font-weight: 700">
            {{ formatValue(analytics.totalQueries) }}
          </div>
          <div
            v-if="comparison.totalQueries"
            class="trend"
            :class="getTrendClass(comparison.totalQueries)"
          >
            {{ formatTrend(comparison.totalQueries) }}
          </div>
        </div>

        <div class="metric-card">
          <h3>{{ $t("analytics.metrics.uniqueUsers") }}</h3>
          <div class="metric-value">
            {{ formatValue(analytics.uniqueUsers) }}
          </div>
          <div
            v-if="comparison.uniqueUsers"
            class="trend"
            :class="getTrendClass(comparison.uniqueUsers)"
          >
            {{ formatTrend(comparison.uniqueUsers) }}
          </div>
        </div>

        <div class="metric-card">
          <h3>{{ $t("analytics.metrics.avgResponseTime") }}</h3>
          <div class="metric-value">
            {{ formatValue(analytics.averageResponseTime, "time") }}
          </div>
          <div
            v-if="comparison.averageResponseTime"
            class="trend"
            :class="getTrendClass(comparison.averageResponseTime, true)"
          >
            {{ formatTrend(comparison.averageResponseTime, true) }}
          </div>
        </div>

        <div class="metric-card">
          <h3>{{ $t("analytics.metrics.satisfaction") }}</h3>
          <div class="metric-value">
            {{ formatValue(analytics.satisfactionRate, "percent") }}
          </div>
          <div
            v-if="comparison.satisfactionRate"
            class="trend"
            :class="getTrendClass(comparison.satisfactionRate)"
          >
            {{ formatTrend(comparison.satisfactionRate) }}
          </div>
        </div>
      </div>

      <!-- Category distribution chart -->
      <div
        class="chart-container half-width"
        :key="'cat-container-' + currentLocale"
      >
        <h3>{{ $t("charts.categoryDistribution") }}</h3>
        <CategoryDistributionChart
          v-if="
            analytics.queryDistribution &&
            analytics.queryDistribution.length > 0
          "
          :data="analytics.queryDistribution"
          :externalData="true"
          :renderKey="currentLocale"
        />
        <div v-else class="no-data">
          {{ $t("analytics.status.noData") }}
        </div>
      </div>

      <!-- Top queries -->
      <div
        class="chart-container half-width"
        :key="'top-queries-container-' + currentLocale"
      >
        <h3>{{ $t("charts.topQueries") }}</h3>
        <TopQueriesChart
          v-if="analytics.topQueries && analytics.topQueries.length > 0"
          :data="analytics.topQueries"
          :renderKey="currentLocale"
        />
        <div v-else class="no-data">
          {{ $t("analytics.status.noData") }}
        </div>
      </div>

      <!-- Usage trend chart -->
      <div
        class="chart-container full-width"
        :key="'usage-trend-container-' + currentLocale"
      >
        <h3>{{ $t("charts.usageTrend") }}</h3>
        <UsageTrendChart
          v-if="timeSeriesData && timeSeriesData.length > 0"
          :data="timeSeriesData"
          :externalData="true"
          :renderKey="currentLocale"
        />
        <div v-else class="no-data">
          {{ $t("analytics.status.noData") }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import analyticsService from "../services/analyticsService";
import CategoryDistributionChart from "./charts/CategoryDistributionChart.vue";
import TopQueriesChart from "./charts/TopQueriesChart.vue";
import UsageTrendChart from "./charts/UsageTrendChart.vue";
import { getThemeInfo } from "../utils/ThemeManager";

export default {
  name: "AnalyticsDashboard",
  components: {
    CategoryDistributionChart,
    TopQueriesChart,
    UsageTrendChart,
  },
  data() {
    return {
      isLoading: false,
      error: null,
      selectedPeriod: "daily",
      selectedDate: new Date().toISOString().split("T")[0], // Today's date in YYYY-MM-DD format
      analytics: {
        totalQueries: 0,
        uniqueUsers: 0,
        averageResponseTime: 0,
        satisfactionRate: 0,
        queryDistribution: [],
        topQueries: [],
      },
      comparison: {
        totalQueries: null,
        uniqueUsers: null,
        averageResponseTime: null,
        satisfactionRate: null,
      },
      timeSeriesData: [],
      theme: null,
    };
  },
  computed: {
    /**
     * Current locale - used to trigger reactivity on language change
     */
    currentLocale() {
      return this.$i18n.locale;
    },
    /**
     * Today's date in YYYY-MM-DD format
     */
    todayStr() {
      return new Date().toISOString().split("T")[0];
    },
  },
  created() {
    console.log("Analytics dashboard created with locale:", this.$i18n.locale);
    this.loadAnalytics();
    // Initialize theme
    this.theme =
      localStorage.getItem("theme") ||
      document.documentElement.getAttribute("data-theme") ||
      "light";
  },
  mounted() {
    // Ensure theme is applied on mount
    this.applyTheme();
    // Add text fixing function
    const fixDashboardText = () => {
      // Target Time Period label
      const periodLabels = document.querySelectorAll(
        ".period-selector label, .period-selector > *:first-child"
      );
      periodLabels.forEach((el) => {
        el.style.setProperty("color", "#000", "important");
        el.style.setProperty("font-weight", "600", "important");
        el.style.setProperty("text-shadow", "0 0 0 #000", "important");
      });

      // Target metric values
      const metricValues = document.querySelectorAll(
        ".metric-value, .metric-card .metric-value"
      );
      metricValues.forEach((el) => {
        el.style.setProperty("color", "#000", "important");
        el.style.setProperty("font-weight", "700", "important");
        el.style.setProperty("text-shadow", "0 0 0 #000", "important");
      });

      // Target metric headings
      const metricHeadings = document.querySelectorAll(
        ".metric-card h3, .chart-container h3"
      );
      metricHeadings.forEach((el) => {
        el.style.setProperty("color", "#000", "important");
        el.style.setProperty("font-weight", "600", "important");
      });

      // Special case for the dashboard header
      const dashboardHeader = document.querySelector(".dashboard-header h2");
      if (dashboardHeader) {
        dashboardHeader.style.setProperty("color", "#000", "important");
        dashboardHeader.style.setProperty("font-weight", "600", "important");
      }

      // Target trend text
      const trendText = document.querySelectorAll(".trend");
      trendText.forEach((el) => {
        if (el.classList.contains("neutral")) {
          el.style.setProperty("color", "#000", "important");
        }
        el.style.setProperty("font-weight", "500", "important");
      });

      // Target SVG text elements in charts
      const svgTexts = document.querySelectorAll("svg text");
      svgTexts.forEach((el) => {
        el.setAttribute("fill", "#000");
        el.style.setProperty("font-weight", "600", "important");
      });

      // Target no-data messages
      const noDataMessages = document.querySelectorAll(".no-data");
      noDataMessages.forEach((el) => {
        el.style.setProperty("color", "#000", "important");
        el.style.setProperty("font-weight", "500", "important");
      });
    };

    // Run immediately
    fixDashboardText();

    // Also run whenever analytics data changes
    this.$watch("analytics", fixDashboardText, { deep: true, immediate: true });

    // Run after a slight delay to ensure all components are rendered
    setTimeout(fixDashboardText, 500);

    // Run periodically to catch any dynamically created elements
    const intervalId = setInterval(fixDashboardText, 1000);

    // Clean up interval when component is destroyed
    this.$once("hook:beforeDestroy", () => {
      clearInterval(intervalId);
    });
  },
  watch: {
    // Watch for language changes - force complete refresh
    "$i18n.locale": {
      handler() {
        console.log(
          "Language changed, reloading dashboard:",
          this.$i18n.locale
        );
        // Force full reload of data when language changes
        this.loadAnalytics();
      },
      immediate: true,
    },
  },
  methods: {
    applyTheme() {
      // Get current theme from ThemeManager
      // Use saved theme preference or data-theme attribute
      let themeMode =
        localStorage.getItem("theme") ||
        document.documentElement.getAttribute("data-theme") ||
        "light";
      // Validate themeMode
      if (!["light", "dark", "system"].includes(themeMode)) {
        console.warn(
          `[AnalyticsDashboard] Invalid themeMode: ${themeMode}, defaulting to light`
        );
        themeMode = "light";
      }
      this.theme = themeMode;
      // Set data-theme attribute on root element
      this.$el.setAttribute("data-theme", themeMode);
      console.log(`[AnalyticsDashboard] Applied theme: ${themeMode}`);
      // Force re-render of charts
      this.$nextTick(() => {
        this.loadAnalytics();
      });
    },
    /**
     * Load analytics data based on selected period and date
     */
    // AnalyticsDashboard.vue
    async loadAnalytics() {
      this.isLoading = true;
      this.error = null;

      try {
        const { startDate, endDate } = this.calculateTimeSeriesParams();
        const analyticsData = await analyticsService.getDashboardAnalytics(
          this.selectedPeriod,
          this.selectedDate
        );

        const uniqueUsers = await analyticsService.getUniqueUsersCount(
          startDate,
          endDate
        );

        this.analytics = {
          ...analyticsData,
          uniqueUsers,
        };

        console.log("Dashboard data loaded:", this.analytics);

        await this.loadComparisonData();
        await this.loadTimeSeriesData();
      } catch (error) {
        console.error("Error loading analytics data:", error);
        console.log("Falling back to sample dashboard data...");
        this.analytics = this.getFallbackDashboardData();
        this.timeSeriesData = this.getFallbackTimeSeriesData();
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Load comparison data for trend indicators
     */
    async loadComparisonData() {
      try {
        // Calculate the previous period based on current selection
        const { previousPeriod, previousDate } = this.calculatePreviousPeriod();

        // Get comparison data for all key metrics
        const metrics = [
          "totalQueries",
          "uniqueUsers",
          "averageResponseTime",
          "satisfactionRate",
        ];

        // Process each metric one by one
        for (const metric of metrics) {
          const comparisonData = await analyticsService.getComparisonData(
            metric,
            this.selectedPeriod,
            this.selectedDate,
            previousPeriod,
            previousDate
          );

          // Calculate percentage change
          if (
            comparisonData.previous !== null &&
            comparisonData.previous !== undefined
          ) {
            this.comparison[metric] = analyticsService.calculatePercentChange(
              comparisonData.current,
              comparisonData.previous
            );
          } else {
            this.comparison[metric] = null;
          }
        }
      } catch (error) {
        console.error("Error loading comparison data:", error);
        // Non-critical error, continue without comparison data
        this.comparison = {
          totalQueries: null,
          uniqueUsers: null,
          averageResponseTime: null,
          satisfactionRate: null,
        };
      }
    },

    /**
     * Load time series data for charts
     */
    async loadTimeSeriesData() {
      try {
        this.timeSeriesData = []; // Clear existing data

        // Get time series parameters
        const params = this.calculateTimeSeriesParams();

        // Make API request
        const url = `/api/analytics/timeseries/queries`;

        console.log(
          `Fetching time series data from ${url} with params:`,
          params
        );

        const response = await fetch(
          `${url}?interval=${params.interval}&startDate=${params.startDate}&endDate=${params.endDate}`
        );

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          console.log("Time series data loaded successfully:", data);

          // Process the data to ensure it has the expected format
          this.timeSeriesData = data.map((item) => ({
            timestamp: item.timestamp || "",
            dateLabel: this.formatDateLabel(item.timestamp, params.interval),
            value: typeof item.value === "number" ? item.value : 0,
            userCount: typeof item.userCount === "number" ? item.userCount : 0,
          }));
        } else {
          console.warn("Empty or invalid time series data received:", data);
          this.timeSeriesData = this.generateSampleData();
        }
      } catch (error) {
        console.error("Error loading time series data:", error);
        this.timeSeriesData = this.generateSampleData();
      }
    },

    /**
     * Format date for display
     */
    formatDate(dateString) {
      if (!dateString) return "";

      try {
        const date = new Date(dateString);
        return date.toLocaleDateString(this.$i18n.locale);
      } catch (e) {
        return dateString;
      }
    },

    /**
     * Generate sample data for fallback
     */
    generateSampleData() {
      const result = [];
      const today = new Date();

      for (let i = 30; i > 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        result.push({
          timestamp: date.toISOString(),
          dateLabel: date.toLocaleDateString(this.$i18n.locale),
          value: Math.floor(Math.random() * 1000),
          userCount: Math.floor(Math.random() * 200),
        });
      }

      console.log("Generated sample data for chart:", result);
      return result;
    },

    /**
     * Format date label based on interval
     * @param {string} timestamp - ISO date string
     * @param {string} interval - Time interval
     * @returns {string} Formatted date label
     */
    formatDateLabel(timestamp, interval) {
      if (!timestamp) return "";

      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return timestamp;

      const options = { locale: this.$i18n.locale };

      switch (interval) {
        case "hourly":
          return date.toLocaleTimeString(this.$i18n.locale, {
            hour: "2-digit",
            minute: "2-digit",
          });
        case "daily":
          return date.toLocaleDateString(this.$i18n.locale, {
            month: "short",
            day: "numeric",
          });
        case "weekly":
          return `W${this.getWeekNumber(date)} ${date.toLocaleDateString(
            this.$i18n.locale,
            { month: "short" }
          )}`;
        case "monthly":
          return date.toLocaleDateString(this.$i18n.locale, {
            month: "short",
            year: "numeric",
          });
        default:
          return date.toLocaleDateString(this.$i18n.locale);
      }
    },

    /**
     * Get week number of the year
     * @param {Date} date - Date object
     * @returns {number} Week number
     */
    getWeekNumber(date) {
      const d = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
      );
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    },

    /**
     * Format numeric values for display
     */
    formatValue(value, format = "number") {
      if (value === null || value === undefined) return "-";

      // Use current locale for number formatting
      switch (format) {
        case "number":
          return value.toLocaleString(this.$i18n.locale);
        case "time":
          return `${value.toLocaleString(this.$i18n.locale)}s`;
        case "percent":
          return `${value.toLocaleString(this.$i18n.locale)}%`;
        default:
          return value.toString();
      }
    },

    /**
     * Format trend percentage for display
     */
    formatTrend(percentChange, isInverse = false) {
      const prefix = percentChange > 0 ? "+" : "";
      const suffix = isInverse
        ? percentChange > 0
          ? " " + this.$t("analytics.slower")
          : " " + this.$t("analytics.faster")
        : "";

      return `${prefix}${percentChange.toFixed(1)}%${suffix}`;
    },

    /**
     * Get CSS class for trend indicator
     */
    getTrendClass(change, isInverse = false) {
      return analyticsService.getTrendColor(change, isInverse);
    },

    /**
     * Calculate previous period based on current selection
     */
    calculatePreviousPeriod() {
      const currentDate = new Date(this.selectedDate);
      let previousDate, previousPeriod;

      switch (this.selectedPeriod) {
        case "daily":
          // Previous day
          previousDate = new Date(currentDate);
          previousDate.setDate(currentDate.getDate() - 1);
          previousPeriod = "daily";
          break;

        case "weekly":
          // Previous week
          previousDate = new Date(currentDate);
          previousDate.setDate(currentDate.getDate() - 7);
          previousPeriod = "weekly";
          break;

        case "monthly":
          // Previous month
          previousDate = new Date(currentDate);
          previousDate.setMonth(currentDate.getMonth() - 1);
          previousPeriod = "monthly";
          break;

        case "all-time":
          // Compare with previous equivalent time period
          // For all-time, we'll compare with half the total time
          previousPeriod = "all-time";
          previousDate = null; // Not needed for all-time
          break;
      }

      return {
        previousPeriod,
        previousDate: previousDate
          ? previousDate.toISOString().split("T")[0]
          : null,
      };
    },

    /**
     * Get fallback dashboard data
     * @returns {Object} Sample dashboard data
     */
    getFallbackDashboardData() {
      return {
        totalQueries: 12452,
        uniqueUsers: 3847,
        averageResponseTime: 2.3,
        satisfactionRate: 87.5,
        queryDistribution: [
          {
            categoryId: "cat1",
            name: this.$t("leftPanel.cat1.name"),
            count: 2347,
          },
          {
            categoryId: "cat2",
            name: this.$t("leftPanel.cat2.name"),
            count: 1782,
          },
          {
            categoryId: "cat3",
            name: this.$t("leftPanel.cat3.name"),
            count: 1645,
          },
          {
            categoryId: "cat4",
            name: this.$t("leftPanel.cat4.name"),
            count: 1245,
          },
          {
            categoryId: "cat5",
            name: this.$t("leftPanel.cat5.name"),
            count: 980,
          },
          {
            categoryId: "cat6",
            name: this.$t("leftPanel.cat6.name"),
            count: 850,
          },
          {
            categoryId: "cat7",
            name: this.$t("leftPanel.cat7.name"),
            count: 720,
          },
          {
            categoryId: "cat8",
            name: this.$t("leftPanel.cat8.name"),
            count: 650,
          },
        ],
        topQueries: [
          {
            text: "How do I apply for a business license?",
            count: 2347,
            avgTime: 2.3,
          },
          { text: "Where can I find tax forms?", count: 1982, avgTime: 1.8 },
          {
            text: "How to renew my driver's license?",
            count: 1645,
            avgTime: 2.1,
          },
          {
            text: "What documents do I need for passport application?",
            count: 1423,
            avgTime: 3.4,
          },
          { text: "When are property taxes due?", count: 1289, avgTime: 1.5 },
        ],
      };
    },

    /**
     * Get fallback time series data
     * @returns {Array} Sample time series data
     */
    getFallbackTimeSeriesData() {
      const now = new Date();
      const result = [];
      let interval, startDate;

      switch (this.selectedPeriod) {
        case "daily":
          // Hourly data for today
          for (let hour = 0; hour < 24; hour++) {
            const time = new Date(now);
            time.setHours(hour, 0, 0, 0);

            // More activity during business hours
            const baseValue = hour >= 9 && hour <= 17 ? 50 : 20;
            const value = Math.round(baseValue * (0.8 + Math.random() * 0.4));
            const userCount = Math.round(value / 3);

            result.push({
              timestamp: time.toISOString(),
              dateLabel: time.toLocaleTimeString(this.$i18n.locale, {
                hour: "2-digit",
                minute: "2-digit",
              }),
              value: value,
              userCount: userCount,
            });
          }
          break;

        case "weekly":
          // Daily data for the week
          for (let day = 6; day >= 0; day--) {
            const date = new Date(now);
            date.setDate(date.getDate() - day);
            date.setHours(0, 0, 0, 0);

            // Less activity on weekends
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const baseValue = isWeekend ? 200 : 350;
            const value = Math.round(baseValue * (0.8 + Math.random() * 0.4));
            const userCount = Math.round(value / 4);

            result.push({
              timestamp: date.toISOString(),
              dateLabel: date.toLocaleDateString(this.$i18n.locale, {
                month: "short",
                day: "numeric",
              }),
              value: value,
              userCount: userCount,
            });
          }
          break;

        case "monthly":
          // Daily data for the month (last 30 days)
          for (let day = 29; day >= 0; day--) {
            const date = new Date(now);
            date.setDate(date.getDate() - day);
            date.setHours(0, 0, 0, 0);

            // Random fluctuation with weekend pattern
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const baseValue = isWeekend ? 200 : 350;
            const value = Math.round(baseValue * (0.8 + Math.random() * 0.4));
            const userCount = Math.round(value / 4);

            result.push({
              timestamp: date.toISOString(),
              dateLabel: date.toLocaleDateString(this.$i18n.locale, {
                month: "short",
                day: "numeric",
              }),
              value: value,
              userCount: userCount,
            });
          }
          break;

        case "all-time":
          // Monthly data for all time (last 12 months)
          for (let month = 11; month >= 0; month--) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - month);
            date.setDate(1);
            date.setHours(0, 0, 0, 0);

            // Increasing trend over time with seasonal variation
            const seasonalFactor = 1 + Math.sin((month / 6) * Math.PI) * 0.2;
            const growthFactor = 1 + (11 - month) * 0.05;
            const value = Math.round(300 * seasonalFactor * growthFactor);
            const userCount = Math.round(value / 4);

            result.push({
              timestamp: date.toISOString(),
              dateLabel: date.toLocaleDateString(this.$i18n.locale, {
                month: "short",
                year: "numeric",
              }),
              value: value,
              userCount: userCount,
            });
          }
          break;
      }

      return result;
    },

    /**
     * Calculate time series parameters based on current selection
     */
    calculateTimeSeriesParams() {
      let interval, startDate, endDate;

      // End date is always selected date or today
      endDate = this.selectedDate || new Date().toISOString().split("T")[0];

      switch (this.selectedPeriod) {
        case "daily":
          // For daily view, show hourly data for the selected day
          interval = "hourly";
          startDate = endDate;
          break;

        case "weekly":
          // For weekly view, show daily data for the week
          interval = "daily";
          startDate = new Date(
            new Date(endDate).setDate(new Date(endDate).getDate() - 6)
          )
            .toISOString()
            .split("T")[0];
          break;

        case "monthly":
          // For monthly view, show daily data for the month
          interval = "daily";
          startDate = new Date(
            new Date(endDate).setDate(new Date(endDate).getDate() - 29)
          )
            .toISOString()
            .split("T")[0];
          break;

        case "all-time":
          // For all-time view, show monthly data
          interval = "monthly";
          startDate = "2020-01-01"; // Arbitrary start date in the past
          break;
      }

      return { interval, startDate, endDate };
    },
  },
};
</script>

<style scoped>
.analytics-dashboard {
  padding: 20px;
  color: #000; /* Base text color for the entire component */
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.dashboard-header h2 {
  color: #000;
  font-weight: 600;
}

.period-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #000; /* Ensure Time Period label is black */
  font-weight: 500;
}

.period-selector label {
  color: #000; /* Explicitly set label color */
  font-weight: 500;
}

.period-selector select,
.period-selector input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  color: #000; /* Ensure dropdown text is black */
  font-weight: 500;
}

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
  border-top: 4px solid #4e97d1;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error-message {
  color: #d32f2f;
  margin-bottom: 20px;
  font-weight: 500;
}

.retry-button {
  padding: 8px 16px;
  background-color: #4e97d1;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.retry-button:hover {
  background-color: #3a7da0;
}

.dashboard-content {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.metrics-summary {
  display: flex;
  justify-content: space-between;
  width: 100%;
  gap: 15px;
  margin-bottom: 20px;
}

.metric-card {
  flex: 1;
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.metric-card h3 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 14px;
  color: #000;
  font-weight: 600;
}

.metric-value {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 5px;
  color: #000 !important; /* Important to force black color */
}

.trend {
  font-size: 12px;
  font-weight: 500;
}

.trend.positive {
  color: #4caf50;
}

.trend.negative {
  color: #f44336;
}

.trend.neutral {
  color: #000; /* Changed from #757575 to black */
}

.chart-container {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.chart-container h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  color: #000;
  font-weight: 600;
}

.half-width {
  width: calc(50% - 10px);
}

.full-width {
  width: 100%;
}

.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #000;
  font-style: italic;
  font-weight: 500;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .metrics-summary {
    flex-wrap: wrap;
  }

  .metric-card {
    min-width: calc(50% - 10px);
  }

  .half-width {
    width: 100%;
  }
}

/* Direct targeting of Time Period text */
.period-selector {
  color: #000 !important;
  font-weight: 600 !important;
}

/* Target all labels in the period selector */
.period-selector label {
  color: #000 !important;
  font-weight: 600 !important;
}

/* Target the metric values specifically */
.metric-value {
  color: #000 !important;
  font-weight: 700 !important; /* Make it extra bold */
}

/* Target the metric card headings */
.metric-card h3 {
  color: #000 !important;
  font-weight: 600 !important;
}

/* If you're using a global app-level style, you might add this */
:global(.dashboard-text) {
  color: #000 !important;
  font-weight: 600 !important;
}

/* Add more specific overrides as needed */
.dashboard-header h2,
.chart-container h3,
.period-selector,
.period-selector label,
.metric-value,
.metric-card h3 {
  color: #000 !important;
  font-weight: 600 !important;
}
</style>

<style>
/* Global dashboard text fix - applied only to dashboard elements */
.analytics-dashboard h2,
.analytics-dashboard h3,
.analytics-dashboard .dashboard-header h2,
.analytics-dashboard .period-selector,
.analytics-dashboard .period-selector label,
.period-selector label {
  color: #000 !important;
  font-weight: 600 !important;
}

.metric-value,
.analytics-dashboard .metric-value,
.metrics-summary .metric-value,
.metric-card .metric-value {
  color: #000 !important;
  font-weight: 700 !important;
}

.chart-container h3,
.analytics-dashboard .chart-container h3 {
  color: #000 !important;
  font-weight: 600 !important;
}
</style>
