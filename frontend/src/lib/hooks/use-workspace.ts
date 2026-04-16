'use client';

import { useState, useEffect, useCallback, useContext } from 'react';
import { ApiClientError, NetworkError } from '@/lib/api';
import { getMyWorkspace } from '@/lib/api/endpoints/workspace';
import type { WorkspaceWidget, WorkspaceResponse } from '@/lib/api/endpoints/workspace';
import { useWidgetSwr } from './use-widget-swr';
import { WidgetCacheConfigContext } from '@/components/widgets/widget-cache-context';

// ============================================
// Types
// ============================================

interface WorkspaceLayout {
  columns: number;
  gap: number;
}

interface UseWorkspaceResult {
  widgets: WorkspaceWidget[];
  layout: WorkspaceLayout;
  source: WorkspaceResponse['source'];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseWidgetDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** true when serving stale cached data (background revalidation failed or pending) */
  stale: boolean;
  refetch: () => Promise<void>;
}

// ============================================
// useWorkspace
// ============================================

/**
 * Fetches the current user's workspace (layout + widget placements).
 * Falls back gracefully on error with an empty workspace.
 */
export function useWorkspace(): UseWorkspaceResult {
  const [widgets, setWidgets] = useState<WorkspaceWidget[]>([]);
  const [layout, setLayout] = useState<WorkspaceLayout>({ columns: 12, gap: 16 });
  const [source, setSource] = useState<WorkspaceResponse['source']>('empty');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const ws = await getMyWorkspace({ retries: 1 });
      setWidgets(ws.widgets ?? []);
      setLayout(ws.layout ?? { columns: 12, gap: 16 });
      setSource(ws.source ?? 'empty');
    } catch (err) {
      // Auth errors already handled by apiClient (redirect to /login)
      if (err instanceof ApiClientError && err.status === 401) {
        return;
      }
      console.error('[useWorkspace] fetch error:', err);
      if (err instanceof NetworkError) {
        setError('Errore di connessione. Verifica la rete e riprova.');
      } else {
        setError('Impossibile caricare il workspace.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  return { widgets, layout, source, loading, error, refetch: fetchWorkspace };
}

// ============================================
// useWidgetData
// ============================================

/**
 * Fetches runtime data for a single widget identified by its code.
 * Delegates to useWidgetSwr with cache settings from WidgetCacheConfigContext
 * (populated from widget_catalog DB columns: cache_ttl_seconds, swr_seconds).
 * When no context is available or TTL is 0, behaves as a plain fetch.
 *
 * 401 errors are filtered out — the global apiClient handles auth redirects.
 * The `stale` flag from useWidgetSwr is surfaced so consumers can indicate
 * when cached data is being served during background revalidation (Review fix H10).
 */
export function useWidgetData<T = unknown>(code: string): UseWidgetDataResult<T> {
  const cacheConfig = useContext(WidgetCacheConfigContext);
  const config = cacheConfig.get(code);

  const swr = useWidgetSwr<T>({
    code,
    cacheTtlSeconds: config?.cacheTtlSeconds ?? 0,
    swrSeconds: config?.swrSeconds ?? 0,
  });

  // Filter out 401 errors — auth redirect is handled globally by apiClient
  const error = swr.error && !swr.error.includes('401') ? swr.error : null;

  return {
    data: swr.data,
    loading: swr.loading,
    error,
    stale: swr.stale,
    refetch: async () => {
      swr.refresh();
    },
  };
}
