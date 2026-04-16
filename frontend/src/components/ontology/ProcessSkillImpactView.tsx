'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useProcessSkillImpact } from '@/lib/hooks/use-ontology-relations';
import type { SkillImpactEntry } from '@/lib/api/endpoints/ontology-relations';
import { Zap, Fingerprint, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

type ImpactTab = 'critical' | 'unique' | 'all';

function ImpactRow({ entry }: { entry: SkillImpactEntry }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.skillLabel}</p>
        <p className="text-xs text-muted-foreground truncate">{entry.processNames.join(' · ')}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge
          variant="outline"
          className={cn(
            'text-xs',
            entry.skillType === 'knowledge'
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-green-50 border-green-200 text-green-800'
          )}
        >
          {entry.skillType}
        </Badge>
        <Badge
          variant={entry.isCritical ? 'destructive' : 'secondary'}
          className="text-xs tabular-nums"
        >
          {entry.processCount}
        </Badge>
      </div>
    </div>
  );
}

export function ProcessSkillImpactView() {
  const [tab, setTab] = useState<ImpactTab>('critical');
  const { data, isLoading, isError, refetch } = useProcessSkillImpact();

  const TABS: { key: ImpactTab; label: string; icon: React.ReactNode }[] = [
    { key: 'critical', label: 'Critiche', icon: <Zap className="h-3.5 w-3.5" /> },
    { key: 'unique', label: 'Uniche', icon: <Fingerprint className="h-3.5 w-3.5" /> },
    { key: 'all', label: 'Tutte', icon: <BookOpen className="h-3.5 w-3.5" /> },
  ];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={Zap}
        title="Errore nel caricamento"
        description="Impossibile caricare la matrice di impatto."
        action={{ label: 'Riprova', onClick: () => refetch(), variant: 'outline' }}
      />
    );
  }

  if (!data) return null;

  const entries =
    tab === 'critical'
      ? data.criticalSkills
      : tab === 'unique'
        ? data.uniqueSkills
        : [
            ...data.criticalSkills,
            ...data.uniqueSkills.filter(
              (s) => !data.criticalSkills.find((c) => c.skillId === s.skillId)
            ),
          ];

  const tabCounts = {
    critical: data.criticalSkills.length,
    unique: data.uniqueSkills.length,
    all: data.totalSkills,
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-destructive">{data.criticalSkills.length}</p>
            <p className="text-xs text-muted-foreground">Skill critiche</p>
            <p className="text-xs text-muted-foreground">(in &gt;2 processi)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{data.uniqueSkills.length}</p>
            <p className="text-xs text-muted-foreground">Skill uniche</p>
            <p className="text-xs text-muted-foreground">(in 1 processo)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{data.totalSkills}</p>
            <p className="text-xs text-muted-foreground">Skill totali</p>
            <p className="text-xs text-muted-foreground">nei processi</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2">
        {TABS.map(({ key, label, icon }) => (
          <Button
            key={key}
            variant={tab === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(key)}
            className="gap-1.5"
          >
            {icon}
            {label}
            <Badge
              variant={tab === key ? 'secondary' : 'outline'}
              className="ml-0.5 text-xs tabular-nums"
            >
              {tabCounts[key]}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Skill list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {tab === 'critical' && 'Skill critiche — presenti in più di 2 processi'}
            {tab === 'unique' && 'Skill uniche — specifiche di un singolo processo'}
            {tab === 'all' && 'Tutte le skill mappate ai processi'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nessuna skill in questa categoria.
            </p>
          ) : (
            <div>
              {entries.map((entry) => (
                <ImpactRow key={entry.skillId} entry={entry} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
