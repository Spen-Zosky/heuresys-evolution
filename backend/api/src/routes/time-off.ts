/**
 * Time Off Routes
 * Time off balances and requests management
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { requirePermission, applyScopeFilter } from '../middleware/rbpMiddleware.js';
import { getScopeCondition } from '../utils/scope-helpers.js';
import { validate } from '../middleware/validate.js';
import {
  createTimeOffRequestSchema,
  cancelTimeOffRequestSchema,
  rejectTimeOffRequestSchema,
} from '../schemas/hr-operations-extended.js';

import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /time-off/stats
 * Get time off statistics overview
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { year } = req.query as Record<string, string>;

    const targetYear = year ? parseInt(year as string, 10) : new Date().getFullYear();

    // Run balance and request stats in parallel — they query independent tables
    const [balanceStats, requestStats] = await Promise.all([
      req.dbClient!.query(
        `
      SELECT
        COUNT(DISTINCT employee_id) as employees_with_balances,
        COUNT(DISTINCT leave_type) as leave_types,
        ROUND(SUM(total_days)::numeric, 1) as total_entitled_days,
        ROUND(SUM(used_days)::numeric, 1) as total_used_days,
        ROUND(SUM(pending_days)::numeric, 1) as total_pending_days,
        ROUND(AVG(total_days - used_days - pending_days)::numeric, 1) as avg_remaining_days
      FROM employee_time_off_balances b
      WHERE b.tenant_id = $1 AND b.year = $2
    `,
        [tenantId, targetYear]
      ),
      req.dbClient!.query(
        `
      SELECT
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_requests,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_requests,
        ROUND(SUM(days_requested)::numeric, 1) as total_days_requested
      FROM employee_time_off_requests r
      WHERE r.tenant_id = $1
      AND EXTRACT(YEAR FROM r.start_date) = $2
    `,
        [tenantId, targetYear]
      ),
    ]);

    res.json({
      success: true,
      data: {
        year: targetYear,
        balances: balanceStats.rows[0],
        requests: requestStats.rows[0],
      },
    });
  })
);

/**
 * GET /time-off/balances
 * List all time off balances
 */
