'use client';

import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import ReactECharts from 'echarts-for-react';
import { getChartColors, type ThemeMode } from '@/lib/chart-theme';

// ============================================
// TYPES
// ============================================

export interface GaugeChartProps {
  value: number;
  max?: number;
  min?: number;
  title?: string;
  unit?: string;
  height?: number;
  thresholds?: {
    low: number;
    medium: number;
    high: number;
  };
  colors?: {
    low: string;
    medium: string;
    high: string;
  };
  showPointer?: boolean;
  splitNumber?: number;
}

// ============================================
// GAUGE CHART COMPONENT
// ============================================

export function GaugeChart({
  value,
  max = 100,
  min = 0,
  title,
  unit = '',
  height = 200,
  thresholds = { low: 30, medium: 70, high: 100 },
  colors,
  showPointer = true,
  splitNumber = 5,
}: GaugeChartProps) {
  const { resolvedTheme } = useTheme();
  const theme = (resolvedTheme as ThemeMode) || 'light';
  const chartColors = getChartColors(theme);

  const defaultColors = useMemo(
    () => ({
      low: chartColors.destructive,
      medium: chartColors.warning,
      high: chartColors.success,
    }),
    [chartColors]
  );

  const gaugeColors = colors || defaultColors;

  const axisLineColors = useMemo(() => {
    const range = max - min;
    return [
      [thresholds.low / range, gaugeColors.low],
      [thresholds.medium / range, gaugeColors.medium],
      [thresholds.high / range, gaugeColors.high],
    ] as [number, string][];
  }, [min, max, thresholds, gaugeColors]);

  const textColor = theme === 'dark' ? '#E2E8F0' : '#334155';
  const axisTickColor = theme === 'dark' ? '#475569' : '#CBD5E1';

  const option = useMemo(
    () => ({
      series: [
        {
          type: 'gauge',
          min,
          max,
          splitNumber,
          radius: '90%',
          axisLine: {
            lineStyle: {
              width: 12,
              color: axisLineColors,
            },
          },
          pointer: showPointer
            ? {
                itemStyle: {
                  color: textColor,
                },
                width: 4,
                length: '60%',
              }
            : { show: false },
          axisTick: {
            distance: -12,
            length: 4,
            lineStyle: {
              color: axisTickColor,
              width: 1,
            },
          },
          splitLine: {
            distance: -14,
            length: 8,
            lineStyle: {
              color: axisTickColor,
              width: 2,
            },
          },
          axisLabel: {
            color: textColor,
            distance: 20,
            fontSize: 10,
            formatter: (v: number) => {
              if (v === min || v === max || v === (max + min) / 2) {
                return v.toString();
              }
              return '';
            },
          },
          detail: {
            valueAnimation: true,
            formatter: `{value}${unit}`,
            color: textColor,
            fontSize: 24,
            fontWeight: 'bold',
            offsetCenter: [0, '70%'],
          },
          title: title
            ? {
                show: true,
                offsetCenter: [0, '95%'],
                color: textColor,
                fontSize: 12,
              }
            : { show: false },
          data: [
            {
              value,
              name: title || '',
            },
          ],
        },
      ],
    }),
    [
      min,
      max,
      value,
      title,
      unit,
      splitNumber,
      showPointer,
      axisLineColors,
      textColor,
      axisTickColor,
    ]
  );

  const gaugeDescription = title
    ? `Indicatore ${title}: ${value}${unit}`
    : `Indicatore: ${value}${unit}`;

  return (
    <div role="img" aria-label={gaugeDescription} style={{ minWidth: 100, minHeight: 100 }}>
      <ReactECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}
