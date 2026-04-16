/**
 * ESCO Skills Routes
 * Skills taxonomy and competencies management
 *
 * NOTE: esco_skills is a global taxonomy/reference table with no tenant_id column.
 * Queries use req.dbClient for consistency with the RLS middleware chain, even though
 * these tables are not tenant-scoped. The dbClient is set by tenant context middleware.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=skills.d.ts.map