-- Migration 161: Seed demo data for empty critical tables
-- Idempotent: uses ON CONFLICT DO NOTHING
-- Targets: RTL Bank (0c54b84a-db6e-4da4-bc91-af5d480d524e) and SmartFood (1d7bf448-ceac-4215-917d-45ff13678104)

-- =============================================================================
-- RBP Teams + Members + Leaders
-- =============================================================================

INSERT INTO rbp_teams (tenant_id, code, name, description, purpose, created_by, is_active) VALUES
  ('0c54b84a-db6e-4da4-bc91-af5d480d524e', 'rtl-risk-mgmt', 'Risk Management Team', 'Cross-functional team for risk assessment', 'Operational risk monitoring', 'faeb925f-c1d2-48cc-810d-0792baf7bb13', true),
  ('0c54b84a-db6e-4da4-bc91-af5d480d524e', 'rtl-digital', 'Digital Transformation', 'Digital innovation and process automation', 'Drive digital banking initiatives', 'faeb925f-c1d2-48cc-810d-0792baf7bb13', true),
  ('0c54b84a-db6e-4da4-bc91-af5d480d524e', 'rtl-compliance', 'Compliance Unit', 'Regulatory compliance and audit', 'Ensure regulatory adherence', 'faeb925f-c1d2-48cc-810d-0792baf7bb13', true),
  ('1d7bf448-ceac-4215-917d-45ff13678104', 'sf-product-dev', 'Product Development', 'New product R&D team', 'Innovate food product line', 'c14c9f2d-e1fd-4fc6-9e77-2e677fb2f686', true),
  ('1d7bf448-ceac-4215-917d-45ff13678104', 'sf-quality', 'Quality Assurance', 'Food quality and safety', 'Maintain ISO 22000 standards', 'c14c9f2d-e1fd-4fc6-9e77-2e677fb2f686', true),
  ('1d7bf448-ceac-4215-917d-45ff13678104', 'sf-logistics', 'Logistics & Supply Chain', 'Distribution and supply management', 'Optimize delivery network', 'c14c9f2d-e1fd-4fc6-9e77-2e677fb2f686', true)
ON CONFLICT DO NOTHING;

-- Team members (RTL Bank teams)
INSERT INTO rbp_team_members (team_id, employee_id, role_in_team) VALUES
  ((SELECT id FROM rbp_teams WHERE code = 'rtl-risk-mgmt'), '51e989a2-0266-4c70-abae-1af8e742fe42', 'analyst'),
  ((SELECT id FROM rbp_teams WHERE code = 'rtl-risk-mgmt'), 'd9d32524-ba0b-450c-9dcf-1cd2a347d7a3', 'analyst'),
  ((SELECT id FROM rbp_teams WHERE code = 'rtl-risk-mgmt'), '5c50a8cc-da3c-4a4e-a8f9-96f221f299fe', 'coordinator'),
  ((SELECT id FROM rbp_teams WHERE code = 'rtl-digital'), '6e728c0a-400a-4fe3-ab2d-e9f662774313', 'developer'),
  ((SELECT id FROM rbp_teams WHERE code = 'rtl-digital'), '282dfaaf-5489-401f-a898-c055d10c6b0b', 'ux-designer'),
  ((SELECT id FROM rbp_teams WHERE code = 'rtl-digital'), 'ffa50514-b899-44ce-b5f6-43f5fe9f3a01', 'project-lead')
ON CONFLICT DO NOTHING;

-- Team members (SmartFood teams)
INSERT INTO rbp_team_members (team_id, employee_id, role_in_team) VALUES
  ((SELECT id FROM rbp_teams WHERE code = 'sf-product-dev'), 'a2640b85-8020-416c-bbc5-bf26c1be74e4', 'food-scientist'),
  ((SELECT id FROM rbp_teams WHERE code = 'sf-product-dev'), 'dd2ea78a-e3cc-4f94-86a9-099442276669', 'nutritionist'),
  ((SELECT id FROM rbp_teams WHERE code = 'sf-product-dev'), '4238b6b5-1cb0-465c-a8aa-fa06b0f28fdd', 'packaging-engineer'),
  ((SELECT id FROM rbp_teams WHERE code = 'sf-quality'), '1ea608e2-6331-49ee-9a7f-94d52edc6a94', 'quality-inspector'),
  ((SELECT id FROM rbp_teams WHERE code = 'sf-quality'), 'a2640b85-8020-416c-bbc5-bf26c1be74e4', 'auditor')
