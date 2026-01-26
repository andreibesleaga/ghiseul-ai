<!-- UsageTrendChart.vue - Updated Version with Translation Support -->
<template>
  <div class="usage-trend-chart">
    <div class="chart-header">
      <h3>{{ $t('analytics.usageTrends') }}</h3>
      <div class="chart-controls">
        <select v-model="selectedPeriod" class="period-selector">
          <option value="week">{{ $t('analytics.week') }}</option>
          <option value="month">{{ $t('analytics.month') }}</option>
          <option value="quarter">{{ $t('analytics.quarter') }}</option>
          <option value="year">{{ $t('analytics.year') }}</option>
        </select>
      </div>
    </div>
    
    <div class="chart-container">
      <div ref="chartContainer" style="width: 100%; height: 100%;"></div>
      <div v-if="loading" class="chart-loading">
        {{ $t('analytics.loading') }}
      </div>
    </div>
    
    <div class="chart-metrics">
      <div class="metric-card">
        <div class="metric-value">{{ totalQueries.toLocaleString() }}</div>
        <div class="metric-label">{{ $t('analytics.totalQueries') }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">{{ uniqueUsers.toLocaleString() }}</div>
        <div class="metric-label">{{ $t('analytics.uniqueUsers') }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">{{ averageResponseTime.toFixed(1) }}s</div>
        <div class="metric-label">{{ $t('analytics.avgResponseTime') }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">{{ (satisfactionRate * 100).toFixed(1) }}%</div>
        <div class="metric-label">{{ $t('analytics.satisfactionRate') }}</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'UsageTrendChart',
  
  data() {
    return {
      selectedPeriod: 'month',
      loading: true,
      totalQueries: 12847,
      uniqueUsers: 3294,
      averageResponseTime: 2.7,
      satisfactionRate: 0.91,
      chart: null,
      
      // Sample chart data (will be translated)
      chartData: {
        week: [],
        month: [],
        quarter: [],
        year: []
      },
      
      // Original data for each language
      chartDataByLanguage: {
        en: {
          week: [
            { date: '2025-03-01', queries: 420, users: 180 },
            { date: '2025-03-02', queries: 380, users: 150 },
            { date: '2025-03-03', queries: 510, users: 210 },
            { date: '2025-03-04', queries: 530, users: 240 },
            { date: '2025-03-05', queries: 590, users: 280 },
            { date: '2025-03-06', queries: 480, users: 220 },
            { date: '2025-03-07', queries: 390, users: 170 }
          ],
          month: [
            { date: '2025-02-07', queries: 1800, users: 820 },
            { date: '2025-02-14', queries: 2100, users: 950 },
            { date: '2025-02-21', queries: 1950, users: 880 },
            { date: '2025-02-28', queries: 2400, users: 1100 },
            { date: '2025-03-07', queries: 2700, users: 1250 }
          ],
          quarter: [
            { date: '2024-12', queries: 8200, users: 3800 },
            { date: '2025-01', queries: 9500, users: 4200 },
            { date: '2025-02', queries: 11200, users: 4700 },
            { date: '2025-03', queries: 12800, users: 5300 }
          ],
          year: [
            { date: '2024-04', queries: 5200, users: 2100 },
            { date: '2024-07', queries: 6500, users: 2800 },
            { date: '2024-10', queries: 7800, users: 3400 },
            { date: '2025-01', queries: 9500, users: 4200 },
            { date: '2025-04', queries: 12800, users: 5300 }
          ]
        },
        fr: {
          week: [
            { date: '01/03/2025', queries: 420, users: 180 },
            { date: '02/03/2025', queries: 380, users: 150 },
            { date: '03/03/2025', queries: 510, users: 210 },
            { date: '04/03/2025', queries: 530, users: 240 },
            { date: '05/03/2025', queries: 590, users: 280 },
            { date: '06/03/2025', queries: 480, users: 220 },
            { date: '07/03/2025', queries: 390, users: 170 }
          ],
          month: [
            { date: '07/02/2025', queries: 1800, users: 820 },
            { date: '14/02/2025', queries: 2100, users: 950 },
            { date: '21/02/2025', queries: 1950, users: 880 },
            { date: '28/02/2025', queries: 2400, users: 1100 },
            { date: '07/03/2025', queries: 2700, users: 1250 }
          ],
          quarter: [
            { date: 'Déc 2024', queries: 8200, users: 3800 },
            { date: 'Jan 2025', queries: 9500, users: 4200 },
            { date: 'Fév 2025', queries: 11200, users: 4700 },
            { date: 'Mar 2025', queries: 12800, users: 5300 }
          ],
          year: [
            { date: 'Avr 2024', queries: 5200, users: 2100 },
            { date: 'Juil 2024', queries: 6500, users: 2800 },
            { date: 'Oct 2024', queries: 7800, users: 3400 },
            { date: 'Jan 2025', queries: 9500, users: 4200 },
            { date: 'Avr 2025', queries: 12800, users: 5300 }
          ]
        },
        sw: {
          week: [
            { date: '01/03/2025', queries: 420, users: 180 },
            { date: '02/03/2025', queries: 380, users: 150 },
            { date: '03/03/2025', queries: 510, users: 210 },
            { date: '04/03/2025', queries: 530, users: 240 },
            { date: '05/03/2025', queries: 590, users: 280 },
            { date: '06/03/2025', queries: 480, users: 220 },
            { date: '07/03/2025', queries: 390, users: 170 }
          ],
          month: [
            { date: '07/02/2025', queries: 1800, users: 820 },
            { date: '14/02/2025', queries: 2100, users: 950 },
            { date: '21/02/2025', queries: 1950, users: 880 },
            { date: '28/02/2025', queries: 2400, users: 1100 },
            { date: '07/03/2025', queries: 2700, users: 1250 }
          ],
          quarter: [
            { date: 'Des 2024', queries: 8200, users: 3800 },
            { date: 'Jan 2025', queries: 9500, users: 4200 },
            { date: 'Feb 2025', queries: 11200, users: 4700 },
            { date: 'Mar 2025', queries: 12800, users: 5300 }
          ],
          year: [
            { date: 'Apr 2024', queries: 5200, users: 2100 },
            { date: 'Jul 2024', queries: 6500, users: 2800 },
            { date: 'Okt 2024', queries: 7800, users: 3400 },
            { date: 'Jan 2025', queries: 9500, users: 4200 },
            { date: 'Apr 2025', queries: 12800, users: 5300 }
          ]
        }
      }
    };
  },

  created() {
    this.updateTranslations();
  },
  
  watch: {
    selectedPeriod: function(newPeriod) {
      this.renderChart();
    }
  },
  
  mounted() {
    this.initChart();
    window.addEventListener('resize', this.handleResize);
  },
  
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
    this.disposeChart();
  },
  
  methods: {
    updateTranslations() {
      // Get the current locale or default to English
      const locale = this.$i18n.locale || 'en';
      
      // Get the data for the current locale or default to English
      const localeData = this.chartDataByLanguage[locale] || this.chartDataByLanguage['en'];
      
      // Update the chart data
      this.chartData = {
        week: localeData.week,
        month: localeData.month,
        quarter: localeData.quarter,
        year: localeData.year
      };
      
      // If chart is already initialized, re-render it
      if (this.chart) {
        this.renderChart();
      }
    },
    
    async initChart() {
      try {
        // Import echarts library
        const echarts = await import('echarts');
        
        // Render initial chart
        this.renderChart(echarts);
      } catch (error) {
        console.error('Failed to load chart library:', error);
      }
    },
    
    async renderChart(echartLib = null) {
      if (!this.$refs.chartContainer) return;
      
      this.loading = true;
      
      // Use a timeout to ensure UI updates before chart rendering
      setTimeout(async () => {
        try {
          // Dispose of old chart properly before creating a new one
          this.disposeChart();
          
          // Load echarts library if not provided
          const echarts = echartLib || await import('echarts');
          
          // Create new chart instance
          this.chart = echarts.init(this.$refs.chartContainer);
          
          // Get data for the selected period
          const data = this.chartData[this.selectedPeriod];
          
          // Set chart options
          const option = {
            tooltip: {
              trigger: 'axis',
              axisPointer: {
                type: 'shadow'
              }
            },
            legend: {
              data: [this.$t('analytics.totalQueries'), this.$t('analytics.uniqueUsers')],
              bottom: 0
            },
            grid: {
              left: '3%',
              right: '4%',
              bottom: '10%',
              top: '3%',
              containLabel: true
            },
            xAxis: {
              type: 'category',
              data: data.map(item => item.date),
              axisTick: {
                alignWithLabel: true
              }
            },
            yAxis: {
              type: 'value'
            },
            series: [
              {
                name: this.$t('analytics.totalQueries'),
                type: 'line',
                smooth: true,
                lineStyle: {
                  width: 3,
                  shadowColor: 'rgba(0,0,0,0.2)',
                  shadowBlur: 10,
                  shadowOffsetY: 10
                },
                symbol: 'circle',
                symbolSize: 8,
                data: data.map(item => item.queries),
                itemStyle: {
                  color: '#4e97d1'
                },
                areaStyle: {
                  color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: 'rgba(78, 151, 209, 0.5)' },
                      { offset: 1, color: 'rgba(78, 151, 209, 0.05)' }
                    ]
                  }
                }
              },
              {
                name: this.$t('analytics.uniqueUsers'),
                type: 'bar',
                barWidth: '40%',
                data: data.map(item => item.users),
                itemStyle: {
                  color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: '#84d9d2' },
                      { offset: 1, color: '#07cdae' }
                    ]
                  },
                  borderRadius: [4, 4, 0, 0]
                }
              }
            ]
          };
          
          // Apply the chart configuration
          this.chart.setOption(option);
          
          // Update metrics based on period
          this.totalQueries = data.reduce((sum, item) => sum + item.queries, 0);
          this.uniqueUsers = Math.round(data.reduce((sum, item) => sum + item.users, 0) * 0.85); // Accounting for returning users
          
          switch (this.selectedPeriod) {
            case 'week':
              this.averageResponseTime = 2.1;
              this.satisfactionRate = 0.94;
              break;
            case 'month':
              this.averageResponseTime = 2.7;
              this.satisfactionRate = 0.91;
              break;
            case 'quarter':
              this.averageResponseTime = 3.2;
              this.satisfactionRate = 0.88;
              break;
            case 'year':
              this.averageResponseTime = 3.5;
              this.satisfactionRate = 0.85;
              break;
          }
          
          // End loading state
          this.loading = false;
        } catch (error) {
          console.error('Error rendering chart:', error);
          this.loading = false;
        }
      }, 100);
    },
    
    disposeChart() {
      if (this.chart) {
        try {
          this.chart.dispose();
        } catch (e) {
          console.warn('Error while disposing chart:', e);
        }
        this.chart = null;
      }
    },
    
    handleResize() {
      if (this.chart) {
        try {
          this.chart.resize();
        } catch (e) {
          console.warn('Error resizing chart:', e);
          // If resize fails, try re-rendering
          this.renderChart();
        }
      }
    }
  }
}
</script>

<style scoped>
.usage-trend-chart {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  padding: 16px;
  margin-bottom: 20px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.chart-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: #333;
}

.period-selector {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  background: #f5f5f5;
  cursor: pointer;
}

.chart-container {
  width: 100%;
  height: 320px;
  position: relative;
}

.chart-loading {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  font-size: 1rem;
  color: #666;
}

.chart-metrics {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-top: 16px;
}

.metric-card {
  background: #f9f9f9;
  border-radius: 6px;
  padding: 12px;
  flex: 1;
  min-width: 120px;
  margin: 8px;
  text-align: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.metric-value {
  font-size: 1.6rem;
  font-weight: 600;
  color: #4e97d1;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 0.85rem;
  color: #666;
}

@media (max-width: 768px) {
  .chart-metrics {
    flex-direction: column;
  }
  
  .metric-card {
    margin: 4px 0;
  }
}
</style>
