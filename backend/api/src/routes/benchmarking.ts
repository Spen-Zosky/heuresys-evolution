/**
 * Benchmarking Routes — O3.8 Cross-Tenant Benchmarking
 * Mount point: /api/v1/benchmarking
 */

import { Router, Request, Response } from 'express';
import { requireTenant } from '../middleware/tenantContext.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { BenchmarkingService } from '../services/benchmarking.js';

const router = Router();

router.use(requireTenant);

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /api/v1/benchmarking/industry/:naceCode
 * Aggregated metrics for a NACE industry code (anonymized, excludes current tenant).
 */
router.get(
  '/industry/:naceCode',
  requirePermission('ORGANIZATION', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const naceCode = String(req.params.naceCode ?? '');
    if (!naceCode || naceCode.trim() === '') {
      throw Errors.badRequest('naceCode is required');
    }

    const service = new BenchmarkingService(req.tenantId!, req.tenant?.name ?? '');
    const data = await service.getIndustryBenchmark(naceCode.trim());
    res.json({ success: true, data });
  })
);

/**
 * GET /api/v1/benchmarking/my-position
 * Positions the current tenant against industry peers for each metric.
 */
router.get(
  '/my-position',
  requirePermission('ORGANIZATION', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = new BenchmarkingService(req.tenantId!, req.tenant?.name ?? '');
    const data = await service.getTenantComparison();
    res.json({ success: true, data });
  })
);

export default router;
