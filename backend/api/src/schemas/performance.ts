import { z } from 'zod';

// ============================================================================
// PERFORMANCE REVIEWS
// ============================================================================

export const createReviewSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  reviewer_id: z.string().uuid('Invalid reviewer ID'),
  review_period_start: z.string().trim().optional().nullable(),
  review_period_end: z.string().trim().optional().nullable(),
  review_type: z
    .enum(['annual', 'mid_year', 'quarterly', 'probation', 'project', 'ad_hoc'])
    .optional(),
  overall_rating: z.number().min(0).max(5).optional().nullable(),
  goal_achievement_rating: z.number().min(0).max(5).optional().nullable(),
  competency_rating: z.number().min(0).max(5).optional().nullable(),
  potential_rating: z.number().min(0).max(5).optional().nullable(),
  strengths: z.string().trim().max(5000).optional().nullable(),
  areas_for_improvement: z.string().trim().max(5000).optional().nullable(),
  manager_comments: z.string().trim().max(5000).optional().nullable(),
  employee_comments: z.string().trim().max(5000).optional().nullable(),
  status: z
    .enum(['draft', 'pending', 'in_progress', 'submitted', 'completed', 'acknowledged'])
    .optional()
    .default('draft'),
});

export const updateReviewSchema = z.object({
  review_period_start: z.string().trim().optional().nullable(),
  review_period_end: z.string().trim().optional().nullable(),
  review_type: z
    .enum(['annual', 'mid_year', 'quarterly', 'probation', 'project', 'ad_hoc'])
    .optional(),
  overall_rating: z.number().min(0).max(5).optional().nullable(),
  goal_achievement_rating: z.number().min(0).max(5).optional().nullable(),
  competency_rating: z.number().min(0).max(5).optional().nullable(),
  potential_rating: z.number().min(0).max(5).optional().nullable(),
  strengths: z.string().trim().max(5000).optional().nullable(),
  areas_for_improvement: z.string().trim().max(5000).optional().nullable(),
  manager_comments: z.string().trim().max(5000).optional().nullable(),
  employee_comments: z.string().trim().max(5000).optional().nullable(),
  status: z
    .enum(['draft', 'pending', 'in_progress', 'submitted', 'completed', 'acknowledged'])
    .optional(),
});

export const updateFeedback360Schema = z.object({
  overall_rating: z.number().min(0).max(5).optional().nullable(),
  competency_ratings: z.record(z.unknown()).optional().nullable(),
  strengths: z.string().trim().max(5000).optional().nullable(),
  areas_for_improvement: z.string().trim().max(5000).optional().nullable(),
  additional_comments: z.string().trim().max(5000).optional().nullable(),
  submit: z.boolean().optional(),
});

export const updateGoalRatingSchema = z.object({
  self_rating: z.number().min(0).max(5).optional().nullable(),
  self_comment: z.string().trim().max(3000).optional().nullable(),
  achievement_description: z.string().trim().max(5000).optional().nullable(),
});

export const saveSelfAssessmentSchema = z.object({
  self_rating: z.number().min(0).max(5).optional().nullable(),
  self_comments: z.string().trim().max(5000).optional().nullable(),
  goal_ratings: z
    .array(
      z.object({
        goal_id: z.string().uuid('Invalid goal ID'),
        self_rating: z.number().min(0).max(5).optional().nullable(),
        self_comment: z.string().trim().max(3000).optional().nullable(),
      })
    )
    .optional(),
  competency_ratings: z
    .array(
      z.object({
        competency_name: z.string().trim().max(300),
        self_rating: z.number().min(0).max(5).optional().nullable(),
        self_comment: z.string().trim().max(3000).optional().nullable(),
      })
    )
    .optional(),
  strengths: z.string().trim().max(5000).optional().nullable(),
  areas_for_improvement: z.string().trim().max(5000).optional().nullable(),
});

export const addEvidenceSchema = z.object({
  evidence_type: z.enum(['achievement', 'certification', 'feedback', 'metric', 'project', 'other']),
  title: z.string().trim().min(1, 'Title is required').max(500),
  description: z.string().trim().max(5000).optional().nullable(),
  file_url: z.string().trim().url('Invalid file URL').max(2048).optional().nullable(),
  external_link: z.string().trim().url('Invalid external link').max(2048).optional().nullable(),
  related_goal_id: z.string().uuid('Invalid goal ID').optional().nullable(),
  related_competency: z.string().trim().max(300).optional().nullable(),
  date_achieved: z.string().trim().optional().nullable(),
});

