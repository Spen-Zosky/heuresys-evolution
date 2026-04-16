-- Migration 125: JSONB Classification (Fase 3b)
-- Classifies all JSONB columns as either normalizable or JSONB-by-design
-- Does NOT normalize yet — just documents the decision via COMMENT

BEGIN;

-- ============================================
-- CATEGORY (a): NORMALIZABLE — should become 1:N or M:N tables
-- These contain arrays of IDs or structured relational data
-- Actual normalization deferred to Phase 8 with the text[] columns
-- ============================================

COMMENT ON COLUMN employees.family_members IS 'NORMALIZABLE: should become employee_family_members (1:N). Contains array of {name, relationship, dob, phone}.';
COMMENT ON COLUMN employees.education_history IS 'NORMALIZABLE: should become employee_education (1:N). Contains array of {degree, institution, year, field}.';
COMMENT ON COLUMN check_ins.goals_discussed IS 'NORMALIZABLE: should become check_in_goals (M:N junction to goals). Contains array of goal_id references.';
COMMENT ON COLUMN check_ins.action_items IS 'NORMALIZABLE: should become check_in_actions (1:N). Contains array of {description, assignee, due_date, status}.';
COMMENT ON COLUMN check_ins.follow_up_items IS 'NORMALIZABLE: should become check_in_follow_ups (1:N). Contains array of {item, owner, due_date}.';
COMMENT ON COLUMN interviews.interviewers IS 'NORMALIZABLE: should become interview_participants (M:N junction). Contains array of user_id/employee_id.';
COMMENT ON COLUMN dashboards.shared_with_roles IS 'NORMALIZABLE: should become dashboard_role_access (M:N junction). Contains array of role names.';

-- ============================================
-- CATEGORY (b): JSONB BY DESIGN — remains JSONB for valid reasons
-- ============================================

-- Snapshots (point-in-time, not queryable as relations)
COMMENT ON COLUMN org_chart_snapshots.tree_structure IS 'JSONB BY DESIGN: point-in-time snapshot of org hierarchy. Not a live relation.';
COMMENT ON COLUMN org_chart_snapshots.employees_map IS 'JSONB BY DESIGN: snapshot of employee positions at a point in time.';
COMMENT ON COLUMN org_chart_snapshots.excalidraw_format IS 'JSONB BY DESIGN: rendering format for visual org chart.';
COMMENT ON COLUMN org_chart_snapshots.statistics IS 'JSONB BY DESIGN: computed statistics snapshot.';

-- Report builder DSL (schema definition, not relational data)
COMMENT ON COLUMN report_definitions.columns IS 'JSONB BY DESIGN: report builder column definition DSL.';
COMMENT ON COLUMN report_definitions.filters IS 'JSONB BY DESIGN: report builder filter definition DSL.';
COMMENT ON COLUMN report_definitions.joins IS 'JSONB BY DESIGN: report builder join definition DSL.';
COMMENT ON COLUMN report_definitions.calculated_fields IS 'JSONB BY DESIGN: computed field expressions.';
COMMENT ON COLUMN report_definitions.grouping IS 'JSONB BY DESIGN: aggregation grouping config.';
COMMENT ON COLUMN report_definitions.sorting IS 'JSONB BY DESIGN: sort order config.';
COMMENT ON COLUMN report_definitions.parameters IS 'JSONB BY DESIGN: parameterized report inputs.';
COMMENT ON COLUMN report_definitions.chart_config IS 'JSONB BY DESIGN: chart rendering config.';
COMMENT ON COLUMN report_definitions.drill_down_config IS 'JSONB BY DESIGN: drill-down navigation config.';
COMMENT ON COLUMN report_definitions.access_control IS 'JSONB BY DESIGN: report access rules.';

