/**
 * Zod Schemas for Social Routes
 * Covers: social posts, comments, likes, and clubs
 */
import { z } from 'zod';
// =============================================================================
// SOCIAL POSTS
// =============================================================================
export const createSocialPostSchema = z.object({
    author_id: z.string().uuid('Invalid author ID'),
    content: z.string().trim().min(1, 'Content is required').max(10000),
    post_type: z.string().trim().max(50).optional(),
    attachments: z.array(z.record(z.unknown())).optional().nullable(),
    poll_options: z.array(z.record(z.unknown())).optional().nullable(),
    visibility: z.enum(['all', 'department', 'team', 'private']).optional(),
    target_org_units: z.array(z.string().trim().max(200)).optional().nullable(),
});
export const updateSocialPostSchema = z.object({
    content: z.string().trim().min(1).max(10000).optional(),
    visibility: z.enum(['all', 'department', 'team', 'private']).optional(),
    is_pinned: z.boolean().optional(),
    pinned_until: z.string().trim().max(50).optional().nullable(),
});
// =============================================================================
// SOCIAL INTERACTIONS
// =============================================================================
export const socialLikeSchema = z.object({
    employee_id: z.string().uuid('Invalid employee ID'),
});
export const createSocialCommentSchema = z.object({
    author_id: z.string().uuid('Invalid author ID'),
    content: z.string().trim().min(1, 'Content is required').max(5000),
    parent_comment_id: z.string().uuid('Invalid parent comment ID').optional().nullable(),
});
// =============================================================================
// CLUBS
// =============================================================================
export const createClubSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    description: z.string().trim().max(5000).optional().nullable(),
    category: z.string().trim().max(100).optional().nullable(),
    icon: z.string().trim().max(100).optional().nullable(),
    cover_image_url: z.string().trim().max(1000).optional().nullable(),
    is_public: z.boolean().optional(),
    requires_approval: z.boolean().optional(),
    max_members: z.coerce.number().int().min(1).max(100000).optional().nullable(),
    owner_id: z.string().uuid('Invalid owner ID'),
});
export const joinClubSchema = z.object({
    employee_id: z.string().uuid('Invalid employee ID'),
});
//# sourceMappingURL=social.js.map