export const updateCompetenciesSchema = z.object({
  competencies: z
    .array(
      z.object({
        ksaba_dimension: z
          .enum(['knowledge', 'skills', 'abilities', 'behaviors', 'attitudes'])
          .optional(),
        competency_name: z.string().trim().min(1).max(300),
        self_rating: z.number().min(0).max(5).optional().nullable(),
        self_comment: z.string().trim().max(3000).optional().nullable(),
        weight: z.number().min(0).max(100).optional().nullable(),
      })
    )
    .min(1, 'At least one competency is required'),
});

export const saveManagerReviewSchema = z.object({
  overall_rating: z.number().min(0).max(5).optional().nullable(),
  goal_achievement_rating: z.number().min(0).max(5).optional().nullable(),
  competency_rating: z.number().min(0).max(5).optional().nullable(),
  potential_rating: z.number().min(0).max(5).optional().nullable(),
  manager_comments: z.string().trim().max(5000).optional().nullable(),
  strengths: z.string().trim().max(5000).optional().nullable(),
  areas_for_improvement: z.string().trim().max(5000).optional().nullable(),
  goal_ratings: z
    .array(
      z.object({
        goal_id: z.string().uuid('Invalid goal ID'),
        manager_rating: z.number().min(0).max(5).optional().nullable(),
        manager_comment: z.string().trim().max(3000).optional().nullable(),
      })
    )
    .optional(),
  competency_ratings: z
    .array(
      z.object({
        competency_name: z.string().trim().max(300),
        manager_rating: z.number().min(0).max(5).optional().nullable(),
        manager_comment: z.string().trim().max(3000).optional().nullable(),
      })
    )
    .optional(),
});

export const submitManagerReviewSchema = z.object({
  flag_for_calibration: z.boolean().optional(),
  calibration_notes: z.string().trim().max(5000).optional().nullable(),
});

export const completeReviewSchema = z.object({
  final_comments: z.string().trim().max(5000).optional().nullable(),
});

export const acknowledgeReviewSchema = z.object({
  employee_acknowledgment_comments: z.string().trim().max(5000).optional().nullable(),
});

export const createSelfReviewSchema = z.object({
  self_rating: z.number().min(0).max(5).optional().nullable(),
  achievements: z.string().trim().max(5000).optional().nullable(),
  challenges: z.string().trim().max(5000).optional().nullable(),
  development_goals: z.string().trim().max(5000).optional().nullable(),
  feedback_for_manager: z.string().trim().max(5000).optional().nullable(),
  competency_ratings: z.record(z.unknown()).optional().nullable(),
  additional_comments: z.string().trim().max(5000).optional().nullable(),
});

export const updateSelfReviewSchema = z.object({
  self_rating: z.number().min(0).max(5).optional().nullable(),
  achievements: z.string().trim().max(5000).optional().nullable(),
  challenges: z.string().trim().max(5000).optional().nullable(),
  development_goals: z.string().trim().max(5000).optional().nullable(),
  feedback_for_manager: z.string().trim().max(5000).optional().nullable(),
  competency_ratings: z.record(z.unknown()).optional().nullable(),
  additional_comments: z.string().trim().max(5000).optional().nullable(),
});

export const request360FeedbackSchema = z.object({
  raters: z
    .array(
      z.object({
        rater_id: z.string().uuid('Invalid rater ID'),
        relationship: z
          .enum(['peer', 'subordinate', 'manager', 'cross_functional', 'external'])
          .optional(),
      })
    )
    .min(1, 'At least one rater is required'),
  review_cycle_id: z.string().uuid('Invalid review cycle ID').optional().nullable(),
});

export const decline360FeedbackSchema = z.object({
  reason: z.string().trim().max(2000).optional().nullable(),
});

// ============================================================================
// REVIEW CYCLES
// ============================================================================

