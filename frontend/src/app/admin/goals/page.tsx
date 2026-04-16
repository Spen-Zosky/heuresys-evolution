'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Target,
  Search,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { Goal, GoalStats, GoalStatus, Pagination } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useStatusConfig } from '@/lib/hooks/use-entity-config';
import { useTranslations } from 'next-intl';

// ============================================
// TYPES
// ============================================

interface GoalsState {
  goals: Goal[];
  pagination: Pagination | null;
  stats: GoalStats | null;
  loading: boolean;
  error: string | null;
}

// ============================================
// HELPERS
// ============================================

const goalTypeLabels: Record<string, string> = {
  individual: 'Individuale',
  team: 'Team',
  department: 'Dipartimento',
  company: 'Aziendale',
};

function formatDate(date: string | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function GoalsPage() {
  const t = useTranslations('admin.goals');
  const { getStatusConfig } = useStatusConfig('goals');
  const [state, setState] = useState<GoalsState>({
    goals: [],
    pagination: null,
    stats: null,
    loading: true,
    error: null,
  });

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [goalsData, statsData] = await Promise.all([
        api.goals.getGoals({
          search: search || undefined,
          status: statusFilter !== 'all' ? (statusFilter as GoalStatus) : undefined,
          page,
          limit: 20,
        }),
        api.goals.getGoalStats(),
      ]);
      setState({
        goals: goalsData.items || [],
        pagination: goalsData.pagination || null,
        stats: statsData,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : t('loadError'),
      }));
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Page Header */}
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Target className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Obiettivi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/admin/goals/new">
            <Plus className="h-4 w-4 mr-2" />
            Nuovo Obiettivo
          </Link>
        </Button>
      </motion.div>

      {/* Stats Cards */}
      {state.stats && (
        <motion.div variants={staggerItem} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Totale</p>
              <p className="text-2xl font-bold mt-1">{state.stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Attivi</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{state.stats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Completati</p>
              <p className="text-2xl font-bold mt-1 text-blue-600">{state.stats.completed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Scaduti</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{state.stats.overdue}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca obiettivi..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleSearch}>Cerca</Button>
              </div>

              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  <SelectItem value="active">Attivi</SelectItem>
                  <SelectItem value="completed">Completati</SelectItem>
                  <SelectItem value="draft">Bozza</SelectItem>
                  <SelectItem value="on_hold">In pausa</SelectItem>
                  <SelectItem value="cancelled">Annullati</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={fetchData}
                className="shrink-0"
                aria-label="Aggiorna obiettivi"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results */}
      <motion.div variants={staggerItem}>
        {state.loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-3 w-[180px]" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : state.error ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center gap-4">
                <AlertCircle className="h-12 w-12 text-destructive/50" />
                <div>
                  <h3 className="font-semibold">{t('error')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{state.error}</p>
                </div>
                <Button variant="outline" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Riprova
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : state.goals.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="flex flex-col items-center text-center">
                <Target className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">{t('noResults')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search || statusFilter !== 'all'
                    ? 'Prova a modificare i filtri di ricerca'
                    : 'Inizia creando il primo obiettivo'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {state.pagination?.total || state.goals.length} obiettivi
                  </CardTitle>
                  <CardDescription>
                    Pagina {state.pagination?.page || 1} di {state.pagination?.totalPages || 1}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titolo</TableHead>
                      <TableHead>Dipendente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Scadenza</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.goals.map((goal) => (
                      <TableRow key={goal.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium truncate max-w-[250px]">{goal.title}</p>
                            {goal.category && (
                              <p className="text-xs text-muted-foreground">{goal.category}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{goal.employee_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {goalTypeLabels[goal.goal_type] || goal.goal_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusConfig(goal.status).className}>
                            {getStatusConfig(goal.status).label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${Math.min(goal.progress_percent, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium tabular-nums w-10 text-right">
                              {goal.progress_percent}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDate(goal.due_date)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {state.pagination && state.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {(state.pagination.page - 1) * state.pagination.limit + 1}-
                    {Math.min(
                      state.pagination.page * state.pagination.limit,
                      state.pagination.total
                    )}{' '}
                    di {state.pagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p - 1)}
                      disabled={state.pagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Precedente
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={state.pagination.page >= state.pagination.totalPages}
                    >
                      Successivo
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>
    </motion.div>
  );
}
