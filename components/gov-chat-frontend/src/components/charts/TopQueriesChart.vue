<!-- TopQueriesChart.vue - Changed dark mode table background to transparent to blend with analytics dialog (#414141) -->
<template>
  <div class="top-queries-chart">
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <span>{{ $t("analytics.status.loading") }}</span>
    </div>
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    <div v-else-if="!data || data.length === 0" class="no-data">
      {{ $t("analytics.status.noData") }}
    </div>
    <div v-else>
      <!-- Compressed table view -->
      <div class="table-container">
        <table class="top-queries-table" :style="tableStyle">
          <thead>
            <tr>
              <th class="rank" :style="textStyle">
                {{ $t("analytics.table.rank") }}
              </th>
              <th :style="textStyle">{{ $t("analytics.table.query") }}</th>
              <th class="count" :style="textStyle">
                {{ $t("analytics.table.count") }}
              </th>
              <th class="avg-time" :style="textStyle">
                {{ $t("analytics.table.avgTime") }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(query, index) in data" :key="index">
              <td class="rank" :style="textStyle">{{ index + 1 }}</td>
              <td class="query-text" :style="textStyle">{{ query.text }}</td>
              <td class="count" :style="textStyle">
                {{ query.count.toLocaleString() }}
              </td>
              <td class="avg-time" :style="textStyle">{{ query.avgTime }}s</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Single bar chart using ApexCharts -->
      <div ref="chart" class="bar-chart-container">
        <apexchart
          v-if="!loading && !error && chartOptions"
          type="bar"
          height="140"
          :options="chartOptions"
          :series="chartSeries"
        ></apexchart>
      </div>
    </div>
  </div>
</template>

<script>
import analyticsService from "../../services/analyticsService";

export default {
  name: "TopQueriesChart",
  props: {
    // Data can be provided by parent component
    data: {
      type: Array,
      default: () => [],
    },
    // Whether data is provided externally
    externalData: {
      type: Boolean,
      default: true,
    },
    // Period and date for API fetching if not using external data
    period: {
      type: String,
      default: "daily",
    },
    selectedDate: {
      type: String,
      default: () => new Date().toISOString().split("T")[0],
    },
    // Added to force re-render when language or theme changes
    renderKey: {
      type: String,
      default: null,
    },
  },
  data() {
    return {
      theme: "light", // Store current theme
      chartData: [],
      loading: false,
      error: null,
      chartOptions: null,
      chartSeries: [],
      isMobile: false,
      tooltipId: "top-queries-chart-tooltip", // Store tooltip ID for reference
      themeObserver: null,
    };
  },
  computed: {
    tableStyle() {
      // Apply inline style to force correct background color
      // Dark mode uses transparent to blend with UnifiedAnalytics.vue .analytics-content (#414141)
      return this.theme === "light"
        ? { backgroundColor: "#ffffff !important" }
        : { backgroundColor: "transparent !important" };
    },
    textStyle() {
      // Apply inline style to force correct text color
      return this.theme === "light"
        ? { color: "#333333 !important" }
        : { color: "#ffffff !important" };
    },
  },
  watch: {
    // Watch for data changes from parent
    data: {
      handler(newData) {
        if (this.externalData && newData && newData.length > 0) {
          this.chartData = newData;
          this.updateChart();
        }
      },
      deep: true,
    },
    // Re-fetch if period or date changes
    period: {
      handler() {
        if (!this.externalData) {
          this.fetchData();
        }
      },
    },
    selectedDate: {
      handler() {
        if (!this.externalData) {
          this.fetchData();
        }
      },
    },
    // Watch for renderKey (theme/locale) changes to force complete re-render
    renderKey: {
      handler() {
        this.$nextTick(() => {
          if (this.chartData && this.chartData.length > 0) {
            this.updateChart();
          }
        });
      },
    },
    // Watch for locale changes directly
    "$i18n.locale": {
      handler() {
        this.$nextTick(() => {
          if (this.chartData && this.chartData.length > 0) {
            this.updateChart();
          }
        });
      },
      immediate: false,
    },
  },
  mounted() {
    // Check if mobile on mount
    this.checkMobile();

    // Initialize theme based on localStorage
    this.initializeTheme();

    // Force theme sync with localStorage
    this.forceThemeSync();

    // Use data from props or fetch from API
    if (this.externalData && this.data.length > 0) {
      this.chartData = this.data;
      this.updateChart();
    } else if (!this.externalData) {
      this.fetchData();
    }

    // Add resize listener
    window.addEventListener("resize", this.handleResize);

    // Create custom tooltip element
    this.ensureCustomTooltipExists();

    // Set up theme change listener
    this.setupThemeChangeListener();

    // Force re-render after parent theme sync
    setTimeout(() => {
      this.injectGlobalStyleForTheme();
      this.updateChart();
    }, 300); // Increased delay for parent theme sync
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.handleResize);

    // Clean up tooltip
    this.cleanupTooltip();

    // Clean up theme observer
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }

    // Remove the injected style if it exists
    const injectedStyle = document.getElementById(
      "top-queries-chart-theme-style"
    );
    if (injectedStyle) {
      document.head.removeChild(injectedStyle);
    }
  },
  methods: {
    /**
     * Initialize theme based on localStorage to ensure correct initial rendering
     */
    initializeTheme() {
      let themeMode = localStorage.getItem("theme") || "light";
      if (!["light", "dark", "system"].includes(themeMode)) {
        console.warn(
          `[TopQueriesChart] Invalid themeMode: ${themeMode}, defaulting to light`
        );
        themeMode = "light";
      }
      if (themeMode === "system") {
        themeMode = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      this.theme = themeMode;
      console.log(`[TopQueriesChart] Initial theme set to: ${themeMode}`);
      this.injectGlobalStyleForTheme();
    },

    /**
     * Force sync of DOM data-theme with localStorage to prevent mismatches
     */
    forceThemeSync() {
      const localStorageTheme = localStorage.getItem("theme") || "light";
      const parentElement = this.$el.closest("[data-theme]");
      if (
        parentElement &&
        parentElement.getAttribute("data-theme") !== localStorageTheme
      ) {
        console.warn(
          `[TopQueriesChart] Forcing DOM data-theme to match localStorage: ${localStorageTheme}`
        );
        parentElement.setAttribute("data-theme", localStorageTheme);
      }
      document.documentElement.setAttribute("data-theme", localStorageTheme);
    },

    /**
     * Inject a global stylesheet that targets ApexCharts data labels and chart elements
     */
    injectGlobalStyleForTheme() {
      let styleEl = document.getElementById("top-queries-chart-theme-style");
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "top-queries-chart-theme-style";
        document.head.appendChild(styleEl);
      }

      const theme = this.getTheme();
      console.log(
        `[TopQueriesChart] Injected ${
          theme.isDarkMode ? "dark" : "light"
        } mode style`
      );

      if (theme.isDarkMode) {
        styleEl.textContent = `
          /* Force ApexCharts data labels to be white in dark mode */
          [data-theme="dark"] .top-queries-chart .apexcharts-datalabels text,
          [data-theme="dark"] .top-queries-chart .apexcharts-datalabel-value,
          [data-theme="dark"] .top-queries-chart .apexcharts-datalabel,
          [data-theme="dark"] .top-queries-chart .apexcharts-datalabel-label {
            fill: #FFFFFF !important;
          }
          /* Target bar chart data labels */
          [data-theme="dark"] .top-queries-chart .apexcharts-bar-series .apexcharts-datalabels text {
            fill: #FFFFFF !important;
          }
          /* Override table background - transparent to blend with UnifiedAnalytics.vue #414141 */
          [data-theme="dark"] .top-queries-chart .top-queries-table,
          [data-theme="dark"] .top-queries-chart .top-queries-table th,
          [data-theme="dark"] .top-queries-chart .top-queries-table td {
            background-color: transparent !important;
            color: #FFFFFF !important;
          }
          /* Override chart container */
          [data-theme="dark"] .top-queries-chart .bar-chart-container {
            background-color: #414141 !important;
          }
          /* Override ApexCharts x-axis */
          [data-theme="dark"] .top-queries-chart .apexcharts-xaxis,
          [data-theme="dark"] .top-queries-chart .apexcharts-xaxis-texts-g {
            background-color: #414141 !important;
            fill: #FFFFFF !important;
          }
        `;
      } else {
        styleEl.textContent = `
          /* Force ApexCharts data labels to be black in light mode */
          [data-theme="light"] .top-queries-chart .apexcharts-datalabels text,
          [data-theme="light"] .top-queries-chart .apexcharts-datalabel-value,
          [data-theme="light"] .top-queries-chart .apexcharts-datalabel,
          [data-theme="light"] .top-queries-chart .apexcharts-datalabel-label {
            fill: #333333 !important;
          }
          /* Target bar chart data labels */
          [data-theme="light"] .top-queries-chart .apexcharts-bar-series .apexcharts-datalabels text {
            fill: #333333 !important;
          }
          /* Override table background */
          [data-theme="light"] .top-queries-chart .top-queries-table,
          [data-theme="light"] .top-queries-chart .top-queries-table td {
            background-color: #ffffff !important;
            color: #333333 !important;
          }
          [data-theme="light"] .top-queries-chart .top-queries-table th {
            background-color: #f5f7fa !important;
            color: #333333 !important;
          }
          /* Override chart container */
          [data-theme="light"] .top-queries-chart .bar-chart-container {
            background-color: transparent !important;
          }
          /* Override ApexCharts x-axis */
          [data-theme="light"] .top-queries-chart .apexcharts-xaxis,
          [data-theme="light"] .top-queries-chart .apexcharts-xaxis-texts-g {
            background-color: #ffffff !important;
            fill: #333333 !important;
          }
        `;
      }
    },

    /**
     * Check if the device is mobile based on screen width
     */
    checkMobile() {
      this.isMobile = window.innerWidth < 768;
      console.log(
        `[DEBUG] Device detected as ${this.isMobile ? "mobile" : "desktop"}`
      );
    },

    /**
     * Get current theme information
     */
    getTheme() {
      let themeMode = this.theme;
      const localStorageTheme = localStorage.getItem("theme") || "light";
      if (themeMode !== localStorageTheme) {
        console.warn(
          `[TopQueriesChart] Theme mismatch: component=${themeMode}, localStorage=${localStorageTheme}`
        );
        themeMode = localStorageTheme;
        this.theme = themeMode;
      }
      if (!["light", "dark", "system"].includes(themeMode)) {
        console.warn(
          `[TopQueriesChart] Invalid themeMode: ${themeMode}, defaulting to light`
        );
        themeMode = "light";
      }
      if (themeMode === "system") {
        themeMode = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      this.theme = themeMode;
      return {
        isDarkMode: themeMode === "dark",
        accentColor: "#4E97D1",
        backgroundColor: themeMode === "dark" ? "#414141" : "#FFFFFF",
        textColor: themeMode === "dark" ? "#FFFFFF" : "#333333",
      };
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
            console.log("[TopQueriesChart] Theme change detected");
            this.forceThemeSync();
            this.injectGlobalStyleForTheme();
            this.updateChart();
            break;
          }
        }
      });

      this.themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
      console.log("[DEBUG] Theme change listener set up");
    },

    /**
     * Fetch top queries data if not provided externally
     */
    async fetchData() {
      if (this.externalData) return;

      this.loading = true;
      this.error = null;

      try {
        try {
          const dashboardData = await analyticsService.getDashboardAnalytics(
            this.period,
            this.selectedDate
          );
          if (dashboardData && dashboardData.topQueries) {
            this.chartData = dashboardData.topQueries;
          } else {
            throw new Error(this.$t("analytics.status.noData"));
          }
        } catch (apiError) {
          console.error("Error calling API:", apiError);
          console.log("Falling back to sample query data...");
          this.chartData = this.getFallbackData();
        }

        this.updateChart();
      } catch (error) {
        console.error("Error fetching top queries data:", error);
        this.error = this.$t("analytics.status.error");
      } finally {
        this.loading = false;
      }
    },

    /**
     * Get fallback data for top queries
     * @returns {Array} Sample top queries data
     */
    getFallbackData() {
      return [
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
      ];
    },

    /**
     * Handle window resize
     */
    handleResize() {
      this.checkMobile();
      this.updateChart();
    },

    /**
     * Truncate text to fit in available space
     */
    truncateText(text, maxLength) {
      if (!text) return "";
      return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
    },

    /**
     * Create a custom tooltip element with a unique ID
     */
    ensureCustomTooltipExists() {
      this.cleanupTooltip();
      const tooltip = document.createElement("div");
      tooltip.id = this.tooltipId;
      tooltip.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.65);
        color: white;
        padding: 10px;
        border-radius: 4px;
        font-size: 12px;
        pointer-events: none;
        z-index: 10000;
        display: none;
        min-width: 160px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
      `;
      document.body.appendChild(tooltip);
    },

    /**
     * Clean up the tooltip element
     */
    cleanupTooltip() {
      const tooltip = document.getElementById(this.tooltipId);
      if (tooltip) {
        tooltip.remove();
      }
    },

    /**
     * Add tooltip event handlers to chart bars
     */
    addTooltipHandlers() {
      const tooltip = document.getElementById(this.tooltipId);
      if (!tooltip) {
        this.ensureCustomTooltipExists();
        return;
      }

      const chartContainer = this.$refs.chart;
      if (!chartContainer) return;

      const barSelectors = [
        ".apexcharts-bar-area",
        ".apexcharts-bar-series rect",
        ".apexcharts-bar rect",
        ".apexcharts-series rect",
      ];

      let bars = [];
      for (const selector of barSelectors) {
        bars = chartContainer.querySelectorAll(selector);
        if (bars.length > 0) {
          console.log(
            `[DEBUG] Found ${bars.length} bars using selector: ${selector}`
          );
          break;
        }
      }

      if (bars.length === 0) {
        for (const selector of barSelectors) {
          bars = document.querySelectorAll(selector);
          if (bars.length > 0) {
            console.log(
              `[DEBUG] Found ${bars.length} bars in document using selector: ${selector}`
            );
            break;
          }
        }
      }

      if (bars.length > 0) {
        bars.forEach((bar, index) => {
          if (index >= this.chartData.length) return;

          bar.style.cursor = "pointer";
          bar.setAttribute("data-bar-index", index);

          bar.addEventListener("mouseenter", (e) => {
            const barIndex = parseInt(e.target.getAttribute("data-bar-index"));
            const item =
              this.chartData[barIndex !== undefined ? barIndex : index];
            if (!item) return;

            tooltip.innerHTML = `
              <div style="font-weight: bold; margin-bottom: 6px;">${this.truncateText(
                item.text,
                40
              )}</div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>${this.$t("analytics.table.count")}:</span>
                <span style="font-weight: 500;">${item.count.toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>${this.$t("analytics.table.avgTime")}:</span>
                <span style="font-weight: 500;">${item.avgTime}s</span>
              </div>
            `;
            tooltip.style.display = "block";
          });

          bar.addEventListener("mousemove", (e) => {
            const offset = 15;
            tooltip.style.left = e.pageX + offset + "px";
            tooltip.style.top = e.pageY + offset + "px";
          });

          bar.addEventListener("mouseleave", () => {
            tooltip.style.display = "none";
          });
        });

        console.log("[DEBUG] Successfully added tooltip handlers to bars");
      } else {
        console.log(
          "[DEBUG] No bars found to attach tooltips, trying again later"
        );
        setTimeout(() => {
          this.addTooltipHandlers();
        }, 1000);
      }
    },

    /**
     * Update the chart with current data and properly themed labels
     */
    updateChart() {
      if (!this.chartData || this.chartData.length === 0) {
        this.error = this.$t("analytics.status.noData");
        return;
      }

      // FINAL FIX: Stop ApexCharts from exploding when container collapses (mobile resize)
      const chartContainer = this.$refs.chart;
      if (chartContainer) {
        const width = Math.max(0, chartContainer.offsetWidth);
        if (width < 50) {
          return; // Silently skip — no negative width, no errors
        }
      }

      const theme = this.getTheme();
      const textColor = theme.isDarkMode ? "#FFFFFF" : "#333333";

      const topQueries = this.chartData.slice(0, 5);

      this.chartSeries = [
        {
          name: this.$t("analytics.table.count"),
          data: topQueries.map((query) => query.count),
        },
      ];

      this.chartOptions = {
        chart: {
          type: "bar",
          height: 140,
          fontFamily: "inherit",
          toolbar: { show: false },
          background: "transparent",
          foreColor: textColor,
          events: {
            mounted: () => {
              setTimeout(() => {
                this.addTooltipHandlers();
                this.fixLabelColors(textColor);
              }, 100);
            },
            updated: () => {
              setTimeout(() => {
                this.addTooltipHandlers();
                this.fixLabelColors(textColor);
              }, 100);
            },
          },
        },
        plotOptions: {
          bar: {
            horizontal: false, // ← VERTICAL BARS (this was the fuckup)
            borderRadius: 2,
            columnWidth: "45%",
            dataLabels: { position: "top" },
          },
        },
        colors: [theme.accentColor || "#4E97D1"],
        dataLabels: {
          enabled: true,
          formatter: (val) => val.toLocaleString(),
          offsetY: -20,
          style: {
            fontSize: "10px",
            colors: [textColor],
            fontWeight: "600",
          },
        },
        grid: {
          show: false,
        },
        xaxis: {
          categories: topQueries.map((q, i) => `#${i + 1}`),
          labels: {
            style: { colors: textColor, fontSize: "11px" },
          },
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        yaxis: {
          labels: { show: false },
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        tooltip: { enabled: false },
        states: {
          hover: { filter: { type: "none" } },
          active: {
            allowMultipleDataPointsSelection: false,
            filter: { type: "none" },
          },
        },
        theme: {
          mode: theme.isDarkMode ? "dark" : "light",
        },
      };
    },

    /**
     * Fix label colors after chart render to ensure they match the theme
     */
    fixLabelColors(textColor) {
      const chartContainer = this.$refs.chart;
      if (!chartContainer) return;

      const textElements = chartContainer.querySelectorAll("text");
      textElements.forEach((element) => {
        element.setAttribute("fill", textColor);
      });

      const dataLabels = chartContainer.querySelectorAll(
        ".apexcharts-datalabels text"
      );
      dataLabels.forEach((label) => {
        label.setAttribute("fill", textColor);
        const children = label.querySelectorAll("*");
        children.forEach((child) => {
          if (child.tagName === "tspan") {
            child.setAttribute("fill", textColor);
          }
        });
      });

      const topDataLabels = chartContainer.querySelectorAll(
        ".apexcharts-bar-top-datalabels text, .apexcharts-datalabel-value"
      );
      topDataLabels.forEach((label) => {
        label.setAttribute("fill", textColor);
      });

      if (textColor === "#FFFFFF") {
        const allDataLabelElements = chartContainer.querySelectorAll(
          ".apexcharts-datalabels text, .apexcharts-datalabel, .apexcharts-datalabel-label, .apexcharts-datalabel-value"
        );
        allDataLabelElements.forEach((el) => {
          el.setAttribute("fill", "#FFFFFF");
        });
      }
    },
  },
};
</script>

