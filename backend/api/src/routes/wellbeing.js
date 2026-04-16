/**
 * Wellbeing Routes
 * Employee wellbeing check-ins and resources
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { createWellbeingCheckinBasicSchema, updateWellbeingCheckinSchema, } from '../schemas/wellbeing.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /wellbeing/dashboard
 * Aggregate wellbeing dashboard for the admin engagement page.
 * Returns overall scores, metrics array, and alerts.
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    // Overall averages from checkins
    const statsResult = await req.dbClient.query(`
      SELECT
        COUNT(DISTINCT employee_id) AS employees_tracking,
        COUNT(*) AS total_checkins,
        ROUND(AVG(mood_score)::numeric, 1) AS avg_mood,
        ROUND(AVG(energy_level)::numeric, 1) AS avg_energy,
        ROUND(AVG(stress_level)::numeric, 1) AS avg_stress,
        ROUND(AVG(work_life_balance)::numeric, 1) AS avg_work_life_balance,
        ROUND(AVG(sleep_quality)::numeric, 1) AS avg_sleep_quality
      FROM wellbeing_checkins
      WHERE tenant_id = $1
      `, [tenantId]);
    const s = statsResult.rows[0] || {};
    const mood = parseFloat(s.avg_mood) || 0;
    const energy = parseFloat(s.avg_energy) || 0;
    const stress = parseFloat(s.avg_stress) || 0;
    const wlb = parseFloat(s.avg_work_life_balance) || 0;
    const sleep = parseFloat(s.avg_sleep_quality) || 0;
    // Scale 1-10 scores to 0-100 for the frontend
    const scale = (v) => Math.round(v * 10);
    const positiveAvg = [mood, energy, wlb, sleep].filter((v) => v > 0);
    const overallRaw = positiveAvg.length > 0 ? positiveAvg.reduce((a, b) => a + b, 0) / positiveAvg.length : 0;
    // Subtract stress contribution (higher stress = lower wellbeing)
    const stressAdjustment = stress > 0 ? 10 - stress : 0;
    const overall = positiveAvg.length > 0
        ? Math.round(((overallRaw + stressAdjustment) / (positiveAvg.length + (stress > 0 ? 1 : 0))) * 10)
        : 0;
    // Resources count
    const resourcesResult = await req.dbClient.query('SELECT COUNT(*) AS cnt FROM wellbeing_resources WHERE tenant_id = $1 AND is_active = true', [tenantId]);
    // Active goals count
    const goalsResult = await req.dbClient.query("SELECT COUNT(*) AS cnt FROM wellbeing_goals WHERE tenant_id = $1 AND status = 'active'", [tenantId]);
    // Build alerts
    const alerts = [];
    if (stress >= 7) {
        alerts.push({
            type: 'Stress',
            message: `Livello medio di stress elevato (${scale(stress)}/100). Considerare interventi.`,
            severity: 'high',
        });
    }
    if (parseInt(s.total_checkins) === 0) {
        alerts.push({
            type: 'Dati',
            message: 'Nessun check-in wellbeing registrato. Incoraggiare i dipendenti a partecipare.',
            severity: 'medium',
        });
    }
    const dashboard = {
        overall_score: overall,
        engagement_score: scale(mood),
        satisfaction_score: scale(wlb),
        stress_index: scale(stress),
        work_life_balance: scale(wlb),
        metrics: [
            { name: 'Umore', value: scale(mood), max: 100 },
            { name: 'Energia', value: scale(energy), max: 100 },
            { name: 'Stress', value: scale(stress), max: 100 },
            { name: 'Work-Life Balance', value: scale(wlb), max: 100 },
            { name: 'Qualità Sonno', value: scale(sleep), max: 100 },
        ].filter((m) => m.value > 0),
        employees_tracking: safeParseInt(s.employees_tracking, { fallback: 0 }),
        total_checkins: safeParseInt(s.total_checkins, { fallback: 0 }),
        active_resources: safeParseInt(resourcesResult.rows[0]?.cnt, { fallback: 0 }),
        active_goals: safeParseInt(goalsResult.rows[0]?.cnt, { fallback: 0 }),
        alerts,
    };
    res.json({ success: true, data: { dashboard } });
}));
/**
 * GET /wellbeing/resources
 * List active wellbeing resources for the tenant.
 */
