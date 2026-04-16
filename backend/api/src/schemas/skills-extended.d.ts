import { z } from 'zod';
/**
 * POST /advanced-search/search
 */
export declare const advancedSearchSchema: z.ZodObject<{
    query: z.ZodString;
    tenantId: z.ZodString;
    entityTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    limit: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
    minScore: z.ZodOptional<z.ZodNumber>;
    language: z.ZodOptional<z.ZodEnum<["en", "it"]>>;
    useExpansion: z.ZodOptional<z.ZodBoolean>;
    useReranking: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    query: string;
    limit?: number | undefined;
    offset?: number | undefined;
    language?: "it" | "en" | undefined;
    entityTypes?: string[] | undefined;
    minScore?: number | undefined;
    useExpansion?: boolean | undefined;
    useReranking?: boolean | undefined;
}, {
    tenantId: string;
    query: string;
    limit?: number | undefined;
    offset?: number | undefined;
    language?: "it" | "en" | undefined;
    entityTypes?: string[] | undefined;
    minScore?: number | undefined;
    useExpansion?: boolean | undefined;
    useReranking?: boolean | undefined;
}>;
/**
 * POST /advanced-search/expand
 */
export declare const expandQuerySchema: z.ZodObject<{
    query: z.ZodString;
    language: z.ZodOptional<z.ZodEnum<["en", "it"]>>;
}, "strip", z.ZodTypeAny, {
    query: string;
    language?: "it" | "en" | undefined;
}, {
    query: string;
    language?: "it" | "en" | undefined;
}>;
/**
 * POST /advanced-search/feedback/:searchId
 */
export declare const searchFeedbackSchema: z.ZodObject<{
    score: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    score: number;
}, {
    score: number;
}>;
/**
 * POST /embeddings/queue
 */
export declare const queueEmbeddingSchema: z.ZodObject<{
    entity_type: z.ZodString;
    entity_id: z.ZodString;
    text_content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    entity_type: string;
    entity_id: string;
    text_content: string;
}, {
    entity_type: string;
    entity_id: string;
    text_content: string;
}>;
/**
 * POST /embeddings/process
 */
export declare const processEmbeddingsSchema: z.ZodObject<{
    batch_size: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    batch_size?: number | undefined;
}, {
    batch_size?: number | undefined;
}>;
/**
 * POST /embeddings/search
 */
export declare const embeddingSearchSchema: z.ZodObject<{
    query: z.ZodString;
    entity_type: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit?: number | undefined;
    entity_type?: string | undefined;
}, {
    query: string;
    limit?: number | undefined;
    entity_type?: string | undefined;
}>;
/**
 * POST /embeddings/reindex
 */
export declare const reindexEmbeddingSchema: z.ZodObject<{
    entity_type: z.ZodString;
    entity_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    entity_type: string;
    entity_id: string;
}, {
    entity_type: string;
    entity_id: string;
}>;
/**
 * POST /inference/:id/approve
 */
export declare const approveInferenceSchema: z.ZodObject<{
    reviewerId: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
    reviewerId?: string | undefined;
}, {
    notes?: string | undefined;
    reviewerId?: string | undefined;
}>;
/**
 * POST /inference/:id/reject
 */
export declare const rejectInferenceSchema: z.ZodObject<{
    reviewerId: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
    reviewerId?: string | undefined;
}, {
    reason?: string | undefined;
    reviewerId?: string | undefined;
}>;
/**
 * POST /inference/bulk
 */
export declare const bulkInferenceSchema: z.ZodObject<{
    action: z.ZodEnum<["approve", "reject"]>;
    relationIds: z.ZodArray<z.ZodString, "many">;
    reviewerId: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "approve" | "reject";
    relationIds: string[];
    notes?: string | undefined;
    reviewerId?: string | undefined;
}, {
    action: "approve" | "reject";
    relationIds: string[];
    notes?: string | undefined;
    reviewerId?: string | undefined;
}>;
/**
 * POST /inference/bulk-by-filter
 */
export declare const bulkByFilterInferenceSchema: z.ZodObject<{
    action: z.ZodEnum<["approve", "reject"]>;
    filter: z.ZodOptional<z.ZodObject<{
        relationType: z.ZodOptional<z.ZodString>;
        minConfidence: z.ZodOptional<z.ZodNumber>;
        maxAge: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        maxAge?: number | undefined;
        relationType?: string | undefined;
        minConfidence?: number | undefined;
    }, {
        maxAge?: number | undefined;
        relationType?: string | undefined;
        minConfidence?: number | undefined;
    }>>;
    reviewerId: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    action: "approve" | "reject";
    filter?: {
        maxAge?: number | undefined;
        relationType?: string | undefined;
        minConfidence?: number | undefined;
    } | undefined;
    limit?: number | undefined;
    notes?: string | undefined;
    reviewerId?: string | undefined;
}, {
    action: "approve" | "reject";
    filter?: {
        maxAge?: number | undefined;
        relationType?: string | undefined;
        minConfidence?: number | undefined;
    } | undefined;
    limit?: number | undefined;
    notes?: string | undefined;
    reviewerId?: string | undefined;
}>;
/**
 * POST /certifications
 */
