-- Migration 032: Performance Management Enhanced
-- Sprint 2025-05: S-PERF-01-01 Review Cycle Configuration
-- Created: 2025-12-26

-- ============================================================================
-- 1. ENHANCE REVIEW_CYCLES TABLE
-- ============================================================================

-- Add missing columns to review_cycles
ALTER TABLE review_cycles
ADD COLUMN IF NOT EXISTS self_review_deadline DATE,
ADD COLUMN IF NOT EXISTS manager_review_deadline DATE,
ADD COLUMN IF NOT EXISTS calibration_deadline DATE,
ADD COLUMN IF NOT EXISTS finalization_deadline DATE,
ADD COLUMN IF NOT EXISTS include_self_review BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS include_peer_review BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS include_360_feedback BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rating_scale_type VARCHAR(20) DEFAULT '1-5',
ADD COLUMN IF NOT EXISTS rating_scale_config JSONB DEFAULT '{"min": 1, "max": 5, "labels": ["Needs Improvement", "Below Expectations", "Meets Expectations", "Exceeds Expectations", "Outstanding"]}',
ADD COLUMN IF NOT EXISTS launched_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS template_id UUID;

COMMENT ON COLUMN review_cycles.rating_scale_type IS 'Rating scale: 1-5, 1-10, or descriptive';
COMMENT ON COLUMN review_cycles.rating_scale_config IS 'JSON config with min, max, and labels';

-- ============================================================================
-- 2. REVIEW CYCLE PHASES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS review_cycle_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  review_cycle_id UUID NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  phase_name VARCHAR(50) NOT NULL, -- self_assessment, peer_feedback, manager_review, calibration, finalization
  phase_order INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, completed, skipped
  instructions TEXT,
  reminder_days_before INTEGER DEFAULT 3,
  escalation_days_after INTEGER DEFAULT 2,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_cycle_id, phase_name)
);

