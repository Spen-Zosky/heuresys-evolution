'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Route, Search, RefreshCw, AlertCircle, BookOpen, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface LearningPath {
  id: string;
  name: string;
  title?: string;
  description?: string;
  course_count: number;
  estimated_duration_hours?: number | string;
  skill_level: string;
  status?: string;
  [key: string]: unknown;
}

const levelColors: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-blue-100 text-blue-800',
  advanced: 'bg-purple-100 text-purple-800',
  expert: 'bg-red-100 text-red-800',
};

export default function LearningPathsPage() {
  const t = useTranslations('admin.learningPaths');
  const tCommon = useTranslations('common');
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{
        data: { items?: LearningPath[]; paths?: LearningPath[] } | LearningPath[];
      }>('/api/v1/learning-paths');
      const raw = response.data;
      let items: LearningPath[];
      if (Array.isArray(raw)) {
        items = raw;
      } else if (raw && typeof raw === 'object') {
        items =
          ((raw as Record<string, unknown>).items as LearningPath[]) ||
          ((raw as Record<string, unknown>).paths as LearningPath[]) ||
          [];
      } else {
        items = Array.isArray(response) ? (response as unknown as LearningPath[]) : [];
      }
      setPaths(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento percorsi formativi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = paths.filter((p) => {
    const name = p.name || p.title || '';
    const matchSearch =
      !search ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    const matchLevel = levelFilter === 'all' || p.skill_level === levelFilter;
    return matchSearch && matchLevel;
  });

  const levels = [...new Set(paths.map((p) => p.skill_level).filter(Boolean))];
  const totalCourses = paths.reduce((sum, p) => sum + (p.course_count || 0), 0);

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Route className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Totale Percorsi</p>
            <p className="text-2xl font-bold">{paths.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Corsi Totali</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              <BookOpen className="h-5 w-5 text-primary" />
              {totalCourses}
            </p>
          </CardContent>
        </Card>
        {levels.slice(0, 2).map((level) => (
          <Card key={level}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground capitalize">{level}</p>
              <p className="text-2xl font-bold">{paths.filter((p) => p.level === level).length}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tCommon('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtra per livello" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i livelli</SelectItem>
            {levels.map((l) => (
              <SelectItem key={l} value={l} className="capitalize">
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchData}
          aria-label="Aggiorna percorsi formativi"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">{tCommon('loading')}</div>
            ) : error ? (
              <div className="p-8 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-destructive">{error}</p>
                <Button variant="outline" className="mt-4" onClick={fetchData}>
                  {tCommon('retry')}
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">{tCommon('noResults')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('fields.name')}</TableHead>
                    <TableHead>{t('fields.courses')}</TableHead>
                    <TableHead>{t('fields.duration')}</TableHead>
                    <TableHead>{t('fields.level')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name || p.title}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3 text-muted-foreground" />
                          {p.course_count ?? '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {p.estimated_duration_hours ? `${p.estimated_duration_hours}h` : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={levelColors[p.skill_level] || 'bg-gray-100 text-gray-800'}
                        >
                          {p.skill_level || '-'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
