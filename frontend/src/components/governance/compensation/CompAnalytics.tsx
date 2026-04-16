'use client';

import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompaRatioByDept, usePayEquityData } from '@/lib/hooks/use-governance-queries';
import type { CompaRatioRecord, PayEquityRecord } from '@/lib/api/endpoints/governance';

function CompaRatioBar({ value, max = 1.4 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value > 1.15 ? 'bg-amber-400' : value < 0.85 ? 'bg-red-400' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={`text-xs tabular-nums w-10 text-right font-medium ${
          value > 1.15 || value < 0.85 ? 'text-amber-600' : 'text-foreground'
        }`}
      >
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function CompaRatioDeptTable({ rows }: { rows: CompaRatioRecord[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nessun dato compa-ratio disponibile.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_160px_repeat(3,52px)] gap-2 text-xs text-muted-foreground px-1">
        <span>Reparto</span>
        <span>Compa-Ratio medio</span>
        <span className="text-center">Sotto</span>
        <span className="text-center">In range</span>
        <span className="text-center">Sopra</span>
      </div>
      {rows.map((row, idx) => {
        const ratio = parseFloat(String(row.avg_compa_ratio ?? 1));
        const isOutlier = ratio < 0.85 || ratio > 1.15;
        return (
          <div
            key={idx}
            className={`grid grid-cols-[minmax(0,1fr)_160px_repeat(3,52px)] items-center gap-2 rounded-md px-1 py-1.5 text-sm ${
              isOutlier ? 'bg-amber-50' : ''
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {isOutlier && <AlertCircle className="h-3 w-3 shrink-0 text-amber-500" />}
              <span className="truncate">{row.department_name ?? 'N.D.'}</span>
            </div>
            <CompaRatioBar value={ratio} />
            <span className="text-center text-xs tabular-nums text-red-600">
              {row.below_range ?? 0}
            </span>
            <span className="text-center text-xs tabular-nums text-green-600">
              {row.in_range ?? 0}
            </span>
            <span className="text-center text-xs tabular-nums text-amber-600">
              {row.above_range ?? 0}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function GenderEquityTable({ rows }: { rows: PayEquityRecord[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nessun dato equity disponibile.
      </p>
    );
  }

  const genderMap = rows.reduce<Record<string, PayEquityRecord[]>>((acc, r) => {
    const key = r.gender ?? 'N.D.';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(genderMap).map(([gender, gRows]) => {
        const avgSalary =
          gRows.reduce((s, r) => s + parseFloat(String(r.avg_salary ?? 0)), 0) / gRows.length;
        const avgGap =
          gRows.reduce((s, r) => s + Math.abs(parseFloat(String(r.pay_gap_pct ?? 0))), 0) /
          gRows.length;

        const gapColor =
          avgGap < 5 ? 'text-green-600' : avgGap < 10 ? 'text-amber-600' : 'text-red-600';

        return (
          <div key={gender} className="rounded-md border p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{gender}</Badge>
                <span className="text-xs text-muted-foreground">
                  {gRows.reduce((s, r) => s + (r.employee_count ?? 0), 0)} dipendenti
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium">
                  {new Intl.NumberFormat('it-IT', {
                    style: 'currency',
                    currency: 'EUR',
                    maximumFractionDigits: 0,
                  }).format(avgSalary)}
                </span>
                <span className={`text-xs ml-2 ${gapColor}`}>gap {avgGap.toFixed(1)}%</span>
              </div>
            </div>
            <div className="space-y-1">
              {gRows.map((r, i) => {
                const gap = parseFloat(String(r.pay_gap_pct ?? 0));
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <span>{r.department_name ?? 'N.D.'}</span>
                    <span className={Math.abs(gap) > 10 ? 'text-red-500' : ''}>
                      {gap >= 0 ? '+' : ''}
                      {gap.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CompAnalytics() {
  const { data: compaRows, isLoading: compaLoading } = useCompaRatioByDept();
  const { data: equityRows, isLoading: equityLoading } = usePayEquityData();

  const isLoading = compaLoading || equityLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const outlierCount = (compaRows ?? []).filter((r) => {
    const ratio = parseFloat(String(r.avg_compa_ratio ?? 1));
    return ratio < 0.85 || ratio > 1.15;
  }).length;

  return (
    <div className="space-y-6">
      {outlierCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {outlierCount} repart{outlierCount === 1 ? 'o' : 'i'} con compa-ratio fuori dal range
          ottimale (0.85–1.15)
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compa-Ratio per reparto</CardTitle>
        </CardHeader>
        <CardContent>
          <CompaRatioDeptTable rows={compaRows ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Analisi equità retributiva (gender pay gap)</CardTitle>
        </CardHeader>
        <CardContent>
          <GenderEquityTable rows={equityRows ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
