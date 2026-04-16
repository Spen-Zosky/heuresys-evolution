/**
 * Blueprint Standalone — Self-Service Mode (O3.5)
 * GET  /api/v1/blueprint/standalone/industries  — lista profili disponibili
 * POST /api/v1/blueprint/standalone/generate    — genera blueprint in-memory
 *
 * Auth: nessuna. Rate limit: 3 req / 10 min per IP.
 * Usa pool admin (bypassa RLS su blueprint_templates).
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=blueprint-standalone.d.ts.map