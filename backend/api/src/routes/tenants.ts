/**
 * Tenant routes
 * Full CRUD operations for tenant management
 * NOTE: Database tenants table columns:
 *   id, code, name, description, nace_code, region, status, employee_count,
 *   subscription_plan, created_at, updated_at, sap_company_code,
 *   industry_profile_id, industry_type, profile_id, annual_revenue_eur
 */

import { Router, Request, Response } from 'express';
// ADMIN-POOL: Tenant management is TENANT_OWNER-only cross-tenant operations
import { pool } from '../config/database.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { createAppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '@heuresys/shared';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import { createTenantSchema, updateTenantSchema } from '../schemas/tenants.js';
import { asyncHandler } from '../errors/middleware.js';
import { logger } from '../config/logger.js';
// NOTE on pool vs dbClient in this file:
// Tenant management routes are cross-tenant by design. They operate on ALL tenants
// (list, create, lookup by any code/id, update any tenant, activate/deactivate).
// Using dbClient with RLS would restrict visibility to a single tenant, breaking
// the admin functionality. pool is intentionally retained for all queries here.

const router = Router();

// Valid tenant statuses
const VALID_STATUSES = ['active', 'inactive', 'suspended', 'pending'] as const;
type TenantStatus = (typeof VALID_STATUSES)[number];

// Valid subscription plans
const VALID_PLANS = ['free', 'starter', 'professional', 'enterprise'] as const;
type SubscriptionPlan = (typeof VALID_PLANS)[number];

/**
 * GET /tenants
 * List all tenants (SUPERUSER or TENANT_OWNER only)
 */
