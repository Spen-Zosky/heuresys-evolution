/**
 * Zod Schemas for Time Analytics and Policy Violations Routes
 * Covers: time-analytics query params, platform alerts query, policy-violations pagination
 */
import { z } from 'zod';
/**
 * Query schema for endpoints that accept a `period` param (number of days).
 * Used by: /time-analytics/attendance-patterns, /time-analytics/overtime
 */
export declare const timeAnalyticsPeriodQuerySchema: z.ZodObject<{
    period: z.ZodDefault<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    period: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    period: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Query schema for /platform/alerts endpoint.
 * Accepts a `limit` for the number of alerts to return.
 */
export declare const platformAlertsQuerySchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    limit: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    limit: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Query schema for /policy-violations list endpoint.
 * Accepts `limit` and `offset` for pagination.
 */
export declare const policyViolationsQuerySchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
//# sourceMappingURL=time-policy.d.ts.map