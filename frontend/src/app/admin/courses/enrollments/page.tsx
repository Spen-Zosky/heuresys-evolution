'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Search,
  RefreshCw,
  AlertCircle,
  GraduationCap,
  Calendar,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
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
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useStatusConfig } from '@/lib/hooks/use-entity-config';
import { useTranslations } from 'next-intl';

interface Enrollment {
  id: string;
  employee_name?: string;
  course_title?: string;
  status?: string;
  enrolled_at?: string;
  completed_at?: string;
  [key: string]: unknown;
}

export default function EnrollmentsPage() {
  const t = useTranslations('admin.courses.enrollments');
  const { getStatusConfig } = useStatusConfig('enrollments');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<{ data: Enrollment[] } | Enrollment[]>(
        '/api/v1/enrollments'
      );
      const list = Array.isArray(data) ? data : (data.data ?? []);
      setEnrollments(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const filtered = enrollments.filter(
    (e) =>
      !search ||
      e.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.course_title?.toLowerCase().includes(search.toLowerCase())
  );

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
          <Link href="/admin/courses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Iscrizioni Corsi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="{t('searchPlaceholder')}"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchEnrollments}
          aria-label="Aggiorna iscrizioni"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </motion.div>

      {/* Table */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Caricamento...</div>
            ) : error ? (
              <div className="p-8 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-destructive">{error}</p>
                <Button variant="outline" className="mt-4" onClick={fetchEnrollments}>
                  Riprova
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">{t('noResults')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dipendente</TableHead>
                    <TableHead>Corso</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data Iscrizione</TableHead>
                    <TableHead>Data Completamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => {
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.employee_name || '-'}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3 text-muted-foreground" />
                            {e.course_title || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusConfig(e.status || '').className}>
                            {getStatusConfig(e.status || '').label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {e.enrolled_at
                              ? new Date(e.enrolled_at).toLocaleDateString('it-IT')
                              : '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {e.completed_at ? (
                            <span className="flex items-center gap-1 text-sm text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              {new Date(e.completed_at).toLocaleDateString('it-IT')}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
