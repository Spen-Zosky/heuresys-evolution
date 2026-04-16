-- Migration 116: Analytics compound indexes + sync_queue cleanup
-- Sprint 3 remediation: Data + Performance CRITICAL
-- Date: 2026-03-19
--
-- Task 3.1: Compound indexes for analytics query performance
-- Task 3.3: Cleanup stale cancelled records from sync_queue
--
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block,
-- so indexes are created outside BEGIN/COMMIT. IF NOT EXISTS ensures idempotency.

-- =============================================================================
-- TASK 3.1: Analytics compound indexes
-- These compound indexes speed up tenant-scoped queries on high-volume tables.
-- Single-column indexes already exist but compound (tenant_id, X) are needed
-- for the common access pattern: WHERE tenant_id = $1 AND employee_id = $2
-- =============================================================================

-- goals: compound (tenant_id, employee_id) — 1,065 rows, frequently filtered
CREATE INDEX IF NOT EXISTS idx_goals_tenant_employee
  ON goals(tenant_id, employee_id);

-- check_ins: compound (tenant_id, employee_id) — 2,495 rows, frequent joins
CREATE INDEX IF NOT EXISTS idx_checkins_tenant_employee
  ON check_ins(tenant_id, employee_id);

-- employee_skills: compound (tenant_id, employee_id) — skill matrix queries
CREATE INDEX IF NOT EXISTS idx_employee_skills_tenant_employee
  ON employee_skills(tenant_id, employee_id);

-- performance_reviews: compound (tenant_id, review_cycle_id) — cycle reporting
-- NOTE: idx_performance_reviews_employee already covers (tenant_id, employee_id)
CREATE INDEX IF NOT EXISTS idx_reviews_tenant_cycle
  ON performance_reviews(tenant_id, review_cycle_id);

-- =============================================================================
-- TASK 3.3: Cleanup stale sync_queue records
-- 1,590 cancelled records older than 30 days serve no purpose
-- =============================================================================

DELETE FROM sync_queue
  WHERE status = 'cancelled'
    AND created_at < NOW() - INTERVAL '30 days';

-- =============================================================================
-- Track this migration
-- =============================================================================

INSERT INTO schema_migrations (version, applied_at)
VALUES ('116_analytics_indexes_and_cleanup', NOW());
