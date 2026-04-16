'use client';

import { cn } from '@/lib/utils';

interface DecorativeProps {
  className?: string;
}

/**
 * DotGrid — Subtle dot pattern background
 * Usage: <DotGrid className="absolute inset-0 -z-10" />
 */
export function DotGrid({ className }: DecorativeProps) {
  return (
    <svg className={cn('w-full h-full text-border', className)} aria-hidden="true">
      <defs>
        <pattern id="dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="currentColor" opacity="0.4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-grid)" />
    </svg>
  );
}

/**
 * DiagonalLines — Diagonal hatching pattern
 * Usage: <DiagonalLines className="absolute inset-0 -z-10 opacity-[0.03]" />
 */
export function DiagonalLines({ className }: DecorativeProps) {
  return (
    <svg className={cn('w-full h-full text-foreground', className)} aria-hidden="true">
      <defs>
        <pattern
          id="diagonal-lines"
          x="0"
          y="0"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#diagonal-lines)" />
    </svg>
  );
}

/**
 * ConcentricCircles — Decorative concentric circles accent
 * Usage: <ConcentricCircles className="absolute -right-20 -top-20 w-80 h-80 opacity-[0.05]" />
 */
export function ConcentricCircles({ className }: DecorativeProps) {
  return (
    <svg className={cn('text-primary', className)} viewBox="0 0 400 400" aria-hidden="true">
      {[60, 100, 140, 180, 220, 260].map((r) => (
        <circle
          key={r}
          cx="200"
          cy="200"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          opacity={0.3 - r / 1000}
        />
      ))}
    </svg>
  );
}

/**
 * GradientBlob — Animated soft blob for section backgrounds
 * Usage: <GradientBlob className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px]" />
 */
export function GradientBlob({ className }: DecorativeProps) {
  return (
    <div
      className={cn(
        'rounded-full blur-3xl opacity-30 pointer-events-none',
        'bg-gradient-to-br from-primary/20 via-[var(--brand-accent)]/10 to-[var(--accent-warm)]/10',
        className
      )}
      aria-hidden="true"
    />
  );
}

/**
 * SectionDivider — Decorative divider between page sections
 * Usage: <SectionDivider />
 */
export function SectionDivider({ className }: DecorativeProps) {
  return (
    <div className={cn('flex items-center gap-4 py-2', className)} aria-hidden="true">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="h-1.5 w-1.5 rounded-full bg-primary/30" />
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}
