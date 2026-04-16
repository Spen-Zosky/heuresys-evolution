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
import { RefreshCw, Layers, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SalaryBand {
  id: string;
  name: string;
  grade: string;
  level?: string;
  min_salary: number;
  mid_salary?: number;
  max_salary: number;
  currency?: string;
  employees_count?: number;
  job_family?: string;
  location?: string;
  effective_date?: string;
  status?: string;
}

export default function SalaryBandsPage() {
  const t = useTranslations('admin.compensation.salaryBands');
  const [data, setData] = useState<SalaryBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<any>('/api/v1/salary-bands');
      const items =
        response.data?.salary_bands ||
        response.data?.items ||
        response.data ||
        response.salary_bands ||
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

  const formatCurrency = (amount: number, currency?: string) => {
    if (!amount && amount !== 0) return 'N/A';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 0,
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
            <Layers className="h-6 w-6" /> Fasce Salariali
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" /> {t('refresh')}
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" /> Nuova Fascia
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fasce Salariali ({data.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noResults')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Grado</TableHead>
                  <TableHead>Livello</TableHead>
                  <TableHead>Minimo</TableHead>
                  <TableHead>Mediana</TableHead>
                  <TableHead>Massimo</TableHead>
                  <TableHead>Job Family</TableHead>
                  <TableHead>Dipendenti</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((band) => (
                  <TableRow key={band.id}>
                    <TableCell className="font-medium">{band.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{band.grade}</Badge>
                    </TableCell>
                    <TableCell>{band.level || 'N/A'}</TableCell>
                    <TableCell className="text-red-600">
                      {formatCurrency(band.min_salary, band.currency)}
                    </TableCell>
                    <TableCell className="text-yellow-600">
                      {band.mid_salary ? formatCurrency(band.mid_salary, band.currency) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-green-600">
                      {formatCurrency(band.max_salary, band.currency)}
                    </TableCell>
                    <TableCell>{band.job_family || 'N/A'}</TableCell>
                    <TableCell>{band.employees_count ?? 'N/A'}</TableCell>
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
