/**
 * 360-Degree Reviews Routes
 * CRUD operations for feedback_360 within tenant context
 * Schema verified: id, tenant_id, target_employee_id, reviewer_employee_id,
 *   review_cycle_id, relationship_type, overall_rating, strengths,
 *   areas_for_improvement, is_anonymous, status, created_at, completed_at,
 *   questionnaire_id, performance_review_id, request_id, question_responses,
 *   sentiment_score, submission_time_seconds
 * Views: v_360_feedback_summary, v_360_response_rates
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=360-reviews.d.ts.map