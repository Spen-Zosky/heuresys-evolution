'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { RefreshCw, Heart, Smile, Frown, Meh, TrendingUp, TrendingDown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useTranslations } from 'next-intl';

interface WellbeingMetric {
  name: string;
  value: number;
  max?: number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  change?: number;
}

interface WellbeingDashboard {
  overall_score?: number;
  engagement_score?: number;
  satisfaction_score?: number;
  stress_index?: number;
  work_life_balance?: number;
  metrics?: WellbeingMetric[];
  survey_participation_rate?: number;
  last_survey_date?: string;
  alerts?: Array<{ type: string; message: string; severity: string }>;
}

export default function WellbeingPage() {
  const t = useTranslations('admin.engagement.wellbeing');
  const [data, setData] = useState<WellbeingDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<any>('/api/v1/wellbeing/dashboard');
      const dashboard = response.data?.dashboard || response.data || response.dashboard || {};
      setData(typeof dashboard === 'object' && !Array.isArray(dashboard) ? dashboard : {});
    } catch (err: any) {
      setError(err.message || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <Smile className="h-8 w-8 text-green-500" />;
    if (score >= 60) return <Meh className="h-8 w-8 text-yellow-500" />;
    return <Frown className="h-8 w-8 text-red-500" />;
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <span className="text-muted-foreground">--</span>;
  };

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
        <h1 className="text-2xl font-bold">Wellbeing</h1>
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

  const overallScore = data?.overall_score ?? 0;
  const metrics: WellbeingMetric[] = data?.metrics || [];

  // Build default metrics from dashboard data if metrics array is empty
  const displayMetrics: WellbeingMetric[] =
    metrics.length > 0
      ? metrics
      : [
          { name: 'Engagement', value: data?.engagement_score ?? 0, max: 100 },
          { name: 'Soddisfazione', value: data?.satisfaction_score ?? 0, max: 100 },
          { name: 'Indice Stress', value: data?.stress_index ?? 0, max: 100 },
          { name: 'Work-Life Balance', value: data?.work_life_balance ?? 0, max: 100 },
        ].filter((m) => m.value > 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6" /> Wellbeing Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" /> {t('refresh')}
        </Button>
      </div>

      {/* Overall Score */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Punteggio Complessivo Wellbeing</p>
              <p className={`text-4xl font-bold ${getScoreColor(overallScore)}`}>
                {overallScore > 0 ? `${overallScore}/100` : 'N/D'}
              </p>
              {data?.survey_participation_rate != null && (
                <p className="text-sm text-muted-foreground mt-2">
                  Partecipazione sondaggi: {data.survey_participation_rate}%
                </p>
              )}
              {data?.last_survey_date && (
                <p className="text-xs text-muted-foreground">
                  Ultimo sondaggio: {new Date(data.last_survey_date).toLocaleDateString('it-IT')}
                </p>
              )}
            </div>
            {overallScore > 0 && getScoreIcon(overallScore)}
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      {displayMetrics.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {displayMetrics.map((metric, idx) => (
            <Card key={idx}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {metric.name}
                  </CardTitle>
                  {getTrendIcon(metric.trend)}
                </div>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${getScoreColor(metric.value)}`}>
                  {metric.value}
                  {metric.unit || '/100'}
                </p>
                <Progress value={metric.value} className="mt-2 h-2" />
                {metric.change != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {metric.change >= 0 ? '+' : ''}
                    {metric.change}% rispetto al mese precedente
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Alerts */}
      {data?.alerts && data.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Avvisi Wellbeing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.alerts.map((alert, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Badge
                    variant={
                      alert.severity === 'high'
                        ? 'destructive'
                        : alert.severity === 'medium'
                          ? 'default'
                          : 'secondary'
                    }
                  >
                    {alert.type}
                  </Badge>
                  <p className="text-sm">{alert.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {overallScore === 0 && displayMetrics.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <Meh className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Nessun dato wellbeing disponibile. Configura e lancia un sondaggio per iniziare a
              raccogliere dati.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
