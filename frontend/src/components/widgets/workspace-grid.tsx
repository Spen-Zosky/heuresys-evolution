'use client';

import { useMemo, useCallback } from 'react';
import { Responsive, useContainerWidth, verticalCompactor } from 'react-grid-layout';
import type { LayoutItem } from 'react-grid-layout';
import WidgetFactory from './widget-factory';
import type { WidgetPosition } from './workspace-renderer';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface WorkspaceGridProps {
  widgets: WidgetPosition[];
  layout: { columns: number; gap: number };
  onLayoutChange: (updated: WidgetPosition[]) => void;
}

/**
 * Drag-and-drop grid editor using react-grid-layout v2.
 * Maps WidgetPosition[] to RGL Layout and back.
 * 12-column grid matching the CSS Grid view mode.
 */
export function WorkspaceGrid({ widgets, layout, onLayoutChange }: WorkspaceGridProps) {
  const { width, containerRef } = useContainerWidth();

  const rglLayout: LayoutItem[] = useMemo(
    () =>
      widgets.map((w) => ({
        i: w.code,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        minW: 2,
        minH: 1,
        maxW: 12,
      })),
    [widgets]
  );

  const handleLayoutChange = useCallback(
    (newLayout: readonly LayoutItem[]) => {
      const updated: WidgetPosition[] = newLayout.map((item) => ({
        code: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      }));
      onLayoutChange(updated);
    },
    [onLayoutChange]
  );

  if (!width) {
    return <div ref={containerRef} className="workspace-grid-edit" />;
  }

  return (
    <div ref={containerRef}>
      <Responsive
        className="workspace-grid-edit"
        width={width}
        layouts={{ lg: rglLayout }}
        breakpoints={{ lg: 1200, md: 768, sm: 480 }}
        cols={{ lg: layout.columns, md: 6, sm: 1 }}
        rowHeight={120}
        margin={[layout.gap, layout.gap] as const}
        dragConfig={{ enabled: true, handle: '.widget-drag-handle' }}
        resizeConfig={{ enabled: true }}
        onLayoutChange={handleLayoutChange}
        compactor={verticalCompactor}
      >
        {widgets.map((widget) => (
          <div key={widget.code} className="workspace-grid-item">
            <div className="widget-drag-handle absolute top-0 left-0 right-0 h-8 cursor-grab active:cursor-grabbing z-10 flex items-center justify-center">
              <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="pt-6 h-full overflow-hidden">
              <WidgetFactory code={widget.code} />
            </div>
          </div>
        ))}
      </Responsive>
    </div>
  );
}
