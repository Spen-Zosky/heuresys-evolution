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

import { Router, type Request, type Response } from 'express';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router: Router = Router();

const ENRICHMENT_BASE_URL = process.env.ENRICHMENT_ENGINE_URL ?? 'http://localhost:8020';
const FORWARD_TIMEOUT_MS = Number(process.env.ENRICHMENT_PROXY_TIMEOUT_MS ?? 60_000);

function resolveTenantFromJwt(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId ?? (authReq as unknown as { tenantId?: string }).tenantId;
  if (!tenantId) {
    throw Errors.unauthorized('no tenant on JWT');
  }
  return tenantId;
}

async function forward(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  tenantId: string,
  body?: unknown
): Promise<{ status: number; body: unknown }> {
  const url = `${ENRICHMENT_BASE_URL}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': tenantId,
    },
    signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
  };
  if (body !== undefined && method !== 'GET') {
    init.body = JSON.stringify(body);
  }
  const response = await fetch(url, init);
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = { success: false, error: { code: 'BAD_UPSTREAM_BODY' } };
  }
  return { status: response.status, body: parsed };
}

// POST /api/v1/enrichment/jobs → ENRICHMENT.CREATE
router.post(
  '/jobs',
  requirePermission('ENRICHMENT', 'CREATE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveTenantFromJwt(req);
    const { status, body } = await forward('POST', '/api/v1/jobs', tenantId, req.body);
    res.status(status).json(body);
  })
);

// GET /api/v1/enrichment/jobs → ENRICHMENT.VIEW
router.get(
  '/jobs',
  requirePermission('ENRICHMENT', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveTenantFromJwt(req);
    const qs = new URLSearchParams();
    if (typeof req.query.status === 'string') qs.set('status', req.query.status);
    if (typeof req.query.limit === 'string') qs.set('limit', req.query.limit);
    if (typeof req.query.offset === 'string') qs.set('offset', req.query.offset);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const { status, body } = await forward('GET', `/api/v1/jobs${suffix}`, tenantId);
    res.status(status).json(body);
  })
);

// GET /api/v1/enrichment/jobs/:id → ENRICHMENT.VIEW
router.get(
  '/jobs/:id',
  requirePermission('ENRICHMENT', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveTenantFromJwt(req);
    const { status, body } = await forward('GET', `/api/v1/jobs/${req.params.id}`, tenantId);
    res.status(status).json(body);
  })
);

// DELETE /api/v1/enrichment/jobs/:id → ENRICHMENT.DELETE (soft-cancel)
router.delete(
  '/jobs/:id',
  requirePermission('ENRICHMENT', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveTenantFromJwt(req);
    const { status, body } = await forward('DELETE', `/api/v1/jobs/${req.params.id}`, tenantId);
    res.status(status).json(body);
  })
);

// POST /api/v1/enrichment/jobs/:id/commit → ENRICHMENT.APPROVE
router.post(
  '/jobs/:id/commit',
  requirePermission('ENRICHMENT', 'APPROVE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveTenantFromJwt(req);
    const { status, body } = await forward(
      'POST',
      `/api/v1/jobs/${req.params.id}/commit`,
      tenantId,
      req.body
    );
    res.status(status).json(body);
  })
);

// POST /api/v1/enrichment/jobs/:id/rollback → ENRICHMENT.APPROVE
router.post(
  '/jobs/:id/rollback',
  requirePermission('ENRICHMENT', 'APPROVE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveTenantFromJwt(req);
    const { status, body } = await forward(
      'POST',
      `/api/v1/jobs/${req.params.id}/rollback`,
      tenantId,
      req.body
    );
    res.status(status).json(body);
  })
);

// GET /api/v1/enrichment/metrics → ENRICHMENT.VIEW (SEE Fase 10)
router.get(
  '/metrics',
  requirePermission('ENRICHMENT', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveTenantFromJwt(req);
    const { status, body } = await forward('GET', '/api/v1/metrics', tenantId);
    res.status(status).json(body);
  })
);

// GET /api/v1/enrichment/health — proxied, no auth (readiness)
router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const response = await fetch(`${ENRICHMENT_BASE_URL}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      const body = await response.json();
      res.status(response.status).json(body);
    } catch (err) {
      res.status(503).json({
        success: false,
        error: { code: 'UPSTREAM_DOWN', message: (err as Error).message },
      });
    }
  })
);

export default router;
