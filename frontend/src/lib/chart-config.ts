/**
 * Shared chart configuration tokens.
 * Used by all Recharts and ECharts components for consistent styling.
 */

export const CHART_MARGINS = {
  top: 10,
  right: 30,
  left: 10,
  bottom: 10,
} as const;

export const CHART_DEFAULTS = {
  height: 300,
  fontSize: {
    tick: 11,
    legend: 12,
    label: 10,
    referenceLine: 10,
  },
  strokeDasharray: {
    grid: '3 3',
    referenceLine: '5 5',
  },
  legend: {
    paddingTop: 10,
  },
  animation: {
    duration: 800,
  },
} as const;

/**
 * Build axis tick/line props for Recharts.
 * Pass gridColor and axisColor from chart-theme.
 */
export function getAxisProps(axisColor: string, gridColor: string) {
  return {
    tick: { fill: axisColor, fontSize: CHART_DEFAULTS.fontSize.tick },
    tickLine: { stroke: gridColor },
    axisLine: { stroke: gridColor },
  } as const;
}

/**
 * Build tooltip content style for Recharts.
 */
export function getTooltipContentStyle(bgColor: string, borderColor: string) {
  return {
    backgroundColor: bgColor,
    border: `1px solid ${borderColor}`,
    borderRadius: '8px',
    fontSize: CHART_DEFAULTS.fontSize.tick,
  } as const;
}
