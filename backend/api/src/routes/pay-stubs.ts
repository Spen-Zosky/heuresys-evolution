/**
 * Pay Stubs Routes
 * Employee pay stub management and retrieval
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createPayStubSchema, updatePayStubSchema } from '../schemas/compensation-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

// =============================================================================
// EMPLOYEE SELF-SERVICE ENDPOINTS (must be before parametric routes)
// =============================================================================

/**
 * GET /pay-stubs/me
 * Get current employee's pay stubs
 */
router.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user?.employeeId;

    if (!employeeId) {
      throw Errors.unauthorized('No employee profile linked to this user');
    }

    const { year, limit = '12' } = req.query as Record<string, string>;
    const yearFilter = year ? parseInt(year as string) : new Date().getFullYear();

    const result = await req.dbClient!.query(
      `
      SELECT
        ps.id,
        ps.period,
        ps.period_start,
        ps.period_end,
        ps.gross_pay,
        ps.net_pay,
        ps.deductions,
        ps.payment_date,
        ps.status,
        ps.created_at
      FROM employee_pay_stubs ps
      JOIN employees e ON e.id = ps.employee_id
      WHERE ps.employee_id = $1 AND e.tenant_id = $2
      AND EXTRACT(YEAR FROM ps.period_start) = $3
      ORDER BY ps.period_start DESC
      LIMIT $4
    `,
      [employeeId, tenantId, yearFilter, safeParseInt(limit as string, { fallback: 50 })]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { year: yearFilter, count: result.rows.length },
    });
  })
);

/**
 * GET /pay-stubs/me/latest
 * Get current employee's latest pay stub with full breakdown
 */
