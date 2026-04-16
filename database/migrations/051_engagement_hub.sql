-- Employee Engagement Hub Schema
-- Migration: 051_engagement_hub.sql
-- Date: 2025-12-27
-- Author: Claude Code (Autonomous)

-- ============================================================================
-- SURVEY TEMPLATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS engagement_survey_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'custom',
  questions JSONB NOT NULL DEFAULT '[]',
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_category CHECK (category IN ('engagement', 'wellbeing', 'exit', 'onboarding', 'custom'))
);

COMMENT ON TABLE engagement_survey_templates IS 'Survey templates for reuse across surveys';
COMMENT ON COLUMN engagement_survey_templates.questions IS 'JSONB array of question definitions with id, text, type, required, options';

-- ============================================================================
-- SURVEYS
-- ============================================================================
CREATE TABLE IF NOT EXISTS engagement_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id UUID REFERENCES engagement_survey_templates(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]',
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  audience_type VARCHAR(20) NOT NULL DEFAULT 'all',
  audience_ids UUID[] DEFAULT '{}',
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  reminder_days INTEGER[] DEFAULT '{3,7}',
  total_invitations INTEGER NOT NULL DEFAULT 0,
  total_responses INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'closed')),
  CONSTRAINT valid_audience CHECK (audience_type IN ('all', 'department', 'org_unit', 'location', 'custom'))
);

COMMENT ON TABLE engagement_surveys IS 'Survey instances distributed to employees';

-- ============================================================================
-- SURVEY RESPONSES
-- ============================================================================
CREATE TABLE IF NOT EXISTS engagement_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  survey_id UUID NOT NULL REFERENCES engagement_surveys(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  anonymous_token VARCHAR(64),
  answers JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  is_complete BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON TABLE engagement_survey_responses IS 'Individual survey responses from employees';
COMMENT ON COLUMN engagement_survey_responses.anonymous_token IS 'Hash token for anonymous response tracking';

-- Unique constraints for response deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_responses_employee_unique
  ON engagement_survey_responses(survey_id, employee_id)
  WHERE employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_responses_anonymous_unique
  ON engagement_survey_responses(survey_id, anonymous_token)
  WHERE anonymous_token IS NOT NULL;

-- ============================================================================
-- PULSE CHECK CONFIGURATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS engagement_pulse_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  frequency VARCHAR(20) NOT NULL DEFAULT 'biweekly',
  audience_type VARCHAR(20) NOT NULL DEFAULT 'all',
  audience_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_send_date TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_frequency CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  CONSTRAINT max_questions CHECK (jsonb_array_length(questions) <= 5)
);

COMMENT ON TABLE engagement_pulse_configs IS 'Recurring pulse check configurations';

-- ============================================================================
-- ANONYMOUS FEEDBACK
-- ============================================================================
CREATE TABLE IF NOT EXISTS engagement_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL DEFAULT 'other',
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  action_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_category CHECK (category IN ('suggestion', 'concern', 'recognition', 'other')),
  CONSTRAINT valid_status CHECK (status IN ('new', 'reviewed', 'actioned', 'archived'))
);

COMMENT ON TABLE engagement_feedback IS 'Anonymous employee feedback submissions';

-- ============================================================================
-- ACTION PLANS
-- ============================================================================
CREATE TABLE IF NOT EXISTS engagement_action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  source_id UUID,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'planned',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_source CHECK (source_type IN ('survey', 'pulse', 'feedback', 'manual')),
  CONSTRAINT valid_status CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