export const createReviewCycleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(300),
  description: z.string().trim().max(5000).optional().nullable(),
  cycle_type: z.enum(['annual', 'mid_year', 'quarterly', 'probation', 'ad_hoc']).optional(),
  start_date: z.string().trim().min(1, 'Start date is required'),
  end_date: z.string().trim().min(1, 'End date is required'),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional().default('draft'),
});

export const updateReviewCycleSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  cycle_type: z.enum(['annual', 'mid_year', 'quarterly', 'probation', 'ad_hoc']).optional(),
  start_date: z.string().trim().optional(),
  end_date: z.string().trim().optional(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
});

export const addCycleParticipantsSchema = z.object({
  employee_ids: z.array(z.string().uuid('Invalid employee ID')).optional(),
  org_unit_id: z.string().uuid('Invalid department ID').optional(),
  include_all: z.boolean().optional(),
});

export const updateCycleParticipantSchema = z.object({
  status: z.enum(['draft', 'pending', 'in_progress', 'completed']).optional(),
  notes: z.string().trim().max(5000).optional().nullable(),
  self_review_completed: z.boolean().optional(),
  manager_review_completed: z.boolean().optional(),
  calibration_completed: z.boolean().optional(),
});

export const addCyclePhasesSchema = z.object({
  phases: z
    .array(
      z.object({
        phase_name: z.string().trim().min(1).max(200),
        phase_order: z.number().int().min(0).max(100),
        start_date: z.string().trim().optional().nullable(),
        end_date: z.string().trim().optional().nullable(),
        instructions: z.string().trim().max(5000).optional().nullable(),
        reminder_days_before: z.number().int().min(0).max(90).optional(),
        escalation_days_after: z.number().int().min(0).max(90).optional(),
        is_required: z.boolean().optional(),
      })
    )
    .min(1, 'At least one phase is required'),
});

export const updateCyclePhaseSchema = z.object({
  status: z.enum(['pending', 'active', 'completed', 'skipped']).optional(),
  start_date: z.string().trim().optional().nullable(),
  end_date: z.string().trim().optional().nullable(),
  instructions: z.string().trim().max(5000).optional().nullable(),
  is_required: z.boolean().optional(),
});

export const closeCycleSchema = z.object({
  force: z.boolean().optional().default(false),
});

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(300),
  description: z.string().trim().max(5000).optional().nullable(),
  template_type: z
    .enum(['standard', 'simplified', 'executive', 'probation'])
    .optional()
    .default('standard'),
  rating_scale_type: z.string().trim().max(50).optional().default('1-5'),
  rating_scale_config: z.record(z.unknown()).optional(),
  sections: z.array(z.unknown()).min(1, 'At least one section is required'),
  competencies: z.array(z.unknown()).optional().nullable(),
  include_goals: z.boolean().optional(),
  include_development_plan: z.boolean().optional(),
  is_default: z.boolean().optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  template_type: z.enum(['standard', 'simplified', 'executive', 'probation']).optional(),
  rating_scale_type: z.string().trim().max(50).optional(),
  rating_scale_config: z.record(z.unknown()).optional(),
  sections: z.array(z.unknown()).optional(),
  competencies: z.array(z.unknown()).optional().nullable(),
  include_goals: z.boolean().optional(),
  include_development_plan: z.boolean().optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export const autoAssignParticipantsSchema = z.object({
  org_unit_ids: z.array(z.string().uuid('Invalid department ID')).optional().nullable(),
  employee_status: z.string().trim().max(50).optional().default('active'),
});

// ============================================================================
// CHECK-INS
// ============================================================================

export const createCheckInSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  manager_id: z.string().uuid('Invalid manager ID'),
  scheduled_date: z.string().trim().min(1, 'Scheduled date is required'),
  duration_minutes: z.number().int().min(5).max(480).optional().default(30),
  meeting_type: z
    .enum(['one_on_one', 'team', 'skip_level', 'ad_hoc'])
    .optional()
    .default('one_on_one'),
  agenda: z.string().trim().max(5000).optional().nullable(),
  employee_notes: z.string().trim().max(5000).optional().nullable(),
  manager_notes: z.string().trim().max(5000).optional().nullable(),
  action_items: z.array(z.unknown()).optional().nullable(),
  employee_mood: z.number().int().min(1).max(5).optional().nullable(),
  status: z
    .enum(['scheduled', 'completed', 'cancelled', 'rescheduled'])
    .optional()
    .default('scheduled'),
});

