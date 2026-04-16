-- Migration: 092_rls_missing_policies.sql
-- Description: Add missing RLS tenant isolation policies for 21 tables
--              that have tenant_id and RLS enabled but no policies defined.
-- Date: 2026-02-25
-- Risk: HIGH - These tables currently BLOCK all non-superuser access
--        because RLS is enabled with zero policies.
--
-- NOTE: ALTER TABLE ... ENABLE ROW LEVEL SECURITY is already set on all
--       21 tables. Only CREATE POLICY statements are needed.

BEGIN;

-- 1. calibration_adjustments
CREATE POLICY tenant_isolation ON calibration_adjustments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON calibration_adjustments
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 2. competencies
CREATE POLICY tenant_isolation ON competencies
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON competencies
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 3. competency_frameworks
CREATE POLICY tenant_isolation ON competency_frameworks
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON competency_frameworks
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 4. crawl_runs
CREATE POLICY tenant_isolation ON crawl_runs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON crawl_runs
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 5. crawler_configs
CREATE POLICY tenant_isolation ON crawler_configs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON crawler_configs
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 6. employee_skill_mappings
CREATE POLICY tenant_isolation ON employee_skill_mappings
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON employee_skill_mappings
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 7. extracted_skills
CREATE POLICY tenant_isolation ON extracted_skills
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON extracted_skills
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 8. goal_alignments
CREATE POLICY tenant_isolation ON goal_alignments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON goal_alignments
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 9. goal_comments
CREATE POLICY tenant_isolation ON goal_comments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON goal_comments
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 10. goal_milestones
CREATE POLICY tenant_isolation ON goal_milestones
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON goal_milestones
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 11. goal_updates
CREATE POLICY tenant_isolation ON goal_updates
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON goal_updates
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 12. job_postings_raw
CREATE POLICY tenant_isolation ON job_postings_raw
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON job_postings_raw
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 13. key_results
CREATE POLICY tenant_isolation ON key_results
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON key_results
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 14. market_benchmarks
CREATE POLICY tenant_isolation ON market_benchmarks
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON market_benchmarks
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 15. okr_checkins
CREATE POLICY tenant_isolation ON okr_checkins
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON okr_checkins
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 16. rating_scales
CREATE POLICY tenant_isolation ON rating_scales
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON rating_scales
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 17. self_reviews
CREATE POLICY tenant_isolation ON self_reviews
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON self_reviews
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 18. skill_demand_metrics
CREATE POLICY tenant_isolation ON skill_demand_metrics
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON skill_demand_metrics
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 19. skill_gap_snapshots
CREATE POLICY tenant_isolation ON skill_gap_snapshots
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON skill_gap_snapshots
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 20. skill_supply_metrics
CREATE POLICY tenant_isolation ON skill_supply_metrics
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON skill_supply_metrics
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 21. unknown_skills
CREATE POLICY tenant_isolation ON unknown_skills
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON unknown_skills
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

COMMIT;
