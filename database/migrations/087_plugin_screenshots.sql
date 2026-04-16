-- =============================================================================
-- Migration: 087_plugin_screenshots.sql
-- Description: Add screenshot and banner fields to the plugins table for
--              richer marketplace listings.
-- Date: 2026-02-05
-- =============================================================================

BEGIN;

-- Add screenshot_urls (array of image URLs) and banner_url to plugins table
ALTER TABLE plugins
  ADD COLUMN IF NOT EXISTS screenshot_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500);

COMMIT;
