'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useMyPosition } from '@/lib/hooks/use-benchmark-queries';
import type { MetricComparison, BenchmarkPosition } from '@/lib/api/endpoints/benchmarking';
import { cn } from '@/lib/utils';

// =============================================================================
// HELPERS
// =============================================================================

function formatValue(value: number | null, unit: string): string {
  if (value === null) return '—';
  if (unit === '%') return `${value.toFixed(1)}%`;
  return value.toFixed(1);
}

function deltaText(tenantValue: number | null, industryAvg: number | null, unit: string): string {
  if (tenantValue === null || industryAvg === null || industryAvg === 0) return '—';
  const delta = ((tenantValue - industryAvg) / industryAvg) * 100;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(0)}%`;
}

function positionIcon(position: BenchmarkPosition) {
  switch (position) {
    case 'above_average':
      return <ArrowUp className="h-4 w-4 text-green-600" />;
    case 'below_average':
      return <ArrowDown className="h-4 w-4 text-red-500" />;
    case 'at_average':
      return <Minus className="h-4 w-4 text-blue-500" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

function positionClass(position: BenchmarkPosition): string {
  switch (position) {
    case 'above_average':
      return 'text-green-700 bg-green-50';
    case 'below_average':
      return 'text-red-700 bg-red-50';
    case 'at_average':
      return 'text-blue-700 bg-blue-50';
    default:
      return 'text-muted-foreground bg-muted';
  }
}

// =============================================================================
// TABLE ROW
// =============================================================================

function MetricRow({ metric }: { metric: MetricComparison }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-3 pr-4">
        <span className="text-sm font-medium text-foreground">{metric.label}</span>
        {metric.unit !== '' && (
          <span className="ml-1 text-xs text-muted-foreground">({metric.unit})</span>
        )}
      </td>
      <td className="py-3 pr-4 text-sm font-semibold text-right">
        {formatValue(metric.tenantValue, metric.unit)}
      </td>
      <td className="py-3 pr-4 text-sm text-muted-foreground text-right">
        {formatValue(metric.industryAvg, metric.unit)}
      </td>
      <td className="py-3 pr-4 text-sm text-right">
        <span
          className={cn(
            'text-xs font-medium',
            metric.position === 'above_average'
              ? 'text-green-700'
              : metric.position === 'below_average'
                ? 'text-red-600'
                : 'text-muted-foreground'
          )}
        >
          {deltaText(metric.tenantValue, metric.industryAvg, metric.unit)}
        </span>
      </td>
      <td className="py-3 text-right">
        <span
          className={cn(
            'inline-flex items-center justify-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
            positionClass(metric.position)
          )}
        >
          {positionIcon(metric.position)}
          {metric.position === 'above_average' && 'Sopra'}
          {metric.position === 'at_average' && 'Nella media'}
          {metric.position === 'below_average' && 'Sotto'}
          {metric.position === 'no_data' && 'N/D'}
        </span>
      </td>
    </tr>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function IndustryComparison() {
  const { data, isLoading, isError } = useMyPosition();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-52" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-6 w-6" />
          <p className="text-sm">Dati di confronto non disponibili.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          Tabella Confronto Settore
          {data.naceCode && (
            <Badge variant="outline" className="text-xs font-normal">
              NACE {data.naceCode}
            </Badge>
          )}
        </CardTitle>
        {data.metrics[0]?.peerCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Benchmark calcolato su {data.metrics[0].peerCount} aziend
            {data.metrics[0].peerCount === 1 ? 'a' : 'e'} dello stesso settore (dati anonimizzati)
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="pb-2 text-left font-medium">Metrica</th>
                <th className="pb-2 text-right font-medium">Tuo valore</th>
                <th className="pb-2 text-right font-medium">Media settore</th>
                <th className="pb-2 text-right font-medium">Delta</th>
                <th className="pb-2 text-right font-medium">Posizione</th>
              </tr>
            </thead>
            <tbody>
              {data.metrics.map((metric) => (
                <MetricRow key={metric.metric} metric={metric} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
