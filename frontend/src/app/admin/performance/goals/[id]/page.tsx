'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Target, ArrowLeft, Calendar, User, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import type { Goal } from '@/lib/api/types';
import { useStatusConfig } from '@/lib/hooks/use-entity-config';

export default function GoalDetailPage() {
  const t = useTranslations('admin.performance.goals');
  const tCommon = useTranslations('common');
  const { getStatusConfig } = useStatusConfig('goals');
  const params = useParams();
  const id = params.id as string;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.goals.getGoalById(id);
      setGoal(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento obiettivo');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGoal();
  }, [fetchGoal]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ApiError message={error} onRetry={fetchGoal} />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="p-6">
        <ApiError message="Obiettivo non trovato" />
      </div>
    );
  }

  const status = getStatusConfig(goal.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/goals">
            <Button variant="ghost" size="icon" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6" />
              {goal.title}
            </h1>
            <p className="text-muted-foreground">
              {goal.goal_type === 'individual'
                ? 'Obiettivo Individuale'
                : goal.goal_type === 'team'
                  ? 'Obiettivo di Team'
                  : goal.goal_type === 'department'
                    ? 'Obiettivo di Dipartimento'
                    : goal.goal_type === 'company'
                      ? 'Obiettivo Aziendale'
                      : goal.goal_type}
            </p>
          </div>
        </div>
        <Badge className={status.className}>{status.label}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Dettagli</CardTitle>
              <CardDescription>Informazioni sull&apos;obiettivo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {goal.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Descrizione</p>
                  <p>{goal.description}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Categoria</p>
                  <p className="font-medium">{goal.category || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Priorità</p>
                  <p className="font-medium">{goal.priority || '-'}</p>
                </div>
                {goal.weight !== undefined && goal.weight !== null && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Peso</p>
                    <p className="font-medium">{goal.weight}%</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Avanzamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Progresso</span>
                  <span className="text-lg font-bold">{goal.progress_percent}%</span>
                </div>
                <Progress value={goal.progress_percent} className="h-3" />
              </div>
            </CardContent>
          </Card>

          {/* Parent Goal */}
          {goal.parent_goal_title && (
            <Card>
              <CardHeader>
                <CardTitle>Obiettivo Padre</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{goal.parent_goal_title}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* People */}
          <Card>
            <CardHeader>
              <CardTitle>Persone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Dipendente</p>
                  <p className="font-medium">{goal.employee_name || '-'}</p>
                </div>
              </div>
              {goal.owner_name && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Responsabile</p>
                    <p className="font-medium">{goal.owner_name}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle>Date</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {goal.start_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Inizio</p>
                    <p>{new Date(goal.start_date).toLocaleDateString('it-IT')}</p>
                  </div>
                </div>
              )}
              {goal.due_date && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Scadenza</p>
                    <p>{new Date(goal.due_date).toLocaleDateString('it-IT')}</p>
                  </div>
                </div>
              )}
              {goal.completed_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Completato</p>
                    <p>{new Date(goal.completed_at).toLocaleDateString('it-IT')}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informazioni Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Creato</p>
                <p>{new Date(goal.created_at).toLocaleDateString('it-IT')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Aggiornato</p>
                <p>{new Date(goal.updated_at).toLocaleDateString('it-IT')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">ID</p>
                <p className="font-mono text-xs break-all">{goal.id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
