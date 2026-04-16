'use client'

import * as React from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================
export interface ChartTooltipData {
  label: string
  value: number
  total?: number
  previousValue?: number
  formatValue?: (v: number) => string
  unit?: string
}

interface ChartTooltipProps {
  data: ChartTooltipData
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
  delayDuration?: number
}

// ============================================================================
// Component: ChartTooltip
// ============================================================================
export function ChartTooltip({
  data,
  children,
  side = 'top',
  className,
  delayDuration = 100,
}: ChartTooltipProps) {
  const { label, value, total, previousValue, formatValue, unit } = data

  // Calculate percentage of total
  const percentage = total && total > 0 ? (value / total) * 100 : null

  // Calculate trend vs previous
  const trend = React.useMemo(() => {
    if (previousValue === undefined || previousValue === 0) return null
    const change = ((value - previousValue) / previousValue) * 100
    return {
      change: Math.abs(change),
      direction: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'flat',
    }
  }, [value, previousValue])

  // Format the display value
  const displayValue = formatValue ? formatValue(value) : value.toLocaleString()

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          className={cn(
            'bg-popover text-popover-foreground border shadow-lg',
            'px-3 py-2 min-w-[160px]',
            className
          )}
          sideOffset={8}
        >
          <div className="space-y-1.5">
            {/* Label */}
            <div className="font-medium text-sm truncate max-w-[200px]">
              {label}
            </div>

            {/* Value */}
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-lg font-semibold tabular-nums">
                {displayValue}
                {unit && <span className="text-xs font-normal ml-0.5">{unit}</span>}
              </span>

              {/* Percentage badge */}
              {percentage !== null && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {percentage.toFixed(1)}%
                </span>
              )}
            </div>

            {/* Trend indicator */}
            {trend && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs',
                  trend.direction === 'up' && 'text-success',
                  trend.direction === 'down' && 'text-destructive',
                  trend.direction === 'flat' && 'text-muted-foreground'
                )}
              >
                {trend.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                {trend.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                {trend.direction === 'flat' && <Minus className="h-3 w-3" />}
                <span>
                  {trend.direction === 'flat'
                    ? 'Stabile'
                    : `${trend.change.toFixed(1)}% vs precedente`}
                </span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// Component: BarChartTooltip (for bar chart hover states)
// ============================================================================
interface BarChartItem {
  label: string
  value: number
  previousValue?: number
}

interface BarChartTooltipProps {
  items: BarChartItem[]
  children: (props: {
    item: BarChartItem
    index: number
    total: number
    renderWithTooltip: (content: React.ReactNode) => React.ReactNode
  }) => React.ReactNode
}

export function BarChartWithTooltips({ items, children }: BarChartTooltipProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0)

  return (
    <>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {children({
            item,
            index,
            total,
            renderWithTooltip: (content) => (
              <ChartTooltip
                data={{
                  label: item.label,
                  value: item.value,
                  total,
                  previousValue: item.previousValue,
                }}
              >
                {content}
              </ChartTooltip>
            ),
          })}
        </React.Fragment>
      ))}
    </>
  )
}

export default ChartTooltip