COMMENT ON TABLE engagement_action_plans IS 'Action plans created from engagement insights';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_engagement_templates_tenant ON engagement_survey_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_engagement_templates_category ON engagement_survey_templates(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_engagement_surveys_tenant ON engagement_surveys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_engagement_surveys_status ON engagement_surveys(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_engagement_surveys_dates ON engagement_surveys(tenant_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_engagement_responses_survey ON engagement_survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_engagement_responses_employee ON engagement_survey_responses(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_engagement_responses_complete ON engagement_survey_responses(survey_id, is_complete);
CREATE INDEX IF NOT EXISTS idx_engagement_pulse_tenant ON engagement_pulse_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_engagement_pulse_active ON engagement_pulse_configs(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_engagement_feedback_tenant ON engagement_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_engagement_feedback_status ON engagement_feedback(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_engagement_feedback_created ON engagement_feedback(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_actions_tenant ON engagement_action_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_engagement_actions_status ON engagement_action_plans(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_engagement_actions_owner ON engagement_action_plans(owner_id);

-- ============================================================================
-- ANALYTICS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW v_engagement_analytics AS
WITH survey_metrics AS (
  SELECT
    s.tenant_id,
    DATE_TRUNC('month', s.created_at) as period,
    COUNT(DISTINCT s.id) as total_surveys,
    SUM(s.total_invitations) as total_invitations,
    SUM(s.total_responses) as total_responses,
    CASE
      WHEN SUM(s.total_invitations) > 0
      THEN ROUND((SUM(s.total_responses)::NUMERIC / SUM(s.total_invitations)::NUMERIC) * 100, 1)
      ELSE 0
    END as response_rate
  FROM engagement_surveys s
  WHERE s.status IN ('active', 'closed')
  GROUP BY s.tenant_id, DATE_TRUNC('month', s.created_at)
),
nps_metrics AS (
  SELECT
    s.tenant_id,
    DATE_TRUNC('month', s.created_at) as period,
    COUNT(*) FILTER (WHERE (a->>'value')::int >= 9) as promoters,
    COUNT(*) FILTER (WHERE (a->>'value')::int BETWEEN 7 AND 8) as passives,
    COUNT(*) FILTER (WHERE (a->>'value')::int <= 6) as detractors,
    COUNT(*) as total_nps_responses
  FROM engagement_surveys s
  JOIN engagement_survey_responses r ON r.survey_id = s.id AND r.is_complete = true
  CROSS JOIN LATERAL jsonb_array_elements(r.answers) a
  JOIN LATERAL jsonb_array_elements(s.questions) q ON (q->>'id') = (a->>'question_id')
  WHERE (q->>'type') = 'nps'
  GROUP BY s.tenant_id, DATE_TRUNC('month', s.created_at)
)
SELECT
  sm.tenant_id,
  sm.period,
  sm.total_surveys,
  sm.total_invitations,
  sm.total_responses,
  sm.response_rate,
  CASE
    WHEN COALESCE(nm.total_nps_responses, 0) > 0
    THEN ROUND(
      ((nm.promoters::NUMERIC / nm.total_nps_responses) - (nm.detractors::NUMERIC / nm.total_nps_responses)) * 100,
      0
    )
    ELSE NULL
  END as enps_score,
  nm.promoters,
  nm.passives,
  nm.detractors
FROM survey_metrics sm
LEFT JOIN nps_metrics nm ON sm.tenant_id = nm.tenant_id AND sm.period = nm.period;

COMMENT ON VIEW v_engagement_analytics IS 'Aggregated engagement analytics by tenant and month';

-- ============================================================================
-- TRIGGER: Update response count
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_update_survey_response_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_complete = true THEN
    UPDATE engagement_surveys
    SET total_responses = total_responses + 1,
        updated_at = NOW()
    WHERE id = NEW.survey_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_complete = false AND NEW.is_complete = true THEN
    UPDATE engagement_surveys
    SET total_responses = total_responses + 1,
        updated_at = NOW()
    WHERE id = NEW.survey_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_survey_response_count ON engagement_survey_responses;
CREATE TRIGGER trg_update_survey_response_count
  AFTER INSERT OR UPDATE ON engagement_survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_survey_response_count();

-- ============================================================================
-- SEED: System Templates
-- ============================================================================
INSERT INTO engagement_survey_templates (tenant_id, name, description, category, questions, is_system)
SELECT
  t.id,
  'Employee Engagement Survey',
  'Comprehensive engagement survey covering key dimensions of employee experience',
  'engagement',
  '[
    {"id": "q1", "text": "On a scale of 0-10, how likely are you to recommend this company as a great place to work?", "type": "nps", "required": true},
    {"id": "q2", "text": "I feel valued for my contributions to the team", "type": "scale_5", "required": true},
    {"id": "q3", "text": "I have the resources and tools I need to do my job effectively", "type": "scale_5", "required": true},
    {"id": "q4", "text": "My manager provides clear direction and support", "type": "scale_5", "required": true},
    {"id": "q5", "text": "I see a clear path for career growth at this company", "type": "scale_5", "required": true},
    {"id": "q6", "text": "I feel connected to the company mission and values", "type": "scale_5", "required": true},
    {"id": "q7", "text": "My work-life balance is healthy", "type": "scale_5", "required": true},
    {"id": "q8", "text": "What is the one thing we could do to improve your experience?", "type": "text", "required": false}
  ]'::jsonb,
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM engagement_survey_templates est
  WHERE est.tenant_id = t.id AND est.name = 'Employee Engagement Survey'
)
ON CONFLICT DO NOTHING;

INSERT INTO engagement_survey_templates (tenant_id, name, description, category, questions, is_system)
SELECT
  t.id,
  'Weekly Pulse Check',
  'Quick 3-question pulse check for weekly engagement tracking',
  'engagement',
  '[
    {"id": "q1", "text": "How are you feeling about work this week?", "type": "scale_5", "required": true, "labels": ["Very unhappy", "Unhappy", "Neutral", "Happy", "Very happy"]},
    {"id": "q2", "text": "Do you have what you need to be productive?", "type": "scale_5", "required": true, "labels": ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"]},
    {"id": "q3", "text": "Any blockers or concerns to share?", "type": "text", "required": false}
  ]'::jsonb,
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM engagement_survey_templates est
  WHERE est.tenant_id = t.id AND est.name = 'Weekly Pulse Check'
)
ON CONFLICT DO NOTHING;

INSERT INTO engagement_survey_templates (tenant_id, name, description, category, questions, is_system)
SELECT
  t.id,
  'Exit Interview Survey',
  'Standard exit interview to understand departure reasons and gather feedback',
  'exit',
  '[
    {"id": "q1", "text": "What is the primary reason for your departure?", "type": "multiple_choice", "required": true, "options": ["Better opportunity elsewhere", "Compensation/benefits", "Work-life balance", "Relationship with manager", "Limited career growth", "Company culture", "Relocation", "Personal reasons", "Other"]},
    {"id": "q2", "text": "How would you rate your overall experience working here?", "type": "scale_5", "required": true},
    {"id": "q3", "text": "How likely are you to recommend this company to others?", "type": "nps", "required": true},
    {"id": "q4", "text": "What did you enjoy most about working here?", "type": "text", "required": false},
    {"id": "q5", "text": "What could we have done to keep you?", "type": "text", "required": false},
    {"id": "q6", "text": "Any other feedback you would like to share?", "type": "text", "required": false}
  ]'::jsonb,
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM engagement_survey_templates est
  WHERE est.tenant_id = t.id AND est.name = 'Exit Interview Survey'
)
ON CONFLICT DO NOTHING;

INSERT INTO engagement_survey_templates (tenant_id, name, description, category, questions, is_system)
SELECT
  t.id,
  'Onboarding Check-in',
  '30-day onboarding experience survey for new hires',
  'onboarding',
  '[
    {"id": "q1", "text": "My onboarding experience has been positive so far", "type": "scale_5", "required": true},
    {"id": "q2", "text": "I understand my role and responsibilities clearly", "type": "scale_5", "required": true},
    {"id": "q3", "text": "I have received adequate training to do my job", "type": "scale_5", "required": true},
    {"id": "q4", "text": "My manager has been supportive during onboarding", "type": "scale_5", "required": true},
    {"id": "q5", "text": "I feel welcomed by my team", "type": "scale_5", "required": true},
    {"id": "q6", "text": "Based on your experience so far, how likely are you to recommend this company?", "type": "nps", "required": true},
    {"id": "q7", "text": "What could we improve in our onboarding process?", "type": "text", "required": false}
  ]'::jsonb,
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM engagement_survey_templates est
  WHERE est.tenant_id = t.id AND est.name = 'Onboarding Check-in'
)
ON CONFLICT DO NOTHING;

INSERT INTO engagement_survey_templates (tenant_id, name, description, category, questions, is_system)
SELECT
  t.id,
  'Wellbeing Assessment',
  'Employee wellbeing and mental health check-in',
  'wellbeing',
  '[
    {"id": "q1", "text": "I feel my workload is manageable", "type": "scale_5", "required": true},
    {"id": "q2", "text": "I am able to disconnect from work during off-hours", "type": "scale_5", "required": true},
    {"id": "q3", "text": "I feel supported when dealing with stress", "type": "scale_5", "required": true},
    {"id": "q4", "text": "The company cares about employee wellbeing", "type": "scale_5", "required": true},
    {"id": "q5", "text": "I have access to resources that support my wellbeing", "type": "scale_5", "required": true},
    {"id": "q6", "text": "What additional wellbeing support would you find helpful?", "type": "text", "required": false}
  ]'::jsonb,
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM engagement_survey_templates est
  WHERE est.tenant_id = t.id AND est.name = 'Wellbeing Assessment'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- GRANT PERMISSIONS (if using row-level security)
-- ============================================================================
-- Note: Adjust based on your RLS setup

-- End of migration
