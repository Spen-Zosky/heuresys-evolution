'use client';

import WidgetFactory from './widget-factory';
import { WorkspaceGrid } from './workspace-grid';
import { WidgetCacheConfigProvider } from './widget-cache-context';
import '@/components/widgets/widget-effects.css';

// ============================================
// Types
// ============================================

export interface WidgetPosition {
  code: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cache_ttl_seconds?: number;
  swr_seconds?: number;
}

export interface WorkspaceRendererProps {
  widgets: WidgetPosition[];
  layout: { columns: number; gap: number };
  loading?: boolean;
  /** When true, renders the drag-and-drop grid editor instead of the CSS Grid view. */
  editMode?: boolean;
  /** Callback fired when the user rearranges widgets in edit mode. */
  onLayoutChange?: (updated: WidgetPosition[]) => void;
}

// ============================================
// Skeleton loader
// ============================================

const SKELETON_SPANS = [4, 4, 4, 8, 4, 6, 6];

function SkeletonGrid({ gap }: { gap: number }) {
  return (
    <div className="grid grid-cols-12" style={{ gap: `${gap}px` }}>
      {SKELETON_SPANS.map((span, i) => (
        <div
          key={i}
          className="col-span-12 animate-pulse rounded-[14px] bg-muted md:col-auto"
          style={{
            gridColumn: `span ${span}`,
            minHeight: span >= 8 ? '180px' : '140px',
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// Component
// ============================================

/**
 * CSS Grid 12-column renderer that positions widgets from a config array.
 * In edit mode, delegates to WorkspaceGrid (react-grid-layout) for DnD.
 * Both modes are wrapped in WidgetCacheConfigProvider so that inner
 * WidgetFactory instances receive per-widget SWR cache settings from the DB.
 * Below md breakpoint every widget becomes full-width (span 12).
 */
export default function WorkspaceRenderer({
  widgets,
  layout,
  loading = false,
  editMode = false,
  onLayoutChange,
}: WorkspaceRendererProps) {
  if (loading) {
    return <SkeletonGrid gap={layout.gap} />;
  }

  if (editMode && onLayoutChange) {
    return (
      <WidgetCacheConfigProvider widgets={widgets}>
        <WorkspaceGrid widgets={widgets} layout={layout} onLayoutChange={onLayoutChange} />
      </WidgetCacheConfigProvider>
    );
  }

  return (
    <WidgetCacheConfigProvider widgets={widgets}>
      <div className="workspace-grid grid grid-cols-12" style={{ gap: `${layout.gap}px` }}>
        {widgets.map((widget, index) => (
          <div
            key={`${widget.code}-${index}`}
            className="workspace-widget-cell"
            style={{
              gridColumn: `span ${widget.w}`,
              animation: `widgetIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both`,
              animationDelay: `${index * 0.07}s`,
            }}
          >
            <WidgetFactory code={widget.code} />
          </div>
        ))}
      </div>
    </WidgetCacheConfigProvider>
  );
}
