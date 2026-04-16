'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from './KpiCard';
import { useProcessKpiCascade } from '@/lib/hooks/use-process-queries';
import { AlertCircle, Building2, ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const roleTypeStyles: Record<string, string> = {
  owner: 'bg-blue-100 text-blue-800 border-blue-200',
  executor: 'bg-green-100 text-green-800 border-green-200',
  approver: 'bg-purple-100 text-purple-800 border-purple-200',
  reviewer: 'bg-amber-100 text-amber-800 border-amber-200',
  informed: 'bg-gray-100 text-gray-800 border-gray-200',
};

const roleTypeLabels: Record<string, string> = {
  owner: 'Owner',
  executor: 'Executor',
  approver: 'Approver',
  reviewer: 'Reviewer',
  informed: 'Informed',
};

const responsibilityLabels: Record<string, string> = {
  primary: 'Primaria',
  secondary: 'Secondaria',
  support: 'Supporto',
};

interface KpiCascadeViewProps {
  processId: string;
}

export function KpiCascadeView({ processId }: KpiCascadeViewProps) {
  const { data, isLoading, isError } = useProcessKpiCascade(processId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">Impossibile caricare la cascata KPI</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.kpis.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Nessun KPI configurato per questo processo
          </p>
        </CardContent>
      </Card>
    );
  }

  const alignedCount = data.kpis.filter((k) => k.alignmentStatus === 'aligned').length;
  const partialCount = data.kpis.filter((k) => k.alignmentStatus === 'partial').length;
  const unalignedCount = data.kpis.filter((k) => k.alignmentStatus === 'unaligned').length;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 p-3 bg-muted/40 rounded-lg">
        <span className="text-sm font-medium text-muted-foreground">Alignment:</span>
        <span className="flex items-center gap-1.5 text-sm">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
          <span>{alignedCount} allineati</span>
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>{partialCount} parziali</span>
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
          <span>{unalignedCount} non allineati</span>
        </span>
      </div>

      {/* KPI cascade tree */}
      <div className="space-y-4">
        {data.kpis.map((kpi) => (
          <div key={kpi.id} className="space-y-2">
            {/* KPI card row */}
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-center pt-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                {kpi.roles.length > 0 && (
                  <div className="w-px flex-1 bg-border mt-1" style={{ minHeight: 20 }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <KpiCard kpi={kpi} />
              </div>
            </div>

            {/* Roles row */}
            {kpi.roles.length > 0 && (
              <div className="ml-4 flex items-start gap-2">
                <div className="flex flex-col items-center pt-1">
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    Ruoli coinvolti
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {kpi.roles.map((role) => (
                      <div key={role.id} className="flex items-center gap-1">
                        <Badge
                          variant="outline"
                          className={cn('text-xs', roleTypeStyles[role.roleType] || '')}
                        >
                          {roleTypeLabels[role.roleType] || role.roleType}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {role.roleName}
                          {role.occupationLabel && ` (${role.occupationLabel})`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Org units section */}
      {data.orgUnits.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Org Unit responsabili</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.orgUnits.map((ou) => {
              const coveragePct =
                ou.totalEmployees > 0
                  ? Math.round((ou.employeesWithGoals / ou.totalEmployees) * 100)
                  : 0;
              return (
                <Card key={ou.templateId} className="bg-muted/30">
                  <CardHeader className="pb-1 pt-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-medium">{ou.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {responsibilityLabels[ou.responsibilityLevel] || ou.responsibilityLevel}
                      </Badge>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{ou.code}</span>
                  </CardHeader>
                  <CardContent className="pb-3 px-4">
                    {ou.totalEmployees > 0 ? (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Dipendenti con obiettivi</span>
                          <span>
                            {ou.employeesWithGoals}/{ou.totalEmployees}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              coveragePct >= 60
                                ? 'bg-green-500'
                                : coveragePct > 0
                                  ? 'bg-amber-500'
                                  : 'bg-red-400'
                            )}
                            style={{ width: `${coveragePct}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {coveragePct}% copertura obiettivi
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nessun dipendente mappato</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
