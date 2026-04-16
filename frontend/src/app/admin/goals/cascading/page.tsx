'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Network,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Target,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

interface GoalNode {
  id: string;
  title: string;
  description?: string;
  status?: string;
  progress?: number;
  employee_name?: string;
  children?: GoalNode[];
  [key: string]: unknown;
}

const statusBadge: Record<string, { color: string; label: string }> = {
  not_started: { color: 'bg-gray-100 text-gray-800', label: 'Non iniziato' },
  in_progress: { color: 'bg-blue-100 text-blue-800', label: 'In corso' },
  completed: { color: 'bg-green-100 text-green-800', label: 'Completato' },
  at_risk: { color: 'bg-yellow-100 text-yellow-800', label: 'A rischio' },
  overdue: { color: 'bg-red-100 text-red-800', label: 'In ritardo' },
};

function GoalTreeNode({ goal, depth = 0 }: { goal: GoalNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = goal.children && goal.children.length > 0;
  const badge = statusBadge[goal.status || ''] || statusBadge.not_started;

  return (
    <div className={depth > 0 ? 'ml-6 border-l pl-4' : ''}>
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Expand"
                className="h-6 w-6 shrink-0 mt-0.5"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="h-6 w-6 shrink-0 flex items-center justify-center">
                {goal.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Target className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-sm">{goal.title}</h3>
                <Badge className={badge.color}>{badge.label}</Badge>
              </div>
              {goal.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {goal.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2">
                {goal.employee_name && (
                  <span className="text-xs text-muted-foreground">
                    Assegnato a: {goal.employee_name}
                  </span>
                )}
                {goal.progress != null && (
                  <div className="flex items-center gap-2 flex-1 max-w-48">
                    <Progress value={goal.progress} className="h-1.5" />
                    <span className="text-xs font-medium">{goal.progress}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {expanded && hasChildren && (
        <div>
          {goal.children!.map((child) => (
            <GoalTreeNode key={child.id} goal={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CascadingGoalsPage() {
  const t = useTranslations('admin.goals.cascading');
  const [goals, setGoals] = useState<GoalNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.goals.getGoals({ include_children: 'true' } as Record<
        string,
        unknown
      >);
      const items = Array.isArray(result) ? result : (result.items ?? []);
      setGoals(items as unknown as GoalNode[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento obiettivi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Go back" asChild>
          <Link href="/admin/goals">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Network className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Cascading Obiettivi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualizzazione gerarchica degli obiettivi
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchGoals}
          aria-label="Aggiorna obiettivi cascading"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </motion.div>

      {/* Tree */}
      <motion.div variants={staggerItem}>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">{t('loading')}</div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchGoals}>
              Riprova
            </Button>
          </div>
        ) : goals.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nessun obiettivo trovato
            </CardContent>
          </Card>
        ) : (
          <div>
            {goals.map((goal) => (
              <GoalTreeNode key={goal.id} goal={goal} />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
