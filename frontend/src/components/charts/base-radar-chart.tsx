'use client';

import { useTheme } from '@/contexts/ThemeContext';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { getChartPalette, type ThemeMode } from '@/lib/chart-theme';

// ============================================
// TYPES
// ============================================

export interface RadarDataItem {
  [key: string]: string | number;
}

export interface RadarSeriesConfig {
  dataKey: string;
  name: string;
  color?: string;
  fillOpacity?: number;
  strokeWidth?: number;
}

export interface BaseRadarChartProps {
  data: RadarDataItem[];
  dataKey: string;
  series: RadarSeriesConfig[];
  height?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  domain?: [number, number];
  formatValue?: (value: number) => string;
}

// ============================================
// TOOLTIP COMPONENT
// ============================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  theme: ThemeMode;
  formatValue?: (value: number) => string;
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
      <div className="font-medium mb-2">{label}</div>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span>{entry.name}:</span>
          <span className="font-medium">
            {formatValue ? formatValue(entry.value) : entry.value.toLocaleString('it-IT')}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// BASE RADAR CHART COMPONENT
// ============================================

export function BaseRadarChart({
  data,
  dataKey,
  series,
  height = 300,
  showLegend = true,
  showTooltip = true,
  domain = [0, 100],
  formatValue,
}: BaseRadarChartProps) {
  const { resolvedTheme } = useTheme();
  const theme = (resolvedTheme as ThemeMode) || 'light';
  const palette = getChartPalette(theme);

  const gridColor = theme === 'dark' ? '#334155' : '#E2E8F0';
  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';
  const legendColor = theme === 'dark' ? '#94A3B8' : '#64748B';

  const chartDescription = series.map((s) => s.name).join(', ');

  return (
    <div role="img" aria-label={`Grafico radar: ${chartDescription}`}>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="80%">
          <PolarGrid stroke={gridColor} />
          <PolarAngleAxis dataKey={dataKey} tick={{ fill: axisColor, fontSize: 12 }} />
          <PolarRadiusAxis
            angle={90}
            domain={domain}
            tick={{ fill: axisColor, fontSize: 10 }}
            axisLine={false}
          />
          {series.map((s, index) => (
            <Radar
              key={s.dataKey}
              name={s.name}
              dataKey={s.dataKey}
              stroke={s.color || palette[index % palette.length]}
              fill={s.color || palette[index % palette.length]}
              fillOpacity={s.fillOpacity ?? 0.3}
              strokeWidth={s.strokeWidth ?? 2}
            />
          ))}
          {showTooltip && (
            <Tooltip content={<CustomTooltip theme={theme} formatValue={formatValue} />} />
          )}
          {showLegend && (
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ paddingTop: 20, fontSize: 12 }}
              formatter={(value) => <span style={{ color: legendColor }}>{value}</span>}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
