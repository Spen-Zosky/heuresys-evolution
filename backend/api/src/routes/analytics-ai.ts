/**
 * AI Analytics Routes
 * Provides analytics data for AI usage across the platform.
 * Schema (ai_analytics_daily):
 *   id, tenant_id, date, total_queries, unique_users, total_sessions,
 *   chat_queries, search_queries, sql_queries, document_qa_queries,
 *   avg_response_time_ms, p95_response_time_ms, error_count,
 *   total_tokens_input, total_tokens_output, avg_confidence_score,
 *   escalation_count, escalation_resolved_count, feedback_count,
 *   avg_feedback_rating, top_query_categories, created_at
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { asyncHandler } from '../errors/middleware.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /api/v1/analytics/ai
 * Summary of AI usage for the current tenant
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { days = '30' } = req.query as Record<string, string>;
    const daysNum = safeParseInt(days as string, { fallback: 30, min: 1, max: 365 });

    const result = await req.dbClient!.query(
      `
      SELECT
        date,
        total_queries,
        unique_users,
        total_sessions,
        chat_queries,
        search_queries,
        sql_queries,
        document_qa_queries,
        avg_response_time_ms,
        p95_response_time_ms,
        error_count,
        total_tokens_input,
        total_tokens_output,
        avg_confidence_score,
        escalation_count,
        feedback_count,
        avg_feedback_rating,
        top_query_categories
      FROM ai_analytics_daily
      WHERE tenant_id = $1
        AND date >= CURRENT_DATE - $2::int
      ORDER BY date DESC
      `,
      [tenantId, daysNum]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /api/v1/analytics/ai/summary
 * Aggregated summary of AI usage
 */
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { days = '30' } = req.query as Record<string, string>;
    const daysNum = safeParseInt(days as string, { fallback: 30, min: 1, max: 365 });

    const result = await req.dbClient!.query(
      `
      SELECT
        COUNT(*)::int AS total_days,
        COALESCE(SUM(total_queries), 0)::int AS total_queries,
        COALESCE(SUM(unique_users), 0)::int AS total_unique_users,
        COALESCE(SUM(total_sessions), 0)::int AS total_sessions,
        COALESCE(SUM(chat_queries), 0)::int AS chat_queries,
        COALESCE(SUM(search_queries), 0)::int AS search_queries,
        COALESCE(SUM(sql_queries), 0)::int AS sql_queries,
        COALESCE(SUM(document_qa_queries), 0)::int AS document_qa_queries,
        COALESCE(ROUND(AVG(avg_response_time_ms)), 0)::int AS avg_response_time_ms,
        COALESCE(SUM(error_count), 0)::int AS total_errors,
        COALESCE(SUM(total_tokens_input), 0)::bigint AS total_tokens_input,
        COALESCE(SUM(total_tokens_output), 0)::bigint AS total_tokens_output,
        COALESCE(ROUND(AVG(avg_confidence_score), 2), 0) AS avg_confidence_score,
        COALESCE(SUM(escalation_count), 0)::int AS total_escalations,
        COALESCE(SUM(feedback_count), 0)::int AS total_feedback,
        COALESCE(ROUND(AVG(avg_feedback_rating), 2), 0) AS avg_feedback_rating
      FROM ai_analytics_daily
      WHERE tenant_id = $1
        AND date >= CURRENT_DATE - $2::int
      `,
      [tenantId, daysNum]
    );

    res.json({ success: true, data: result.rows[0] || {} });
  })
);

export default router;
