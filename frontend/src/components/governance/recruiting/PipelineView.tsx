'use client';

import { Clock, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCandidates } from '@/lib/hooks/use-governance-queries';
import type { Candidate, CandidateStage } from '@/lib/api/endpoints/governance';

interface PipelineColumn {
  stage: CandidateStage;
  label: string;
  colorClass: string;
  headerClass: string;
}

const COLUMNS: PipelineColumn[] = [
  {
    stage: 'new',
    label: 'Applied',
    colorClass: 'bg-slate-50 border-slate-200',
    headerClass: 'bg-slate-100 text-slate-700',
  },
  {
    stage: 'screening',
    label: 'Screening',
    colorClass: 'bg-blue-50 border-blue-200',
    headerClass: 'bg-blue-100 text-blue-700',
  },
  {
    stage: 'interview',
    label: 'Interview',
    colorClass: 'bg-violet-50 border-violet-200',
    headerClass: 'bg-violet-100 text-violet-700',
  },
  {
    stage: 'offer',
    label: 'Offer',
    colorClass: 'bg-amber-50 border-amber-200',
    headerClass: 'bg-amber-100 text-amber-700',
  },
  {
    stage: 'hired',
    label: 'Hired',
    colorClass: 'bg-green-50 border-green-200',
    headerClass: 'bg-green-100 text-green-700',
  },
];

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const days = daysSince(candidate.created_at);
  const name = `${candidate.first_name} ${candidate.last_name}`;
  const daysAlert = days > 14;

  return (
    <div className="rounded-md border bg-white p-3 shadow-sm space-y-1.5 text-sm">
      <p className="font-medium leading-tight truncate" title={name}>
        {name}
      </p>
      {candidate.job_title && (
        <p className="text-xs text-muted-foreground truncate">{candidate.job_title}</p>
      )}
      {candidate.current_company && (
        <p className="text-xs text-muted-foreground truncate">{candidate.current_company}</p>
      )}
      <div className="flex items-center justify-between pt-1">
        <span
          className={`flex items-center gap-1 text-xs ${daysAlert ? 'text-amber-600' : 'text-muted-foreground'}`}
        >
          <Clock className="h-3 w-3" />
          {days}g
        </span>
        {candidate.rating != null && candidate.rating > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-amber-500">
            <Star className="h-3 w-3 fill-current" />
            {candidate.rating}
          </span>
        )}
        {candidate.source && (
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            {candidate.source}
          </Badge>
        )}
      </div>
    </div>
  );
}

function ColumnSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-md border bg-white p-3 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function PipelineView() {
  const { data: allCandidates, isLoading } = useCandidates({ limit: 200 });

  const byStage = new Map<CandidateStage, Candidate[]>();
  for (const col of COLUMNS) byStage.set(col.stage, []);

  if (allCandidates?.items) {
    for (const c of allCandidates.items) {
      const list = byStage.get(c.stage);
      if (list) list.push(c);
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-[900px]">
        {COLUMNS.map((col) => {
          const candidates = byStage.get(col.stage) ?? [];
          return (
            <div
              key={col.stage}
              className={`flex-1 min-w-[160px] rounded-lg border ${col.colorClass}`}
            >
              <div
                className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${col.headerClass}`}
              >
                <span className="text-xs font-semibold uppercase tracking-wide">{col.label}</span>
                <Badge variant="secondary" className="bg-white/70 text-current text-xs">
                  {isLoading ? '—' : candidates.length}
                </Badge>
              </div>
              <div className="p-2 space-y-2 min-h-[120px]">
                {isLoading ? (
                  <ColumnSkeleton />
                ) : candidates.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center pt-4">Nessun candidato</p>
                ) : (
                  candidates.map((c) => <CandidateCard key={c.id} candidate={c} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
