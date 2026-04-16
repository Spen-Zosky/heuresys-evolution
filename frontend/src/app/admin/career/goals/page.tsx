'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Target,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  ChevronDown,
  ChevronRight,
  Flag,
  Calendar,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useStatusConfig } from '@/lib/hooks/use-entity-config';
import { useTranslations } from 'next-intl';

interface GoalRecord {
  id: string;
  title: string;
  description?: string;
  type?: string;
  status?: string;
  progress?: number;
  priority?: string;
  due_date?: string;
  created_at?: string;
  employee_name?: string;
  [key: string]: unknown;
}

const priorityConfig: Record<string, { color: string }> = {
  high: { color: 'bg-red-100 text-red-800' },
  medium: { color: 'bg-yellow-100 text-yellow-800' },
  low: { color: 'bg-gray-100 text-gray-800' },
};

export default function CareerGoalsPage() {
  const t = useTranslations('admin.career.goals');
  const { getStatusConfig } = useStatusConfig('goals');
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.goals.getGoals({ type: 'career' } as Record<string, unknown>);
      const items = Array.isArray(result) ? result : (result.items ?? []);
      setGoals(items as GoalRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return goals;
    return goals.filter((g) => g.status === typeFilter);
  }, [goals, typeFilter]);

  const stats = useMemo(() => {
    const total = goals.length;
    const completed = goals.filter((g) => g.status === 'completed').length;
    const inProgress = goals.filter((g) => g.status === 'in_progress').length;
    const avgProgress =
      total > 0 ? Math.round(goals.reduce((sum, g) => sum + (g.progress ?? 0), 0) / total) : 0;
    return { total, completed, inProgress, avgProgress };
  }, [goals]);

  const toggleExpansion = (id: string) => {
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Target className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Obiettivi di Carriera
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchGoals}
            aria-label="Aggiorna obiettivi carriera"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button asChild>
            <Link href="/admin/goals/new">
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Obiettivo
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Target className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Totale</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Trophy className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completati</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Corso</p>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Progresso Medio</p>
                <p className="text-2xl font-bold">{stats.avgProgress}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filter */}
      <motion.div variants={staggerItem}>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tutti gli stati" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="not_started">Non iniziato</SelectItem>
            <SelectItem value="in_progress">In corso</SelectItem>
            <SelectItem value="completed">Completato</SelectItem>
            <SelectItem value="at_risk">A rischio</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Goals list */}
      <motion.div variants={staggerItem}>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Caricamento...</div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchGoals}>
              Riprova
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {t('noResults')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((goal) => {
              const expanded = expandedGoals.has(goal.id);
              const status = getStatusConfig(goal.status || 'not_started');
              const priority = priorityConfig[goal.priority || ''];

              return (
                <Card
                  key={goal.id}
                  className={goal.status === 'at_risk' ? 'border-yellow-300' : ''}
                >
                  <CardContent className="p-4">
                    <div
                      className="flex items-start gap-3 cursor-pointer"
                      onClick={() => toggleExpansion(goal.id)}
                    >
                      <div className="p-2 rounded-lg bg-muted">
                        {goal.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Target className="h-5 w-5 text-primary" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold">{goal.title}</h3>
                          <Button variant="ghost" size="sm" className="shrink-0">
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge className={status.className}>{status.label}</Badge>
                          {priority && (
                            <Badge className={priority.color}>
                              <Flag className="h-3 w-3 mr-1" />
                              {goal.priority}
                            </Badge>
                          )}
                          {goal.due_date && (
                            <Badge variant="outline">
                              <Calendar className="h-3 w-3 mr-1" />
                              {new Date(goal.due_date).toLocaleDateString('it-IT')}
                            </Badge>
                          )}
                        </div>

                        {goal.progress != null && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Progresso</span>
                              <span className="font-medium">{goal.progress}%</span>
                            </div>
                            <Progress value={goal.progress} className="h-2" />
                          </div>
                        )}
                      </div>
                    </div>

                    {expanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t space-y-3"
                      >
                        {goal.description && (
                          <p className="text-sm text-muted-foreground">{goal.description}</p>
                        )}
                        {goal.employee_name && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Assegnato a:</span>{' '}
                            <span className="font-medium">{goal.employee_name}</span>
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm">{t('updateProgress')}</Button>
                          <Button size="sm" variant="outline">
                            Modifica
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
