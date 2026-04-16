'use client';

import { createContext, useMemo, type ReactNode } from 'react';
import type { WorkspaceWidget } from '@/lib/api/endpoints/workspace';

export interface WidgetCacheConfig {
  cacheTtlSeconds: number;
  swrSeconds: number;
}

export const WidgetCacheConfigContext = createContext<Map<string, WidgetCacheConfig>>(new Map());

interface Props {
  widgets: Pick<WorkspaceWidget, 'code' | 'cache_ttl_seconds' | 'swr_seconds'>[];
  children: ReactNode;
}

export function WidgetCacheConfigProvider({ widgets, children }: Props) {
  const configMap = useMemo(() => {
    const map = new Map<string, WidgetCacheConfig>();
    for (const w of widgets) {
      if (w.cache_ttl_seconds || w.swr_seconds) {
        map.set(w.code, {
          cacheTtlSeconds: w.cache_ttl_seconds ?? 0,
          swrSeconds: w.swr_seconds ?? 0,
        });
      }
    }
    return map;
  }, [widgets]);

  return (
    <WidgetCacheConfigContext.Provider value={configMap}>
      {children}
    </WidgetCacheConfigContext.Provider>
  );
}
