/**
 * Zod Schemas for Engagement Routes
 * Covers: feedback, news, notifications, whistleblowing
 */

import { z } from 'zod';

// =============================================================================
// CONTINUOUS FEEDBACK
// =============================================================================

export const createContinuousFeedbackSchema = z.object({
  from_employee_id: z.string().uuid('Invalid from employee ID'),
  to_employee_id: z.string().uuid('Invalid to employee ID'),
  feedback_type: z.enum(['praise', 'suggestion', 'concern']).optional(),
  message: z.string().trim().min(1, 'Message is required').max(5000),
  is_private: z.boolean().optional(),
  related_goal_id: z.string().uuid('Invalid goal ID').optional().nullable(),
});

export const createQuickFeedbackSchema = z.object({
  from_employee_id: z.string().uuid('Invalid from employee ID'),
  to_employee_id: z.string().uuid('Invalid to employee ID'),
  feedback_type: z.enum(['praise', 'suggestion', 'concern']).optional(),
  message: z.string().trim().min(1, 'Message is required').max(5000),
  visibility: z.enum(['private', 'public', 'team']).optional(),
  category: z.string().trim().max(100).optional().nullable(),
  competency_id: z.string().uuid('Invalid competency ID').optional().nullable(),
  related_goal_id: z.string().uuid('Invalid goal ID').optional().nullable(),
  tags: z.array(z.string().trim().max(50)).optional().nullable(),
});

// =============================================================================
// 360 FEEDBACK
// =============================================================================

export const createFeedback360Schema = z.object({
  target_employee_id: z.string().uuid('Invalid target employee ID'),
  reviewer_employee_id: z.string().uuid('Invalid reviewer employee ID'),
  review_cycle_id: z.string().uuid('Invalid review cycle ID').optional().nullable(),
  relationship_type: z.string().trim().max(50).optional().nullable(),
  overall_rating: z.coerce.number().min(1).max(5).optional().nullable(),
  strengths: z.string().trim().max(5000).optional().nullable(),
  areas_for_improvement: z.string().trim().max(5000).optional().nullable(),
  is_anonymous: z.boolean().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
});

export const updateFeedback360Schema = z
  .object({
    relationship_type: z.string().trim().max(50).optional(),
    overall_rating: z.coerce.number().min(1).max(5).optional(),
    strengths: z.string().trim().max(5000).optional(),
    areas_for_improvement: z.string().trim().max(5000).optional(),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  })
  .partial();

export const completeFeedback360Schema = z.object({
  overall_rating: z.coerce.number().min(1).max(5).optional().nullable(),
  strengths: z.string().trim().max(5000).optional().nullable(),
  areas_for_improvement: z.string().trim().max(5000).optional().nullable(),
  question_responses: z.record(z.unknown()).optional(),
});

export const createQuestionnaireSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  is_default: z.boolean().optional(),
  relationship_types: z.array(z.string().trim().max(50)).optional(),
  created_by: z.string().uuid('Invalid created_by ID').optional().nullable(),
  questions: z
    .array(
      z.object({
        question_text: z.string().trim().min(1).max(1000),
        question_type: z.string().trim().max(50).optional(),
        category: z.string().trim().max(100).optional().nullable(),
        relationship_types: z.array(z.string().trim().max(50)).optional().nullable(),
        is_required: z.boolean().optional(),
      })
    )
    .optional(),
});

export const requestFeedback360Schema = z.object({
  reviewer_ids: z
    .array(z.string().uuid('Invalid reviewer ID'))
    .min(1, 'At least one reviewer is required'),
  relationship_type: z.string().trim().max(50).optional(),
  questionnaire_id: z.string().uuid('Invalid questionnaire ID').optional().nullable(),
  due_date: z.string().optional().nullable(),
  is_anonymous: z.boolean().optional(),
});

// =============================================================================
// NEWS
// =============================================================================