// pool: cross-tenant by design — lists all tenants for admin dashboard
router.get(
  '/',
  authMiddleware,
  requirePermission('PLATFORM', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, plan, search, limit = 50, offset = 0 } = req.query as Record<string, string>;

    let query = `
      SELECT id, code, name, description, status, subscription_plan,
             industry_type, region,
             (SELECT COUNT(*) FROM employees e WHERE e.tenant_id = tenants.id AND e.is_active = true) as employee_count,
             (SELECT COUNT(*) FROM users u WHERE u.employee_id IN (SELECT e2.id FROM employees e2 WHERE e2.tenant_id = tenants.id)) as user_count,
             created_at, updated_at
      FROM tenants
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    // Filter by status
    if (status && VALID_STATUSES.includes(status as TenantStatus)) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status as string);
    }

    // Filter by subscription plan
    if (plan && VALID_PLANS.includes(plan as SubscriptionPlan)) {
      query += ` AND subscription_plan = $${paramIndex++}`;
      params.push(plan as string);
    }

    // Search by name or code
    if (search && typeof search === 'string') {
      query += ` AND (name ILIKE $${paramIndex} OR code ILIKE $${paramIndex})`;
      params.push(`%${escapeILIKE(search)}%`);
      paramIndex++;
    }

    query += ` ORDER BY name LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM tenants WHERE 1=1';
    const countParams: string[] = [];
    let countIndex = 1;

    if (status && VALID_STATUSES.includes(status as TenantStatus)) {
      countQuery += ` AND status = $${countIndex++}`;
      countParams.push(status as string);
    }
    if (plan && VALID_PLANS.includes(plan as SubscriptionPlan)) {
      countQuery += ` AND subscription_plan = $${countIndex++}`;
      countParams.push(plan as string);
    }
    if (search && typeof search === 'string') {
      countQuery += ` AND (name ILIKE $${countIndex} OR code ILIKE $${countIndex})`;
      countParams.push(`%${escapeILIKE(search)}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0]?.count, 10);

    res.json({
      success: true,
      data: result.rows,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        totalCount,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + result.rows.length < totalCount,
      },
    });
  })
);

/**
 * GET /tenants/meta/statuses
 * Get available tenant statuses
 */
router.get('/meta/statuses', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: VALID_STATUSES.map((status) => ({
      value: status,
      label: status.charAt(0).toUpperCase() + status.slice(1),
    })),
  });
});

/**
 * GET /tenants/meta/plans
 * Get available subscription plans
 */
router.get('/meta/plans', (_req: Request, res: Response) => {
  const planDescriptions: Record<
    SubscriptionPlan,
    { label: string; description: string; maxEmployees: number }
  > = {
    free: { label: 'Free', description: 'Basic features for small teams', maxEmployees: 10 },
    starter: { label: 'Starter', description: 'Essential HR tools', maxEmployees: 50 },
    professional: {
      label: 'Professional',
      description: 'Advanced features for growing companies',
      maxEmployees: 500,
    },
    enterprise: {
      label: 'Enterprise',
      description: 'Full platform with custom integrations',
      maxEmployees: -1,
    },
  };

  res.json({
    success: true,
    data: VALID_PLANS.map((plan) => ({
      value: plan,
      ...planDescriptions[plan],
    })),
  });
});

/**
 * GET /tenants/current
 * Get the current user's tenant configuration
 */
router.get(
  '/current',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      // SUPERUSER without tenant context — return platform-level info
      res.json({
        success: true,
        data: {
          id: null,
          name: 'Heuresys Platform',
          code: 'platform',
          status: 'active',
          role: authReq.user?.role || 'SUPERUSER',
        },
      });
      return;
    }

    const result = await pool.query(
      `SELECT id, code, name, description, status, subscription_plan,
              industry_type, region, settings,
              created_at, updated_at
       FROM tenants WHERE id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /tenants/:id
 * Get tenant by ID or code (TENANT_OWNER+ only)
 */
// pool: cross-tenant by design — lookup any tenant by ID or code
router.get(
  '/:identifier',
  authMiddleware,
  requirePermission('PLATFORM', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const identifier = req.params['identifier'] as string;

    // Check if identifier is UUID or code
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      identifier
    );

    const result = await pool.query(
      `SELECT id, code, name, description, nace_code, region, status,
              employee_count, subscription_plan, industry_type,
              annual_revenue_eur, sap_company_code, verified_website, tax_id,
              created_at, updated_at
       FROM tenants
       WHERE ${isUUID ? 'id' : 'code'} = $1`,
      [identifier]
    );

    if (result.rows.length === 0) {
      throw createAppError(`Tenant '${identifier}' not found`, 404, ErrorCodes.TENANT_NOT_FOUND);
    }

    res.json({
      success: true,
      data: result.rows[0] || null,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /tenants/:id/stats
 * Get tenant statistics (TENANT_OWNER+ only)
 */
// pool: cross-tenant by design — get stats for any tenant (admin view)
router.get(
  '/:identifier/stats',
  authMiddleware,
  requirePermission('PLATFORM', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const identifier = req.params['identifier'] as string;

    // First get the tenant
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      identifier
    );

    const tenantResult = await pool.query(
      `SELECT id, code, name FROM tenants WHERE ${isUUID ? 'id' : 'code'} = $1`,
      [identifier]
    );

    if (tenantResult.rows.length === 0) {
      throw createAppError(`Tenant '${identifier}' not found`, 404, ErrorCodes.TENANT_NOT_FOUND);
    }

    const tenantId = tenantResult.rows[0]?.id;

    // Get statistics
    const [employeeCount, orgUnitCount, locationCount, activeGoals, pendingReviews] =
      await Promise.all([
        pool.query('SELECT COUNT(*) FROM employees WHERE tenant_id = $1', [tenantId]),
        pool.query('SELECT COUNT(*) FROM org_units WHERE tenant_id = $1', [tenantId]),
        pool.query('SELECT COUNT(*) FROM locations WHERE tenant_id = $1', [tenantId]),
        pool.query("SELECT COUNT(*) FROM goals WHERE tenant_id = $1 AND status = 'active'", [
          tenantId,
        ]),
        pool.query(
          "SELECT COUNT(*) FROM performance_reviews WHERE tenant_id = $1 AND status = 'pending'",
          [tenantId]
        ),
      ]);

    res.json({
      success: true,
      data: {
        tenant: tenantResult.rows[0],
        stats: {
          employees: parseInt(employeeCount.rows[0]?.count, 10),
          departments: parseInt(orgUnitCount.rows[0]?.count, 10),
          locations: parseInt(locationCount.rows[0]?.count, 10),
          activeGoals: parseInt(activeGoals.rows[0]?.count, 10),
          pendingReviews: parseInt(pendingReviews.rows[0]?.count, 10),
        },
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

// ============================================================================
// PROTECTED ROUTES (require authentication)
// ============================================================================

/**
 * POST /tenants
 * Create a new tenant (SUPERUSER only)
 */
// pool: cross-tenant by design — creates new tenant record, checks for duplicate codes across all tenants
router.post(
  '/',
  authMiddleware,
  requirePermission('PLATFORM', 'CREATE'),
  validate(createTenantSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const {
      code,
      name,
      description,
      nace_code,
      region,
      status = 'pending',
      subscription_plan = 'free',
      industry_type,
      sap_company_code,
      annual_revenue_eur,
    } = req.body;

    // Validate required fields
    if (!code || !name) {
      throw createAppError('Code and name are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate code format (lowercase, alphanumeric with hyphens)
    if (!/^[a-z0-9-]+$/.test(code)) {
      throw createAppError(
        'Code must be lowercase alphanumeric with hyphens only',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Check for duplicate code
    const existingTenant = await pool.query('SELECT id FROM tenants WHERE code = $1', [code]);

    if (existingTenant.rows.length > 0) {
      throw createAppError(`Tenant with code '${code}' already exists`, 409, 'DUPLICATE_ENTRY');
    }

    // Validate status
    if (status && !VALID_STATUSES.includes(status as TenantStatus)) {
      throw createAppError(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Validate subscription plan
    if (subscription_plan && !VALID_PLANS.includes(subscription_plan as SubscriptionPlan)) {
      throw createAppError(
        `Invalid subscription plan. Must be one of: ${VALID_PLANS.join(', ')}`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const result = await pool.query(
      `INSERT INTO tenants (
          code, name, description, nace_code, region, status,
          subscription_plan, industry_type, sap_company_code,
          annual_revenue_eur, employee_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, NOW(), NOW())
        RETURNING id, code, name, description, nace_code, region, status,
                  subscription_plan, industry_type, sap_company_code,
                  annual_revenue_eur, employee_count, created_at, updated_at`,
      [
        code,
        name,
        description || null,
        nace_code || null,
        region || null,
        status,
        subscription_plan,
        industry_type || null,
        sap_company_code || null,
        annual_revenue_eur || null,
      ]
    );

    logger.info(`[Tenants] Tenant created: ${code} by user ${authReq.user.username}`);

    res.status(201).json({
      success: true,
      data: result.rows[0] || null,
      message: 'Tenant created successfully',
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * PATCH /tenants/:id
 * Update tenant (TENANT_OWNER or tenant ADMIN)
 */
// pool: cross-tenant by design — TENANT_OWNER can update any tenant, ADMIN can update own
router.patch(
  '/:identifier',
  authMiddleware,
  validate(updateTenantSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as unknown as AuthenticatedRequest;
    const identifier = req.params['identifier'] as string;

    // Check if identifier is UUID or code
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      identifier
    );

    // Get existing tenant
    const tenantResult = await pool.query(
      `SELECT id, code, name, description, nace_code, region, status,
              employee_count, subscription_plan, created_at, updated_at,
              sap_company_code, industry_profile_id, industry_type,
              profile_id, annual_revenue_eur, settings, tax_id,
              contact_email, contact_phone, address_street, address_city,
              address_postal_code, address_country, setup_completed,
              setup_completed_at, setup_step
       FROM tenants WHERE ${isUUID ? 'id' : 'code'} = $1`,
      [identifier]
    );

    if (tenantResult.rows.length === 0) {
      throw createAppError(`Tenant '${identifier}' not found`, 404, ErrorCodes.TENANT_NOT_FOUND);
    }

    const tenant = tenantResult.rows[0];

    // Check authorization: SUPERUSER can update any, TENANT_OWNER can update their own tenant
    const isSuperuser = authReq.user.role === 'SUPERUSER';
    const isOwnTenant = authReq.user.tenantId === tenant.id;

    if (!isSuperuser && !isOwnTenant) {
      throw createAppError('Not authorized to update this tenant', 403, ErrorCodes.FORBIDDEN);
    }

    // Fields that can be updated
    const {
      name,
      description,
      nace_code,
      region,
      status,
      subscription_plan,
      industry_type,
      sap_company_code,
      annual_revenue_eur,
      verified_website,
      tax_id,
    } = req.body;

    // Non-SUPERUSER cannot change status or subscription_plan
    if (!isSuperuser && (status !== undefined || subscription_plan !== undefined)) {
      throw createAppError(
        'Only SUPERUSER can change status or subscription plan',
        403,
        ErrorCodes.FORBIDDEN
      );
    }

    // Validate status if provided
    if (status !== undefined && !VALID_STATUSES.includes(status as TenantStatus)) {
      throw createAppError(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Validate subscription plan if provided
    if (
      subscription_plan !== undefined &&
      !VALID_PLANS.includes(subscription_plan as SubscriptionPlan)
    ) {
      throw createAppError(
        `Invalid subscription plan. Must be one of: ${VALID_PLANS.join(', ')}`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (nace_code !== undefined) {
      updates.push(`nace_code = $${paramIndex++}`);
      values.push(nace_code);
    }
    if (region !== undefined) {
      updates.push(`region = $${paramIndex++}`);
      values.push(region);
    }
    if (status !== undefined && isSuperuser) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (subscription_plan !== undefined && isSuperuser) {
      updates.push(`subscription_plan = $${paramIndex++}`);
      values.push(subscription_plan);
    }
    if (industry_type !== undefined) {
      updates.push(`industry_type = $${paramIndex++}`);
      values.push(industry_type);
    }
    if (sap_company_code !== undefined) {
      updates.push(`sap_company_code = $${paramIndex++}`);
      values.push(sap_company_code);
    }
    if (annual_revenue_eur !== undefined) {
      updates.push(`annual_revenue_eur = $${paramIndex++}`);
      values.push(annual_revenue_eur);
    }
    if (verified_website !== undefined) {
      updates.push(`verified_website = $${paramIndex++}`);
      values.push(verified_website === '' ? null : verified_website);
    }
    if (tax_id !== undefined) {
      updates.push(`tax_id = $${paramIndex++}`);
      values.push(tax_id === '' ? null : tax_id);
    }

    if (updates.length === 0) {
      throw createAppError('No valid fields to update', 400, ErrorCodes.VALIDATION_ERROR);
    }

    updates.push(`updated_at = NOW()`);
    values.push(tenant.id);

    const result = await pool.query(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, code, name, description, nace_code, region, status,
                   subscription_plan, industry_type, sap_company_code,
                   annual_revenue_eur, employee_count, verified_website, tax_id,
                   created_at, updated_at`,
      values
    );

    logger.info(`[Tenants] Tenant updated: ${tenant.code} by user ${authReq.user.username}`);

    res.json({
      success: true,
      data: result.rows[0] || null,
      message: 'Tenant updated successfully',
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * DELETE /tenants/:id
 * Deactivate tenant (SUPERUSER only) - sets status to 'inactive'
 * Note: We don't actually delete tenants, just deactivate them
 */
// pool: cross-tenant by design — deactivate/delete any tenant (SUPERUSER only)
router.delete(
  '/:identifier',
  authMiddleware,
  requirePermission('PLATFORM', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as unknown as AuthenticatedRequest;
    const identifier = req.params['identifier'] as string;
    const { permanent = false } = req.query as Record<string, string>;

    // Check if identifier is UUID or code
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      identifier
    );

    // Get existing tenant
    const tenantResult = await pool.query(
      `SELECT id, code, name, status FROM tenants WHERE ${isUUID ? 'id' : 'code'} = $1`,
      [identifier]
    );

    if (tenantResult.rows.length === 0) {
      throw createAppError(`Tenant '${identifier}' not found`, 404, ErrorCodes.TENANT_NOT_FOUND);
    }

    const tenant = tenantResult.rows[0];

    // Prevent deactivating the system tenant
    if (tenant.code === 'heuresys') {
      throw createAppError('Cannot deactivate the system tenant', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (permanent === 'true') {
      // Permanent deletion (dangerous!)
      // First check if tenant has any data
      const employeeCount = await pool.query(
        'SELECT COUNT(*) FROM employees WHERE tenant_id = $1',
        [tenant.id]
      );

      if (parseInt(employeeCount.rows[0].count, 10) > 0) {
        throw createAppError(
          'Cannot permanently delete tenant with existing employees. Deactivate instead.',
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }

      await pool.query('DELETE FROM tenants WHERE id = $1', [tenant.id]);

      logger.info(`[Tenants] Tenant DELETED: ${tenant.code} by user ${authReq.user.username}`);

      res.json({
        success: true,
        message: `Tenant '${tenant.code}' permanently deleted`,
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      // Soft delete - just deactivate
      await pool.query("UPDATE tenants SET status = 'inactive', updated_at = NOW() WHERE id = $1", [
        tenant.id,
      ]);

      logger.info(`[Tenants] Tenant deactivated: ${tenant.code} by user ${authReq.user.username}`);

      res.json({
        success: true,
        message: `Tenant '${tenant.code}' deactivated`,
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  })
);

/**
 * POST /tenants/:id/activate
 * Reactivate a deactivated tenant (SUPERUSER only)
 */
// pool: cross-tenant by design — activate any tenant (SUPERUSER only)
router.post(
  '/:identifier/activate',
  authMiddleware,
  requirePermission('PLATFORM', 'EDIT'),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as unknown as AuthenticatedRequest;
    const identifier = req.params['identifier'] as string;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      identifier
    );

    const tenantResult = await pool.query(
      `SELECT id, code, name, status FROM tenants WHERE ${isUUID ? 'id' : 'code'} = $1`,
      [identifier]
    );

    if (tenantResult.rows.length === 0) {
      throw createAppError(`Tenant '${identifier}' not found`, 404, ErrorCodes.TENANT_NOT_FOUND);
    }

    const tenant = tenantResult.rows[0];

    if (tenant.status === 'active') {
      throw createAppError('Tenant is already active', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await pool.query("UPDATE tenants SET status = 'active', updated_at = NOW() WHERE id = $1", [
      tenant.id,
    ]);

    logger.info(`[Tenants] Tenant activated: ${tenant.code} by user ${authReq.user.username}`);

    res.json({
      success: true,
      message: `Tenant '${tenant.code}' activated`,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

export default router;
