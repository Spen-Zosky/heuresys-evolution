/**
 * Attendance Routes
 * CRUD operations for employee attendance tracking
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { createAttendanceSchema, clockInSchema, clockOutSchema, updateAttendanceSchema, validateAttendanceSchema, } from '../schemas/hr-operations.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { buildMeta } from '../utils/pagination.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /attendance
 * List attendance records with pagination
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const limit = safeParseInt(req.query.limit, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset, { fallback: 0 });
    const employeeId = req.query.employee_id;
    let whereClause = 'WHERE e.tenant_id = $1';
    const params = [tenantId];
    if (employeeId) {
        params.push(employeeId);
        whereClause += ` AND ea.employee_id = $${params.length}`;
    }
    const [countResult, dataResult] = await Promise.all([
        req.dbClient.query(`SELECT COUNT(*) as total FROM employee_attendance ea JOIN employees e ON ea.employee_id = e.id ${whereClause}`, params),
        req.dbClient.query(`SELECT ea.id, ea.employee_id, ea.attendance_date, ea.clock_in, ea.clock_out,
                ea.hours_regular, ea.hours_overtime, ea.hours_total, ea.status, ea.source,
                e.first_name, e.last_name
         FROM employee_attendance ea
         JOIN employees e ON ea.employee_id = e.id
         ${whereClause}
         ORDER BY ea.attendance_date DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
    ]);
    res.json({
        success: true,
        data: dataResult.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.total), limit, offset),
    });
}));
/**
 * GET /attendance/stats
 * Get attendance statistics overview
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { year, month } = req.query;
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    const result = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT employee_id) as employees_tracked,
        ROUND(SUM(hours_regular)::numeric, 1) as total_regular_hours,
        ROUND(SUM(hours_overtime)::numeric, 1) as total_overtime_hours,
        ROUND(SUM(hours_total)::numeric, 1) as total_hours,
        COUNT(*) FILTER (WHERE status = 'present') as present_days,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_days,
        COUNT(*) FILTER (WHERE status = 'late') as late_days,
        COUNT(*) FILTER (WHERE is_validated = true) as validated_count
      FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      WHERE e.tenant_id = $1
      AND EXTRACT(YEAR FROM ea.attendance_date) = $2
      AND EXTRACT(MONTH FROM ea.attendance_date) = $3
    `, [tenantId, targetYear, targetMonth]);
    res.json({
        success: true,
        data: {
            year: targetYear,
            month: targetMonth,
            ...(result.rows[0] || {}),
        },
    });
}));
/**
 * GET /attendance
 * List attendance records with filtering
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, status, date_from, date_to, limit = '50', offset = '0', } = req.query;
    const limitNum = safeParseInt(limit, { fallback: 50, min: 1, max: 1000 });
    const offsetNum = Math.max(0, safeParseInt(offset, { fallback: 0 }));
    let query = `
      SELECT ea.*,
        e.first_name || ' ' || e.last_name as employee_name,
        d.name as department_name
      FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE e.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (employee_id) {
        query += ` AND ea.employee_id = $${paramIndex++}`;
        params.push(employee_id);
    }
    if (status) {
        query += ` AND ea.status = $${paramIndex++}`;
        params.push(status);
    }
    if (date_from) {
        query += ` AND ea.attendance_date >= $${paramIndex++}`;
        params.push(date_from);
    }
    if (date_to) {
        query += ` AND ea.attendance_date <= $${paramIndex++}`;
        params.push(date_to);
    }
    query += ` ORDER BY ea.attendance_date DESC, e.last_name LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limitNum, offsetNum);
    const result = await req.dbClient.query(query, params);
    // Get count
    let countQuery = `
      SELECT COUNT(*)
      FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      WHERE e.tenant_id = $1
    `;
    const countParams = [tenantId];
    let countIndex = 2;
    if (employee_id) {
        countQuery += ` AND ea.employee_id = $${countIndex++}`;
        countParams.push(employee_id);
    }
    if (status) {
        countQuery += ` AND ea.status = $${countIndex++}`;
        countParams.push(status);
    }
    const countResult = await req.dbClient.query(countQuery, countParams);
    res.json({
        success: true,
        data: result.rows,
        meta: {
            total: safeParseInt(countResult.rows[0]?.count, { fallback: 0 }),
            limit: limitNum,
            offset: offsetNum,
        },
    });
}));
/**
 * GET /attendance/:id
 * Get single attendance record
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT ea.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        d.name as department_name
      FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE ea.id = $1 AND e.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Attendance record');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /attendance/employee/:employeeId/summary
 * Get attendance summary for an employee
 */