CREATE INDEX IF NOT EXISTS idx_review_cycle_phases_cycle ON review_cycle_phases(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_review_cycle_phases_tenant ON review_cycle_phases(tenant_id);

COMMENT ON TABLE review_cycle_phases IS 'Configurable phases for each review cycle';

-- ============================================================================
-- 3. REVIEW CYCLE PARTICIPANTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS review_cycle_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  review_cycle_id UUID NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'draft', -- draft, pending, in_progress, completed, skipped
  current_phase VARCHAR(50),
  self_review_completed BOOLEAN DEFAULT false,
  self_review_completed_at TIMESTAMPTZ,
  peer_feedback_requested BOOLEAN DEFAULT false,
  peer_feedback_completed BOOLEAN DEFAULT false,
  manager_review_completed BOOLEAN DEFAULT false,
  manager_review_completed_at TIMESTAMPTZ,
  calibration_completed BOOLEAN DEFAULT false,
  calibration_completed_at TIMESTAMPTZ,
  finalized BOOLEAN DEFAULT false,
  finalized_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_cycle_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_review_cycle_participants_cycle ON review_cycle_participants(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_review_cycle_participants_employee ON review_cycle_participants(employee_id);
CREATE INDEX IF NOT EXISTS idx_review_cycle_participants_manager ON review_cycle_participants(manager_id);
CREATE INDEX IF NOT EXISTS idx_review_cycle_participants_status ON review_cycle_participants(status);
CREATE INDEX IF NOT EXISTS idx_review_cycle_participants_tenant ON review_cycle_participants(tenant_id);

COMMENT ON TABLE review_cycle_participants IS 'Employees participating in a review cycle with phase tracking';

-- ============================================================================
-- 4. PERFORMANCE REVIEW TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_review_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) DEFAULT 'standard', -- standard, manager, peer, 360
  rating_scale_type VARCHAR(20) DEFAULT '1-5',
  rating_scale_config JSONB DEFAULT '{"min": 1, "max": 5, "labels": ["Needs Improvement", "Below Expectations", "Meets Expectations", "Exceeds Expectations", "Outstanding"]}',
  sections JSONB NOT NULL DEFAULT '[]', -- [{name, weight, questions: [{text, type, required}]}]
  competencies JSONB, -- linked competency IDs
  include_goals BOOLEAN DEFAULT true,
  include_development_plan BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perf_review_templates_tenant ON performance_review_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_perf_review_templates_active ON performance_review_templates(is_active);

COMMENT ON TABLE performance_review_templates IS 'Configurable templates for performance reviews with sections and rating scales';

-- ============================================================================
-- 5. UPDATE PERFORMANCE_REVIEWS TABLE
-- ============================================================================

ALTER TABLE performance_reviews
ADD COLUMN IF NOT EXISTS review_cycle_id UUID REFERENCES review_cycles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES performance_review_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS self_rating NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS self_comments TEXT,
ADD COLUMN IF NOT EXISTS self_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS manager_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS calibrated_rating NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS calibration_notes TEXT,
ADD COLUMN IF NOT EXISTS calibrated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS calibrated_by UUID REFERENCES employees(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES employees(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS section_ratings JSONB; -- {section_name: rating, ...}

CREATE INDEX IF NOT EXISTS idx_performance_reviews_cycle ON performance_reviews(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_template ON performance_reviews(template_id);

-- ============================================================================
-- 6. REVIEW CYCLE NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS review_cycle_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  review_cycle_id UUID NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- cycle_launched, phase_started, deadline_reminder, deadline_passed, cycle_completed
  recipient_type VARCHAR(20) NOT NULL, -- all_participants, managers, hr, specific
  recipient_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  subject VARCHAR(255),
  body TEXT,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_notifications_cycle ON review_cycle_notifications(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_review_notifications_status ON review_cycle_notifications(status);
CREATE INDEX IF NOT EXISTS idx_review_notifications_scheduled ON review_cycle_notifications(scheduled_at);

-- ============================================================================
-- 7. INSERT DEFAULT TEMPLATE
-- ============================================================================

INSERT INTO performance_review_templates (
  tenant_id, name, description, template_type, rating_scale_type, rating_scale_config, sections, is_default, is_active
)
SELECT
  t.id,
  'Standard Annual Review',
  'Default template for annual performance reviews',
  'standard',
  '1-5',
  '{"min": 1, "max": 5, "labels": ["Needs Improvement", "Below Expectations", "Meets Expectations", "Exceeds Expectations", "Outstanding"]}',
  '[
    {"name": "Goal Achievement", "weight": 40, "questions": [
      {"text": "Rate achievement of assigned goals", "type": "rating", "required": true},
      {"text": "Describe key accomplishments", "type": "text", "required": true}
    ]},
    {"name": "Core Competencies", "weight": 30, "questions": [
      {"text": "Communication skills", "type": "rating", "required": true},
      {"text": "Teamwork and collaboration", "type": "rating", "required": true},
      {"text": "Problem solving", "type": "rating", "required": true},
      {"text": "Technical skills", "type": "rating", "required": true}
    ]},
    {"name": "Development", "weight": 20, "questions": [
      {"text": "Areas for improvement", "type": "text", "required": true},
      {"text": "Development goals for next period", "type": "text", "required": true}
    ]},
    {"name": "Overall Assessment", "weight": 10, "questions": [
      {"text": "Overall performance rating", "type": "rating", "required": true},
      {"text": "Summary comments", "type": "text", "required": true}
    ]}
  ]'::jsonb,
  true,
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM performance_review_templates prt
  WHERE prt.tenant_id = t.id AND prt.is_default = true
);

-- ============================================================================
-- 8. CREATE VIEW FOR REVIEW CYCLE SUMMARY
-- ============================================================================

CREATE OR REPLACE VIEW v_review_cycle_summary AS
SELECT
  rc.id,
  rc.tenant_id,
  rc.name,
  rc.cycle_type,
  rc.status,
  rc.start_date,
  rc.end_date,
  rc.self_review_deadline,
  rc.manager_review_deadline,
  rc.calibration_deadline,
  rc.finalization_deadline,
  rc.rating_scale_type,
  rc.launched_at,
  rc.completed_at,
  COUNT(rcp.id) AS total_participants,
  COUNT(CASE WHEN rcp.status = 'completed' THEN 1 END) AS completed_participants,
  COUNT(CASE WHEN rcp.status = 'in_progress' THEN 1 END) AS in_progress_participants,
  COUNT(CASE WHEN rcp.status = 'pending' THEN 1 END) AS pending_participants,
  COUNT(CASE WHEN rcp.self_review_completed THEN 1 END) AS self_reviews_completed,
  COUNT(CASE WHEN rcp.manager_review_completed THEN 1 END) AS manager_reviews_completed,
  COUNT(CASE WHEN rcp.calibration_completed THEN 1 END) AS calibrations_completed,
  ROUND(
    COUNT(CASE WHEN rcp.status = 'completed' THEN 1 END)::numeric /
    NULLIF(COUNT(rcp.id)::numeric, 0) * 100,
    2
  ) AS completion_percentage
FROM review_cycles rc
LEFT JOIN review_cycle_participants rcp ON rc.id = rcp.review_cycle_id
GROUP BY rc.id;

COMMENT ON VIEW v_review_cycle_summary IS 'Aggregated view of review cycle progress';

-- ============================================================================
-- 9. CREATE FUNCTION FOR AUTO-ASSIGNING PARTICIPANTS
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auto_assign_review_participants(
  p_tenant_id UUID,
  p_cycle_id UUID,
  p_department_ids UUID[] DEFAULT NULL,
  p_employee_status VARCHAR DEFAULT 'active'
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO review_cycle_participants (
    tenant_id, review_cycle_id, employee_id, manager_id, status
  )
  SELECT
    p_tenant_id,
    p_cycle_id,
    e.id,
    e.manager_id,
    'draft'
  FROM employees e
  WHERE e.tenant_id = p_tenant_id
    AND e.status = p_employee_status
    AND (p_department_ids IS NULL OR e.department_id = ANY(p_department_ids))
    AND NOT EXISTS (
      SELECT 1 FROM review_cycle_participants rcp
      WHERE rcp.review_cycle_id = p_cycle_id AND rcp.employee_id = e.id
    )
  ON CONFLICT (review_cycle_id, employee_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_auto_assign_review_participants IS 'Auto-assign employees to a review cycle based on criteria';

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

-- Grant RLS policies
ALTER TABLE review_cycle_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cycle_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_review_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cycle_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON review_cycle_phases
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON review_cycle_participants
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON performance_review_templates
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON review_cycle_notifications
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
