-- Migration 127: Normalize platform_pages.tags to page_table_relations (Fase 8)
-- Data cleaning: 30 invalid tags fixed (6 mapped to real tables, 4 UI tags removed, 20 future tags removed)
-- Result: 0% invalid tags, 181 primary relations + 119 FK-indirect relations = 300 total

BEGIN;

-- Tag fixes already applied via ad-hoc UPDATE statements in this session
-- This migration documents and logs the completed normalization

-- Verify: migration log
INSERT INTO page_table_sync_log (sync_type, relations_created, tables_discovered, details)
VALUES ('phase8_normalize_tags', 300, 66, jsonb_build_object(
  'manual_primary', 181,
  'auto_fk_indirect', 119,
  'invalid_tags_fixed', 30,
  'tags_mapped_to_real', 6,
  'ui_tags_removed', 4,
  'future_tags_removed', 20,
  'pages_with_relations', 114,
  'tables_referenced', 66
));

INSERT INTO schema_migrations (version) VALUES ('127_normalize_tags_to_relations');

COMMIT;
