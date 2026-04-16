'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { CHART_MARGINS, CHART_DEFAULTS, getAxisProps } from '@/lib/chart-config';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { getChartPalette, getChartColors, type ThemeMode } from '@/lib/chart-theme';

// ============================================
// TYPES
// ============================================

export interface LineConfig {
  dataKey: string;
  name: string;
  color?: string;
  strokeWidth?: number;
  dot?: boolean;
  dashed?: boolean;
  areaFill?: boolean;
}

export interface BaseLineChartProps<T extends Record<string, unknown>> {
  data: T[];
  lines: LineConfig[];
  xAxisKey: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  referenceLines?: { value: number; label: string; color?: string }[];
  formatXAxis?: (value: string | number) => string;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number, name: string) => string;
}

// ============================================
// TOOLTIP COMPONENT
// ============================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string; dataKey: string }[];
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
// BASE LINE CHART COMPONENT
// ============================================

export function BaseLineChart<T extends Record<string, unknown>>({
  data,
  lines,
  xAxisKey,
  xAxisLabel,
  yAxisLabel,
  height = 300,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  referenceLines,
  formatXAxis,
  formatYAxis,
  formatTooltip,
}: BaseLineChartProps<T>) {
  const { resolvedTheme } = useTheme();
  const theme = (resolvedTheme as ThemeMode) || 'light';
  const palette = getChartPalette(theme);
  const colors = getChartColors(theme);

  const gridColor = theme === 'dark' ? '#334155' : '#E2E8F0';
  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';

  // Determine if any line has area fill
  const hasAreaFill = lines.some((l) => l.areaFill);
  const ChartComponent = hasAreaFill ? ComposedChart : LineChart;

  const chartDescription = lines.map((l) => l.name).join(', ');

  return (
    <div role="img" aria-label={`Grafico lineare: ${chartDescription}`}>
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={data} margin={CHART_MARGINS}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray={CHART_DEFAULTS.strokeDasharray.grid}
              stroke={gridColor}
            />
          )}
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
          {showTooltip && (
            <Tooltip content={<CustomTooltip theme={theme} formatValue={formatTooltip} />} />
          )}
          {showLegend && (
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
              y={ref.value}
              stroke={ref.color || colors.warning}
              strokeDasharray={CHART_DEFAULTS.strokeDasharray.referenceLine}
              label={{
                value: ref.label,
                fill: axisColor,
                fontSize: CHART_DEFAULTS.fontSize.referenceLine,
                position: 'right',
              }}
            />
          ))}
          {lines.map((line, index) => {
            const lineColor = line.color || palette[index % palette.length];

            if (line.areaFill) {
              return (
                <Area
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  name={line.name}
                  stroke={lineColor}
                  fill={lineColor}
                  fillOpacity={0.2}
                  strokeWidth={line.strokeWidth || 2}
                  dot={line.dot !== false ? { r: 3 } : false}
                  activeDot={{ r: 5 }}
                />
              );
            }

            return (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={lineColor}
                strokeWidth={line.strokeWidth || 2}
                strokeDasharray={line.dashed ? '5 5' : undefined}
                dot={line.dot !== false ? { r: 3 } : false}
                activeDot={{ r: 5 }}
              />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
