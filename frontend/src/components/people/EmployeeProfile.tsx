'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkillProfileCard } from './SkillProfileCard';
import { QualificationScore } from './QualificationScore';
import {
  useEmployee,
  useEmployeeSkills,
  useEmployeeQualification,
  useEmployeeGapAnalysis,
} from '@/lib/hooks/use-people-queries';
import {
  AlertCircle,
  Briefcase,
  Building2,
  Calendar,
  Mail,
  Shield,
  TrendingUp,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { EntityLink } from '@/components/navigation/EntityLink';

interface EmployeeProfileProps {
  employeeId: string;
}

export function EmployeeProfile({ employeeId }: EmployeeProfileProps) {
  const { data: employee, isLoading, isError, refetch } = useEmployee(employeeId);
  const { data: skills, isLoading: skillsLoading } = useEmployeeSkills(employeeId);
  const { data: qualifications, isLoading: qualLoading } = useEmployeeQualification(employeeId);
  const { data: gapAnalysis, isLoading: gapLoading } = useEmployeeGapAnalysis(employeeId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !employee) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-semibold">Errore nel caricamento del profilo</p>
            <Button variant="outline" onClick={() => refetch()}>
              Riprova
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hireDate = employee.hire_date
    ? new Date(employee.hire_date).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const skillCount = skills?.length ?? 0;
  const qualCount = qualifications?.length ?? 0;
  const avgQual =
    qualCount > 0
      ? Math.round(
          qualifications!.reduce((sum, q) => sum + q.qualificationScore * 100, 0) / qualCount
        )
      : 0;
  const gapCount = gapAnalysis?.gap_count ?? 0;

  const stats = [
    { label: 'Competenze', value: skillCount, icon: Shield },
    { label: 'Processi', value: qualCount, icon: Briefcase },
    { label: 'Qualificazione Media', value: `${avgQual}%`, icon: TrendingUp },
    { label: 'Gap Skill', value: gapCount, icon: AlertCircle },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary shrink-0">
              <User className="h-8 w-8" />
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="text-xl font-bold">
                {employee.first_name} {employee.last_name}
              </h2>
              {employee.job_title && <p className="text-muted-foreground">{employee.job_title}</p>}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {employee.email}
                </span>
                {employee.org_unit_name && (
                  <Link
                    href={`/company-pet/structure/${employee.org_unit_id}`}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    {employee.org_unit_name}
                  </Link>
                )}
                {hireDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Dal {hireDate}
                  </span>
                )}
              </div>
              <div className="mt-2">
                <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                  {employee.is_active ? 'Attivo' : 'Inattivo'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
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

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="skills">Competenze</TabsTrigger>
          <TabsTrigger value="qualification">Qualificazione Processi</TabsTrigger>
          <TabsTrigger value="gap">Gap Analysis</TabsTrigger>
        </TabsList>

        {/* Tab Panoramica */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informazioni</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Nome completo</dt>
                  <dd className="font-medium">
                    {employee.first_name} {employee.last_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="font-medium">{employee.email}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ruolo</dt>
                  <dd className="font-medium">{employee.job_title || '–'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Unità Organizzativa</dt>
                  <dd className="font-medium">{employee.org_unit_name || '–'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Sede</dt>
                  <dd className="font-medium">
                    {employee.location_name || employee.location || '–'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Centro di Costo</dt>
                  <dd className="font-medium">{employee.cost_center_name || '–'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Data Assunzione</dt>
                  <dd className="font-medium">{hireDate || '–'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Stato</dt>
                  <dd className="font-medium capitalize">
                    {employee.employment_status || (employee.is_active ? 'attivo' : 'inattivo')}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Competenze */}
        <TabsContent value="skills" className="space-y-3">
          {skillsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : skills && skills.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {skills.map((s) => (
                <SkillProfileCard
                  key={s.id}
                  skillName={s.skill_name || `Skill ${s.skill_id}`}
                  skillType={s.skill_category}
                  proficiencyLevel={s.proficiency_level}
                  verified={s.verified}
                  escoLinked={!!s.skill_id}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  Nessuna competenza registrata per questo dipendente
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Qualificazione Processi */}
        <TabsContent value="qualification" className="space-y-3">
          {qualLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : qualifications && qualifications.length > 0 ? (
            <Card>
              <CardContent className="pt-6 space-y-4">
                {qualifications.map((q) => (
                  <div key={q.processId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <EntityLink type="process" id={q.processId} className="font-medium text-sm">
                        {q.processName}
                      </EntityLink>
                      <span className="text-muted-foreground text-xs">
                        {q.skillsHeld}/{q.skillsRequired} competenze
                      </span>
                    </div>
                    <QualificationScore score={q.qualificationScore * 100} size="sm" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  Nessuna qualificazione processo disponibile
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Gap Analysis */}
        <TabsContent value="gap" className="space-y-3">
          {gapLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : gapAnalysis && gapAnalysis.skills && gapAnalysis.skills.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-bold">{gapAnalysis.total_required}</p>
                    <p className="text-sm text-muted-foreground">Skill Richieste</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-bold">{gapAnalysis.total_held}</p>
                    <p className="text-sm text-muted-foreground">Skill Possedute</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-bold text-red-600">{gapAnalysis.gap_count}</p>
                    <p className="text-sm text-muted-foreground">Gap</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dettaglio Gap</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {gapAnalysis.skills.map((gs) => {
                    const coverage =
                      gs.required_level > 0
                        ? Math.round((gs.current_level / gs.required_level) * 100)
                        : 100;
                    return (
                      <div key={gs.skill_id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <EntityLink type="skill" id={gs.skill_id} className="font-medium text-sm">
                            {gs.skill_name}
                          </EntityLink>
                          <span className="text-muted-foreground text-xs">
                            {gs.current_level}/{gs.required_level}
                          </span>
                        </div>
                        <QualificationScore score={coverage} size="sm" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  Nessun gap rilevato o analisi non disponibile
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
