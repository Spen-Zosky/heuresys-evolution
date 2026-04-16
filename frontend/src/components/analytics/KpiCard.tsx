'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { KpiCascadeItem } from '@/lib/api/endpoints/process-layer';

const directionConfig = {
  higher_better: { icon: ArrowUp, label: 'Piu alto = meglio', color: 'text-green-600' },
  lower_better: { icon: ArrowDown, label: 'Piu basso = meglio', color: 'text-blue-600' },
  target_range: { icon: ArrowUpDown, label: 'Range target', color: 'text-amber-600' },
};

const alignmentConfig = {
  aligned: { label: 'Allineato', className: 'bg-green-100 text-green-800 border-green-200' },
  partial: { label: 'Parziale', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  unaligned: { label: 'Non allineato', className: 'bg-red-100 text-red-800 border-red-200' },
};

interface KpiCardProps {
  kpi: KpiCascadeItem;
}

export function KpiCard({ kpi }: KpiCardProps) {
  const direction = kpi.targetDirection ? directionConfig[kpi.targetDirection] : null;
  const alignment = alignmentConfig[kpi.alignmentStatus];

  let benchmark: string | null = null;
  if (kpi.benchmarkValue != null) {
    benchmark = `${kpi.benchmarkValue}${kpi.measurementUnit ? ' ' + kpi.measurementUnit : ''}`;
  } else if (kpi.benchmarkMin != null && kpi.benchmarkMax != null) {
    benchmark = `${kpi.benchmarkMin}–${kpi.benchmarkMax}${kpi.measurementUnit ? ' ' + kpi.measurementUnit : ''}`;
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <span className="font-mono text-xs text-muted-foreground">{kpi.kpiCode}</span>
            <CardTitle className="text-sm font-semibold leading-tight">{kpi.kpiName}</CardTitle>
          </div>
          <Badge variant="outline" className={alignment.className}>
            {alignment.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {kpi.phaseName && <p className="text-xs text-muted-foreground">Fase: {kpi.phaseName}</p>}
        {kpi.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{kpi.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {direction && (
            <div className={`flex items-center gap-1 text-xs ${direction.color}`}>
              <direction.icon className="h-3.5 w-3.5" />
              <span>{direction.label}</span>
            </div>
          )}
          {benchmark && (
            <span className="text-xs font-medium">
              Target: <span className="font-bold">{benchmark}</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
