'use client';

import * as React from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

interface KPICardProps {
  /** KPI title/label */
  title: string;
  /** Current value (will be animated) */
  value: number;
  /** Format function for value display */
  formatValue?: (value: number) => string;
  /** Previous period value for comparison */
  previousValue?: number;
  /** Percentage change (calculated if previousValue provided) */
  change?: number;
  /** Trend direction */
  trend?: 'up' | 'down' | 'flat';
  /** Whether up trend is positive (default true) */
  upIsGood?: boolean;
  /** Period label (e.g., "vs last month") */
  periodLabel?: string;
  /** Sparkline data points */
  sparklineData?: number[];
  /** Optional icon */
  icon?: LucideIcon;
  /** Additional className */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Loading state */
  loading?: boolean;
}

/**
 * Animated Counter Component
 */
function AnimatedCounter({
  value,
  formatValue = (v) => v.toLocaleString(),
  className,
}: {
  value: number;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const count = useMotionValue(0);
  const _rounded = useTransform(count, (latest) => formatValue(Math.round(latest)));
  const [displayValue, setDisplayValue] = React.useState(formatValue(0));

  React.useEffect(() => {
    const controls = animate(count, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        setDisplayValue(formatValue(Math.round(latest)));
      },
    });
    return controls.stop;
  }, [value, count, formatValue]);

  return (
    <motion.span className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {displayValue}
    </motion.span>
  );
}

/**
 * Sparkline Component - Mini line chart
 */
function Sparkline({
  data,
  width = 100,
  height = 32,
  className,
  trend,
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  trend?: 'up' | 'down' | 'flat';
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Normalize data to 0-1 range with padding
  const padding = 2;
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;
  const stepX = chartWidth / (data.length - 1);

  const points = data
    .map((value, index) => {
      const x = padding + index * stepX;
      const y = height - padding - ((value - min) / range) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  // Create gradient path for fill
  const fillPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  // Determine color based on trend
  const strokeColor =
    trend === 'up' ? 'var(--success)' : trend === 'down' ? 'var(--destructive)' : 'var(--primary)';

  return (
    <svg
      width={width}
      height={height}
      className={cn('overflow-visible', className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Gradient fill */}
      <defs>
        <linearGradient id={`sparkline-gradient-${trend}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Fill area */}
      <motion.polygon
        points={fillPoints}
        fill={`url(#sparkline-gradient-${trend})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      />

      {/* Line */}
      <motion.polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* End dot */}
      <motion.circle
        cx={width - padding}
        cy={height - padding - ((data[data.length - 1] - min) / range) * chartHeight}
        r="3"
        fill={strokeColor}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      />
    </svg>
  );
}

/**
 * KPI Card - Dashboard metric card with sparkline
 */
export function KPICard({
  title,
  value,
  formatValue = (v) => v.toLocaleString(),
  previousValue,
  change: providedChange,
  trend: providedTrend,
  upIsGood = true,
  periodLabel = 'vs last period',
  sparklineData,
  icon: Icon,
  className,
  size = 'md',
  loading = false,
}: KPICardProps) {
  // Calculate change if not provided
  const change =
    providedChange ??
    (previousValue !== undefined ? ((value - previousValue) / previousValue) * 100 : undefined);

  // Determine trend if not provided
  const trend =
    providedTrend ??
    (change !== undefined ? (change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'flat') : 'flat');

  // Determine if trend is positive or negative
  const isPositive = trend === 'up' ? upIsGood : trend === 'down' ? !upIsGood : true;

  const sizeClasses = {
    sm: {
      card: 'p-4',
      title: 'text-xs',
      value: 'text-2xl',
      change: 'text-xs',
      sparkline: { width: 80, height: 24 },
    },
    md: {
      card: 'p-5',
      title: 'text-sm',
      value: 'text-3xl',
      change: 'text-sm',
      sparkline: { width: 100, height: 32 },
    },
    lg: {
      card: 'p-6',
      title: 'text-base',
      value: 'text-4xl',
      change: 'text-base',
      sparkline: { width: 120, height: 40 },
    },
  };

  const sizes = sizeClasses[size];

  if (loading) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardContent className={sizes.card}>
          <div className="space-y-3">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className={cn('overflow-hidden hover:shadow-lift transition-shadow', className)}>
        <CardContent className={sizes.card}>
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              {/* Title */}
              <div className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                <p className={cn('font-medium text-muted-foreground', sizes.title)}>{title}</p>
              </div>

              {/* Value with animation */}
              <div className="flex items-baseline gap-3">
                <AnimatedCounter
                  value={value}
                  formatValue={formatValue}
                  className={cn(
                    'font-semibold tracking-tight tabular-nums text-foreground',
                    sizes.value
                  )}
                />
              </div>

              {/* Change indicator */}
              {change !== undefined && (
                <div className="flex items-center gap-1.5 mt-1">
                  {trend === 'up' && (
                    <TrendingUp
                      className={cn(
                        'h-3.5 w-3.5',
                        isPositive ? 'text-success' : 'text-destructive'
                      )}
                    />
                  )}
                  {trend === 'down' && (
                    <TrendingDown
                      className={cn(
                        'h-3.5 w-3.5',
                        isPositive ? 'text-success' : 'text-destructive'
                      )}
                    />
                  )}
                  {trend === 'flat' && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span
                    className={cn(
                      'font-medium tabular-nums',
                      sizes.change,
                      isPositive
                        ? 'text-success'
                        : trend === 'flat'
                          ? 'text-muted-foreground'
                          : 'text-destructive'
                    )}
                  >
                    {change > 0 ? '+' : ''}
                    {change.toFixed(1)}%
                  </span>
                  <span className={cn('text-muted-foreground', sizes.change)}>{periodLabel}</span>
                </div>
              )}
            </div>

            {/* Sparkline */}
            {sparklineData && sparklineData.length > 1 && (
              <div className="flex-shrink-0 ml-4">
                <Sparkline
                  data={sparklineData}
                  width={sizes.sparkline.width}
                  height={sizes.sparkline.height}
                  trend={trend}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * KPI Grid - Container for multiple KPI cards
 */
export function KPIGrid({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const columnClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <motion.div
      className={cn('grid gap-4', columnClasses[columns], className)}
      initial="initial"
      animate="animate"
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: 0.05,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export default KPICard;