router.get(
  '/balances',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { year, leave_type, limit = '100', offset = '0' } = req.query as Record<string, string>;

    const limitNum = safeParseInt(limit as string, { fallback: 100, min: 1, max: 1000 });
    const offsetNum = Math.max(0, safeParseInt(offset as string, { fallback: 0 }));

    const targetYear = year ? parseInt(year as string, 10) : new Date().getFullYear();

    let query = `
      SELECT b.id, b.employee_id, b.leave_type, b.total_days, b.used_days,
        b.pending_days, b.year, b.created_at, b.updated_at, b.tenant_id,
        b.carryover_days, b.carryover_expires_at, b.accrued_days,
        b.adjustment_days, b.adjustment_reason,
        e.first_name || ' ' || e.last_name as employee_name,
        d.name as department_name,
        (b.total_days + b.carryover_days + b.adjustment_days - b.used_days - b.pending_days) as available_days
      FROM employee_time_off_balances b
      JOIN employees e ON b.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE b.tenant_id = $1 AND b.year = $2
    `;
    const params: (string | number)[] = [tenantId, targetYear];
    let paramIndex = 3;

    if (leave_type) {
      query += ` AND b.leave_type = $${paramIndex++}`;
      params.push(leave_type as string);
    }

    query += ` ORDER BY e.last_name, b.leave_type LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limitNum, offsetNum);

    const result = await req.dbClient!.query(query, params);

    const countResult = await req.dbClient!.query(
      `
      SELECT COUNT(*)
      FROM employee_time_off_balances
      WHERE tenant_id = $1 AND year = $2
    `,
      [tenantId, targetYear]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: safeParseInt(countResult.rows[0]?.count, { fallback: 0 }),
        limit: limitNum,
        offset: offsetNum,
        year: targetYear,
      },
    });
  })
);

/**
 * GET /time-off/requests
 * List time off requests
 */
router.get(
  '/requests',
  requirePermission('TIME_ATTENDANCE', 'VIEW'),
  applyScopeFilter('TIME_ATTENDANCE'),
  asyncHandler(async (req: Request, res: Response) => {
    const scope = getScopeCondition(req, 'r');
    const {
      status,
      leave_type,
      year,
      limit = '50',
      offset = '0',
    } = req.query as Record<string, string>;

    const limitNum = safeParseInt(limit as string, { fallback: 50, min: 1, max: 1000 });
    const offsetNum = Math.max(0, safeParseInt(offset as string, { fallback: 0 }));

    let query = `
      SELECT r.id, r.employee_id, r.leave_type, r.start_date, r.end_date,
        r.days_requested, r.reason, r.status, r.approver_id, r.approved_at,
        r.rejection_reason, r.created_at, r.updated_at, r.tenant_id,
        r.half_day_start, r.half_day_end, r.medical_certificate_required,
        r.cancellation_requested, r.cancelled_at,
        e.first_name || ' ' || e.last_name as employee_name,
        d.name as department_name,
        a.first_name || ' ' || a.last_name as approver_name
      FROM employee_time_off_requests r
      JOIN employees e ON r.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      LEFT JOIN employees a ON r.approver_id = a.id
      WHERE ${scope.where}
    `;
    const params: unknown[] = [...scope.params];
    let paramIndex = params.length + 1;

    if (status) {
      query += ` AND r.status = $${paramIndex++}`;
      params.push(status as string);
    }

    if (leave_type) {
      query += ` AND r.leave_type = $${paramIndex++}`;
      params.push(leave_type as string);
    }

    if (year) {
      query += ` AND EXTRACT(YEAR FROM r.start_date) = $${paramIndex++}`;
      params.push(parseInt(year as string, 10));
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limitNum, offsetNum);

    const result = await req.dbClient!.query(query, params);

    const countScope = getScopeCondition(req, 'r');
    const countResult = await req.dbClient!.query(
      `SELECT COUNT(*) FROM employee_time_off_requests r WHERE ${countScope.where}`,
      countScope.params
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: safeParseInt(countResult.rows[0]?.count, { fallback: 0 }),
        limit: limitNum,
        offset: offsetNum,
      },
    });
  })
);

/**
 * GET /time-off/requests/:id
 * Get single time off request
 */
router.get(
  '/requests/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT r.id, r.employee_id, r.leave_type, r.start_date, r.end_date,
        r.days_requested, r.reason, r.status, r.approver_id, r.approved_at,
        r.rejection_reason, r.created_at, r.updated_at, r.tenant_id,
        r.half_day_start, r.half_day_end, r.overlap_approved,
        r.medical_certificate_required, r.medical_certificate_uploaded,
        r.cancellation_requested, r.cancellation_reason, r.cancelled_at, r.cancelled_by,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        d.name as department_name,
        a.first_name || ' ' || a.last_name as approver_name
      FROM employee_time_off_requests r
      JOIN employees e ON r.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      LEFT JOIN employees a ON r.approver_id = a.id
      WHERE r.id = $1 AND r.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Time off request');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /time-off/by-leave-type
 * Get breakdown by leave type
 */
router.get(
  '/by-leave-type',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { year } = req.query as Record<string, string>;

    const targetYear = year ? parseInt(year as string, 10) : new Date().getFullYear();

    const result = await req.dbClient!.query(
      `
      SELECT
        b.leave_type,
        COUNT(DISTINCT b.employee_id) as employees,
        ROUND(SUM(b.total_days)::numeric, 1) as total_entitled,
        ROUND(SUM(b.used_days)::numeric, 1) as total_used,
        ROUND(SUM(b.pending_days)::numeric, 1) as total_pending,
        ROUND(AVG(b.total_days - b.used_days - b.pending_days)::numeric, 1) as avg_remaining
      FROM employee_time_off_balances b
      WHERE b.tenant_id = $1 AND b.year = $2
      GROUP BY b.leave_type
      ORDER BY total_used DESC
    `,
      [tenantId, targetYear]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

// === USER SELF-SERVICE ENDPOINTS ===

// Helper to get employee ID from user
async function getEmployeeId(
  userId: string,
  tenantId: string,
  dbClient: {
    query: (text: string, params: unknown[]) => Promise<{ rows: Record<string, string>[] }>;
  }
): Promise<string | null> {
  const result = await dbClient.query(
    `SELECT e.id FROM employees e
     JOIN users u ON u.employee_id = e.id
     WHERE u.id = $1 AND e.tenant_id = $2`,
    [userId, tenantId]
  );
  return result.rows[0]?.id || null;
}

/**
 * GET /time-off/my/balances - Get current user's leave balances
 */
router.get(
  '/my/balances',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = (req as AuthenticatedRequest).user?.userId;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(userId, tenantId, req.dbClient!);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    const currentYear = new Date().getFullYear();

    const result = await req.dbClient!.query(
      `SELECT b.id, b.employee_id, b.leave_type, b.total_days, b.used_days,
              b.pending_days, b.year, b.created_at, b.updated_at, b.tenant_id,
              b.carryover_days, b.carryover_expires_at, b.accrued_days,
              b.adjustment_days, b.adjustment_reason,
              r.name as leave_type_name,
              r.description as leave_type_description,
              (b.total_days + COALESCE(b.carryover_days, 0) + COALESCE(b.accrued_days, 0) +
               COALESCE(b.adjustment_days, 0) - COALESCE(b.used_days, 0) - COALESCE(b.pending_days, 0)) as available_days
       FROM employee_time_off_balances b
       LEFT JOIN leave_accrual_rules r ON r.leave_type = b.leave_type AND r.tenant_id = b.tenant_id AND r.is_active = TRUE
       WHERE b.employee_id = $1 AND b.tenant_id = $2 AND b.year = $3
       ORDER BY b.leave_type`,
      [employeeId, tenantId, currentYear]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /time-off/my/requests - Get current user's time-off requests
 */
router.get(
  '/my/requests',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = (req as AuthenticatedRequest).user?.userId;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(userId, tenantId, req.dbClient!);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    const { status, year } = req.query as Record<string, string>;
    const requestYear = year || new Date().getFullYear();

    let query = `
      SELECT r.id, r.employee_id, r.leave_type, r.start_date, r.end_date,
             r.days_requested, r.reason, r.status, r.approver_id, r.approved_at,
             r.rejection_reason, r.created_at, r.updated_at, r.tenant_id,
             r.half_day_start, r.half_day_end, r.medical_certificate_required,
             r.cancellation_requested, r.cancelled_at,
             a.first_name || ' ' || a.last_name as approver_name
       FROM employee_time_off_requests r
       LEFT JOIN employees a ON a.id = r.approver_id
       WHERE r.employee_id = $1 AND r.tenant_id = $2
         AND EXTRACT(YEAR FROM r.start_date) = $3
    `;
    const params: (string | number)[] = [employeeId, tenantId, requestYear as number];

    if (status) {
      query += ` AND r.status = $4`;
      params.push(status as string);
    }

    query += ` ORDER BY r.start_date DESC`;

    const result = await req.dbClient!.query(query, params);

    res.json({ success: true, data: result.rows });
  })
);

/**
 * POST /time-off/my/requests - Create time-off request for current user
 */
router.post(
  '/my/requests',
  validate(createTimeOffRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = (req as AuthenticatedRequest).user?.userId;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(userId, tenantId, req.dbClient!);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    const {
      leave_type,
      start_date,
      end_date,
      reason,
      half_day_start = false,
      half_day_end = false,
    } = req.body;

    if (!leave_type || !start_date || !end_date) {
      throw Errors.badRequest('leave_type, start_date, and end_date are required');
    }

    // Calculate days requested
    const start = new Date(start_date);
    const end = new Date(end_date);
    let days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (half_day_start) days -= 0.5;
    if (half_day_end) days -= 0.5;

    // Check balance
    const balanceResult = await req.dbClient!.query(
      `SELECT id, employee_id, leave_type, total_days, used_days, pending_days, year,
              created_at, updated_at, tenant_id, carryover_days, carryover_expires_at,
              accrued_days, adjustment_days, adjustment_reason
       FROM employee_time_off_balances
       WHERE employee_id = $1 AND tenant_id = $2 AND leave_type = $3 AND year = $4`,
      [employeeId, tenantId, leave_type, new Date().getFullYear()]
    );

    if (balanceResult.rows.length > 0) {
      const balance = balanceResult.rows[0];
      const available =
        parseFloat(balance.total_days || 0) +
        parseFloat(balance.carryover_days || 0) +
        parseFloat(balance.accrued_days || 0) +
        parseFloat(balance.adjustment_days || 0) -
        parseFloat(balance.used_days || 0) -
        parseFloat(balance.pending_days || 0);

      if (days > available) {
        res.status(400).json({
          success: false,
          error: `Insufficient balance. Available: ${available} days, Requested: ${days} days`,
        });
        return;
      }
    }

    // Get manager as approver
    const managerResult = await req.dbClient!.query(
      `SELECT manager_id FROM employees WHERE id = $1 AND tenant_id = $2`,
      [employeeId, tenantId]
    );
    const approverId = managerResult.rows[0]?.manager_id;

    // Create request
    const result = await req.dbClient!.query(
      `INSERT INTO employee_time_off_requests (
        tenant_id, employee_id, leave_type, start_date, end_date,
        days_requested, reason, half_day_start, half_day_end,
        status, approver_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
      RETURNING *`,
      [
        tenantId,
        employeeId,
        leave_type,
        start_date,
        end_date,
        days,
        reason,
        half_day_start,
        half_day_end,
        approverId,
      ]
    );

    // Update pending days in balance
    await req.dbClient!.query(
      `UPDATE employee_time_off_balances
       SET pending_days = COALESCE(pending_days, 0) + $1, updated_at = NOW()
       WHERE employee_id = $2 AND tenant_id = $3 AND leave_type = $4 AND year = $5`,
      [days, employeeId, tenantId, leave_type, new Date().getFullYear()]
    );

    // Create approval step
    if (approverId) {
      await req.dbClient!.query(
        `INSERT INTO leave_approval_steps (
          tenant_id, request_id, step_order, approver_id, approver_type, status
        ) VALUES ($1, $2, 1, $3, 'manager', 'pending')`,
        [tenantId, result.rows[0]?.id, approverId]
      );
    }

    res.status(201).json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /time-off/my/requests/:id/cancel - Cancel request for current user
 */
router.post(
  '/my/requests/:id/cancel',
  validate(cancelTimeOffRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = (req as AuthenticatedRequest).user?.userId;
    const id = req.params['id'] as string;
    const { reason } = req.body;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(userId, tenantId, req.dbClient!);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    // Get request
    const requestResult = await req.dbClient!.query(
      `SELECT id, employee_id, leave_type, start_date, end_date, days_requested,
              reason, status, approver_id, approved_at, rejection_reason, created_at,
              updated_at, tenant_id, half_day_start, half_day_end, overlap_approved,
              medical_certificate_required, medical_certificate_uploaded,
              cancellation_requested, cancellation_reason, cancelled_at, cancelled_by
       FROM employee_time_off_requests
       WHERE id = $1 AND employee_id = $2 AND tenant_id = $3`,
      [id, employeeId, tenantId]
    );

    if (requestResult.rows.length === 0) {
      throw Errors.notFound('Request');
    }

    const request = requestResult.rows[0];

    if (request.status !== 'pending') {
      throw Errors.badRequest('Only pending requests can be cancelled');
    }

    // Cancel pending request
    await req.dbClient!.query(
      `UPDATE employee_time_off_requests
       SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $1,
           cancellation_reason = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [employeeId, reason, id, tenantId]
    );

    // Return pending days to balance
    await req.dbClient!.query(
      `UPDATE employee_time_off_balances
       SET pending_days = GREATEST(0, COALESCE(pending_days, 0) - $1), updated_at = NOW()
       WHERE employee_id = $2 AND tenant_id = $3 AND leave_type = $4 AND year = $5`,
      [request.days_requested, employeeId, tenantId, request.leave_type, new Date().getFullYear()]
    );

    res.json({ success: true });
  })
);

