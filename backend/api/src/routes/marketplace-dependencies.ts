/**
 * Marketplace Plugin Dependencies Routes
 * Manage inter-plugin dependency declarations.
 * Schema (plugin_dependencies):
 *   id, plugin_id, depends_on_plugin_id, min_version, max_version,
 *   is_optional, created_at
 *
 * NOTE: Plugin dependencies are platform-level (no tenant_id column).
 * Queries use req.dbClient for consistency with the RLS middleware chain.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
  createMarketplaceDependencySchema,
  updateMarketplaceDependencySchema,
} from '../schemas/marketplace-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { pool } from '../config/database.js';

const router = Router();

/**
 * GET /api/v1/marketplace/dependencies/plugin/:pluginId
 * List dependencies for a specific plugin
 */
router.get(
  '/plugin/:pluginId',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const pluginId = req.params['pluginId'] as string;

    const result = await dbClient.query(
      `
    SELECT
      d.id, d.plugin_id, d.depends_on_plugin_id,
      d.min_version, d.max_version, d.is_optional, d.created_at,
      p.name as depends_on_name, p.slug as depends_on_slug,
      p.icon_url as depends_on_icon_url, p.status as depends_on_status,
      pv.version as depends_on_latest_version
    FROM plugin_dependencies d
    JOIN plugins p ON p.id = d.depends_on_plugin_id
    LEFT JOIN plugin_versions pv ON pv.plugin_id = p.id AND pv.is_latest = true
    WHERE d.plugin_id = $1
    ORDER BY d.created_at ASC
  `,
      [pluginId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /api/v1/marketplace/dependencies/dependents/:pluginId
 * List plugins that depend on a given plugin (reverse dependencies)
 */
router.get(
  '/dependents/:pluginId',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const pluginId = req.params['pluginId'] as string;

    const result = await dbClient.query(
      `
    SELECT
      d.id, d.plugin_id, d.depends_on_plugin_id,
      d.min_version, d.max_version, d.is_optional, d.created_at,
      p.name as plugin_name, p.slug as plugin_slug,
      p.icon_url as plugin_icon_url, p.status as plugin_status
    FROM plugin_dependencies d
    JOIN plugins p ON p.id = d.plugin_id
    WHERE d.depends_on_plugin_id = $1
    ORDER BY p.name ASC
  `,
      [pluginId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * POST /api/v1/marketplace/dependencies
 * Add a dependency to a plugin (SUPERUSER only)
 */
router.post(
  '/',
  authMiddleware,
  requirePermission('MARKETPLACE', 'CREATE'),
  validate(createMarketplaceDependencySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const {
      plugin_id,
      depends_on_plugin_id,
      min_version,
      max_version,
      is_optional = false,
    } = req.body;

    if (!plugin_id || !depends_on_plugin_id) {
      throw Errors.badRequest('plugin_id and depends_on_plugin_id are required');
    }

    if (plugin_id === depends_on_plugin_id) {
      throw Errors.badRequest('A plugin cannot depend on itself');
    }

    const pluginCheck = await dbClient.query('SELECT id FROM plugins WHERE id = ANY($1::uuid[])', [
      [plugin_id, depends_on_plugin_id],
    ]);

    if (pluginCheck.rows.length < 2) {
      throw Errors.badRequest('One or both plugins not found');
    }

    try {
      const result = await dbClient.query(
        `
      INSERT INTO plugin_dependencies (
        plugin_id, depends_on_plugin_id, min_version, max_version, is_optional
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
        [plugin_id, depends_on_plugin_id, min_version || null, max_version || null, is_optional]
      );

      res.status(201).json({ success: true, data: result.rows[0] || null });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as Record<string, unknown>).code === '23505'
      ) {
        throw Errors.conflict('This dependency already exists');
      }
      throw error;
    }
  })
);

/**
 * PUT /api/v1/marketplace/dependencies/:id
 * Update a dependency (SUPERUSER only - version constraints, optional flag)
 */
router.put(
  '/:id',
  authMiddleware,
  requirePermission('MARKETPLACE', 'EDIT'),
  validate(updateMarketplaceDependencySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const id = req.params['id'] as string;
    const { min_version, max_version, is_optional } = req.body;

    const result = await dbClient.query(
      `
    UPDATE plugin_dependencies SET
      min_version = COALESCE($2, min_version),
      max_version = COALESCE($3, max_version),
      is_optional = COALESCE($4, is_optional)
    WHERE id = $1
    RETURNING *
  `,
      [id, min_version ?? null, max_version ?? null, is_optional ?? null]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Dependency', id);
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * DELETE /api/v1/marketplace/dependencies/:id
 * Remove a dependency (SUPERUSER only)
 */
router.delete(
  '/:id',
  authMiddleware,
  requirePermission('MARKETPLACE', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const id = req.params['id'] as string;

    const result = await dbClient.query(
      'DELETE FROM plugin_dependencies WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Dependency', id);
    }

    res.json({ success: true, message: 'Dependency removed' });
  })
);

/**
 * GET /api/v1/marketplace/dependencies/check/:pluginId
 * Check if all dependencies are satisfied for a plugin within a tenant
 * Query param: tenant_id (required)
 */
router.get(
  '/check/:pluginId',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const pluginId = req.params['pluginId'] as string;
    const { tenant_id } = req.query as Record<string, string>;

    if (!tenant_id) {
      throw Errors.badRequest('tenant_id query parameter is required');
    }

    const result = await dbClient.query(
      `
    SELECT
      d.id, d.depends_on_plugin_id, d.min_version, d.max_version, d.is_optional,
      p.name as depends_on_name, p.slug as depends_on_slug,
      pi.id as installation_id, pi.status as installation_status,
      pv.version as installed_version
    FROM plugin_dependencies d
    JOIN plugins p ON p.id = d.depends_on_plugin_id
    LEFT JOIN plugin_installations pi
      ON pi.plugin_id = d.depends_on_plugin_id
      AND pi.tenant_id = $2
      AND pi.status = 'active'
    LEFT JOIN plugin_versions pv ON pv.id = pi.plugin_version_id
    WHERE d.plugin_id = $1
    ORDER BY d.is_optional ASC, p.name ASC
  `,
      [pluginId, tenant_id as string]
    );

    const dependencies = result.rows.map((row) => ({
      ...row,
      satisfied: row.installation_id !== null,
    }));

    const allSatisfied = dependencies.filter((d) => !d.is_optional).every((d) => d.satisfied);

    res.json({
      success: true,
      data: {
        plugin_id: pluginId,
        tenant_id,
        all_required_satisfied: allSatisfied,
        dependencies,
      },
    });
  })
);

export default router;
