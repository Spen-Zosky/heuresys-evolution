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
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PolicyViolation {
  id: string;
  type: string;
  violation_type?: string;
  employee_id?: string;
  employee_name?: string;
  description?: string;
  severity: string;
  status: string;
  policy_name?: string;
  reported_by?: string;
  reported_at?: string;
  resolved_at?: string;
  created_at: string;
  notes?: string;
}

export default function PolicyViolationsPage() {
  const t = useTranslations('admin.compliance.policyViolations');
  const [data, setData] = useState<PolicyViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<any>('/api/v1/policy-violations');
      const items =
        response.data?.violations ||
        response.data?.items ||
        response.data ||
        response.violations ||
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

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'critica':
        return <Badge variant="destructive">Critica</Badge>;
      case 'high':
      case 'alta':
        return <Badge className="bg-orange-100 text-orange-800">Alta</Badge>;
      case 'medium':
      case 'media':
        return <Badge className="bg-yellow-100 text-yellow-800">Media</Badge>;
      case 'low':
      case 'bassa':
        return <Badge variant="outline">Bassa</Badge>;
      default:
        return <Badge variant="outline">{severity || 'N/A'}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open':
      case 'aperta':
        return <Badge className="bg-red-100 text-red-800">Aperta</Badge>;
      case 'investigating':
      case 'in_review':
        return <Badge className="bg-yellow-100 text-yellow-800">In Revisione</Badge>;
      case 'resolved':
      case 'risolta':
        return <Badge className="bg-green-100 text-green-800">Risolta</Badge>;
      case 'dismissed':
      case 'archiviata':
        return <Badge variant="secondary">Archiviata</Badge>;
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
            <AlertTriangle className="h-6 w-6" /> Violazioni Policy
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" /> {t('refresh')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Violazioni ({data.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noResults')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Dipendente</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead>Gravita</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data Segnalazione</TableHead>
                  <TableHead>Data Risoluzione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((violation) => (
                  <TableRow key={violation.id}>
                    <TableCell className="font-medium">
                      {violation.type || violation.violation_type || 'N/A'}
                    </TableCell>
                    <TableCell>{violation.employee_name || 'N/A'}</TableCell>
                    <TableCell>{violation.policy_name || 'N/A'}</TableCell>
                    <TableCell>{getSeverityBadge(violation.severity)}</TableCell>
                    <TableCell>{getStatusBadge(violation.status)}</TableCell>
                    <TableCell>
                      {formatDate(violation.reported_at || violation.created_at)}
                    </TableCell>
                    <TableCell>{formatDate(violation.resolved_at || '')}</TableCell>
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
