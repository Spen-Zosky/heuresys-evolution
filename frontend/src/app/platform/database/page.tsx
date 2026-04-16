'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Database,
  RefreshCw,
  AlertCircle,
  HardDrive,
  Table2,
  Activity,
  Zap,
  Archive,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface BackupStatus {
  last_backup_at: string | null;
  last_backup_size_mb: number | null;
  last_backup_status: 'OK' | 'FAILED' | 'UNKNOWN';
  frequency: string | null;
  retention_days: number | null;
  counts: { daily: number; weekly: number; monthly: number };
}

interface DbHealth {
  status?: string;
  database_size?: string;
  total_tables?: number;
  total_views?: number;
  total_functions?: number;
  total_triggers?: number;
  active_connections?: number;
  extensions?: string[];
  rls_protected?: number;
  uptime?: string;
  version?: string;
}

export default function DatabasePage() {
  const t = useTranslations('platform');
  const [health, setHealth] = useState<DbHealth>({});
  const [backup, setBackup] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dbHealthRes, platformRes, backupRes] = await Promise.allSettled([
        apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/db-health'),
        apiClient.get<{ success: boolean; data: { database: Record<string, unknown> } }>(
          '/api/v1/platform/dashboard'
        ),
        apiClient.get<{ success: boolean; data: BackupStatus }>('/api/v1/platform/backup-status'),
      ]);

      const dbBasic = dbHealthRes.status === 'fulfilled' ? dbHealthRes.value?.data || {} : {};
      const platform =
        platformRes.status === 'fulfilled' ? platformRes.value?.data?.database || {} : {};

      const uptimeSeconds = platform.db_uptime_seconds as number | undefined;
      const uptimeStr = uptimeSeconds
        ? `${Math.floor(uptimeSeconds / 86400)}g ${Math.floor((uptimeSeconds % 86400) / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`
        : undefined;

      setHealth({
        status: ((dbBasic as Record<string, unknown>).status as string) || 'ok',
        total_tables: platform.total_tables as number,
        total_views: platform.total_views as number,
        active_connections: platform.active_connections as number,
        rls_protected: platform.rls_policies as number,
        database_size: platform.db_size as string,
        extensions: ['ltree', 'pg_trgm', 'uuid-ossp', 'vector'],
        total_functions: platform.total_functions as number,
        total_triggers: platform.total_triggers as number,
        version: platform.pg_version as string,
        uptime: uptimeStr,
      } as DbHealth);

      if (backupRes.status === 'fulfilled') {
        setBackup(backupRes.value?.data || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento metriche database');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold">{error}</p>
            <Button onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const metrics = [
    { icon: Table2, label: 'Tabelle', value: health.total_tables ?? '-', color: 'text-primary' },
    { icon: Activity, label: 'Viste', value: health.total_views ?? '-', color: 'text-info' },
    { icon: Zap, label: 'Funzioni', value: health.total_functions ?? '-', color: 'text-warning' },
    {
      icon: HardDrive,
      label: 'Dimensione',
      value: health.database_size ?? '-',
      color: 'text-success',
    },
  ];

  const details = [
    { label: 'Trigger', value: health.total_triggers ?? '-' },
    { label: 'Connessioni Attive', value: health.active_connections ?? '-' },
    { label: 'Tabelle RLS', value: health.rls_protected ?? '-' },
    { label: 'Stato', value: health.status ?? '-' },
    { label: 'Versione', value: health.version ?? '-' },
    { label: 'Uptime', value: health.uptime ?? '-' },
  ];

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
            <Database className="h-6 w-6 text-primary" />
            Database
          </h1>
          <p className="text-muted-foreground mt-1">{t('database.subtitle')}</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} title={t('common.refresh')}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </motion.div>

      {/* Main Metrics */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <m.icon className={`h-5 w-5 ${m.color}`} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{m.label}</div>
                  {loading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <div className="text-2xl font-bold">{m.value}</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Details */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('database.details')}</CardTitle>
            <CardDescription>{t('database.technicalInfo')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
              : details.map((d) => (
                  <div
                    key={d.label}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                  >
                    <span className="text-sm text-muted-foreground">{d.label}</span>
                    <span className="text-sm font-medium tabular-nums">{d.value}</span>
                  </div>
                ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('database.extensions')}</CardTitle>
            <CardDescription>{t('database.installedExtensions')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : health.extensions && health.extensions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {health.extensions.map((ext) => (
                  <Badge key={ext} variant="secondary" className="font-mono text-xs">
                    {ext}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {['ltree', 'pg_trgm', 'uuid-ossp', 'vector'].map((ext) => (
                  <Badge key={ext} variant="outline" className="font-mono text-xs">
                    {ext}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Backup Status */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Backup
            </CardTitle>
            <CardDescription>Stato dei backup automatici del database</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !backup ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status alert */}
                {backup.last_backup_status === 'FAILED' && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 flex items-center gap-2 text-sm text-destructive">
                    <XCircle className="h-4 w-4 shrink-0" />
                    Ultimo backup non recente (&gt;25 ore). Verificare il processo di backup.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      {backup.last_backup_status === 'OK' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : backup.last_backup_status === 'FAILED' ? (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      Stato
                    </span>
                    <Badge
                      variant={
                        backup.last_backup_status === 'OK'
                          ? 'default'
                          : backup.last_backup_status === 'FAILED'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {backup.last_backup_status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Ultimo Backup
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {backup.last_backup_at
                        ? new Date(backup.last_backup_at).toLocaleString('it-IT')
                        : '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Dimensione</span>
                    <span className="text-sm font-medium tabular-nums">
                      {backup.last_backup_size_mb != null
                        ? `${backup.last_backup_size_mb} MB`
                        : '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Frequenza</span>
                    <span className="text-sm font-medium">{backup.frequency || '-'}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Retention</span>
                    <span className="text-sm font-medium">
                      {backup.retention_days != null ? `${backup.retention_days} giorni` : '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Copie</span>
                    <span className="text-sm font-medium tabular-nums">
                      {backup.counts.daily}d / {backup.counts.weekly}w / {backup.counts.monthly}m
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
