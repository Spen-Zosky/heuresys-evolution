'use client';

import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import ReactECharts from 'echarts-for-react';
import { getChartColors, type ThemeMode } from '@/lib/chart-theme';

// ============================================
// TYPES
// ============================================

export interface HeatmapDataPoint {
  x: string | number;
  y: string | number;
  value: number;
}

export interface HeatmapChartProps {
  data: HeatmapDataPoint[];
  xCategories: string[];
  yCategories: string[];
  height?: number;
  min?: number;
  max?: number;
  colorRange?: [string, string, string];
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  formatValue?: (value: number) => string;
}

// ============================================
// HEATMAP CHART COMPONENT
// ============================================

export function HeatmapChart({
  data,
  xCategories,
  yCategories,
  height = 300,
  min,
  max,
  colorRange,
  title,
  xAxisLabel,
  yAxisLabel,
  formatValue,
}: HeatmapChartProps) {
  const { resolvedTheme } = useTheme();
  const theme = (resolvedTheme as ThemeMode) || 'light';
  const colors = getChartColors(theme);

  const textColor = theme === 'dark' ? '#E2E8F0' : '#334155';
  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';
  const bgColor = theme === 'dark' ? '#1E293B' : '#FFFFFF';

  const defaultColorRange = useMemo(
    () =>
      theme === 'dark'
        ? ['#1E293B', colors.warning, colors.destructive]
        : ['#F1F5F9', colors.warning, colors.destructive],
    [theme, colors]
  );

  const actualColorRange = colorRange || defaultColorRange;

  // Calculate min/max from data if not provided
  const values = data.map((d) => d.value);
  const actualMin = min ?? Math.min(...values);
  const actualMax = max ?? Math.max(...values);

  // Convert data to ECharts format
  const chartData = useMemo(
    () =>
      data.map((d) => {
        const xIndex = xCategories.indexOf(String(d.x));
        const yIndex = yCategories.indexOf(String(d.y));
        return [xIndex, yIndex, d.value];
      }),
    [data, xCategories, yCategories]
  );

  const option = useMemo(
    () => ({
      title: title
        ? {
            text: title,
            left: 'center',
            textStyle: {
              color: textColor,
              fontSize: 14,
            },
          }
        : undefined,
      tooltip: {
        position: 'top',
        backgroundColor: bgColor,
        borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
        textStyle: {
          color: textColor,
        },
        formatter: (params: { value: [number, number, number] }) => {
          const xLabel = xCategories[params.value[0]];
          const yLabel = yCategories[params.value[1]];
          const value = params.value[2];
          const formattedValue = formatValue ? formatValue(value) : value.toLocaleString('it-IT');
          return `${yLabel} - ${xLabel}<br/><strong>${formattedValue}</strong>`;
        },
      },
      grid: {
        top: title ? 60 : 30,
        bottom: xAxisLabel ? 60 : 40,
        left: yAxisLabel ? 80 : 60,
        right: 60,
      },
      xAxis: {
        type: 'category',
        data: xCategories,
        splitArea: {
          show: true,
        },
        axisLabel: {
          color: axisColor,
          fontSize: 10,
          rotate: xCategories.length > 7 ? 45 : 0,
        },
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? '#475569' : '#CBD5E1',
          },
        },
        name: xAxisLabel,
        nameLocation: 'middle',
        nameGap: xCategories.length > 7 ? 50 : 30,
        nameTextStyle: {
          color: axisColor,
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'category',
        data: yCategories,
        splitArea: {
          show: true,
        },
        axisLabel: {
          color: axisColor,
          fontSize: 10,
        },
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? '#475569' : '#CBD5E1',
          },
        },
        name: yAxisLabel,
        nameLocation: 'middle',
        nameGap: 50,
        nameTextStyle: {
          color: axisColor,
          fontSize: 11,
        },
      },
      visualMap: {
        min: actualMin,
        max: actualMax,
        calculable: true,
        orient: 'vertical',
        right: 10,
        top: 'center',
        inRange: {
          color: actualColorRange,
        },
        textStyle: {
          color: axisColor,
          fontSize: 10,
        },
      },
      series: [
        {
          name: title || 'Heatmap',
          type: 'heatmap',
          data: chartData,
          label: {
            show: xCategories.length <= 12 && yCategories.length <= 10,
            color: textColor,
            fontSize: 9,
            formatter: (params: { value: [number, number, number] }) => {
              const value = params.value[2];
              return formatValue ? formatValue(value) : value.toLocaleString('it-IT');
            },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
            },
          },
        },
      ],
    }),
    [
      title,
      textColor,
      bgColor,
      theme,
      xCategories,
      yCategories,
      xAxisLabel,
      yAxisLabel,
      axisColor,
      actualMin,
      actualMax,
      actualColorRange,
      chartData,
      formatValue,
    ]
  );

  const heatmapDescription = title
    ? `Heatmap: ${title}`
    : `Heatmap con ${xCategories.length} colonne e ${yCategories.length} righe`;

  return (
    <div role="img" aria-label={heatmapDescription}>
      <ReactECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}
