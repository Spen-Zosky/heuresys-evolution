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
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=analytics-ai.d.ts.map