ON CONFLICT DO NOTHING;

-- Team leaders
INSERT INTO rbp_team_leaders (team_id, leader_id) VALUES
  ((SELECT id FROM rbp_teams WHERE code = 'rtl-risk-mgmt'), '5c50a8cc-da3c-4a4e-a8f9-96f221f299fe'),
  ((SELECT id FROM rbp_teams WHERE code = 'rtl-digital'), 'ffa50514-b899-44ce-b5f6-43f5fe9f3a01'),
  ((SELECT id FROM rbp_teams WHERE code = 'sf-product-dev'), 'dd2ea78a-e3cc-4f94-86a9-099442276669'),
  ((SELECT id FROM rbp_teams WHERE code = 'sf-quality'), '1ea608e2-6331-49ee-9a7f-94d52edc6a94')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Widget Templates (dashboard widgets)
-- =============================================================================

INSERT INTO widget_templates (id, tenant_id, code, name, description, widget_type, data_source, query_config, display_config, default_width, default_height, category, is_system, is_active) VALUES
  (gen_random_uuid(), '0c54b84a-db6e-4da4-bc91-af5d480d524e', 'headcount-trend', 'Headcount Trend', 'Monthly headcount evolution', 'line-chart', 'employees', '{"period": "12m", "groupBy": "month"}', '{"colors": ["#2563eb"], "showLegend": true}', 6, 4, 'hr-analytics', false, true),
  (gen_random_uuid(), '0c54b84a-db6e-4da4-bc91-af5d480d524e', 'dept-distribution', 'Department Distribution', 'Employee count per department', 'pie-chart', 'org_units', '{"metric": "employee_count"}', '{"colors": ["#2563eb","#7c3aed","#db2777","#ea580c","#16a34a"]}', 4, 4, 'hr-analytics', false, true),
  (gen_random_uuid(), '0c54b84a-db6e-4da4-bc91-af5d480d524e', 'turnover-rate', 'Turnover Rate', 'Annual turnover percentage', 'kpi-card', 'employees', '{"period": "1y", "metric": "turnover"}', '{"format": "percentage", "thresholds": {"warning": 15, "danger": 25}}', 2, 2, 'hr-analytics', false, true),
  (gen_random_uuid(), '1d7bf448-ceac-4215-917d-45ff13678104', 'skill-gap-radar', 'Skill Gap Radar', 'Team skill coverage vs required', 'radar-chart', 'employee_skill_profiles', '{"topN": 8}', '{"showGrid": true, "fillOpacity": 0.3}', 6, 6, 'talent', false, true),
  (gen_random_uuid(), '1d7bf448-ceac-4215-917d-45ff13678104', 'training-completion', 'Training Completion', 'Course completion rates by department', 'bar-chart', 'course_enrollments', '{"groupBy": "department"}', '{"orientation": "horizontal"}', 6, 4, 'learning', false, true),
  (gen_random_uuid(), '0c54b84a-db6e-4da4-bc91-af5d480d524e', 'open-positions', 'Open Positions', 'Active job openings count', 'kpi-card', 'positions', '{"filter": "status=open"}', '{"icon": "briefcase", "format": "number"}', 2, 2, 'recruiting', false, true),
  (gen_random_uuid(), '1d7bf448-ceac-4215-917d-45ff13678104', 'attendance-heatmap', 'Attendance Heatmap', 'Weekly attendance patterns', 'heatmap', 'attendance_records', '{"period": "4w"}', '{"colorScale": "green-red"}', 6, 4, 'operations', false, true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Register this migration
-- =============================================================================

INSERT INTO schema_migrations (version) VALUES ('161') ON CONFLICT DO NOTHING;
