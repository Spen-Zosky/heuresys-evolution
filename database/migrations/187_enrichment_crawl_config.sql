BEGIN;
ALTER TABLE enrichment_entity_descriptors
  ADD COLUMN IF NOT EXISTS crawl_config JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN enrichment_entity_descriptors.crawl_config IS 'P9 data-driven crawl settings: max_depth, max_pages, include_paths, exclude_paths';
COMMIT;
