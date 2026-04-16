import { Router, type Request, type Response } from 'express';
import { getEnrichmentMetrics } from '../db/metrics.js';
import { assertTenantId } from '../db/pool.js';

export const metricsRouter: Router = Router();

/**
 * SEE Fase 10 — tenant-scoped metrics.
 *
 * Clients must send x-tenant-id (injected by api-gateway proxy from
 * the authenticated JWT — see services/api-gateway/src/routes/enrichment.ts).
 * This endpoint does not mutate state.
 */
metricsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const header = req.header('x-tenant-id');
    if (!header) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_TENANT', message: 'x-tenant-id header required' },
      });
      return;
    }
    try {
      assertTenantId(header);
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TENANT', message: (err as Error).message },
      });
      return;
    }
    const metrics = await getEnrichmentMetrics(header);
    res.json({ success: true, data: metrics });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
});