/**
 * GET /time-off/leave-types - Get available leave types
 */
router.get(
  '/leave-types',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `SELECT leave_type, name, description, allow_carryover, max_carryover_days
       FROM leave_accrual_rules
       WHERE tenant_id = $1 AND is_active = TRUE
       ORDER BY name`,
      [tenantId]
    );

    // Default types if none configured
    if (result.rows.length === 0) {
      res.json({
        success: true,
        data: [
          { leave_type: 'vacation', name: 'Vacation', description: 'Annual vacation leave' },
          { leave_type: 'sick', name: 'Sick Leave', description: 'Medical leave' },
          { leave_type: 'personal', name: 'Personal', description: 'Personal days' },
          {
            leave_type: 'parental',
            name: 'Parental Leave',
            description: 'Maternity/paternity leave',
          },
          {
            leave_type: 'bereavement',
            name: 'Bereavement',
            description: 'Family bereavement leave',
          },
        ],
      });
      return;
    }

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /time-off/my/calendar - Get team calendar view for current user
 */
router.get(
  '/my/calendar',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = (req as AuthenticatedRequest).user?.userId;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(userId, tenantId, req.dbClient!);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    const { month, year } = req.query as Record<string, string>;
    const targetMonth = parseInt(month as string) || new Date().getMonth() + 1;
    const targetYear = parseInt(year as string) || new Date().getFullYear();

    // Get employee's department
    const empResult = await req.dbClient!.query(
      `SELECT org_unit_id FROM employees WHERE id = $1 AND tenant_id = $2`,
      [employeeId, tenantId]
    );
    const orgUnitId = empResult.rows[0]?.org_unit_id;

    // Get team time-off for the month
    const result = await req.dbClient!.query(
      `SELECT r.id, r.leave_type, r.start_date, r.end_date, r.status,
              e.first_name, e.last_name,
              e.id as employee_id
       FROM employee_time_off_requests r
       JOIN employees e ON e.id = r.employee_id
       WHERE r.tenant_id = $1
         AND e.org_unit_id = $2
         AND r.status IN ('approved', 'pending')
         AND (
           (EXTRACT(MONTH FROM r.start_date) = $3 AND EXTRACT(YEAR FROM r.start_date) = $4)
           OR (EXTRACT(MONTH FROM r.end_date) = $3 AND EXTRACT(YEAR FROM r.end_date) = $4)
         )
       ORDER BY r.start_date`,
      [tenantId, orgUnitId, targetMonth, targetYear]
    );

    res.json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        entries: result.rows,
      },
    });
  })
);