router.get('/employee/:employeeId/summary', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'];
    const { year, month } = req.query;
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month, 10) : null;
    let dateCondition = `EXTRACT(YEAR FROM ea.attendance_date) = $3`;
    const params = [employeeId, tenantId, targetYear];
    if (targetMonth) {
        dateCondition += ` AND EXTRACT(MONTH FROM ea.attendance_date) = $4`;
        params.push(targetMonth);
    }
    const result = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_days,
        ROUND(SUM(hours_regular)::numeric, 1) as regular_hours,
        ROUND(SUM(hours_overtime)::numeric, 1) as overtime_hours,
        ROUND(SUM(hours_total)::numeric, 1) as total_hours,
        ROUND(AVG(hours_total)::numeric, 1) as avg_daily_hours,
        COUNT(*) FILTER (WHERE status = 'present') as present_days,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_days,
        COUNT(*) FILTER (WHERE status = 'late') as late_days
      FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      WHERE ea.employee_id = $1 AND e.tenant_id = $2 AND ${dateCondition}
    `, params);
    res.json({
        success: true,
        data: {
            employee_id: employeeId,
            year: targetYear,
            month: targetMonth,
            ...(result.rows[0] || {}),
        },
    });
}));
// ============================================================================
// WRITE OPERATIONS
// ============================================================================
/**
 * POST /attendance
 * Create a new attendance record (clock in)
 */
router.post('/', validate(createAttendanceSchema), asyncHandler(async (req, res) => {
    try {
        const tenantId = getTenantIdOrThrow(req);
        const { employee_id, attendance_date, clock_in, clock_out, break_start, break_end, hours_regular, hours_overtime, hours_night, hours_holiday, status = 'present', source = 'manual', source_reference, notes, } = req.body;
        // Validate required fields
        if (!employee_id) {
            throw Errors.badRequest('employee_id is required');
        }
        if (!attendance_date) {
            throw Errors.badRequest('attendance_date is required');
        }
        // Verify employee belongs to tenant
        const employeeCheck = await req.dbClient.query('SELECT id FROM employees WHERE id = $1 AND tenant_id = $2', [employee_id, tenantId]);
        if (employeeCheck.rows.length === 0) {
            throw Errors.notFound('Employee');
        }
        // Insert attendance record
        const result = await req.dbClient.query(`
      INSERT INTO employee_attendance (
        tenant_id, employee_id, attendance_date, clock_in, clock_out,
        break_start, break_end, hours_regular, hours_overtime,
        hours_night, hours_holiday, status, source, source_reference, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
            tenantId,
            employee_id,
            attendance_date,
            clock_in,
            clock_out,
            break_start,
            break_end,
            hours_regular || 0,
            hours_overtime || 0,
            hours_night || 0,
            hours_holiday || 0,
            status,
            source,
            source_reference,
            notes,
        ]);
        res.status(201).json({
            success: true,
            data: result.rows[0] || null,
            message: 'Attendance record created successfully',
        });
    }
    catch (error) {
        // Handle unique constraint violation
        if (error.code === '23505') {
            throw Errors.conflict('Attendance record already exists for this employee on this date');
        }
        throw error;
    }
}));
/**
 * POST /attendance/clock-in
 * Quick clock-in for current time
 */
