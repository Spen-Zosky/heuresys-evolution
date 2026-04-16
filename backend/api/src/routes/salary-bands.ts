/**
 * Salary Bands Routes
 * CRUD operations for salary bands
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import {
  createSalaryBandSchema,
  updateSalaryBandSchema,
} from '../schemas/compensation-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { cachedForTenant, CACHE_TTL } from '../services/cache.js';
import { buildMeta } from '../utils/pagination.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /salary-bands
 * List salary bands with pagination
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const limit = safeParseInt(req.query.limit as string, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset as string, { fallback: 0 });
    const activeOnly = req.query.active !== 'false';

    const whereClause = activeOnly ? 'AND sb.is_active = true' : '';

    const [countResult, dataResult] = await Promise.all([
      req.dbClient!.query(
        `SELECT COUNT(*) as total FROM salary_bands sb WHERE sb.tenant_id = $1 ${whereClause}`,
        [tenantId]
      ),
      req.dbClient!.query(
        `SELECT sb.id, sb.band_code, sb.band_name, sb.description, sb.job_level,
                sb.job_family, sb.currency, sb.min_salary, sb.mid_salary, sb.max_salary,
                sb.range_spread_percent, sb.geo_region, sb.is_active, sb.effective_from
         FROM salary_bands sb
         WHERE sb.tenant_id = $1 ${whereClause}
         ORDER BY sb.job_level, sb.job_family
         LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset]
      ),
    ]);

    res.json({
      success: true,
      data: dataResult.rows,
      meta: buildMeta(parseInt(countResult.rows[0]?.total), limit, offset),
    });
  })
);

/**
 * GET /salary-bands/stats
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(DISTINCT job_level) as job_levels,
        COUNT(DISTINCT job_family) as job_families,
        ROUND(AVG(min_salary), 0) as avg_min_salary,
        ROUND(AVG(max_salary), 0) as avg_max_salary,
        ROUND(AVG(range_spread_percent), 1) as avg_range_spread
      FROM salary_bands WHERE tenant_id = $1
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /salary-bands
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      job_level,
      job_family,
      is_active,
      geo_region,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;
    const limitNum = safeParseInt(limit as string, { fallback: 100 });
    const offsetNum = safeParseInt(offset as string, { fallback: 0 });
    const hasFilters = job_level || job_family || is_active !== undefined || geo_region;

    const fetchData = async () => {
      let query = `
        SELECT sb.*,
          (SELECT COUNT(*) FROM salary_band_assignments sba WHERE sba.band_id = sb.id) as assignment_count
        FROM salary_bands sb
        WHERE sb.tenant_id = $1
      `;
      const params: (string | boolean | number)[] = [tenantId];
      let paramIndex = 2;

      if (job_level) {
        query += ` AND sb.job_level = $${paramIndex}`;
        params.push(job_level as string);
        paramIndex++;
      }

      if (job_family) {
        query += ` AND sb.job_family = $${paramIndex}`;
        params.push(job_family as string);
        paramIndex++;
      }

      if (is_active !== undefined) {
        query += ` AND sb.is_active = $${paramIndex}`;
        params.push(is_active === 'true');
        paramIndex++;
      }

      if (geo_region) {
        query += ` AND sb.geo_region = $${paramIndex}`;
        params.push(geo_region as string);
        paramIndex++;
      }

      query += ` ORDER BY sb.job_level, sb.job_family, sb.band_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limitNum, offsetNum);

      const result = await req.dbClient!.query(query, params);
      const countResult = await req.dbClient!.query(
        'SELECT COUNT(*) FROM salary_bands WHERE tenant_id = $1',
        [tenantId]
      );

      return {
        rows: result.rows,
        total: parseInt(countResult.rows[0]?.count),
      };
    };

    const data = hasFilters
      ? await fetchData()
      : await cachedForTenant(
          tenantId,
          `salary-bands:list:${limitNum}:${offsetNum}`,
          fetchData,
          CACHE_TTL.MODERATE
        );

    res.json({
      success: true,
      data: data.rows,
      meta: {
        total: data.total,
        limit: limitNum,
        offset: offsetNum,
      },
    });
  })
);

/**
 * GET /salary-bands/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT sb.*,
        (SELECT COUNT(*) FROM salary_band_assignments sba WHERE sba.band_id = sb.id) as assignment_count
      FROM salary_bands sb
      WHERE sb.id = $1 AND sb.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Salary band');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /salary-bands
 */
router.post(
  '/',
  requirePermission('COMPENSATION', 'CREATE'),
  validate(createSalaryBandSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      band_code,
      band_name,
      description,
      job_level,
      job_family,
      currency = 'EUR',
      min_salary,
      mid_salary,
      max_salary,
      range_spread_percent,
      geo_region,
      geo_adjustment_percent,
      effective_from,
      effective_to,
      is_active = true,
      created_by,
    } = req.body;

    if (!band_name || !min_salary || !max_salary) {
      res
        .status(400)
        .json({ success: false, error: 'band_name, min_salary, and max_salary are required' });
      return;
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO salary_bands (tenant_id, band_code, band_name, description, job_level, job_family, currency,
        min_salary, mid_salary, max_salary, range_spread_percent, geo_region, geo_adjustment_percent,
        effective_from, effective_to, is_active, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
      RETURNING *
    `,
      [
        tenantId,
        band_code,
        band_name,
        description,
        job_level,
        job_family,
        currency,
        min_salary,
        mid_salary,
        max_salary,
        range_spread_percent,
        geo_region,
        geo_adjustment_percent,
        effective_from,
        effective_to,
        is_active,
        created_by,
      ]
    );

    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Salary band created' });
  })
);

/**
 * PATCH /salary-bands/:id
 */
router.patch(
  '/:id',
  requirePermission('COMPENSATION', 'EDIT'),
  validate(updateSalaryBandSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM salary_bands WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Salary band');
    }

    const allowedFields = [
      'band_code',
      'band_name',
      'description',
      'job_level',
      'job_family',
      'currency',
      'min_salary',
      'mid_salary',
      'max_salary',
      'range_spread_percent',
      'geo_region',
      'geo_adjustment_percent',
      'effective_from',
      'effective_to',
      'is_active',
    ];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      throw Errors.badRequest('No fields to update');
    }

    updates.push('updated_at = NOW()');

    const result = await req.dbClient!.query(
      `UPDATE salary_bands SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Salary band updated' });
  })
);

/**
 * DELETE /salary-bands/:id
 */
router.delete(
  '/:id',
  requirePermission('COMPENSATION', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      'UPDATE salary_bands SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Salary band');
    }

    res.json({ success: true, message: 'Salary band deactivated' });
  })
);

export default router;
