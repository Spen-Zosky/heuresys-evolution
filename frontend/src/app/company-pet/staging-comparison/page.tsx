'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GitCompare, TrendingUp, TrendingDown, Minus, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';

interface Scenario {
  id: string;
  name: string;
  isBaseline: boolean;
  headcount?: number;
  departments?: number;
  totalCost?: number;
  spanOfControl?: number;
  description?: string;
}

interface ScenarioComparison {
  scenarios: Scenario[];
  baseline?: Scenario;
}

function TrendIcon({ current, value }: { current: number; value: number }) {
  if (value < current) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  if (value > current) return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function StagingComparisonPage() {
  const t = useTranslations('companyPet');
  const [data, setData] = useState<ScenarioComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ data: ScenarioComparison }>('/api/v1/org-scenarios');
      const result = response?.data;
      if (result?.scenarios) {
        setData(result);
      } else {
        setData({ scenarios: [] });
      }
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
          title={t('stagingComparison.title')}
          description={t('stagingComparison.description')}
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

  const scenarios = data?.scenarios ?? [];
  const baseline = scenarios.find((s) => s.isBaseline);
  const alternatives = scenarios.filter((s) => !s.isBaseline);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t('stagingComparison.title')}
        description={t('stagingComparison.description')}
      >
        <Button size="sm">
          <GitCompare className="h-4 w-4 mr-2" />
          {t('stagingComparison.newScenario')}
        </Button>
      </PageHeader>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : scenarios.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <GitCompare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nessuno scenario organizzativo disponibile. Creare scenari per confrontarli.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Scenario Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scenarios.map((s) => (
              <Card key={s.id} className={s.isBaseline ? 'border-primary/30' : ''}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-3 w-3 rounded-full ${s.isBaseline ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    />
                    <div>
                      <p className="font-medium text-sm text-foreground">{s.name}</p>
                      {s.isBaseline && (
                        <Badge variant="default" className="mt-1 text-xs">
                          Baseline
                        </Badge>
                      )}
                      {s.description && (
                        <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparison Table */}
          {baseline && alternatives.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitCompare className="h-5 w-5 text-primary" />
                  Confronto Metriche
                </CardTitle>
                <CardDescription>
                  Impatto stimato sui principali indicatori organizzativi
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                          Metrica
                        </th>
                        <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">
                          {baseline.name}
                        </th>
                        {alternatives.map((alt) => (
                          <th
                            key={alt.id}
                            className="text-center py-3 px-2 text-sm font-medium text-muted-foreground"
                          >
                            {alt.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Headcount', key: 'headcount' as const },
                        { label: 'Dipartimenti', key: 'departments' as const },
                        { label: 'Span of Control', key: 'spanOfControl' as const },
                      ].map((metric) => {
                        const baseVal = baseline[metric.key];
                        if (baseVal == null) return null;
                        return (
                          <tr
                            key={metric.label}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-3 px-2">
                              <span className="text-sm font-medium text-foreground">
                                {metric.label}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className="text-sm font-bold text-foreground">{baseVal}</span>
                            </td>
                            {alternatives.map((alt) => {
                              const altVal = alt[metric.key];
                              if (altVal == null)
                                return (
                                  <td
                                    key={alt.id}
                                    className="py-3 px-2 text-center text-muted-foreground"
                                  >
                                    -
                                  </td>
                                );
                              return (
                                <td key={alt.id} className="py-3 px-2 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className="text-sm font-medium text-foreground">
                                      {altVal}
                                    </span>
                                    <TrendIcon current={baseVal} value={altVal} />
                                    <span className="text-xs text-muted-foreground">
                                      ({(((altVal - baseVal) / baseVal) * 100).toFixed(1)}%)
                                    </span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
