'use client';

import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================
export type TimeRange = 'today' | '7d' | '30d' | '90d' | 'ytd' | '12m';

export interface TimeRangeOption {
  value: TimeRange;
  label: string;
  shortLabel: string;
}

// ============================================================================
// Constants
// ============================================================================
export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { value: 'today', label: 'Oggi', shortLabel: 'Oggi' },
  { value: '7d', label: 'Ultimi 7 giorni', shortLabel: '7gg' },
  { value: '30d', label: 'Ultimi 30 giorni', shortLabel: '30gg' },
  { value: '90d', label: 'Ultimo trimestre', shortLabel: '90gg' },
  { value: 'ytd', label: 'Da inizio anno', shortLabel: 'YTD' },
  { value: '12m', label: 'Ultimi 12 mesi', shortLabel: '12m' },
];

const STORAGE_KEY = 'heuresys_dashboard_time_range';

// ============================================================================
// Helper: Get initial range from localStorage (client-side only)
// ============================================================================
function getInitialRange(defaultRange: TimeRange): TimeRange {
  if (typeof window === 'undefined') return defaultRange;
  const stored = localStorage.getItem(STORAGE_KEY) as TimeRange | null;
  if (stored && TIME_RANGE_OPTIONS.some((o) => o.value === stored)) {
    return stored;
  }
  return defaultRange;
}

// ============================================================================
// Hook: useTimeRange
// ============================================================================
export function useTimeRange(defaultRange: TimeRange = '30d') {
  const [range, setRange] = useState<TimeRange>(() => getInitialRange(defaultRange));
  const isHydratedRef = useRef(false);

  // Use state for reactivity but initialize from ref
  const [isHydrated, setHydrated] = useState(false);

  // Mark as hydrated on mount - use ref to track and only update once
  useEffect(() => {
    if (!isHydratedRef.current) {
      isHydratedRef.current = true;
      setHydrated(true);
    }
  }, []);

  // Save to localStorage on change
  const updateRange = (newRange: TimeRange) => {
    setRange(newRange);
    localStorage.setItem(STORAGE_KEY, newRange);
  };

  return {
    range,
    setRange: updateRange,
    isHydrated,
    options: TIME_RANGE_OPTIONS,
    currentOption: TIME_RANGE_OPTIONS.find((o) => o.value === range) || TIME_RANGE_OPTIONS[2],
  };
}

// ============================================================================
// Component: TimeRangeSelector
// ============================================================================
interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  className?: string;
  size?: 'sm' | 'default';
}

export function TimeRangeSelector({
  value,
  onChange,
  className,
  size = 'default',
}: TimeRangeSelectorProps) {
  const currentOption = TIME_RANGE_OPTIONS.find((o) => o.value === value) || TIME_RANGE_OPTIONS[2];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className={cn('gap-2 font-normal', size === 'sm' && 'h-8 text-xs', className)}
        >
          <Calendar
            className={cn('text-muted-foreground', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')}
          />
          <span>{currentOption.label}</span>
          <ChevronDown
            className={cn('text-muted-foreground', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {TIME_RANGE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-center justify-between cursor-pointer',
              value === option.value && 'bg-accent'
            )}
          >
            <span>{option.label}</span>
            {value === option.value && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default TimeRangeSelector;
