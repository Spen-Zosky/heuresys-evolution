import { z } from 'zod';

// =============================================================================
// ADVANCED SEARCH SCHEMAS
// =============================================================================

/**
 * POST /advanced-search/search
 */
export const advancedSearchSchema = z.object({
  query: z.string().trim().min(2, 'Query must be at least 2 characters').max(2000),
  tenantId: z.string().uuid('Invalid tenant ID'),
  entityTypes: z.array(z.string().trim().max(100)).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  minScore: z.number().min(0).max(1).optional(),
  language: z.enum(['en', 'it']).optional(),
  useExpansion: z.boolean().optional(),
  useReranking: z.boolean().optional(),
});

/**
 * POST /advanced-search/expand
 */
export const expandQuerySchema = z.object({
  query: z.string().trim().min(1, 'Query is required').max(2000),
  language: z.enum(['en', 'it']).optional(),
});

/**
 * POST /advanced-search/feedback/:searchId
 */
export const searchFeedbackSchema = z.object({
  score: z.number().int().min(1, 'Score must be between 1 and 5').max(5, 'Score must be between 1 and 5'),
});

// =============================================================================
// EMBEDDINGS SCHEMAS
// =============================================================================

/**
 * POST /embeddings/queue
 */
export const queueEmbeddingSchema = z.object({
  entity_type: z.string().trim().min(1, 'entity_type is required').max(200),
  entity_id: z.string().uuid('Invalid entity ID'),
  text_content: z.string().trim().min(1, 'text_content is required').max(50000),
});

/**
 * POST /embeddings/process
 */
export const processEmbeddingsSchema = z.object({
  batch_size: z.number().int().min(1).max(200).optional(),
});

/**
 * POST /embeddings/search
 */
export const embeddingSearchSchema = z.object({
  query: z.string().trim().min(1, 'Query is required').max(5000),
  entity_type: z.string().trim().max(200).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

/**
 * POST /embeddings/reindex
 */
export const reindexEmbeddingSchema = z.object({
  entity_type: z.string().trim().min(1, 'entity_type is required').max(200),
  entity_id: z.string().uuid('Invalid entity ID'),
});

// =============================================================================
// INFERENCE REVIEW SCHEMAS
// =============================================================================

/**
 * POST /inference/:id/approve
 */
export const approveInferenceSchema = z.object({
  reviewerId: z.string().uuid('Invalid reviewer ID').optional(),
  notes: z.string().trim().max(5000).optional(),
});

/**
 * POST /inference/:id/reject
 */
export const rejectInferenceSchema = z.object({
  reviewerId: z.string().uuid('Invalid reviewer ID').optional(),
  reason: z.string().trim().max(5000).optional(),
});

/**
 * POST /inference/bulk
 */
export const bulkInferenceSchema = z.object({
  action: z.enum(['approve', 'reject'], {
    required_error: 'action must be "approve" or "reject"',
  }),
  relationIds: z.array(z.string().uuid('Invalid relation ID')).min(1, 'relationIds must not be empty').max(100, 'Maximum 100 relations per bulk operation'),
  reviewerId: z.string().uuid('Invalid reviewer ID').optional(),
  notes: z.string().trim().max(5000).optional(),
});

/**
 * POST /inference/bulk-by-filter
 */
export const bulkByFilterInferenceSchema = z.object({
  action: z.enum(['approve', 'reject'], {
    required_error: 'action must be "approve" or "reject"',
  }),
  filter: z.object({
    relationType: z.string().trim().max(200).optional(),
    minConfidence: z.number().min(0).max(1).optional(),
    maxAge: z.number().int().min(1).optional(),
  }).optional(),
  reviewerId: z.string().uuid('Invalid reviewer ID').optional(),
  notes: z.string().trim().max(5000).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

// =============================================================================
// CERTIFICATIONS SCHEMAS
// =============================================================================

/**
 * POST /certifications
 */
export const createCertificationSchema = z.object({
  code: z.string().trim().max(100).optional(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  name_en: z.string().trim().max(200).optional(),
  issuing_organization: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  validity_months: z.number().int().min(1).max(1200).optional(),
  renewal_requirements: z.string().trim().max(5000).optional(),
  verification_url: z.string().trim().url('Invalid URL').max(2000).optional(),
  is_internal: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
});

/**
 * PATCH /certifications/:id
 */
export const updateCertificationSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  name_en: z.string().trim().max(200).optional(),
  issuing_organization: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  validity_months: z.number().int().min(1).max(1200).optional(),
  renewal_requirements: z.string().trim().max(5000).optional(),
  verification_url: z.string().trim().url('Invalid URL').max(2000).optional(),
  is_internal: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

// =============================================================================
// ENROLLMENTS SCHEMAS
// =============================================================================

/**
 * POST /enrollments
 */
export const createEnrollmentSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  course_id: z.string().uuid('Invalid course ID'),
  due_date: z.string().trim().max(50).optional(),
  enrolled_by: z.string().uuid('Invalid enrolled_by ID').optional(),
  enrollment_source: z.enum(['manual', 'auto', 'manager', 'self']).optional().default('manual'),
});

/**
 * PATCH /enrollments/:id
 */
export const updateEnrollmentSchema = z.object({
  status: z.enum(['enrolled', 'in_progress', 'completed', 'cancelled', 'expired']).optional(),
  progress_percent: z.number().min(0).max(100).optional(),
  score: z.number().min(0).max(100).optional(),
  passed: z.boolean().optional(),
  due_date: z.string().trim().max(50).optional(),
  time_spent_minutes: z.number().int().min(0).optional(),
  notes: z.string().trim().max(5000).optional(),
});

/**
 * POST /enrollments/:id/complete
 */
export const completeEnrollmentSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  passed: z.boolean().optional().default(true),
});
