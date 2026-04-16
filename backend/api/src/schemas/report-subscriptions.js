/**
 * Zod Schemas for Report Subscriptions Routes
 * Covers: subscription CRUD and management
 */
import { z } from 'zod';
// =============================================================================
// SCHEDULE & DELIVERY SUB-SCHEMAS
// =============================================================================
const scheduleSchema = z.object({
    frequency: z.string().trim().min(1, 'Frequency is required').max(50),
    time: z.string().trim().min(1, 'Time is required').max(20),
    day_of_week: z.coerce.number().int().min(0).max(6).optional(),
    day_of_month: z.coerce.number().int().min(1).max(31).optional(),
    timezone: z.string().trim().max(100).optional(),
});
const deliverySchema = z.object({
    methods: z.array(z.string().trim().max(50)).min(1, 'At least one delivery method is required'),
    recipients: z.array(z.string().trim().max(255)).optional(),
    format: z.string().trim().max(50).optional(),
    include_charts: z.boolean().optional(),
});
// =============================================================================
// SUBSCRIPTIONS
// =============================================================================
export const createReportSubscriptionSchema = z.object({
    report_id: z.string().uuid('Invalid report ID'),
    name: z.string().trim().min(1, 'Name is required').max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    schedule: scheduleSchema,
    delivery: deliverySchema,
    parameters: z.record(z.unknown()).optional().nullable(),
    filters: z.record(z.unknown()).optional().nullable(),
    created_by: z.string().trim().max(200).optional(),
});
export const updateReportSubscriptionSchema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    schedule: scheduleSchema.optional(),
    delivery: deliverySchema.optional(),
    parameters: z.record(z.unknown()).optional().nullable(),
    filters: z.record(z.unknown()).optional().nullable(),
    is_active: z.boolean().optional(),
});
//# sourceMappingURL=report-subscriptions.js.map