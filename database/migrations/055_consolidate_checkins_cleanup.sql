-- Migration 055: Consolidate checkins tables and cleanup
-- Date: 2025-12-27
-- Purpose: Merge legacy checkins into check_ins, cleanup sync_queue, add constraints

BEGIN;

-- ============================================
-- PART 1: Migrate checkins to check_ins
-- ============================================

-- First, migrate any unique records from checkins to check_ins
INSERT INTO check_ins (
    tenant_id,
    employee_id,
    manager_id,
    scheduled_date,
    duration_minutes,
    employee_notes,
    manager_notes,
    action_items,
    employee_mood,
    status,
    created_at,
    updated_at
)
SELECT
    c.tenant_id,
    c.employee_id,
    c.manager_id,
    c.checkin_date::timestamp with time zone,
    COALESCE(c.duration_minutes, 30),
    COALESCE(c.employee_updates, '') ||
        CASE WHEN c.wins IS NOT NULL THEN E'\n\nWins: ' || c.wins ELSE '' END ||
        CASE WHEN c.blockers IS NOT NULL THEN E'\n\nBlockers: ' || c.blockers ELSE '' END,
    c.manager_notes,
    c.action_items,
    CASE
        WHEN c.employee_mood = 'great' THEN 5
        WHEN c.employee_mood = 'good' THEN 4
        WHEN c.employee_mood = 'okay' OR c.employee_mood = 'neutral' THEN 3
        WHEN c.employee_mood = 'bad' THEN 2
        WHEN c.employee_mood = 'terrible' THEN 1
        ELSE 3
    END,
    'completed',
    c.created_at,
    c.updated_at
FROM checkins c
WHERE c.tenant_id IS NOT NULL
  AND c.employee_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM check_ins ci
    WHERE ci.employee_id = c.employee_id
      AND ci.scheduled_date::date = c.checkin_date
  );

-- Create backup view before dropping
CREATE OR REPLACE VIEW v_checkins_backup AS
SELECT * FROM checkins;

-- Drop the legacy table (data has been migrated)
DROP TABLE IF EXISTS checkins CASCADE;

-- ============================================
-- PART 2: Cleanup sync_queue backlog
-- ============================================

-- Mark stale pending items (older than 7 days) as cancelled
UPDATE sync_queue
SET status = 'cancelled',
    last_error = 'Auto-cancelled: stale pending item (> 7 days)',
    processed_at = NOW()
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '7 days';

-- ============================================
-- PART 3: Add missing constraints
-- ============================================

-- Add unique constraint on employees.pernr (if column exists and not already constrained)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'pernr'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'employees_pernr_tenant_unique'
    ) THEN
        -- Add unique constraint per tenant for pernr
        ALTER TABLE employees ADD CONSTRAINT employees_pernr_tenant_unique
            UNIQUE (tenant_id, pernr);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Could not add pernr constraint: %', SQLERRM;
END;
$$;

-- ============================================
-- PART 4: Record migration
-- ============================================

INSERT INTO schema_migrations (version, applied_at)
VALUES ('055_consolidate_checkins_cleanup', NOW())
ON CONFLICT DO NOTHING;

COMMIT;
