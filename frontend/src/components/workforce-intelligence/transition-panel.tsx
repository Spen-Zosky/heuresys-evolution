'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import * as careerApi from '@/lib/api/endpoints/career-intelligence';
import type {
  CareerTransitionResponse,
  TransitionSkill,
} from '@/lib/api/endpoints/career-intelligence';

// ============================================
// TYPES
// ============================================

interface TransitionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceUri: string;
  targetUri: string;
  onExploreFrom?: (targetUri: string, targetLabel: string) => void;
}

// ============================================
// HELPERS
// ============================================

function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'easy':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'moderate':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'hard':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getDifficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case 'easy':
      return 'Facile';
    case 'moderate':
      return 'Moderata';
    case 'hard':
      return 'Difficile';
    default:
      return difficulty;
  }
}

// ============================================
// SKILL LIST SECTION
// ============================================

function SkillSection({
  title,
  icon,
  iconColor,
  skills,
  variant,
}: {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  skills: TransitionSkill[];
  variant: 'have' | 'transferable' | 'learn';
}) {
  const [open, setOpen] = useState(false);

  if (skills.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
        <span className="flex items-center gap-2">
          <span className={iconColor}>{icon}</span>
          {title} ({skills.length})
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-2 pl-2">
        {skills.map((skill, idx) => (
          <div key={`${variant}-${idx}`} className="rounded-md border px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{skill.skillLabel}</span>
              {variant === 'learn' && skill.isEssential && (
                <Badge variant="destructive" className="text-xs">
                  Essenziale
                </Badge>
              )}
            </div>
            {variant === 'transferable' && skill.closestSourceSkill && (
              <p className="mt-1 text-xs text-muted-foreground">da: {skill.closestSourceSkill}</p>
            )}
            {variant === 'transferable' && (
              <div className="mt-1.5 flex items-center gap-2">
                <Progress
                  value={Math.round(skill.transferability * 100)}
                  className="h-1.5 flex-1"
                />
                <span className="text-xs text-muted-foreground">
                  {Math.round(skill.transferability * 100)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================
// TRICOLOR BAR
// ============================================

function TricolorBar({
  have,
  transferable,
  learn,
}: {
  have: number;
  transferable: number;
  learn: number;
}) {
  const total = have + transferable + learn;
  if (total === 0) return null;

  const havePct = (have / total) * 100;
  const transferPct = (transferable / total) * 100;
  const learnPct = (learn / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        <div className="bg-green-500 transition-all" style={{ width: `${havePct}%` }} />
        <div className="bg-yellow-500 transition-all" style={{ width: `${transferPct}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${learnPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          Possedute ({have})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
          Trasferibili ({transferable})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          Da apprendere ({learn})
        </span>
      </div>
    </div>
  );
}

// ============================================
// TRANSITION PANEL
// ============================================

export function TransitionPanel({
  open,
  onOpenChange,
  sourceUri,
  targetUri,
  onExploreFrom,
}: TransitionPanelProps) {
  const [data, setData] = useState<CareerTransitionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sourceUri || !targetUri) {
      setData(null);
      return;
    }

    let cancelled = false;

    async function fetchTransition() {
      setLoading(true);
      setError(null);
      try {
        const result = await careerApi.getCareerTransition(sourceUri, targetUri);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Errore nel caricamento della transizione');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTransition();
    return () => {
      cancelled = true;
    };
  }, [open, sourceUri, targetUri]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">
            {data
              ? `Da ${data.sourceOccupation} a ${data.targetOccupation}`
              : 'Transizione di carriera'}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Loading state */}
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Data loaded */}
          {data && !loading && (
            <>
              {/* Readiness + Difficulty */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{data.readinessPercent}%</p>
                  <p className="text-sm text-muted-foreground">Readiness</p>
                </div>
                <Badge className={getDifficultyColor(data.difficulty)}>
                  {getDifficultyLabel(data.difficulty)}
                </Badge>
              </div>

              {/* Tricolor bar */}
              <TricolorBar
                have={data.have.length}
                transferable={data.transferable.length}
                learn={data.learn.length}
              />

              {/* Skill sections */}
              <div className="space-y-3">
                <SkillSection
                  title="Skill possedute"
                  icon={<Check className="h-4 w-4" />}
                  iconColor="text-green-600"
                  skills={data.have}
                  variant="have"
                />
                <SkillSection
                  title="Skill trasferibili"
                  icon={<ArrowRight className="h-4 w-4" />}
                  iconColor="text-yellow-600"
                  skills={data.transferable}
                  variant="transferable"
                />
                <SkillSection
                  title="Skill da apprendere"
                  icon={<BookOpen className="h-4 w-4" />}
                  iconColor="text-red-600"
                  skills={data.learn}
                  variant="learn"
                />
              </div>

              {/* Explore from here */}
              {onExploreFrom && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    onExploreFrom(targetUri, data.targetOccupation);
                    onOpenChange(false);
                  }}
                >
                  Esplora da qui
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
