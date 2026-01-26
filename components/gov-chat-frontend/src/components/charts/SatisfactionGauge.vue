<!-- SatisfactionGauge.vue - Changed dark mode gauge center circle background to transparent to blend with UnifiedAnalytics.vue (#414141) -->
<template>
  <div class="gauge-wrapper">
    <!-- Debug panel for troubleshooting -->
    <pre
      v-if="debug"
      style="
        font-size: 10px;
        max-height: 150px;
        overflow: auto;
        background: #333;
        color: #fff;
        padding: 5px;
      "
    >
      Loading: {{ loading }}
      Error: {{ error }}
      Value: {{ actualSatisfactionValue }}
      Chart Options: {{ chartOptions ? "Set" : "Not Set" }}
      externalData: {{ externalData }}
      Last Error: {{ lastError }}
      ChartKey: {{ chartKey }}
      HistoricalData: {{ computedHistoricalData }}
      ChangePercentage: {{ computedChangeIndicator }}
    </pre>

    <!-- Chart container -->
    <div ref="chart" class="chart-container">
      <!-- Debug outline for chart container visibility -->
      <div
        v-if="debug"
        style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border: 2px dashed red;
          z-index: 100;
          pointer-events: none;
        "
      ></div>

      <!-- ApexCharts radial bar for satisfaction gauge -->
      <apexchart
        v-if="!loading && !error && chartOptions"
        :key="chartKey"
        type="radialBar"
        height="290"
        :options="{
          ...chartOptions,
          plotOptions: {
            ...chartOptions.plotOptions,
            radialBar: {
              ...chartOptions.plotOptions.radialBar,
              dataLabels: {
                ...chartOptions.plotOptions.radialBar.dataLabels,
                value: {
                  ...chartOptions.plotOptions.radialBar.dataLabels.value,
                  formatter: function (val) {
                    return val.toFixed(2) + '%';
                  },
                },
              },
            },
          },
        }"
        :series="[actualSatisfactionValue]"
      ></apexchart>
    </div>

    <!-- Historical trends section -->
    <div
      class="historical-trends"
      v-if="!loading && !error && computedHistoricalData.length > 0"
    >
      <h3>
        {{ translate("analytics.gauge.historical", "Historical Trends") }}
      </h3>
      <div
        class="trend-item"
        v-for="(item, index) in computedHistoricalData"
        :key="index"
      >
        <span class="label">{{ item.label }}</span>
        <span class="value">{{ item.value.toFixed(2) }}%</span>
        <div class="progress" :style="{ width: `${item.value}%` }"></div>
      </div>
    </div>

    <!-- Change indicator -->
    <div
      v-if="!loading && !error && computedChangeIndicator !== null"
      class="change-indicator"
      :class="computedChangeIndicator >= 0 ? 'positive' : 'negative'"
    >
      <span class="change-arrow">{{
        computedChangeIndicator >= 0 ? "↑" : "↓"
      }}</span>
      <span>{{ Math.abs(computedChangeIndicator).toFixed(1) }}%</span>
      <span class="change-period">{{
        translate("analytics.gauge.vsPrevious", "vs previous period")
      }}</span>
    </div>

    <!-- Target indicator -->
    <div class="target-indicator" v-if="!loading && !error">
      <span
        >{{ translate("analytics.gauge.target", "Target") }}:
        {{ actualTarget }}%</span
      >
    </div>

    <!-- Loading overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <span>{{ translate("analytics.status.loading", "Loading...") }}</span>
    </div>

    <!-- Error message -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script>
import analyticsService from "../../services/analyticsService";

