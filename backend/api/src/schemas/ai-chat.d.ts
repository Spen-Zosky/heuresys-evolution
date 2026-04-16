import { z } from 'zod';
export declare const createSessionSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    provider: z.ZodDefault<z.ZodEnum<["openai", "gemini", "anthropic"]>>;
    model: z.ZodOptional<z.ZodString>;
    systemPrompt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    provider: "gemini" | "openai" | "anthropic";
    title?: string | undefined;
    model?: string | undefined;
    systemPrompt?: string | undefined;
}, {
    title?: string | undefined;
    provider?: "gemini" | "openai" | "anthropic" | undefined;
    model?: string | undefined;
    systemPrompt?: string | undefined;
}>;
export declare const sendMessageSchema: z.ZodObject<{
    content: z.ZodString;
    includeRag: z.ZodDefault<z.ZodBoolean>;
    knowledgeBaseIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    content: string;
    includeRag: boolean;
    knowledgeBaseIds?: string[] | undefined;
}, {
    content: string;
    includeRag?: boolean | undefined;
    knowledgeBaseIds?: string[] | undefined;
}>;
export declare const messageFeedbackSchema: z.ZodObject<{
    rating: z.ZodNumber;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    rating: number;
    comment?: string | undefined;
}, {
    rating: number;
    comment?: string | undefined;
}>;
export declare const respondEscalationSchema: z.ZodObject<{
    response: z.ZodString;
    resolutionNotes: z.ZodOptional<z.ZodString>;
    shouldTrain: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    response: string;
    shouldTrain: boolean;
    resolutionNotes?: string | undefined;
}, {
    response: string;
    resolutionNotes?: string | undefined;
    shouldTrain?: boolean | undefined;
}>;
export declare const assignEscalationSchema: z.ZodObject<{
    assignToEmployeeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    assignToEmployeeId: string;
}, {
    assignToEmployeeId: string;
}>;
export declare const updateProviderConfigSchema: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    is_enabled: z.ZodOptional<z.ZodBoolean>;
    priority: z.ZodOptional<z.ZodNumber>;
    rate_limit_per_minute: z.ZodOptional<z.ZodNumber>;
    cost_per_1k_tokens: z.ZodOptional<z.ZodNumber>;
    max_batch_size: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    priority?: number | undefined;
    model?: string | undefined;
    is_enabled?: boolean | undefined;
    rate_limit_per_minute?: number | undefined;
    cost_per_1k_tokens?: number | undefined;
    max_batch_size?: number | undefined;
}, {
    priority?: number | undefined;
    model?: string | undefined;
    is_enabled?: boolean | undefined;
    rate_limit_per_minute?: number | undefined;
    cost_per_1k_tokens?: number | undefined;
    max_batch_size?: number | undefined;
}>;
export declare const testProviderSchema: z.ZodObject<{
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
}, {
    text: string;
}>;
export declare const testFallbackSchema: z.ZodObject<{
    text: z.ZodString;
    preferredProvider: z.ZodOptional<z.ZodEnum<["openai", "gemini", "anthropic"]>>;
}, "strip", z.ZodTypeAny, {
    text: string;
    preferredProvider?: "gemini" | "openai" | "anthropic" | undefined;
}, {
    text: string;
    preferredProvider?: "gemini" | "openai" | "anthropic" | undefined;
}>;
export declare const createRagDocumentSchema: z.ZodObject<{
    filename: z.ZodString;
    original_name: z.ZodString;
    mime_type: z.ZodString;
    file_size: z.ZodNumber;
    file_path: z.ZodOptional<z.ZodString>;
    source_type: z.ZodDefault<z.ZodString>;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    uploaded_by_employee_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    metadata: Record<string, unknown>;
    filename: string;
    original_name: string;
    mime_type: string;
    file_size: number;
    source_type: string;
    file_path?: string | undefined;
    uploaded_by_employee_id?: string | undefined;
}, {
    filename: string;
    original_name: string;
    mime_type: string;
    file_size: number;
    metadata?: Record<string, unknown> | undefined;
    file_path?: string | undefined;
    source_type?: string | undefined;
    uploaded_by_employee_id?: string | undefined;
}>;
export declare const updateRagDocumentSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["pending", "processing", "completed", "error"]>>;
    chunk_count: z.ZodOptional<z.ZodNumber>;
    error_message: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    processed_at: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_latest: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "error" | "completed" | "processing" | undefined;
    metadata?: Record<string, unknown> | undefined;
    error_message?: string | null | undefined;
    chunk_count?: number | undefined;
    processed_at?: string | null | undefined;
    is_latest?: boolean | undefined;
}, {
    status?: "pending" | "error" | "completed" | "processing" | undefined;
    metadata?: Record<string, unknown> | undefined;
    error_message?: string | null | undefined;
    chunk_count?: number | undefined;
    processed_at?: string | null | undefined;
    is_latest?: boolean | undefined;
}>;
//# sourceMappingURL=ai-chat.d.ts.map