/**
 * GET /time-off/holidays - Get public holidays
 */
router.get(
  '/holidays',
  asyncHandler(async (req: Request, res: Response) => {
    const { year } = req.query as Record<string, string>;
    const targetYear = parseInt(year as string) || new Date().getFullYear();

    // Italian public holidays
    const holidays = [
      { date: `${targetYear}-01-01`, name: 'Capodanno', type: 'national' },
      { date: `${targetYear}-01-06`, name: 'Epifania', type: 'national' },
      { date: `${targetYear}-04-25`, name: 'Festa della Liberazione', type: 'national' },
      { date: `${targetYear}-05-01`, name: 'Festa dei Lavoratori', type: 'national' },
      { date: `${targetYear}-06-02`, name: 'Festa della Repubblica', type: 'national' },
      { date: `${targetYear}-08-15`, name: 'Ferragosto', type: 'national' },
      { date: `${targetYear}-11-01`, name: 'Ognissanti', type: 'national' },
      { date: `${targetYear}-12-08`, name: 'Immacolata Concezione', type: 'national' },
      { date: `${targetYear}-12-25`, name: 'Natale', type: 'national' },
      { date: `${targetYear}-12-26`, name: 'Santo Stefano', type: 'national' },
    ];

    res.json({ success: true, data: holidays });
  })
);

