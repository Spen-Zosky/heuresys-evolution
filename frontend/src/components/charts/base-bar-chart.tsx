'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { CHART_MARGINS, CHART_DEFAULTS, getAxisProps } from '@/lib/chart-config';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { getChartPalette, getChartColors, type ThemeMode } from '@/lib/chart-theme';

// ============================================
// TYPES
// ============================================

export interface BarConfig {
  dataKey: string;
  name: string;
  color?: string;
  stackId?: string;
  radius?: [number, number, number, number];
}

export interface BaseBarChartProps<T extends Record<string, unknown>> {
  data: T[];
  bars: BarConfig[];
  xAxisKey: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  height?: number;
  layout?: 'horizontal' | 'vertical';
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  barSize?: number;
  referenceLines?: { value: number; label: string; color?: string }[];
  formatXAxis?: (value: string | number) => string;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number, name: string) => string;
  colorByValue?: (value: T) => string;
}

// ============================================
// TOOLTIP COMPONENT
// ============================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  theme: ThemeMode;
  formatValue?: (value: number, name: string) => string;
}

function CustomTooltip({ active, payload, label, theme, formatValue }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const bgColor = theme === 'dark' ? '#1E293B' : '#FFFFFF';
  const textColor = theme === 'dark' ? '#F1F5F9' : '#1E293B';
  const borderColor = theme === 'dark' ? '#334155' : '#E2E8F0';

  return (
    <div
      className="rounded-lg border shadow-lg p-3"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        borderColor,
      }}
    >
      <p className="text-sm font-medium mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="opacity-80">{entry.name}:</span>
          <span className="font-medium">
            {formatValue
              ? formatValue(entry.value, entry.name)
              : entry.value.toLocaleString('it-IT')}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// BASE BAR CHART COMPONENT
// ============================================

export function BaseBarChart<T extends Record<string, unknown>>({
  data,
  bars,
  xAxisKey,
  xAxisLabel,
  yAxisLabel,
  height = 300,
  layout = 'horizontal',
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  barSize,
  referenceLines,
  formatXAxis,
  formatYAxis,
  formatTooltip,
  colorByValue,
}: BaseBarChartProps<T>) {
  const { resolvedTheme } = useTheme();
  const theme = (resolvedTheme as ThemeMode) || 'light';
  const palette = getChartPalette(theme);
  const colors = getChartColors(theme);

  const gridColor = theme === 'dark' ? '#334155' : '#E2E8F0';
  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';

  const isVertical = layout === 'vertical';

  const chartDescription = bars.map((b) => b.name).join(', ');

  return (
    <div role="img" aria-label={`Grafico a barre: ${chartDescription}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={layout} margin={CHART_MARGINS}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray={CHART_DEFAULTS.strokeDasharray.grid}
              stroke={gridColor}
            />
          )}
          {isVertical ? (
            <>
              <XAxis
                type="number"
                {...getAxisProps(axisColor, gridColor)}
                tickFormatter={formatYAxis || ((v) => v.toLocaleString('it-IT'))}
                label={
                  yAxisLabel
                    ? {
                        value: yAxisLabel,
                        position: 'bottom',
                        fill: axisColor,
                        fontSize: CHART_DEFAULTS.fontSize.tick,
                      }
                    : undefined
                }
              />
              <YAxis
                dataKey={xAxisKey}
                type="category"
                {...getAxisProps(axisColor, gridColor)}
                tickFormatter={formatXAxis}
                width={100}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xAxisKey}
                {...getAxisProps(axisColor, gridColor)}
                tickFormatter={formatXAxis}
                label={
                  xAxisLabel
                    ? {
                        value: xAxisLabel,
                        position: 'bottom',
                        fill: axisColor,
                        fontSize: CHART_DEFAULTS.fontSize.tick,
                      }
                    : undefined
                }
              />
              <YAxis
                {...getAxisProps(axisColor, gridColor)}
                tickFormatter={formatYAxis || ((v) => v.toLocaleString('it-IT'))}
                label={
                  yAxisLabel
                    ? {
                        value: yAxisLabel,
                        angle: -90,
                        position: 'insideLeft',
                        fill: axisColor,
                        fontSize: CHART_DEFAULTS.fontSize.tick,
                      }
                    : undefined
                }
              />
            </>
          )}
          {showTooltip && (
            <Tooltip content={<CustomTooltip theme={theme} formatValue={formatTooltip} />} />
          )}
          {showLegend && bars.length > 1 && (
            <Legend
              wrapperStyle={{
                paddingTop: CHART_DEFAULTS.legend.paddingTop,
                fontSize: CHART_DEFAULTS.fontSize.legend,
              }}
              formatter={(value) => <span style={{ color: axisColor }}>{value}</span>}
            />
          )}
          {referenceLines?.map((ref, index) => (
            <ReferenceLine
              key={index}
              x={isVertical ? ref.value : undefined}
              y={!isVertical ? ref.value : undefined}
              stroke={ref.color || colors.warning}
              strokeDasharray={CHART_DEFAULTS.strokeDasharray.referenceLine}
              label={{
                value: ref.label,
                fill: axisColor,
                fontSize: CHART_DEFAULTS.fontSize.referenceLine,
                position: isVertical ? 'top' : 'right',
              }}
            />
          ))}
          {bars.map((bar, index) => {
            const barColor = bar.color || palette[index % palette.length];

            return (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                name={bar.name}
                fill={barColor}
                stackId={bar.stackId}
                barSize={barSize}
                radius={bar.radius || [4, 4, 0, 0]}
              >
                {colorByValue &&
                  data.map((entry, idx) => <Cell key={`cell-${idx}`} fill={colorByValue(entry)} />)}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
