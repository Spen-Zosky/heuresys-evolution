'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/hooks/use-auth';

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('it-IT');
}

function normalizeArray(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'items' in data) {
    return (data as { items: any[] }).items || [];
  }
  return [];
}

// STATUS_LABELS are built inside the component using translations

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
};

export default function MyApprovalsPage() {
  const t = useTranslations('portal.approvals');
  const tTimeOff = useTranslations('portal.timeOff');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isEn = locale === 'en';
  const { user } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<any[]>([]);

  const STATUS_LABELS: Record<string, string> = {
    pending: t('pending'),
    approved: t('approved'),
    rejected: t('rejected'),
    cancelled: tCommon('cancel'),
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    if (!user?.employeeId) return;
    setLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled([
        apiClient.get<any>(`/api/v1/leave?employee_id=${user.employeeId}&limit=20`),
        apiClient.get<any>('/api/v1/time-off/my/requests?limit=20'),
      ]);

      if (results[0].status === 'fulfilled') {
        setLeaveRequests(normalizeArray(results[0].value?.data));
      }
      if (results[1].status === 'fulfilled') {
        setTimeOffRequests(normalizeArray(results[1].value?.data));
      }

      if (results.every((r) => r.status === 'rejected')) {
        setError('Impossibile caricare le richieste');
      }
    } catch {
      setError('Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.employeeId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-[14px]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold">{error}</p>
            <Button onClick={fetchAll}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {tCommon('refresh')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allRequests = [
    ...leaveRequests.map((r) => ({ ...r, _type: isEn ? 'Leave' : 'Ferie/Permesso' })),
    ...timeOffRequests.map((r) => ({ ...r, _type: isEn ? 'Time-off' : 'Assenza' })),
  ].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-sora, Sora, sans-serif)' }}
        >
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="widget-card bg-card/80">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-yellow-500" />
            <p className="text-2xl font-bold mt-1">
              {allRequests.filter((r) => r.status === 'pending').length}
            </p>
            <p className="text-xs text-muted-foreground">{t('pending')}</p>
          </CardContent>
        </Card>
        <Card className="widget-card bg-card/80">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-green-500" />
            <p className="text-2xl font-bold mt-1">
              {allRequests.filter((r) => r.status === 'approved').length}
            </p>
            <p className="text-xs text-muted-foreground">{t('approved')}</p>
          </CardContent>
        </Card>
        <Card className="widget-card bg-card/80">
          <CardContent className="p-4 text-center">
            <AlertCircle className="h-5 w-5 mx-auto text-red-500" />
            <p className="text-2xl font-bold mt-1">
              {allRequests.filter((r) => r.status === 'rejected').length}
            </p>
            <p className="text-xs text-muted-foreground">{t('rejected')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests table */}
      <Card className="widget-card bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4" />
            {tTimeOff('history')} ({allRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noApprovals')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">{tTimeOff('type')}</th>
                    <th className="pb-2 pr-4 font-medium">{tTimeOff('from')}</th>
                    <th className="pb-2 pr-4 font-medium">{tTimeOff('to')}</th>
                    <th className="pb-2 pr-4 font-medium">{tCommon('notes')}</th>
                    <th className="pb-2 font-medium">{tTimeOff('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allRequests.map((r, i) => {
                    const status = String(r.status || 'pending');
                    return (
                      <tr key={String(r.id || i)} className="border-b last:border-0">
                        <td className="py-2 pr-4">{r._type || r.leave_type || r.type || '-'}</td>
                        <td className="py-2 pr-4">{formatDate(r.start_date)}</td>
                        <td className="py-2 pr-4">{formatDate(r.end_date)}</td>
                        <td className="py-2 pr-4 max-w-[200px] truncate">
                          {String(r.reason || r.notes || '-')}
                        </td>
                        <td className="py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}
                          >
                            {STATUS_LABELS[status] || status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
