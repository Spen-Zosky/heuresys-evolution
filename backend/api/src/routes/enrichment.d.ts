/**
 * Enrichment Engine Proxy Routes — SEE Fase 8
 *
 * Thin reverse-proxy layer in front of services/enrichment-engine. All
 * requests enter through api-gateway so they go through JWT auth + RBP
 * permission checks (ENRICHMENT functional area, migration 184), then
 * get forwarded to the internal engine with the tenant id resolved
 * from the authenticated user.
 *
 * Contract vs the raw enrichment-engine HTTP contract:
 *   - Client MUST NOT set x-tenant-id — the proxy injects it from the
 *     JWT so a user can never request enrichment for a tenant they are
 *     not a member of. If the header comes in from outside it is
 *     stripped + replaced.
 *   - Client MUST carry a valid JWT; the existing api-gateway auth
 *     middleware populates req.user before this router runs.
 *   - Permission map:
 *       POST /jobs              → ENRICHMENT.CREATE
 *       GET  /jobs              → ENRICHMENT.VIEW
 *       GET  /jobs/:id          → ENRICHMENT.VIEW
 *       DELETE /jobs/:id        → ENRICHMENT.DELETE
 *       POST /jobs/:id/commit   → ENRICHMENT.APPROVE
 *       POST /jobs/:id/rollback → ENRICHMENT.APPROVE
 */
import { Router } from 'express';
declare const router: Router;
export default router;
//# sourceMappingURL=enrichment.d.ts.map