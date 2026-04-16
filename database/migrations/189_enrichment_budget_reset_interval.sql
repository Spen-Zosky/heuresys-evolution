-- ============================================================================
-- Migration 189: Enrichment budget reset interval
-- ============================================================================
-- Adds the budget_reset_interval column to enrichment_merge_policies so the
-- budget-reset BullMQ scheduler can determine when each policy is due for a
-- reset.  The default is 30 days, matching the typical monthly billing cycle.
--
-- The scheduler (services/enrichment-engine/src/worker/budget-reset.ts) runs
-- a repeatable BullMQ job that resets current_usage_eur to 0 for policies
-- where budget_reset_at + budget_reset_interval <= NOW().
--
-- Idempotent: uses IF NOT EXISTS.
-- ============================================================================

BEGIN;

ALTER TABLE enrichment_merge_policies
  ADD COLUMN IF NOT EXISTS budget_reset_interval INTERVAL NOT NULL DEFAULT '30 days';

COMMENT ON COLUMN enrichment_merge_policies.budget_reset_interval
  IS 'P9 data-driven interval between automatic budget resets';

COMMIT;
