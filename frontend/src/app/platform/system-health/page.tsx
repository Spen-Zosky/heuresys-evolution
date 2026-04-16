'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

type CheckStatus = 'ok' | 'error' | 'not_connected' | 'low' | 'unknown';

interface HealthCheck {
  status: CheckStatus | string;
  latencyMs?: number;
}

interface HealthResponse {
  success: boolean;
  data: {
    status: 'ok' | 'degraded';
    service: string;
    version: string;
    checks: {
      db?: HealthCheck;
      redis?: HealthCheck;
      disk?: HealthCheck;
    };
    timestamp: string;
  };
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ok: 'default',
  error: 'destructive',
  not_connected: 'destructive',
  low: 'secondary',
  unknown: 'secondary',
  degraded: 'destructive',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'error' || status === 'not_connected')
    return <XCircle className="h-4 w-4 text-destructive" />;
  return <AlertCircle className="h-4 w-4 text-warning" />;
}

export default function SystemHealthPage() {
  const t = useTranslations('platform');
  const [data, setData] = useState<HealthResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<HealthResponse>('/health');
      if (!res?.data) {
        throw new Error('Risposta /health senza payload');
      }
      setData(res.data);
      setLastFetchedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dello stato');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold">{error}</p>
            <Button onClick={fetchHealth}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const checks: Array<{ key: 'db' | 'redis' | 'disk'; label: string; icon: typeof Database }> = [
    { key: 'db', label: 'Database', icon: Database },
    { key: 'redis', label: 'Redis', icon: Activity },
    { key: 'disk', label: 'Disk', icon: HardDrive },
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
            <Server className="h-6 w-6 text-primary" />
            System Health
          </h1>
          <p className="text-muted-foreground mt-1">
            Stato live dei componenti infrastrutturali (DB, Redis, disco)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <Badge variant={STATUS_VARIANT[data.status] ?? 'secondary'} className="uppercase">
              {data.status}
            </Badge>
          )}
          <Button variant="outline" size="icon" onClick={fetchHealth} title={t('common.refresh')}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {checks.map(({ key, label, icon: Icon }) => {
          const check = data?.checks?.[key];
          const status = check?.status ?? 'unknown';
          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {label}
                </CardTitle>
                <CardDescription>Ultimo check: ping diretto</CardDescription>
              </CardHeader>
              <CardContent>
                {loading && !data ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={status} />
                      <span className="text-sm font-medium">{status}</span>
                    </div>
                    {check?.latencyMs != null && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {check.latencyMs} ms
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metadata servizio</CardTitle>
            <CardDescription>Informazioni emesse da /api/v1/health</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !data ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
            ) : data ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Servizio</span>
                  <span className="text-sm font-medium">{data.service}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Versione</span>
                  <span className="text-sm font-medium">{data.version}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Timestamp server</span>
                  <span className="text-sm font-medium tabular-nums">
                    {new Date(data.timestamp).toLocaleString('it-IT')}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Client refresh</span>
                  <span className="text-sm font-medium tabular-nums">
                    {lastFetchedAt ? lastFetchedAt.toLocaleString('it-IT') : '-'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nessun dato disponibile</p>
            )}
            {error && data && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                Ultimo refresh fallito: {error}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