router.get(
  '/me/latest',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user?.employeeId;

    if (!employeeId) {
      throw Errors.unauthorized('No employee profile linked to this user');
    }

    const result = await req.dbClient!.query(
      `
      SELECT
        ps.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.pernr as employee_number,
        e.job_title,
        d.name as department
      FROM employee_pay_stubs ps
      JOIN employees e ON e.id = ps.employee_id
      LEFT JOIN org_units d ON d.id = e.org_unit_id
      WHERE ps.employee_id = $1 AND e.tenant_id = $2
      ORDER BY ps.period_start DESC
      LIMIT 1
    `,
      [employeeId, tenantId]
    );

    if (result.rows.length === 0) {
      res.json({ success: true, data: null, message: 'No pay stubs found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /pay-stubs/me/summary
 * Get current employee's annual pay summary
 */
router.get(
  '/me/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user?.employeeId;

    if (!employeeId) {
      throw Errors.unauthorized('No employee profile linked to this user');
    }

    const { year } = req.query as Record<string, string>;
    const yearFilter = year ? parseInt(year as string) : new Date().getFullYear();

    const result = await req.dbClient!.query(
      `
      SELECT
        EXTRACT(YEAR FROM ps.period_start)::int as year,
        COUNT(*) as pay_periods,
        SUM(ps.gross_pay) as total_gross,
        SUM(ps.net_pay) as total_net,
        AVG(ps.gross_pay) as avg_gross,
        AVG(ps.net_pay) as avg_net,
        MIN(ps.period_start) as first_period,
        MAX(ps.period_start) as last_period
      FROM employee_pay_stubs ps
      JOIN employees e ON e.id = ps.employee_id
      WHERE ps.employee_id = $1 AND e.tenant_id = $2
      AND EXTRACT(YEAR FROM ps.period_start) = $3
      GROUP BY EXTRACT(YEAR FROM ps.period_start)
    `,
      [employeeId, tenantId, yearFilter]
    );

    if (result.rows.length === 0) {
      res.json({
        success: true,
        data: {
          year: yearFilter,
          pay_periods: 0,
          total_gross: 0,
          total_net: 0,
          avg_gross: 0,
          avg_net: 0,
        },
      });
      return;
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

/**
 * GET /pay-stubs
 * List pay stubs with optional filters
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      employee_id,
      period,
      status,
      year,
      limit = '50',
      offset = '0',
    } = req.query as Record<string, string>;

    let query = `
      SELECT
        ps.id,
        ps.employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        ps.period,
        ps.period_start,
        ps.period_end,
        ps.gross_pay,
        ps.net_pay,
        ps.deductions,
        ps.payment_date,
        ps.status,
        ps.created_at
      FROM employee_pay_stubs ps
      JOIN employees e ON e.id = ps.employee_id
      WHERE e.tenant_id = $1
    `;
    const params: (string | number)[] = [tenantId];
    let paramIndex = 2;

    if (employee_id) {
      query += ` AND ps.employee_id = $${paramIndex++}`;
      params.push(employee_id as string);
    }
    if (period) {
      query += ` AND ps.period = $${paramIndex++}`;
      params.push(period as string);
    }
    if (status) {
      query += ` AND ps.status = $${paramIndex++}`;
      params.push(status as string);
    }
    if (year) {
      query += ` AND EXTRACT(YEAR FROM ps.period_start) = $${paramIndex++}`;
      params.push(parseInt(year as string));
    }

    query += ` ORDER BY ps.period_start DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(
      safeParseInt(limit as string, { fallback: 50 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);

    // Get count for pagination
    let countQuery = `
      SELECT COUNT(*)
      FROM employee_pay_stubs ps
      JOIN employees e ON e.id = ps.employee_id
      WHERE e.tenant_id = $1
    `;
    const countParams: (string | number)[] = [tenantId];
    let countParamIndex = 2;

    if (employee_id) {
      countQuery += ` AND ps.employee_id = $${countParamIndex++}`;
      countParams.push(employee_id as string);
    }
    if (period) {
      countQuery += ` AND ps.period = $${countParamIndex++}`;
      countParams.push(period as string);
    }
    if (status) {
      countQuery += ` AND ps.status = $${countParamIndex++}`;
      countParams.push(status as string);
    }
    if (year) {
      countQuery += ` AND EXTRACT(YEAR FROM ps.period_start) = $${countParamIndex++}`;
      countParams.push(parseInt(year as string));
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
 * GET /pay-stubs/:id
 * Get single pay stub details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT
        ps.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.pernr as employee_number,
        d.name as department
      FROM employee_pay_stubs ps
      JOIN employees e ON e.id = ps.employee_id
      LEFT JOIN org_units d ON d.id = e.org_unit_id
      WHERE ps.id = $1 AND e.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Pay stub');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /pay-stubs/employee/:employeeId
 * Get pay stubs for specific employee
 */
router.get(
  '/employee/:employeeId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'] as string;
    const { year, limit = '12' } = req.query as Record<string, string>;

    let query = `
      SELECT
        ps.*,
        e.first_name || ' ' || e.last_name as employee_name
      FROM employee_pay_stubs ps
      JOIN employees e ON e.id = ps.employee_id
      WHERE ps.employee_id = $1 AND e.tenant_id = $2
    `;
    const params: (string | number)[] = [employeeId as string, tenantId];
    let paramIndex = 3;

    if (year) {
      query += ` AND EXTRACT(YEAR FROM ps.period_start) = $${paramIndex++}`;
      params.push(parseInt(year as string));
    }

    query += ` ORDER BY ps.period_start DESC LIMIT $${paramIndex}`;
    params.push(safeParseInt(limit as string, { fallback: 50 }));

    const result = await req.dbClient!.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  })
);

/**
 * GET /pay-stubs/employee/:employeeId/summary
 * Get annual summary for employee
 */
router.get(
  '/employee/:employeeId/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'] as string;
    const { year } = req.query as Record<string, string>;

    const yearFilter = year ? parseInt(year as string) : new Date().getFullYear();

    const result = await req.dbClient!.query(
      `
      SELECT
        EXTRACT(YEAR FROM ps.period_start)::int as year,
        COUNT(*) as pay_periods,
        SUM(ps.gross_pay) as total_gross,
        SUM(ps.net_pay) as total_net,
        SUM((ps.deductions->>'total')::numeric) as total_deductions,
        AVG(ps.gross_pay) as avg_gross,
        AVG(ps.net_pay) as avg_net
      FROM employee_pay_stubs ps
      JOIN employees e ON e.id = ps.employee_id
      WHERE ps.employee_id = $1 AND e.tenant_id = $2
      AND EXTRACT(YEAR FROM ps.period_start) = $3
      GROUP BY EXTRACT(YEAR FROM ps.period_start)
    `,
      [employeeId, tenantId, yearFilter]
    );

    if (result.rows.length === 0) {
      res.json({
        success: true,
        data: {
          year: yearFilter,
          pay_periods: 0,
          total_gross: 0,
          total_net: 0,
          total_deductions: 0,
        },
      });
      return;
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /pay-stubs
 * Create a new pay stub (admin/payroll)
 */
router.post(
  '/',
  validate(createPayStubSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      employee_id,
      period,
      period_start,
      period_end,
      gross_pay,
      net_pay,
      deductions,
      payment_date,
      status = 'draft',
    } = req.body;

    if (!employee_id || !period || !gross_pay) {
      throw Errors.badRequest('employee_id, period, and gross_pay are required');
    }

    // Verify employee belongs to tenant
    const empCheck = await req.dbClient!.query(
      'SELECT id FROM employees WHERE id = $1 AND tenant_id = $2',
      [employee_id, tenantId]
    );

    if (empCheck.rows.length === 0) {
      throw Errors.notFound('Employee');
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO employee_pay_stubs (
        employee_id, period, period_start, period_end,
        gross_pay, net_pay, deductions, payment_date, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `,
      [
        employee_id,
        period,
        period_start,
        period_end,
        gross_pay,
        net_pay,
        JSON.stringify(deductions || {}),
        payment_date,
        status,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * PATCH /pay-stubs/:id
 * Update pay stub
 */
router.patch(
  '/:id',
  validate(updatePayStubSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    // Verify pay stub belongs to tenant employee
    const existing = await req.dbClient!.query(
      `
      SELECT ps.id FROM employee_pay_stubs ps
      JOIN employees e ON e.id = ps.employee_id
      WHERE ps.id = $1 AND e.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      throw Errors.notFound('Pay stub');
    }

    const allowedFields = ['gross_pay', 'net_pay', 'deductions', 'payment_date', 'status'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'deductions') {
          updates.push(`${field} = $${paramIndex}`);
          values.push(JSON.stringify(req.body[field]));
        } else {
          updates.push(`${field} = $${paramIndex}`);
          values.push(req.body[field]);
        }
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      throw Errors.badRequest('No fields to update');
    }

    const result = await req.dbClient!.query(
      `UPDATE employee_pay_stubs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      [...values, id]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Pay stub updated' });
  })
);

/**
 * GET /pay-stubs/stats
 * Get pay stub statistics
 */
router.get(
  '/stats/overview',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { year } = req.query as Record<string, string>;
    const yearFilter = year ? parseInt(year as string) : new Date().getFullYear();

    const stats = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total_stubs,
        COUNT(DISTINCT ps.employee_id) as employees_paid,
        SUM(ps.gross_pay) as total_gross,
        SUM(ps.net_pay) as total_net,
        AVG(ps.gross_pay) as avg_gross,
        COUNT(*) FILTER (WHERE ps.status = 'paid') as paid_count,
        COUNT(*) FILTER (WHERE ps.status = 'pending') as pending_count
      FROM employee_pay_stubs ps
      JOIN employees e ON e.id = ps.employee_id
      WHERE e.tenant_id = $1
      AND EXTRACT(YEAR FROM ps.period_start) = $2
    `,
      [tenantId, yearFilter]
    );

    // Monthly breakdown
    const monthly = await req.dbClient!.query(
      `
      SELECT
        EXTRACT(MONTH FROM ps.period_start)::int as month,
        COUNT(*) as count,
        SUM(ps.gross_pay) as total_gross,
        SUM(ps.net_pay) as total_net
      FROM employee_pay_stubs ps
      JOIN employees e ON e.id = ps.employee_id
      WHERE e.tenant_id = $1
      AND EXTRACT(YEAR FROM ps.period_start) = $2
      GROUP BY EXTRACT(MONTH FROM ps.period_start)
      ORDER BY month
    `,
      [tenantId, yearFilter]
    );

    res.json({
      success: true,
      data: {
        year: yearFilter,
        summary: stats.rows[0],
        monthly: monthly.rows,
      },
    });
  })
);

export default router;
