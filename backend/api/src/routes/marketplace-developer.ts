/**
 * Marketplace Developer Portal Routes
 * Developer-facing routes for managing plugins, versions, API keys.
 * All routes require tenant context and ADMIN role.
 * Ownership enforced via publisher_tenant_id.
 *
 * DB tables: plugins, plugin_versions, plugin_categories, plugin_api_keys, plugin_reviews
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { type AuthenticatedRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { generateApiKey } from '../middleware/apiKeyAuth.js';
import { validate } from '../middleware/validate.js';
import {
  createDeveloperPluginSchema,
  updateDeveloperPluginSchema,
  createPluginVersionSchema,
  createApiKeySchema,
} from '../schemas/marketplace.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

// All routes require tenant context and TENANT_OWNER role
router.use(requireTenant);
router.use(requirePermission('MARKETPLACE', 'VIEW'));

/**
 * GET /stats
 * Developer stats for own plugins
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total_plugins,
        COUNT(*) FILTER (WHERE status = 'draft') as drafts,
        COUNT(*) FILTER (WHERE status = 'pending_review') as pending_review,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended,
        COALESCE(SUM(total_installations), 0) as total_installations,
        ROUND(AVG(avg_rating) FILTER (WHERE avg_rating > 0), 2) as avg_rating
      FROM plugins
      WHERE publisher_tenant_id = $1
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /plugins
 * List own plugins with pagination and optional status filter
 */
