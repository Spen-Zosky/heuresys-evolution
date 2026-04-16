/**
 * Locations Routes
 * CRUD operations for locations within tenant context
 * NOTE: Schema - locations table columns:
 *   id, tenant_id, code, name, location_type, address, city, province,
 *   postal_code, country, latitude, longitude, phone, email, is_active,
 *   capacity_headcount, square_meters, opening_date, closing_date
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import { createLocationSchema, updateLocationSchema } from '../schemas/employees.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { cachedForTenant, invalidateCachePattern, CACHE_TTL } from '../services/cache.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /locations
 * List all locations for the current tenant
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      is_active,
      location_type,
      city,
      search,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;
    const limitNum = safeParseInt(limit as string, { fallback: 100 });
    const offsetNum = safeParseInt(offset as string, { fallback: 0 });

    const hasFilters = is_active !== undefined || location_type || city || search;

    const fetchData = async () => {
      let query = `
        SELECT
          l.id, l.code, l.name, l.location_type, l.address, l.city, l.province,
          l.postal_code, l.country, l.latitude, l.longitude, l.phone, l.email,
          l.is_active, l.capacity_headcount, l.square_meters, l.opening_date, l.closing_date,
          l.created_at, l.updated_at,
          (SELECT COUNT(*) FROM employees e WHERE e.location_id = l.id AND e.is_active = true) as employee_count,
          (SELECT COUNT(DISTINCT e.org_unit_id) FROM employees e WHERE e.location_id = l.id AND e.is_active = true AND e.org_unit_id IS NOT NULL) as org_unit_count
        FROM locations l
        WHERE l.tenant_id = $1
      `;
      const params: (string | boolean | number)[] = [tenantId];
      let paramIndex = 2;

      if (is_active !== undefined) {
        query += ` AND l.is_active = $${paramIndex}`;
        params.push(is_active === 'true');
        paramIndex++;
      }

      if (location_type) {
        query += ` AND l.location_type = $${paramIndex}`;
        params.push(location_type as string);
        paramIndex++;
      }

      if (city) {
        query += ` AND l.city ILIKE $${paramIndex}`;
        params.push(`%${escapeILIKE(city as string)}%`);
        paramIndex++;
      }

      if (search) {
        query += ` AND (l.name ILIKE $${paramIndex} OR l.code ILIKE $${paramIndex} OR l.city ILIKE $${paramIndex})`;
        params.push(`%${escapeILIKE(search as string)}%`);
        paramIndex++;
      }

      query += ` ORDER BY l.name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limitNum, offsetNum);

      const result = await req.dbClient!.query(query, params);

      const countResult = await req.dbClient!.query(
        'SELECT COUNT(*) FROM locations WHERE tenant_id = $1',
        [tenantId]
      );

      return {
        success: true,
        data: result.rows,
        meta: {
          total: parseInt(countResult.rows[0]?.count),
          limit: limitNum,
          offset: offsetNum,
        },
      };
    };

    const responseData = hasFilters
      ? await fetchData()
      : await cachedForTenant(
          tenantId,
          `locations:list:${limitNum}:${offsetNum}`,
          fetchData,
          CACHE_TTL.REFERENCE
        );

    res.json(responseData);
  })
);

/**
 * GET /locations/types
 * Get location types in use
 */
router.get(
  '/types',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient!.query(
      'SELECT DISTINCT location_type FROM locations WHERE tenant_id = $1 AND location_type IS NOT NULL ORDER BY location_type LIMIT 100',
      [tenantId]
    );
    res.json({ success: true, data: result.rows.map((r) => r.location_type) });
  })
);

/**
 * GET /locations/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `SELECT l.*,
        (SELECT COUNT(*) FROM employees e WHERE e.location_id = l.id AND e.is_active = true) as employee_count,
        (SELECT COUNT(DISTINCT e.org_unit_id) FROM employees e WHERE e.location_id = l.id AND e.is_active = true AND e.org_unit_id IS NOT NULL) as org_unit_count
       FROM locations l WHERE l.id = $1 AND l.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      res
        .status(404)
        .json({ success: false, error: 'Location not found', code: 'LOCATION_NOT_FOUND' });
      return;
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /locations
 */
