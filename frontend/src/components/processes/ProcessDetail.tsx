'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProcessCategoryBadge } from './ProcessCategoryBadge';
import { ProcessSkillCoverage } from './ProcessSkillCoverage';
import { KpiCascadeView } from '@/components/analytics/KpiCascadeView';
import { useProcessDeep } from '@/lib/hooks/use-process-queries';
import { AlertCircle, Clock, Layers, Shield, Target, Users } from 'lucide-react';
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

interface ProcessDetailProps {
  processId: string;
}

export function ProcessDetail({ processId }: ProcessDetailProps) {
  const { data, isLoading, isError, refetch } = useProcessDeep(processId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-semibold">Errore nel caricamento del processo</p>
            <Button variant="outline" onClick={() => refetch()}>
              Riprova
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const process = data.process as Record<string, unknown>;
  const phases = (data.phases || []) as Record<string, unknown>[];
  const roles = (data.roles || []) as Record<string, unknown>[];
  const kpis = (data.kpis || []) as Record<string, unknown>[];
  const skillRequirements = (data.skillRequirements || []) as Record<string, unknown>[];

  const processName = (process.process_name as string) || (process.processName as string) || '';
  const processCode = (process.process_code as string) || (process.processCode as string) || '';
  const processCategory =
    (process.process_category as string) || (process.processCategory as string) || '';
  const valueChainPosition =
    (process.value_chain_position as number) ?? (process.valueChainPosition as number) ?? 0;
  const processDescription = process.description as string | null;

  const stats = [
    { label: 'Fasi', value: phases.length, icon: Layers },
    { label: 'Ruoli', value: roles.length, icon: Users },
    { label: 'Competenze', value: skillRequirements.length, icon: Shield },
    { label: 'KPI', value: kpis.length, icon: Target },
  ];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="phases">Fasi</TabsTrigger>
          <TabsTrigger value="roles">Ruoli</TabsTrigger>
          <TabsTrigger value="skills">Competenze</TabsTrigger>
          <TabsTrigger value="kpis">KPI</TabsTrigger>
        </TabsList>

        {/* Tab Panoramica */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">{processCode}</span>
                    <ProcessCategoryBadge category={processCategory} />
                  </div>
                  <h2 className="text-xl font-bold">{processName}</h2>
                  {processDescription && (
                    <p className="text-sm text-muted-foreground">{processDescription}</p>
                  )}
                  <p className="text-sm">
                    <span className="text-muted-foreground">Posizione catena del valore:</span>{' '}
                    <span className="font-medium">{valueChainPosition}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab Fasi */}
        <TabsContent value="phases" className="space-y-3">
          {phases.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">Nessuna fase configurata</p>
              </CardContent>
            </Card>
          ) : (
            phases
              .sort((a, b) => {
                const orderA = (a.phase_order ?? a.phaseOrder ?? 0) as number;
                const orderB = (b.phase_order ?? b.phaseOrder ?? 0) as number;
                return orderA - orderB;
              })
              .map((phase, idx) => {
                const phaseName = (phase.phase_name ?? phase.phaseName ?? '') as string;
                const phaseCode = (phase.phase_code ?? phase.phaseCode ?? '') as string;
                const phaseOrder = (phase.phase_order ?? phase.phaseOrder ?? 0) as number;
                const duration = (phase.estimated_duration_days ??
                  phase.estimatedDurationDays ??
                  null) as number | null;
                const isOptional = (phase.is_optional ?? phase.isOptional ?? false) as boolean;
                const description = phase.description as string | null;

                return (
                  <div key={phase.id as string} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                        {phaseOrder}
                      </div>
                      {idx < phases.length - 1 && (
                        <Separator orientation="vertical" className="flex-1 my-1" />
                      )}
                    </div>
                    <Card className="flex-1 mb-2">
                      <CardContent className="py-4">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            {phaseCode}
                          </span>
                          <h3 className="font-semibold">{phaseName}</h3>
                          {isOptional && <Badge variant="secondary">Opzionale</Badge>}
                        </div>
                        {description && (
                          <p className="text-sm text-muted-foreground mb-1">{description}</p>
                        )}
                        {duration != null && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{duration} giorni stimati</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })
          )}
        </TabsContent>

        {/* Tab Ruoli */}
        <TabsContent value="roles">
          {roles.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">Nessun ruolo configurato</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map((role) => {
                const roleName = (role.role_name ?? role.roleName ?? '') as string;
                const roleType = (role.role_type ?? role.roleType ?? '') as string;
                const minHc = (role.min_headcount ?? role.minHeadcount ?? null) as number | null;
                const maxHc = (role.max_headcount ?? role.maxHeadcount ?? null) as number | null;
                const description = role.description as string | null;

                return (
                  <Card key={role.id as string}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{roleName}</CardTitle>
                        <Badge variant="outline" className={cn(roleTypeStyles[roleType] || '')}>
                          {roleTypeLabels[roleType] || roleType}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {description && (
                        <p className="text-sm text-muted-foreground mb-2">{description}</p>
                      )}
                      {(minHc != null || maxHc != null) && (
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            Headcount: {minHc ?? '?'}
                            {maxHc != null ? `–${maxHc}` : '+'}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab Competenze */}
        <TabsContent value="skills">
          <ProcessSkillCoverage processId={processId} />
        </TabsContent>

        {/* Tab KPI */}
        <TabsContent value="kpis">
          <KpiCascadeView processId={processId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
