'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  Search,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Plus,
  Clock,
  Users,
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
import type { Course, Pagination } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

// ============================================
// TYPES
// ============================================

interface CoursesState {
  courses: Course[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
}

// ============================================
// HELPERS
// ============================================

const skillLevelConfig: Record<string, { label: string; className: string }> = {
  base: { label: 'Base', className: 'bg-gray-500 hover:bg-gray-500/80 text-white' },
  beginner: { label: 'Base', className: 'bg-gray-500 hover:bg-gray-500/80 text-white' },
  intermediate: { label: 'Intermedio', className: 'bg-blue-500 hover:bg-blue-500/80 text-white' },
  advanced: { label: 'Avanzato', className: 'bg-purple-500 hover:bg-purple-500/80 text-white' },
  expert: { label: 'Esperto', className: 'bg-purple-700 hover:bg-purple-700/80 text-white' },
};

function formatDuration(hours: number | undefined | null): string {
  if (hours == null) return '-';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return hours === 1 ? '1 ora' : `${hours} ore`;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function CoursesPage() {
  const t = useTranslations('admin.courses');
  const [state, setState] = useState<CoursesState>({
    courses: [],
    pagination: null,
    loading: true,
    error: null,
  });

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await api.courses.getCourses({
        search: search || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        page,
        limit: 20,
      });
      setState({
        courses: data.items || [],
        pagination: data.pagination || null,
        loading: false,
        error: null,
      });

      // Extract unique categories from results for the filter
      const uniqueCategories = Array.from(
        new Set((data.items || []).map((c) => c.category).filter(Boolean))
      ) as string[];
      setCategories((prev) => {
        const merged = Array.from(new Set([...prev, ...uniqueCategories]));
        return merged.sort();
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : t('loadError'),
      }));
    }
  }, [search, categoryFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const handleCategoryChange = useCallback((value: string) => {
    setCategoryFilter(value);
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
            <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Catalogo Corsi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/admin/courses/new">
            <Plus className="h-4 w-4 mr-2" />
            Nuovo Corso
          </Link>
        </Button>
      </motion.div>

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
                <Button onClick={handleSearch}>Cerca</Button>
              </div>

              <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le categorie</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={fetchData}
                className="shrink-0"
                aria-label="Aggiorna corsi"
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
        ) : state.courses.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="flex flex-col items-center text-center">
                <GraduationCap className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">{t('noResults')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search || categoryFilter !== 'all'
                    ? 'Prova a modificare i filtri di ricerca'
                    : 'Inizia aggiungendo il primo corso al catalogo'}
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
                    {state.pagination?.total || state.courses.length} corsi
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
                      <TableHead>Categoria</TableHead>
                      <TableHead>Livello</TableHead>
                      <TableHead>Durata</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Iscritti</TableHead>
                      <TableHead>Stato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.courses.map((course) => (
                      <TableRow key={course.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium truncate max-w-[250px]">{course.title}</p>
                            {course.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                                {course.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{course.category || '-'}</TableCell>
                        <TableCell>
                          {course.skill_level ? (
                            <Badge
                              className={skillLevelConfig[course.skill_level]?.className || ''}
                            >
                              {skillLevelConfig[course.skill_level]?.label || course.skill_level}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatDuration(course.duration_hours)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{course.provider || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm tabular-nums">
                              {course.enrollment_count ?? 0}
                              {course.max_enrollments && (
                                <span className="text-muted-foreground">
                                  /{course.max_enrollments}
                                </span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {course.is_active ? (
                            <Badge className="bg-green-500 hover:bg-green-500/80 text-white">
                              Attivo
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inattivo</Badge>
                          )}
                          {course.is_mandatory && (
                            <Badge variant="destructive" className="ml-1">
                              Obbligatorio
                            </Badge>
                          )}
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
