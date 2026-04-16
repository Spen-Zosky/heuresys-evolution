/**
 * Zod Schemas for Talent & Career Routes
 * Covers: career-coach, career-paths, gap-analysis, internal-mobility
 */

import { z } from 'zod';

// =============================================================================
// CAREER COACH
// =============================================================================

export const updateCareerProfileSchema = z.object({
  career_aspiration: z.string().trim().max(500).optional().nullable(),
  mobility_preference: z.string().trim().max(100).optional().nullable(),
});

export const createCareerSkillSchema = z.object({
  skill_name: z.string().trim().min(1, 'Skill name is required').max(200),
  proficiency: z.coerce.number().min(1).max(5),
  evidence_notes: z.string().trim().max(2000).optional().nullable(),
});

export const createCareerGoalSchema = z.object({
  target_role: z.string().trim().min(1, 'Target role is required').max(200),
  target_date: z.string().optional().nullable(),
  motivation: z.string().trim().max(2000).optional().nullable(),
  milestones: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        type: z.string().trim().max(50).optional(),
        due_date: z.string().optional().nullable(),
      })
    )
    .optional(),
});

export const updateCareerGoalSchema = z
  .object({
    target_role: z.string().trim().max(200).optional(),
    target_date: z.string().optional().nullable(),
    motivation: z.string().trim().max(2000).optional().nullable(),
    status: z.enum(['active', 'completed', 'paused', 'abandoned']).optional(),
  })
  .partial();

export const createGoalMilestoneSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  type: z.string().trim().max(50).optional(),
  due_date: z.string().optional().nullable(),
});

// =============================================================================
// CAREER PATHS
// =============================================================================

export const createCareerPathSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  department: z.string().trim().max(200).optional().nullable(),
  path_type: z.enum(['linear', 'branching', 'matrix']).optional(),
  is_active: z.boolean().optional(),
  created_by_employee_id: z.string().uuid('Invalid employee ID').optional().nullable(),
});

export const updateCareerPathSchema = z
  .object({
    name: z.string().trim().max(200).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    department: z.string().trim().max(200).optional().nullable(),
    path_type: z.enum(['linear', 'branching', 'matrix']).optional(),
    is_active: z.boolean().optional(),
  })
  .partial();

export const addLevelSkillSchema = z.object({
  skill_id: z.string().uuid('Invalid skill ID'),
  importance: z.enum(['essential', 'important', 'nice_to_have']).optional(),
  is_mandatory: z.boolean().optional(),
  weight: z.coerce.number().min(0).max(10).optional(),
  required_knowledge_level: z.coerce.number().min(0).max(5).optional().nullable(),
  required_skill_level: z.coerce.number().min(0).max(5).optional().nullable(),
  required_ability_level: z.coerce.number().min(0).max(5).optional().nullable(),
  required_behavior_level: z.coerce.number().min(0).max(5).optional().nullable(),
  required_attitude_level: z.coerce.number().min(0).max(5).optional().nullable(),
  min_composite_score: z.coerce.number().min(0).max(5).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const simulateCareerPathSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  target_path_id: z.string().uuid('Invalid path ID').optional().nullable(),
  target_level_id: z.string().uuid('Invalid level ID').optional().nullable(),
  target_job_id: z.string().uuid('Invalid job ID').optional().nullable(),
  simulation_name: z.string().trim().max(200).optional().nullable(),
});

export const enrollCareerPathSchema = z.object({
  starting_level_id: z.string().uuid('Invalid level ID').optional().nullable(),
});

export const updateCareerProgressSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
});

// =============================================================================
// GAP ANALYSIS
// =============================================================================

export const gapAnalysisSchema = z.object({
  analysisType: z.enum(['employee_role', 'team_role', 'team_project']),
  employeeId: z.string().uuid('Invalid employee ID').optional(),
  employeeIds: z.array(z.string().uuid('Invalid employee ID')).optional(),
  roleId: z.string().uuid('Invalid role ID').optional(),
  tenantId: z.string().uuid('Invalid tenant ID').optional(),
  aggregation: z.enum(['average', 'best', 'coverage']).optional(),
});

export const employeeRoleGapSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  roleId: z.string().uuid('Invalid role ID'),
  tenantId: z.string().uuid('Invalid tenant ID').optional(),
});

export const teamRoleGapSchema = z.object({
  employeeIds: z
    .array(z.string().uuid('Invalid employee ID'))
    .min(1, 'At least one employee is required'),
  roleId: z.string().uuid('Invalid role ID'),
  aggregation: z.enum(['average', 'best', 'coverage']).optional(),
  tenantId: z.string().uuid('Invalid tenant ID').optional(),
});

export const compareGapSchema = z.object({
  employeeIds: z
    .array(z.string().uuid('Invalid employee ID'))
    .min(2, 'At least 2 employees are required'),
  roleId: z.string().uuid('Invalid role ID'),
  tenantId: z.string().uuid('Invalid tenant ID').optional(),
});

export const gapRecommendationsSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  roleId: z.string().uuid('Invalid role ID'),
  tenantId: z.string().uuid('Invalid tenant ID').optional(),
  options: z
    .object({
      maxPerSkill: z.coerce.number().int().min(1).max(20).optional(),
      includeTypes: z
        .array(z.enum(['training', 'mentoring', 'self_study', 'certification']))
        .optional(),
      minSeverity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    })
    .optional(),
});

