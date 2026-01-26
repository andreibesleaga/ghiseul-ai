<!-- CategoryDistributionChart.vue -->
<template>
  <div class="chart-wrapper">
    <div ref="chart" class="chart-container">
      <apexchart
        v-if="!loading && !error && chartOptions"
        type="donut"
        height="100%"
        :options="chartOptions"
        :series="chartSeries"
      ></apexchart>
    </div>
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <span>{{ $t("analytics.status.loading") }}</span>
    </div>
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script>
import analyticsService from "../../services/analyticsService";
import { serviceTreeService } from "../../services";

export default {
  name: "CategoryDistributionChart",
  props: {
    // Data can be provided by parent component
    data: {
      type: Array,
      default: () => [],
    },
    // Whether to use provided data or fetch from API
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
      categories: {},
      loading: false,
      error: null,
      chartOptions: null,
      chartSeries: [],
      isMobile: false,
      themeObserver: null,
      systemThemeMediaQuery: null,
      systemThemeChangeHandler: null,
      processedData: [],
    };
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
    // Watch for renderKey (locale) changes to force complete re-render
    renderKey: {
      handler() {
        // Reload category names with new locale
        this.loadCategoryNames().then(() => {
          if (this.chartData && this.chartData.length > 0) {
            // Update chart with new locale
            this.updateChart();
          }
        });
      },
    },
  },
  mounted() {
    // Check if mobile on mount
    this.checkMobile();

    // Set initial theme and listener
    this.setupThemeChangeListener();

    // Load category names first
    this.loadCategoryNames().then(() => {
      // Use data from props or fetch from API
      if (this.externalData && this.data.length > 0) {
        this.chartData = this.data;
        this.updateChart();
      } else if (!this.externalData) {
        this.fetchData();
      }
    });

    // Add resize listener
    window.addEventListener("resize", this.handleResize);
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.handleResize);

    // Clean up theme change listeners
    this.cleanupThemeChangeListener();
  },
  methods: {
    /**
     * Get current theme information
     */
    getTheme() {
      let themeMode =
        this.$refs.chart?.closest("[data-theme]")?.getAttribute("data-theme") ||
        document.documentElement.getAttribute("data-theme") ||
        localStorage.getItem("theme") ||
        "light";
      if (!["light", "dark", "system"].includes(themeMode)) {
        console.warn(
          `[CategoryDistributionChart] Invalid themeMode: ${themeMode}, defaulting to light`
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
        backgroundColor: themeMode === "dark" ? "#414141" : "#FFFFFF",
        textColor: themeMode === "dark" ? "#FFFFFF" : "#333333",
      };
    },

    /**
     * Set up theme change listener to update chart when theme changes
     */
    setupThemeChangeListener() {
      // Watch for theme changes through classList or data-theme mutations
      this.themeObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (
            mutation.attributeName === "class" ||
            mutation.attributeName === "data-theme"
          ) {
            console.log("[DEBUG] Theme change detected, updating chart...");
            this.updateChart();
            break;
          }
        }
      });

      // Observe document root for theme changes
      this.themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });

      // Also listen for system preference changes
      this.systemThemeMediaQuery = window.matchMedia(
        "(prefers-color-scheme: dark)"
      );
      this.systemThemeChangeHandler = (e) => {
        console.log(
          "[DEBUG] System theme preference changed, updating chart..."
        );
        this.updateChart();
      };

      // Add listener with compatibility for older browsers
      if (this.systemThemeMediaQuery.addEventListener) {
        this.systemThemeMediaQuery.addEventListener(
          "change",
          this.systemThemeChangeHandler
        );
      } else {
        // Fallback for older browsers
        this.systemThemeMediaQuery.addListener(this.systemThemeChangeHandler);
      }
    },

    /**
     * Clean up theme change listeners
     */
    cleanupThemeChangeListener() {
      if (this.themeObserver) {
        this.themeObserver.disconnect();
      }

      if (this.systemThemeMediaQuery) {
        if (this.systemThemeMediaQuery.removeEventListener) {
          this.systemThemeMediaQuery.removeEventListener(
            "change",
            this.systemThemeChangeHandler
          );
        } else {
          // Fallback for older browsers
          this.systemThemeMediaQuery.removeListener(
            this.systemThemeChangeHandler
          );
        }
      }

      // Remove custom tooltip
      const tooltip = document.getElementById("chart-custom-tooltip");
      if (tooltip) {
        tooltip.remove();
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
     * Fetch category distribution data from API
     */
    async fetchData() {
      if (this.externalData) return;

      this.loading = true;
      this.error = null;

      try {
        // Calculate date range based on period
        const { startDate, endDate } = analyticsService.calculateDateRange(
          this.period,
          this.selectedDate
        );

        // Get current locale from i18n and ensure it's passed to the service
        const locale = this.$i18n.locale;
        console.log(`[DEBUG] fetchData: Current locale is "${locale}"`);

        // Make sure analyticsService has the locale information
        if (!analyticsService.$i18n) {
          console.log(`[DEBUG] Setting i18n instance on analyticsService`);
          analyticsService.$i18n = this.$i18n;
        }

        // Fetch dashboard analytics with explicit locale
        const dashboardData = await analyticsService.getDashboardAnalytics(
          this.period,
          this.selectedDate
        );

        if (dashboardData && dashboardData.queryDistribution) {
          // Debug: Log category names from API
          console.log(
            `[DEBUG] Category data received from API:`,
            dashboardData.queryDistribution.map((item) => ({
              id: item.categoryId,
              name: item.name,
              count: item.count,
            }))
          );

          this.chartData = dashboardData.queryDistribution;
          this.updateChart();

          // Debug: Check language of received category names
          this.logCategoryLanguageInfo();
        } else {
          console.error(`[DEBUG] No queryDistribution in response`);
          this.error = this.$t("analytics.status.noData");
        }
      } catch (error) {
        console.error("Error fetching category distribution data:", error);
        console.log("Falling back to sample category data...");
        // Fall back to hard-coded data
        this.chartData = this.getFallbackData();
        this.updateChart();
      } finally {
        this.loading = false;
      }
    },

    /**
     * Load category names from the service
     */
    async loadCategoryNames() {
      try {
        const categories = await serviceTreeService.getAllCategories();

        // Create a lookup object for category names by ID
        categories.forEach((category) => {
          // Extract the numeric ID from serviceCategories/123 (full path)
          // or just use the raw _key (which is typically just the number)
          const id =
            category._key ||
            (category._id && category._id.split("/")[1]) ||
            category.catKey ||
            category.categoryId;

          if (id) {
            // Use the appropriate translation based on current locale
            const currentLocale = this.$i18n.locale;

            // Use nameXX based on locale or fall back to nameEN
            let name = null;
            if (currentLocale === "fr" && category.nameFR) {
              name = category.nameFR;
              console.log(
                `[DEBUG] Using French name for category ${id}: ${name}`
              );
            } else if (currentLocale === "ro" && category.nameRO) {
              name = category.nameRO;
              console.log(
                `[DEBUG] Using Romanian name for category ${id}: ${name}`
              );
            } else {
              name = category.nameEN || category.name || null;
              console.log(
                `[DEBUG] Using default/English name for category ${id}: ${name}`
              );
            }

            // Store the name with various ID formats for flexible lookup
            if (name) {
              // Store with numeric ID (most important - this is the _key in ArangoDB)
              this.categories[id] = name;

              // Store with full path from _id (serviceCategories/X)
              if (category._id) {
                this.categories[category._id] = name;
              } else if (id.match(/^\d+$/)) {
                this.categories[`serviceCategories/${id}`] = name;
              }

              // Store with s/X short format
              if (id.match(/^\d+$/)) {
                this.categories[`s/${id}`] = name;
              }

              // Store with serviceCategorie format
              if (id.match(/^\d+$/)) {
                this.categories[`serviceCategorie${id}`] = name;
              }

              // Store with cat format
              if (id.match(/^\d+$/)) {
                this.categories[`cat${id}`] = name;
              }
            }
          }
        });

        console.log(
          `[DEBUG] Loaded ${
            Object.keys(this.categories).length
          } category names for locale: ${this.$i18n.locale}`
        );
      } catch (error) {
        console.error("Error loading category names:", error);
        // Populate with fallback data in case of error
        this.populateFallbackCategories();
      }
    },

    /**
     * Populate with fallback category names when service fails
     */
    populateFallbackCategories() {
      // Based on the schema/sample data, provide fallback names
      const fallbackCategories = {
        1: {
          nameEN: "Identity & Civil Registration",
          nameFR: "Identité et état civil",
          nameRO: "Identitate și Înregistrări Civile",
        },
        2: { nameEN: "Transportation", nameFR: "Transport", nameRO: "Transport" },
        3: {
          nameEN: "Taxes & Revenue",
          nameFR: "Impôts et Revenus",
          nameRO: "Taxe și Impozite",
        },
        4: {
          nameEN: "Immigration & Citizenship",
          nameFR: "Immigration et Citoyenneté",
          nameRO: "Imigrare și Cetățenie",
        },
        5: {
          nameEN: "Education & Learning",
          nameFR: "Éducation et Apprentissage",
          nameRO: "Educație și Învățare",
        },
        6: {
          nameEN: "Housing & Properties",
          nameFR: "Logement et Propriétés",
          nameRO: "Locuințe și Proprietăți",
        },
        7: {
          nameEN: "Health & Healthcare",
          nameFR: "Santé et Soins Médicaux",
          nameRO: "Sănătate și Servicii Medicale",
        },
        8: {
          nameEN: "Public Safety",
          nameFR: "Sécurité Publique",
          nameRO: "Siguranță Publică",
        },
        9: {
          nameEN: "Business & Economy",
          nameFR: "Entreprise et Économie",
          nameRO: "Afaceri și Economie",
        },
        10: {
          nameEN: "Social Services",
          nameFR: "Services Sociaux",
          nameRO: "Servicii Sociale",
        },
        11: {
          nameEN: "Environment",
          nameFR: "Environnement",
          nameRO: "Mediu",
        },
        12: {
          nameEN: "Culture & Recreation",
          nameFR: "Culture et Loisirs",
          nameRO: "Cultură și Recreere",
        },
        13: {
          nameEN: "Legal Services",
          nameFR: "Services Juridiques",
          nameRO: "Servicii Juridice",
        },
      };

      // Determine the current locale
      const currentLocale = this.$i18n.locale;
      console.log(
        `[DEBUG] Using fallback categories for locale: ${currentLocale}`
      );

      // Add entries for each format with the appropriate language
      Object.entries(fallbackCategories).forEach(([id, names]) => {
        // Choose the right language name
        let name = names.nameEN;
        if (currentLocale === "fr" && names.nameFR) {
          name = names.nameFR;
        } else if (currentLocale === "ro" && names.nameRO) {
          name = names.nameRO;
        }

        // Add entries with all possible ID formats for maximum compatibility
        this.categories[id] = name;
        this.categories[`serviceCategories/${id}`] = name;
        this.categories[`s/${id}`] = name;
        this.categories[`serviceCategorie${id}`] = name;
        this.categories[`cat${id}`] = name;
      });
    },

    /**
     * Format category ID for display when no name is found
     */
    formatCategoryId(categoryId) {
      if (!categoryId) return this.$t("charts.notAvailable");

      // Extract the numeric ID from different formats
      let numericId = null;

      // Try serviceCategories/X format (from database _id)
      const serviceCategoriesMatch = categoryId.match(
        /serviceCategories\/(\d+)/i
      );
      if (serviceCategoriesMatch) {
        numericId = serviceCategoriesMatch[1];
      }

      // Try s/X format
      if (!numericId) {
        const sMatch = categoryId.match(/s\/(\d+)/i);
        if (sMatch) {
          numericId = sMatch[1];
        }
      }

      // Try serviceCategorie format
      if (!numericId) {
        const serviceCatMatch = categoryId.match(/serviceCategorie(\d+)/i);
        if (serviceCatMatch) {
          numericId = serviceCatMatch[1];
        }
      }

      // Try cat format
      if (!numericId) {
        const catMatch = categoryId.match(/cat(\d+)/i);
        if (catMatch) {
          numericId = catMatch[1];
        }
      }

      // Try to parse the ID itself if it's a number
      if (!numericId && /^\d+$/.test(categoryId)) {
        numericId = categoryId;
      }

      // If we found a numeric ID, check our fallback data
      if (numericId && this.categories[numericId]) {
        return this.categories[numericId];
      }

      // Default fallback - just format the ID nicely
      // Extract the relevant part of the ID for display
      let idDisplay = categoryId;
      if (categoryId.includes("/")) {
        idDisplay = categoryId.split("/").pop();
      } else {
        idDisplay = categoryId.replace(/^(serviceCategorie|cat)/i, "");
      }

      return `${this.$t("analytics.chartLabels.category")} ${idDisplay}`;
    },

    /**
     * Remove number prefix from category name
     */
    removeNumberPrefix(text) {
      if (!text) return "";
      return text.replace(/^\d+\.\s*/, "");
    },

    /**
     * Handle window resize
     */
    handleResize() {
      this.checkMobile();
      this.updateChart();
    },

    /**
     * Get fallback data in case API fails
     * @returns {Array} Sample category distribution data
     */
    getFallbackData() {
      // Get current locale
      const currentLocale = this.$i18n.locale;

      // Define multi-language names
      const categoryNames = {
        cat1: {
          en: "Identity & Civil Registry",
          fr: "Identité et Registre Civil",
          ro: "Identitate și Registru Civil",
        },
        cat2: {
          en: "Healthcare & Social Services",
          fr: "Santé et Services Sociaux",
          ro: "Sănătate și Servicii Sociale",
        },
        cat3: {
          en: "Education & Learning",
          fr: "Éducation et Apprentissage",
          ro: "Educație și Învățare",
        },
        cat4: {
          en: "Employment & Labor Services",
          fr: "Emploi et Services du Travail",
          ro: "Ocuparea Forței de Muncă",
        },
        cat5: {
          en: "Taxes & Revenue",
          fr: "Impôts et Revenus",
          ro: "Taxe și Impozite",
        },
        cat6: {
          en: "Public Safety & Justice",
          fr: "Sécurité Publique et Justice",
          ro: "Siguranță Publică și Justiție",
        },
        cat7: {
          en: "Transportation & Mobility",
          fr: "Transport et Mobilité",
          ro: "Transport și Mobilitate",
        },
        cat8: {
          en: "Housing & Urban Development",
          fr: "Logement et Développement Urbain",
          ro: "Locuințe și Dezvoltare Urbană",
        },
      };

      // Select language based on locale
      const lang =
        currentLocale === "fr" ? "fr" : currentLocale === "ro" ? "ro" : "en";

      console.log(`[DEBUG] Using fallback data with language: ${lang}`);

      // Create fallback data with appropriate language
      return [
        {
          categoryId: "cat1",
          name: categoryNames.cat1[lang],
          count: 2347,
          value: 23,
        },
        {
          categoryId: "cat2",
          name: categoryNames.cat2[lang],
          count: 1782,
          value: 17,
        },
        {
          categoryId: "cat3",
          name: categoryNames.cat3[lang],
          count: 1645,
          value: 16,
        },
        {
          categoryId: "cat4",
          name: categoryNames.cat4[lang],
          count: 1245,
          value: 12,
        },
        {
          categoryId: "cat5",
          name: categoryNames.cat5[lang],
          count: 980,
          value: 10,
        },
        {
          categoryId: "cat6",
          name: categoryNames.cat6[lang],
          count: 850,
          value: 8,
        },
        {
          categoryId: "cat7",
          name: categoryNames.cat7[lang],
          count: 720,
          value: 7,
        },
        {
          categoryId: "cat8",
          name: categoryNames.cat8[lang],
          count: 650,
          value: 6,
        },
      ];
    },

    /**
     * Analyze if category names are in the correct language
     * Helps debug if the API is returning names in the wrong language
     */
    logCategoryLanguageInfo() {
      if (!this.chartData || !this.chartData.length) {
        console.log("[DEBUG] No chart data available to check language");
        return;
      }

      const locale = this.$i18n.locale;
      console.log(`[DEBUG] Analyzing category names for locale: "${locale}"`);

      // Simple word patterns to detect language
      const patterns = {
        en: [
          "and",
          "of",
          "services",
          "identity",
          "civil",
          "education",
          "business",
        ],
        ro: ["și", "de", "servicii", "identitate", "educație", "afaceri"],
        fr: ["et", "de", "services", "identité", "civil", "éducation"],
      };

      let matchCount = 0;
      let totalWithNames = 0;

      this.chartData.forEach((cat) => {
        if (!cat.name) {
          console.log(`[DEBUG] Missing name for category: ${cat.categoryId}`);
          return;
        }

        totalWithNames++;

        // Check each language
        const results = {};
        Object.entries(patterns).forEach(([lang, words]) => {
          const nameLower = cat.name.toLowerCase();
          const matches = words.filter((word) =>
            nameLower.includes(word.toLowerCase())
          );
          results[lang] = matches.length;
        });

        // Determine likely language
        let likelyLang = "unknown";
        let highestCount = 0;

        Object.entries(results).forEach(([lang, count]) => {
          if (count > highestCount) {
            highestCount = count;
            likelyLang = lang;
          }
        });

        const isMatch = likelyLang === locale;
        if (isMatch) {
          matchCount++;
        }

        console.log(
          `[DEBUG] Category "${cat.categoryId}" name: "${
            cat.name
          }" - likely language: ${likelyLang} (match with current locale: ${
            isMatch ? "YES" : "NO"
          })`
        );
      });

      // Summary statistics
      if (totalWithNames > 0) {
        const matchPercent = Math.round((matchCount / totalWithNames) * 100);
        console.log(
          `[DEBUG] Language match summary: ${matchCount}/${totalWithNames} (${matchPercent}%) names match current locale "${locale}"`
        );
      }
    },

    /**
     * Get ApexCharts tooltip formatter with transparent black background
     */
    tooltipFormatter(value, opts) {
      const item = this.processedData[opts.dataPointIndex];
      if (!item) return "";

      // Use transparent black background and white text for all themes
      const bgColor = "rgba(0, 0, 0, 0.75)";
      const textColor = "#FFFFFF";

      return `
        <div class="apexcharts-tooltip-box" style="background: ${bgColor}; border-radius: 5px; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
          <div class="apexcharts-tooltip-title" style="color: ${textColor}; font-weight: bold; margin-bottom: 5px;">${
        item.categoryName
      }</div>
          <div class="apexcharts-tooltip-series-group" style="color: ${textColor}; padding: 0;">
            <div style="color: ${textColor}; padding: 2px 0;">${this.$t(
        "analytics.table.count"
      )}: ${item.count ? item.count.toLocaleString() : "N/A"}</div>
            <div style="color: ${textColor}; padding: 2px 0;">${this.$t(
        "analytics.percentage",
        "Percentage"
      )}: ${Math.round(item.percentage)}%</div>
          </div>
        </div>
      `;
    },

    /**
     * Get localized category name based on ID
     */
    getCategoryDisplayName(categoryId) {
      // First check if the exact ID exists in our categories lookup
      if (this.categories[categoryId]) {
        return this.categories[categoryId];
      }

      // Handle "serviceCategories/X" format (format from the database _id field)
      const serviceCategoriesMatch = categoryId.match(
        /serviceCategories\/(\d+)/i
      );
      if (
        serviceCategoriesMatch &&
        this.categories[serviceCategoriesMatch[1]]
      ) {
        return this.categories[serviceCategoriesMatch[1]];
      }

      // Handle "s/X" format (shorthand format used in some places)
      const sMatch = categoryId.match(/s\/(\d+)/i);
      if (sMatch && this.categories[sMatch[1]]) {
        return this.categories[sMatch[1]];
      }

      // Then try extracting numeric part if it's a serviceCategorie format
      const serviceMatch = categoryId.match(/serviceCategorie(\d+)/i);
      if (serviceMatch && this.categories[serviceMatch[1]]) {
        return this.categories[serviceMatch[1]];
      }

      // Then try extracting numeric part if it's a cat format
      const catMatch = categoryId.match(/cat(\d+)/i);
      if (catMatch && this.categories[catMatch[1]]) {
        return this.categories[catMatch[1]];
      }

      // Fallback to formatting the ID
      return this.formatCategoryId(categoryId);
    },

    /**
     * Process chart data to ensure all necessary properties
     */
    processChartData() {
      if (!this.chartData || this.chartData.length === 0) return [];

      // Calculate total for percentages
      const total = this.chartData.reduce((sum, item) => {
        const value = Number(item.value) || Number(item.count) || 1;
        return sum + value;
      }, 0);

      // Process and prepare data with proper names
      return this.chartData
        .map((item) => {
          // Ensure the value property exists and is a valid number
          const value = Number(item.value) || Number(item.count) || 1;
          const percentage = (value / total) * 100;

          // CRITICAL: Prioritize the name directly from the API response
          let displayName = "";

          if (
            item.name &&
            item.name !== item.categoryId &&
            !item.name.startsWith("Category ")
          ) {
            // Use the name directly from the API which should already be in the correct language
            displayName = item.name;
            console.log(
              `[DEBUG] Using API-provided name: "${displayName}" for ${item.categoryId}`
            );
          } else {
            // Only fall back to category lookup if API didn't provide a usable name
            displayName = this.getCategoryDisplayName(item.categoryId);
            console.log(
              `[DEBUG] Using looked-up name: "${displayName}" for ${item.categoryId}`
            );
          }

          return {
            categoryId: item.categoryId,
            categoryName: displayName,
            count: Number(item.count) || 0,
            value: value,
            percentage: percentage,
          };
        })
        .sort((a, b) => b.value - a.value); // Sort by value descending for better visualization
    },

    /**
     * Update the chart and implement manual tooltips
     */
    updateChart() {
      // Process the data for the chart
      this.processedData = this.processChartData();

      if (!this.processedData || this.processedData.length === 0) {
        this.error = this.$t("analytics.status.noData");
        return;
      }

      const container = this.$refs.chart;
      if (container && Math.max(0, container.offsetWidth) < 100) {
        return; // Prevents ApexCharts from rendering when container is collapsed
      }

      // Get theme information
      const theme = this.getTheme();
      console.log(
        `[DEBUG] Theme detected: ${theme.isDarkMode ? "dark" : "light"}`
      );

      // Create explicit center label style based on theme
      const centerLabelStyle = {
        color: theme.isDarkMode ? "#FFFFFF" : "#333333",
        fontSize: "14px",
        fontWeight: "bold",
      };

      // Prepare series data for ApexCharts
      this.chartSeries = this.processedData.map((item) => item.value);

      // Set up chart labels with proper category names
      const labels = this.processedData.map((item) => {
        // Truncate long names
        const nameMaxLength = this.isMobile ? 18 : 25;
        return this.truncateText(item.categoryName, nameMaxLength);
      });

      // Get colors for chart
      const colors = [
        "#5470c6",
        "#91cc75",
        "#fac858",
        "#ee6666",
        "#73c0de",
        "#3ba272",
        "#fc8452",
        "#9a60b4",
      ];

      // Set up chart options - DISABLE BUILT-IN TOOLTIPS COMPLETELY
      this.chartOptions = {
        chart: {
          type: "donut",
          fontFamily: "inherit",
          toolbar: {
            show: false,
          },
          animations: {
            enabled: true,
            speed: 300,
          },
          background: theme.backgroundColor,
          foreColor: theme.textColor,
        },
        stroke: {
          width: 0, // Remove stroke around slices
        },
        colors: colors,
        labels: labels,
        dataLabels: {
          enabled: true,
          formatter: (val) => {
            return Math.round(val) + "%";
          },
          style: {
            fontSize: "12px",
            fontWeight: "bold",
            colors: [theme.textColor],
          },
          dropShadow: {
            enabled: false,
          },
        },
        legend: {
          position: this.isMobile ? "bottom" : "right",
          offsetY: this.isMobile ? 10 : 0,
          formatter: (seriesName, opts) => {
            const item = this.processedData[opts.seriesIndex];
            if (!item) return seriesName;
            return `${seriesName} (${Math.round(item.percentage)}%)`;
          },
          labels: {
            colors: theme.textColor,
          },
        },
        tooltip: {
          enabled: false, // DISABLE BUILT-IN TOOLTIPS
        },
        plotOptions: {
          pie: {
            expandOnClick: false, // Don't expand on click
            donut: {
              size: "60%",
              background: "transparent",
              labels: {
                show: true,
                name: {
                  show: true,
                  formatter: function (val) {
                    return "Knowledge Areas"; // First line
                  },
                  style: centerLabelStyle,
                },
                value: {
                  show: true,
                  formatter: function (val) {
                    return val; // Show the value
                  },
                  style: centerLabelStyle,
                },
                total: {
                  show: true,
                  label: "by Usage", // Second line
                  formatter: function () {
                    return ""; // Use empty formatter to show just the label
                  },
                  style: centerLabelStyle,
                },
              },
            },
            dataLabels: {
              style: {
                colors: [theme.textColor],
              },
              background: {
                enabled: false,
              },
            },
          },
        },
        states: {
          hover: {
            filter: {
              type: "none", // No filter on hover
            },
          },
          active: {
            allowMultipleDataPointsSelection: false,
            filter: {
              type: "none", // No filter on active state
            },
          },
        },
        responsive: [
          {
            breakpoint: 768,
            options: {
              chart: {
                height: 380,
              },
              legend: {
                position: "bottom",
                offsetY: 0,
                height: 100,
              },
            },
          },
        ],
        theme: {
          mode: theme.isDarkMode ? "dark" : "light",
          palette: "palette1",
        },
      };

      // Create or get a custom tooltip element
      this.ensureCustomTooltipExists();

      // Apply fixes after chart renders
      this.$nextTick(() => {
        setTimeout(() => {
          console.log("[DEBUG] Applying direct DOM fixes and custom tooltips");

          // Fix center text color
          const isDark = theme.isDarkMode;
          const centerColor = isDark ? "#FFFFFF" : "#333333";
          const centerLabels = document.querySelectorAll(
            ".apexcharts-datalabels-group text"
          );
          centerLabels.forEach((label) => {
            label.setAttribute("fill", centerColor);
          });

          // Add custom tooltip handlers to chart slices
          this.addTooltipHandlers();
        }, 500); // Longer delay to ensure chart is fully rendered
      });
    },

    /**
     * Create a custom tooltip element if it doesn't exist
     */
    ensureCustomTooltipExists() {
      // Remove any existing tooltip
      const existingTooltip = document.getElementById("chart-custom-tooltip");
      if (existingTooltip) {
        existingTooltip.remove();
      }

      // Create a new tooltip element
      const tooltip = document.createElement("div");
      tooltip.id = "chart-custom-tooltip";
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
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(tooltip);
    },

    /**
     * Truncate text to fit in available space
     */
    truncateText(text, maxLength) {
      if (!text) return "";

      // On mobile, truncate more aggressively
      const limit = this.isMobile ? Math.min(maxLength, 18) : maxLength;
      return text.length > limit ? text.slice(0, limit) + "..." : text;
    },

    /**
     * Add tooltip event handlers to chart slices
     */
    addTooltipHandlers() {
      // Get the tooltip element
      const tooltip = document.getElementById("chart-custom-tooltip");
      if (!tooltip) return;

      // Get all slice elements
      const chartContainer = this.$refs.chart;
      if (!chartContainer) return;

      // All possible selectors for chart slices
      const sliceSelectors = [
        ".apexcharts-pie-area",
        ".apexcharts-slice-0",
        ".apexcharts-slice",
        ".apexcharts-pie .apexcharts-series path",
        ".apexcharts-donut-slice-0",
        ".apexcharts-series path",
      ];

      // Try different selectors until we find slices
      let slices = [];
      for (const selector of sliceSelectors) {
        slices = chartContainer.querySelectorAll(selector);
        if (slices.length > 0) {
          console.log(
            `[DEBUG] Found ${slices.length} slices using selector: ${selector}`
          );
          break;
        }
      }

      // If we still can't find slices, try the document
      if (slices.length === 0) {
        for (const selector of sliceSelectors) {
          slices = document.querySelectorAll(selector);
          if (slices.length > 0) {
            console.log(
              `[DEBUG] Found ${slices.length} slices in document using selector: ${selector}`
            );
            break;
          }
        }
      }

      // Apply hover handlers to each slice
      if (slices.length > 0) {
        slices.forEach((slice, index) => {
          // Make sure index is in range
          if (index >= this.processedData.length) return;

          // Set cursor style
          slice.style.cursor = "pointer";

          // Mouse enter handler - show tooltip
          slice.addEventListener("mouseenter", (e) => {
            const item = this.processedData[index];
            if (!item) return;

            // Update tooltip content
            tooltip.innerHTML = `
              <div style="font-weight: bold; margin-bottom: 6px;">${
                item.categoryName
              }</div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Total Queries:</span>
                <span style="font-weight: 500;">${item.count.toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Percentage:</span>
                <span style="font-weight: 500;">${Math.round(
                  item.percentage
                )}%</span>
              </div>
            `;

            // Show tooltip
            tooltip.style.display = "block";

            // Apply active styles to slice (optional)
            slice.setAttribute("data-active", "true");
          });

          // Mouse move handler - position tooltip
          slice.addEventListener("mousemove", (e) => {
            // Position tooltip near cursor but not directly under it
            const offset = 15;
            tooltip.style.left = e.pageX + offset + "px";
            tooltip.style.top = e.pageY + offset + "px";
          });

          // Mouse leave handler - hide tooltip
          slice.addEventListener("mouseleave", () => {
            tooltip.style.display = "none";
            slice.removeAttribute("data-active");
          });
        });

        console.log("[DEBUG] Successfully added tooltip handlers to slices");
      } else {
        console.log("[DEBUG] No slices found to attach tooltips");

        // Last resort: try again after a longer delay
        setTimeout(() => {
          this.addTooltipHandlers();
        }, 1000);
      }
    },
  },
};
</script>

