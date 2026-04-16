/**
 * Goals Routes
 * CRUD operations for goals/objectives within tenant context
 * NOTE: Schema verified from database - goals table columns:
 *   id, tenant_id, employee_id, title, description, goal_type,
 *   parent_goal_id, start_date, due_date, status, progress_percent,
 *   weight, created_at, updated_at, completed_at, category, owner_id, priority
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=goals.d.ts.map