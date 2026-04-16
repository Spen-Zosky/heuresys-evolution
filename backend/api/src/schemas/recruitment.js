import { z } from 'zod';
// ============================================================================
// CANDIDATES
// ============================================================================
export const createCandidateSchema = z.object({
    requisition_id: z.string().uuid('Invalid requisition ID').optional().nullable(),
    first_name: z.string().trim().min(1, 'First name is required').max(200),
    last_name: z.string().trim().min(1, 'Last name is required').max(200),
    email: z.string().trim().email('Invalid email address').max(320),
    phone: z.string().trim().max(50).optional().nullable(),
    current_company: z.string().trim().max(300).optional().nullable(),
    job_title: z.string().trim().max(300).optional().nullable(),
    experience_years: z.number().int().min(0).max(60).optional().nullable(),
    source: z
        .enum(['direct', 'referral', 'linkedin', 'job_board', 'agency', 'career_page', 'other'])
        .optional()
        .default('direct'),
    resume_url: z.string().trim().url('Invalid resume URL').max(2048).optional().nullable(),
    linkedin_url: z.string().trim().url('Invalid LinkedIn URL').max(2048).optional().nullable(),
    portfolio_url: z.string().trim().url('Invalid portfolio URL').max(2048).optional().nullable(),
    notes: z.string().trim().max(5000).optional().nullable(),
    skills: z.array(z.string().trim().max(200)).optional().nullable(),
});
export const updateCandidateSchema = z.object({
    first_name: z.string().trim().min(1).max(200).optional(),
    last_name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().email('Invalid email address').max(320).optional(),
    phone: z.string().trim().max(50).optional().nullable(),
    current_company: z.string().trim().max(300).optional().nullable(),
    job_title: z.string().trim().max(300).optional().nullable(),
    experience_years: z.number().int().min(0).max(60).optional().nullable(),
    stage: z.enum(['new', 'screening', 'interview', 'offer', 'hired', 'rejected']).optional(),
    rating: z.number().min(0).max(5).optional().nullable(),
    source: z
        .enum(['direct', 'referral', 'linkedin', 'job_board', 'agency', 'career_page', 'other'])
        .optional(),
    resume_url: z.string().trim().url('Invalid resume URL').max(2048).optional().nullable(),
    linkedin_url: z.string().trim().url('Invalid LinkedIn URL').max(2048).optional().nullable(),
    portfolio_url: z.string().trim().url('Invalid portfolio URL').max(2048).optional().nullable(),
    notes: z.string().trim().max(5000).optional().nullable(),
    skills: z.array(z.string().trim().max(200)).optional().nullable(),
});
export const advanceCandidateSchema = z.object({
    next_stage: z.enum(['new', 'screening', 'interview', 'offer', 'hired']).optional(),
    notes: z.string().trim().max(5000).optional().nullable(),
});
export const rejectCandidateSchema = z.object({
    reason: z.string().trim().max(2000).optional().nullable(),
});
// ============================================================================
// INTERVIEWS
// ============================================================================
export const createInterviewSchema = z.object({
    candidate_id: z.string().uuid('Invalid candidate ID'),
    job_posting_id: z.string().uuid('Invalid job posting ID').optional().nullable(),
    interview_type: z
        .enum(['phone', 'video', 'onsite', 'panel', 'technical', 'behavioral', 'culture_fit'])
        .optional(),
    title: z.string().trim().max(500).optional().nullable(),
    description: z.string().trim().max(5000).optional().nullable(),
    scheduled_at: z.string().trim().min(1, 'Scheduled date is required'),
    duration_minutes: z.number().int().min(5).max(480).optional().default(60),
    timezone: z.string().trim().max(100).optional().default('Europe/Rome'),
    location_type: z.enum(['video', 'onsite', 'phone']).optional().default('video'),
    location: z.string().trim().max(500).optional().nullable(),
    meeting_link: z.string().trim().url('Invalid meeting link').max(2048).optional().nullable(),
    dial_in: z.string().trim().max(200).optional().nullable(),
    notes: z.string().trim().max(5000).optional().nullable(),
    created_by: z.string().uuid('Invalid created_by ID').optional().nullable(),
});
export const updateInterviewSchema = z.object({
    interview_type: z
        .enum(['phone', 'video', 'onsite', 'panel', 'technical', 'behavioral', 'culture_fit'])
        .optional(),
    title: z.string().trim().max(500).optional().nullable(),
    description: z.string().trim().max(5000).optional().nullable(),
    scheduled_at: z.string().trim().optional(),
    duration_minutes: z.number().int().min(5).max(480).optional(),
    timezone: z.string().trim().max(100).optional(),
    location_type: z.enum(['video', 'onsite', 'phone']).optional(),
    location: z.string().trim().max(500).optional().nullable(),
    meeting_link: z.string().trim().url('Invalid meeting link').max(2048).optional().nullable(),
    dial_in: z.string().trim().max(200).optional().nullable(),
    status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
    outcome: z.enum(['pass', 'fail', 'maybe', 'strong_pass', 'strong_fail']).optional().nullable(),
    feedback: z.string().trim().max(5000).optional().nullable(),
    rating: z.number().min(0).max(5).optional().nullable(),
    notes: z.string().trim().max(5000).optional().nullable(),
});
export const completeInterviewSchema = z.object({
    outcome: z.enum(['pass', 'fail', 'maybe', 'strong_pass', 'strong_fail']).optional().nullable(),
    feedback: z.string().trim().max(5000).optional().nullable(),
    rating: z.number().min(0).max(5).optional().nullable(),
});
export const cancelInterviewSchema = z.object({
    reason: z.string().trim().max(2000).optional().nullable(),
});
//# sourceMappingURL=recruitment.js.map