export default {
  name: "SatisfactionGauge",
  props: {
    // Current satisfaction value provided by parent
    value: {
      type: Number,
      default: null,
    },
    // Target value provided by parent
    target: {
      type: Number,
      default: 85,
    },
    // Historical data provided by parent
    historicalData: {
      type: Array,
      default: () => [],
    },
    // Change percentage for trend indicator
    changePercentage: {
      type: Number,
      default: null,
    },
    // Whether to use provided data or fetch from API
    externalData: {
      type: Boolean,
      default: false,
    },
    // Period and date for API fetching if not using external data
    period: {
      type: String,
      default: "monthly",
    },
    selectedDate: {
      type: String,
      default: () => new Date().toISOString().split("T")[0],
    },
    // Force re-render when language changes
    renderKey: {
      type: String,
      default: null,
    },
  },
  data() {
    return {
      theme: "light", // Store current theme
      satisfactionValue: null, // Internal value when externalData is false
      internalHistoricalData: [], // Internal data when externalData is false
      internalChangeIndicator: null, // Internal change when externalData is false
      loading: false,
      error: null,
      chartOptions: null,
      themeObserver: null,
      internalTarget: 85, // Default target
      debug: false, // Debug mode enabled
      chartKey: 0, // Force re-renders
      lastError: null,
      mountCount: 0,
    };
  },
  computed: {
    // Compute the actual satisfaction value to display
    actualSatisfactionValue() {
      if (this.externalData && this.value !== null) {
        console.log("[SatisfactionGauge] Using external value:", this.value);
        return this.value >= 0 ? this.value : 0;
      }
      const value = this.satisfactionValue;
      console.log("[SatisfactionGauge] Using internal value:", value);
      return value !== null && value >= 0 ? value : 0;
    },
    // Compute the target value
    actualTarget() {
      return this.target || this.internalTarget || 85;
    },
    // Compute historical data for trends
    computedHistoricalData() {
      let data =
        this.externalData && this.historicalData
          ? this.historicalData
          : this.internalHistoricalData;
      data = data.filter(
        (item) => item && typeof item.value === "number" && item.value >= 0
      );
      if (!data.length) {
        // Fallback data if historicalData is empty
        data = [
          {
            label: "Current",
            value: this.actualSatisfactionValue || 0,
            periodStart: new Date().toISOString(),
            periodEnd: new Date().toISOString(),
          },
          {
            label: "Last Week",
            value: 0,
            periodStart: new Date(
              Date.now() - 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            periodEnd: new Date(
              Date.now() - 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          {
            label: "2 Weeks Ago",
            value: 0,
            periodStart: new Date(
              Date.now() - 14 * 24 * 60 * 60 * 1000
            ).toISOString(),
            periodEnd: new Date(
              Date.now() - 14 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          {
            label: "3 Weeks Ago",
            value: 0,
            periodStart: new Date(
              Date.now() - 21 * 24 * 60 * 60 * 1000
            ).toISOString(),
            periodEnd: new Date(
              Date.now() - 21 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          {
            label: "4 Weeks Ago",
            value: 0,
            periodStart: new Date(
              Date.now() - 28 * 24 * 60 * 60 * 1000
            ).toISOString(),
            periodEnd: new Date(
              Date.now() - 28 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
        ];
        console.log(
          "[SatisfactionGauge] Using fallback historical data:",
          JSON.stringify(data)
        );
      }
      console.log(
        "[SatisfactionGauge] Computed historical data:",
        JSON.stringify(data)
      );
      return data;
    },
    // Compute change percentage for indicator
    computedChangeIndicator() {
      const change =
        this.externalData && this.changePercentage !== null
          ? this.changePercentage
          : this.internalChangeIndicator;
      console.log("[SatisfactionGauge] Computed change percentage:", change);
      return change !== null ? change : 0; // Default to 0 if null
    },
  },
  watch: {
    // Watch for changes in value prop
    value: {
      handler(newValue) {
        console.log(`[SatisfactionGauge] value prop changed to ${newValue}`);
        if (this.externalData && newValue !== null) {
          this.satisfactionValue = newValue;
          this.chartOptions = null;
          this.$nextTick(() => {
            this.chartKey++;
            this.initChart();
          });
        }
      },
      immediate: true,
    },
    // Watch for changes in historicalData prop
    historicalData: {
      handler(newData) {
        if (this.externalData && newData) {
          console.log(
            "[SatisfactionGauge] historicalData prop changed:",
            JSON.stringify(newData)
          );
        }
      },
      deep: true,
      immediate: true,
    },
    // Watch for changes in changePercentage prop
    changePercentage: {
      handler(newValue) {
        if (this.externalData && newValue !== null) {
          console.log(
            "[SatisfactionGauge] changePercentage prop changed:",
            newValue
          );
        }
      },
      immediate: true,
    },
    // Watch for changes in period
    period: {
      handler(newValue) {
        console.log(`[SatisfactionGauge] period changed to ${newValue}`);
        if (!this.externalData) {
          this.fetchData();
        }
      },
    },
    // Watch for changes in selectedDate
    selectedDate: {
      handler(newValue) {
        console.log(`[SatisfactionGauge] selectedDate changed to ${newValue}`);
        if (!this.externalData) {
          this.fetchData();
        }
      },
    },
    // Watch for changes in renderKey (locale)
    renderKey: {
      handler(newValue) {
        console.log(`[SatisfactionGauge] renderKey changed to ${newValue}`);
        this.chartOptions = null;
        this.$nextTick(() => {
          this.chartKey++;
          this.initChart();
        });
        if (!this.externalData) {
          this.fetchData();
        }
      },
    },
  },
  mounted() {
    console.log(
      `[SatisfactionGauge] MOUNTED (${++this.mountCount}) externalData=${
        this.externalData
      }`
    );

    this.updateTheme(); // Set initial theme
    if (!this.externalData) {
      console.log("[SatisfactionGauge] Fetching data from API");
      this.fetchData();
    } else {
      console.log("[SatisfactionGauge] Using external data:", {
        value: this.value,
        historicalData: this.historicalData,
        changePercentage: this.changePercentage,
      });
      this.chartOptions = null;
      this.$nextTick(() => {
        this.chartKey++;
        this.initChart();
      });
    }

    this.setupThemeChangeListener();
    window.addEventListener("error", this.handleGlobalError);
  },
  beforeUnmount() {
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
    window.removeEventListener("error", this.handleGlobalError);
    const injectedStyle = document.getElementById(
      "satisfaction-gauge-theme-style"
    );
    if (injectedStyle) {
      document.head.removeChild(injectedStyle);
    }
    console.log("[SatisfactionGauge] UNMOUNTED");
  },
  methods: {
    /**
     * Translate text using i18n
     */
    translate(key, defaultValue) {
      if (this.$i18n && this.$t) {
        const translation = this.$t(key);
        return translation === key ? defaultValue : translation;
      }
      return defaultValue;
    },

    /**
     * Handle global chart errors
     */
    handleGlobalError(event) {
      if (event.message && event.message.includes("chart")) {
        this.lastError = event.message;
        console.warn("[SatisfactionGauge] Chart error caught:", event.message);
        this.chartKey++;
      }
    },

    /**
     * Fetch satisfaction data from API
     */
    async fetchData() {
      if (this.externalData) {
        console.log(
          "[SatisfactionGauge] Skipping fetchData due to externalData=true"
        );
        return;
      }
      console.log("[SatisfactionGauge] Starting fetchData()");
      this.loading = true;
      this.error = null;

      try {
        console.log(
          `[SatisfactionGauge] Calling analyticsService.getSatisfactionGauge(${this.period}, ${this.selectedDate})`
        );
        const data = await analyticsService.getSatisfactionGauge(
          this.period,
          this.selectedDate,
          this.$i18n ? this.$i18n.locale : null
        );

        console.log(
          "[SatisfactionGauge] Satisfaction data received:",
          JSON.stringify(data)
        );

        if (data && typeof data.currentValue === "number") {
          console.log(
            `[SatisfactionGauge] Setting satisfactionValue to ${data.currentValue}`
          );
          this.satisfactionValue = data.currentValue;
          this.internalChangeIndicator = data.changePercentage;
          this.internalHistoricalData = data.historicalData || [];
          this.internalTarget = data.target || 85;
        } else {
          console.warn(
            "[SatisfactionGauge] Invalid data received, setting defaults"
          );
          this.satisfactionValue = 0;
          this.internalHistoricalData = [];
          this.internalChangeIndicator = null;
        }

        this.chartOptions = null;
        this.$nextTick(() => {
          this.chartKey++;
          this.initChart();
        });
      } catch (error) {
        console.error("[SatisfactionGauge] Error fetching data:", error);
        this.error = this.translate(
          "analytics.errors.loading",
          "Failed to load satisfaction data"
        );
        this.satisfactionValue = 0;
        this.internalHistoricalData = [];
        this.internalChangeIndicator = null;

        this.chartOptions = null;
        this.$nextTick(() => {
          this.chartKey++;
          this.initChart();
        });
      } finally {
        this.loading = false;
      }
    },

    /**
     * Set up theme change listener
     */
    setupThemeChangeListener() {
      this.themeObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (
            mutation.attributeName === "class" ||
            mutation.attributeName === "data-theme"
          ) {
            console.log("[SatisfactionGauge] Theme change detected");
            this.updateTheme();
            this.chartOptions = null;
            this.$nextTick(() => {
              this.chartKey++;
              this.initChart();
            });
            break;
          }
        }
      });

      this.themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
    },

    /**
     * Update theme based on parent or global settings
     */
    updateTheme() {
      let themeMode =
        this.$refs.chart?.closest("[data-theme]")?.getAttribute("data-theme") ||
        document.documentElement.getAttribute("data-theme") ||
        localStorage.getItem("theme") ||
        "light";
      if (!["light", "dark", "system"].includes(themeMode)) {
        console.warn(
          `[SatisfactionGauge] Invalid themeMode: ${themeMode}, defaulting to light`
        );
        themeMode = "light";
      }
      if (themeMode === "system") {
        themeMode = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      this.theme = themeMode;
      console.log(`[SatisfactionGauge] Theme detected: ${themeMode}`);
      this.injectGlobalStyleForTheme(); // Apply theme-specific styles
    },

    /**
     * Get gauge color based on value
     */
    getGaugeColor(value) {
      const isDarkMode = this.theme === "dark";

      if (value >= 90) return "#22C55E"; // Green
      if (value >= 80) return "#84CC16"; // Light green
      if (value >= 70) return "#F59E0B"; // Orange
      return "#EF4444"; // Red
    },

    /**
     * Initialize chart with speedometer options
     */
    initChart() {
      console.log(
        `[SatisfactionGauge] initChart called with value: ${this.actualSatisfactionValue}`
      );

      if (this.actualSatisfactionValue < 0) {
        console.warn(
          "[SatisfactionGauge] Cannot initialize chart - invalid value"
        );
        return;
      }

      const isDarkMode = this.theme === "dark";

      const textColor = isDarkMode ? "#FFFFFF" : "#333333";
      const backgroundColor = isDarkMode ? "transparent" : "#FFFFFF"; // Transparent in dark mode to blend with UnifiedAnalytics.vue
      const trackColor = isDarkMode ? "#666666" : "#E5E7EB";

      const getGradientColors = (value) => {
        const colors = {
          poor: "#EF4444",
          low: "#F59E0B",
          medium: "#84CC16",
          high: "#22C55E",
        };

        if (value < 60) return [colors.poor, colors.poor];
        if (value < 70) return [colors.poor, colors.low];
        if (value < 80) return [colors.low, colors.medium];
        if (value < 90) return [colors.medium, colors.high];
        return [colors.high, colors.high];
      };

      const gradientColors = getGradientColors(this.actualSatisfactionValue);

      this.chartOptions = {
        chart: {
          type: "radialBar",
          background: backgroundColor,
          foreColor: textColor,
          animations: {
            enabled: true,
            easing: "easeinout",
            speed: 800,
          },
          fontFamily: "inherit",
        },
        plotOptions: {
          radialBar: {
            startAngle: -135,
            endAngle: 135,
            hollow: {
              margin: 0,
              size: "65%",
              background: backgroundColor,
            },
            track: {
              background: trackColor,
              strokeWidth: "97%",
              margin: 5,
              dropShadow: {
                enabled: false,
              },
            },
            dataLabels: {
              show: true,
              name: {
                show: true,
                fontSize: "16px",
                fontWeight: 600,
                color: textColor,
                offsetY: -10,
              },
              value: {
                show: true,
                fontSize: "24px",
                fontWeight: 700,
                color: textColor,
                offsetY: 5,
                formatter: function (val) {
                  return val.toFixed(2) + "%";
                },
              },
            },
          },
        },
        fill: {
          type: "gradient",
          gradient: {
            shade: "dark",
            type: "horizontal",
            gradientToColors: [gradientColors[1]],
            stops: [0, 100],
            colorStops: [
              {
                offset: 0,
                color: gradientColors[0],
                opacity: 1,
              },
              {
                offset: 100,
                color: gradientColors[1],
                opacity: 1,
              },
            ],
          },
        },
        stroke: {
          lineCap: "round",
          dashArray: 0,
        },
        labels: [
          this.translate("analytics.metrics.satisfaction", "User Satisfaction"),
        ],
        tooltip: {
          enabled: false,
        },
      };

      console.log("[SatisfactionGauge] Chart options initialized");

      this.$nextTick(() => {
        setTimeout(() => {
          this.forceTextColorUpdate();
        }, 300);
      });
    },

    /**
     * Inject global styles for the current theme
     */
    injectGlobalStyleForTheme() {
      const styleId = "satisfaction-gauge-theme-style";
      let styleEl = document.getElementById(styleId);
      if (styleEl) {
        styleEl.remove(); // Remove existing style to prevent duplicates
      }

      styleEl = document.createElement("style");
      styleEl.id = styleId;
      if (this.theme === "dark") {
        styleEl.textContent = `
          [data-theme="dark"] .apexcharts-text,
          [data-theme="dark"] .apexcharts-datalabel-label,
          [data-theme="dark"] .apexcharts-datalabel-value,
          [data-theme="dark"] .apexcharts-radialbar-label text,
          [data-theme="dark"] .apexcharts-radialbar text {
            fill: #FFFFFF !important;
          }
        `;
        console.log("[SatisfactionGauge] Injected dark mode style");
      } else {
        styleEl.textContent = `
          [data-theme="light"] .apexcharts-text,
          [data-theme="light"] .apexcharts-datalabel-label,
          [data-theme="light"] .apexcharts-datalabel-value,
          [data-theme="light"] .apexcharts-radialbar-label text,
          [data-theme="light"] .apexcharts-radialbar text {
            fill: #333333 !important;
          }
        `;
        console.log("[SatisfactionGauge] Injected light mode style");
      }

      document.head.appendChild(styleEl);
    },

    /**
     * Force ApexCharts text color in dark mode
     */
    forceTextColorUpdate() {
      console.log("[SatisfactionGauge] Attempting to force text color update");
      const isDarkMode = this.theme === "dark";

      if (isDarkMode) {
        const chartElement = this.$refs.chart;
        if (!chartElement) {
          console.warn("[SatisfactionGauge] Chart element not found");
          return;
        }

        setTimeout(() => {
          try {
            const textElements = chartElement.querySelectorAll(
              ".apexcharts-text, .apexcharts-datalabel-label, .apexcharts-datalabel-value"
            );
            console.log(
              `[SatisfactionGauge] Found ${textElements.length} text elements to update`
            );

            textElements.forEach((el) => {
              el.setAttribute("fill", "#FFFFFF");
              const tspans = el.querySelectorAll("tspan");
              tspans.forEach((tspan) => {
                tspan.setAttribute("fill", "#FFFFFF");
              });
            });
          } catch (error) {
            console.error(
              "[SatisfactionGauge] Error updating text colors:",
              error
            );
          }
        }, 300);
      }
    },
  },
};
</script>

<style scoped>
.gauge-wrapper {
  position: relative;
  width: 100%;
  background-color: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chart-container {
  position: relative;
  width: 100%;
  height: 290px;
  background-color: transparent;
  border-radius: 8px;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary, rgba(255, 255, 255, 0.8));
  z-index: 1;
}

.spinner {
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 3px solid var(--accent-color, #4e97d1);
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
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
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--status-outage, #d32f2f);
}

/* Historical trends section */
.historical-trends {
  width: 100%;
  margin-top: 20px;
  padding: 0 20px;
}

.historical-trends h3 {
  font-size: 16px;
  margin-bottom: 10px;
  color: var(--text-primary);
}

.trend-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  position: relative;
  min-height: 20px;
}

.label {
  width: 120px;
  font-size: 14px;
  color: var(--text-secondary);
}

.value {
  width: 50px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-right: 10px;
}

.progress {
  height: 8px;
  background: linear-gradient(to right, #f59e0b, #84cc16, #22c55e);
  border-radius: 4px;
  max-width: calc(100% - 180px);
}

/* Change indicator */
.change-indicator {
  margin-top: 15px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.change-indicator.positive {
  color: var(--status-success, #22c55e);
}

.change-indicator.negative {
  color: var(--status-outage, #d32f2f);
}

.change-arrow {
  font-size: 16px;
  font-weight: bold;
}

.change-period {
  color: var(--text-secondary);
  font-size: 12px;
  margin-left: 5px;
}

/* Target indicator */
.target-indicator {
  margin-top: 10px;
  font-size: 14px;
  color: var(--text-secondary);
}

/* Position the custom gauge scale */
:deep(.custom-gauge-scale) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 20;
}

/* Dark mode text fixes */
:deep([data-theme="dark"]) .apexcharts-text,
:deep([data-theme="dark"]) .apexcharts-datalabel-label,
:deep([data-theme="dark"]) .apexcharts-datalabel-value {
  fill: white !important;
}

:deep([data-theme="dark"]) text tspan {
  fill: white !important;
}

/* Dark mode track color */
:deep([data-theme="dark"])
  .apexcharts-radialbar
  .apexcharts-radialbar-track
  .apexcharts-radialbar-area {
  stroke: #666666 !important;
}

[data-theme="dark"] .historical-trends h3,
[data-theme="dark"] .label,
[data-theme="dark"] .value {
  color: white !important;
  -webkit-text-fill-color: white !important;
  text-shadow: 0 0 1px rgba(255, 255, 255, 0.5) !important;
}
</style>