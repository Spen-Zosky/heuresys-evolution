-- AI Career Coach Schema
-- Migration: 052_career_coach.sql
-- Date: 2025-12-27

-- Career Profiles
CREATE TABLE IF NOT EXISTS career_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  current_job_family_id UUID,
  career_aspiration TEXT,
  preferred_work_style VARCHAR(50),
  mobility_preference VARCHAR(50) DEFAULT 'same_location',
  last_assessment_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_career_profile UNIQUE (employee_id),
  CONSTRAINT valid_mobility CHECK (mobility_preference IN ('same_location', 'same_region', 'any_location', 'remote_only'))
);

-- Career Skills (employee skill proficiency)
CREATE TABLE IF NOT EXISTS career_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES career_profiles(id) ON DELETE CASCADE,
  skill_id UUID,
  skill_name VARCHAR(255) NOT NULL,
  proficiency INTEGER NOT NULL DEFAULT 1,
  source VARCHAR(50) NOT NULL DEFAULT 'self',
  validated_by UUID REFERENCES users(id),
  validated_at TIMESTAMPTZ,
  evidence_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_proficiency CHECK (proficiency BETWEEN 1 AND 5),
  CONSTRAINT valid_source CHECK (source IN ('self', 'manager', 'assessment', 'certification', 'project'))
);

-- Career Goals
CREATE TABLE IF NOT EXISTS career_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES career_profiles(id) ON DELETE CASCADE,
  target_role VARCHAR(255) NOT NULL,
  target_job_family_id UUID,
  target_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  progress INTEGER NOT NULL DEFAULT 0,
  motivation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  CONSTRAINT valid_progress CHECK (progress BETWEEN 0 AND 100)
);

-- Career Goal Milestones
CREATE TABLE IF NOT EXISTS career_goal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES career_goals(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'action',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  reference_type VARCHAR(50),
  reference_id UUID,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_type CHECK (type IN ('course', 'skill', 'experience', 'certification', 'project', 'action'))
);

-- Career Recommendations (AI-generated)
CREATE TABLE IF NOT EXISTS career_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES career_profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id UUID,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  relevance_score DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  reason TEXT,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  CONSTRAINT valid_type CHECK (type IN ('course', 'mentor', 'opportunity', 'role', 'skill', 'project')),
  CONSTRAINT valid_score CHECK (relevance_score BETWEEN 0 AND 1)
);

-- Career Path Templates (organization-defined paths)
CREATE TABLE IF NOT EXISTS career_path_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  from_role VARCHAR(255) NOT NULL,
  to_role VARCHAR(255) NOT NULL,
  from_job_family_id UUID,
  to_job_family_id UUID,
  estimated_months INTEGER,
  required_skills JSONB DEFAULT '[]',
  recommended_courses JSONB DEFAULT '[]',
  success_rate DECIMAL(3,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Career Conversations (chat history with AI)
CREATE TABLE IF NOT EXISTS career_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES career_profiles(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  summary TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_career_profiles_tenant ON career_profiles(tenant_id);
CREATE INDEX idx_career_profiles_employee ON career_profiles(employee_id);
CREATE INDEX idx_career_skills_profile ON career_skills(profile_id);
CREATE INDEX idx_career_skills_skill ON career_skills(skill_id);
CREATE INDEX idx_career_goals_profile ON career_goals(profile_id);
CREATE INDEX idx_career_goals_status ON career_goals(profile_id, status);
CREATE INDEX idx_career_milestones_goal ON career_goal_milestones(goal_id);
CREATE INDEX idx_career_recommendations_profile ON career_recommendations(profile_id);
CREATE INDEX idx_career_recommendations_type ON career_recommendations(profile_id, type);
CREATE INDEX idx_career_paths_tenant ON career_path_templates(tenant_id);
CREATE INDEX idx_career_conversations_profile ON career_conversations(profile_id);

-- Function to auto-update progress
CREATE OR REPLACE FUNCTION update_goal_progress()
RETURNS TRIGGER AS $$
DECLARE
  total_milestones INTEGER;
  completed_milestones INTEGER;
  new_progress INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE completed_at IS NOT NULL)
  INTO total_milestones, completed_milestones
  FROM career_goal_milestones
  WHERE goal_id = COALESCE(NEW.goal_id, OLD.goal_id);

  IF total_milestones > 0 THEN
    new_progress := ROUND((completed_milestones::NUMERIC / total_milestones::NUMERIC) * 100);
  ELSE
    new_progress := 0;
  END IF;

  UPDATE career_goals
  SET
    progress = new_progress,
    updated_at = NOW(),
    status = CASE WHEN new_progress = 100 THEN 'completed' ELSE status END,
    completed_at = CASE WHEN new_progress = 100 THEN NOW() ELSE completed_at END
  WHERE id = COALESCE(NEW.goal_id, OLD.goal_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_goal_progress ON career_goal_milestones;
CREATE TRIGGER trg_update_goal_progress
AFTER INSERT OR UPDATE OR DELETE ON career_goal_milestones
FOR EACH ROW EXECUTE FUNCTION update_goal_progress();

-- Seed some career path templates
INSERT INTO career_path_templates (tenant_id, name, description, from_role, to_role, estimated_months, required_skills, is_active)
SELECT
  t.id,
  'Junior to Mid Developer',
  'Standard progression path for software developers',
  'Junior Software Developer',
  'Software Developer',
  18,
  '["Problem Solving", "Code Review", "Testing", "Documentation"]'::jsonb,
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM career_path_templates cpt
  WHERE cpt.tenant_id = t.id AND cpt.name = 'Junior to Mid Developer'
);

INSERT INTO career_path_templates (tenant_id, name, description, from_role, to_role, estimated_months, required_skills, is_active)
SELECT
  t.id,
  'Developer to Tech Lead',
  'Technical leadership track',
  'Software Developer',
  'Technical Lead',
  24,
  '["Leadership", "Architecture Design", "Mentoring", "Project Management"]'::jsonb,
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM career_path_templates cpt
  WHERE cpt.tenant_id = t.id AND cpt.name = 'Developer to Tech Lead'
);

INSERT INTO career_path_templates (tenant_id, name, description, from_role, to_role, estimated_months, required_skills, is_active)
SELECT
  t.id,
  'Analyst to Senior Analyst',
  'Analytical career progression',
  'Business Analyst',
  'Senior Business Analyst',
  18,
  '["Data Analysis", "Stakeholder Management", "Requirements Gathering", "Process Improvement"]'::jsonb,
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM career_path_templates cpt
  WHERE cpt.tenant_id = t.id AND cpt.name = 'Analyst to Senior Analyst'
);

INSERT INTO career_path_templates (tenant_id, name, description, from_role, to_role, estimated_months, required_skills, is_active)
SELECT
  t.id,
  'HR Specialist to HR Manager',
  'Human Resources management track',
  'HR Specialist',
  'HR Manager',
  36,
  '["Team Management", "Labor Law", "Strategic Planning", "Conflict Resolution"]'::jsonb,
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM career_path_templates cpt
  WHERE cpt.tenant_id = t.id AND cpt.name = 'HR Specialist to HR Manager'
);