export const updateCheckInSchema = z.object({
  scheduled_date: z.string().trim().optional(),
  duration_minutes: z.number().int().min(5).max(480).optional(),
  meeting_type: z.enum(['one_on_one', 'team', 'skip_level', 'ad_hoc']).optional(),
  agenda: z.string().trim().max(5000).optional().nullable(),
  employee_notes: z.string().trim().max(5000).optional().nullable(),
  manager_notes: z.string().trim().max(5000).optional().nullable(),
  action_items: z.array(z.unknown()).optional().nullable(),
  employee_mood: z.number().int().min(1).max(5).optional().nullable(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled']).optional(),
});

export const completeCheckInSchema = z.object({
  employee_mood: z.number().int().min(1).max(5).optional().nullable(),
  action_items: z.array(z.unknown()).optional().nullable(),
  manager_notes: z.string().trim().max(5000).optional().nullable(),
  employee_notes: z.string().trim().max(5000).optional().nullable(),
});

// ============================================================================
// CALIBRATION SESSIONS
// ============================================================================

export const createCalibrationSessionSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(300),
  description: z.string().trim().max(5000).optional().nullable(),
  review_cycle_id: z.string().uuid('Invalid review cycle ID').optional().nullable(),
  org_unit_id: z.string().uuid('Invalid department ID').optional().nullable(),
  scheduled_date: z.string().trim().optional().nullable(),
  scheduled_end_date: z.string().trim().optional().nullable(),
  location: z.string().trim().max(500).optional().nullable(),
  meeting_link: z.string().trim().url('Invalid meeting link').max(2048).optional().nullable(),
  facilitator_id: z.string().uuid('Invalid facilitator ID').optional().nullable(),
  facilitator_ids: z.array(z.string().uuid('Invalid facilitator ID')).optional().nullable(),
  status: z
    .enum(['scheduled', 'in_progress', 'completed', 'cancelled'])
    .optional()
    .default('scheduled'),
});

export const updateCalibrationSessionSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  scheduled_date: z.string().trim().optional().nullable(),
  scheduled_end_date: z.string().trim().optional().nullable(),
  location: z.string().trim().max(500).optional().nullable(),
  meeting_link: z.string().trim().url('Invalid meeting link').max(2048).optional().nullable(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

export const addCalibrationParticipantsSchema = z.object({
  participants: z
    .array(
      z.object({
        manager_id: z.string().uuid('Invalid manager ID'),
        role: z
          .enum(['facilitator', 'calibrator', 'subject', 'observer', 'participant'])
          .optional(),
      })
    )
    .min(1, 'At least one participant is required'),
});

export const flagOutlierSchema = z.object({
  adjustment_id: z.string().uuid('Invalid adjustment ID'),
  outlier_reason: z.string().trim().max(2000).optional().nullable(),
  action_by: z.string().uuid('Invalid action_by ID').optional().nullable(),
});

export const createAdjustmentSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  performance_review_id: z.string().uuid('Invalid performance review ID').optional().nullable(),
  original_rating: z.number().min(0).max(5).optional().nullable(),
  adjusted_rating: z.number().min(0).max(5).optional().nullable(),
  adjustment_reason: z.string().trim().max(5000).optional().nullable(),
  competency_adjustments: z.record(z.unknown()).optional().nullable(),
  adjusted_by: z.string().uuid('Invalid adjusted_by ID').optional().nullable(),
});

export const updateAdjustmentSchema = z.object({
  adjusted_rating: z.number().min(0).max(5).optional().nullable(),
  adjustment_reason: z.string().trim().max(5000).optional().nullable(),
  competency_adjustments: z.record(z.unknown()).optional().nullable(),
  final_comments: z.string().trim().max(5000).optional().nullable(),
});

export const updateAdjustmentNotesSchema = z.object({
  discussion_notes: z.string().trim().max(10000),
  action_by: z.string().uuid('Invalid action_by ID').optional().nullable(),
});

export const completeCalibrationSessionSchema = z.object({
  notes: z.string().trim().max(5000).optional().nullable(),
  decisions: z.array(z.unknown()).optional().nullable(),
});

export const cancelCalibrationSessionSchema = z.object({
  reason: z.string().trim().max(2000).optional().nullable(),
});
