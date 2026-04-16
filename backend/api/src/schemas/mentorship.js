/**
 * Zod Schemas for Mentorship Routes
 * Covers: mentorship programs, mentorships, and sessions
 */
import { z } from 'zod';
// =============================================================================
// MENTORSHIP PROGRAMS
// =============================================================================
export const createMentorshipProgramSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    description: z.string().trim().max(5000).optional().nullable(),
    program_type: z.string().trim().max(50).optional(),
    duration_months: z.coerce.number().int().min(1).max(120).optional().nullable(),
    max_participants: z.coerce.number().int().min(1).max(10000).optional().nullable(),
    focus_areas: z.array(z.string().trim().max(200)).optional().nullable(),
    eligibility_criteria: z.record(z.unknown()).optional().nullable(),
    start_date: z.string().trim().max(50).optional().nullable(),
    end_date: z.string().trim().max(50).optional().nullable(),
});
export const updateMentorshipProgramSchema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    program_type: z.string().trim().max(50).optional(),
    status: z.string().trim().max(50).optional(),
    duration_months: z.coerce.number().int().min(1).max(120).optional().nullable(),
    max_participants: z.coerce.number().int().min(1).max(10000).optional().nullable(),
    focus_areas: z.array(z.string().trim().max(200)).optional().nullable(),
    eligibility_criteria: z.record(z.unknown()).optional().nullable(),
    start_date: z.string().trim().max(50).optional().nullable(),
    end_date: z.string().trim().max(50).optional().nullable(),
});
// =============================================================================
// MENTORSHIPS
// =============================================================================
export const createMentorshipSchema = z.object({
    program_id: z.string().uuid('Invalid program ID'),
    mentor_id: z.string().uuid('Invalid mentor ID'),
    mentee_id: z.string().uuid('Invalid mentee ID'),
    focus_areas: z.array(z.string().trim().max(200)).optional().nullable(),
    meeting_frequency: z.string().trim().max(50).optional().nullable(),
    goals: z.array(z.string().trim().max(500)).optional().nullable(),
    start_date: z.string().trim().max(50).optional().nullable(),
    end_date: z.string().trim().max(50).optional().nullable(),
});
export const updateMentorshipSchema = z.object({
    status: z.string().trim().max(50).optional(),
    focus_areas: z.array(z.string().trim().max(200)).optional().nullable(),
    meeting_frequency: z.string().trim().max(50).optional().nullable(),
    goals: z.array(z.string().trim().max(500)).optional().nullable(),
    notes: z.string().trim().max(5000).optional().nullable(),
    end_date: z.string().trim().max(50).optional().nullable(),
});
// =============================================================================
// MENTORSHIP SESSIONS
// =============================================================================
export const createMentorshipSessionSchema = z.object({
    mentorship_id: z.string().uuid('Invalid mentorship ID'),
    session_date: z.string().trim().min(1, 'Session date is required').max(50),
    duration_minutes: z.coerce.number().int().min(1).max(1440).optional(),
    topics: z.array(z.string().trim().max(200)).optional().nullable(),
    notes: z.string().trim().max(5000).optional().nullable(),
});
export const updateMentorshipSessionSchema = z.object({
    session_date: z.string().trim().max(50).optional(),
    duration_minutes: z.coerce.number().int().min(1).max(1440).optional(),
    status: z.string().trim().max(50).optional(),
    topics: z.array(z.string().trim().max(200)).optional().nullable(),
    notes: z.string().trim().max(5000).optional().nullable(),
    rating: z.coerce.number().min(1).max(5).optional().nullable(),
});
//# sourceMappingURL=mentorship.js.map