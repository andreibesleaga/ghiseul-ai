/**
 * chartThemeUtils.js - Utility functions for chart theming
 * 
 * This utility can be imported by all chart components to ensure
 * consistent theme handling across the analytics module.
 */

// Import d3 library
import * as d3 from 'd3';

/**
 * Gets theme variables and detects current theme mode
 * @returns {Object} Theme colors and mode information
 */
export function getThemeColors() {
  const computedStyle = getComputedStyle(document.documentElement);
  
  // Extract basic theme colors
  const textColor = computedStyle.getPropertyValue('--text-primary').trim() || '#333333';
  const backgroundColor = computedStyle.getPropertyValue('--bg-card').trim() || '#ffffff';
  const borderColor = computedStyle.getPropertyValue('--border-color').trim() || '#dcdfe4';
  const accentColor = computedStyle.getPropertyValue('--accent-color').trim() || '#4E97D1';
  const gridColor = computedStyle.getPropertyValue('--border-light').trim() || '#e0e0e0';
  const tertiaryBgColor = computedStyle.getPropertyValue('--bg-tertiary').trim() || '#f0f2f5';
  
  // Detect if we're in dark mode by comparing the luminance of background color
  let isDarkMode = false;
  
  // Try to detect from the hex color if available
  if (backgroundColor.match(/#[0-9a-f]{6}/i)) {
    const hexColor = backgroundColor.substring(1);
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    
    // Calculate relative luminance using the formula
    // Luminance = 0.2126*R + 0.7152*G + 0.0722*B
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    
    // If luminance is less than 0.5, we're in dark mode
    isDarkMode = luminance < 0.5;
  } 
  // Fallback method: check if bg-primary contains 'dark'
  else {
    const bgPrimary = computedStyle.getPropertyValue('--bg-primary').trim();
    isDarkMode = bgPrimary.toLowerCase().includes('dark');
  }
  
  // For dark mode, adjust colors for better contrast
  const contrastTextColor = isDarkMode ? '#f0f0f0' : textColor;
  const contrastGridColor = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : gridColor;
  const tooltipBgColor = 'rgba(0, 0, 0, 0.7)'; // Dark tooltip BG for both themes
  const tooltipTextColor = 'white'; // White tooltip text for both themes
  
  // Chart-specific colors with theme awareness
  const chartColors = [
    '#5470c6', '#91cc75', '#fac858', '#ee6666',
    '#73c0de', '#3ba272', '#fc8452', '#9a60b4'
  ];
  
  return {
    textColor: isDarkMode ? '#ffffff' : textColor, // Force white text in dark mode
    backgroundColor,
    borderColor,
    accentColor,
    gridColor: contrastGridColor, // Use contrast grid color for better visibility
    tertiaryBgColor,
    isDarkMode,
    contrastTextColor,
    tooltipBgColor,
    tooltipTextColor,
    chartColors
  };
}

/**
 * getThemeInfo - Improved theme detection that fixes the incorrect dark mode detection
 * 
 * This function properly detects the current theme mode using multiple reliable methods
 * and weighs them correctly to prevent false positives.
 */
export function getThemeInfo() {
  // Multiple methods to detect dark mode with proper priority
  const htmlElement = document.documentElement;
  const bodyElement = document.body;
  
  // Method 1: Check explicit dark mode classes (highest priority)
  const hasDarkClass = 
    htmlElement.classList.contains('dark-theme') || 
    htmlElement.classList.contains('dark-mode') || 
    bodyElement.classList.contains('dark-theme') || 
    bodyElement.classList.contains('dark-mode');
  
  // Method 2: Check data-theme attribute (second priority)
  const hasDataTheme = 
    htmlElement.getAttribute('data-theme') === 'dark' || 
    bodyElement.getAttribute('data-theme') === 'dark';
  
  // Method 3: Check computed background color (if needed)
  let isDarkBg = false;
  
  if (!hasDarkClass && !hasDataTheme) {
    const computedStyle = getComputedStyle(htmlElement);
    const bgColor = computedStyle.backgroundColor;
    
    // Parse RGB values (handles both rgb(x,y,z) and rgba(x,y,z,a) formats)
    const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      
      // Calculate luminance - dark backgrounds have low luminance
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      isDarkBg = luminance < 0.5;
    }
  }
  
  // Method 4: Check prefers-color-scheme media query (lowest priority)
  // Only use this if no other method gives a definitive answer
  let prefersDarkMode = false;
  if (!hasDarkClass && !hasDataTheme && !isDarkBg) {
    prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  
  // Combine detection methods with proper priority
  const isDarkMode = hasDarkClass || hasDataTheme || isDarkBg || prefersDarkMode;
  
  console.log('[DEBUG] Theme detection results:', {
    hasDarkClass,
    hasDataTheme,
    isDarkBg,
    prefersDarkMode,
    finalResult: isDarkMode
  });
  
  // Return theme configuration based on detection
  return {
    isDarkMode,
    textColor: isDarkMode ? '#FFFFFF' : '#333333',
    backgroundColor: 'transparent',
    tooltipBackground: isDarkMode ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)', 
    tooltipTextColor: isDarkMode ? '#FFFFFF' : '#333333',
    theme: isDarkMode ? 'dark' : 'light'
  };
}