<style scoped>
.top-queries-chart {
  position: relative;
  width: 100%;
  min-height: 180px;
  background-color: var(--bg-card, #fff);
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
  opacity: 0.8;
  z-index: 1;
}

.spinner {
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 3px solid var(--accent-color, #4e97d1);
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
  margin-bottom: 8px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.error-message,
.no-data {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--text-primary, #333);
  font-size: 12px;
}

.error-message {
  color: var(--status-outage, #d32f2f);
}

.table-container {
  max-height: 140px;
  overflow-y: auto;
  margin-bottom: 8px;
  background-color: var(--bg-card, #fff);
}

.top-queries-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  background-color: var(--bg-card, #fff);
}

.top-queries-table th {
  background-color: var(--bg-tertiary, #f5f7fa);
  padding: 5px 6px;
  text-align: left;
  font-weight: 600;
  color: var(--text-primary, #333);
  position: sticky;
  top: 0;
  z-index: 1;
  font-size: 10px;
}

.top-queries-table td {
  padding: 4px 6px;
  border-top: 1px solid var(--border-light, #eee);
  color: var(--text-primary, #333);
  background-color: var(--bg-card, #fff);
}

.top-queries-table .rank {
  text-align: center;
  width: 30px;
}

.top-queries-table .count,
.top-queries-table .avg-time {
  text-align: right;
  width: 70px;
}

.top-queries-table .query-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
  color: var(--text-primary, #333);
}

.bar-chart-container {
  width: 100%;
  height: 140px;
  margin-top: 10px;
  background-color: transparent;
}

/* Force data labels to be white in dark mode */
:deep([data-theme="dark"]) .apexcharts-datalabels text,
:deep([data-theme="dark"]) .apexcharts-datalabel-value,
:deep([data-theme="dark"]) .apexcharts-datalabel-label {
  fill: white !important;
}

/* Target specifically the data labels above the bars */
:deep([data-theme="dark"]) .apexcharts-bar-series .apexcharts-datalabels text {
  fill: white !important;
}

/* Force all text in charts to follow theme colors */
:deep([data-theme="dark"]) .apexcharts-text {
  fill: white !important;
}

:deep([data-theme="light"]) .apexcharts-text {
  fill: #333333 !important;
}

/* Target x-axis and y-axis labels */
:deep([data-theme="dark"]) .apexcharts-xaxis .apexcharts-xaxis-texts-g text,
:deep([data-theme="dark"]) .apexcharts-yaxis .apexcharts-yaxis-texts-g text {
  fill: white !important;
  color: white !important;
}

:deep([data-theme="light"]) .apexcharts-xaxis .apexcharts-xaxis-texts-g text,
:deep([data-theme="light"]) .apexcharts-yaxis .apexcharts-yaxis-texts-g text {
  fill: #333333 !important;
  color: #333333 !important;
}

/* Target data value labels on top of bars */
:deep([data-theme="dark"]) .apexcharts-datalabels text {
  fill: white !important;
  color: white !important;
}

:deep([data-theme="light"]) .apexcharts-datalabels text {
  fill: #333333 !important;
  color: #333333 !important;
}

/* Dark mode overrides */
[data-theme="dark"] .top-queries-chart {
  background-color: #414141 !important;
}

[data-theme="dark"] .top-queries-table th {
  background-color: #414141 !important;
  color: white !important;
}

[data-theme="dark"] .bar-chart-container {
  background-color: #414141 !important;
}

[data-theme="dark"] .top-queries-table td {
  border-top: 1px solid #555 !important;
  color: white !important;
  background-color: #414141 !important;
}

[data-theme="dark"] .table-container {
  background-color: #414141 !important;
}

[data-theme="dark"] .top-queries-table .query-text {
  color: white !important;
}

[data-theme="dark"] .top-queries-table {
  background-color: #414141 !important;
}

/* Light mode overrides */
[data-theme="light"] .top-queries-chart {
  background-color: #ffffff !important;
}

[data-theme="light"] .top-queries-table {
  background-color: #ffffff !important;
}

[data-theme="light"] .top-queries-table th {
  background-color: #f5f7fa !important;
  color: #333333 !important;
}

[data-theme="light"] .top-queries-table td {
  background-color: #ffffff !important;
  color: #333333 !important;
}

[data-theme="light"] .table-container {
  background-color: #ffffff !important;
}

[data-theme="light"] .top-queries-table .query-text {
  color: #333333 !important;
}

[data-theme="light"] .bar-chart-container {
  background-color: transparent !important;
}
</style>