router.post('/clock-in', validate(clockInSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, notes } = req.body;
    if (!employee_id) {
        throw Errors.badRequest('employee_id is required');
    }
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0];
    // Check if already clocked in today
    const existing = await req.dbClient.query(`
      SELECT ea.id, ea.clock_in, ea.clock_out FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      WHERE ea.employee_id = $1 AND ea.attendance_date = $2 AND e.tenant_id = $3
    `, [employee_id, today, tenantId]);
    if (existing.rows.length > 0) {
        if (existing.rows[0].clock_in && !existing.rows[0].clock_out) {
            throw Errors.badRequest('Already clocked in today. Use clock-out endpoint.');
        }
    }
    // Create or update attendance record
    const result = await req.dbClient.query(`
      INSERT INTO employee_attendance (tenant_id, employee_id, attendance_date, clock_in, status, source, notes)
      VALUES ($1, $2, $3, $4, 'present', 'system', $5)
      ON CONFLICT (tenant_id, employee_id, attendance_date)
      DO UPDATE SET clock_in = $4, status = 'present', updated_at = NOW()
      RETURNING *
    `, [tenantId, employee_id, today, currentTime, notes]);
    res.json({
        success: true,
        data: result.rows[0] || null,
        message: 'Clocked in successfully',
    });
}));
/**
 * POST /attendance/clock-out
 * Quick clock-out for current time
 */
router.post('/clock-out', validate(clockOutSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, notes } = req.body;
    if (!employee_id) {
        throw Errors.badRequest('employee_id is required');
    }
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0];
    // Check if clocked in today
    const existing = await req.dbClient.query(`
      SELECT ea.id, ea.clock_in, ea.clock_out FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      WHERE ea.employee_id = $1 AND ea.attendance_date = $2 AND e.tenant_id = $3
    `, [employee_id, today, tenantId]);
    if (existing.rows.length === 0 || !existing.rows[0].clock_in) {
        throw Errors.badRequest('Must clock in before clocking out');
    }
    if (existing.rows[0].clock_out) {
        throw Errors.badRequest('Already clocked out today');
    }
    // Calculate hours worked
    const clockIn = existing.rows[0]?.clock_in;
    const clockInDate = new Date(`${today}T${clockIn}`);
    const clockOutDate = new Date(`${today}T${currentTime}`);
    const hoursWorked = (clockOutDate.getTime() - clockInDate.getTime()) / (1000 * 60 * 60);
    const hoursRegular = Math.min(hoursWorked, 8);
    const hoursOvertime = Math.max(0, hoursWorked - 8);
    // Update attendance record
    const result = await req.dbClient.query(`
      UPDATE employee_attendance
      SET clock_out = $1, hours_regular = $2, hours_overtime = $3, updated_at = NOW(),
          notes = CASE WHEN notes IS NULL THEN $4 ELSE notes || E'\n' || $4 END
      WHERE id = $5 AND tenant_id = $6
      RETURNING *
    `, [
        currentTime,
        hoursRegular.toFixed(2),
        hoursOvertime.toFixed(2),
        notes || '',
        existing.rows[0]?.id,
        tenantId,
    ]);
    res.json({
        success: true,
        data: result.rows[0] || null,
        message: 'Clocked out successfully',
    });
}));
/**
 * PATCH /attendance/:id
 * Update an attendance record
 */
