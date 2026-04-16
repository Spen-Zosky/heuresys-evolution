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
import { RefreshCw, Shield, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';

interface AuditLog {
  id: string;
  action: string;
  user_id?: string;
  user_name?: string;
  username?: string;
  entity_type?: string;
  entity_id?: string;
  ip_address?: string;
  details?: string;
  changes?: Record<string, unknown>;
  created_at: string;
  timestamp?: string;
}

export default function AuditsPage() {
  const t = useTranslations('admin.compliance.audits');
  const [data, setData] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<any>('/api/v1/audit-logs');
      const items =
        response.data?.audit_logs ||
        response.data?.logs ||
        response.data?.items ||
        response.data ||
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

  const getActionBadge = (action: string) => {
    const a = action?.toLowerCase() || '';
    if (a.includes('create') || a.includes('insert')) {
      return <Badge className="bg-green-100 text-green-800">{action}</Badge>;
    }
    if (a.includes('update') || a.includes('edit') || a.includes('modify')) {
      return <Badge className="bg-blue-100 text-blue-800">{action}</Badge>;
    }
    if (a.includes('delete') || a.includes('remove')) {
      return <Badge variant="destructive">{action}</Badge>;
    }
    if (a.includes('login') || a.includes('auth')) {
      return <Badge className="bg-purple-100 text-purple-800">{action}</Badge>;
    }
    return <Badge variant="outline">{action || 'N/A'}</Badge>;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const filteredData = data.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.action?.toLowerCase().includes(term) ||
      log.user_name?.toLowerCase().includes(term) ||
      log.username?.toLowerCase().includes(term) ||
      log.entity_type?.toLowerCase().includes(term) ||
      log.details?.toLowerCase().includes(term)
    );
  });

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
            <Shield className="h-6 w-6" /> Log di Audit
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" /> {t('refresh')}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="{t('searchPlaceholder')}"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary">{filteredData.length} risultati</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Audit Trail ({filteredData.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredData.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noResults')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Azione</TableHead>
                  <TableHead>Utente</TableHead>
                  <TableHead>Entita</TableHead>
                  <TableHead>ID Entita</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Dettagli</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(log.timestamp || log.created_at)}
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell className="font-medium">
                      {log.user_name || log.username || 'Sistema'}
                    </TableCell>
                    <TableCell>{log.entity_type || 'N/A'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono max-w-[120px] truncate">
                      {log.entity_id || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.ip_address || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      {log.details ||
                        (log.changes ? JSON.stringify(log.changes).slice(0, 50) : 'N/A')}
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
