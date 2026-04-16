'use client';

/**
 * use-widget-swr — Per-widget data fetching with SWR-like cache behaviour
 *
 * P3-16: Widget Refresh Policies
 *
 * Implements in-memory cache keyed by widget code with configurable TTL and
 * stale-while-revalidate window.  When a cached entry is fresh (< cacheTtlSeconds)
 * the hook returns it immediately.  When it is stale but within the SWR window it
 * returns the cached value AND triggers a background revalidation.  If the entry
 * is fully expired it fetches fresh data.
 *
 * Review fix H10: background revalidation errors are NOT silently swallowed —
 * the `stale` flag is set to true so consumers can surface the staleness to users.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getWidgetData } from '@/lib/api/endpoints/workspace';

// ---------------------------------------------------------------------------
// In-memory cache (shared across all hook instances in the same page)
// ---------------------------------------------------------------------------

interface CacheEntry<T = unknown> {
  data: T;
  fetchedAt: number; // Date.now() of last successful fetch
}

const cache = new Map<string, CacheEntry>();

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface UseWidgetSwrOptions {
  code: string;
  cacheTtlSeconds?: number;
  swrSeconds?: number;
}

export interface UseWidgetSwrResult<T = unknown> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** true when serving a stale cached value (background revalidation failed or pending) */
  stale: boolean;
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWidgetSwr<T = unknown>(options: UseWidgetSwrOptions): UseWidgetSwrResult<T> {
  const { code, cacheTtlSeconds = 0, swrSeconds = 0 } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  // Prevent state updates after unmount
  const mountedRef = useRef(true);
  // Track in-flight revalidation to avoid duplicate requests
  const revalidatingRef = useRef(false);

  /**
   * Perform the actual fetch and update cache + state.
   * @param background – when true the hook is serving stale data and this is a
   *   background revalidation; errors set `stale` instead of `error`.
   */
  const fetchData = useCallback(
    async (background = false) => {
      if (!code) return;

      if (!background) {
        setLoading(true);
        setError(null);
      }

      try {
        const result = await getWidgetData<T>(code, { retries: 1 });

        // Update cache
        cache.set(code, { data: result, fetchedAt: Date.now() });

        if (mountedRef.current) {
          setData(result);
          setStale(false);
          setError(null);
          if (!background) setLoading(false);
        }
      } catch (err) {
        if (!mountedRef.current) return;

        if (background) {
          // Review fix H10: do NOT silently swallow — expose staleness
          setStale(true);
        } else {
          const message =
            err instanceof Error ? err.message : 'Impossibile caricare i dati del widget.';
          setError(message);
          setLoading(false);
        }
      } finally {
        revalidatingRef.current = false;
      }
    },
    [code]
  );

  /**
   * Public refresh — always does a foreground fetch.
   */
  const refresh = useCallback(() => {
    fetchData(false);
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Effect: cache check → serve / revalidate / fetch fresh
  // ---------------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    if (!code) {
      setLoading(false);
      return;
    }

    const entry = cache.get(code) as CacheEntry<T> | undefined;
    const now = Date.now();

    if (entry && cacheTtlSeconds > 0) {
      const ageMs = now - entry.fetchedAt;
      const ttlMs = cacheTtlSeconds * 1000;
      const swrMs = swrSeconds * 1000;

      if (ageMs < ttlMs) {
        // Fresh — return cached immediately
        setData(entry.data);
        setStale(false);
        setLoading(false);
        return;
      }

      if (ageMs < ttlMs + swrMs) {
        // Stale but within SWR window — serve cached + background revalidate
        setData(entry.data);
        setStale(true);
        setLoading(false);

        if (!revalidatingRef.current) {
          revalidatingRef.current = true;
          fetchData(true);
        }
        return;
      }
    }

    // No cache or fully expired — fetch fresh
    fetchData(false);

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, cacheTtlSeconds, swrSeconds]);

  return { data, error, loading, stale, refresh };
}
