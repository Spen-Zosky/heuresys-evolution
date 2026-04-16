'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { getChartPalette, type ThemeMode } from '@/lib/chart-theme';

// ============================================
// TYPES
// ============================================

export interface PieDataItem {
  name: string;
  value: number;
  color?: string;
  [key: string]: string | number | undefined;
}

export interface BasePieChartProps {
  data: PieDataItem[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  showLabels?: boolean;
  labelType?: 'name' | 'value' | 'percent' | 'name-percent';
  formatValue?: (value: number) => string;
  centerLabel?: { title: string; value: string | number };
}

// ============================================
// TOOLTIP COMPONENT
// ============================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; payload: PieDataItem }[];
  theme: ThemeMode;
  formatValue?: (value: number) => string;
  total: number;
}

function CustomTooltip({ active, payload, theme, formatValue, total }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  const percent = ((entry.value / total) * 100).toFixed(1);

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
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.payload.color }} />
        <span className="font-medium">{entry.name}</span>
      </div>
      <div className="mt-1 text-sm opacity-80">
        {formatValue ? formatValue(entry.value) : entry.value.toLocaleString('it-IT')} ({percent}%)
      </div>
    </div>
  );
}

// ============================================
// BASE PIE CHART COMPONENT
// ============================================

export function BasePieChart({
  data,
  height = 300,
  innerRadius = 0,
  outerRadius = 80,
  showLegend = true,
  showTooltip = true,
  showLabels = false,
  labelType = 'percent',
  formatValue,
  centerLabel,
}: BasePieChartProps) {
  const { resolvedTheme } = useTheme();
  const theme = (resolvedTheme as ThemeMode) || 'light';
  const palette = getChartPalette(theme);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderLabel = (props: { name?: string; value?: number; percent?: number }): string => {
    const { name = '', value = 0, percent = 0 } = props;
    switch (labelType) {
      case 'name':
        return name;
      case 'value':
        return formatValue ? formatValue(value) : value.toLocaleString('it-IT');
      case 'percent':
        return `${(percent * 100).toFixed(0)}%`;
      case 'name-percent':
        return `${name} ${(percent * 100).toFixed(0)}%`;
      default:
        return `${(percent * 100).toFixed(0)}%`;
    }
  };

  const labelColor = theme === 'dark' ? '#E2E8F0' : '#334155';
  const legendColor = theme === 'dark' ? '#94A3B8' : '#64748B';

  const chartDescription = data
    .map((d) => `${d.name}: ${d.value}`)
    .slice(0, 5)
    .join(', ');

  return (
    <div
      role="img"
      aria-label={`Grafico a torta: ${chartDescription}${data.length > 5 ? '...' : ''}`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={showLabels ? renderLabel : undefined}
            labelLine={showLabels}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || palette[index % palette.length]}
                stroke={theme === 'dark' ? '#1E293B' : '#FFFFFF'}
                strokeWidth={2}
              />
            ))}
          </Pie>
          {showTooltip && (
            <Tooltip
              content={<CustomTooltip theme={theme} formatValue={formatValue} total={total} />}
            />
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
          {centerLabel && innerRadius > 0 && (
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
              <tspan x="50%" dy="-0.5em" fill={legendColor} fontSize={12}>
                {centerLabel.title}
              </tspan>
              <tspan x="50%" dy="1.5em" fill={labelColor} fontSize={20} fontWeight="bold">
                {centerLabel.value}
              </tspan>
            </text>
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
