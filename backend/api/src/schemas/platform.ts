/**
 * Zod Schemas for Platform Routes
 * Covers: analytics, audit-logs, dashboards, engagement (surveys/pulse/feedback), knowledge-base, leave
 */

import { z } from 'zod';

// =============================================================================
// ANALYTICS
// =============================================================================

export const trackEventSchema = z.object({
  event_type: z.string().trim().min(1, 'Event type is required').max(100),
  category: z.string().trim().min(1, 'Category is required').max(100),
  entity_type: z.string().trim().max(100).optional().nullable(),
  entity_id: z.string().trim().max(200).optional().nullable(),
  user_id: z.string().uuid('Invalid user ID').optional().nullable(),
  session_id: z.string().trim().max(200).optional().nullable(),
  data: z.record(z.unknown()).optional().nullable(),
  metrics: z.record(z.unknown()).optional().nullable(),
});

export const trackEventBatchSchema = z.object({
  events: z
    .array(
      z.object({
        event_type: z.string().trim().min(1).max(100),
        category: z.string().trim().min(1).max(100),
        entity_type: z.string().trim().max(100).optional().nullable(),
        entity_id: z.string().trim().max(200).optional().nullable(),
        user_id: z.string().uuid('Invalid user ID').optional().nullable(),
        session_id: z.string().trim().max(200).optional().nullable(),
        data: z.record(z.unknown()).optional().nullable(),
        metrics: z.record(z.unknown()).optional().nullable(),
      })
    )
    .min(1, 'At least one event is required'),
});

export const computeAggregationsSchema = z.object({
  period: z.enum(['hourly', 'daily', 'weekly', 'monthly']),
  date: z.string().optional().nullable(),
});

export const analyticsExportSchema = z.object({
  dashboard: z.enum([
    'hr',
    'performance',
    'recruitment',
    'learning',
    'workforce-planning',
    'compensation',
    'time',
  ]),
  format: z.enum(['csv', 'json', 'excel', 'pdf']).optional(),
});

// =============================================================================
// AUDIT LOGS
// =============================================================================

export const createAuditLogSchema = z.object({
  user_id: z.string().uuid('Invalid user ID').optional().nullable(),
  user_email: z.string().trim().email('Invalid email').max(255).optional().nullable(),
  user_role: z.string().trim().max(50).optional().nullable(),
  action: z.string().trim().min(1, 'Action is required').max(100),
  category: z.string().trim().min(1, 'Category is required').max(100),
  resource_type: z.string().trim().max(100).optional().nullable(),
  resource_id: z.string().trim().max(200).optional().nullable(),
  resource_name: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  old_value: z.unknown().optional().nullable(),
  new_value: z.unknown().optional().nullable(),
  ip_address: z.string().trim().max(50).optional().nullable(),
  user_agent: z.string().trim().max(500).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  success: z.boolean().optional(),
  error_message: z.string().trim().max(2000).optional().nullable(),
});

export const updateAuditConfigSchema = z.object({
  retentionYears: z.coerce.number().int().min(1).max(10).optional(),
  exportSchedule: z.enum(['manual', 'weekly', 'monthly']).optional(),
  eventsToLog: z.string().trim().max(100).optional(),
});

export const exportAuditLogsSchema = z.object({
  format: z.enum(['json', 'csv']).optional(),
  fromDate: z.string().optional().nullable(),
  toDate: z.string().optional().nullable(),
  action: z.string().trim().max(100).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
});

// =============================================================================
// DASHBOARDS
// =============================================================================

export const createWidgetTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().min(1, 'Category is required').max(100),
  default_config: z.record(z.unknown()),
  created_by: z.string().trim().max(200).optional(),
});

export const createDashboardSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  layout_type: z.string().trim().max(50).optional().nullable(),
  is_default: z.boolean().optional(),
  is_shared: z.boolean().optional(),
  shared_with: z.array(z.string().uuid('Invalid user ID')).optional(),
  created_by: z.string().uuid('Invalid user ID'),
});

export const updateDashboardSchema = z
  .object({
    user_id: z.string().uuid('Invalid user ID'),
    name: z.string().trim().max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    layout_type: z.string().trim().max(50).optional().nullable(),
    is_default: z.boolean().optional(),
    is_shared: z.boolean().optional(),
    shared_with: z.array(z.string().uuid('Invalid user ID')).optional(),
  })
  .passthrough();

export const duplicateDashboardSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  user_id: z.string().uuid('Invalid user ID'),
});

export const addWidgetSchema = z.object({
  template_id: z.string().uuid('Invalid template ID').optional().nullable(),
  config: z.record(z.unknown()),
  position: z.record(z.unknown()),
  created_by: z.string().uuid('Invalid user ID'),
});

export const updateWidgetSchema = z
  .object({
    config: z.record(z.unknown()).optional(),
    position: z.record(z.unknown()).optional(),
  })
  .partial();

