'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { Users, PieChart, Calendar, Briefcase, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DistributionItem {
  label: string;
  count: number;
  pct: number;
}

interface DemographicsData {
  totalEmployees: number;
  genderDistribution: DistributionItem[];
  ageDistribution: Array<{ range: string; count: number; pct: number }>;
  contractTypes: Array<{ type: string; count: number; pct: number }>;
  seniorityDistribution: Array<{ range: string; count: number; pct: number }>;
}

interface DashboardSummary {
  total_employees?: number;
  gender_distribution?: Array<{ gender: string; count: number; percentage: number }>;
  age_distribution?: Array<{ range: string; count: number; percentage: number }>;
  contract_type_distribution?: Array<{ type: string; count: number; percentage: number }>;
  seniority_distribution?: Array<{ range: string; count: number; percentage: number }>;
  [key: string]: unknown;
}

export default function WorkforceDemographicsPage() {
  const t = useTranslations('companyPet');
  const [data, setData] = useState<DemographicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, demographicsRes] = await Promise.allSettled([
        apiClient.get<{ data: { summary?: DashboardSummary } }>('/api/v1/analytics/dashboard'),
        apiClient.get<{ data: DashboardSummary }>('/api/v1/analytics/workforce/demographics'),
      ]);

      const summary = dashRes.status === 'fulfilled' ? (dashRes.value?.data?.summary ?? {}) : {};
      const demographicsData =
        demographicsRes.status === 'fulfilled' ? (demographicsRes.value?.data ?? {}) : {};

      const total = (summary as DashboardSummary).total_employees ?? 0;

      // Gender distribution from API
      const rawGender =
        (demographicsData as DashboardSummary).gender_distribution ||
        (summary as DashboardSummary).gender_distribution;
      const genderDistribution: DistributionItem[] = Array.isArray(rawGender)
        ? rawGender.map(
            (g: { gender?: string; label?: string; count?: number; percentage?: number }) => ({
              label: g.gender || g.label || 'N/A',
              count: g.count ?? 0,
              pct: Math.round(g.percentage ?? (total > 0 ? ((g.count ?? 0) / total) * 100 : 0)),
            })
          )
        : [];

      // Age distribution from API
      const rawAge =
        (demographicsData as DashboardSummary).age_distribution ||
        (summary as DashboardSummary).age_distribution;
      const ageDistribution = Array.isArray(rawAge)
        ? rawAge.map((a) => ({
            range: a.range ?? 'N/A',
            count: a.count ?? 0,
            pct: Math.round(a.percentage ?? (total > 0 ? (a.count / total) * 100 : 0)),
          }))
        : [];

      // Contract types from API
      const rawContracts =
        (demographicsData as DashboardSummary).contract_type_distribution ||
        (summary as DashboardSummary).contract_type_distribution;
      const contractTypes = Array.isArray(rawContracts)
        ? rawContracts.map((c) => ({
            type: c.type ?? 'N/A',
            count: c.count ?? 0,
            pct: Math.round(c.percentage ?? (total > 0 ? (c.count / total) * 100 : 0)),
          }))
        : [];

      // Seniority distribution from API
      const rawSeniority =
        (demographicsData as DashboardSummary).seniority_distribution ||
        (summary as DashboardSummary).seniority_distribution;
      const seniorityDistribution = Array.isArray(rawSeniority)
        ? rawSeniority.map((s) => ({
            range: s.range ?? 'N/A',
            count: s.count ?? 0,
            pct: Math.round(s.percentage ?? (total > 0 ? (s.count / total) * 100 : 0)),
          }))
        : [];

      setData({
        totalEmployees: total,
        genderDistribution,
        ageDistribution,
        contractTypes,
        seniorityDistribution,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadingError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const colors = ['bg-blue-500', 'bg-pink-500', 'bg-purple-500', 'bg-amber-500', 'bg-green-500'];

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t('demographics.title')} description={t('demographics.description')} />
        <Card>
          <CardContent className="p-10 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const EmptySection = ({ message }: { message: string }) => (
    <p className="text-sm text-muted-foreground text-center py-4">{message}</p>
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('demographics.title')} description={t('demographics.description')} />

      {/* Total */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-3xl font-bold text-foreground">
                  {data?.totalEmployees ? data.totalEmployees.toLocaleString() : 'N/A'}
                </p>
              )}
              <p className="text-sm text-muted-foreground">Dipendenti totali</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Distribuzione per Genere
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : data?.genderDistribution.length ? (
              <div className="space-y-3">
                {data.genderDistribution.map((item, i) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-medium">{item.label}</span>
                      <span className="text-muted-foreground">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors[i % colors.length]} transition-all duration-500`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptySection message="Dati demografici per genere non disponibili" />
            )}
          </CardContent>
        </Card>

        {/* Age */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Distribuzione per Eta
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : data?.ageDistribution.length ? (
              <div className="space-y-3">
                {data.ageDistribution.map((item, i) => (
                  <div key={item.range} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-medium">{item.range}</span>
                      <span className="text-muted-foreground">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors[i % colors.length]} transition-all duration-500`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptySection message="Dati distribuzione per eta non disponibili" />
            )}
          </CardContent>
        </Card>

        {/* Contract Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Tipologie Contrattuali
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : data?.contractTypes.length ? (
              <div className="space-y-3">
                {data.contractTypes.map((item, i) => (
                  <div key={item.type} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className={`h-3 w-3 rounded-full ${colors[i % colors.length]}`} />
                    <span className="text-sm font-medium text-foreground flex-1">{item.type}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {item.pct}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptySection message="Dati tipologie contrattuali non disponibili" />
            )}
          </CardContent>
        </Card>

        {/* Seniority */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Seniority (Anzianita Aziendale)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : data?.seniorityDistribution.length ? (
              <div className="space-y-3">
                {data.seniorityDistribution.map((item, i) => (
                  <div key={item.range} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-medium">{item.range}</span>
                      <span className="text-muted-foreground">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors[i % colors.length]} transition-all duration-500`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptySection message="Dati anzianita aziendale non disponibili" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
