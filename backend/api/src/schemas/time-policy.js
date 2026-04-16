/**
 * Zod Schemas for Time Analytics and Policy Violations Routes
 * Covers: time-analytics query params, platform alerts query, policy-violations pagination
 */
import { z } from 'zod';
// =============================================================================
// TIME ANALYTICS
// =============================================================================
/**
 * Query schema for endpoints that accept a `period` param (number of days).
 * Used by: /time-analytics/attendance-patterns, /time-analytics/overtime
 */
export const timeAnalyticsPeriodQuerySchema = z
    .object({
    period: z.coerce.number().int().min(1).max(365).default(30),
})
    .passthrough();
// =============================================================================
// PLATFORM ALERTS
// =============================================================================
/**
 * Query schema for /platform/alerts endpoint.
 * Accepts a `limit` for the number of alerts to return.
 */
export const platformAlertsQuerySchema = z
    .object({
    limit: z.coerce.number().int().min(1).max(500).default(10),
})
    .passthrough();
// =============================================================================
// POLICY VIOLATIONS
// =============================================================================
/**
 * Query schema for /policy-violations list endpoint.
 * Accepts `limit` and `offset` for pagination.
 */
export const policyViolationsQuerySchema = z
    .object({
    limit: z.coerce.number().int().min(1).max(500).default(100),
    offset: z.coerce.number().int().min(0).default(0),
})
    .passthrough();
//# sourceMappingURL=time-policy.js.map