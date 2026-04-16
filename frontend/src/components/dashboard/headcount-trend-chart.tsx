'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { TrendPoint } from '@/lib/hooks/use-dashboard';
import { ChartExportButton } from './chart-export';

// Hook for responsive detection
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < breakpoint);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

// ============================================================================
// Types
// ============================================================================
interface HeadcountTrendChartProps {
  data: TrendPoint[] | undefined;
  isLoading?: boolean;
  className?: string;
  onPointClick?: (point: TrendPoint) => void;
}

interface ChartDataPoint {
  date: string;
  month: string;
  value: number;
  formattedDate: string;
}

// ============================================================================
// Custom Tooltip
// ============================================================================
function CustomTooltip({
  active,
  payload,
  label: _label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartDataPoint }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];

  return (
    <div className="bg-popover border shadow-lg rounded-lg p-3 min-w-[140px]">
      <p className="text-sm font-medium text-foreground">{data.payload.formattedDate}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{data.value}</span>
        <span className="text-xs text-muted-foreground">dipendenti</span>
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================
export function HeadcountTrendChart({
  data,
  isLoading: _isLoading,
  className,
  onPointClick,
}: HeadcountTrendChartProps) {
  // Ref for export
  const chartRef = useRef<HTMLDivElement>(null);

  // Responsive detection
  const isMobile = useIsMobile();

  // Transform data for Recharts
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!data || data.length === 0) return [];

    return data.map((point) => {
      const date = new Date(point.date);
      const month = date.toLocaleDateString('it-IT', { month: 'short' });
      const formattedDate = date.toLocaleDateString('it-IT', {
        month: 'long',
        year: 'numeric',
      });

      return {
        date: point.date,
        month: month.charAt(0).toUpperCase() + month.slice(1),
        value: point.value,
        formattedDate,
      };
    });
  }, [data]);

  // Calculate min/max for Y axis with padding
  const { minValue, maxValue } = useMemo(() => {
    if (chartData.length === 0) return { minValue: 0, maxValue: 100 };

    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.ceil((max - min) * 0.1) || 10;

    return {
      minValue: Math.max(0, min - padding),
      maxValue: max + padding,
    };
  }, [chartData]);

  // Handle click on chart area
  const handleClick = (data: unknown) => {
    const chartData = data as { activePayload?: Array<{ payload: ChartDataPoint }> } | null;
    if (onPointClick && chartData?.activePayload?.[0]?.payload) {
      const point = chartData.activePayload[0].payload;
      onPointClick({ date: point.date, value: point.value });
    }
  };

  // Export data
  const exportData = useMemo(
    () => ({
      headers: ['Mese', 'Data', 'Headcount'],
      rows: chartData.map((d) => [d.formattedDate, d.date, d.value]),
      filename: `trend-organico-${new Date().toISOString().split('T')[0]}`,
    }),
    [chartData]
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Trend Organico</CardTitle>
          <CardDescription>Evoluzione headcount ultimi 12 mesi</CardDescription>
        </div>
        {chartData.length > 0 && (
          <ChartExportButton chartRef={chartRef} exportData={exportData} title="Trend Organico" />
        )}
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div ref={chartRef} className="h-[240px] sm:h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={
                  isMobile
                    ? { top: 5, right: 5, left: -25, bottom: 0 }
                    : { top: 10, right: 10, left: -20, bottom: 0 }
                }
                onClick={handleClick}
              >
                <defs>
                  <linearGradient id="headcountGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: isMobile ? 10 : 12, fill: 'var(--muted-foreground)' }}
                  dy={10}
                  interval={isMobile ? 1 : 0}
                />
                <YAxis
                  domain={[minValue, maxValue]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: isMobile ? 10 : 12, fill: 'var(--muted-foreground)' }}
                  tickFormatter={(value) =>
                    isMobile ? `${Math.round(value / 1000)}k` : value.toLocaleString()
                  }
                  width={isMobile ? 35 : 50}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#headcountGradient)"
                  activeDot={{
                    r: isMobile ? 8 : 6, // Larger touch target on mobile
                    fill: 'var(--primary)',
                    stroke: 'var(--background)',
                    strokeWidth: 2,
                    cursor: onPointClick ? 'pointer' : 'default',
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            type="trends"
            title="Dati trend non disponibili"
            description="I dati storici verranno visualizzati dopo alcune settimane di utilizzo."
            size="sm"
          />
        )}
      </CardContent>
    </Card>
  );
}

export default HeadcountTrendChart;
