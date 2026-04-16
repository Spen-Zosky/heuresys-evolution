/**
 * Zod Schemas for Surveys Routes
 * Covers: survey CRUD, survey responses
 */
import { z } from 'zod';
// =============================================================================
// SURVEYS
// =============================================================================
export const createSurveySchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(500),
    description: z.string().trim().max(5000).optional().nullable(),
    survey_type: z.string().trim().max(50).optional(),
    start_date: z.string().trim().max(50).optional().nullable(),
    end_date: z.string().trim().max(50).optional().nullable(),
    is_anonymous: z.boolean().optional(),
    questions: z.unknown().optional().nullable(),
});
export const updateSurveySchema = z
    .object({
    title: z.string().trim().max(500).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    survey_type: z.string().trim().max(50).optional(),
    start_date: z.string().trim().max(50).optional().nullable(),
    end_date: z.string().trim().max(50).optional().nullable(),
    is_anonymous: z.boolean().optional(),
    is_active: z.boolean().optional(),
    status: z.enum(['draft', 'active', 'closed']).optional(),
    questions: z.unknown().optional().nullable(),
    total_invitations: z.coerce.number().int().min(0).optional(),
})
    .partial();
const surveyResponseItemSchema = z.object({
    question_id: z.string().trim().min(1, 'Question ID is required').max(200),
    rating_value: z.coerce.number().optional().nullable(),
    text_value: z.string().trim().max(5000).optional().nullable(),
    choice_value: z.string().trim().max(1000).optional().nullable(),
});
export const submitSurveyResponseSchema = z.object({
    employee_id: z.string().uuid('Invalid employee ID').optional().nullable(),
    responses: z.array(surveyResponseItemSchema).min(1, 'At least one response is required'),
});
//# sourceMappingURL=surveys.js.map