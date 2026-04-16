/**
 * Chart Components Export
 *
 * Centralized export for all chart components.
 * All components are theme-aware (light/dark mode).
 *
 * ECharts-based components (GaugeChart, HeatmapChart) are dynamically imported
 * to avoid loading the heavy echarts bundle on initial page load.
 */

import dynamic from 'next/dynamic';

// Base Recharts components (lighter weight — static imports)
export { BaseLineChart, type BaseLineChartProps, type LineConfig } from './base-line-chart';
export { BaseBarChart, type BaseBarChartProps, type BarConfig } from './base-bar-chart';
export { BasePieChart, type BasePieChartProps, type PieDataItem } from './base-pie-chart';
export {
  BaseRadarChart,
  type BaseRadarChartProps,
  type RadarSeriesConfig,
  type RadarDataItem,
} from './base-radar-chart';

// ECharts components — dynamically imported (heavy bundle, not needed for SSR)
export const GaugeChart = dynamic(
  () => import('./gauge-chart').then((mod) => ({ default: mod.GaugeChart })),
  { ssr: false }
);

export const HeatmapChart = dynamic(
  () => import('./heatmap-chart').then((mod) => ({ default: mod.HeatmapChart })),
  { ssr: false }
);

// Re-export types for ECharts components
export type { GaugeChartProps } from './gauge-chart';
export type { HeatmapChartProps, HeatmapDataPoint } from './heatmap-chart';

// React Flow components
export { OrgChart } from './org-chart';
