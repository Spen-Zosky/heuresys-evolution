'use client';

import { cn } from '@/lib/utils';

interface QualificationScoreProps {
  score: number;
  label?: string;
  size?: 'sm' | 'md';
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function getBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

export function QualificationScore({ score, label, size = 'md' }: QualificationScoreProps) {
  const pct = Math.round(Math.min(100, Math.max(0, score)));

  return (
    <div className={cn('flex items-center gap-3', size === 'sm' ? 'gap-2' : 'gap-3')}>
      {label && (
        <span className={cn('text-sm truncate', size === 'sm' ? 'max-w-[120px]' : 'max-w-[200px]')}>
          {label}
        </span>
      )}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className={cn(
            'rounded-full bg-muted overflow-hidden',
            size === 'sm' ? 'h-2 flex-1' : 'h-3 flex-1'
          )}
        >
          <div
            className={cn('h-full rounded-full transition-all', getBarColor(pct))}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={cn(
            'font-semibold tabular-nums shrink-0',
            getScoreColor(pct),
            size === 'sm' ? 'text-xs w-8' : 'text-sm w-10'
          )}
        >
          {pct}%
        </span>
      </div>
    </div>
  );
}
