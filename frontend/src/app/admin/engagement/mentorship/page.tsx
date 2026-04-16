'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { RefreshCw, Users, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Mentorship {
  id: string;
  mentor_id?: string;
  mentor_name?: string;
  mentee_id?: string;
  mentee_name?: string;
  status: string;
  start_date: string;
  end_date?: string;
  goals?: string;
  area?: string;
  department?: string;
  sessions_count?: number;
  next_session?: string;
  rating?: number;
}

export default function MentorshipPage() {
  const t = useTranslations('admin.engagement.mentorship');
  const [data, setData] = useState<Mentorship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<any>('/api/v1/mentorship');
      const items =
        response.data?.mentorships ||
        response.data?.items ||
        response.data ||
        response.mentorships ||
        [];
      setData(Array.isArray(items) ? items : []);
    } catch (err: any) {
      setError(err.message || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'attivo':
        return <Badge className="bg-green-100 text-green-800">Attivo</Badge>;
      case 'pending':
      case 'in_attesa':
        return <Badge className="bg-yellow-100 text-yellow-800">In Attesa</Badge>;
      case 'completed':
      case 'completato':
        return <Badge variant="secondary">Completato</Badge>;
      case 'paused':
      case 'in_pausa':
        return <Badge className="bg-blue-100 text-blue-800">In Pausa</Badge>;
      case 'cancelled':
      case 'annullato':
        return <Badge variant="outline">Annullato</Badge>;
      default:
        return <Badge variant="outline">{status || 'N/A'}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">t('loading')</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> {t('retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Mentorship
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" /> {t('refresh')}
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" /> Nuovo Abbinamento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Programmi Mentorship ({data.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noResults')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mentor</TableHead>
                  <TableHead>Mentee</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Sessioni</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data Inizio</TableHead>
                  <TableHead>Data Fine</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.mentor_name || 'N/A'}</TableCell>
                    <TableCell>{m.mentee_name || 'N/A'}</TableCell>
                    <TableCell>{m.area || m.department || 'N/A'}</TableCell>
                    <TableCell>{m.sessions_count ?? 0}</TableCell>
                    <TableCell>{getStatusBadge(m.status)}</TableCell>
                    <TableCell>{formatDate(m.start_date)}</TableCell>
                    <TableCell>{formatDate(m.end_date || '')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
