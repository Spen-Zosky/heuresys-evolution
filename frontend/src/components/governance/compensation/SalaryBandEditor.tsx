'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSalaryBands } from '@/lib/hooks/use-governance-queries';
import type { SalaryBand } from '@/lib/api/endpoints/governance';

function formatCurrency(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function RangeBar({
  min,
  mid,
  max,
  actual,
}: {
  min: number;
  mid: number;
  max: number;
  actual?: number;
}) {
  const range = max - min;
  if (range <= 0) return null;

  const midPct = ((mid - min) / range) * 100;

  return (
    <div className="relative h-2 w-full rounded-full bg-muted overflow-visible">
      <div
        className="absolute left-0 top-0 h-full rounded-full bg-primary/20"
        style={{ width: '100%' }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 bg-primary"
        style={{ left: `${midPct}%` }}
        title={`Mid: ${formatCurrency(mid)}`}
      />
      {actual != null && actual >= min && actual <= max && (
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3 w-1.5 rounded-sm bg-blue-500"
          style={{ left: `${((actual - min) / range) * 100}%` }}
          title={`Attuale: ${formatCurrency(actual)}`}
        />
      )}
    </div>
  );
}

function CompaRatioIcon({ ratio }: { ratio?: number }) {
  if (ratio == null) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (ratio > 1.05) return <TrendingUp className="h-3 w-3 text-amber-500" />;
  if (ratio < 0.9) return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-green-500" />;
}

function BandRow({ band }: { band: SalaryBand }) {
  const spread =
    band.range_spread_percent != null
      ? parseFloat(String(band.range_spread_percent)).toFixed(0)
      : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,80px)_120px_60px_60px] items-center gap-3 border-b py-3 text-sm last:border-0">
      <div className="min-w-0">
        <p className="font-medium truncate">{band.band_name}</p>
        <p className="text-xs text-muted-foreground">
          {band.band_code} · {band.job_family ?? '—'}
        </p>
      </div>
      <div className="text-right tabular-nums text-xs text-muted-foreground">
        {formatCurrency(parseFloat(String(band.min_salary)), band.currency)}
      </div>
      <div className="text-right tabular-nums text-xs font-medium">
        {formatCurrency(parseFloat(String(band.mid_salary)), band.currency)}
      </div>
      <div className="text-right tabular-nums text-xs text-muted-foreground">
        {formatCurrency(parseFloat(String(band.max_salary)), band.currency)}
      </div>
      <div className="px-1">
        <RangeBar
          min={parseFloat(String(band.min_salary))}
          mid={parseFloat(String(band.mid_salary))}
          max={parseFloat(String(band.max_salary))}
        />
      </div>
      <div className="text-center text-xs text-muted-foreground">
        {spread != null ? `${spread}%` : '—'}
      </div>
      <div className="flex justify-center">
        <Badge variant={band.is_active ? 'default' : 'secondary'} className="text-xs">
          {band.is_active ? 'Attiva' : 'Inattiva'}
        </Badge>
      </div>
    </div>
  );
}

export function SalaryBandEditor() {
  const [showInactive, setShowInactive] = useState(false);
  const { data, isLoading } = useSalaryBands({
    active: showInactive ? undefined : true,
    limit: 100,
  });

  const bands = data?.items ?? [];

  const byLevel = bands.reduce<Record<string, SalaryBand[]>>((acc, b) => {
    const level = b.job_level ?? 'N.D.';
    if (!acc[level]) acc[level] = [];
    acc[level].push(b);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {bands.length} bande salariali {!showInactive ? 'attive' : 'totali'}
        </p>
        <button
          onClick={() => setShowInactive((v) => !v)}
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          {showInactive ? 'Mostra solo attive' : 'Mostra anche inattive'}
        </button>
      </div>

      {Object.keys(byLevel).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nessuna banda salariale trovata.
          </CardContent>
        </Card>
      ) : (
        Object.entries(byLevel)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([level, levelBands]) => (
            <Card key={level}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Job Level: {level}
                  <Badge variant="outline" className="text-xs">
                    {levelBands.length} bande
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,80px)_120px_60px_60px] gap-3 text-xs text-muted-foreground mb-1 px-0">
                  <span>Banda</span>
                  <span className="text-right">Min</span>
                  <span className="text-right">Mid</span>
                  <span className="text-right">Max</span>
                  <span className="text-center">Range</span>
                  <span className="text-center">Spread</span>
                  <span className="text-center">Stato</span>
                </div>
                {levelBands.map((band) => (
                  <BandRow key={band.id} band={band} />
                ))}
              </CardContent>
            </Card>
          ))
      )}
    </div>
  );
}
