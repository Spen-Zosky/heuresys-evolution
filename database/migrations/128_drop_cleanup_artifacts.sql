-- Migration 128: Drop cleanup artifacts (Fase 8 finale)
-- Prerequisites: All phases 1-7 completed and verified
-- Drops backup table and cleanup log (consolidated into page_table_sync_log)

BEGIN;

-- Drop backup table (orphan rows preserved during Phase 1a, no longer needed)
DROP TABLE IF EXISTS _cleanup_orphans_backup;

-- Drop cleanup log (entries already migrated to page_table_sync_log in Phase 3)
DROP TABLE IF EXISTS _migration_cleanup_log;

-- Log
INSERT INTO page_table_sync_log (sync_type, details) VALUES
  ('phase8_cleanup', jsonb_build_object(
    'dropped', ARRAY['_cleanup_orphans_backup', '_migration_cleanup_log'],
    'reason', 'Phase 1-7 completed, data preserved in page_table_sync_log'
  ));

INSERT INTO schema_migrations (version) VALUES ('128_drop_cleanup_artifacts');

COMMIT;
