'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useReviewCycles } from '@/lib/hooks/use-governance-queries';
import type { ReviewCycleStatus } from '@/lib/api/endpoints/governance';

const STATUS_LABELS: Record<ReviewCycleStatus, string> = {
  draft: 'Bozza',
  active: 'Attivo',
  completed: 'Completato',
  archived: 'Archiviato',
};

const STATUS_VARIANTS: Record<
  ReviewCycleStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  draft: 'outline',
  active: 'default',
  completed: 'secondary',
  archived: 'outline',
};

export function ReviewCycleList() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading } = useReviewCycles(
    statusFilter !== 'all' ? { status: statusFilter as ReviewCycleStatus } : undefined
  );

  const cycles = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{cycles.length} cicli trovati</p>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue placeholder="Filtra stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="draft">Bozza</SelectItem>
            <SelectItem value="active">Attivi</SelectItem>
            <SelectItem value="completed">Completati</SelectItem>
            <SelectItem value="archived">Archiviati</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {cycles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nessun ciclo trovato</div>
      ) : (
        <div className="space-y-3">
          {cycles.map((cycle) => {
            const completedCount = cycle.completed_count ?? 0;
            const participantsCount = cycle.participants_count ?? 0;
            const progress =
              participantsCount > 0 ? Math.round((completedCount / participantsCount) * 100) : 0;

            return (
              <div key={cycle.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{cycle.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(cycle.start_date).toLocaleDateString('it-IT')} –{' '}
                      {new Date(cycle.end_date).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANTS[cycle.status]} className="shrink-0">
                    {STATUS_LABELS[cycle.status]}
                  </Badge>
                </div>

                {cycle.current_phase && (
                  <p className="text-xs text-muted-foreground">
                    Fase corrente:{' '}
                    <span className="font-medium capitalize">
                      {cycle.current_phase.replace('_', ' ')}
                    </span>
                  </p>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Progressione ({completedCount}/{participantsCount})
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>

                <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2">
                  <Link href={`/company-pet/governance/performance/cycles/${cycle.id}`}>
                    Dettaglio →
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