router.patch('/:id', validate(updateAttendanceSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    if (!id) {
        throw Errors.badRequest('Attendance ID is required');
    }
    const { clock_in, clock_out, break_start, break_end, hours_regular, hours_overtime, hours_night, hours_holiday, status, is_validated, validated_by, notes, } = req.body;
    // Verify record exists and belongs to tenant
    const existing = await req.dbClient.query(`
      SELECT ea.id FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      WHERE ea.id = $1 AND e.tenant_id = $2
    `, [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Attendance record');
    }
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    if (clock_in !== undefined) {
        updates.push(`clock_in = $${paramIndex++}`);
        values.push(clock_in);
    }
    if (clock_out !== undefined) {
        updates.push(`clock_out = $${paramIndex++}`);
        values.push(clock_out);
    }
    if (break_start !== undefined) {
        updates.push(`break_start = $${paramIndex++}`);
        values.push(break_start);
    }
    if (break_end !== undefined) {
        updates.push(`break_end = $${paramIndex++}`);
        values.push(break_end);
    }
    if (hours_regular !== undefined) {
        updates.push(`hours_regular = $${paramIndex++}`);
        values.push(hours_regular);
    }
    if (hours_overtime !== undefined) {
        updates.push(`hours_overtime = $${paramIndex++}`);
        values.push(hours_overtime);
    }
    if (hours_night !== undefined) {
        updates.push(`hours_night = $${paramIndex++}`);
        values.push(hours_night);
    }
    if (hours_holiday !== undefined) {
        updates.push(`hours_holiday = $${paramIndex++}`);
        values.push(hours_holiday);
    }
    if (status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
    }
    if (is_validated !== undefined) {
        updates.push(`is_validated = $${paramIndex++}`);
        values.push(is_validated);
        if (is_validated && validated_by) {
            updates.push(`validated_by = $${paramIndex++}`);
            values.push(validated_by);
            updates.push(`validated_at = NOW()`);
        }
    }
    if (notes !== undefined) {
        updates.push(`notes = $${paramIndex++}`);
        values.push(notes);
    }
    if (updates.length === 0) {
        throw Errors.badRequest('No fields to update');
    }
    updates.push('updated_at = NOW()');
    values.push(id, tenantId);
    const result = await req.dbClient.query(`
      UPDATE employee_attendance
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `, values);
    res.json({
        success: true,
        data: result.rows[0] || null,
        message: 'Attendance record updated successfully',
    });
}));
/**
 * PATCH /attendance/:id/validate
 * Validate an attendance record (manager approval)
 */
router.patch('/:id/validate', validate(validateAttendanceSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    if (!id) {
        throw Errors.badRequest('Attendance ID is required');
    }
    const { validated_by, notes } = req.body;
    // Verify record exists and belongs to tenant
    const existing = await req.dbClient.query(`
      SELECT ea.id, ea.is_validated FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      WHERE ea.id = $1 AND e.tenant_id = $2
    `, [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Attendance record');
    }
    if (existing.rows[0].is_validated) {
        throw Errors.badRequest('Attendance record already validated');
    }
    const result = await req.dbClient.query(`
      UPDATE employee_attendance
      SET is_validated = true, validated_by = $1, validated_at = NOW(),
          notes = CASE WHEN notes IS NULL THEN $2 ELSE notes || E'\n' || $2 END,
          updated_at = NOW()
      WHERE id = $3 AND tenant_id = $4
      RETURNING *
    `, [validated_by, notes || 'Validated', id, tenantId]);
    res.json({
        success: true,
        data: result.rows[0] || null,
        message: 'Attendance record validated successfully',
    });
}));
/**
 * DELETE /attendance/:id
 * Delete an attendance record
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    if (!id) {
        throw Errors.badRequest('Attendance ID is required');
    }
    // Verify record exists and belongs to tenant
    const existing = await req.dbClient.query(`
      SELECT ea.id, ea.is_validated FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      WHERE ea.id = $1 AND e.tenant_id = $2
    `, [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Attendance record');
    }
    // Prevent deletion of validated records
    if (existing.rows[0].is_validated) {
        throw Errors.badRequest('Cannot delete validated attendance records. Contact administrator.');
    }
    await req.dbClient.query('DELETE FROM employee_attendance WHERE id = $1 AND tenant_id = $2', [
        id,
        tenantId,
    ]);
    res.json({
        success: true,
        message: 'Attendance record deleted successfully',
    });
}));
export default router;
//# sourceMappingURL=attendance.js.map