/**
 * Applies theme colors to D3 axis elements
 * @param {Object} svg - D3 SVG selection
 * @param {Object} theme - Theme colors object from getThemeColors()
 */
export function applyThemeToAxes(svg, theme) {
  if (!svg || !theme) return;
  
  // Apply theme to all axis domains and tick lines
  svg.selectAll('.domain, .tick line')
    .attr('stroke', theme.borderColor);
  
  // Apply theme to all axis text
  svg.selectAll('.tick text')
    .style('fill', theme.textColor)
    .style('font-weight', theme.isDarkMode ? 'normal' : 'bold');
}

/**
 * Creates a themed tooltip with D3
 * @param {string} containerId - Optional ID for the tooltip
 * @returns {Object} D3 selection of the tooltip
 */
export function createThemedTooltip(containerId = 'chart-tooltip') {
  // Remove any existing tooltip with this ID
  d3.select(`#${containerId}`).remove();
  
  // Create new tooltip
  const tooltip = d3.select('body')
    .append('div')
    .attr('id', containerId)
    .attr('class', 'd3-tooltip')
    .style('position', 'absolute')
    .style('background', 'rgba(0, 0, 0, 0.7)')
    .style('color', 'white')
    .style('padding', '8px')
    .style('border-radius', '4px')
    .style('font-size', '12px')
    .style('pointer-events', 'none')
    .style('opacity', 0)
    .style('z-index', 1000)
    .style('box-shadow', '0 3px 14px rgba(0,0,0,0.4)');
  
  return tooltip;
}

/**
 * Creates a theme-aware background for charts
 * @param {Object} svg - D3 SVG selection
 * @param {number} width - Width of the background
 * @param {number} height - Height of the background
 * @param {Object} theme - Theme colors object from getThemeColors()
 * @param {number} cornerRadius - Optional corner radius, default 5
 */
export function createChartBackground(svg, width, height, theme, cornerRadius = 5) {
  if (!svg || !theme) return;
  
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', theme.backgroundColor)
    .attr('rx', cornerRadius)
    .attr('ry', cornerRadius);
}

/**
 * Creates a gradient definition for bar charts that works in both light and dark themes
 * @param {Object} defs - D3 defs selection
 * @param {string} id - ID for the gradient
 * @param {Object} theme - Theme colors object from getThemeColors()
 * @returns {string} The gradient ID to use in fill attributes
 */
export function createBarGradient(defs, id, theme) {
  if (!defs || !theme) return `#${id}`;
  
  const gradient = defs.append('linearGradient')
    .attr('id', id)
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  
  if (theme.isDarkMode) {
    // Darker gradient for dark mode
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#4a8bbf');
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#2d6fa7');
  } else {
    // Lighter gradient for light mode
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#62d9a6');
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#2da676');
  }
  
  return `url(#${id})`;
}

/**
 * Creates a grid with theme-appropriate colors
 * @param {Object} svg - D3 SVG selection
 * @param {Object} x - D3 x scale
 * @param {Object} y - D3 y scale
 * @param {number} width - Width of the grid
 * @param {number} height - Height of the grid
 * @param {Object} theme - Theme colors object from getThemeColors()
 * @param {boolean} horizontal - Whether to add horizontal grid lines
 * @param {boolean} vertical - Whether to add vertical grid lines
 */
