'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
import {
  BarChart3,
  Users,
  Building2,
  TrendingUp,
  Target,
  GraduationCap,
  AlertCircle,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AnalyticsData {
  totalEmployees: number;
  totalDepartments: number;
  avgTenure: number;
  totalGoals: number;
  completedGoals: number;
  totalCourses: number;
  performanceReviews: number;
}

export default function OrganizationAnalyticsPage() {
  const t = useTranslations('companyPet');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, deptRes] = await Promise.allSettled([
        apiClient.get<{ data: { summary?: Record<string, number> } }>(
          '/api/v1/analytics/dashboard'
        ),
        apiClient.get<{ data: { departments?: Array<Record<string, unknown>> } }>(
          '/api/v1/org-units'
        ),
      ]);

      const summary = dashRes.status === 'fulfilled' ? dashRes.value?.data?.summary || {} : {};
      const departments =
        deptRes.status === 'fulfilled' ? deptRes.value?.data?.departments || [] : [];

      setData({
        totalEmployees: summary.total_employees ?? 0,
        totalDepartments: departments.length ?? 0,
        avgTenure: summary.avg_tenure ?? 0,
        totalGoals: summary.total_goals ?? 0,
        completedGoals: summary.completed_goals ?? 0,
        totalCourses: summary.total_courses ?? 0,
        performanceReviews: summary.performance_reviews ?? 0,
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

  const kpis: Array<{
    label: string;
    value: string;
    icon: typeof Users;
  }> = data
    ? [
        {
          label: 'Dipendenti',
          value: data.totalEmployees > 0 ? data.totalEmployees.toString() : 'N/A',
          icon: Users,
        },
        {
          label: 'Dipartimenti',
          value: data.totalDepartments > 0 ? data.totalDepartments.toString() : 'N/A',
          icon: Building2,
        },
        {
          label: 'Tenure Media',
          value: data.avgTenure > 0 ? `${data.avgTenure.toFixed(1)} anni` : 'N/A',
          icon: Activity,
        },
        {
          label: 'Obiettivi Totali',
          value: data.totalGoals > 0 ? data.totalGoals.toLocaleString() : 'N/A',
          icon: Target,
        },
        {
          label: 'Obiettivi Completati',
          value: data.completedGoals > 0 ? data.completedGoals.toLocaleString() : 'N/A',
          icon: TrendingUp,
        },
        {
          label: 'Corsi Disponibili',
          value: data.totalCourses > 0 ? data.totalCourses.toString() : 'N/A',
          icon: GraduationCap,
        },
      ]
    : [];

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t('orgAnalytics.title')} description={t('orgAnalytics.description')} />
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

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('orgAnalytics.title')} description={t('orgAnalytics.description')} />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))
          : kpis.map((kpi) => (
              <Card key={kpi.label} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground font-medium">{kpi.label}</p>
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <kpi.icon className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Distribution Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Distribuzione Organizzativa
          </CardTitle>
          <CardDescription>Indicatori chiave di salute organizzativa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                label: 'Goal Completion Rate',
                value:
                  data && data.totalGoals > 0
                    ? Math.round((data.completedGoals / data.totalGoals) * 100)
                    : null,
                color: 'bg-green-500',
              },
              {
                label: 'Performance Review Coverage',
                value:
                  data && data.totalEmployees > 0
                    ? Math.round((data.performanceReviews / data.totalEmployees) * 100)
                    : null,
                color: 'bg-blue-500',
              },
            ].map((metric) => (
              <div key={metric.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{metric.label}</span>
                  <span className="font-medium text-foreground">
                    {loading ? '-' : metric.value != null ? `${metric.value}%` : 'N/A'}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  {!loading && metric.value != null && (
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${metric.color}`}
                      style={{ width: `${metric.value}%` }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