-- Embedded evaluation data (tightly coupled to parent, no independent query need)
COMMENT ON COLUMN performance_reviews.competency_ratings IS 'JSONB BY DESIGN: embedded competency scores, tightly coupled to the review.';
COMMENT ON COLUMN performance_reviews.goal_ratings IS 'JSONB BY DESIGN: embedded goal achievement scores.';
COMMENT ON COLUMN performance_reviews.recommended_actions IS 'JSONB BY DESIGN: free-form development recommendations.';
COMMENT ON COLUMN performance_reviews.section_ratings IS 'JSONB BY DESIGN: per-section rating breakdown.';
COMMENT ON COLUMN self_reviews.competency_self_ratings IS 'JSONB BY DESIGN: self-assessment scores, mirrors performance_reviews structure.';
COMMENT ON COLUMN self_reviews.goal_ratings IS 'JSONB BY DESIGN: self goal ratings.';
COMMENT ON COLUMN self_reviews.goal_self_assessments IS 'JSONB BY DESIGN: detailed self-assessment text per goal.';
COMMENT ON COLUMN self_reviews.ksaba_ratings IS 'JSONB BY DESIGN: KSABA framework self-ratings.';
COMMENT ON COLUMN feedback_360.question_responses IS 'JSONB BY DESIGN: embedded survey responses with scores, tightly coupled.';
COMMENT ON COLUMN interviews.scorecard IS 'JSONB BY DESIGN: interview evaluation scorecard.';

-- Metadata / dynamic attributes
COMMENT ON COLUMN contracts.metadata IS 'JSONB BY DESIGN: dynamic contract attributes varying by type.';
COMMENT ON COLUMN goals.custom_fields IS 'JSONB BY DESIGN: user-defined goal extensions.';
COMMENT ON COLUMN goals.smart_criteria IS 'JSONB BY DESIGN: SMART goal evaluation criteria.';
COMMENT ON COLUMN goals.tags IS 'JSONB BY DESIGN: free-form goal categorization tags.';
COMMENT ON COLUMN dashboards.layout IS 'JSONB BY DESIGN: widget layout grid configuration.';

-- Check-in discussion topics (free-form, not relational)
COMMENT ON COLUMN check_ins.topics_discussed IS 'JSONB BY DESIGN: free-form topic list, not referencing other entities.';

-- SAP staging (temporary, not queryable)
COMMENT ON COLUMN sap_staged_data.mapped_data IS 'JSONB BY DESIGN: staging buffer for SAP import.';
COMMENT ON COLUMN sap_staged_data.raw_data IS 'JSONB BY DESIGN: raw SAP data before mapping.';
COMMENT ON COLUMN sap_staged_data.validation_errors IS 'JSONB BY DESIGN: transient validation results.';
COMMENT ON COLUMN sap_staged_data.validation_warnings IS 'JSONB BY DESIGN: transient validation warnings.';

-- Analytics snapshots (computed, not relational)
COMMENT ON COLUMN skill_gap_analyses.skill_gaps IS 'JSONB BY DESIGN: computed gap analysis results snapshot.';
COMMENT ON COLUMN skill_gap_analyses.recommendations IS 'JSONB BY DESIGN: computed learning recommendations.';
COMMENT ON COLUMN skill_gap_analyses.skill_matches IS 'JSONB BY DESIGN: computed skill match scores.';
COMMENT ON COLUMN skill_gap_analyses.skill_surplus IS 'JSONB BY DESIGN: computed surplus analysis.';
COMMENT ON COLUMN skill_gap_analyses.priority_skills IS 'JSONB BY DESIGN: computed priority ranking.';
COMMENT ON COLUMN skill_gap_analyses.internal_comparison IS 'JSONB BY DESIGN: computed internal benchmark.';
COMMENT ON COLUMN skill_gap_analyses.market_comparison IS 'JSONB BY DESIGN: computed market benchmark.';
COMMENT ON COLUMN workforce_plans.gap_analysis IS 'JSONB BY DESIGN: computed workforce gap.';
COMMENT ON COLUMN workforce_plans.hiring_recommendations IS 'JSONB BY DESIGN: computed hiring suggestions.';
COMMENT ON COLUMN workforce_plans.requirements IS 'JSONB BY DESIGN: workforce demand model.';
COMMENT ON COLUMN workforce_plans.summary IS 'JSONB BY DESIGN: plan summary snapshot.';
COMMENT ON COLUMN workforce_plans.training_investments IS 'JSONB BY DESIGN: computed training ROI.';

-- ============================================
-- LOG
-- ============================================

INSERT INTO page_table_sync_log (sync_type, details) VALUES
  ('jsonb_classification', jsonb_build_object(
    'normalizable', 7,
    'jsonb_by_design', 46,
    'total_classified', 53
  ));

INSERT INTO schema_migrations (version) VALUES ('125_jsonb_classification');

COMMIT;
