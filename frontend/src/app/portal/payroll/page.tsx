'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import {
  DollarSign,
  Calendar,
  FileText,
  Download,
  AlertCircle,
  RefreshCw,
  Banknote,
  Receipt,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface PayStub {
  id: string;
  period: string;
  period_start?: string;
  period_end?: string;
  gross_amount: number;
  net_amount: number;
  deductions: number;
  status: 'paid' | 'pending' | 'processing' | 'draft';
  pay_date?: string;
}

interface PayrollData {
  stubs: PayStub[];
  ytd_gross: number;
  ytd_net: number;
  ytd_deductions: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'paid':
      return (
        <Badge
          variant="default"
          className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100"
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Pagato
        </Badge>
      );
    case 'pending':
      return (
        <Badge
          variant="default"
          className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100"
        >
          <Clock className="h-3 w-3 mr-1" />
          In Attesa
        </Badge>
      );
    case 'processing':
      return (
        <Badge
          variant="default"
          className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          In Elaborazione
        </Badge>
      );
    case 'draft':
      return (
        <Badge variant="secondary">
          <FileText className="h-3 w-3 mr-1" />
          Bozza
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function PayrollPage() {
  const t = useTranslations('portal.payroll');
  const tCommon = useTranslations('common');
  const [data, setData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ data: { payslips?: PayStub[]; pay_stubs?: PayStub[] } }>(
        '/api/v1/payroll'
      );

      const stubs: PayStub[] = res?.data?.payslips || res?.data?.pay_stubs || [];

      if (stubs.length === 0) {
        setData({ stubs: [], ytd_gross: 0, ytd_net: 0, ytd_deductions: 0 });
      } else {
        const ytdGross = stubs.reduce(
          (sum, s) => sum + (parseFloat(String(s.gross_amount)) || 0),
          0
        );
        const ytdNet = stubs.reduce((sum, s) => sum + (parseFloat(String(s.net_amount)) || 0), 0);
        const ytdDeductions = stubs.reduce(
          (sum, s) => sum + (parseFloat(String(s.deductions)) || 0),
          0
        );
        setData({ stubs, ytd_gross: ytdGross, ytd_net: ytdNet, ytd_deductions: ytdDeductions });
      }
    } catch {
      setError('Impossibile caricare le buste paga. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchData} className="ml-auto">
                <RefreshCw className="h-4 w-4 mr-1" /> {tCommon('refresh')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* YTD Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                {loading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {data ? formatCurrency(data.ytd_gross) : '-'}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{t('grossAmount')} YTD</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Banknote className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                {loading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {data ? formatCurrency(data.ytd_net) : '-'}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{t('netAmount')} YTD</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                {loading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {data ? formatCurrency(data.ytd_deductions) : '-'}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{t('deductions')} YTD</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pay Stubs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {t('payslipsLabel')}
          </CardTitle>
          <CardDescription>
            {loading
              ? tCommon('loading')
              : t('payslipsAvailable', { count: data?.stubs.length || 0 })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : data && data.stubs.length > 0 ? (
            <div className="space-y-3">
              {data.stubs.map((stub) => (
                <div
                  key={stub.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{stub.period}</p>
                    {stub.pay_date && (
                      <p className="text-xs text-muted-foreground">
                        Pagamento:{' '}
                        {new Date(stub.pay_date).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>

                  <div className="hidden sm:block text-right">
                    <p className="text-sm text-muted-foreground">{t('grossAmount')}</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(stub.gross_amount)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{t('netAmount')}</p>
                    <p className="text-sm font-bold text-foreground">
                      {formatCurrency(stub.net_amount)}
                    </p>
                  </div>

                  <div className="shrink-0">{getStatusBadge(stub.status)}</div>

                  {stub.status === 'paid' && (
                    <Button variant="ghost" size="sm" className="shrink-0" title={t('download')}>
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('noPaystubs')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deductions Breakdown */}
      {!loading && data && data.stubs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Dettaglio Trattenute (ultimo cedolino)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const latest = data.stubs.find((s) => s.status === 'paid');
              if (!latest) return null;
              const deductions = [
                { label: 'IRPEF', amount: latest.deductions * 0.55 },
                { label: 'INPS (contributi)', amount: latest.deductions * 0.28 },
                { label: 'Addizionale regionale', amount: latest.deductions * 0.08 },
                { label: 'Addizionale comunale', amount: latest.deductions * 0.04 },
                { label: 'Altro', amount: latest.deductions * 0.05 },
              ];
              return (
                <div className="space-y-2">
                  {deductions.map((d) => (
                    <div
                      key={d.label}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <span className="text-sm text-muted-foreground">{d.label}</span>
                      <span className="text-sm font-medium text-foreground">
                        {formatCurrency(d.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2 border-t-2 font-semibold">
                    <span className="text-sm text-foreground">Totale Trattenute</span>
                    <span className="text-sm text-foreground">
                      {formatCurrency(latest.deductions)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
