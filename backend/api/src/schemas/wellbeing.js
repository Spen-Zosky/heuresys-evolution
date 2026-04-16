/**
 * Zod Schemas for Wellbeing Routes
 * Covers: wellbeing check-in CRUD
 */
import { z } from 'zod';
// =============================================================================
// WELLBEING CHECK-INS
// =============================================================================
export const createWellbeingCheckinBasicSchema = z.object({
    employee_id: z.string().uuid('Invalid employee ID'),
    mood_score: z.coerce.number().min(1).max(10).optional().nullable(),
    energy_level: z.coerce.number().min(1).max(10).optional().nullable(),
    stress_level: z.coerce.number().min(1).max(10).optional().nullable(),
    work_life_balance: z.coerce.number().min(1).max(10).optional().nullable(),
    sleep_quality: z.coerce.number().min(1).max(10).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    is_anonymous: z.boolean().optional(),
});
export const updateWellbeingCheckinSchema = z
    .object({
    mood_score: z.coerce.number().min(1).max(10).optional(),
    energy_level: z.coerce.number().min(1).max(10).optional(),
    stress_level: z.coerce.number().min(1).max(10).optional(),
    work_life_balance: z.coerce.number().min(1).max(10).optional(),
    sleep_quality: z.coerce.number().min(1).max(10).optional(),
    notes: z.string().trim().max(2000).optional().nullable(),
})
    .partial();
//# sourceMappingURL=wellbeing.js.map