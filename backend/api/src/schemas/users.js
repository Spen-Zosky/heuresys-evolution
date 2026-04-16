/**
 * Zod Schemas for Users Routes
 * Covers: user CRUD, password reset, bulk creation
 */
import { z } from 'zod';
// =============================================================================
// USERS
// =============================================================================
export const createUserSchema = z.object({
    username: z.string().trim().min(1, 'Username is required').max(100),
    password: z.string().max(200).optional(),
    role: z.string().trim().max(50).optional(),
    permissions: z.array(z.string().trim().max(100)).optional(),
    employee_id: z.string().uuid('Invalid employee ID').optional().nullable(),
    is_active: z.boolean().optional(),
    generate_password: z.boolean().optional(),
    send_welcome_email: z.boolean().optional(),
});
export const updateUserSchema = z
    .object({
    username: z.string().trim().max(100).optional(),
    role: z.string().trim().max(50).optional(),
    permissions: z.array(z.string().trim().max(100)).optional(),
    employee_id: z.string().uuid('Invalid employee ID').optional().nullable(),
    is_active: z.boolean().optional(),
    password: z.string().max(200).optional(),
})
    .partial();
export const resetPasswordSchema = z.object({
    new_password: z.string().min(1, 'New password is required').max(200),
});
export const bulkCreateUsersSchema = z.object({
    employee_ids: z
        .array(z.string().uuid('Invalid employee ID'))
        .min(1, 'At least one employee ID is required')
        .max(100, 'Maximum 100 users per bulk operation'),
    role: z.string().trim().max(50).optional(),
    send_welcome_emails: z.boolean().optional(),
});
//# sourceMappingURL=users.js.map