<style scoped>
.chart-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  background-color: transparent;
}

.chart-container {
  width: 100%;
  height: 100%;
  min-height: 400px;
  background-color: transparent;
  border-radius: 4px;
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

/* Mobile-specific styles */
@media (max-width: 767px) {
  .chart-wrapper {
    min-height: 450px;
  }
}

/* Fix for legend text in light mode */
:deep(.apexcharts-legend-text) {
  color: inherit !important;
}

/* Force white text ONLY in dark mode for donut center */
:deep(.dark-theme) .apexcharts-datalabel-label,
:deep([data-theme="dark"]) .apexcharts-datalabel-label,
:deep(.dark-mode) .apexcharts-datalabel-label,
:deep(.dark-theme) .apexcharts-datalabel-value,
:deep([data-theme="dark"]) .apexcharts-datalabel-value,
:deep(.dark-mode) .apexcharts-datalabel-value {
  fill: white !important;
}

/* Force dark text ONLY in light mode for donut center */
:deep([data-theme="light"]) .apexcharts-datalabel-label,
:deep([data-theme="light"]) .apexcharts-datalabel-value {
  fill: #333333 !important;
}

/* System dark mode preference - ONLY apply in dark mode */
@media (prefers-color-scheme: dark) {
  :deep(:not(.light-theme):not([data-theme="light"]))
    .apexcharts-datalabel-label,
  :deep(:not(.light-theme):not([data-theme="light"]))
    .apexcharts-datalabel-value {
    fill: white !important;
  }
}

/* System light mode preference - ONLY apply in light mode */
@media (prefers-color-scheme: light) {
  :deep(:not(.dark-theme):not([data-theme="dark"])) .apexcharts-datalabel-label,
  :deep(:not(.dark-theme):not([data-theme="dark"]))
    .apexcharts-datalabel-value {
    fill: #333333 !important;
  }
}
</style>