router.get(
  '/plugins',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, limit = '20', offset = '0' } = req.query as Record<string, string>;

    let query = `
      SELECT
        p.id, p.name, p.slug, p.short_description, p.status, p.visibility,
        p.pricing_model, p.price_cents, p.currency, p.icon_url,
        p.total_installations, p.avg_rating, p.total_ratings,
        p.tags, p.featured, p.created_at, p.updated_at,
        p.screenshot_urls, p.banner_url,
        pc.name as category_name, pc.slug as category_slug,
        pv.version as latest_version, pv.published_at as latest_version_date
      FROM plugins p
      LEFT JOIN plugin_categories pc ON pc.id = p.category_id
      LEFT JOIN plugin_versions pv ON pv.plugin_id = p.id AND pv.is_latest = true
      WHERE p.publisher_tenant_id = $1
    `;
    const params: (string | number)[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    query += ` ORDER BY p.updated_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 50 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);

    const countParams: (string | number)[] = [tenantId];
    let countQuery = `SELECT COUNT(*) FROM plugins WHERE publisher_tenant_id = $1`;
    if (status) {
      countQuery += ` AND status = $2`;
      countParams.push(status as string);
    }
    const countResult = await req.dbClient!.query(countQuery, countParams);

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: parseInt(countResult.rows[0]?.count),
        limit: safeParseInt(limit as string, { fallback: 50 }),
        offset: safeParseInt(offset as string, { fallback: 0 }),
      },
    });
  })
);

/**
 * GET /plugins/:id
 * Single plugin detail with ownership check
 */
router.get(
  '/plugins/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT
        p.*,
        pc.name as category_name, pc.slug as category_slug,
        pv.version as latest_version, pv.published_at as latest_version_date,
        pv.config_schema, pv.permissions_required
      FROM plugins p
      LEFT JOIN plugin_categories pc ON pc.id = p.category_id
      LEFT JOIN plugin_versions pv ON pv.plugin_id = p.id AND pv.is_latest = true
      WHERE p.id = $1 AND p.publisher_tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Plugin');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /plugins
 * Create a new plugin (status=draft)
 */
router.post(
  '/plugins',
  validate(createDeveloperPluginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      name,
      slug,
      short_description,
      description,
      category_id,
      pricing_model = 'free',
      price_cents,
      currency = 'EUR',
      tags,
      icon_url,
      homepage_url,
      repository_url,
      license,
      screenshot_urls,
      banner_url,
    } = req.body;

    if (!name) {
      throw Errors.badRequest('name is required');
    }

    const pluginSlug =
      slug ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 200);

    // Check duplicate slug
    const existing = await req.dbClient!.query('SELECT id FROM plugins WHERE slug = $1', [
      pluginSlug,
    ]);
    if (existing.rows.length > 0) {
      throw Errors.conflict('A plugin with this slug already exists');
    }

    // Get tenant name for publisher_name
    const tenantResult = await req.dbClient!.query('SELECT name FROM tenants WHERE id = $1', [
      tenantId,
    ]);
    const publisherName = tenantResult.rows.length > 0 ? tenantResult.rows[0]?.name : 'Unknown';

    const result = await req.dbClient!.query(
      `
      INSERT INTO plugins (
        name, slug, short_description, description, category_id,
        publisher_tenant_id, publisher_name, icon_url, homepage_url,
        repository_url, license, pricing_model, price_cents, currency,
        tags, status, screenshot_urls, banner_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'draft', $16, $17)
      RETURNING *
    `,
      [
        name,
        pluginSlug,
        short_description || null,
        description || null,
        category_id || null,
        tenantId,
        publisherName,
        icon_url || null,
        homepage_url || null,
        repository_url || null,
        license || 'proprietary',
        pricing_model,
        price_cents || 0,
        currency,
        tags || '{}',
        screenshot_urls || '{}',
        banner_url || null,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * PUT /plugins/:id
 * Update own plugin (COALESCE pattern)
 */
router.put(
  '/plugins/:id',
  validate(updateDeveloperPluginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    // Verify ownership
    const existing = await req.dbClient!.query(
      'SELECT id FROM plugins WHERE id = $1 AND publisher_tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Plugin');
    }

    const {
      name,
      short_description,
      description,
      category_id,
      pricing_model,
      price_cents,
      currency,
      tags,
      icon_url,
      homepage_url,
      repository_url,
      license,
      visibility,
      screenshot_urls,
      banner_url,
    } = req.body;

    const result = await req.dbClient!.query(
      `
      UPDATE plugins SET
        name = COALESCE($3, name),
        short_description = COALESCE($4, short_description),
        description = COALESCE($5, description),
        category_id = COALESCE($6, category_id),
        pricing_model = COALESCE($7, pricing_model),
        price_cents = COALESCE($8, price_cents),
        currency = COALESCE($9, currency),
        tags = COALESCE($10, tags),
        icon_url = COALESCE($11, icon_url),
        homepage_url = COALESCE($12, homepage_url),
        repository_url = COALESCE($13, repository_url),
        license = COALESCE($14, license),
        visibility = COALESCE($15, visibility),
        screenshot_urls = COALESCE($16, screenshot_urls),
        banner_url = COALESCE($17, banner_url),
        updated_at = NOW()
      WHERE id = $1 AND publisher_tenant_id = $2
      RETURNING *
    `,
      [
        id,
        tenantId,
        name || null,
        short_description || null,
        description || null,
        category_id || null,
        pricing_model || null,
        price_cents ?? null,
        currency || null,
        tags || null,
        icon_url || null,
        homepage_url || null,
        repository_url || null,
        license || null,
        visibility || null,
        screenshot_urls || null,
        banner_url || null,
      ]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * DELETE /plugins/:id
 * Delete own plugin only if status=draft AND total_installations=0
 */
router.delete(
  '/plugins/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id, status, total_installations FROM plugins WHERE id = $1 AND publisher_tenant_id = $2',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      throw Errors.notFound('Plugin');
    }

    const plugin = existing.rows[0];
    if (plugin.status !== 'draft') {
      throw Errors.badRequest('Only draft plugins can be deleted');
    }
    if (plugin.total_installations > 0) {
      throw Errors.badRequest('Cannot delete plugin with installations');
    }

    await req.dbClient!.query('DELETE FROM plugins WHERE id = $1', [id]);
    res.json({ success: true, message: 'Plugin deleted' });
  })
);

/**
 * PATCH /plugins/:id/submit
 * Submit plugin for review (draft -> pending_review)
 */
router.patch(
  '/plugins/:id/submit',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      UPDATE plugins
      SET status = 'pending_review', updated_at = NOW()
      WHERE id = $1 AND publisher_tenant_id = $2 AND status = 'draft'
      RETURNING id, name, status
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Plugin');
    }

    res.json({
      success: true,
      data: result.rows[0] || null,
      message: 'Plugin submitted for review',
    });
  })
);

/**
 * POST /plugins/:id/versions
 * Create a new version for own plugin
 */
router.post(
  '/plugins/:id/versions',
  validate(createPluginVersionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const pluginId = req.params['id'] as string;

    // Verify ownership
    const pluginCheck = await req.dbClient!.query(
      'SELECT id FROM plugins WHERE id = $1 AND publisher_tenant_id = $2',
      [pluginId, tenantId]
    );
    if (pluginCheck.rows.length === 0) {
      throw Errors.notFound('Plugin');
    }

    const { version, release_notes, changelog, config_schema, permissions_required, entry_point } =
      req.body;

    if (!version) {
      throw Errors.badRequest('version is required');
    }

    // Unmark current latest
    await req.dbClient!.query(
      'UPDATE plugin_versions SET is_latest = false WHERE plugin_id = $1 AND is_latest = true',
      [pluginId]
    );

    const result = await req.dbClient!.query(
      `
      INSERT INTO plugin_versions (
        plugin_id, version, release_notes, changelog, config_schema,
        permissions_required, entry_point, status, is_latest, published_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', true, NOW())
      RETURNING *
    `,
      [
        pluginId,
        version,
        release_notes || null,
        changelog || null,
        config_schema ? JSON.stringify(config_schema) : '{}',
        permissions_required || '{}',
        entry_point || null,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /plugins/:id/versions
 * List versions for own plugin
 */
router.get(
  '/plugins/:id/versions',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const pluginId = req.params['id'] as string;

    // Verify ownership
    const pluginCheck = await req.dbClient!.query(
      'SELECT id FROM plugins WHERE id = $1 AND publisher_tenant_id = $2',
      [pluginId, tenantId]
    );
    if (pluginCheck.rows.length === 0) {
      throw Errors.notFound('Plugin');
    }

    const result = await req.dbClient!.query(
      'SELECT id, plugin_id, version, release_notes, changelog, min_platform_version, max_platform_version, config_schema, permissions_required, entry_point, package_url, package_size_bytes, checksum, status, is_latest, published_at, created_at, updated_at FROM plugin_versions WHERE plugin_id = $1 ORDER BY created_at DESC LIMIT 50',
      [pluginId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * PATCH /plugins/:id/versions/:versionId/yank
 * Yank a version. If it was is_latest, mark next most recent published as latest.
 */
router.patch(
  '/plugins/:id/versions/:versionId/yank',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const pluginId = req.params['id'] as string;
    const versionId = req.params['versionId'] as string;

    // Verify ownership
    const pluginCheck = await req.dbClient!.query(
      'SELECT id FROM plugins WHERE id = $1 AND publisher_tenant_id = $2',
      [pluginId, tenantId]
    );
    if (pluginCheck.rows.length === 0) {
      throw Errors.notFound('Plugin');
    }

    const versionResult = await req.dbClient!.query(
      'SELECT id, is_latest FROM plugin_versions WHERE id = $1 AND plugin_id = $2',
      [versionId, pluginId]
    );
    if (versionResult.rows.length === 0) {
      throw Errors.notFound('Version');
    }

    const wasLatest = versionResult.rows[0]?.is_latest;

    // Yank the version
    await req.dbClient!.query(
      "UPDATE plugin_versions SET status = 'yanked', is_latest = false, updated_at = NOW() WHERE id = $1",
      [versionId]
    );

    // If it was latest, promote the next most recent published version
    if (wasLatest) {
      await req.dbClient!.query(
        `
        UPDATE plugin_versions SET is_latest = true, updated_at = NOW()
        WHERE id = (
          SELECT id FROM plugin_versions
          WHERE plugin_id = $1 AND status = 'published' AND id != $2
          ORDER BY created_at DESC
          LIMIT 1
        )
      `,
        [pluginId, versionId]
      );
    }

    res.json({ success: true, message: 'Version yanked' });
  })
);

/**
 * GET /plugins/:id/reviews
 * Read-only reviews for own plugin with summary
 */
router.get(
  '/plugins/:id/reviews',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const pluginId = req.params['id'] as string;
    const { limit = '20', offset = '0' } = req.query as Record<string, string>;

    // Verify ownership
    const pluginCheck = await req.dbClient!.query(
      'SELECT id FROM plugins WHERE id = $1 AND publisher_tenant_id = $2',
      [pluginId, tenantId]
    );
    if (pluginCheck.rows.length === 0) {
      throw Errors.notFound('Plugin');
    }

    const reviews = await req.dbClient!.query(
      `
      SELECT
        r.id, r.rating, r.title, r.review_text, r.is_verified_install,
        r.helpful_count, r.status, r.created_at
      FROM plugin_reviews r
      WHERE r.plugin_id = $1 AND r.status = 'published'
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [
        pluginId,
        safeParseInt(limit as string, { fallback: 50 }),
        safeParseInt(offset as string, { fallback: 0 }),
      ]
    );

    const summary = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total_reviews,
        ROUND(AVG(rating), 2) as avg_rating,
        COUNT(*) FILTER (WHERE rating = 5) as five_star,
        COUNT(*) FILTER (WHERE rating = 4) as four_star,
        COUNT(*) FILTER (WHERE rating = 3) as three_star,
        COUNT(*) FILTER (WHERE rating = 2) as two_star,
        COUNT(*) FILTER (WHERE rating = 1) as one_star
      FROM plugin_reviews
      WHERE plugin_id = $1 AND status = 'published'
    `,
      [pluginId]
    );

    res.json({
      success: true,
      data: {
        reviews: reviews.rows,
        summary: summary.rows[0],
      },
      meta: {
        total: parseInt(summary.rows[0]?.total_reviews),
        limit: safeParseInt(limit as string, { fallback: 50 }),
        offset: safeParseInt(offset as string, { fallback: 0 }),
      },
    });
  })
);

/**
 * POST /api-keys
 * Generate a new API key for a plugin installation
 */
router.post(
  '/api-keys',
  validate(createApiKeySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.userId;

    const { name, plugin_installation_id, scopes, expires_in_days } = req.body;

    if (!name) {
      throw Errors.badRequest('name is required');
    }

    // If installation ID provided, verify it belongs to tenant
    if (plugin_installation_id) {
      const installCheck = await req.dbClient!.query(
        'SELECT id FROM plugin_installations WHERE id = $1 AND tenant_id = $2',
        [plugin_installation_id, tenantId]
      );
      if (installCheck.rows.length === 0) {
        throw Errors.notFound('Plugin installation');
      }
    }

    const { raw, hash, prefix } = generateApiKey();

    let expiresAt: string | null = null;
    if (expires_in_days) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(expires_in_days as string));
      expiresAt = d.toISOString();
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO plugin_api_keys (
        tenant_id, plugin_installation_id, name, key_hash, key_prefix,
        scopes, expires_at, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, key_prefix, scopes, expires_at, created_at
    `,
      [tenantId, plugin_installation_id, name, hash, prefix, scopes || '{}', expiresAt, userId]
    );

    // Return raw key only once
    const data = { ...(result.rows[0] || {}), key: raw };
    res.status(201).json({ success: true, data });
  })
);

/**
 * GET /api-keys
 * List API keys for the current user
 */
router.get(
  '/api-keys',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.userId;

    const result = await req.dbClient!.query(
      `
      SELECT id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at
      FROM plugin_api_keys
      WHERE tenant_id = $1 AND created_by = $2
      ORDER BY created_at DESC
    `,
      [tenantId, userId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * DELETE /api-keys/:keyId
 * Revoke an API key (set revoked_at)
 */
router.delete(
  '/api-keys/:keyId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.userId;
    const keyId = req.params['keyId'] as string;

    const result = await req.dbClient!.query(
      `
      UPDATE plugin_api_keys
      SET revoked_at = NOW(), is_active = false
      WHERE id = $1 AND tenant_id = $2 AND created_by = $3 AND revoked_at IS NULL
      RETURNING id
    `,
      [keyId, tenantId, userId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('API key');
    }

    res.json({ success: true, message: 'API key revoked' });
  })
);

export default router;