export const updateWidgetPositionsSchema = z.object({
  positions: z.array(
    z.object({
      widget_id: z.string().uuid('Invalid widget ID'),
      position: z.record(z.unknown()),
    })
  ),
});

// =============================================================================
// ENGAGEMENT (Surveys, Pulse, Feedback)
// =============================================================================

export const createEngagementTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(100).optional(),
  questions: z
    .array(
      z.object({
        id: z.string().trim().max(50).optional(),
        text: z.string().trim().min(1).max(1000),
        type: z.string().trim().max(50).optional(),
        options: z.array(z.unknown()).optional(),
        required: z.boolean().optional(),
      })
    )
    .min(1, 'At least one question is required'),
});

export const updateEngagementTemplateSchema = z
  .object({
    name: z.string().trim().max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    category: z.string().trim().max(100).optional(),
    questions: z
      .array(
        z.object({
          id: z.string().trim().max(50).optional(),
          text: z.string().trim().min(1).max(1000),
          type: z.string().trim().max(50).optional(),
          options: z.array(z.unknown()).optional(),
          required: z.boolean().optional(),
        })
      )
      .optional(),
    is_active: z.boolean().optional(),
  })
  .partial();

export const createSurveySchema = z.object({
  template_id: z.string().uuid('Invalid template ID').optional().nullable(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  questions: z.array(z.record(z.unknown())).optional(),
  is_anonymous: z.boolean().optional(),
  audience_type: z.enum(['all', 'department', 'org_unit', 'custom']).optional(),
  audience_ids: z.array(z.string()).optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  reminder_days: z.array(z.coerce.number().int().min(1).max(365)).optional(),
});

export const updateSurveySchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    questions: z.array(z.record(z.unknown())).optional(),
    is_anonymous: z.boolean().optional(),
    audience_type: z.enum(['all', 'department', 'org_unit', 'custom']).optional(),
    audience_ids: z.array(z.string()).optional(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
  })
  .partial();

export const submitSurveyResponseSchema = z.object({
  answers: z
    .array(
      z.object({
        question_id: z.string().trim().max(50),
        value: z.unknown(),
      })
    )
    .min(1, 'At least one answer is required'),
});

export const submitFeedbackSchema = z.object({
  category: z.string().trim().max(100).optional(),
  message: z.string().trim().min(1, 'Message is required').max(5000),
});

export const reviewFeedbackSchema = z
  .object({
    status: z.enum(['new', 'reviewed', 'in_progress', 'resolved', 'dismissed']).optional(),
    action_notes: z.string().trim().max(5000).optional().nullable(),
  })
  .partial();

export const createPulseConfigSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  questions: z
    .array(
      z.object({
        id: z.string().trim().max(50).optional(),
        text: z.string().trim().min(1).max(1000),
        type: z.string().trim().max(50).optional(),
      })
    )
    .min(1, 'At least one question is required')
    .max(5, 'Maximum 5 questions allowed for pulse checks'),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
  audience_type: z.enum(['all', 'department', 'org_unit', 'custom']).optional(),
  audience_ids: z.array(z.string()).optional(),
});

// =============================================================================
// KNOWLEDGE BASE
// =============================================================================

export const createKnowledgeBaseSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(50),
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  kbType: z.string().trim().max(50).optional(),
  isPublic: z.boolean().optional(),
  allowedRoles: z.array(z.string().trim().max(50)).optional().nullable(),
});

export const ingestCCNLSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(50),
  name: z.string().trim().min(1, 'Name is required').max(200),
  sector: z.string().trim().min(1, 'Sector is required').max(200),
  fullText: z.string().trim().min(1, 'Full text is required'),
  effectiveDate: z.string().optional().nullable(),
  version: z.string().trim().max(50).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const ingestPolicySchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: z.string().trim().min(1, 'Content is required'),
  policyType: z.string().trim().min(1, 'Policy type is required').max(100),
  effectiveDate: z.string().optional().nullable(),
  version: z.string().trim().max(50).optional().nullable(),
  orgUnitId: z.string().uuid('Invalid department ID').optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const processPendingSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// =============================================================================
// LEAVE
// =============================================================================

export const initializeLeaveBalancesSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  ccnlType: z.string().trim().max(100).optional(),
});

export const createLeaveRequestSchema = z.object({
  leaveType: z.string().trim().min(1, 'Leave type is required').max(50),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  daysRequested: z.coerce.number().min(0.5).max(365).optional(),
  halfDayStart: z.boolean().optional(),
  halfDayEnd: z.boolean().optional(),
  reason: z.string().trim().max(2000).optional().nullable(),
});

export const approveLeaveSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const rejectLeaveSchema = z.object({
  reason: z.string().trim().min(1, 'Rejection reason is required').max(2000),
});

export const cancelLeaveSchema = z.object({
  reason: z.string().trim().max(2000).optional().nullable(),
});
