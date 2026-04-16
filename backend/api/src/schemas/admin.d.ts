/**
 * Zod Schemas for Admin Routes
 * Covers: sso, predictions, skills
 */
import { z } from 'zod';
export declare const testAzureConfigSchema: z.ZodObject<{
    clientId: z.ZodString;
    clientSecret: z.ZodString;
    azureTenantId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    clientSecret: string;
    azureTenantId: string;
}, {
    clientId: string;
    clientSecret: string;
    azureTenantId: string;
}>;
export declare const testGoogleConfigSchema: z.ZodObject<{
    clientId: z.ZodString;
    clientSecret: z.ZodString;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    clientSecret: string;
}, {
    clientId: string;
    clientSecret: string;
}>;
export declare const updateAzureConfigSchema: z.ZodObject<{
    tenantId: z.ZodString;
    clientId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    clientSecret: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    azureTenantId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    enabled?: boolean | undefined;
    clientId?: string | null | undefined;
    clientSecret?: string | null | undefined;
    azureTenantId?: string | null | undefined;
}, {
    tenantId: string;
    enabled?: boolean | undefined;
    clientId?: string | null | undefined;
    clientSecret?: string | null | undefined;
    azureTenantId?: string | null | undefined;
}>;
export declare const updateGoogleConfigSchema: z.ZodObject<{
    tenantId: z.ZodString;
    clientId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    clientSecret: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    allowedDomains: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    enabled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    enabled?: boolean | undefined;
    clientId?: string | null | undefined;
    clientSecret?: string | null | undefined;
    allowedDomains?: string[] | undefined;
}, {
    tenantId: string;
    enabled?: boolean | undefined;
    clientId?: string | null | undefined;
    clientSecret?: string | null | undefined;
    allowedDomains?: string[] | undefined;
}>;
export declare const createPredictionModelSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodString;
    version: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: string;
    version: string;
    config: Record<string, unknown>;
    description?: string | null | undefined;
    created_by?: string | undefined;
}, {
    name: string;
    type: string;
    version: string;
    config: Record<string, unknown>;
    description?: string | null | undefined;
    created_by?: string | undefined;
}>;
export declare const updateModelStatusSchema: z.ZodObject<{
    status: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: string;
}, {
    status: string;
}>;
export declare const generatePerformancePredictionsSchema: z.ZodObject<{
    prediction_period: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    prediction_period?: string | null | undefined;
}, {
    prediction_period?: string | null | undefined;
}>;
export declare const validatePredictionsSchema: z.ZodObject<{
    prediction_period: z.ZodString;
}, "strip", z.ZodTypeAny, {
    prediction_period: string;
}, {
    prediction_period: string;
}>;
export declare const createSkillSchema: z.ZodObject<{
    uri: z.ZodString;
    preferred_label_en: z.ZodString;
    description_en: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    skill_type: z.ZodString;
    reuse_level: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_digital: z.ZodOptional<z.ZodBoolean>;
    is_green: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    uri: string;
    preferred_label_en: string;
    skill_type: string;
    description_en?: string | null | undefined;
    reuse_level?: string | null | undefined;
    is_digital?: boolean | undefined;
    is_green?: boolean | undefined;
}, {
    uri: string;
    preferred_label_en: string;
    skill_type: string;
    description_en?: string | null | undefined;
    reuse_level?: string | null | undefined;
    is_digital?: boolean | undefined;
    is_green?: boolean | undefined;
}>;
export declare const updateSkillSchema: z.ZodObject<{
    uri: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    preferred_label_en: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    description_en: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    skill_type: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    reuse_level: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    is_digital: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    is_green: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    uri?: string | undefined;
    preferred_label_en?: string | undefined;
    description_en?: string | null | undefined;
    skill_type?: string | undefined;
    reuse_level?: string | null | undefined;
    is_digital?: boolean | undefined;
    is_green?: boolean | undefined;
}, {
    uri?: string | undefined;
    preferred_label_en?: string | undefined;
    description_en?: string | null | undefined;
    skill_type?: string | undefined;
    reuse_level?: string | null | undefined;
    is_digital?: boolean | undefined;
    is_green?: boolean | undefined;
}>;
//# sourceMappingURL=admin.d.ts.map