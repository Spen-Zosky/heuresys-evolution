'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Calendar, RefreshCw, AlertCircle, Palmtree, Clock, ThermometerSun } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface Balance {
  leave_type?: string;
  type?: string;
  entitled?: number;
  used?: number;
  used_days?: number | string;
  remaining?: number;
  total?: number;
  total_days?: number | string;
  available_days?: number | string;
  accrued_days?: number | string;
  pending_days?: number | string;
}

interface TimeOffRequest {
  id: string;
  leave_type?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  days?: number;
  days_requested?: number | string;
  reason?: string;
  created_at?: string;
}

const balanceIcons: Record<string, typeof Palmtree> = {
  ferie: Palmtree,
  permessi: Clock,
  malattia: ThermometerSun,
};

export default function TimeOffPage() {
  const t = useTranslations('portal.timeOff');
  const tCommon = useTranslations('common');
  const [balances, setBalances] = useState<Balance[]>([]);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestStatusConfig: Record<
    string,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    pending: { label: t('pending'), variant: 'outline' },
    approved: { label: t('approved'), variant: 'default' },
    rejected: { label: t('rejected'), variant: 'destructive' },
    cancelled: { label: tCommon('cancel'), variant: 'secondary' },
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [balancesRes, requestsRes] = await Promise.allSettled([
        api.timeOff.getMyBalances(),
        api.timeOff.getMyRequests(),
      ]);

      if (balancesRes.status === 'fulfilled') {
        const raw = balancesRes.value;
        if (Array.isArray(raw)) setBalances(raw as Balance[]);
        else if (typeof raw === 'object' && raw !== null) {
          setBalances(
            Object.entries(raw).map(([key, val]) => ({
              leave_type: key,
              ...(typeof val === 'object' && val !== null
                ? (val as Record<string, unknown>)
                : { total: val }),
            })) as Balance[]
          );
        }
      }

      if (requestsRes.status === 'fulfilled') {
        const raw = requestsRes.value as unknown;
        const list = Array.isArray(raw)
          ? raw
          : typeof raw === 'object' && raw !== null && Array.isArray((raw as { items?: unknown[] }).items)
            ? (raw as { items: unknown[] }).items
            : [];
        setRequests(list as TimeOffRequest[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error && balances.length === 0 && requests.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold">{error}</p>
            <Button onClick={fetchData}>
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
            <Calendar className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} title={tCommon('refresh')}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </motion.div>

      {/* Balance Cards */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        ) : balances.length > 0 ? (
          balances.slice(0, 6).map((balance, i) => {
            const typeName = balance.leave_type || balance.type || `Tipo ${i + 1}`;
            const IconComp = balanceIcons[typeName.toLowerCase()] || Calendar;
            const n = (v: unknown) => (v == null ? NaN : Number(v));
            const totalDays = balance.entitled ?? n(balance.total_days) ?? balance.total;
            const usedDays = balance.used ?? n(balance.used_days) ?? 0;
            const availableDays = balance.available_days != null ? n(balance.available_days) : NaN;
            const remainingCalc = !Number.isNaN(availableDays)
              ? availableDays
              : balance.remaining ?? (!Number.isNaN(totalDays as number)
                ? (totalDays as number) - (usedDays as number)
                : undefined);
            const remaining = typeof remainingCalc === 'number' && !Number.isNaN(remainingCalc)
              ? Number(remainingCalc).toFixed(1).replace(/\.0$/, '')
              : null;
            return (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <IconComp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground capitalize">{typeName}</div>
                      <div className="text-2xl font-bold">{remaining ?? '-'}</div>
                      {(totalDays != null && !Number.isNaN(totalDays as number)) && (
                        <div className="text-xs text-muted-foreground">
                          {usedDays || 0} usati / {totalDays} totali
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="sm:col-span-3">
            <CardContent className="p-4 text-center text-muted-foreground">
              {t('noBalance')}
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Requests Table */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('history')}</CardTitle>
            <CardDescription>{t('totalRequests', { count: requests.length })}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">{tCommon('noData')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('type')}</TableHead>
                    <TableHead>{t('from')}</TableHead>
                    <TableHead>{t('to')}</TableHead>
                    <TableHead>{t('days')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('requestDate')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => {
                    const config =
                      requestStatusConfig[req.status || 'pending'] || requestStatusConfig.pending;
                    return (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium capitalize">
                          {req.leave_type || req.type || '-'}
                        </TableCell>
                        <TableCell>
                          {req.start_date
                            ? new Date(req.start_date).toLocaleDateString('it-IT')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {req.end_date ? new Date(req.end_date).toLocaleDateString('it-IT') : '-'}
                        </TableCell>
                        <TableCell className="tabular-nums">{req.days ?? (req.days_requested != null ? Number(req.days_requested) : '-')}</TableCell>
                        <TableCell>
                          <Badge variant={config.variant}>{config.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {req.created_at
                            ? new Date(req.created_at).toLocaleDateString('it-IT')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
