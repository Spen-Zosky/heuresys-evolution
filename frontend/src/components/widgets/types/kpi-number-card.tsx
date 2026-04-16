'use client';

import { useWidgetData } from '@/lib/hooks/use-workspace';
import WidgetWrapper from '../widget-wrapper';
import { Users, Briefcase, TrendingUp, Heart, AlertCircle, type LucideIcon } from 'lucide-react';

interface KpiNumberData {
  label: string;
  value: number | string | null;
  sublabel?: string | null;
  icon?: string | null;
  trend?: 'up' | 'down' | 'flat' | null;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Users,
  Briefcase,
  TrendingUp,
  Heart,
};

function pickIcon(name: string | null | undefined): LucideIcon {
  if (!name) return TrendingUp;
  return ICON_MAP[name] ?? TrendingUp;
}

function formatNumber(value: number | string | null): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (Number.isInteger(value)) return new Intl.NumberFormat('it-IT').format(value);
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Generic KPI number card. Shape-compatible with any resolver that returns
 * { label, value, sublabel?, icon?, trend? }. Used by headcount_kpi,
 * open_positions_kpi, engagement_score, and performance_scores. The visual
 * is intentionally minimal (single number + sublabel) — drill-down is left
 * to dedicated pages reachable from the widget header.
 */
export default function KpiNumberCard({ code }: { code: string }) {
  const { data, loading, error } = useWidgetData<KpiNumberData>(code);
  const Icon = pickIcon(data?.icon);

  return (
    <WidgetWrapper title={data?.label || code} icon={Icon}>
      <div className="flex flex-col items-start justify-center h-full px-1 py-2 gap-1">
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded bg-muted" />
        ) : error ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : (
          <>
            <div className="text-3xl font-semibold tabular-nums leading-none">
              {formatNumber(data?.value ?? null)}
            </div>
            {data?.sublabel && (
              <div className="text-[11px] text-muted-foreground mt-1">{data.sublabel}</div>
            )}
          </>
        )}
      </div>
    </WidgetWrapper>
  );
}
