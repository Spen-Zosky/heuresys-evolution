-- Migration 191: Widget Cache TTL + SWR policies
-- P3-16: Per-widget refresh policies for SWR-like frontend caching
BEGIN;

ALTER TABLE widget_catalog
  ADD COLUMN IF NOT EXISTS cache_ttl_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS swr_seconds INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN widget_catalog.cache_ttl_seconds IS 'Time-to-live for widget data cache (0 = no cache)';
COMMENT ON COLUMN widget_catalog.swr_seconds IS 'Stale-while-revalidate window (0 = disabled)';

-- Set sensible defaults for KPI widgets (refresh every 5 min, SWR 30s)
UPDATE widget_catalog SET cache_ttl_seconds = 300, swr_seconds = 30
 WHERE widget_type IN ('KPI_CARD', 'CHART') AND cache_ttl_seconds = 0;

COMMIT;
