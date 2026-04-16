'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api/client';
import { useStatusConfig } from '@/lib/hooks/use-entity-config';

interface TabTrainingProps {
  employeeId: string;
}

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('it-IT') : '—';

export function TabTraining({ employeeId }: TabTrainingProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const T = isEn ? 'Training' : 'Formazione';
  const { getStatusConfig } = useStatusConfig('enrollments');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get<any>(`/api/v1/enrollments?employee_id=${employeeId}`);
        const payload = response.data;
        const items = Array.isArray(payload) ? payload : payload?.items || [];
        setData(items);
      } catch {
        setError(
          isEn ? 'Failed to load training data' : 'Impossibile caricare i dati di formazione'
        );
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [employeeId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{T}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{T}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{T}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {isEn ? 'No course enrollments found' : 'Nessuna iscrizione a corsi trovata'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{T}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isEn ? 'Course' : 'Corso'}</TableHead>
              <TableHead>{isEn ? 'Status' : 'Stato'}</TableHead>
              <TableHead>{isEn ? 'Progress' : 'Progresso'}</TableHead>
              <TableHead>Iscrizione</TableHead>
              <TableHead>Completamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((e: any) => {
              const cfg = getStatusConfig(e.status || '');
              const progress =
                typeof e.progress_percent === 'number'
                  ? e.progress_percent
                  : typeof e.progress_percent === 'string'
                    ? parseFloat(e.progress_percent)
                    : 0;
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.course_title || e.title || '—'}</TableCell>
                  <TableCell>
                    <Badge className={cfg.className}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell className="min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(e.enrolled_at)}</TableCell>
                  <TableCell>{formatDate(e.completed_at)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
