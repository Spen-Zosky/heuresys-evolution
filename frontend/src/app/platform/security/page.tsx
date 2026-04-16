'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Shield, RefreshCw, AlertCircle, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface AuditLogEntry {
  id: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  action: string;
  resource?: string;
  resource_type?: string;
  ip_address?: string;
  success?: boolean;
  details?: string;
  created_at: string;
  timestamp?: string;
}

const actionColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  login: 'default',
  logout: 'secondary',
  create: 'default',
  update: 'outline',
  delete: 'destructive',
  error: 'destructive',
};

export default function SecurityPage() {
  const t = useTranslations('platform.security');
  const tCommon = useTranslations('common');
  const tPagination = useTranslations('pagination');
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page, limit: pageSize };
      if (actionFilter) params.action = actionFilter;
      if (dateRange === '24h') params.from_date = new Date(Date.now() - 86400000).toISOString();
      else if (dateRange === '7d')
        params.from_date = new Date(Date.now() - 7 * 86400000).toISOString();
      else if (dateRange === '30d')
        params.from_date = new Date(Date.now() - 30 * 86400000).toISOString();
      const result = await api.auditLogs.getAuditLogs(params);
      const data = result as unknown;
      const logList = Array.isArray(data)
        ? data
        : (data as Record<string, unknown>).items || (data as Record<string, unknown>).logs || [];
      setLogs(logList as unknown as AuditLogEntry[]);
      const meta =
        (data as Record<string, unknown>).pagination || (data as Record<string, unknown>).meta;
      const total = ((meta as Record<string, unknown>)?.total as number) || 0;
      setTotalRecords(total);
      setTotalPages(Math.max(1, Math.ceil(total / pageSize)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento audit log');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, dateRange, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filtered = logs.filter(
    (log) =>
      !search ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      (log.user_name || log.user_email || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.resource || log.resource_type || '').toLowerCase().includes(search.toLowerCase())
  );

  if (error && logs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold">{error}</p>
            <Button onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {tCommon('refresh')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <motion.div variants={staggerItem} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchLogs} title={tCommon('refresh')}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </motion.div>

      <motion.div variants={staggerItem}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tCommon('searchPlaceholder')}
              className="pl-9"
            />
          </div>
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">{t('allDates')}</option>
            <option value="24h">{t('last24h')}</option>
            <option value="7d">{t('last7d')}</option>
            <option value="30d">{t('last30d')}</option>
          </select>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">Tutte le azioni</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="EXPORT">EXPORT</option>
            <option value="CONFIG_CHANGE">CONFIG_CHANGE</option>
            <option value="DATA_ACCESS">DATA_ACCESS</option>
          </select>
        </div>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('fields.timestamp')}</TableHead>
                    <TableHead>{t('fields.user')}</TableHead>
                    <TableHead>{t('fields.action')}</TableHead>
                    <TableHead>{t('fields.resource')}</TableHead>
                    <TableHead>{t('fields.ip')}</TableHead>
                    <TableHead>{t('fields.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((log) => {
                    const ts = log.timestamp || log.created_at;
                    const actionBase = log.action?.split('.')[0]?.toLowerCase() || '';
                    const variant = actionColors[actionBase] || 'outline';
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {new Date(ts).toLocaleString('it-IT', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.user_name || log.user_email || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={variant} className="text-xs">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.resource || log.resource_type || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {log.ip_address || '-'}
                        </TableCell>
                        <TableCell>
                          {log.success !== undefined && (
                            <Badge
                              variant={log.success ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {log.success ? tCommon('success') : tCommon('error')}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12">
                        <div className="flex flex-col items-center text-center space-y-2">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <Shield className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">
                            {tCommon('noResults')}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        variants={staggerItem}
        className="flex items-center justify-between flex-wrap gap-2"
      >
        <span className="text-sm text-muted-foreground">
          {totalRecords > 0 ? `${totalRecords} eventi trovati` : 'Nessun evento'}
        </span>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} per pagina
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {tPagination('previous')}
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {page}/{totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {tPagination('next')}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
