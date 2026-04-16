/**
 * Chart Theme Utilities
 *
 * Provides theme-aware color palettes and configurations for Nivo charts.
 * Automatically adapts to light/dark mode.
 */

export type ThemeMode = 'light' | 'dark'

// Heuresys brand colors for charts - light mode
export const lightModeChartColors = {
  primary: '#2563EB',     // Blue 600
  secondary: '#0077B6',   // Corporate blue
  success: '#22C55E',     // Green 500
  warning: '#F59E0B',     // Amber 500
  destructive: '#EF4444', // Red 500
  purple: '#8B5CF6',      // Purple 500
  teal: '#14B8A6',        // Teal 500
  pink: '#EC4899',        // Pink 500
  orange: '#F97316',      // Orange 500
  indigo: '#6366F1',      // Indigo 500
}

// Heuresys brand colors for charts - dark mode (lighter versions)
export const darkModeChartColors = {
  primary: '#60A5FA',     // Blue 400
  secondary: '#38BDF8',   // Sky 400
  success: '#4ADE80',     // Green 400
  warning: '#FBBF24',     // Amber 400
  destructive: '#F87171', // Red 400
  purple: '#A78BFA',      // Purple 400
  teal: '#2DD4BF',        // Teal 400
  pink: '#F472B6',        // Pink 400
  orange: '#FB923C',      // Orange 400
  indigo: '#818CF8',      // Indigo 400
}

// Chart color palettes (ordered arrays)
export const lightModePalette = [
  lightModeChartColors.primary,
  lightModeChartColors.success,
  lightModeChartColors.warning,
  lightModeChartColors.purple,
  lightModeChartColors.destructive,
  lightModeChartColors.teal,
  lightModeChartColors.pink,
  lightModeChartColors.orange,
  lightModeChartColors.indigo,
  lightModeChartColors.secondary,
]

export const darkModePalette = [
  darkModeChartColors.primary,
  darkModeChartColors.success,
  darkModeChartColors.warning,
  darkModeChartColors.purple,
  darkModeChartColors.destructive,
  darkModeChartColors.teal,
  darkModeChartColors.pink,
  darkModeChartColors.orange,
  darkModeChartColors.indigo,
  darkModeChartColors.secondary,
]

// Get chart colors based on theme
export function getChartColors(theme: ThemeMode) {
  return theme === 'dark' ? darkModeChartColors : lightModeChartColors
}

// Get chart palette based on theme
export function getChartPalette(theme: ThemeMode) {
  return theme === 'dark' ? darkModePalette : lightModePalette
}

// Nivo theme configuration for light mode
export const lightModeNivoTheme = {
  text: {
    fontSize: 11,
    fontFamily: 'inherit',
    fill: '#334155', // Slate 700
  },
  axis: {
    ticks: {
      text: {
        fontSize: 10,
        fill: '#64748B', // Slate 500
      },
      line: {
        stroke: '#CBD5E1', // Slate 300
        strokeWidth: 1,
      },
    },
    legend: {
      text: {
        fontSize: 11,
        fill: '#475569', // Slate 600
        fontWeight: 500,
      },
    },
    domain: {
      line: {
        stroke: '#CBD5E1', // Slate 300
        strokeWidth: 1,
      },
    },
  },
  grid: {
    line: {
      stroke: '#E2E8F0', // Slate 200
      strokeWidth: 1,
    },
  },
  legends: {
    text: {
      fontSize: 11,
      fill: '#475569', // Slate 600
    },
  },
  tooltip: {
    container: {
      background: '#FFFFFF',
      color: '#1E293B', // Slate 800
      fontSize: 12,
      borderRadius: 6,
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    },
  },
  crosshair: {
    line: {
      stroke: '#2563EB',
      strokeWidth: 1,
      strokeOpacity: 0.5,
    },
  },
}

// Nivo theme configuration for dark mode
export const darkModeNivoTheme = {
  text: {
    fontSize: 11,
    fontFamily: 'inherit',
    fill: '#E2E8F0', // Slate 200
  },
  axis: {
    ticks: {
      text: {
        fontSize: 10,
        fill: '#94A3B8', // Slate 400
      },
      line: {
        stroke: '#475569', // Slate 600
        strokeWidth: 1,
      },
    },
    legend: {
      text: {
        fontSize: 11,
        fill: '#CBD5E1', // Slate 300
        fontWeight: 500,
      },
    },
    domain: {
      line: {
        stroke: '#475569', // Slate 600
        strokeWidth: 1,
      },
    },
  },
  grid: {
    line: {
      stroke: '#334155', // Slate 700
      strokeWidth: 1,
    },
  },
  legends: {
    text: {
      fontSize: 11,
      fill: '#CBD5E1', // Slate 300
    },
  },
  tooltip: {
    container: {
      background: '#1E293B', // Slate 800
      color: '#F1F5F9', // Slate 100
      fontSize: 12,
      borderRadius: 6,
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.2)',
    },
  },
  crosshair: {
    line: {
      stroke: '#60A5FA', // Blue 400
      strokeWidth: 1,
      strokeOpacity: 0.5,
    },
  },
}

// Get Nivo theme based on theme mode
export function getNivoTheme(theme: ThemeMode) {
  return theme === 'dark' ? darkModeNivoTheme : lightModeNivoTheme
}

// Label text color for chart bars/segments
export function getLabelTextColor(theme: ThemeMode) {
  return theme === 'dark' ? '#1E293B' : '#FFFFFF'
}

// McKinsey-style performance colors (theme-aware)
export function getPerformanceColors(theme: ThemeMode) {
  const colors = getChartColors(theme)
  return {
    exceptional: colors.primary,
    exceeds: colors.secondary,
    meets: colors.success,
    developing: colors.warning,
    below: colors.destructive,
  }
}

// Status indicator colors (theme-aware)
export function getStatusColors(theme: ThemeMode) {
  const colors = getChartColors(theme)
  return {
    active: colors.success,
    pending: colors.warning,
    completed: colors.primary,
    cancelled: colors.destructive,
    draft: theme === 'dark' ? '#6B7280' : '#9CA3AF',
  }
}

// HR metrics colors (theme-aware)
export function getHRMetricsColors(theme: ThemeMode) {
  const colors = getChartColors(theme)
  return {
    headcount: colors.primary,
    hires: colors.success,
    attrition: colors.destructive,
    retention: colors.teal,
    engagement: colors.purple,
  }
}
