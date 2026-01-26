  <template>
  <div class="usage-trend-chart">
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <span>{{ $t("analytics.status.loading") }}</span>
    </div>
    <div v-else-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
    </div>
    <div v-else-if="!data || data.length === 0" class="no-data">
      {{ $t("analytics.status.noData") }}
    </div>
    <div v-else ref="chartContainer" class="chart-container"></div>
  </div>
</template>
  
  <script>
import * as d3 from "d3";
import analyticsService from "../../services/analyticsService";

export default {
  name: "UsageTrendChart",
  props: {
    data: {
      type: Array,
      default: () => [],
    },
    externalData: {
      type: Boolean,
      default: true,
    },
    period: {
      type: String,
      default: "daily",
    },
    selectedDate: {
      type: String,
      default: () => new Date().toISOString().split("T")[0],
    },
    // Added to force re-render when language changes
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
      width: 0,
      height: 0,
      themeObserver: null,
      debouncedResize: null, // Placeholder for the debounced function
    };
  },
  watch: {
    data: {
      handler(newData) {
        if (this.externalData && newData && newData.length > 0) {
          this.chartData = newData;
          this.renderChart();
        }
      },
      deep: true,
    },
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
    // Watch for renderKey (locale) changes to force complete re-render
    renderKey: {
      handler() {
        // Clear existing tooltips to prevent duplicates
        d3.selectAll(".d3-tooltip").remove();

        // Re-render chart with new translations
        this.$nextTick(() => {
          if (this.chartData && this.chartData.length > 0) {
            // Force complete recreation
            if (this.$refs.chartContainer) {
              d3.select(this.$refs.chartContainer).selectAll("*").remove();
              this.renderChart();
            }
          }
        });
      },
    },
  },
  mounted() {
    this.initChartDimensions();

    // Inject global stylesheet for theme
    this.injectGlobalStyleForTheme();

    if (this.externalData && this.data.length > 0) {
      this.chartData = this.data;
      this.renderChart();
    } else if (!this.externalData) {
      this.fetchData();
    }

    // NEW: Initialize and use debounced resize handler
    this.debouncedResize = this.debounce(this.processResize, 200);
    window.addEventListener("resize", this.debouncedResize);

    // Set up theme change listener
    this.setupThemeChangeListener();
  },
  beforeUnmount() {
    // NEW: Remove the debounced listener
    if (this.debouncedResize) {
      window.removeEventListener("resize", this.debouncedResize);
    }

    d3.selectAll(".d3-tooltip").remove();

    // Clean up theme observer
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }

    // Remove the injected style if it exists
    const injectedStyle = document.getElementById(
      "usage-trend-chart-theme-style"
    );
    if (injectedStyle) {
      document.head.removeChild(injectedStyle);
    }
  },
  methods: {
    /**
     * Simple debounce utility
     */
    debounce(func, delay) {
      let timeout;
      return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
      };
    },

    /**
     * Inject a global stylesheet for chart text based on theme
     * Targets axis, title, and legend text
     */
    injectGlobalStyleForTheme() {
      // Check if the style already exists
      if (document.getElementById("usage-trend-chart-theme-style")) {
        return;
      }

      // Create style element
      const styleEl = document.createElement("style");
      styleEl.id = "usage-trend-chart-theme-style";
      const theme = this.getTheme();
      if (theme.isDarkMode) {
        styleEl.textContent = `
            /* Force chart text to be white in dark mode */
            [data-theme="dark"] .x-axis text,
            [data-theme="dark"] .y-axis-left text,
            [data-theme="dark"] .y-axis-right text,
            [data-theme="dark"] svg text[font-size="14px"],
            [data-theme="dark"] .legend text {
              fill: #FFFFFF !important;
            }
          `;
        console.log("[UsageTrendChart] Injected dark mode style");
      } else {
        styleEl.textContent = `
            /* Force chart text to be dark in light mode */
            [data-theme="light"] .x-axis text,
            [data-theme="light"] .y-axis-left text,
            [data-theme="light"] .y-axis-right text,
            [data-theme="light"] svg text[font-size="14px"],
            [data-theme="light"] .legend text {
              fill: #333333 !important;
            }
          `;
        console.log("[UsageTrendChart] Injected light mode style");
      }

      // Append to document head
      document.head.appendChild(styleEl);
      console.log(
        "[DEBUG] Injected theme style:",
        theme.isDarkMode ? "dark" : "light"
      );
    },

    /**
     * Get current theme information
     * @returns {Object} Theme colors and mode information
     */
    getTheme() {
      let themeMode =
        this.$refs.chartContainer
          ?.closest("[data-theme]")
          ?.getAttribute("data-theme") ||
        document.documentElement.getAttribute("data-theme") ||
        localStorage.getItem("theme") ||
        "light";
      if (!["light", "dark", "system"].includes(themeMode)) {
        console.warn(
          `[UsageTrendChart] Invalid themeMode: ${themeMode}, defaulting to light`
        );
        themeMode = "light";
      }
      if (themeMode === "system") {
        themeMode = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      this.theme = themeMode;
      const isDarkMode = themeMode === "dark";
      console.log(`[DEBUG] Theme detected: ${isDarkMode ? "dark" : "light"}`);
      return {
        isDarkMode,
        textColor: isDarkMode ? "#FFFFFF" : "#333333",
        backgroundColor: isDarkMode ? "#414141" : "#FFFFFF",
        borderColor: isDarkMode ? "#555555" : "#E5E7EB",
        gridColor: isDarkMode ? "rgba(255, 255, 255, 0.15)" : "#E0E0E0",
        accentColor: "#4E97D1",
        chartColors: [
          "#5470c6",
          "#91cc75",
          "#fac858",
          "#ee6666",
          "#73c0de",
          "#3ba272",
          "#fc8452",
          "#9a60b4",
        ],
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
            console.log("[DEBUG] Theme change detected, updating chart...");
            this.injectGlobalStyleForTheme();
            this.renderChart();
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

    async fetchData() {
      if (this.externalData) return;

      this.loading = true;
      this.error = null;

      try {
        const params = analyticsService.calculateTimeSeriesParams(
          this.period,
          this.selectedDate
        );

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

          this.chartData = data.map((item) => ({
            timestamp: item.timestamp || "",
            dateLabel: this.formatDate(item.timestamp),
            value: typeof item.value === "number" ? item.value : 0,
            userCount: typeof item.userCount === "number" ? item.userCount : 0,
          }));
        } else {
          console.warn("Empty or invalid time series data received:", data);
          this.chartData = this.generateSampleData();
        }

        this.renderChart();
      } catch (error) {
        console.error("Error loading time series data:", error);
        this.error = this.$t("analytics.status.error");
        this.chartData = this.generateSampleData();
        this.renderChart();
      } finally {
        this.loading = false;
      }
    },

    formatDate(dateString) {
      if (!dateString) return "";

      try {
        const date = new Date(dateString);
        return date.toLocaleDateString(this.$i18n.locale);
      } catch (e) {
        return dateString;
      }
    },

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

    initChartDimensions() {
      if (!this.$refs.chartContainer) return;

      const container = this.$refs.chartContainer;
      this.width = container.offsetWidth;
      this.height = 300;
    },

    // NEW: Core resize logic, now called by the debounced function
    processResize() {
      this.$nextTick(() => {
        this.initChartDimensions();
        this.renderChart();
      });
    },

    /**
     * Force text elements to use appropriate color based on theme
     */
    forceAxisTextColor() {
      const theme = this.getTheme();
      const textColor = theme.textColor;

      const chartContainer = this.$refs.chartContainer;
      if (!chartContainer) return;

      setTimeout(() => {
        const xAxisText = chartContainer.querySelectorAll(".x-axis text");
        xAxisText.forEach((el) => el.setAttribute("fill", textColor));

        const yAxisLeftText =
          chartContainer.querySelectorAll(".y-axis-left text");
        yAxisLeftText.forEach((el) => el.setAttribute("fill", textColor));

        const yAxisRightText =
          chartContainer.querySelectorAll(".y-axis-right text");
        yAxisRightText.forEach((el) => el.setAttribute("fill", textColor));

        const chartTitle = chartContainer.querySelectorAll(
          'text[font-size="14px"]'
        );
        chartTitle.forEach((el) => el.setAttribute("fill", textColor));

        const legendText = chartContainer.querySelectorAll(".legend text");
        legendText.forEach((el) => el.setAttribute("fill", textColor));

        console.log(`[DEBUG] Forcing axis text color to: ${textColor}`);
      }, 100);
    },

    renderChart() {
      if (!this.$refs.chartContainer) return;

      const container = this.$refs.chartContainer;

      // 1. IMMEDIATELY KILL ANY EXISTING CHART — THIS IS NON-NEGOTIABLE
      d3.select(container).selectAll("*").remove();

      // 2. Measure width AFTER clearing (browser can report negative during layout collapse)
      const rawWidth = container.offsetWidth;
      const containerWidth = Math.max(0, rawWidth); // ← THE FIX THAT ENDS THIS NIGHTMARE

      const margin = { top: 40, right: 60, bottom: 50, left: 60 };
      const width = containerWidth - margin.left - margin.right;
      const height = this.height - margin.top - margin.bottom;

      // 3. Bail out cleanly if container is collapsed or unusable
      if (
        !this.chartData ||
        this.chartData.length === 0 ||
        width < 50 ||
        height <= 0
      ) {
        return;
      }

      // ──────────────────────────────────────────────────────────────
      // YOUR ORIGINAL CHART — 100% UNTOUCHED FROM HERE ON
      // ──────────────────────────────────────────────────────────────
      const theme = this.getTheme();
      const { textColor, borderColor, gridColor, isDarkMode } = theme;

      const svg = d3
        .select(container)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", this.height);

      const mainGroup = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const defs = mainGroup.append("defs");

      defs
        .append("filter")
        .attr("id", "drop-shadow")
        .attr("height", "130%")
        .append("feDropShadow")
        .attr("dx", 0)
        .attr("dy", 3)
        .attr("stdDeviation", 3)
        .attr("flood-color", "rgba(0,0,0,0.3)");

      const barGradient = defs
        .append("linearGradient")
        .attr("id", "bar-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
      barGradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#62d9a6");
      barGradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#2da676");

      const areaGradient = defs
        .append("linearGradient")
        .attr("id", "area-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
      areaGradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#4682B4")
        .attr("stop-opacity", 0.7);
      areaGradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#4682B4")
        .attr("stop-opacity", 0.1);

      const lineGradient = defs
        .append("linearGradient")
        .attr("id", "line-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");
      lineGradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#5b9bd5");
      lineGradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#3a6da0");

      const data = this.chartData
        .map((d) => ({
          timestamp: d.timestamp ? new Date(d.timestamp) : new Date(),
          dateLabel: d.dateLabel || "",
          value: d.value,
          userCount: d.userCount,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      const xBand = d3
        .scaleBand()
        .domain(data.map((d) => d.timestamp))
        .range([0, width])
        .padding(0.1);

      const xTime = d3
        .scaleTime()
        .range([0, width])
        .domain(d3.extent(data, (d) => d.timestamp));

      const yLeft = d3
        .scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(data, (d) => d.value) * 1.1])
        .nice();

      const yRight = d3
        .scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(data, (d) => d.userCount) * 1.2])
        .nice();

      mainGroup
        .append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xTime).tickSize(-height).tickFormat(""))
        .selectAll("line")
        .attr("stroke", gridColor)
        .attr("stroke-dasharray", isDarkMode ? "3,3" : "none");

      mainGroup
        .append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(yLeft).tickSize(-width).tickFormat(""))
        .selectAll("line")
        .attr("stroke", gridColor)
        .attr("stroke-dasharray", isDarkMode ? "3,3" : "none");

      mainGroup.selectAll(".grid .domain").attr("stroke", "none");

      const barWidth = Math.max(1, xBand.bandwidth());

      const bars = mainGroup
        .selectAll(".bar-group")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", (d) => `translate(${xBand(d.timestamp)},0)`);

      bars
        .append("rect")
        .attr("class", "bar")
        .attr("width", barWidth)
        .attr("y", (d) => yLeft(d.value))
        .attr("height", (d) => Math.max(0, height - yLeft(d.value)))
        .attr("fill", "url(#bar-gradient)")
        .attr("rx", 1)
        .attr("ry", 1)
        .style("filter", "url(#drop-shadow)")
        .style("opacity", 0.85);

      bars
        .append("rect")
        .attr("width", barWidth)
        .attr("height", (d) => (height - yLeft(d.value) > 0 ? 2 : 0))
        .attr("y", (d) => yLeft(d.value))
        .attr("fill", "#ffffff")
        .attr("opacity", 0.5)
        .attr("rx", 1);

      const area = d3
        .area()
        .x((d) => xTime(d.timestamp))
        .y0(height)
        .y1((d) => yRight(d.userCount))
        .curve(d3.curveCardinal.tension(0.5));

      mainGroup
        .append("path")
        .datum(data)
        .attr("class", "area")
        .attr("fill", "url(#area-gradient)")
        .attr("d", area)
        .attr("opacity", 0.4);

      const line = d3
        .line()
        .x((d) => xTime(d.timestamp))
        .y((d) => yRight(d.userCount))
        .curve(d3.curveCardinal.tension(0.5));

      mainGroup
        .append("path")
        .datum(data)
        .attr("class", "line-shadow")
        .attr("fill", "none")
        .attr("stroke", isDarkMode ? "#555" : "#333")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.2)
        .attr("d", line)
        .attr("transform", "translate(1,1)");

      mainGroup
        .append("path")
        .datum(data)
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", "url(#line-gradient)")
        .attr("stroke-width", 1.5)
        .attr("d", line);

      mainGroup
        .selectAll(".dot-shadow")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "dot-shadow")
        .attr("cx", (d) => xTime(d.timestamp) + 1)
        .attr("cy", (d) => yRight(d.userCount) + 1)
        .attr("r", 3)
        .attr("fill", "rgba(0,0,0,0.2)");

      mainGroup
        .selectAll(".dot")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("cx", (d) => xTime(d.timestamp))
        .attr("cy", (d) => yRight(d.userCount))
        .attr("r", 2.5)
        .attr("fill", "#5b9bd5")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1);

      const xAxis = d3
        .axisBottom(xTime)
        .ticks(d3.timeDay.every(Math.ceil(data.length / 12)))
        .tickFormat((d) => {
          const month = d.toLocaleString(this.$i18n.locale, { month: "short" });
          const day = d.getDate();
          return `${month} ${day}`;
        });

      const xAxisGroup = mainGroup
        .append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

      xAxisGroup
        .selectAll("text")
        .style("text-anchor", "end")
        .style("font-weight", "bold")
        .style("font-size", "11px")
        .style("fill", textColor)
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

      xAxisGroup.selectAll("path").attr("stroke", borderColor);
      xAxisGroup.selectAll("line").attr("stroke", borderColor);

      const yAxisLeftGroup = mainGroup
        .append("g")
        .attr("class", "y-axis-left")
        .call(d3.axisLeft(yLeft).ticks(5));

      yAxisLeftGroup
        .selectAll("text")
        .style("font-weight", "bold")
        .style("font-size", "11px")
        .style("fill", textColor);

      yAxisLeftGroup.selectAll("path").attr("stroke", borderColor);
      yAxisLeftGroup.selectAll("line").attr("stroke", borderColor);

      const yAxisRightGroup = mainGroup
        .append("g")
        .attr("class", "y-axis-right")
        .attr("transform", `translate(${width},0)`)
        .call(d3.axisRight(yRight).ticks(5));

      yAxisRightGroup
        .selectAll("text")
        .style("font-weight", "bold")
        .style("font-size", "11px")
        .style("fill", textColor);

      yAxisRightGroup.selectAll("path").attr("stroke", borderColor);
      yAxisRightGroup.selectAll("line").attr("stroke", borderColor);

      mainGroup
        .append("text")
        .attr("x", width / 2)
        .attr("y", -30)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("fill", textColor)
        .text(this.$t("charts.usageTrend"));

      const legendBox = mainGroup
        .append("g")
        .attr("class", "legend-box")
        .attr("transform", `translate(${width / 2 - 170}, -15)`);

      const legend = legendBox.append("g").attr("class", "legend");

      legend
        .append("rect")
        .attr("x", 10)
        .attr("y", -5)
        .attr("width", 12)
        .attr("height", 10)
        .attr("fill", "url(#bar-gradient)")
        .attr("rx", 1)
        .attr("ry", 1);

      legend
        .append("text")
        .attr("x", 30)
        .attr("y", 0)
        .attr("dy", ".15em")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .attr("fill", textColor)
        .text(this.$t("charts.tooltip.totalQueries"));

      legend
        .append("line")
        .attr("x1", 170)
        .attr("y1", 0)
        .attr("x2", 200)
        .attr("y2", 0)
        .attr("stroke", "#5b9bd5")
        .attr("stroke-width", 1.5);

      legend
        .append("circle")
        .attr("cx", 185)
        .attr("cy", 0)
        .attr("r", 2.5)
        .attr("fill", "#5b9bd5")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);

      legend
        .append("text")
        .attr("x", 210)
        .attr("y", 0)
        .attr("dy", ".15em")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .attr("fill", textColor)
        .text(this.$t("charts.tooltip.uniqueUsers"));

      if (d3.select("body").select(".d3-tooltip").empty()) {
        d3.select("body")
          .append("div")
          .attr("class", "d3-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.7)")
          .style("color", "white")
          .style("padding", "10px")
          .style("border-radius", "5px")
          .style("font-size", "12px")
          .style("box-shadow", "0 3px 14px rgba(0,0,0,0.4)")
          .style("pointer-events", "none")
          .style("opacity", 0)
          .style("z-index", 1000);
      }

      const verticalLine = mainGroup
        .append("line")
        .attr("class", "vertical-line")
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", borderColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3")
        .style("opacity", 0);

      const hoverDotLeft = mainGroup
        .append("circle")
        .attr("class", "hover-dot")
        .attr("r", 5)
        .attr("fill", "url(#bar-gradient)")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .style("opacity", 0);

      const hoverDotRight = mainGroup
        .append("circle")
        .attr("class", "hover-dot")
        .attr("r", 3)
        .attr("fill", "#5b9bd5")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .style("opacity", 0);

      mainGroup
        .append("rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("mouseover", () => {
          d3.select(".d3-tooltip").style("opacity", 0.9);
          verticalLine.style("opacity", 1);
          hoverDotLeft.style("opacity", 1);
          hoverDotRight.style("opacity", 1);
        })
        .on("mouseout", () => {
          d3.select(".d3-tooltip").style("opacity", 0);
          verticalLine.style("opacity", 0);
          hoverDotLeft.style("opacity", 0);
          hoverDotRight.style("opacity", 0);
        })
        .on("mousemove", (event) => {
          const mouseX = d3.pointer(event)[0];
          const bisect = d3.bisector((d) => d.timestamp).left;
          const x0 = xTime.invert(mouseX);
          const i = bisect(data, x0, 1);
          if (i === 0 || i >= data.length) return;

          const d0 = data[i - 1];
          const d1 = data[i];
          const d = x0 - d0.timestamp > d1.timestamp - x0 ? d1 : d0;

          verticalLine
            .attr("x1", xTime(d.timestamp))
            .attr("x2", xTime(d.timestamp));
          hoverDotLeft
            .attr("cx", xBand(d.timestamp) + barWidth / 2)
            .attr("cy", yLeft(d.value));
          hoverDotRight
            .attr("cx", xTime(d.timestamp))
            .attr("cy", yRight(d.userCount));

          const totalQueriesLabel = this.$t("charts.tooltip.totalQueries");
          const uniqueUsersLabel = this.$t("charts.tooltip.uniqueUsers");

          const tooltipContent = `
        <div style="margin-bottom: 5px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 4px;">
          ${d.dateLabel}
        </div>
        <div style="margin: 5px 0;">
          <span style="display: inline-block; width: 12px; height: 12px; margin-right: 5px; background: linear-gradient(to bottom, #62d9a6, #2da676); border-radius: 2px; vertical-align: middle;"></span>
          ${totalQueriesLabel}: <strong>${d.value.toLocaleString(
            this.$i18n.locale
          )}</strong>
        </div>
        <div style="margin: 5px 0;">
          <span style="display: inline-block; width: 12px; height: 12px; margin-right: 5px; background: #5b9bd5; border-radius: 50%; vertical-align: middle;"></span>
          ${uniqueUsersLabel}: <strong>${d.userCount.toLocaleString(
            this.$i18n.locale
          )}</strong>
        </div>
      `;

          d3.select(".d3-tooltip")
            .html(tooltipContent)
            .style("left", event.pageX + 15 + "px")
            .style("top", event.pageY - 60 + "px");
        });

      this.forceAxisTextColor();
    },
  },
};
</script>
  
  <style scoped>
