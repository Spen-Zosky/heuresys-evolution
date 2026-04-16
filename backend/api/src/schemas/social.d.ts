/**
 * Zod Schemas for Social Routes
 * Covers: social posts, comments, likes, and clubs
 */
import { z } from 'zod';
export declare const createSocialPostSchema: z.ZodObject<{
    author_id: z.ZodString;
    content: z.ZodString;
    post_type: z.ZodOptional<z.ZodString>;
    attachments: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>>;
    poll_options: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>>;
    visibility: z.ZodOptional<z.ZodEnum<["all", "department", "team", "private"]>>;
    target_org_units: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    content: string;
    author_id: string;
    attachments?: Record<string, unknown>[] | null | undefined;
    visibility?: "team" | "all" | "department" | "private" | undefined;
    post_type?: string | undefined;
    poll_options?: Record<string, unknown>[] | null | undefined;
    target_org_units?: string[] | null | undefined;
}, {
    content: string;
    author_id: string;
    attachments?: Record<string, unknown>[] | null | undefined;
    visibility?: "team" | "all" | "department" | "private" | undefined;
    post_type?: string | undefined;
    poll_options?: Record<string, unknown>[] | null | undefined;
    target_org_units?: string[] | null | undefined;
}>;
export declare const updateSocialPostSchema: z.ZodObject<{
    content: z.ZodOptional<z.ZodString>;
    visibility: z.ZodOptional<z.ZodEnum<["all", "department", "team", "private"]>>;
    is_pinned: z.ZodOptional<z.ZodBoolean>;
    pinned_until: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    content?: string | undefined;
    visibility?: "team" | "all" | "department" | "private" | undefined;
    is_pinned?: boolean | undefined;
    pinned_until?: string | null | undefined;
}, {
    content?: string | undefined;
    visibility?: "team" | "all" | "department" | "private" | undefined;
    is_pinned?: boolean | undefined;
    pinned_until?: string | null | undefined;
}>;
export declare const socialLikeSchema: z.ZodObject<{
    employee_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employee_id: string;
}, {
    employee_id: string;
}>;
export declare const createSocialCommentSchema: z.ZodObject<{
    author_id: z.ZodString;
    content: z.ZodString;
    parent_comment_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    content: string;
    author_id: string;
    parent_comment_id?: string | null | undefined;
}, {
    content: string;
    author_id: string;
    parent_comment_id?: string | null | undefined;
}>;
export declare const createClubSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    icon: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    cover_image_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_public: z.ZodOptional<z.ZodBoolean>;
    requires_approval: z.ZodOptional<z.ZodBoolean>;
    max_members: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    owner_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    owner_id: string;
    description?: string | null | undefined;
    category?: string | null | undefined;
    icon?: string | null | undefined;
    cover_image_url?: string | null | undefined;
    is_public?: boolean | undefined;
    requires_approval?: boolean | undefined;
    max_members?: number | null | undefined;
}, {
    name: string;
    owner_id: string;
    description?: string | null | undefined;
    category?: string | null | undefined;
    icon?: string | null | undefined;
    cover_image_url?: string | null | undefined;
    is_public?: boolean | undefined;
    requires_approval?: boolean | undefined;
    max_members?: number | null | undefined;
}>;
export declare const joinClubSchema: z.ZodObject<{
    employee_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employee_id: string;
}, {
    employee_id: string;
}>;
//# sourceMappingURL=social.d.ts.map