/**
 * GET /time-off/team-requests - Get pending requests for manager
 */
router.get(
  '/team-requests',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = (req as AuthenticatedRequest).user?.userId;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(userId, tenantId, req.dbClient!);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    const { status = 'pending' } = req.query as Record<string, string>;

    const result = await req.dbClient!.query(
      `SELECT r.id, r.employee_id, r.leave_type, r.start_date, r.end_date,
              r.days_requested, r.reason, r.status, r.approver_id, r.approved_at,
              r.rejection_reason, r.created_at, r.updated_at, r.tenant_id,
              r.half_day_start, r.half_day_end, r.medical_certificate_required,
              r.cancellation_requested, r.cancelled_at,
              e.first_name, e.last_name, e.email
       FROM employee_time_off_requests r
       JOIN employees e ON e.id = r.employee_id
       WHERE r.tenant_id = $1 AND r.approver_id = $2 AND r.status = $3
       ORDER BY r.created_at ASC`,
      [tenantId, employeeId, status]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * POST /time-off/requests/:id/approve - Approve request (manager)
 */
router.post(
  '/requests/:id/approve',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = (req as AuthenticatedRequest).user?.userId;
    const id = req.params['id'] as string;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(userId, tenantId, req.dbClient!);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    // Verify approver
    const requestResult = await req.dbClient!.query(
      `SELECT id, employee_id, leave_type, start_date, end_date, days_requested,
              reason, status, approver_id, approved_at, rejection_reason, created_at,
              updated_at, tenant_id, half_day_start, half_day_end, overlap_approved,
              medical_certificate_required, medical_certificate_uploaded,
              cancellation_requested, cancellation_reason, cancelled_at, cancelled_by
       FROM employee_time_off_requests
       WHERE id = $1 AND approver_id = $2 AND tenant_id = $3 AND status = 'pending'`,
      [id, employeeId, tenantId]
    );

    if (requestResult.rows.length === 0) {
      throw Errors.notFound('Request');
    }

    const request = requestResult.rows[0];

    // Update request
    await req.dbClient!.query(
      `UPDATE employee_time_off_requests
       SET status = 'approved', approved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    // Update balance: move from pending to used
    await req.dbClient!.query(
      `UPDATE employee_time_off_balances
       SET pending_days = GREATEST(0, COALESCE(pending_days, 0) - $1),
           used_days = COALESCE(used_days, 0) + $1,
           updated_at = NOW()
       WHERE employee_id = $2 AND tenant_id = $3 AND leave_type = $4 AND year = $5`,
      [
        request.days_requested,
        request.employee_id,
        tenantId,
        request.leave_type,
        new Date().getFullYear(),
      ]
    );

    // Update approval step
    await req.dbClient!.query(
      `UPDATE leave_approval_steps
       SET status = 'approved', decision_at = NOW()
       WHERE request_id = $1 AND approver_id = $2 AND tenant_id = $3`,
      [id, employeeId, tenantId]
    );

    res.json({ success: true });
  })
);

/**
 * POST /time-off/requests/:id/reject - Reject request (manager)
 */
router.post(
  '/requests/:id/reject',
  validate(rejectTimeOffRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = (req as AuthenticatedRequest).user?.userId;
    const id = req.params['id'] as string;
    const { reason } = req.body;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(userId, tenantId, req.dbClient!);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    // Verify approver
    const requestResult = await req.dbClient!.query(
      `SELECT id, employee_id, leave_type, start_date, end_date, days_requested,
              reason, status, approver_id, approved_at, rejection_reason, created_at,
              updated_at, tenant_id, half_day_start, half_day_end, overlap_approved,
              medical_certificate_required, medical_certificate_uploaded,
              cancellation_requested, cancellation_reason, cancelled_at, cancelled_by
       FROM employee_time_off_requests
       WHERE id = $1 AND approver_id = $2 AND tenant_id = $3 AND status = 'pending'`,
      [id, employeeId, tenantId]
    );

    if (requestResult.rows.length === 0) {
      throw Errors.notFound('Request');
    }

    const request = requestResult.rows[0];

    // Update request
    await req.dbClient!.query(
      `UPDATE employee_time_off_requests
       SET status = 'rejected', rejection_reason = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [reason, id, tenantId]
    );

    // Return pending days to balance
    await req.dbClient!.query(
      `UPDATE employee_time_off_balances
       SET pending_days = GREATEST(0, COALESCE(pending_days, 0) - $1), updated_at = NOW()
       WHERE employee_id = $2 AND tenant_id = $3 AND leave_type = $4 AND year = $5`,
      [
        request.days_requested,
        request.employee_id,
        tenantId,
        request.leave_type,
        new Date().getFullYear(),
      ]
    );

    // Update approval step
    await req.dbClient!.query(
      `UPDATE leave_approval_steps
       SET status = 'rejected', decision_at = NOW(), decision_notes = $1
       WHERE request_id = $2 AND approver_id = $3 AND tenant_id = $4`,
      [reason, id, employeeId, tenantId]
    );

    res.json({ success: true });
  })
);

export default router;
