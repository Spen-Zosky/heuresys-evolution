/**
 * Zod Schemas for Tenants Routes
 * Covers: tenant CRUD operations
 */
import { z } from 'zod';
export declare const createTenantSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    nace_code: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    region: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "suspended", "pending"]>>;
    subscription_plan: z.ZodOptional<z.ZodEnum<["free", "starter", "professional", "enterprise"]>>;
    industry_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sap_company_code: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    annual_revenue_eur: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    description?: string | null | undefined;
    nace_code?: string | null | undefined;
    region?: string | null | undefined;
    status?: "active" | "inactive" | "suspended" | "pending" | undefined;
    subscription_plan?: "free" | "starter" | "professional" | "enterprise" | undefined;
    industry_type?: string | null | undefined;
    sap_company_code?: string | null | undefined;
    annual_revenue_eur?: number | null | undefined;
}, {
    code: string;
    name: string;
    description?: string | null | undefined;
    nace_code?: string | null | undefined;
    region?: string | null | undefined;
    status?: "active" | "inactive" | "suspended" | "pending" | undefined;
    subscription_plan?: "free" | "starter" | "professional" | "enterprise" | undefined;
    industry_type?: string | null | undefined;
    sap_company_code?: string | null | undefined;
    annual_revenue_eur?: number | null | undefined;
}>;
export declare const updateTenantSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    nace_code: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    region: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<["active", "inactive", "suspended", "pending"]>>>;
    subscription_plan: z.ZodOptional<z.ZodOptional<z.ZodEnum<["free", "starter", "professional", "enterprise"]>>>;
    industry_type: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    sap_company_code: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    annual_revenue_eur: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    verified_website: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>>>;
    tax_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    nace_code?: string | null | undefined;
    region?: string | null | undefined;
    status?: "active" | "inactive" | "suspended" | "pending" | undefined;
    subscription_plan?: "free" | "starter" | "professional" | "enterprise" | undefined;
    industry_type?: string | null | undefined;
    sap_company_code?: string | null | undefined;
    annual_revenue_eur?: number | null | undefined;
    verified_website?: string | null | undefined;
    tax_id?: string | null | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    nace_code?: string | null | undefined;
    region?: string | null | undefined;
    status?: "active" | "inactive" | "suspended" | "pending" | undefined;
    subscription_plan?: "free" | "starter" | "professional" | "enterprise" | undefined;
    industry_type?: string | null | undefined;
    sap_company_code?: string | null | undefined;
    annual_revenue_eur?: number | null | undefined;
    verified_website?: string | null | undefined;
    tax_id?: string | null | undefined;
}>;
//# sourceMappingURL=tenants.d.ts.map