'use client';

import { useRef, useCallback, type ReactNode } from 'react';
import { MoreVertical, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import '@/components/widgets/widget-effects.css';

// ============================================
// Types
// ============================================

interface WidgetWrapperProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

// ============================================
// Component
// ============================================

/**
 * Shared widget card chrome with animated glow/spotlight effects.
 * Tracks mouse position and feeds --spot-x / --spot-y CSS vars
 * to the .widget-spot radial gradient.
 */
export default function WidgetWrapper({
  title,
  icon: Icon,
  children,
  footer,
  className,
}: WidgetWrapperProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    // Reset to bottom-left default (matches CSS initial-value)
    el.style.setProperty('--spot-x', '0px');
    el.style.setProperty('--spot-y', '100%');
  }, []);

  return (
    <div
      ref={cardRef}
      className={cn('widget-card bg-card/80 overflow-hidden', className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Effect layers */}
      <div className="widget-spot" />
      <div className="widget-glow" />
      <div className="widget-halo" />

      {/* Header */}
      <div className="relative z-[2] flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-muted-foreground" />
          <span
            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            style={{ fontFamily: 'var(--font-sora, Sora, sans-serif)' }}
          >
            {title}
          </span>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground"
          aria-label="Widget menu"
        >
          <MoreVertical size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="relative z-[2] px-4 pb-3">{children}</div>

      {/* Optional footer */}
      {footer && (
        <div className="relative z-[2] flex items-center justify-between border-t border-border/50 px-4 py-2 text-[11px] text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}
