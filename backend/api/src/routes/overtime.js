/**
 * Overtime Routes
 * CRUD operations for employee overtime tracking
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { uuidParamSchema } from '../schemas/common.js';
import { overtimeStatsQuerySchema, overtimeByTypeQuerySchema, overtimeListQuerySchema, } from '../schemas/workforce-analytics.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /overtime/stats
 * Get overtime statistics overview
 */
router.get('/stats', validate(overtimeStatsQuerySchema, 'query'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { year, month } = req.query;
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month, 10) : null;
    let dateCondition = `EXTRACT(YEAR FROM eo.overtime_date) = $2`;
    const params = [tenantId, targetYear];
    if (targetMonth) {
        dateCondition += ` AND EXTRACT(MONTH FROM eo.overtime_date) = $3`;
        params.push(targetMonth);
    }
    const result = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT eo.employee_id) as employees_with_overtime,
        ROUND(SUM(eo.hours)::numeric, 1) as total_overtime_hours,
        ROUND(AVG(eo.hours)::numeric, 1) as avg_hours_per_record,
        ROUND(SUM(eo.total_compensation)::numeric, 2) as total_compensation,
        COUNT(*) FILTER (WHERE eo.status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE eo.status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE eo.status = 'rejected') as rejected_count,
        COUNT(DISTINCT eo.overtime_type) as overtime_types
      FROM employee_overtime eo
      JOIN employees e ON eo.employee_id = e.id
      WHERE e.tenant_id = $1 AND ${dateCondition}
    `, params);
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
 * GET /overtime/by-type
 * Get overtime breakdown by type
 */
router.get('/by-type', validate(overtimeByTypeQuerySchema, 'query'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { year } = req.query;
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const result = await req.dbClient.query(`
      SELECT
        eo.overtime_type,
        COUNT(*) as record_count,
        ROUND(SUM(eo.hours)::numeric, 1) as total_hours,
        ROUND(AVG(eo.rate_multiplier)::numeric, 2) as avg_rate_multiplier,
        ROUND(SUM(eo.total_compensation)::numeric, 2) as total_compensation
      FROM employee_overtime eo
      JOIN employees e ON eo.employee_id = e.id
      WHERE e.tenant_id = $1
      AND EXTRACT(YEAR FROM eo.overtime_date) = $2
      GROUP BY eo.overtime_type
      ORDER BY total_hours DESC
    `, [tenantId, targetYear]);
    res.json({
        success: true,
        data: result.rows,
    });
}));
/**
 * GET /overtime
 * List overtime records with filtering
 */
router.get('/', validate(overtimeListQuerySchema, 'query'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, status, overtime_type, date_from, date_to, limit = '50', offset = '0', } = req.query;
    const limitNum = safeParseInt(limit, { fallback: 50, min: 1, max: 1000 });
    const offsetNum = Math.max(0, safeParseInt(offset, { fallback: 0 }));
    let query = `
      SELECT eo.*,
        e.first_name || ' ' || e.last_name as employee_name,
        d.name as department_name
      FROM employee_overtime eo
      JOIN employees e ON eo.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE e.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (employee_id) {
        query += ` AND eo.employee_id = $${paramIndex++}`;
        params.push(employee_id);
    }
    if (status) {
        query += ` AND eo.status = $${paramIndex++}`;
        params.push(status);
    }
    if (overtime_type) {
        query += ` AND eo.overtime_type = $${paramIndex++}`;
        params.push(overtime_type);
    }
    if (date_from) {
        query += ` AND eo.overtime_date >= $${paramIndex++}`;
        params.push(date_from);
    }
    if (date_to) {
        query += ` AND eo.overtime_date <= $${paramIndex++}`;
        params.push(date_to);
    }
    query += ` ORDER BY eo.overtime_date DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limitNum, offsetNum);
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query(`
      SELECT COUNT(*)
      FROM employee_overtime eo
      JOIN employees e ON eo.employee_id = e.id
      WHERE e.tenant_id = $1
    `, [tenantId]);
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
 * GET /overtime/:id
 * Get single overtime record
 */
router.get('/:id', validate(uuidParamSchema, 'params'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT eo.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        d.name as department_name,
        r.first_name || ' ' || r.last_name as requested_by_name,
        a.first_name || ' ' || a.last_name as approved_by_name
      FROM employee_overtime eo
      JOIN employees e ON eo.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      LEFT JOIN employees r ON eo.requested_by = r.id
      LEFT JOIN employees a ON eo.approved_by = a.id
      WHERE eo.id = $1 AND e.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Overtime record');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
export default router;
//# sourceMappingURL=overtime.js.map