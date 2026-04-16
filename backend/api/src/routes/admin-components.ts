/**
 * Admin Component Registry Routes
 * Read-only catalog of reusable admin UI components. Used by skills, agents,
 * and developers to discover existing components before writing new UI (P11).
 *
 * The registry is data-driven: every entry corresponds to a self-contained
 * React component that can be imported from the frontend codebase.
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { asyncHandler } from '../errors/middleware.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /admin-components
 * Returns the full registry of reusable components.
 * Platform defaults (tenant_id NULL) merged with tenant-specific overrides.
 * Query params:
 *   - functional_area (optional) — filter by area code
 *   - scope            (optional) — filter by scope_level
 *   - context          (optional) — require this context in reuse_contexts
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { functional_area, scope, context } = req.query as Record<string, string>;

    const params: (string | null)[] = [tenantId];
    const conditions: string[] = ['(acr.tenant_id = $1 OR acr.tenant_id IS NULL)'];

    if (functional_area) {
      params.push(functional_area);
      conditions.push(`acr.functional_area_code = $${params.length}`);
    }
    if (scope) {
      params.push(scope);
      conditions.push(`acr.scope_level = $${params.length}`);
    }
    if (context) {
      params.push(context);
      conditions.push(`$${params.length} = ANY(acr.reuse_contexts)`);
    }

    const result = await req.dbClient!.query(
      `
      WITH merged AS (
        SELECT DISTINCT ON (acr.code)
               acr.id, acr.code, acr.name, acr.description,
               acr.name_it, acr.name_en, acr.description_it, acr.description_en,
               acr.frontend_path, acr.export_name, acr.export_kind,
               acr.prop_shape, acr.functional_area_code, acr.scope_level,
               acr.read_only, acr.reuse_contexts, acr.api_endpoints,
               acr.verified_with_data, acr.verified_at,
               acr.tenant_id
          FROM admin_component_registry acr
         WHERE ${conditions.join(' AND ')}
         ORDER BY acr.code, (acr.tenant_id IS NOT NULL) DESC
      )
      SELECT * FROM merged ORDER BY functional_area_code, code
      `,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { total: result.rows.length },
    });
  })
);

/**
 * GET /admin-components/by-area/:functional_area_code
 * Shortcut: all components for a given functional area.
 */
router.get(
  '/by-area/:functional_area_code',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { functional_area_code } = req.params;

    const result = await req.dbClient!.query(
      `
      WITH merged AS (
        SELECT DISTINCT ON (code)
               id, code, name, description, name_it, name_en, description_it, description_en,
               frontend_path, export_name,
               export_kind, prop_shape, functional_area_code, scope_level,
               read_only, reuse_contexts, api_endpoints,
               verified_with_data, verified_at, tenant_id
          FROM admin_component_registry
         WHERE functional_area_code = $2
           AND (tenant_id = $1 OR tenant_id IS NULL)
         ORDER BY code, (tenant_id IS NOT NULL) DESC
      )
      SELECT * FROM merged ORDER BY code
      `,
      [tenantId, functional_area_code]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { total: result.rows.length, functional_area_code },
    });
  })
);

/**
 * GET /admin-components/:code
 * Fetch a single component by code.
 */
router.get(
  '/:code',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { code } = req.params;

    const result = await req.dbClient!.query(
      `
      SELECT id, code, name, description, name_it, name_en, description_it, description_en,
             frontend_path, export_name,
             export_kind, prop_shape, functional_area_code, scope_level,
             read_only, reuse_contexts, api_endpoints,
             verified_with_data, verified_at, tenant_id
        FROM admin_component_registry
       WHERE code = $2
         AND (tenant_id = $1 OR tenant_id IS NULL)
       ORDER BY (tenant_id IS NOT NULL) DESC
       LIMIT 1
      `,
      [tenantId, code]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: `Component not found: ${code}`,
      });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  })
);

export default router;
