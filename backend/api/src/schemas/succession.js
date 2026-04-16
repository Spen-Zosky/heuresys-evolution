/**
 * Zod Schemas for Succession Planning Routes
 * Covers: critical roles and succession candidates
 */
import { z } from 'zod';
// =============================================================================
// CRITICAL ROLES
// =============================================================================
export const createCriticalRoleSchema = z.object({
    role_name: z.string().trim().min(1, 'Role name is required').max(200),
    department: z.string().trim().max(200).optional().nullable(),
    current_incumbent_id: z.string().uuid('Invalid incumbent ID').optional().nullable(),
    criticality_level: z.string().trim().max(50).optional(),
    impact_if_vacant: z.string().trim().max(2000).optional().nullable(),
    time_to_fill_estimate: z.string().trim().max(100).optional().nullable(),
    succession_status: z.string().trim().max(50).optional(),
});
export const updateCriticalRoleSchema = z.object({
    role_name: z.string().trim().min(1).max(200).optional(),
    department: z.string().trim().max(200).optional().nullable(),
    current_incumbent_id: z.string().uuid('Invalid incumbent ID').optional().nullable(),
    criticality_level: z.string().trim().max(50).optional(),
    impact_if_vacant: z.string().trim().max(2000).optional().nullable(),
    time_to_fill_estimate: z.string().trim().max(100).optional().nullable(),
    succession_status: z.string().trim().max(50).optional(),
});
// =============================================================================
// SUCCESSION CANDIDATES
// =============================================================================
export const createSuccessionCandidateSchema = z.object({
    critical_role_id: z.string().uuid('Invalid critical role ID'),
    candidate_employee_id: z.string().uuid('Invalid candidate employee ID'),
    readiness_level: z.string().trim().max(50).optional(),
    strengths: z.string().trim().max(5000).optional().nullable(),
    development_needs: z.string().trim().max(5000).optional().nullable(),
    development_plan: z.string().trim().max(5000).optional().nullable(),
    rank_order: z.coerce.number().int().min(1).max(100).optional(),
});
export const updateSuccessionCandidateSchema = z.object({
    readiness_level: z.string().trim().max(50).optional(),
    strengths: z.string().trim().max(5000).optional().nullable(),
    development_needs: z.string().trim().max(5000).optional().nullable(),
    development_plan: z.string().trim().max(5000).optional().nullable(),
    rank_order: z.coerce.number().int().min(1).max(100).optional(),
});
//# sourceMappingURL=succession.js.map