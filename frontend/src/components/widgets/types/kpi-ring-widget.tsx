'use client';

import { useEffect, useRef, useState } from 'react';
import { useWidgetData } from '@/lib/hooks/use-workspace';
import WidgetWrapper from '../widget-wrapper';
import { BookOpen, AlertCircle, Inbox, RefreshCw } from 'lucide-react';

// ============================================
// Types
// ============================================

interface KpiRingData {
  percentage: number;
  completed: number;
  total: number;
}

// ============================================
// Constants
// ============================================

const RADIUS = 40;
const CENTER = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~251.33

// ============================================
// Sub-components
// ============================================

function Skeleton() {
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="h-[84px] w-[84px] animate-pulse rounded-full bg-muted" />
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-4">
      <Inbox size={28} className="text-muted-foreground/40" />
      <span className="text-xs text-muted-foreground">Nessun dato formativo</span>
    </div>
  );
}

function useCountUp(target: number, duration: number = 1500): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }

    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration]);

  return value;
}

// ============================================
// Component
// ============================================

export default function KpiRingWidget({ code }: { code: string }) {
  const { data, loading, error, refetch } = useWidgetData<KpiRingData>(code);
  const percentage = data?.percentage ?? 0;
  const displayNum = useCountUp(loading ? 0 : percentage);

  const offset = CIRCUMFERENCE - (CIRCUMFERENCE * percentage) / 100;

  return (
    <WidgetWrapper title="Learning" icon={BookOpen}>
      {loading && <Skeleton />}

      {error && !loading && (
        <div className="flex flex-col items-center gap-2 py-4">
          <AlertCircle size={22} className="text-destructive" />
          <span className="text-xs text-destructive">{error}</span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/80"
          >
            <RefreshCw size={12} /> Riprova
          </button>
        </div>
      )}

      {!loading && !error && !data && <EmptyState />}

      {!loading && !error && data && (
        <div className="flex flex-col items-center gap-2">
          {/* SVG Ring */}
          <div className="relative" style={{ width: 84, height: 84 }}>
            <svg
              viewBox={`0 0 ${CENTER * 2} ${CENTER * 2}`}
              width={84}
              height={84}
              style={{ transform: 'rotate(-90deg)' }}
            >
              <defs>
                <linearGradient id="kpi-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="oklch(0.72 0.19 145)" />
                  <stop offset="100%" stopColor="oklch(0.638 0.2 310)" />
                </linearGradient>
              </defs>

              {/* Background circle */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth={4}
              />

              {/* Progress circle */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke="url(#kpi-ring-grad)"
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={offset}
                style={{
                  transition: 'stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </svg>

            {/* Center number */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: 'rotate(0deg)' }}
            >
              <span
                className="text-[28px] font-[800] text-green-500"
                style={{ fontFamily: 'var(--font-exo2, Exo 2, sans-serif)' }}
              >
                {displayNum}
                <span className="text-[14px] font-[600]">%</span>
              </span>
            </div>
          </div>

          {/* Label */}
          <span className="text-[12px] text-muted-foreground">Piano formativo</span>

          {/* Trend badge */}
          <span className="badge-shimmer inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-[11px] font-medium text-green-500">
            +{Math.max(1, Math.round(percentage * 0.15))}% vs Q4
          </span>
        </div>
      )}
    </WidgetWrapper>
  );
}
