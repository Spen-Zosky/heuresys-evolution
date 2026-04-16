import { z } from 'zod';

// =============================================================================
// AI CHAT SCHEMAS
// =============================================================================

export const createSessionSchema = z.object({
  title: z.string().trim().max(500).optional(),
  provider: z.enum(['openai', 'gemini', 'anthropic']).default('openai'),
  model: z.string().trim().max(100).optional(),
  systemPrompt: z.string().trim().max(10000).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message content is required').max(50000),
  includeRag: z.boolean().default(true),
  knowledgeBaseIds: z.array(z.string().uuid('Invalid knowledge base ID')).optional(),
});

export const messageFeedbackSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5'),
  comment: z.string().trim().max(5000).optional(),
});

export const respondEscalationSchema = z.object({
  response: z.string().trim().min(1, 'Response is required').max(50000),
  resolutionNotes: z.string().trim().max(10000).optional(),
  shouldTrain: z.boolean().default(false),
});

export const assignEscalationSchema = z.object({
  assignToEmployeeId: z.string().uuid('Invalid employee ID'),
});

// =============================================================================
// AI PROVIDERS SCHEMAS
// =============================================================================

export const updateProviderConfigSchema = z.object({
  model: z.string().trim().max(100).optional(),
  is_enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  rate_limit_per_minute: z.number().int().min(0).max(100000).optional(),
  cost_per_1k_tokens: z.number().min(0).max(1000).optional(),
  max_batch_size: z.number().int().min(1).max(10000).optional(),
});

export const testProviderSchema = z.object({
  text: z.string().trim().min(1, 'Text is required').max(10000),
});

export const testFallbackSchema = z.object({
  text: z.string().trim().min(1, 'Text is required').max(10000),
  preferredProvider: z.enum(['openai', 'gemini', 'anthropic']).optional(),
});

// =============================================================================
// RAG DOCUMENTS SCHEMAS
// =============================================================================

export const createRagDocumentSchema = z.object({
  filename: z.string().trim().min(1, 'Filename is required').max(500),
  original_name: z.string().trim().min(1, 'Original name is required').max(500),
  mime_type: z.string().trim().min(1, 'MIME type is required').max(200),
  file_size: z.number().int().min(1, 'File size must be positive'),
  file_path: z.string().trim().max(2000).optional(),
  source_type: z.string().trim().max(100).default('document'),
  metadata: z.record(z.unknown()).default({}),
  uploaded_by_employee_id: z.string().uuid('Invalid employee ID').optional(),
});

export const updateRagDocumentSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'error']).optional(),
  chunk_count: z.number().int().min(0).optional(),
  error_message: z.string().trim().max(5000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
  processed_at: z.string().optional().nullable(),
  is_latest: z.boolean().optional(),
});
