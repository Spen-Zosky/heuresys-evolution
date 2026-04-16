/**
 * Zod Schemas for Report Subscriptions Routes
 * Covers: subscription CRUD and management
 */
import { z } from 'zod';
export declare const createReportSubscriptionSchema: z.ZodObject<{
    report_id: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    schedule: z.ZodObject<{
        frequency: z.ZodString;
        time: z.ZodString;
        day_of_week: z.ZodOptional<z.ZodNumber>;
        day_of_month: z.ZodOptional<z.ZodNumber>;
        timezone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        time: string;
        frequency: string;
        timezone?: string | undefined;
        day_of_week?: number | undefined;
        day_of_month?: number | undefined;
    }, {
        time: string;
        frequency: string;
        timezone?: string | undefined;
        day_of_week?: number | undefined;
        day_of_month?: number | undefined;
    }>;
    delivery: z.ZodObject<{
        methods: z.ZodArray<z.ZodString, "many">;
        recipients: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        format: z.ZodOptional<z.ZodString>;
        include_charts: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        methods: string[];
        format?: string | undefined;
        recipients?: string[] | undefined;
        include_charts?: boolean | undefined;
    }, {
        methods: string[];
        format?: string | undefined;
        recipients?: string[] | undefined;
        include_charts?: boolean | undefined;
    }>;
    parameters: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    filters: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    report_id: string;
    schedule: {
        time: string;
        frequency: string;
        timezone?: string | undefined;
        day_of_week?: number | undefined;
        day_of_month?: number | undefined;
    };
    delivery: {
        methods: string[];
        format?: string | undefined;
        recipients?: string[] | undefined;
        include_charts?: boolean | undefined;
    };
    description?: string | null | undefined;
    created_by?: string | undefined;
    filters?: Record<string, unknown> | null | undefined;
    parameters?: Record<string, unknown> | null | undefined;
}, {
    name: string;
    report_id: string;
    schedule: {
        time: string;
        frequency: string;
        timezone?: string | undefined;
        day_of_week?: number | undefined;
        day_of_month?: number | undefined;
    };
    delivery: {
        methods: string[];
        format?: string | undefined;
        recipients?: string[] | undefined;
        include_charts?: boolean | undefined;
    };
    description?: string | null | undefined;
    created_by?: string | undefined;
    filters?: Record<string, unknown> | null | undefined;
    parameters?: Record<string, unknown> | null | undefined;
}>;
export declare const updateReportSubscriptionSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    schedule: z.ZodOptional<z.ZodObject<{
        frequency: z.ZodString;
        time: z.ZodString;
        day_of_week: z.ZodOptional<z.ZodNumber>;
        day_of_month: z.ZodOptional<z.ZodNumber>;
        timezone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        time: string;
        frequency: string;
        timezone?: string | undefined;
        day_of_week?: number | undefined;
        day_of_month?: number | undefined;
    }, {
        time: string;
        frequency: string;
        timezone?: string | undefined;
        day_of_week?: number | undefined;
        day_of_month?: number | undefined;
    }>>;
    delivery: z.ZodOptional<z.ZodObject<{
        methods: z.ZodArray<z.ZodString, "many">;
        recipients: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        format: z.ZodOptional<z.ZodString>;
        include_charts: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        methods: string[];
        format?: string | undefined;
        recipients?: string[] | undefined;
        include_charts?: boolean | undefined;
    }, {
        methods: string[];
        format?: string | undefined;
        recipients?: string[] | undefined;
        include_charts?: boolean | undefined;
    }>>;
    parameters: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    filters: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    is_active?: boolean | undefined;
    filters?: Record<string, unknown> | null | undefined;
    parameters?: Record<string, unknown> | null | undefined;
    schedule?: {
        time: string;
        frequency: string;
        timezone?: string | undefined;
        day_of_week?: number | undefined;
        day_of_month?: number | undefined;
    } | undefined;
    delivery?: {
        methods: string[];
        format?: string | undefined;
        recipients?: string[] | undefined;
        include_charts?: boolean | undefined;
    } | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    is_active?: boolean | undefined;
    filters?: Record<string, unknown> | null | undefined;
    parameters?: Record<string, unknown> | null | undefined;
    schedule?: {
        time: string;
        frequency: string;
        timezone?: string | undefined;
        day_of_week?: number | undefined;
        day_of_month?: number | undefined;
    } | undefined;
    delivery?: {
        methods: string[];
        format?: string | undefined;
        recipients?: string[] | undefined;
        include_charts?: boolean | undefined;
    } | undefined;
}>;
//# sourceMappingURL=report-subscriptions.d.ts.map