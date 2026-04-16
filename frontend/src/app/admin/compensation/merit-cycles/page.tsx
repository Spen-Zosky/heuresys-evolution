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
import { RefreshCw, TrendingUp, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface MeritCycle {
  id: string;
  name: string;
  year: number;
  status: string;
  budget: number;
  currency?: string;
  start_date?: string;
  end_date?: string;
  eligible_employees?: number;
  avg_increase_pct?: number;
  completed_reviews?: number;
  total_reviews?: number;
  description?: string;
}

export default function MeritCyclesPage() {
  const t = useTranslations('admin.compensation.meritCycles');
  const [data, setData] = useState<MeritCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<any>('/api/v1/merit-cycles');
      const items =
        response.data?.merit_cycles ||
        response.data?.items ||
        response.data ||
        response.merit_cycles ||
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
      case 'in_progress':
        return <Badge className="bg-green-100 text-green-800">In Corso</Badge>;
      case 'planning':
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800">Pianificazione</Badge>;
      case 'completed':
      case 'closed':
        return <Badge variant="secondary">Completato</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800">Approvato</Badge>;
      default:
        return <Badge variant="outline">{status || 'N/A'}</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency?: string) => {
    if (!amount && amount !== 0) return 'N/A';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(amount);
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
            <TrendingUp className="h-6 w-6" /> Cicli di Merito
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" /> {t('refresh')}
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" /> Nuovo Ciclo
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cicli di Merito ({data.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noResults')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Anno</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Eleggibili</TableHead>
                  <TableHead>Incremento Medio</TableHead>
                  <TableHead>Avanzamento</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((cycle) => (
                  <TableRow key={cycle.id}>
                    <TableCell className="font-medium">{cycle.name}</TableCell>
                    <TableCell>{cycle.year}</TableCell>
                    <TableCell>{formatCurrency(cycle.budget, cycle.currency)}</TableCell>
                    <TableCell>{cycle.eligible_employees ?? 'N/A'}</TableCell>
                    <TableCell>
                      {cycle.avg_increase_pct != null
                        ? `${cycle.avg_increase_pct.toFixed(1)}%`
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {cycle.completed_reviews != null && cycle.total_reviews
                        ? `${cycle.completed_reviews}/${cycle.total_reviews}`
                        : 'N/A'}
                    </TableCell>
                    <TableCell>{getStatusBadge(cycle.status)}</TableCell>
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
