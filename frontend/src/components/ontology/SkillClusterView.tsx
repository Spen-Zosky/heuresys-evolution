'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useSkillClusters } from '@/lib/hooks/use-ontology-relations';
import type { SkillCluster } from '@/lib/api/endpoints/ontology-relations';
import { Layers, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const SKILL_TYPE_OPTIONS = [
  { value: undefined, label: 'Tutti' },
  { value: 'skill' as const, label: 'Skill' },
  { value: 'knowledge' as const, label: 'Knowledge' },
  { value: 'competence' as const, label: 'Competence' },
];

const PAGE_SIZE = 12;

function skillTypeBadgeClass(skillType: string): string {
  switch (skillType) {
    case 'knowledge':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'competence':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-green-100 text-green-800 border-green-200';
  }
}

function ClusterCard({ cluster }: { cluster: SkillCluster }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-tight line-clamp-2">
            {cluster.label}
          </CardTitle>
          <Badge variant="outline" className="shrink-0 text-xs">
            {cluster.memberCount} skill
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {cluster.topSkills.map((skill) => (
            <span
              key={skill.id}
              className={cn(
                'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium',
                skillTypeBadgeClass(skill.skillType)
              )}
            >
              {skill.label}
            </span>
          ))}
        </div>
        {cluster.relatedOccupationCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Briefcase className="h-3 w-3" />
            <span>{cluster.relatedOccupationCount} occupazioni correlate</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SkillClusterView() {
  const [offset, setOffset] = useState(0);
  const [skillType, setSkillType] = useState<'skill' | 'knowledge' | 'competence' | undefined>(
    undefined
  );

  const { data, isLoading, isError, refetch } = useSkillClusters({
    limit: PAGE_SIZE,
    offset,
    skillType,
  });

  const total = data?.meta.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  function handleTypeChange(type: 'skill' | 'knowledge' | 'competence' | undefined) {
    setSkillType(type);
    setOffset(0);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {SKILL_TYPE_OPTIONS.map((o) => (
            <Skeleton key={o.label} className="h-8 w-20" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={Layers}
        title="Errore nel caricamento"
        description="Impossibile caricare i cluster di skill."
        action={{ label: 'Riprova', onClick: () => refetch(), variant: 'outline' }}
      />
    );
  }

  if (!data?.clusters.length) {
    return (
      <EmptyState
        icon={Layers}
        title="Nessun cluster trovato"
        description="Non ci sono cluster disponibili per i filtri selezionati."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Tipo:</span>
        {SKILL_TYPE_OPTIONS.map((opt) => (
          <Button
            key={opt.label}
            variant={skillType === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTypeChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{total} cluster totali</span>
      </div>

      {/* Cluster grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.clusters.map((cluster) => (
          <ClusterCard key={cluster.clusterId} cluster={cluster} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Pagina {currentPage} di {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