export function createThemedGrid(svg, x, y, width, height, theme, horizontal = true, vertical = false) {
  if (!svg || !theme) return;
  
  // Add horizontal grid lines
  if (horizontal) {
    svg.append('g')
      .attr('class', 'grid horizontal-grid')
      .call(
        d3.axisLeft(y)
          .tickSize(-width)
          .tickFormat('')
      )
      .selectAll('line')
      .attr('stroke', theme.gridColor)
      .attr('stroke-opacity', 0.5)
      .attr('stroke-dasharray', theme.isDarkMode ? '3,3' : 'none');
  }
  
  // Add vertical grid lines
  if (vertical) {
    svg.append('g')
      .attr('class', 'grid vertical-grid')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(x)
          .tickSize(-height)
          .tickFormat('')
      )
      .selectAll('line')
      .attr('stroke', theme.gridColor)
      .attr('stroke-opacity', 0.5)
      .attr('stroke-dasharray', theme.isDarkMode ? '3,3' : 'none');
  }
  
  // Remove all grid lines' domain paths (the outer box)
  svg.selectAll('.grid .domain')
    .attr('stroke', 'none');
}

/**
 * Creates a theme-aware legend
 * @param {Object} svg - D3 SVG selection
 * @param {Array} items - Array of legend items {name, color}
 * @param {Object} options - Configuration options
 * @param {Object} theme - Theme colors object from getThemeColors()
 */
export function createThemedLegend(svg, items, options, theme) {
  if (!svg || !items || !theme) return;
  
  const {
    x = 0,
    y = 0,
    orientation = 'horizontal', // or 'vertical'
    itemSpacing = 20,
    symbolSize = 10,
    fontSize = 12,
    title = ''
  } = options || {};
  
  const legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${x}, ${y})`);
  
  // Add title if provided
  if (title) {
    legend.append('text')
      .attr('class', 'legend-title')
      .attr('x', 0)
      .attr('y', -5)
      .attr('font-size', fontSize + 2)
      .attr('font-weight', 'bold')
      .attr('fill', theme.textColor)
      .text(title);
  }
  
  // Add items
  const legendItems = legend.selectAll('.legend-item')
    .data(items)
    .enter()
    .append('g')
    .attr('class', 'legend-item')
    .attr('transform', (d, i) => {
      if (orientation === 'horizontal') {
        return `translate(${i * itemSpacing}, 0)`;
      } else {
        return `translate(0, ${i * itemSpacing})`;
      }
    });
  
  // Add symbols
  legendItems.append('rect')
    .attr('width', symbolSize)
    .attr('height', symbolSize)
    .attr('fill', d => d.color);
  
  // Add text
  legendItems.append('text')
    .attr('x', symbolSize + 5)
    .attr('y', symbolSize / 2)
    .attr('dy', '0.35em')
    .attr('font-size', fontSize)
    .attr('fill', theme.textColor)
    .text(d => d.name);
  
  return legend;
}

/**
 * Checks if a D3 tooltip exists and creates one if not
 * @param {string} tooltipClass - CSS class for the tooltip
 * @returns {Object} D3 selection of the tooltip
 */
export function ensureTooltipExists(tooltipClass = 'd3-tooltip') {
  let tooltip = d3.select(`body > .${tooltipClass}`);
  
  if (tooltip.empty()) {
    tooltip = d3.select('body')
      .append('div')
      .attr('class', tooltipClass)
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.7)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);
  }
  
  return tooltip;
}

/**
 * Cleans up D3 tooltips to prevent duplicates
 * @param {string} tooltipClass - CSS class for the tooltip
 */
export function cleanupTooltips(tooltipClass = 'd3-tooltip') {
  d3.selectAll(`.${tooltipClass}`).remove();
}

/**
 * Creates themed text for charts
 * @param {Object} svg - D3 SVG selection
 * @param {string} text - Text content
 * @param {Object} options - Configuration options
 * @param {Object} theme - Theme colors object from getThemeColors()
 */
export function createThemedText(svg, text, options, theme) {
  if (!svg || !text || !theme) return;
  
  const {
    x = 0,
    y = 0,
    fontSize = 12,
    fontWeight = 'normal',
    textAnchor = 'start',
    className = ''
  } = options || {};
  
  return svg.append('text')
    .attr('class', className)
    .attr('x', x)
    .attr('y', y)
    .attr('text-anchor', textAnchor)
    .attr('font-size', fontSize)
    .attr('font-weight', fontWeight)
    .attr('fill', theme.textColor)
    .text(text);
}