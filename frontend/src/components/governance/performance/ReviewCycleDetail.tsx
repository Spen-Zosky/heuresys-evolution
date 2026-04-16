'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { useReviewCycleDetail } from '@/lib/hooks/use-governance-queries';
import type { ReviewCyclePhase, ParticipantStatus } from '@/lib/api/endpoints/governance';

const PHASE_LABELS: Record<ReviewCyclePhase, string> = {
  self_review: 'Auto-valutazione',
  manager_review: 'Valutazione manager',
  calibration: 'Calibrazione',
  results: 'Risultati',
};

const PARTICIPANT_STATUS_CONFIG: Record<
  ParticipantStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  pending: { label: 'In attesa', variant: 'outline' },
  submitted: { label: 'Inviato', variant: 'default' },
  calibrated: { label: 'Calibrato', variant: 'secondary' },
  completed: { label: 'Completato', variant: 'default' },
};

interface ReviewCycleDetailProps {
  cycleId: string;
}

export function ReviewCycleDetail({ cycleId }: ReviewCycleDetailProps) {
  const { data: cycle, isLoading } = useReviewCycleDetail(cycleId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!cycle) {
    return <p className="text-sm text-muted-foreground">Ciclo non trovato.</p>;
  }

  const participants = cycle.participants ?? [];
  const phases = cycle.phases ?? [];
  const completedCount = participants.filter((p) => p.status === 'completed').length;
  const progress =
    participants.length > 0 ? Math.round((completedCount / participants.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">{cycle.name}</h2>
          <Badge>{cycle.status}</Badge>
        </div>
        {cycle.description && (
          <p className="text-sm text-muted-foreground mt-1">{cycle.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(cycle.start_date).toLocaleDateString('it-IT')} –{' '}
          {new Date(cycle.end_date).toLocaleDateString('it-IT')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Fasi */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Timeline fasi</CardTitle>
          </CardHeader>
          <CardContent>
            {phases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna fase configurata</p>
            ) : (
              <ol className="space-y-3">
                {phases.map((phase) => (
                  <li key={phase.id} className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {phase.is_current ? (
                        <Clock className="h-4 w-4 text-primary" />
                      ) : phase.order_index <
                        (cycle.phases?.findIndex((p) => p.is_current) ?? 999) ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-sm font-medium ${phase.is_current ? 'text-primary' : ''}`}
                      >
                        {PHASE_LABELS[phase.phase_type] ?? phase.phase_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(phase.start_date).toLocaleDateString('it-IT')} –{' '}
                        {new Date(phase.end_date).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Progresso partecipanti */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Completati</span>
                <span className="font-medium">
                  {completedCount}/{participants.length}
                </span>
              </div>
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground text-right">{progress}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabella partecipanti */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Partecipanti ({participants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun partecipante</p>
          ) : (
            <div className="divide-y">
              {participants.map((p) => {
                const cfg = PARTICIPANT_STATUS_CONFIG[p.status];
                return (
                  <div key={p.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{p.employee_name ?? p.employee_id}</p>
                      {p.reviewer_name && (
                        <p className="text-xs text-muted-foreground">Reviewer: {p.reviewer_name}</p>
                      )}
                    </div>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
