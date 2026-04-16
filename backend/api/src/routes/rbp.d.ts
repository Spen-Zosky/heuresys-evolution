/**
 * RBP Framework API Routes
 * ARCH-2026-002 v1.2
 *
 * Endpoints for the frontend to consume RBP data:
 * - GET /api/rbp/my-permissions — user's effective permissions + dashboards
 * - GET /api/rbp/dashboard/:slug/nav-items — sidebar items for a dashboard
 * - GET /api/rbp/roles — list all roles (admin only)
 * - GET /api/rbp/functional-areas — list all functional areas (admin only)
 * - POST /api/rbp/cache/invalidate — invalidate RBP cache (sysadmin only)
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=rbp.d.ts.map