router.post(
  '/',
  requirePermission('ORGANIZATION', 'CREATE'),
  validate(createLocationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      code,
      name,
      location_type,
      address,
      city,
      province,
      postal_code,
      country,
      latitude,
      longitude,
      phone,
      email,
      capacity_headcount,
      square_meters,
      opening_date,
    } = req.body;

    if (!code || !name) {
      res
        .status(400)
        .json({ success: false, error: 'Code and name are required', code: 'VALIDATION_ERROR' });
      return;
    }

    const existing = await req.dbClient!.query(
      'SELECT id FROM locations WHERE code = $1 AND tenant_id = $2',
      [code, tenantId]
    );
    if (existing.rows.length > 0) {
      res
        .status(409)
        .json({ success: false, error: 'Location code already exists', code: 'DUPLICATE_CODE' });
      return;
    }

    const result = await req.dbClient!.query(
      `INSERT INTO locations (tenant_id, code, name, location_type, address, city, province, postal_code, country,
         latitude, longitude, phone, email, capacity_headcount, square_meters, opening_date, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, NOW(), NOW())
       RETURNING *`,
      [
        tenantId,
        code,
        name,
        location_type,
        address,
        city,
        province,
        postal_code,
        country,
        latitude,
        longitude,
        phone,
        email,
        capacity_headcount,
        square_meters,
        opening_date,
      ]
    );

    await invalidateCachePattern(`t:${tenantId}:locations:*`);
    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Location created' });
  })
);

/**
 * PATCH /locations/:id
 */
router.patch(
  '/:id',
  requirePermission('ORGANIZATION', 'EDIT'),
  validate(updateLocationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM locations WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      res
        .status(404)
        .json({ success: false, error: 'Location not found', code: 'LOCATION_NOT_FOUND' });
      return;
    }

    const allowedFields = [
      'name',
      'location_type',
      'address',
      'city',
      'province',
      'postal_code',
      'country',
      'latitude',
      'longitude',
      'phone',
      'email',
      'capacity_headcount',
      'square_meters',
      'opening_date',
      'closing_date',
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
      res
        .status(400)
        .json({ success: false, error: 'No fields to update', code: 'VALIDATION_ERROR' });
      return;
    }

    updates.push('updated_at = NOW()');

    const result = await req.dbClient!.query(
      `UPDATE locations SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    await invalidateCachePattern(`t:${tenantId}:locations:*`);
    res.json({ success: true, data: result.rows[0] || null, message: 'Location updated' });
  })
);

/**
 * DELETE /locations/:id
 */
router.delete(
  '/:id',
  requirePermission('ORGANIZATION', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const hard = req.query['hard'] === 'true';

    const existing = await req.dbClient!.query(
      'SELECT id, name FROM locations WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      res
        .status(404)
        .json({ success: false, error: 'Location not found', code: 'LOCATION_NOT_FOUND' });
      return;
    }

    const employeeCount = await req.dbClient!.query(
      'SELECT COUNT(*) FROM employees WHERE location_id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (parseInt(employeeCount.rows[0].count) > 0) {
      throw Errors.badRequest('Cannot delete location with assigned employees');
    }

    if (hard) {
      await req.dbClient!.query('DELETE FROM locations WHERE id = $1 AND tenant_id = $2', [
        id,
        tenantId,
      ]);
      await invalidateCachePattern(`t:${tenantId}:locations:*`);
      res.json({ success: true, message: `Location '${existing.rows[0]?.name}' deleted` });
    } else {
      await req.dbClient!.query(
        'UPDATE locations SET is_active = false, closing_date = CURRENT_DATE, updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      await invalidateCachePattern(`t:${tenantId}:locations:*`);
      res.json({ success: true, message: `Location '${existing.rows[0]?.name}' deactivated` });
    }
  })
);

/**
 * GET /locations/:id/employees
 */
router.get(
  '/:id/employees',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `SELECT id, first_name, last_name, email, job_title, department, hire_date, is_active
       FROM employees WHERE location_id = $1 AND tenant_id = $2 ORDER BY last_name, first_name`,
      [id, tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

export default router;