export const createArticleSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  content: z.string().trim().min(1, 'Content is required').max(50000),
  excerpt: z.string().trim().max(1000).optional().nullable(),
  cover_image_url: z.string().trim().max(1000).optional().nullable(),
  category_id: z.string().uuid('Invalid category ID').optional().nullable(),
  tags: z.array(z.string().trim().max(100)).optional(),
  is_featured: z.boolean().optional(),
  is_pinned: z.boolean().optional(),
  allow_comments: z.boolean().optional(),
  requires_acknowledgment: z.boolean().optional(),
  audience_type: z.enum(['all', 'department', 'role', 'custom']).optional(),
  audience_ids: z.array(z.string()).optional(),
  publish_at: z.string().optional().nullable(),
  status: z.enum(['draft', 'published', 'scheduled', 'archived']).optional(),
});

export const updateArticleSchema = z
  .object({
    title: z.string().trim().max(500).optional(),
    content: z.string().trim().max(50000).optional(),
    excerpt: z.string().trim().max(1000).optional().nullable(),
    cover_image_url: z.string().trim().max(1000).optional().nullable(),
    category_id: z.string().uuid('Invalid category ID').optional().nullable(),
    is_featured: z.boolean().optional(),
    is_pinned: z.boolean().optional(),
    allow_comments: z.boolean().optional(),
    requires_acknowledgment: z.boolean().optional(),
    audience_type: z.enum(['all', 'department', 'role', 'custom']).optional(),
    audience_ids: z.array(z.string()).optional(),
    publish_at: z.string().optional().nullable(),
    status: z.enum(['draft', 'published', 'scheduled', 'archived']).optional(),
  })
  .partial();

export const createReactionSchema = z.object({
  type: z.string().trim().max(50).optional().nullable(),
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Content is required').max(5000),
  parent_id: z.string().uuid('Invalid parent ID').optional().nullable(),
});

// =============================================================================
// NOTIFICATIONS
// =============================================================================

export const createNotificationSchema = z.object({
  type: z.string().trim().min(1, 'Type is required').max(100),
  title: z.string().trim().min(1, 'Title is required').max(500),
  message: z.string().trim().min(1, 'Message is required').max(5000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  user_id: z.string().uuid('Invalid user ID').optional().nullable(),
  action_url: z.string().trim().max(1000).optional().nullable(),
  action_label: z.string().trim().max(200).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  expires_at: z.string().optional().nullable(),
});

export const markAllReadSchema = z.object({
  user_id: z.string().uuid('Invalid user ID').optional().nullable(),
});

export const updateNotificationPreferencesSchema = z.object({
  email_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
  goal_reminders: z.boolean().optional(),
  review_reminders: z.boolean().optional(),
  flight_risk_alerts: z.boolean().optional(),
  checkin_reminders: z.boolean().optional(),
  survey_notifications: z.boolean().optional(),
  recognition_notifications: z.boolean().optional(),
  system_notifications: z.boolean().optional(),
  quiet_hours_start: z.string().trim().max(10).optional().nullable(),
  quiet_hours_end: z.string().trim().max(10).optional().nullable(),
  mentorship_notifications: z.boolean().optional(),
  mobility_notifications: z.boolean().optional(),
  wellbeing_notifications: z.boolean().optional(),
});

// =============================================================================
// WHISTLEBLOWING
// =============================================================================

export const createWhistleblowingReportSchema = z.object({
  category: z.string().trim().min(1, 'Category is required').max(100),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  title: z.string().trim().min(1, 'Title is required').max(500),
  description: z.string().trim().min(1, 'Description is required').max(10000),
  incident_date: z.string().optional().nullable(),
  incident_location: z.string().trim().max(500).optional().nullable(),
  involved_persons: z.array(z.unknown()).optional(),
  witnesses: z.array(z.unknown()).optional(),
  reporter_type: z.enum(['anonymous', 'confidential', 'identified']).optional(),
  reporter_name: z.string().trim().max(200).optional().nullable(),
  reporter_email: z.string().trim().email('Invalid email').max(255).optional().nullable(),
  reporter_phone: z.string().trim().max(30).optional().nullable(),
  reporter_employee_id: z.string().uuid('Invalid employee ID').optional().nullable(),
  consent_data_processing: z.boolean().optional(),
});

export const updateWhistleblowingStatusSchema = z
  .object({
    status: z.string().trim().max(50).optional(),
    resolution_type: z.string().trim().max(100).optional(),
    resolution_summary: z.string().trim().max(5000).optional(),
    assigned_to: z.string().uuid('Invalid assigned_to ID').optional(),
    priority: z.string().trim().max(50).optional(),
  })
  .partial();
