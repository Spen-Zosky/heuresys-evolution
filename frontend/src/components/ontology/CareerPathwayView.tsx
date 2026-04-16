'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useCareerPathways } from '@/lib/hooks/use-ontology-relations';
import type { CareerStep } from '@/lib/api/endpoints/ontology-relations';
import { ArrowRight, TrendingUp, TrendingDown, GitMerge, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

function overlapColor(ratio: number): string {
  if (ratio >= 0.8) return 'text-green-600';
  if (ratio >= 0.65) return 'text-yellow-600';
  return 'text-orange-600';
}

function SkillPill({ label, variant }: { label: string; variant: 'gained' | 'lost' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium',
        variant === 'gained'
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-800'
      )}
    >
      {label}
    </span>
  );
}

function StepCard({ step, index }: { step: CareerStep; index: number }) {
  return (
    <div className="flex items-start gap-3">
      {/* Connector */}
      <div className="flex flex-col items-center gap-1 pt-3">
        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
          {index + 1}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
      </div>

      <Card className="flex-1">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold leading-tight">
              {step.occupationLabel}
            </CardTitle>
            <div className="flex items-center gap-2 shrink-0">
              {step.iscoCode && (
                <Badge variant="outline" className="text-xs font-mono">
                  ISCO {step.iscoCode}
                </Badge>
              )}
              <span className={cn('text-xs font-semibold', overlapColor(step.skillOverlap))}>
                {Math.round(step.skillOverlap * 100)}% overlap
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {step.skillsGained.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-green-600" />
                <span>Da acquisire</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {step.skillsGained.map((s) => (
                  <SkillPill key={s.id} label={s.label} variant="gained" />
                ))}
              </div>
            </div>
          )}
          {step.skillsLost.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingDown className="h-3 w-3 text-red-600" />
                <span>Non richieste</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {step.skillsLost.map((s) => (
                  <SkillPill key={s.id} label={s.label} variant="lost" />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface CareerPathwayViewProps {
  /** Pre-selected occupation UUID. When provided, the search input is hidden. */
  occupationId?: string;
}

export function CareerPathwayView({ occupationId: initialId }: CareerPathwayViewProps) {
  const [inputValue, setInputValue] = useState('');
  const [activeId, setActiveId] = useState<string | null>(initialId ?? null);

  const { data, isLoading, isError, refetch } = useCareerPathways(activeId);

  function handleSearch() {
    const trimmed = inputValue.trim();
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(trimmed)) {
      setActiveId(trimmed);
    }
  }

  return (
    <div className="space-y-6">
      {/* Search bar (shown when no pre-selected occupation) */}
      {!initialId && (
        <div className="flex gap-2">
          <Input
            placeholder="UUID occupazione ESCO..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="font-mono text-sm"
          />
          <Button onClick={handleSearch} disabled={!inputValue.trim()}>
            <Search className="h-4 w-4 mr-1.5" />
            Cerca
          </Button>
        </div>
      )}

      {/* No occupation selected */}
      {!activeId && (
        <EmptyState
          icon={GitMerge}
          title="Seleziona un'occupazione"
          description="Inserisci l'UUID di un'occupazione ESCO per visualizzare i percorsi di carriera."
        />
      )}

      {/* Loading */}
      {activeId && isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-7 h-7 rounded-full" />
              <Skeleton className="flex-1 h-24 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {activeId && isError && (
        <EmptyState
          icon={GitMerge}
          title="Errore nel caricamento"
          description="Impossibile caricare i percorsi di carriera."
          action={{ label: 'Riprova', onClick: () => refetch(), variant: 'outline' }}
        />
      )}

      {/* Results */}
      {data && (
        <div className="space-y-4">
          {/* Source node */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
              <span className="text-xs font-bold">S</span>
            </div>
            <div>
              <p className="font-semibold text-sm">{data.source.label}</p>
              {data.source.iscoCode && (
                <p className="text-xs text-muted-foreground font-mono">
                  ISCO {data.source.iscoCode}
                </p>
              )}
            </div>
          </div>

          {/* Pathway steps */}
          {data.steps.length === 0 ? (
            <EmptyState
              icon={GitMerge}
              title="Nessun percorso trovato"
              description="Non ci sono occupazioni con overlap skill >= 60% rispetto alla sorgente."
            />
          ) : (
            <div className="space-y-3">
              {data.steps.map((step, idx) => (
                <StepCard key={step.occupationId} step={step} index={idx} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
