'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Award,
  Search,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Plus,
  ExternalLink,
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
import type { Skill, Pagination } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// TYPES
// ============================================

interface SkillsState {
  skills: Skill[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
}

// ============================================
// HELPERS
// ============================================

const skillTypeLabels: Record<string, string> = {
  hard: 'Hard Skill',
  soft: 'Soft Skill',
  technical: 'Tecnica',
  language: 'Lingua',
  certification: 'Certificazione',
  transversal: 'Trasversale',
};

// ============================================
// PAGE COMPONENT
// ============================================

export default function SkillsPage() {
  const t = useTranslations('admin.skills');
  const tCommon = useTranslations('common');
  const [state, setState] = useState<SkillsState>({
    skills: [],
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
      const data = await api.skills.getSkills({
        search: search || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        page,
        limit: 20,
      });
      setState({
        skills: data.items || [],
        pagination: data.pagination || null,
        loading: false,
        error: null,
      });

      // Extract unique categories from results for the filter
      const uniqueCategories = Array.from(
        new Set((data.items || []).map((s) => s.category).filter(Boolean))
      ) as string[];
      setCategories((prev) => {
        const merged = Array.from(new Set([...prev, ...uniqueCategories]));
        return merged.sort();
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Errore nel caricamento competenze',
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
            <Award className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('newSkill')}
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
                    placeholder={tCommon('searchPlaceholder')}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleSearch}>{tCommon('search')}</Button>
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
                aria-label="Aggiorna competenze"
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
                      <Skeleton className="h-4 w-[220px]" />
                      <Skeleton className="h-3 w-[160px]" />
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
        ) : state.skills.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="flex flex-col items-center text-center">
                <Award className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">{tCommon('noResults')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search || categoryFilter !== 'all'
                    ? 'Prova a modificare i filtri di ricerca'
                    : 'Inizia aggiungendo la prima competenza al catalogo'}
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
                    {state.pagination?.total || state.skills.length} competenze
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
                      <TableHead>{t('fields.name')}</TableHead>
                      <TableHead>{t('fields.category')}</TableHead>
                      <TableHead>{t('fields.type')}</TableHead>
                      <TableHead>{t('fields.escoUri')}</TableHead>
                      <TableHead>{t('fields.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.skills.map((skill) => (
                      <TableRow key={skill.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{skill.name}</p>
                            {skill.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                                {skill.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{skill.category || '-'}</TableCell>
                        <TableCell>
                          {skill.skill_type ? (
                            <Badge variant="outline">
                              {skillTypeLabels[skill.skill_type] || skill.skill_type}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {skill.esco_uri ? (
                            <a
                              href={skill.esco_uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline max-w-[200px]"
                            >
                              <span className="truncate">{skill.esco_uri.split('/').pop()}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {skill.is_active ? (
                            <Badge className="bg-green-500 hover:bg-green-500/80 text-white">
                              Attiva
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inattiva</Badge>
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
