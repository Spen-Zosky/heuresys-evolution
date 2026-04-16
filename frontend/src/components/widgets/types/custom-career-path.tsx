'use client';

import { useWidgetData } from '@/lib/hooks/use-workspace';
import WidgetWrapper from '../widget-wrapper';
import { Activity, AlertCircle, Inbox, RefreshCw } from 'lucide-react';

// ============================================
// Types
// ============================================

interface CareerPathData {
  current_role: string;
  target_role?: string;
  gap_count?: number;
  gap_skills?: string;
}

// ============================================
// Sub-components
// ============================================

function Skeleton() {
  return (
    <div className="flex items-center gap-2 py-4">
      <div className="h-10 w-24 animate-pulse rounded-lg bg-muted" />
      <div className="h-0.5 w-12 animate-pulse bg-muted" />
      <div className="h-10 w-24 animate-pulse rounded-lg bg-muted" />
      <div className="h-0.5 w-12 animate-pulse bg-muted" />
      <div className="h-10 w-24 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-4">
      <Inbox size={28} className="text-muted-foreground/40" />
      <span className="text-xs text-muted-foreground">Percorso non configurato</span>
    </div>
  );
}

interface NodeProps {
  label: string;
  variant: 'current' | 'next' | 'future';
}

function CareerNode({ label, variant }: NodeProps) {
  const styles = {
    current: 'bg-primary/10 border-primary/25 text-primary border-solid',
    next: 'bg-purple-400/8 border-purple-400/25 text-purple-400 border-dashed',
    future: 'bg-amber-400/6 border-amber-400/20 text-amber-400 border-dashed',
  };

  return (
    <div
      className={`flex-shrink-0 rounded-lg border px-3 py-2 text-center text-[12px] font-medium ${styles[variant]}`}
      style={{ fontFamily: 'var(--font-sora, Sora, sans-serif)' }}
    >
      {label}
    </div>
  );
}

function Beam() {
  return <div className="career-beam h-[2px] w-12 flex-shrink-0 bg-border" />;
}

// ============================================
// Component
// ============================================

export default function CustomCareerPath({ code }: { code: string }) {
  const { data, loading, error, refetch } = useWidgetData<CareerPathData>(code);

  const hasPath = data && data.current_role;

  return (
    <WidgetWrapper title="Career Path" icon={Activity}>
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

      {!loading && !error && !hasPath && <EmptyState />}

      {!loading && !error && hasPath && (
        <div className="flex flex-col gap-3">
          {/* Career nodes with beams */}
          <div className="flex items-center gap-0 overflow-x-auto">
            <CareerNode label={data.current_role} variant="current" />
            <Beam />
            <CareerNode label={data.target_role || 'Next Role'} variant="next" />
            <Beam />
            <CareerNode label="Future" variant="future" />
          </div>

          {/* Gap info */}
          {(data.gap_count != null || data.gap_skills) && (
            <p className="text-[11px] text-muted-foreground">
              {data.gap_count != null && (
                <span className="font-medium text-foreground">{data.gap_count} skill gap</span>
              )}
              {data.gap_count != null && data.gap_skills && ' da colmare'}
              {data.gap_skills && <span> &middot; {data.gap_skills}</span>}
            </p>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}
