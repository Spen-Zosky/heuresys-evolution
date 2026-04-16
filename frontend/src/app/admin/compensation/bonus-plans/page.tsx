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
import { RefreshCw, Gift, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface BonusPlan {
  id: string;
  name: string;
  type: string;
  budget: number;
  currency?: string;
  status: string;
  start_date?: string;
  end_date?: string;
  eligible_count?: number;
  description?: string;
  created_at?: string;
}

export default function BonusPlansPage() {
  const t = useTranslations('admin.compensation.bonusPlans');
  const [data, setData] = useState<BonusPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<any>('/api/v1/bonus-plans');
      const items =
        response.data?.bonus_plans ||
        response.data?.items ||
        response.data ||
        response.bonus_plans ||
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
        return <Badge className="bg-green-100 text-green-800">Attivo</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800">Bozza</Badge>;
      case 'closed':
      case 'completed':
        return <Badge variant="secondary">Completato</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Sospeso</Badge>;
      default:
        return <Badge variant="outline">{status || 'N/A'}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'performance':
        return (
          <Badge variant="outline" className="border-blue-300 text-blue-700">
            Performance
          </Badge>
        );
      case 'retention':
        return (
          <Badge variant="outline" className="border-purple-300 text-purple-700">
            Retention
          </Badge>
        );
      case 'spot':
        return (
          <Badge variant="outline" className="border-orange-300 text-orange-700">
            Spot
          </Badge>
        );
      case 'signing':
        return (
          <Badge variant="outline" className="border-green-300 text-green-700">
            Signing
          </Badge>
        );
      default:
        return <Badge variant="outline">{type || 'N/A'}</Badge>;
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
            <Gift className="h-6 w-6" /> Piani Bonus
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" /> {t('refresh')}
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" /> Nuovo Piano
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Piani Bonus ({data.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noResults')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Eleggibili</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Periodo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>{getTypeBadge(plan.type)}</TableCell>
                    <TableCell>{formatCurrency(plan.budget, plan.currency)}</TableCell>
                    <TableCell>{plan.eligible_count ?? 'N/A'}</TableCell>
                    <TableCell>{getStatusBadge(plan.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {plan.start_date
                        ? new Date(plan.start_date).toLocaleDateString('it-IT')
                        : 'N/A'}
                      {plan.end_date
                        ? ` - ${new Date(plan.end_date).toLocaleDateString('it-IT')}`
                        : ''}
                    </TableCell>
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
