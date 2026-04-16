-- Migration 126: Soft-delete uniform pattern (Fase 7)
-- Add deleted_at TIMESTAMPTZ to all 91 physical tables that have is_active but lack deleted_at
-- Pattern: UPDATE SET is_active = false, deleted_at = NOW() for soft-delete
-- Query filter: WHERE deleted_at IS NULL (or WHERE is_active = true AND deleted_at IS NULL)

BEGIN;

-- Generate ALTER TABLE statements for all 91 tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT c1.table_name
    FROM information_schema.columns c1
    WHERE c1.column_name = 'is_active' AND c1.table_schema = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns c2
      WHERE c2.table_name = c1.table_name AND c2.column_name = 'deleted_at' AND c2.table_schema = 'public'
    )
    AND c1.table_name NOT IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public')
    ORDER BY c1.table_name
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL', tbl);
  END LOOP;
END $$;

-- Backfill: set deleted_at for already-inactive records
DO $$
DECLARE
  tbl TEXT;
  affected INT;
BEGIN
  FOR tbl IN
    SELECT c1.table_name
    FROM information_schema.columns c1
    WHERE c1.column_name = 'is_active' AND c1.table_schema = 'public'
    AND c1.table_name NOT IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public')
    AND EXISTS (
      SELECT 1 FROM information_schema.columns c2
      WHERE c2.table_name = c1.table_name AND c2.column_name = 'deleted_at' AND c2.table_schema = 'public'
    )
    ORDER BY c1.table_name
  LOOP
    EXECUTE format('UPDATE %I SET deleted_at = NOW() WHERE is_active = false AND deleted_at IS NULL', tbl);
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected > 0 THEN
      INSERT INTO page_table_sync_log (sync_type, details)
      VALUES ('soft_delete_backfill', jsonb_build_object('table', tbl, 'rows_backfilled', affected));
    END IF;
  END LOOP;
END $$;

INSERT INTO schema_migrations (version) VALUES ('126_soft_delete_uniform');

COMMIT;
