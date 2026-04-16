'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api';

// ============================================
// Types
// ============================================

export interface StatusConfig {
  code: string;
  label: string;
  className: string;
  order: number;
}

export interface RoleConfig {
  code: string;
  level: number;
  label: string;
  color: string;
}

// ============================================
// Cache (shared across hook instances)
// ============================================

const statusCache = new Map<string, StatusConfig[]>();
const labelsCache = new Map<string, Record<string, string>>();
let allStatusesLoaded = false;

const FALLBACK_STATUS: StatusConfig = {
  code: 'unknown',
  label: 'Sconosciuto',
  className: 'bg-gray-100 text-gray-800',
  order: 999,
};

// ============================================
// Hook: useStatusConfig
// ============================================

export function useStatusConfig(entityType: string) {
  const [statuses, setStatuses] = useState<StatusConfig[]>(statusCache.get(entityType) || []);
  const [loading, setLoading] = useState(!statusCache.has(entityType));

  useEffect(() => {
    if (statusCache.has(entityType)) {
      setStatuses(statusCache.get(entityType)!);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchStatuses() {
      try {
        const res = await apiClient.get<{ success: boolean; data: Record<string, StatusConfig[]> }>(
          `/api/v1/config/statuses?entity=${entityType}`
        );
        if (!cancelled && res?.data?.[entityType]) {
          statusCache.set(entityType, res.data[entityType]);
          setStatuses(res.data[entityType]);
        }
      } catch {
        // Silently fail — use fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStatuses();
    return () => {
      cancelled = true;
    };
  }, [entityType]);

  const getStatusConfig = useCallback(
    (code: string): StatusConfig => {
      return statuses.find((s) => s.code === code) || { ...FALLBACK_STATUS, code, label: code };
    },
    [statuses]
  );

  return { statuses, loading, getStatusConfig };
}

// ============================================
// Hook: useLabels
// ============================================

export function useLabels(entityType: string) {
  const [labels, setLabels] = useState<Record<string, string>>(labelsCache.get(entityType) || {});

  useEffect(() => {
    if (labelsCache.has(entityType)) {
      setLabels(labelsCache.get(entityType)!);
      return;
    }

    let cancelled = false;

    async function fetchLabels() {
      try {
        const res = await apiClient.get<{
          success: boolean;
          data: Record<string, Record<string, string>>;
        }>(`/api/v1/config/labels?entity=${entityType}`);
        if (!cancelled && res?.data?.[entityType]) {
          labelsCache.set(entityType, res.data[entityType]);
          setLabels(res.data[entityType]);
        }
      } catch {
        // Silently fail
      }
    }

    fetchLabels();
    return () => {
      cancelled = true;
    };
  }, [entityType]);

  const getLabel = useCallback((code: string): string => labels[code] || code, [labels]);

  return { labels, getLabel };
}

// ============================================
// Hook: useAllStatuses (preload all at once)
// ============================================

export function useAllStatuses() {
  const [loaded, setLoaded] = useState(allStatusesLoaded);

  useEffect(() => {
    if (allStatusesLoaded) return;

    let cancelled = false;

    async function fetchAll() {
      try {
        const res = await apiClient.get<{ success: boolean; data: Record<string, StatusConfig[]> }>(
          '/api/v1/config/statuses'
        );
        if (!cancelled && res?.data) {
          for (const [key, values] of Object.entries(res.data)) {
            statusCache.set(key, values);
          }
          allStatusesLoaded = true;
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  return { loaded };
}
