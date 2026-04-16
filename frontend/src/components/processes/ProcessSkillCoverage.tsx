'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useProcessSkills } from '@/lib/hooks/use-process-queries';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface ProcessSkillCoverageProps {
  processId: string;
}

export function ProcessSkillCoverage({ processId }: ProcessSkillCoverageProps) {
  const { data: skills, isLoading, isError, refetch } = useProcessSkills(processId);

  if (isLoading) {
    return (
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
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-semibold">Errore nel caricamento delle competenze</p>
            <Button variant="outline" onClick={() => refetch()}>
              Riprova
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!skills || skills.length === 0) {
    return (
      <EmptyState
        type="default"
        title="Nessuna competenza richiesta"
        description="Questo processo non ha requisiti di competenze configurati."
        size="sm"
      />
    );
  }

  return (
    <div className="space-y-3">
      {skills.map((skill) => (
        <Card key={skill.skillId}>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
              <EntityLink type="skill" id={skill.skillId} className="font-medium flex-1 text-sm">
                {skill.skillLabel}
              </EntityLink>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn(levelColors[skill.proficiencyLevel] || '')}>
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
                className={cn('flex-1 h-2', `[&>div]:${coverageColor(skill.employeeCoverage)}`)}
              />
              <span className="text-sm font-medium w-12 text-right">
                {Math.round(skill.employeeCoverage)}%
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
