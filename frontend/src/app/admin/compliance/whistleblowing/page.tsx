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
import { RefreshCw, Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface WhistleblowingReport {
  id: string;
  reference_number?: string;
  category: string;
  description?: string;
  status: string;
  priority?: string;
  anonymous?: boolean;
  reporter_id?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  resolution?: string;
}

export default function WhistleblowingPage() {
  const t = useTranslations('admin.compliance.whistleblowing');
  const [data, setData] = useState<WhistleblowingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<any>('/api/v1/whistleblowing');
      const items =
        response.data?.reports || response.data?.items || response.data || response.reports || [];
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
      case 'new':
      case 'nuovo':
        return <Badge className="bg-blue-100 text-blue-800">Nuova</Badge>;
      case 'open':
      case 'aperta':
        return <Badge className="bg-red-100 text-red-800">Aperta</Badge>;
      case 'investigating':
      case 'in_progress':
        return <Badge className="bg-yellow-100 text-yellow-800">In Indagine</Badge>;
      case 'resolved':
      case 'risolta':
        return <Badge className="bg-green-100 text-green-800">Risolta</Badge>;
      case 'closed':
      case 'chiusa':
        return <Badge variant="secondary">Chiusa</Badge>;
      case 'dismissed':
        return <Badge variant="outline">Archiviata</Badge>;
      default:
        return <Badge variant="outline">{status || 'N/A'}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'fraud':
      case 'frode':
        return <Badge variant="destructive">Frode</Badge>;
      case 'harassment':
      case 'molestie':
        return <Badge className="bg-red-100 text-red-800">Molestie</Badge>;
      case 'safety':
      case 'sicurezza':
        return <Badge className="bg-orange-100 text-orange-800">Sicurezza</Badge>;
      case 'corruption':
      case 'corruzione':
        return <Badge className="bg-purple-100 text-purple-800">Corruzione</Badge>;
      case 'discrimination':
      case 'discriminazione':
        return <Badge className="bg-yellow-100 text-yellow-800">Discriminazione</Badge>;
      case 'other':
      case 'altro':
        return <Badge variant="outline">Altro</Badge>;
      default:
        return <Badge variant="outline">{category || 'N/A'}</Badge>;
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
            <Eye className="h-6 w-6" /> Whistleblowing
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" /> {t('refresh')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Segnalazioni ({data.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noResults')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Riferimento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Anonima</TableHead>
                  <TableHead>Assegnata a</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data Segnalazione</TableHead>
                  <TableHead>Risoluzione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium font-mono text-sm">
                      {report.reference_number || report.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{getCategoryBadge(report.category)}</TableCell>
                    <TableCell>
                      {report.anonymous !== false ? (
                        <Badge variant="secondary">Si</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {report.assigned_to_name || report.assigned_to || 'Non assegnata'}
                    </TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell>{formatDate(report.created_at)}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      {report.resolution ||
                        (report.resolved_at ? formatDate(report.resolved_at) : 'Pendente')}
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
