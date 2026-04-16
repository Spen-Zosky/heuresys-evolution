'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { OrgUnitBadge } from './OrgUnitBadge';
import {
  useOrgUnit,
  useOrgUnitEmployees,
  useOrgUnitCoverage,
  useOrgUnits,
  useOrgUnitSkillGaps,
} from '@/lib/hooks/use-org-queries';
import { GapSummaryCard } from '@/components/analytics/GapSummaryCard';
import { SkillGapChart } from '@/components/analytics/SkillGapChart';
import { AlertCircle, Building2, Users, Award, BarChart3, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { EntityLink } from '@/components/navigation/EntityLink';

const levelColors = [
  '',
  'bg-red-100 text-red-800 border-red-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-green-100 text-green-800 border-green-200',
];

function coverageColor(coverage: number): string {
  if (coverage >= 70) return 'bg-green-500';
  if (coverage >= 30) return 'bg-yellow-500';
  return 'bg-red-500';
}

interface OrgUnitDetailProps {
  orgUnitId: string;
}

export function OrgUnitDetail({ orgUnitId }: OrgUnitDetailProps) {
  const { data: orgUnit, isLoading, isError, refetch } = useOrgUnit(orgUnitId);
  const { data: employees, isLoading: employeesLoading } = useOrgUnitEmployees(orgUnitId);
  const { data: coverage, isLoading: coverageLoading } = useOrgUnitCoverage(orgUnitId);
  const { data: allUnits } = useOrgUnits({ parent_id: orgUnitId, limit: 100 });
  const { data: skillGaps, isLoading: gapsLoading } = useOrgUnitSkillGaps(orgUnitId);

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

  if (isError || !orgUnit) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-semibold">Errore nel caricamento dell&apos;unita organizzativa</p>
            <Button variant="outline" onClick={() => refetch()}>
              Riprova
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const headcount = orgUnit.employee_count ?? employees?.length ?? 0;
  const childUnits = allUnits ?? [];

  const stats = [
    { label: 'Dipendenti', value: headcount, icon: Users },
    { label: 'Sotto-unita', value: childUnits.length, icon: Building2 },
    { label: 'Competenze', value: coverage?.length ?? 0, icon: Award },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{orgUnit.code}</span>
                <OrgUnitBadge orgType={orgUnit.org_type || ''} />
                {!orgUnit.is_active && <Badge variant="secondary">Inattiva</Badge>}
              </div>
              <h2 className="text-xl font-bold">{orgUnit.name}</h2>
              {orgUnit.description && (
                <p className="text-sm text-muted-foreground">{orgUnit.description}</p>
              )}
              {orgUnit.manager_name && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Manager:</span>{' '}
                  <span className="font-medium">{orgUnit.manager_name}</span>
                </p>
              )}
              {orgUnit.parent_id && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Unità superiore:</span>{' '}
                  <Link
                    href={`/company-pet/structure/${orgUnit.parent_id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {orgUnit.department_name || 'Vai alla parent'}
                  </Link>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="people">Persone</TabsTrigger>
          <TabsTrigger value="skills">Competenze</TabsTrigger>
          <TabsTrigger value="gaps">Gap Analysis</TabsTrigger>
          <TabsTrigger value="kpi">KPI</TabsTrigger>
        </TabsList>

        {/* Tab Panoramica */}
        <TabsContent value="overview" className="space-y-4">
          {childUnits.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sotto-unita ({childUnits.length})</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-center">Dipendenti</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {childUnits.map((child) => (
                      <TableRow key={child.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <EntityLink type="org_unit" id={child.id}>
                            {child.name}
                          </EntityLink>
                        </TableCell>
                        <TableCell>
                          <OrgUnitBadge orgType={child.org_type || ''} />
                        </TableCell>
                        <TableCell className="text-center">{child.employee_count ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">Nessuna sotto-unita configurata</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Persone */}
        <TabsContent value="people">
          {employeesLoading ? (
            <Card>
              <CardContent className="py-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : employees && employees.length > 0 ? (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Ruolo</TableHead>
                      <TableHead className="text-center">Competenze</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">
                          <EntityLink type="employee" id={emp.id}>
                            {emp.first_name} {emp.last_name}
                          </EntityLink>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                        <TableCell>{emp.job_title || '–'}</TableCell>
                        <TableCell className="text-center">{emp.skill_count ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : (
            <EmptyState
              type="default"
              title="Nessun dipendente"
              description="Non ci sono dipendenti assegnati a questa unita organizzativa."
              size="sm"
            />
          )}
        </TabsContent>

        {/* Tab Competenze */}
        <TabsContent value="skills">
          {coverageLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="py-4">
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-2 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : coverage && coverage.length > 0 ? (
            <div className="space-y-3">
              {coverage.map((skill) => (
                <Card key={skill.skillId}>
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <span className="font-medium flex-1">{skill.skillLabel}</span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(levelColors[skill.proficiencyLevel] || '')}
                        >
                          Livello {skill.proficiencyLevel}
                        </Badge>
                        <Badge variant={skill.isMandatory ? 'default' : 'secondary'}>
                          {skill.isMandatory ? 'Obbligatoria' : 'Opzionale'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress
                        value={skill.employeeCoverage}
                        className={cn(
                          'flex-1 h-2',
                          `[&>div]:${coverageColor(skill.employeeCoverage)}`
                        )}
                      />
                      <span className="text-sm font-medium w-12 text-right">
                        {Math.round(skill.employeeCoverage)}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              type="default"
              title="Nessuna competenza mappata"
              description="Non ci sono dati di copertura competenze per questa unita organizzativa."
              size="sm"
            />
          )}
        </TabsContent>

        {/* Tab Gap Analysis */}
        <TabsContent value="gaps">
          {gapsLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            </div>
          ) : skillGaps ? (
            <div className="space-y-6">
              <GapSummaryCard gaps={skillGaps} />
              <SkillGapChart gaps={skillGaps} />
              <div className="flex justify-end">
                <Link
                  href={`/company-pet/structure/${orgUnitId}/gaps`}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                  Apri vista completa
                </Link>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground text-sm">
                  Nessun dato di gap disponibile
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab KPI */}
        <TabsContent value="kpi">
          <Card>
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-2 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground" />
                <p className="font-semibold">KPI Unità Organizzativa</p>
                <p className="text-sm text-muted-foreground">
                  Le metriche KPI per questa unita saranno disponibili in una futura release.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
