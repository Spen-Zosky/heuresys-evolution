'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { OrgUnitSkillGap } from '@/lib/hooks/use-org-queries';
import { EntityLink } from '@/components/navigation/EntityLink';

interface SkillGapChartProps {
  gaps: OrgUnitSkillGap[];
}

function gapColor(coveragePercent: number): string {
  if (coveragePercent >= 100) return 'bg-green-500';
  if (coveragePercent >= 70) return 'bg-yellow-500';
  return 'bg-red-500';
}

function gapBadgeVariant(coveragePercent: number): 'default' | 'secondary' | 'destructive' {
  if (coveragePercent >= 100) return 'default';
  if (coveragePercent >= 70) return 'secondary';
  return 'destructive';
}

const SKILL_TYPE_LABELS: Record<string, string> = {
  knowledge: 'Conoscenza',
  skill: 'Competenza',
  attitude: 'Attitudine',
  transversal: 'Trasversale',
};

export function SkillGapChart({ gaps }: SkillGapChartProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [onlyGaps, setOnlyGaps] = useState(false);

  const skillTypes = Array.from(new Set(gaps.map((g) => g.skillType))).sort();

  const filtered = gaps
    .filter((g) => filterType === 'all' || g.skillType === filterType)
    .filter((g) => !onlyGaps || g.gapLevel > 0);

  if (gaps.length === 0) {
    return (
      <EmptyState
        type="default"
        title="Nessun dato disponibile"
        description="Non ci sono processi mappati a questa unita organizzativa o non ci sono requisiti di competenza."
        size="sm"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="skill-type-filter" className="text-sm whitespace-nowrap">
            Tipo competenza
          </Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger id="skill-type-filter" className="w-40 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {skillTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {SKILL_TYPE_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="only-gaps" checked={onlyGaps} onCheckedChange={setOnlyGaps} />
          <Label htmlFor="only-gaps" className="text-sm">
            Solo gap
          </Label>
        </div>
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} competenz{filtered.length === 1 ? 'a' : 'e'}
        </span>
      </div>

      {/* Chart rows */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nessun gap rilevato con i filtri selezionati
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((gap) => (
            <Card key={gap.skillId} className="overflow-hidden">
              <CardContent className="py-3 px-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                  <EntityLink
                    type="skill"
                    id={gap.skillId}
                    className="font-medium text-sm flex-1 leading-snug"
                  >
                    {gap.skillLabel}
                  </EntityLink>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {SKILL_TYPE_LABELS[gap.skillType] ?? gap.skillType}
                    </Badge>
                    {gap.isMandatory && (
                      <Badge variant="default" className="text-xs">
                        Obbligatoria
                      </Badge>
                    )}
                    <Badge
                      variant={gapBadgeVariant(gap.coveragePercent)}
                      className="text-xs font-semibold"
                    >
                      {gap.coveragePercent}%
                    </Badge>
                  </div>
                </div>

                {/* Comparative bars */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Richiesto</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-400 rounded-full transition-all"
                        style={{ width: `${(gap.requiredLevel / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-6 text-right">
                      {gap.requiredLevel}/5
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Disponibile</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          gapColor(gap.coveragePercent)
                        )}
                        style={{ width: `${(gap.availableLevel / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-6 text-right">
                      {gap.availableLevel}/5
                    </span>
                  </div>
                </div>

                {/* Footer info */}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>
                    {gap.employeesWithSkill}/{gap.totalEmployees} dipendenti
                  </span>
                  <span>·</span>
                  <span>
                    {gap.processCount} process{gap.processCount === 1 ? 'o' : 'i'}
                  </span>
                  {gap.gapLevel > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-red-600 font-medium">
                        Gap: {gap.gapLevel} livell{gap.gapLevel === 1 ? 'o' : 'i'}
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
