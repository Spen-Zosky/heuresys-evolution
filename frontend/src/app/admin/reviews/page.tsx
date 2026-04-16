'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  Search,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus,
  Star,
  AlertCircle,
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
import type { PerformanceReview, ReviewStats, Pagination } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useStatusConfig } from '@/lib/hooks/use-entity-config';

// ============================================
// TYPES
// ============================================

interface ReviewsState {
  reviews: PerformanceReview[];
  pagination: Pagination | null;
  stats: ReviewStats | null;
  loading: boolean;
  error: string | null;
}

// ============================================
// HELPERS
// ============================================

const reviewTypeLabels: Record<string, string> = {
  annual: 'Annuale',
  semi_annual: 'Semestrale',
  quarterly: 'Trimestrale',
  probation: 'Periodo di prova',
  project: 'Progetto',
  '360': '360 gradi',
};

function formatPeriod(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '-';
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '-';
  const s = startDate.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
  const e = endDate.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
  return `${s} - ${e}`;
}

function renderRating(rating: number | string | undefined | null): React.ReactNode {
  if (rating == null) return <span className="text-muted-foreground">-</span>;
  const num = typeof rating === 'string' ? parseFloat(rating) : rating;
  if (isNaN(num)) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex items-center gap-1">
      <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
      <span className="font-medium tabular-nums">{num.toFixed(1)}</span>
    </div>
  );
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function ReviewsPage() {
  const t = useTranslations('admin.reviews');
  const tCommon = useTranslations('common');
  const { getStatusConfig } = useStatusConfig('reviews');
  const [state, setState] = useState<ReviewsState>({
    reviews: [],
    pagination: null,
    stats: null,
    loading: true,
    error: null,
  });

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [reviewsData, statsData] = await Promise.all([
        api.performanceReviews.getReviews({
          search: search || undefined,
          status:
            statusFilter !== 'all'
              ? (statusFilter as 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled')
              : undefined,
          page,
          limit: 20,
        }),
        api.performanceReviews.getReviewStats(),
      ]);
      setState({
        reviews: reviewsData.items || [],
        pagination: reviewsData.pagination || null,
        stats: statsData,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Errore nel caricamento valutazioni',
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
            <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('newReview')}
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
              <p className="text-sm text-muted-foreground">In Corso</p>
              <p className="text-2xl font-bold mt-1 text-blue-600">
                {state.stats.pending + (state.stats.draft || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Completate</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{state.stats.completed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Valutazione Media</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                <span className="text-2xl font-bold">
                  {state.stats.avg_overall_rating
                    ? Number(state.stats.avg_overall_rating).toFixed(1)
                    : '-'}
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
                    placeholder={tCommon('searchPlaceholder')}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleSearch}>{tCommon('search')}</Button>
              </div>

              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  <SelectItem value="draft">Bozza</SelectItem>
                  <SelectItem value="pending">In attesa</SelectItem>
                  <SelectItem value="in_progress">In corso</SelectItem>
                  <SelectItem value="completed">Completate</SelectItem>
                  <SelectItem value="cancelled">Annullate</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={fetchData}
                className="shrink-0"
                aria-label="Aggiorna valutazioni"
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
                    <Skeleton className="h-4 w-12" />
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
                  <h3 className="font-semibold">Errore</h3>
                  <p className="text-sm text-muted-foreground mt-1">{state.error}</p>
                </div>
                <Button variant="outline" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Riprova
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : state.reviews.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="flex flex-col items-center text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">{tCommon('noResults')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search || statusFilter !== 'all'
                    ? 'Prova a modificare i filtri di ricerca'
                    : 'Inizia creando la prima valutazione'}
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
                    {state.pagination?.total || state.reviews.length} valutazioni
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
                      <TableHead>{t('fields.employee')}</TableHead>
                      <TableHead>{t('fields.reviewer')}</TableHead>
                      <TableHead>{t('fields.type')}</TableHead>
                      <TableHead>{t('fields.period')}</TableHead>
                      <TableHead>{t('fields.status')}</TableHead>
                      <TableHead>{t('fields.rating')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.reviews.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{review.employee_name || '-'}</p>
                            {review.department_name && (
                              <p className="text-xs text-muted-foreground">
                                {review.department_name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{review.reviewer_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {reviewTypeLabels[review.review_type] || review.review_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatPeriod(review.period_start, review.period_end)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusConfig(review.status).className}>
                            {getStatusConfig(review.status).label}
                          </Badge>
                        </TableCell>
                        <TableCell>{renderRating(review.overall_rating)}</TableCell>
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
