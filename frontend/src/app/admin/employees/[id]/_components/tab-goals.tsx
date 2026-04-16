'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Skeleton } from '@/components/ui/skeleton';
import { Target, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { useStatusConfig } from '@/lib/hooks/use-entity-config';

interface TabProps {
  employeeId: string;
}

// goalTypeColors are type-based, not status-based — kept local
const goalTypeColors: Record<string, string> = {
  individual: 'bg-indigo-100 text-indigo-800',
  team: 'bg-purple-100 text-purple-800',
  department: 'bg-teal-100 text-teal-800',
  company: 'bg-orange-100 text-orange-800',
};

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('it-IT');
}

export function TabGoals({ employeeId }: TabProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const { getStatusConfig } = useStatusConfig('goals');
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.goals.getGoals({ employee_id: employeeId });
        setGoals(result.items || []);
      } catch {
        setError('Impossibile caricare gli obiettivi');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">{error}</CardContent>
      </Card>
    );
  }

  if (goals.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nessun obiettivo trovato per questo dipendente
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {goals.map((goal) => {
        const status = String(goal.status || 'draft');
        const goalType = String(goal.goal_type || '');
        const progress = Number(goal.progress_percent || 0);

        return (
          <Card key={String(goal.id)}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">
                    {String(goal.title || 'Senza titolo')}
                  </CardTitle>
                </div>
                <div className="flex gap-2">
                  {goalType && (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${goalTypeColors[goalType] || 'bg-gray-100 text-gray-800'}`}
                    >
                      {goalType}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusConfig(status).className}`}
                  >
                    {getStatusConfig(status).label}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {goal.category && (
                <p className="text-sm text-muted-foreground">
                  {isEn ? 'Category' : 'Categoria'}: {String(goal.category)}
                </p>
              )}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{isEn ? 'Progress' : 'Progresso'}</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
              </div>
              {goal.due_date && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {isEn ? 'Due' : 'Scadenza'}: {formatDate(goal.due_date as string)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
