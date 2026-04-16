/**
 * Zod Schemas for OKR Routes
 * Covers: OKRs, key results, check-ins, and progress updates
 */
import { z } from 'zod';
// =============================================================================
// OKRS
// =============================================================================
export const createOkrSchema = z.object({
    objective: z.string().trim().min(1, 'Objective is required').max(1000),
    okr_type: z.enum(['individual', 'team', 'department', 'company']).optional(),
    department: z.string().trim().max(200).optional().nullable(),
    period_type: z.enum(['quarterly', 'annual', 'monthly', 'custom']).optional(),
    period_start: z.string().trim().max(50).optional().nullable(),
    period_end: z.string().trim().max(50).optional().nullable(),
    status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
    overall_progress: z.coerce.number().min(0).max(100).optional(),
    confidence_level: z.coerce.number().min(0).max(100).optional().nullable(),
    owner_id: z.string().uuid('Invalid owner ID').optional().nullable(),
    created_by: z.string().uuid('Invalid created_by ID').optional().nullable(),
});
export const updateOkrSchema = z.object({
    objective: z.string().trim().min(1).max(1000).optional(),
    okr_type: z.enum(['individual', 'team', 'department', 'company']).optional(),
    department: z.string().trim().max(200).optional().nullable(),
    period_type: z.enum(['quarterly', 'annual', 'monthly', 'custom']).optional(),
    period_start: z.string().trim().max(50).optional().nullable(),
    period_end: z.string().trim().max(50).optional().nullable(),
    status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
    overall_progress: z.coerce.number().min(0).max(100).optional(),
    confidence_level: z.coerce.number().min(0).max(100).optional().nullable(),
    owner_id: z.string().uuid('Invalid owner ID').optional().nullable(),
});
export const updateOkrProgressSchema = z.object({
    overall_progress: z.coerce.number().min(0).max(100).optional(),
    confidence_level: z.coerce.number().min(0).max(100).optional(),
});
// =============================================================================
// KEY RESULTS
// =============================================================================
export const createKeyResultSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(500),
    description: z.string().trim().max(5000).optional().nullable(),
    metric_type: z.string().trim().max(50).optional(),
    unit: z.string().trim().max(50).optional().nullable(),
    start_value: z.coerce.number().optional(),
    target_value: z.coerce.number({ required_error: 'Target value is required' }),
    current_value: z.coerce.number().optional(),
    weight: z.coerce.number().min(0).max(100).optional(),
    owner_id: z.string().uuid('Invalid owner ID').optional().nullable(),
    due_date: z.string().trim().max(50).optional().nullable(),
});
export const updateKeyResultSchema = z.object({
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    metric_type: z.string().trim().max(50).optional(),
    unit: z.string().trim().max(50).optional().nullable(),
    start_value: z.coerce.number().optional(),
    target_value: z.coerce.number().optional(),
    current_value: z.coerce.number().optional(),
    weight: z.coerce.number().min(0).max(100).optional(),
    owner_id: z.string().uuid('Invalid owner ID').optional().nullable(),
    due_date: z.string().trim().max(50).optional().nullable(),
    status: z.string().trim().max(50).optional(),
});
export const updateKeyResultProgressSchema = z.object({
    current_value: z.coerce.number({ required_error: 'current_value is required' }),
    confidence_level: z.coerce.number().min(0).max(100).optional().nullable(),
    notes: z.string().trim().max(5000).optional().nullable(),
});
// =============================================================================
// OKR CHECK-INS
// =============================================================================
export const createOkrCheckinSchema = z.object({
    progress_snapshot: z.coerce.number().min(0).max(100).optional().nullable(),
    confidence_level: z.coerce.number().min(0).max(100).optional().nullable(),
    blockers: z.string().trim().max(5000).optional().nullable(),
    achievements: z.string().trim().max(5000).optional().nullable(),
    next_steps: z.string().trim().max(5000).optional().nullable(),
    notes: z.string().trim().max(5000).optional().nullable(),
    key_result_updates: z.array(z.record(z.unknown())).optional().nullable(),
    created_by: z.string().uuid('Invalid created_by ID').optional().nullable(),
});
//# sourceMappingURL=okrs.js.map