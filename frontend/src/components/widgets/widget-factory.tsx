'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { widgetMap } from './widget-map.generated';

// ============================================
// Loading fallback
// ============================================

function WidgetSkeleton() {
  return (
    <div className="flex h-32 items-center justify-center">
      <Loader2 size={20} className="animate-spin text-muted-foreground/50" />
    </div>
  );
}

// ============================================
// Factory component
// ============================================

interface WidgetFactoryProps {
  code: string;
}

/**
 * Resolves a widget code to a lazy-loaded component.
 * Falls back to a "not found" message for unknown codes.
 */
export default function WidgetFactory({ code }: WidgetFactoryProps) {
  const WidgetComponent = widgetMap[code];

  if (!WidgetComponent) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-muted-foreground/60">
        Widget &ldquo;{code}&rdquo; non disponibile
      </div>
    );
  }

  return (
    <Suspense fallback={<WidgetSkeleton />}>
      <WidgetComponent code={code} />
    </Suspense>
  );
}
