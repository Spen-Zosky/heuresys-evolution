'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Search,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Plus,
  Clock,
  Smile,
} from 'lucide-react';
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
import type { CheckIn, CheckInStats, CheckInStatus, Pagination } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useStatusConfig } from '@/lib/hooks/use-entity-config';
import { useTranslations } from 'next-intl';

// ============================================
// TYPES
// ============================================

interface CheckInsState {
  checkIns: CheckIn[];
  pagination: Pagination | null;
  stats: CheckInStats | null;
  loading: boolean;
  error: string | null;
}

// ============================================
// HELPERS
// ============================================

const checkInTypeLabels: Record<string, string> = {
  one_on_one: '1:1',
  weekly: 'Settimanale',
  monthly: 'Mensile',
  feedback: 'Feedback',
  performance: 'Performance',
  wellbeing: 'Benessere',
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDuration(minutes: number | undefined | null): string {
  if (minutes == null) return '-';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function _renderMood(mood: number | undefined | null): React.ReactNode {
  if (mood == null) return <span className="text-muted-foreground">-</span>;
  const moodLabels: Record<number, string> = {
    1: 'Molto basso',
    2: 'Basso',
    3: 'Neutro',
    4: 'Buono',
    5: 'Ottimo',
  };
  const moodColors: Record<number, string> = {
    1: 'text-red-500',
    2: 'text-orange-500',
    3: 'text-yellow-500',
    4: 'text-green-500',
    5: 'text-emerald-500',
  };
  return (
    <div className="flex items-center gap-1">
      <Smile className={`h-4 w-4 ${moodColors[mood] || 'text-muted-foreground'}`} />
      <span className="text-sm">{moodLabels[mood] || mood}</span>
    </div>
  );
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function CheckInsPage() {
  const t = useTranslations('admin.checkIns');
  const { getStatusConfig } = useStatusConfig('attendance');
  const [state, setState] = useState<CheckInsState>({
    checkIns: [],
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
      const [checkInsData, statsData] = await Promise.all([
        api.checkIns.getCheckIns({
          search: search || undefined,
          status: statusFilter !== 'all' ? (statusFilter as CheckInStatus) : undefined,
          page,
          limit: 20,
        }),
        api.checkIns.getCheckInStats(),
      ]);
      // The API may return a PaginatedResponse {items, pagination} or a plain array
      const items = Array.isArray(checkInsData) ? checkInsData : checkInsData.items || [];
      const pagination = Array.isArray(checkInsData) ? null : checkInsData.pagination || null;
      setState({
        checkIns: items,
        pagination,
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
            <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nuovo {t('title')}
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
              <p className="text-sm text-muted-foreground">Programmati</p>
              <p className="text-2xl font-bold mt-1 text-blue-600">{state.stats.scheduled}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Completati</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{state.stats.completed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Mood Medio</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Smile className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold">
                  {state.stats.avg_mood ? Number(state.stats.avg_mood).toFixed(1) : '-'}
                </span>
              </div>
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
                    placeholder="{t('searchPlaceholder')}"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleSearch}>{t('search')}</Button>
              </div>

              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  <SelectItem value="scheduled">Programmati</SelectItem>
                  <SelectItem value="completed">Completati</SelectItem>
                  <SelectItem value="cancelled">Annullati</SelectItem>
                  <SelectItem value="no_show">Assenti</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={fetchData}
                className="shrink-0"
                aria-label="Aggiorna dati"
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
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
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
        ) : state.checkIns.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="flex flex-col items-center text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">{t('noResults')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search || statusFilter !== 'all'
                    ? 'Prova a modificare i filtri di ricerca'
                    : 'Inizia programmando il primo check-in'}
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
                    {state.pagination?.total || state.checkIns.length} check-in
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
                      <TableHead>Dipendente</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Durata</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.checkIns.map((checkIn) => (
                      <TableRow key={checkIn.id}>
                        <TableCell className="font-medium">
                          {checkIn.employee_name || '-'}
                        </TableCell>
                        <TableCell className="text-sm">{checkIn.manager_name || '-'}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDate(checkIn.scheduled_date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {checkInTypeLabels[checkIn.check_in_type] || checkIn.check_in_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusConfig(checkIn.status).className}>
                            {getStatusConfig(checkIn.status).label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatDuration(checkIn.duration_minutes)}
                          </div>
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