export declare const createCertificationSchema: z.ZodObject<{
    code: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    name_en: z.ZodOptional<z.ZodString>;
    issuing_organization: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    validity_months: z.ZodOptional<z.ZodNumber>;
    renewal_requirements: z.ZodOptional<z.ZodString>;
    verification_url: z.ZodOptional<z.ZodString>;
    is_internal: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    is_active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    is_active: boolean;
    is_internal: boolean;
    code?: string | undefined;
    description?: string | undefined;
    name_en?: string | undefined;
    issuing_organization?: string | undefined;
    validity_months?: number | undefined;
    renewal_requirements?: string | undefined;
    verification_url?: string | undefined;
}, {
    name: string;
    code?: string | undefined;
    description?: string | undefined;
    name_en?: string | undefined;
    is_active?: boolean | undefined;
    issuing_organization?: string | undefined;
    validity_months?: number | undefined;
    renewal_requirements?: string | undefined;
    verification_url?: string | undefined;
    is_internal?: boolean | undefined;
}>;
/**
 * PATCH /certifications/:id
 */
export declare const updateCertificationSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    name_en: z.ZodOptional<z.ZodString>;
    issuing_organization: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    validity_months: z.ZodOptional<z.ZodNumber>;
    renewal_requirements: z.ZodOptional<z.ZodString>;
    verification_url: z.ZodOptional<z.ZodString>;
    is_internal: z.ZodOptional<z.ZodBoolean>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    name_en?: string | undefined;
    is_active?: boolean | undefined;
    issuing_organization?: string | undefined;
    validity_months?: number | undefined;
    renewal_requirements?: string | undefined;
    verification_url?: string | undefined;
    is_internal?: boolean | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    name_en?: string | undefined;
    is_active?: boolean | undefined;
    issuing_organization?: string | undefined;
    validity_months?: number | undefined;
    renewal_requirements?: string | undefined;
    verification_url?: string | undefined;
    is_internal?: boolean | undefined;
}>;
/**
 * POST /enrollments
 */
export declare const createEnrollmentSchema: z.ZodObject<{
    employee_id: z.ZodString;
    course_id: z.ZodString;
    due_date: z.ZodOptional<z.ZodString>;
    enrolled_by: z.ZodOptional<z.ZodString>;
    enrollment_source: z.ZodDefault<z.ZodOptional<z.ZodEnum<["manual", "auto", "manager", "self"]>>>;
}, "strip", z.ZodTypeAny, {
    employee_id: string;
    course_id: string;
    enrollment_source: "auto" | "manual" | "self" | "manager";
    due_date?: string | undefined;
    enrolled_by?: string | undefined;
}, {
    employee_id: string;
    course_id: string;
    due_date?: string | undefined;
    enrolled_by?: string | undefined;
    enrollment_source?: "auto" | "manual" | "self" | "manager" | undefined;
}>;
/**
 * PATCH /enrollments/:id
 */
export declare const updateEnrollmentSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["enrolled", "in_progress", "completed", "cancelled", "expired"]>>;
    progress_percent: z.ZodOptional<z.ZodNumber>;
    score: z.ZodOptional<z.ZodNumber>;
    passed: z.ZodOptional<z.ZodBoolean>;
    due_date: z.ZodOptional<z.ZodString>;
    time_spent_minutes: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: "completed" | "in_progress" | "cancelled" | "enrolled" | "expired" | undefined;
    notes?: string | undefined;
    due_date?: string | undefined;
    progress_percent?: number | undefined;
    score?: number | undefined;
    passed?: boolean | undefined;
    time_spent_minutes?: number | undefined;
}, {
    status?: "completed" | "in_progress" | "cancelled" | "enrolled" | "expired" | undefined;
    notes?: string | undefined;
    due_date?: string | undefined;
    progress_percent?: number | undefined;
    score?: number | undefined;
    passed?: boolean | undefined;
    time_spent_minutes?: number | undefined;
}>;
/**
 * POST /enrollments/:id/complete
 */
export declare const completeEnrollmentSchema: z.ZodObject<{
    score: z.ZodOptional<z.ZodNumber>;
    passed: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    passed: boolean;
    score?: number | undefined;
}, {
    score?: number | undefined;
    passed?: boolean | undefined;
}>;
//# sourceMappingURL=skills-extended.d.ts.map