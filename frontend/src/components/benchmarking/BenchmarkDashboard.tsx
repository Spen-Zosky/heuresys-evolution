'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, Users, AlertCircle } from 'lucide-react';
import { useMyPosition } from '@/lib/hooks/use-benchmark-queries';
import type { MetricComparison, BenchmarkPosition } from '@/lib/api/endpoints/benchmarking';
import { cn } from '@/lib/utils';

// =============================================================================
// HELPERS
// =============================================================================

function positionBadge(position: BenchmarkPosition) {
  switch (position) {
    case 'above_average':
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
          <TrendingUp className="h-3 w-3" />
          Sopra media
        </Badge>
      );
    case 'below_average':
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 gap-1">
          <TrendingDown className="h-3 w-3" />
          Sotto media
        </Badge>
      );
    case 'at_average':
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1">
          <Minus className="h-3 w-3" />
          Nella media
        </Badge>
      );
    default:
      return <Badge variant="outline">Dati insufficienti</Badge>;
  }
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return '—';
  if (unit === '%') return `${value.toFixed(1)}%`;
  return `${value.toFixed(1)} ${unit}`;
}

function barPercent(tenantValue: number | null, industryAvg: number | null): number {
  if (tenantValue === null || industryAvg === null || industryAvg === 0) return 0;
  return Math.min(Math.round((tenantValue / (industryAvg * 1.5)) * 100), 100);
}

function industryBarPercent(industryAvg: number | null, maxRef: number | null): number {
  if (industryAvg === null || maxRef === null || maxRef === 0) return 0;
  return Math.min(Math.round((industryAvg / (maxRef * 1.5)) * 100), 100);
}

// =============================================================================
// METRIC CARD
// =============================================================================

function MetricCard({ metric }: { metric: MetricComparison }) {
  const tenantPct = barPercent(metric.tenantValue, metric.industryAvg);
  const industryPct = industryBarPercent(
    metric.industryAvg,
    Math.max(metric.tenantValue ?? 0, metric.industryAvg ?? 0)
  );

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-foreground">{metric.label}</p>
            {metric.peerCount > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Users className="h-3 w-3" />
                {metric.peerCount} aziend{metric.peerCount === 1 ? 'a' : 'e'} comparabili
              </p>
            )}
          </div>
          {positionBadge(metric.position)}
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Il tuo valore</span>
              <span className="font-semibold">{formatValue(metric.tenantValue, metric.unit)}</span>
            </div>
            <Progress
              value={tenantPct}
              className={cn(
                'h-2',
                metric.position === 'above_average' && '[&>div]:bg-green-500',
                metric.position === 'below_average' && '[&>div]:bg-red-500',
                metric.position === 'at_average' && '[&>div]:bg-blue-500'
              )}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Media settore</span>
              <span className="font-medium text-muted-foreground">
                {formatValue(metric.industryAvg, metric.unit)}
              </span>
            </div>
            <Progress value={industryPct} className="h-2 [&>div]:bg-gray-300" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function BenchmarkSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-5 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function BenchmarkDashboard() {
  const { data, isLoading, isError } = useMyPosition();

  if (isLoading) return <BenchmarkSkeleton />;

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-6 w-6" />
          <p className="text-sm">Impossibile caricare i dati di benchmarking.</p>
        </CardContent>
      </Card>
    );
  }

  const aboveCount = data.metrics.filter((m) => m.position === 'above_average').length;
  const belowCount = data.metrics.filter((m) => m.position === 'below_average').length;
  const atCount = data.metrics.filter((m) => m.position === 'at_average').length;

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Posizionamento {data.tenantName}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {data.naceCode && (
              <Badge variant="outline" className="text-xs">
                NACE {data.naceCode}
              </Badge>
            )}
            {data.companySizeCode && (
              <Badge variant="outline" className="text-xs">
                {data.companySizeCode}
              </Badge>
            )}
            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
              {aboveCount} metriche sopra media
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
              {atCount} nella media
            </Badge>
            <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
              {belowCount} sotto media
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.metric} metric={metric} />
        ))}
      </div>
    </div>
  );
}
