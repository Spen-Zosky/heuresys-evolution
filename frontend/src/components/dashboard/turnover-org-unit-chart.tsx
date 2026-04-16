'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
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
interface DepartmentTurnover {
  department: string;
  turnover_rate: number;
  headcount: number;
  terminations?: number;
}

interface TurnoverDepartmentChartProps {
  data: DepartmentTurnover[] | undefined;
  isLoading?: boolean;
  className?: string;
  onBarClick?: (department: DepartmentTurnover) => void;
}

interface ChartDataPoint {
  name: string;
  fullName: string;
  rate: number;
  headcount: number;
  terminations: number;
  color: string;
}

// ============================================================================
// Helpers
// ============================================================================
function getColorForRate(rate: number): string {
  if (rate <= 5) return 'var(--success)';
  if (rate <= 10) return 'var(--warning)';
  return 'var(--destructive)';
}

function truncateName(name: string, maxLength: number = 16): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 1) + '…';
}

// ============================================================================
// Custom Tooltip
// ============================================================================
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartDataPoint }>;
}) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-popover border shadow-lg rounded-lg p-3 min-w-[180px]">
      <p className="text-sm font-medium text-foreground mb-2">{data.fullName}</p>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Turnover Rate</span>
          <span className="text-sm font-semibold" style={{ color: data.color }}>
            {data.rate.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Organico</span>
          <span className="text-sm font-medium">{data.headcount}</span>
        </div>
        {data.terminations > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Uscite</span>
            <span className="text-sm font-medium text-destructive">{data.terminations}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================
export function TurnoverDepartmentChart({
  data,
  isLoading: _isLoading,
  className,
  onBarClick,
}: TurnoverDepartmentChartProps) {
  // Ref for export
  const chartRef = useRef<HTMLDivElement>(null);

  // Responsive detection
  const isMobile = useIsMobile();

  // Transform and sort data
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!data || data.length === 0) return [];

    return data
      .map((dept) => ({
        name: truncateName(dept.department),
        fullName: dept.department,
        rate: Number(dept.turnover_rate) || 0,
        headcount: Number(dept.headcount) || 0,
        terminations: dept.terminations || 0,
        color: getColorForRate(Number(dept.turnover_rate) || 0),
      }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 8); // Top 8 departments
  }, [data]);

  // Calculate max for Y axis
  const maxRate = useMemo(() => {
    if (chartData.length === 0) return 20;
    const max = Math.max(...chartData.map((d) => d.rate));
    return Math.ceil(max * 1.2); // 20% padding
  }, [chartData]);

  // Handle bar click
  const handleClick = (data: unknown) => {
    if (onBarClick) {
      const chartPoint = data as ChartDataPoint;
      onBarClick({
        department: chartPoint.fullName,
        turnover_rate: chartPoint.rate,
        headcount: chartPoint.headcount,
        terminations: chartPoint.terminations,
      });
    }
  };

  // Export data
  const exportData = useMemo(
    () => ({
      headers: ['Dipartimento', 'Turnover Rate %', 'Organico', 'Uscite'],
      rows: chartData.map((d) => [d.fullName, d.rate.toFixed(1), d.headcount, d.terminations]),
      filename: `turnover-dipartimento-${new Date().toISOString().split('T')[0]}`,
    }),
    [chartData]
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Turnover per Dipartimento</CardTitle>
          <CardDescription>Tasso di abbandono per area aziendale</CardDescription>
        </div>
        {chartData.length > 0 && (
          <ChartExportButton
            chartRef={chartRef}
            exportData={exportData}
            title="Turnover per Dipartimento"
          />
        )}
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div ref={chartRef} className="h-[240px] sm:h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={isMobile ? chartData.slice(0, 6) : chartData} // Show fewer bars on mobile
                layout="vertical"
                margin={
                  isMobile
                    ? { top: 5, right: 10, left: 0, bottom: 5 }
                    : { top: 5, right: 20, left: 0, bottom: 5 }
                }
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={true}
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  type="number"
                  domain={[0, maxRate]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: isMobile ? 9 : 11, fill: 'var(--muted-foreground)' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: isMobile ? 9 : 11, fill: 'var(--muted-foreground)' }}
                  width={isMobile ? 85 : 110}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'color-mix(in oklch, var(--muted), transparent 70%)' }}
                />
                <Bar
                  dataKey="rate"
                  radius={[0, 4, 4, 0]}
                  cursor={onBarClick ? 'pointer' : 'default'}
                  onClick={(data) => handleClick(data)}
                  barSize={isMobile ? 16 : undefined} // Larger touch targets on mobile
                >
                  {(isMobile ? chartData.slice(0, 6) : chartData).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            type="analytics"
            title="Dati turnover non disponibili"
            description="I dati di turnover per dipartimento non sono ancora stati calcolati."
            size="sm"
          />
        )}

        {/* Legend - responsive wrap on mobile */}
        {chartData.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mt-3 sm:mt-4 pt-2 sm:pt-3 border-t">
            <div className="flex items-center gap-1">
              <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-sm bg-success" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">≤5%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-sm bg-warning" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">5-10%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-sm bg-destructive" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">&gt;10%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TurnoverDepartmentChart;
