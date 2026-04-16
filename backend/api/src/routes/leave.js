/**
 * Leave Management Routes
 * Leave balances, requests, approvals, and CCNL compliance
 * Epic: 4 - Leave & Attendance Management
 * Stories: 4.1-4.7
 */
import { Router } from 'express';
import { createAppError } from '../middleware/errorHandler.js';
import { ErrorCodes, LEAVE_TYPES, CCNL_LEAVE_DEFAULTS, } from '@heuresys/shared';
import { requireTenant } from '../middleware/tenantContext.js';
import { authMiddleware } from '../middleware/auth.js';
import { checkPermission } from '../middleware/rbac.js';
import { requirePermission, applyScopeFilter } from '../middleware/rbpMiddleware.js';
import { getScopeCondition } from '../utils/scope-helpers.js';
import { PERMISSIONS } from '@heuresys/shared';
import { withTransaction } from '../utils/transaction.js';
import { validate } from '../middleware/validate.js';
import { initializeLeaveBalancesSchema, createLeaveRequestSchema, approveLeaveSchema, rejectLeaveSchema, cancelLeaveSchema, } from '../schemas/platform.js';
import { asyncHandler } from '../errors/middleware.js';
import { buildMeta } from '../utils/pagination.js';
import { safeParseInt, firstRowOrThrow } from '../utils/query-helpers.js';
const router = Router();
// All routes require tenant context and authentication
router.use(requireTenant);
router.use(authMiddleware);
// =============================================================================
// LEAVE TYPE METADATA
// =============================================================================
const LEAVE_TYPE_METADATA = {
    ferie: { label: 'Ferie', accrued: true, requiresCertificate: false },
    rol: { label: 'Riduzione Orario di Lavoro', accrued: true, requiresCertificate: false },
    ex_festivita: { label: 'Ex Festività', accrued: true, requiresCertificate: false },
    malattia: { label: 'Malattia', accrued: false, requiresCertificate: true },
    permesso_lutto: {
        label: 'Permesso Lutto',
        accrued: false,
        requiresCertificate: true,
        maxDays: 3,
    },
    permesso_matrimonio: {
        label: 'Congedo Matrimoniale',
        accrued: false,
        requiresCertificate: true,
        maxDays: 15,
    },
    permesso_nascita: {
        label: 'Permesso Nascita',
        accrued: false,
        requiresCertificate: true,
        maxDays: 10,
    },
    permesso_studio: { label: 'Permesso Studio', accrued: false, requiresCertificate: true },
    maternita: { label: 'Maternità', accrued: false, requiresCertificate: true },
    paternita: { label: 'Paternità', accrued: false, requiresCertificate: true },
    congedo_parentale: { label: 'Congedo Parentale', accrued: false, requiresCertificate: true },
    permesso_104: { label: 'Permesso Legge 104', accrued: false, requiresCertificate: true },
    aspettativa: { label: 'Aspettativa', accrued: false, requiresCertificate: false },
    altro: { label: 'Altro', accrued: false, requiresCertificate: false },
};
// =============================================================================
// GET /api/v1/leave
// List leave requests with pagination
//
// Wired to applyScopeFilter('TIME_ATTENDANCE') as the canonical example for
// RBP Step 2.1 (TASK-07). The actual scope WHERE clause is resolved by
// getScopeCondition() — when USE_RBP_SCOPE=true the middleware injects a
// data-driven WHERE based on the user's scope rule (PLATFORM/TENANT/
// DEPARTMENT/HIERARCHY/SELF). When USE_RBP_SCOPE=false the helper falls back
// to the legacy `tenant_id = $1` clause, so this change is forward-compatible.
// =============================================================================
router.get('/', requirePermission('TIME_ATTENDANCE', 'VIEW'), applyScopeFilter('TIME_ATTENDANCE'), asyncHandler(async (req, res) => {
    const limit = safeParseInt(req.query.limit, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset, { fallback: 0 });
    const status = req.query.status;
    const employeeId = req.query.employee_id;
    const scope = getScopeCondition(req, 'lr');
    let whereClause = `WHERE ${scope.where}`;
    const params = [...scope.params];
    if (status) {
        params.push(status);
        whereClause += ` AND lr.status = $${params.length}`;
    }
    if (employeeId) {
        params.push(employeeId);
        whereClause += ` AND lr.employee_id = $${params.length}`;
    }
    const [countResult, dataResult] = await Promise.all([
        req.dbClient.query(`SELECT COUNT(*) as total FROM leave_requests lr ${whereClause}`, params),
        req.dbClient.query(`SELECT lr.id, lr.employee_id, lr.leave_type, lr.start_date, lr.end_date,
                lr.days_requested, lr.reason, lr.status, lr.approver_id, lr.approved_at,
                lr.created_at,
                e.first_name, e.last_name
         FROM leave_requests lr
         JOIN employees e ON lr.employee_id = e.id
         ${whereClause}
         ORDER BY lr.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
    ]);
    res.json({
        success: true,
        data: dataResult.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.total), limit, offset),
    });
}));
// =============================================================================
// GET /api/v1/leave/meta/types
// Get available leave types with metadata
// =============================================================================
router.get('/meta/types', (_req, res) => {
    const types = Object.entries(LEAVE_TYPES).map(([key, value]) => {
        const metadata = LEAVE_TYPE_METADATA[value];
        return {
            value,
            label: metadata?.label || key,
            accrued: metadata?.accrued || false,
            requiresCertificate: metadata?.requiresCertificate || false,
        };
    });
    res.json({
        success: true,
        data: types,
    });
});
// =============================================================================
// GET /api/v1/leave/balances
// Get leave balances for current user or specified employee
// Story: 4.1 - Leave Balance Display
// =============================================================================
router.get('/balances', asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const { employeeId, year } = req.query;
    // Determine which employee to query
    let targetEmployeeId;
    if (employeeId) {
        // Check permission to view other employees
        const authReq = req;
        const userRole = authReq.user.role;
        if (!['SUPERUSER', 'TENANT_OWNER', 'HR'].includes(userRole)) {
            // Check if viewing own data or team member
            if (employeeId !== authReq.user.employeeId) {
                // Check if target is in user's team
                const teamCheck = await req.dbClient.query('SELECT 1 FROM employees WHERE id = $1 AND manager_id = $2 AND tenant_id = $3', [employeeId, authReq.user.employeeId, tenantId]);
                if (teamCheck.rows.length === 0) {
                    throw createAppError('Access denied', 403, ErrorCodes.FORBIDDEN);
                }
            }
        }
        targetEmployeeId = employeeId;
    }
    else {
        // Get own balances
        if (!tenantReq.user.employeeId) {
            throw createAppError('No employee profile linked', 404, ErrorCodes.NOT_FOUND);
        }
        targetEmployeeId = tenantReq.user.employeeId;
    }
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const result = await req.dbClient.query(`SELECT
        b.id, b.employee_id, b.leave_type, b.total_days, b.used_days,
        b.pending_days, b.year, b.created_at, b.updated_at, b.tenant_id,
        b.carryover_days, b.carryover_expires_at, b.accrued_days,
        b.adjustment_days, b.adjustment_reason,
        (b.total_days + b.carryover_days + b.adjustment_days - b.used_days - b.pending_days) as available_days
       FROM employee_time_off_balances b
       WHERE b.employee_id = $1 AND b.tenant_id = $2 AND b.year = $3
       ORDER BY b.leave_type`, [targetEmployeeId, tenantId, targetYear]);
    // Get employee info
    const employeeResult = await req.dbClient.query('SELECT first_name, last_name, hire_date FROM employees WHERE id = $1 AND tenant_id = $2', [targetEmployeeId, tenantId]);
    res.json({
        success: true,
        data: {
            employee: employeeResult.rows[0] || null,
            year: targetYear,
            balances: result.rows.map((row) => ({
                ...row,
                typeLabel: LEAVE_TYPE_METADATA[row.leave_type]?.label ||
                    row.leave_type,
                availableDays: parseFloat(row.available_days) || 0,
            })),
        },
    });
}));
// =============================================================================
// POST /api/v1/leave/balances/initialize
// Initialize leave balances for an employee based on CCNL
// Story: 4.1, 4.5 - CCNL Leave Rule Validation
// =============================================================================
router.post('/balances/initialize', checkPermission(PERMISSIONS.EMPLOYEES_UPDATE), validate(initializeLeaveBalancesSchema), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const { employeeId, year, ccnlType } = req.body;
    if (!employeeId) {
        throw createAppError('Employee ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const targetYear = year || new Date().getFullYear();
    // Get CCNL defaults
    const ccnl = ccnlType || 'commercio';
    const defaults = CCNL_LEAVE_DEFAULTS[ccnl] || CCNL_LEAVE_DEFAULTS['commercio'];
    // Get employee hire date for proration
    const employeeResult = await req.dbClient.query('SELECT hire_date FROM employees WHERE id = $1 AND tenant_id = $2', [employeeId, tenantId]);
    const employee = firstRowOrThrow(employeeResult, 'Employee', employeeId);
    const hireDate = new Date(employee.hire_date);
    const yearStart = new Date(targetYear, 0, 1);
    // Calculate proration factor
    let prorationFactor = 1;
    if (hireDate.getFullYear() === targetYear && hireDate > yearStart) {
        const monthsRemaining = 12 - hireDate.getMonth();
        prorationFactor = monthsRemaining / 12;
    }
    // Initialize balances for standard leave types
    const leaveTypes = [
        { type: 'ferie', days: defaults.ferie },
        { type: 'rol', days: Math.round(defaults.rol / 8) }, // ROL often in hours, convert to days
        { type: 'ex_festivita', days: Math.round(defaults.exFestivita / 8) },
    ];
    const results = await withTransaction(async (client) => {
        const txResults = [];
        for (const lt of leaveTypes) {
            const totalDays = Math.round(lt.days * prorationFactor * 100) / 100;
            // Upsert balance
            const upsertResult = await client.query(`INSERT INTO employee_time_off_balances
              (tenant_id, employee_id, leave_type, year, total_days, accrued_days)
             VALUES ($1, $2, $3, $4, $5, $5)
             ON CONFLICT (employee_id, leave_type, year)
             DO UPDATE SET total_days = $5, accrued_days = $5, updated_at = NOW()
             RETURNING *`, [tenantId, employeeId, lt.type, targetYear, totalDays]);
            txResults.push(upsertResult.rows[0]);
        }
        return txResults;
    }, tenantId);
    res.json({
        success: true,
        data: {
            message: 'Leave balances initialized',
            ccnlType: ccnl,
            prorationFactor: Math.round(prorationFactor * 100) / 100,
            balances: results,
        },
    });
}));
// =============================================================================
// GET /api/v1/leave/requests
// List leave requests with filtering
// Story: 4.2 - Leave Request Submission
// =============================================================================
router.get('/requests', asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const { employeeId, status, leaveType, startDateFrom, startDateTo, page = '1', limit = '20', } = req.query;
    const authReq = req;
    const userRole = authReq.user.role;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;
    // Build query based on role
    const conditions = ['r.tenant_id = $1'];
    const params = [tenantId];
    let paramIndex = 2;
    if (['SUPERUSER', 'TENANT_OWNER', 'HR'].includes(userRole)) {
        // Can see all requests
        if (employeeId) {
            conditions.push(`r.employee_id = $${paramIndex++}`);
            params.push(employeeId);
        }
    }
    else if (authReq.user.employeeId) {
        // Can see own requests or team requests
        const teamResult = await req.dbClient.query('SELECT id FROM employees WHERE manager_id = $1 AND tenant_id = $2', [authReq.user.employeeId, tenantId]);
        const teamIds = teamResult.rows.map((r) => r.id);
        if (employeeId) {
            // Specific employee - must be self or team member
            if (employeeId !== authReq.user.employeeId && !teamIds.includes(employeeId)) {
                throw createAppError('Access denied', 403, ErrorCodes.FORBIDDEN);
            }
            conditions.push(`r.employee_id = $${paramIndex++}`);
            params.push(employeeId);
        }
        else {
            // Default: own + team
            const allIds = [authReq.user.employeeId, ...teamIds];
            conditions.push(`r.employee_id = ANY($${paramIndex++})`);
            params.push(allIds);
        }
    }
    if (status) {
        conditions.push(`r.status = $${paramIndex++}`);
        params.push(status);
    }
    if (leaveType) {
        conditions.push(`r.leave_type = $${paramIndex++}`);
        params.push(leaveType);
    }
    if (startDateFrom) {
        conditions.push(`r.start_date >= $${paramIndex++}`);
        params.push(startDateFrom);
    }
    if (startDateTo) {
        conditions.push(`r.start_date <= $${paramIndex++}`);
        params.push(startDateTo);
    }
    const whereClause = conditions.join(' AND ');
    // Get total count
    const countResult = await req.dbClient.query(`SELECT COUNT(*) FROM employee_time_off_requests r WHERE ${whereClause}`, params);
    // Get requests
    const result = await req.dbClient.query(`SELECT r.id, r.employee_id, r.leave_type, r.start_date, r.end_date,
        r.days_requested, r.reason, r.status, r.approver_id, r.approved_at,
        r.rejection_reason, r.created_at, r.updated_at, r.tenant_id,
        r.half_day_start, r.half_day_end, r.medical_certificate_required,
        r.cancellation_requested, r.cancelled_at,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        a.first_name as approver_first_name,
        a.last_name as approver_last_name
       FROM employee_time_off_requests r
       LEFT JOIN employees e ON r.employee_id = e.id
       LEFT JOIN employees a ON r.approver_id = a.id
       WHERE ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`, [...params, limitNum, offset]);
    res.json({
        success: true,
        data: result.rows.map((row) => ({
            ...row,
            typeLabel: LEAVE_TYPE_METADATA[row.leave_type]?.label ||
                row.leave_type,
        })),
        meta: buildMeta(parseInt(countResult.rows[0]?.count, 10), limitNum, (pageNum - 1) * limitNum),
    });
}));
// =============================================================================
// POST /api/v1/leave/requests
// Submit a new leave request
// Story: 4.2 - Leave Request Submission
// =============================================================================
router.post('/requests', validate(createLeaveRequestSchema), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const employeeId = tenantReq.user.employeeId;
    if (!employeeId) {
        throw createAppError('No employee profile linked', 404, ErrorCodes.NOT_FOUND);
    }
    const input = req.body;
    // Validate required fields
    if (!input.leaveType || !Object.values(LEAVE_TYPES).includes(input.leaveType)) {
        throw createAppError('Valid leave type is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (!input.startDate || !input.endDate) {
        throw createAppError('Start and end dates are required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (startDate > endDate) {
        throw createAppError('Start date must be before end date', 400, ErrorCodes.VALIDATION_ERROR);
    }
    // Calculate days requested (excluding weekends)
    let daysRequested = input.daysRequested;
    if (!daysRequested) {
        daysRequested = 0;
        const current = new Date(startDate);
        while (current <= endDate) {
            const day = current.getDay();
            if (day !== 0 && day !== 6) {
                // Not Sunday or Saturday
                daysRequested += 1;
            }
            current.setDate(current.getDate() + 1);
        }
    }
    // Adjust for half days
    if (input.halfDayStart)
        daysRequested -= 0.5;
    if (input.halfDayEnd)
        daysRequested -= 0.5;
    // Check balance for accrued types
    const typeMetadata = LEAVE_TYPE_METADATA[input.leaveType];
    if (typeMetadata?.accrued) {
        const balanceResult = await req.dbClient.query(`SELECT (total_days + carryover_days + adjustment_days - used_days - pending_days) as available
         FROM employee_time_off_balances
         WHERE employee_id = $1 AND tenant_id = $2 AND leave_type = $3 AND year = $4`, [employeeId, tenantId, input.leaveType, startDate.getFullYear()]);
        if (balanceResult.rows.length === 0) {
            throw createAppError('No leave balance found for this type', 400, ErrorCodes.VALIDATION_ERROR);
        }
        const available = parseFloat(balanceResult.rows[0]?.available);
        if (available < daysRequested) {
            throw createAppError(`Insufficient balance. Available: ${available} days, Requested: ${daysRequested} days`, 400, ErrorCodes.VALIDATION_ERROR);
        }
    }
    // Check for overlapping requests
    const overlapCheck = await req.dbClient.query(`SELECT id FROM employee_time_off_requests
       WHERE employee_id = $1 AND tenant_id = $2
       AND status NOT IN ('rejected', 'cancelled')
       AND NOT (end_date < $3 OR start_date > $4)`, [employeeId, tenantId, input.startDate, input.endDate]);
    if (overlapCheck.rows.length > 0) {
        throw createAppError('You already have a leave request for this period', 409, ErrorCodes.CONFLICT);
    }
    // Get manager for approval
    const managerResult = await req.dbClient.query('SELECT manager_id FROM employees WHERE id = $1 AND tenant_id = $2', [employeeId, tenantId]);
    const managerId = managerResult.rows[0]?.manager_id;
    // Create request and update balance atomically
    const result = await withTransaction(async (client) => {
        const insertResult = await client.query(`INSERT INTO employee_time_off_requests
          (tenant_id, employee_id, leave_type, start_date, end_date, days_requested,
           half_day_start, half_day_end, reason, status, approver_id,
           medical_certificate_required)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11)
         RETURNING *`, [
            tenantId,
            employeeId,
            input.leaveType,
            input.startDate,
            input.endDate,
            daysRequested,
            input.halfDayStart || false,
            input.halfDayEnd || false,
            input.reason || null,
            managerId,
            typeMetadata?.requiresCertificate || false,
        ]);
        // Update pending days in balance
        if (typeMetadata?.accrued) {
            await client.query(`UPDATE employee_time_off_balances
           SET pending_days = pending_days + $1, updated_at = NOW()
           WHERE employee_id = $2 AND tenant_id = $3 AND leave_type = $4 AND year = $5`, [daysRequested, employeeId, tenantId, input.leaveType, startDate.getFullYear()]);
        }
        return insertResult.rows[0];
    }, tenantId);
    res.status(201).json({
        success: true,
        data: {
            ...result,
            typeLabel: typeMetadata?.label || input.leaveType,
        },
        message: 'Leave request submitted successfully',
    });
}));
// =============================================================================
// GET /api/v1/leave/requests/:id
// Get a specific leave request
// =============================================================================
router.get('/requests/:id', asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const { id } = req.params;
    const result = await req.dbClient.query(`SELECT r.id, r.employee_id, r.leave_type, r.start_date, r.end_date,
        r.days_requested, r.reason, r.status, r.approver_id, r.approved_at,
        r.rejection_reason, r.created_at, r.updated_at, r.tenant_id,
        r.half_day_start, r.half_day_end, r.overlap_approved,
        r.medical_certificate_required, r.medical_certificate_uploaded,
        r.cancellation_requested, r.cancellation_reason, r.cancelled_at, r.cancelled_by,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        e.email as employee_email,
        a.first_name as approver_first_name,
        a.last_name as approver_last_name
       FROM employee_time_off_requests r
       LEFT JOIN employees e ON r.employee_id = e.id
       LEFT JOIN employees a ON r.approver_id = a.id
       WHERE r.id = $1 AND r.tenant_id = $2`, [id, tenantId]);
    if (result.rows.length === 0) {
        throw createAppError('Leave request not found', 404, ErrorCodes.NOT_FOUND);
    }
    res.json({
        success: true,
        data: {
            ...(result.rows[0] || {}),
            typeLabel: LEAVE_TYPE_METADATA[result.rows[0]?.leave_type]
                ?.label,
        },
    });
}));
// =============================================================================
// POST /api/v1/leave/requests/:id/approve
// Approve a leave request
// Story: 4.3 - Leave Request Approval Workflow
// =============================================================================
router.post('/requests/:id/approve', checkPermission(PERMISSIONS.LEAVE_APPROVE), validate(approveLeaveSchema), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const approverId = tenantReq.user.employeeId;
    const { id } = req.params;
    const { notes } = req.body;
    // Get the request
    const requestResult = await req.dbClient.query(`SELECT id, employee_id, leave_type, start_date, end_date, days_requested,
              reason, status, approver_id, approved_at, rejection_reason, created_at,
              updated_at, tenant_id, half_day_start, half_day_end, overlap_approved,
              medical_certificate_required, medical_certificate_uploaded,
              cancellation_requested, cancellation_reason, cancelled_at, cancelled_by
       FROM employee_time_off_requests WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    if (requestResult.rows.length === 0) {
        throw createAppError('Leave request not found', 404, ErrorCodes.NOT_FOUND);
    }
    const request = requestResult.rows[0];
    if (request.status !== 'pending') {
        throw createAppError(`Cannot approve a ${request.status} request`, 400, ErrorCodes.VALIDATION_ERROR);
    }
    // Update request, balance, and log atomically
    const result = await withTransaction(async (client) => {
        // Update request status
        const updateResult = await client.query(`UPDATE employee_time_off_requests
           SET status = 'approved', approver_id = $1, approved_at = NOW(), updated_at = NOW()
           WHERE id = $2 AND tenant_id = $3
           RETURNING *`, [approverId, id, tenantId]);
        // Move from pending to used in balance
        const typeMetadata = LEAVE_TYPE_METADATA[request.leave_type];
        if (typeMetadata?.accrued) {
            const year = new Date(request.start_date).getFullYear();
            await client.query(`UPDATE employee_time_off_balances
             SET pending_days = pending_days - $1,
                 used_days = used_days + $1,
                 updated_at = NOW()
             WHERE employee_id = $2 AND tenant_id = $3 AND leave_type = $4 AND year = $5`, [request.days_requested, request.employee_id, tenantId, request.leave_type, year]);
            // Log transaction
            await client.query(`INSERT INTO leave_balance_transactions
              (tenant_id, balance_id, transaction_type, days_amount, reference_type, reference_id, description, performed_by)
             SELECT $1, b.id, 'usage', $2, 'request', $3, $4, $5
             FROM employee_time_off_balances b
             WHERE b.employee_id = $6 AND b.tenant_id = $1 AND b.leave_type = $7 AND b.year = $8`, [
                tenantId,
                -request.days_requested,
                id,
                notes || 'Leave approved',
                approverId,
                request.employee_id,
                request.leave_type,
                year,
            ]);
        }
        return updateResult.rows[0];
    }, tenantId);
    res.json({
        success: true,
        data: result,
        message: 'Leave request approved',
    });
}));
// =============================================================================
// POST /api/v1/leave/requests/:id/reject
// Reject a leave request
// Story: 4.3 - Leave Request Approval Workflow
// =============================================================================
router.post('/requests/:id/reject', checkPermission(PERMISSIONS.LEAVE_APPROVE), validate(rejectLeaveSchema), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const approverId = tenantReq.user.employeeId;
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) {
        throw createAppError('Rejection reason is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    // Get the request
    const requestResult = await req.dbClient.query(`SELECT id, employee_id, leave_type, start_date, end_date, days_requested,
              reason, status, approver_id, approved_at, rejection_reason, created_at,
              updated_at, tenant_id, half_day_start, half_day_end, overlap_approved,
              medical_certificate_required, medical_certificate_uploaded,
              cancellation_requested, cancellation_reason, cancelled_at, cancelled_by
       FROM employee_time_off_requests WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    if (requestResult.rows.length === 0) {
        throw createAppError('Leave request not found', 404, ErrorCodes.NOT_FOUND);
    }
    const request = requestResult.rows[0];
    if (request.status !== 'pending') {
        throw createAppError(`Cannot reject a ${request.status} request`, 400, ErrorCodes.VALIDATION_ERROR);
    }
    // Update request and restore balance atomically
    const result = await withTransaction(async (client) => {
        // Update request status
        const updateResult = await client.query(`UPDATE employee_time_off_requests
           SET status = 'rejected', approver_id = $1, rejection_reason = $2, updated_at = NOW()
           WHERE id = $3 AND tenant_id = $4
           RETURNING *`, [approverId, reason, id, tenantId]);
        // Remove from pending in balance
        const typeMetadata = LEAVE_TYPE_METADATA[request.leave_type];
        if (typeMetadata?.accrued) {
            const year = new Date(request.start_date).getFullYear();
            await client.query(`UPDATE employee_time_off_balances
             SET pending_days = pending_days - $1, updated_at = NOW()
             WHERE employee_id = $2 AND tenant_id = $3 AND leave_type = $4 AND year = $5`, [request.days_requested, request.employee_id, tenantId, request.leave_type, year]);
        }
        return updateResult.rows[0];
    }, tenantId);
    res.json({
        success: true,
        data: result,
        message: 'Leave request rejected',
    });
}));
// =============================================================================
// POST /api/v1/leave/requests/:id/cancel
// Cancel own leave request
// =============================================================================
router.post('/requests/:id/cancel', validate(cancelLeaveSchema), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const employeeId = tenantReq.user.employeeId;
    const { id } = req.params;
    const { reason } = req.body;
    // Get the request
    const requestResult = await req.dbClient.query(`SELECT id, employee_id, leave_type, start_date, end_date, days_requested,
              reason, status, approver_id, approved_at, rejection_reason, created_at,
              updated_at, tenant_id, half_day_start, half_day_end, overlap_approved,
              medical_certificate_required, medical_certificate_uploaded,
              cancellation_requested, cancellation_reason, cancelled_at, cancelled_by
       FROM employee_time_off_requests WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    if (requestResult.rows.length === 0) {
        throw createAppError('Leave request not found', 404, ErrorCodes.NOT_FOUND);
    }
    const request = requestResult.rows[0];
    // Can only cancel own requests
    if (request.employee_id !== employeeId) {
        throw createAppError('Can only cancel your own requests', 403, ErrorCodes.FORBIDDEN);
    }
    // Can only cancel pending or approved (future) requests
    if (!['pending', 'approved'].includes(request.status)) {
        throw createAppError(`Cannot cancel a ${request.status} request`, 400, ErrorCodes.VALIDATION_ERROR);
    }
    // For approved requests, check if start date is in the future
    if (request.status === 'approved') {
        const startDate = new Date(request.start_date);
        if (startDate <= new Date()) {
            throw createAppError('Cannot cancel a request that has already started', 400, ErrorCodes.VALIDATION_ERROR);
        }
    }
    // Update request and restore balance atomically
    const result = await withTransaction(async (client) => {
        // Update request status
        const updateResult = await client.query(`UPDATE employee_time_off_requests
         SET status = 'cancelled', cancellation_requested = true, cancellation_reason = $1,
             cancelled_at = NOW(), cancelled_by = $2, updated_at = NOW()
         WHERE id = $3 AND tenant_id = $4
         RETURNING *`, [reason || null, employeeId, id, tenantId]);
        // Restore balance
        const typeMetadata = LEAVE_TYPE_METADATA[request.leave_type];
        if (typeMetadata?.accrued) {
            const year = new Date(request.start_date).getFullYear();
            if (request.status === 'pending') {
                await client.query(`UPDATE employee_time_off_balances
             SET pending_days = pending_days - $1, updated_at = NOW()
             WHERE employee_id = $2 AND tenant_id = $3 AND leave_type = $4 AND year = $5`, [request.days_requested, request.employee_id, tenantId, request.leave_type, year]);
            }
            else if (request.status === 'approved') {
                await client.query(`UPDATE employee_time_off_balances
             SET used_days = used_days - $1, updated_at = NOW()
             WHERE employee_id = $2 AND tenant_id = $3 AND leave_type = $4 AND year = $5`, [request.days_requested, request.employee_id, tenantId, request.leave_type, year]);
            }
        }
        return updateResult.rows[0];
    }, tenantId);
    res.json({
        success: true,
        data: result,
        message: 'Leave request cancelled',
    });
}));
// =============================================================================
// GET /api/v1/leave/calendar
// Get leave calendar for team/organization
// Story: 4.4 - Leave Calendar & Team View
// =============================================================================
router.get('/calendar', asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const { startDate, endDate, orgUnitId, teamOnly } = req.query;
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate
        ? new Date(endDate)
        : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const conditions = [
        'r.tenant_id = $1',
        'r.status = $2',
        'r.start_date <= $4',
        'r.end_date >= $3',
    ];
    const params = [
        tenantId,
        'approved',
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0],
    ];
    let paramIndex = 5;
    if (teamOnly === 'true' && tenantReq.user.employeeId) {
        // Only show team members
        conditions.push(`(e.manager_id = $${paramIndex} OR e.id = $${paramIndex})`);
        params.push(tenantReq.user.employeeId);
        paramIndex++;
    }
    if (orgUnitId) {
        conditions.push(`e.org_unit_id = $${paramIndex}`);
        params.push(orgUnitId);
        paramIndex++;
    }
    const result = await req.dbClient.query(`SELECT r.id, r.employee_id, r.leave_type, r.start_date, r.end_date, r.days_requested,
        e.first_name, e.last_name, e.department, d.name as department_name
       FROM employee_time_off_requests r
       JOIN employees e ON r.employee_id = e.id
       LEFT JOIN org_units d ON e.org_unit_id = d.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.start_date`, params);
    // Get holidays in range
    const holidaysResult = await req.dbClient.query(`SELECT date, name, holiday_type
       FROM holidays
       WHERE (tenant_id = $1 OR tenant_id IS NULL)
       AND date >= $2 AND date <= $3
       AND is_active = true
       ORDER BY date`, [tenantId, start.toISOString().split('T')[0], end.toISOString().split('T')[0]]);
    res.json({
        success: true,
        data: {
            dateRange: {
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0],
            },
            leaves: result.rows.map((row) => ({
                ...row,
                typeLabel: LEAVE_TYPE_METADATA[row.leave_type]?.label,
            })),
            holidays: holidaysResult.rows,
        },
    });
}));
// =============================================================================
// GET /api/v1/leave/pending-approvals
// Get pending approval requests for current approver
// Story: 4.3 - Leave Request Approval Workflow
// =============================================================================
router.get('/pending-approvals', checkPermission(PERMISSIONS.LEAVE_APPROVE), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const approverId = tenantReq.user.employeeId;
    // Get team members
    const teamResult = await req.dbClient.query('SELECT id FROM employees WHERE manager_id = $1 AND tenant_id = $2', [approverId, tenantId]);
    const teamIds = teamResult.rows.map((r) => r.id);
    if (teamIds.length === 0) {
        res.json({
            success: true,
            data: [],
            meta: { count: 0 },
        });
        return;
    }
    const result = await req.dbClient.query(`SELECT r.id, r.employee_id, r.leave_type, r.start_date, r.end_date,
          r.days_requested, r.reason, r.status, r.approver_id, r.approved_at,
          r.rejection_reason, r.created_at, r.updated_at, r.tenant_id,
          r.half_day_start, r.half_day_end, r.medical_certificate_required,
          r.cancellation_requested, r.cancelled_at,
          e.first_name as employee_first_name,
          e.last_name as employee_last_name,
          e.email as employee_email
         FROM employee_time_off_requests r
         JOIN employees e ON r.employee_id = e.id
         WHERE r.tenant_id = $1
         AND r.status = 'pending'
         AND r.employee_id = ANY($2)
         ORDER BY r.created_at ASC`, [tenantId, teamIds]);
    res.json({
        success: true,
        data: result.rows.map((row) => ({
            ...row,
            typeLabel: LEAVE_TYPE_METADATA[row.leave_type]?.label,
        })),
        meta: { count: result.rows.length },
    });
}));
// =============================================================================
// GET /api/v1/leave/holidays
// Get holidays for a year
// =============================================================================
router.get('/holidays', asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const { year } = req.query;
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const result = await req.dbClient.query(`SELECT id, tenant_id, name, date, holiday_type, is_recurring,
        is_active, country_code, region, description, created_at
       FROM holidays
       WHERE (tenant_id = $1 OR tenant_id IS NULL)
       AND EXTRACT(YEAR FROM date) = $2
       AND is_active = true
       ORDER BY date`, [tenantId, targetYear]);
    res.json({
        success: true,
        data: result.rows,
    });
}));
// =============================================================================
// GET /api/v1/leave/statistics
// Get leave statistics for dashboard
// Story: 4.7 - Dashboard & Basic HR Metrics
// =============================================================================
router.get('/statistics', checkPermission(PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const { year, orgUnitId } = req.query;
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
    let orgUnitCondition = '';
    const params = [tenantId, targetYear];
    const paramIndex = 3;
    if (orgUnitId) {
        orgUnitCondition = `AND e.org_unit_id = $${paramIndex}`;
        params.push(orgUnitId);
    }
    const [totalEmployeesResult, onLeaveResult, pendingRequestsResult, usageByTypeResult, monthlyUsageResult,] = await Promise.all([
        // Total active employees
        req.dbClient.query(`SELECT COUNT(*) FROM employees e WHERE tenant_id = $1 AND is_active = true ${orgUnitCondition}`, [tenantId, ...(orgUnitId ? [orgUnitId] : [])]),
        // Currently on leave
        req.dbClient.query(`SELECT COUNT(DISTINCT r.employee_id)
           FROM employee_time_off_requests r
           JOIN employees e ON r.employee_id = e.id
           WHERE r.tenant_id = $1
           AND r.status = 'approved'
           AND CURRENT_DATE BETWEEN r.start_date AND r.end_date
           ${orgUnitCondition}`, [tenantId, ...(orgUnitId ? [orgUnitId] : [])]),
        // Pending requests
        req.dbClient.query(`SELECT COUNT(*)
           FROM employee_time_off_requests r
           JOIN employees e ON r.employee_id = e.id
           WHERE r.tenant_id = $1 AND r.status = 'pending' ${orgUnitCondition}`, [tenantId, ...(orgUnitId ? [orgUnitId] : [])]),
        // Usage by type
        req.dbClient.query(`SELECT r.leave_type, SUM(r.days_requested) as total_days, COUNT(*) as request_count
           FROM employee_time_off_requests r
           JOIN employees e ON r.employee_id = e.id
           WHERE r.tenant_id = $1
           AND r.status = 'approved'
           AND EXTRACT(YEAR FROM r.start_date) = $2
           ${orgUnitCondition}
           GROUP BY r.leave_type`, params),
        // Monthly usage
        req.dbClient.query(`SELECT EXTRACT(MONTH FROM r.start_date) as month, SUM(r.days_requested) as total_days
           FROM employee_time_off_requests r
           JOIN employees e ON r.employee_id = e.id
           WHERE r.tenant_id = $1
           AND r.status = 'approved'
           AND EXTRACT(YEAR FROM r.start_date) = $2
           ${orgUnitCondition}
           GROUP BY EXTRACT(MONTH FROM r.start_date)
           ORDER BY month`, params),
    ]);
    res.json({
        success: true,
        data: {
            year: targetYear,
            totalEmployees: parseInt(totalEmployeesResult.rows[0]?.count, 10),
            currentlyOnLeave: parseInt(onLeaveResult.rows[0]?.count, 10),
            pendingRequests: parseInt(pendingRequestsResult.rows[0]?.count, 10),
            usageByType: usageByTypeResult.rows.map((row) => ({
                leaveType: row.leave_type,
                label: LEAVE_TYPE_METADATA[row.leave_type]?.label ||
                    row.leave_type,
                totalDays: parseFloat(row.total_days),
                requestCount: parseInt(row.request_count, 10),
            })),
            monthlyUsage: monthlyUsageResult.rows.map((row) => ({
                month: parseInt(row.month, 10),
                totalDays: parseFloat(row.total_days),
            })),
        },
    });
}));
export default router;
//# sourceMappingURL=leave.js.map