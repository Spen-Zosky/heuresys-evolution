'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGovernanceGoals } from '@/lib/hooks/use-governance-queries';
import type { GoalStatus, GoalType } from '@/lib/api/types';

const STATUS_LABELS: Record<GoalStatus, string> = {
  draft: 'Bozza',
  active: 'Attivo',
  completed: 'Completato',
  cancelled: 'Annullato',
  on_hold: 'In pausa',
};

const STATUS_VARIANTS: Record<GoalStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  active: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
  on_hold: 'outline',
};

const TYPE_LABELS: Record<GoalType, string> = {
  individual: 'Individuale',
  team: 'Team',
  department: 'Dipartimento',
  company: 'Azienda',
};

export function GoalTracker() {
  const locale = useLocale();
  const isEn = locale === 'en';
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data, isLoading } = useGovernanceGoals(
    statusFilter !== 'all' || typeFilter !== 'all'
      ? {
          ...(statusFilter !== 'all' ? { status: statusFilter as GoalStatus } : {}),
          ...(typeFilter !== 'all' ? { goal_type: typeFilter as GoalType } : {}),
        }
      : undefined
  );

  const goals = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground mr-auto">{goals.length} goal</p>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {(Object.keys(STATUS_LABELS) as GoalStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {(Object.keys(TYPE_LABELS) as GoalType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nessun goal trovato</div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div key={goal.id} className="border rounded-lg p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{goal.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {goal.employee_name ?? '—'}
                    {goal.due_date && (
                      <>
                        {' '}
                        · {isEn ? 'Due' : 'Scadenza'}{' '}
                        {new Date(goal.due_date).toLocaleDateString(isEn ? 'en-GB' : 'it-IT')}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-xs">
                    {TYPE_LABELS[goal.goal_type]}
                  </Badge>
                  <Badge variant={STATUS_VARIANTS[goal.status]} className="text-xs">
                    {STATUS_LABELS[goal.status]}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{isEn ? 'Progress' : 'Progresso'}</span>
                  <span>{goal.progress_percent ?? 0}%</span>
                </div>
                <Progress value={goal.progress_percent ?? 0} className="h-1.5" />
              </div>

              {goal.parent_goal_title && (
                <p className="text-xs text-muted-foreground">
                  Allineato a: <span className="font-medium">{goal.parent_goal_title}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