router.get('/resources', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { category, limit = '50', offset = '0' } = req.query;
    let query = `
      SELECT id, tenant_id, title, description, category, resource_type, url, provider, is_active, created_at
      FROM wellbeing_resources
      WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (category) {
        query += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
    }
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query('SELECT COUNT(*) FROM wellbeing_resources WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL', [tenantId]);
    res.json({
        success: true,
        data: result.rows,
        meta: {
            total: parseInt(countResult.rows[0]?.count),
            limit: safeParseInt(limit, { fallback: 50 }),
            offset: safeParseInt(offset, { fallback: 0 }),
        },
    });
}));
/**
 * GET /wellbeing/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_checkins,
        COUNT(DISTINCT employee_id) as unique_employees,
        ROUND(AVG(mood_score), 2) as avg_mood,
        ROUND(AVG(energy_level), 2) as avg_energy,
        ROUND(AVG(stress_level), 2) as avg_stress,
        ROUND(AVG(work_life_balance), 2) as avg_work_life_balance,
        ROUND(AVG(sleep_quality), 2) as avg_sleep_quality
      FROM wellbeing_checkins WHERE tenant_id = $1
    `, [tenantId]);
    // Get recent trends
    const trends = await req.dbClient.query(`
      SELECT
        COUNT(*) FILTER (WHERE checkin_date > CURRENT_DATE - 7) as last_7d,
        COUNT(*) FILTER (WHERE checkin_date > CURRENT_DATE - 30) as last_30d,
        ROUND(AVG(mood_score) FILTER (WHERE checkin_date > CURRENT_DATE - 7), 2) as mood_7d,
        ROUND(AVG(mood_score) FILTER (WHERE checkin_date > CURRENT_DATE - 30), 2) as mood_30d
      FROM wellbeing_checkins WHERE tenant_id = $1
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            ...(result.rows[0] || {}),
            ...(trends.rows[0] || {}),
        },
    });
}));
/**
 * GET /wellbeing/trends
 * Get wellbeing trends over time
 */
router.get('/trends', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { days = '30' } = req.query;
    const result = await req.dbClient.query(`
      SELECT
        checkin_date,
        COUNT(*) as checkins,
        ROUND(AVG(mood_score), 2) as avg_mood,
        ROUND(AVG(energy_level), 2) as avg_energy,
        ROUND(AVG(stress_level), 2) as avg_stress
      FROM wellbeing_checkins
      WHERE tenant_id = $1 AND checkin_date > CURRENT_DATE - $2::int
      GROUP BY checkin_date
      ORDER BY checkin_date DESC
    `, [tenantId, parseInt(days)]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /wellbeing/checkins
 */
router.get('/checkins', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, from_date, to_date, is_anonymous, limit = '100', offset = '0', } = req.query;
    let query = `
      SELECT wc.id, wc.tenant_id, wc.employee_id, wc.checkin_date, wc.mood_score,
             wc.energy_level, wc.stress_level, wc.work_life_balance, wc.sleep_quality,
             wc.notes, wc.is_anonymous, wc.created_at,
        CASE WHEN wc.is_anonymous THEN 'Anonymous' ELSE e.first_name || ' ' || e.last_name END as employee_name
      FROM wellbeing_checkins wc
      LEFT JOIN employees e ON wc.employee_id = e.id
      WHERE wc.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (employee_id) {
        query += ` AND wc.employee_id = $${paramIndex}`;
        params.push(employee_id);
        paramIndex++;
    }
    if (from_date) {
        query += ` AND wc.checkin_date >= $${paramIndex}`;
        params.push(from_date);
        paramIndex++;
    }
    if (to_date) {
        query += ` AND wc.checkin_date <= $${paramIndex}`;
        params.push(to_date);
        paramIndex++;
    }
    if (is_anonymous !== undefined) {
        query += ` AND wc.is_anonymous = $${paramIndex}`;
        params.push(is_anonymous === 'true');
        paramIndex++;
    }
    query += ` ORDER BY wc.checkin_date DESC, wc.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 100 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query('SELECT COUNT(*) FROM wellbeing_checkins WHERE tenant_id = $1', [tenantId]);
    res.json({
        success: true,
        data: result.rows,
        meta: {
            total: parseInt(countResult.rows[0]?.count),
            limit: safeParseInt(limit, { fallback: 50 }),
            offset: safeParseInt(offset, { fallback: 0 }),
        },
    });
}));
/**
 * GET /wellbeing/checkins/:id
 */
router.get('/checkins/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT wc.id, wc.tenant_id, wc.employee_id, wc.checkin_date, wc.mood_score,
             wc.energy_level, wc.stress_level, wc.work_life_balance, wc.sleep_quality,
             wc.notes, wc.is_anonymous, wc.created_at,
        CASE WHEN wc.is_anonymous THEN 'Anonymous' ELSE e.first_name || ' ' || e.last_name END as employee_name
      FROM wellbeing_checkins wc
      LEFT JOIN employees e ON wc.employee_id = e.id
      WHERE wc.id = $1 AND wc.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Check-in');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /wellbeing/employee/:employeeId
 * Get wellbeing history for an employee
 */
router.get('/employee/:employeeId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'];
    const { limit = '30' } = req.query;
    const result = await req.dbClient.query(`
      SELECT id, tenant_id, employee_id, checkin_date, mood_score, energy_level,
             stress_level, work_life_balance, sleep_quality, notes, is_anonymous, created_at
      FROM wellbeing_checkins
      WHERE tenant_id = $1 AND employee_id = $2
      ORDER BY checkin_date DESC
      LIMIT $3
    `, [tenantId, employeeId, safeParseInt(limit, { fallback: 50 })]);
    // Get employee averages
    const averages = await req.dbClient.query(`
      SELECT
        ROUND(AVG(mood_score), 2) as avg_mood,
        ROUND(AVG(energy_level), 2) as avg_energy,
        ROUND(AVG(stress_level), 2) as avg_stress,
        ROUND(AVG(work_life_balance), 2) as avg_work_life_balance
      FROM wellbeing_checkins
      WHERE tenant_id = $1 AND employee_id = $2
    `, [tenantId, employeeId]);
    res.json({
        success: true,
        data: {
            checkins: result.rows,
            averages: averages.rows[0],
        },
    });
}));
/**
 * POST /wellbeing/checkins
 */
router.post('/checkins', validate(createWellbeingCheckinBasicSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, mood_score, energy_level, stress_level, work_life_balance, sleep_quality, notes, is_anonymous = false, } = req.body;
    if (!employee_id) {
        throw Errors.badRequest('employee_id is required');
    }
    // Check for existing checkin today
    const existing = await req.dbClient.query(`
      SELECT id FROM wellbeing_checkins
      WHERE employee_id = $1 AND checkin_date = CURRENT_DATE
    `, [employee_id]);
    if (existing.rows.length > 0) {
        throw Errors.conflict('Check-in already exists for today');
    }
    const result = await req.dbClient.query(`
      INSERT INTO wellbeing_checkins (tenant_id, employee_id, checkin_date, mood_score, energy_level,
        stress_level, work_life_balance, sleep_quality, notes, is_anonymous, created_at)
      VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `, [
        tenantId,
        employee_id,
        mood_score,
        energy_level,
        stress_level,
        work_life_balance,
        sleep_quality,
        notes,
        is_anonymous,
    ]);
    res
        .status(201)
        .json({ success: true, data: result.rows[0] || null, message: 'Check-in created' });
}));
/**
 * PATCH /wellbeing/checkins/:id
 */
router.patch('/checkins/:id', validate(updateWellbeingCheckinSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id FROM wellbeing_checkins WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Check-in');
    }
    const allowedFields = [
        'mood_score',
        'energy_level',
        'stress_level',
        'work_life_balance',
        'sleep_quality',
        'notes',
    ];
    const updates = [];
    const values = [];
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
    const result = await req.dbClient.query(`UPDATE wellbeing_checkins SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, [...values, id, tenantId]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Check-in updated' });
}));
/**
 * DELETE /wellbeing/checkins/:id
 */
router.delete('/checkins/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query('DELETE FROM wellbeing_checkins WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Check-in');
    }
    res.json({ success: true, message: 'Check-in deleted' });
}));
export default router;
//# sourceMappingURL=wellbeing.js.map