export const cachedRecommendationsSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  roleId: z.string().uuid('Invalid role ID'),
  tenantId: z.string().uuid('Invalid tenant ID').optional(),
  options: z
    .object({
      maxPerSkill: z.coerce.number().int().min(1).max(20).optional(),
      includeTypes: z
        .array(z.enum(['training', 'mentoring', 'self_study', 'certification']))
        .optional(),
      minSeverity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    })
    .optional(),
});

export const createDevelopmentActionSchema = z.object({
  recommendationId: z.string().trim().max(200).optional().nullable(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  type: z.string().trim().min(1, 'Type is required').max(100),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  skillCoverage: z.array(z.string().trim().max(200)).optional(),
  deadline: z.string().optional().nullable(),
  status: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(5000).optional().nullable(),
  estimatedImpact: z.coerce.number().min(0).max(100).optional().nullable(),
  duration: z.string().trim().max(100).optional().nullable(),
});

// =============================================================================
// INTERNAL MOBILITY
// =============================================================================

export const createJobPostingSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  department: z.string().trim().min(1, 'OrgUnit is required').max(200),
  team: z.string().trim().max(200).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  work_type: z.string().trim().max(50).optional().nullable(),
  summary: z.string().trim().max(5000).optional().nullable(),
  responsibilities: z.string().trim().max(5000).optional().nullable(),
  requirements: z.string().trim().max(5000).optional().nullable(),
  nice_to_have: z.string().trim().max(5000).optional().nullable(),
  job_level: z.string().trim().max(50).optional().nullable(),
  job_family: z.string().trim().max(100).optional().nullable(),
  salary_min: z.coerce.number().min(0).optional().nullable(),
  salary_max: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().trim().max(3).optional(),
  show_salary: z.boolean().optional(),
  visibility: z.enum(['all_employees', 'department', 'custom']).optional(),
  min_tenure_months: z.coerce.number().int().min(0).optional().nullable(),
  min_rating: z.coerce.number().min(0).max(5).optional().nullable(),
  required_skills: z.array(z.string().trim().max(200)).optional(),
  expires_at: z.string().optional().nullable(),
  target_start_date: z.string().optional().nullable(),
  hiring_manager_id: z.string().uuid('Invalid hiring manager ID').optional().nullable(),
  hr_contact_id: z.string().uuid('Invalid HR contact ID').optional().nullable(),
  created_by_employee_id: z.string().uuid('Invalid employee ID').optional().nullable(),
});

export const updateJobPostingSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    department: z.string().trim().max(200).optional(),
    team: z.string().trim().max(200).optional().nullable(),
    location: z.string().trim().max(200).optional().nullable(),
    work_type: z.string().trim().max(50).optional().nullable(),
    summary: z.string().trim().max(5000).optional().nullable(),
    responsibilities: z.string().trim().max(5000).optional().nullable(),
    requirements: z.string().trim().max(5000).optional().nullable(),
    nice_to_have: z.string().trim().max(5000).optional().nullable(),
    job_level: z.string().trim().max(50).optional().nullable(),
    salary_min: z.coerce.number().min(0).optional().nullable(),
    salary_max: z.coerce.number().min(0).optional().nullable(),
    show_salary: z.boolean().optional(),
    status: z.enum(['draft', 'open', 'closed', 'on_hold', 'cancelled']).optional(),
    visibility: z.enum(['all_employees', 'department', 'custom']).optional(),
    min_tenure_months: z.coerce.number().int().min(0).optional().nullable(),
    min_rating: z.coerce.number().min(0).max(5).optional().nullable(),
    required_skills: z.array(z.string().trim().max(200)).optional(),
    expires_at: z.string().optional().nullable(),
  })
  .partial();

export const createApplicationSchema = z.object({
  job_posting_id: z.string().uuid('Invalid job posting ID'),
  employee_id: z.string().uuid('Invalid employee ID'),
  cover_letter: z.string().trim().max(5000).optional().nullable(),
  motivation: z.string().trim().max(5000).optional().nullable(),
  relevant_experience: z.string().trim().max(5000).optional().nullable(),
  current_manager_id: z.string().uuid('Invalid manager ID').optional().nullable(),
});

export const updateApplicationStatusSchema = z
  .object({
    status: z
      .enum(['submitted', 'reviewing', 'interview', 'accepted', 'rejected', 'withdrawn'])
      .optional(),
    manager_approval_status: z.enum(['pending', 'approved', 'rejected']).optional(),
    manager_notes: z.string().trim().max(5000).optional().nullable(),
    hr_notes: z.string().trim().max(5000).optional().nullable(),
    hr_score: z.coerce.number().min(0).max(100).optional().nullable(),
    interview_date: z.string().optional().nullable(),
    interview_feedback: z.string().trim().max(5000).optional().nullable(),
    outcome_notes: z.string().trim().max(5000).optional().nullable(),
    rejected_reason: z.string().trim().max(2000).optional().nullable(),
  })
  .partial();