.usage-trend-chart {
  position: relative;
  width: 100%;
  height: 300px;
}

.chart-container {
  width: 100%;
  height: 100%;
  background-color: var(--bg-card, #fff);
  border-radius: 8px;
  box-shadow: var(--shadow-sm, 0 2px 15px rgba(0, 0, 0, 0.1));
  padding: 10px;
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
  background: var(--bg-card, rgba(255, 255, 255, 0.8));
  opacity: 0.9;
  z-index: 1;
  border-radius: 8px;
  color: var(--text-primary, #333);
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

.error-container,
.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--text-primary, #333);
  font-style: italic;
  font-weight: 500;
  border-radius: 8px;
}

.error-message {
  color: var(--status-outage, #d32f2f);
  font-weight: 500;
}

:global(.d3-tooltip) {
  position: absolute;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  padding: 10px;
  border-radius: 5px;
  pointer-events: none;
  opacity: 0;
  z-index: 1000;
  max-width: 250px;
  box-shadow: 0 3px 14px rgba(0, 0, 0, 0.4);
  font-weight: bold;
}

[data-theme="dark"] :deep(.x-axis text),
[data-theme="dark"] :deep(.y-axis-left text),
[data-theme="dark"] :deep(.y-axis-right text),
[data-theme="dark"] :deep(.legend text),
[data-theme="dark"] :deep(text[font-size="14px"]) {
  fill: white !important;
}

[data-theme="dark"] .chart-container {
  background-color: #414141 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

[data-theme="dark"] :deep(svg rect:first-child) {
  fill: #414141 !important;
}

[data-theme="dark"] :deep(svg rect[fill="#bbbcbe"]) {
  fill: #414141 !important;
}

:deep(.bar) {
  fill: url(#bar-gradient) !important;
}

:deep(#bar-gradient stop:first-child) {
  stop-color: #62d9a6 !important;
}

:deep(#bar-gradient stop:last-child) {
  stop-color: #2da676 !important;
}

:deep(rect.bar) {
  fill: #62d9a6 !important;
}
</style>