'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { Target, Award, Star, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RatingBucket {
  stars: number;
  label: string;
  count: number;
  pct: number;
}

interface GoalStatusBucket {
  status: string;
  count: number;
  pct: number;
  color: string;
  badge: 'default' | 'secondary' | 'outline';
}

interface PerformanceData {
  totalReviews: number;
  avgRating: number;
  goalsCompleted: number;
  goalsTotal: number;
  checkIns: number;
  ratingDistribution: RatingBucket[];
  goalsByStatus: GoalStatusBucket[];
}

export default function OrganizationPerformancePage() {
  const t = useTranslations('companyPet');
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, ratingsRes, goalsRes] = await Promise.allSettled([
        apiClient.get<{ data: { summary?: Record<string, number> } }>(
          '/api/v1/analytics/dashboard'
        ),
        apiClient.get<{
          data: { distribution?: Array<{ rating_bucket: number; label: string; count: number }> };
        }>('/api/v1/performance-analytics/rating-distribution'),
        apiClient.get<{ data: { by_status?: Array<{ status: string; count: number }> } }>(
          '/api/v1/performance-analytics/goals-summary'
        ),
      ]);

      const summary = dashRes.status === 'fulfilled' ? dashRes.value?.data?.summary || {} : {};

      // Rating distribution from API or empty
      let ratingDistribution: RatingBucket[] = [];
      if (ratingsRes.status === 'fulfilled' && ratingsRes.value?.data?.distribution) {
        const dist = ratingsRes.value.data.distribution;
        const total = dist.reduce((s, r) => s + r.count, 0);
        ratingDistribution = dist.map((r) => ({
          stars: r.rating_bucket,
          label: r.label,
          count: r.count,
          pct: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
        }));
      }

      // Goals by status from API or empty
      const statusConfig: Record<
        string,
        { label: string; color: string; badge: 'default' | 'secondary' | 'outline' }
      > = {
        completed: { label: 'Completati', color: 'bg-green-500', badge: 'default' },
        on_track: { label: 'In Corso', color: 'bg-blue-500', badge: 'secondary' },
        in_progress: { label: 'In Corso', color: 'bg-blue-500', badge: 'secondary' },
        at_risk: { label: 'In Ritardo', color: 'bg-amber-500', badge: 'outline' },
        not_started: { label: 'Non Iniziati', color: 'bg-gray-400', badge: 'secondary' },
      };
      let goalsByStatus: GoalStatusBucket[] = [];
      if (goalsRes.status === 'fulfilled' && goalsRes.value?.data?.by_status) {
        const byStatus = goalsRes.value.data.by_status;
        const totalGoals = byStatus.reduce((s, g) => s + g.count, 0);
        goalsByStatus = byStatus.map((g) => {
          const cfg = statusConfig[g.status] || {
            label: g.status,
            color: 'bg-gray-400',
            badge: 'secondary' as const,
          };
          return {
            status: cfg.label,
            count: g.count,
            pct: totalGoals > 0 ? Math.round((g.count / totalGoals) * 1000) / 10 : 0,
            color: cfg.color,
            badge: cfg.badge,
          };
        });
      }

      setData({
        totalReviews: summary.performance_reviews ?? 0,
        avgRating: summary.avg_rating ?? 0,
        goalsCompleted: summary.completed_goals ?? 0,
        goalsTotal: summary.total_goals ?? 0,
        checkIns: summary.check_ins ?? 0,
        ratingDistribution,
        goalsByStatus,
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

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title={t('orgPerformance.title')}
          description={t('orgPerformance.description')}
        />
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
      <PageHeader title={t('orgPerformance.title')} description={t('orgPerformance.description')} />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Valutazioni',
            value: loading ? '-' : data?.totalReviews.toString() || '0',
            icon: Award,
            desc: 'Ciclo corrente',
          },
          {
            label: 'Rating Medio',
            value: loading ? '-' : `${data?.avgRating.toFixed(1)}/5`,
            icon: Star,
            desc: 'Su scala 1-5',
          },
          {
            label: 'Goal Completion',
            value: loading
              ? '-'
              : `${data ? Math.round((data.goalsCompleted / data.goalsTotal) * 100) : 0}%`,
            icon: Target,
            desc: `${data?.goalsCompleted || 0} su ${data?.goalsTotal || 0}`,
          },
          {
            label: 'Check-ins',
            value: loading ? '-' : data?.checkIns.toLocaleString() || '0',
            icon: CheckCircle2,
            desc: 'Totale registrati',
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <kpi.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{kpi.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              Distribuzione Rating
            </CardTitle>
            <CardDescription>Distribuzione delle valutazioni performance</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : data?.ratingDistribution && data.ratingDistribution.length > 0 ? (
              <div className="space-y-3">
                {data.ratingDistribution.map((row) => (
                  <div key={row.stars} className="flex items-center gap-3">
                    <div className="w-20 flex items-center gap-1">
                      {Array.from({ length: row.stars }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/80 rounded-full transition-all duration-500"
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-14 text-right">
                      {row.count}
                    </span>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {row.pct}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nessun dato di rating disponibile.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Obiettivi per Stato
            </CardTitle>
            <CardDescription>Distribuzione degli obiettivi per stato corrente</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.goalsByStatus && data.goalsByStatus.length > 0 ? (
              <div className="space-y-3">
                {data.goalsByStatus.map((item) => (
                  <div key={item.status} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className={`h-3 w-3 rounded-full ${item.color}`} />
                    <span className="text-sm font-medium text-foreground flex-1">
                      {item.status}
                    </span>
                    <Badge variant={item.badge}>{item.count}</Badge>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {item.pct}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nessun dato sugli obiettivi disponibile.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
