/**
 * Wellbeing Dashboard Routes
 * Extended wellbeing features with burnout assessment
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { createWellbeingCheckinSchema, createBurnoutAssessmentSchema, createWellbeingGoalSchema, } from '../schemas/hr-operations-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /wellbeing-extended/dashboard
 * Get wellbeing dashboard with all metrics
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    // Overall wellbeing stats
    const statsResult = await req.dbClient.query(`
      SELECT
        COUNT(DISTINCT employee_id) as employees_tracking,
        AVG(mood_score)::numeric(3,2) as avg_mood,
        AVG(energy_level)::numeric(3,2) as avg_energy,
        AVG(stress_level)::numeric(3,2) as avg_stress,
        AVG(work_life_balance)::numeric(3,2) as avg_work_life_balance,
        AVG(sleep_quality)::numeric(3,2) as avg_sleep_quality,
        COUNT(*) as total_checkins,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as checkins_this_week
      FROM wellbeing_checkins
      WHERE tenant_id = $1
    `, [tenantId]);
    // Burnout risk distribution
    const burnoutResult = await req.dbClient.query(`
      SELECT
        overall_risk,
        COUNT(*) as count
      FROM burnout_assessments
      WHERE tenant_id = $1
      AND assessment_date > NOW() - INTERVAL '30 days'
      GROUP BY overall_risk
    `, [tenantId]);
    // Weekly trend
    const trendResult = await req.dbClient.query(`
      SELECT
        DATE_TRUNC('week', created_at) as week,
        AVG(mood_score)::numeric(3,2) as avg_mood,
        AVG(energy_level)::numeric(3,2) as avg_energy,
        AVG(stress_level)::numeric(3,2) as avg_stress,
        COUNT(*) as checkins
      FROM wellbeing_checkins
      WHERE tenant_id = $1
      AND created_at > NOW() - INTERVAL '12 weeks'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY week
    `, [tenantId]);
    // OrgUnit comparison
    const deptResult = await req.dbClient.query(`
      SELECT
        d.name as department,
        AVG(w.mood_score)::numeric(3,2) as avg_mood,
        AVG(w.stress_level)::numeric(3,2) as avg_stress,
        COUNT(DISTINCT w.employee_id) as employees
      FROM wellbeing_checkins w
      JOIN employees e ON e.id = w.employee_id
      JOIN org_units d ON d.id = e.org_unit_id
      WHERE w.tenant_id = $1
      AND w.created_at > NOW() - INTERVAL '30 days'
      GROUP BY d.id, d.name
      ORDER BY avg_mood DESC
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            company_average: statsResult.rows[0],
            burnout_distribution: burnoutResult.rows,
            trends: trendResult.rows,
            team_metrics: deptResult.rows,
        },
    });
}));
/**
 * GET /wellbeing-extended/checkins
 * Get employee wellbeing check-ins
 */
router.get('/checkins', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, from_date, to_date, limit = '50' } = req.query;
    let query = `
      SELECT
        wc.*,
        e.first_name || ' ' || e.last_name as employee_name,
        d.name as department
      FROM wellbeing_checkins wc
      JOIN employees e ON e.id = wc.employee_id
      LEFT JOIN org_units d ON d.id = e.org_unit_id
      WHERE wc.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (employee_id) {
        query += ` AND wc.employee_id = $${paramIndex++}`;
        params.push(employee_id);
    }
    if (from_date) {
        query += ` AND wc.checkin_date >= $${paramIndex++}`;
        params.push(from_date);
    }
    if (to_date) {
        query += ` AND wc.checkin_date <= $${paramIndex++}`;
        params.push(to_date);
    }
    query += ` ORDER BY wc.checkin_date DESC LIMIT $${paramIndex}`;
    params.push(safeParseInt(limit, { fallback: 50 }));
    const result = await req.dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
    });
}));
/**
 * POST /wellbeing-extended/checkins
 * Submit a wellbeing check-in
 */
router.post('/checkins', validate(createWellbeingCheckinSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, mood_score, energy_level, stress_level, work_life_balance, sleep_quality, notes, is_anonymous, } = req.body;
    if (!employee_id) {
        throw Errors.badRequest('employee_id is required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO wellbeing_checkins (
        tenant_id, employee_id, checkin_date,
        mood_score, energy_level, stress_level,
        work_life_balance, sleep_quality, notes, is_anonymous,
        created_at
      ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (employee_id, checkin_date) DO UPDATE SET
        mood_score = EXCLUDED.mood_score,
        energy_level = EXCLUDED.energy_level,
        stress_level = EXCLUDED.stress_level,
        work_life_balance = EXCLUDED.work_life_balance,
        sleep_quality = EXCLUDED.sleep_quality,
        notes = EXCLUDED.notes
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
        is_anonymous || false,
    ]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /wellbeing-extended/burnout-risk
 * Get burnout risk assessments
 */
router.get('/burnout-risk', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, risk_level } = req.query;
    let query = `
      SELECT
        ba.*,
        e.first_name || ' ' || e.last_name as employee_name,
        d.name as department
      FROM burnout_assessments ba
      JOIN employees e ON e.id = ba.employee_id
      LEFT JOIN org_units d ON d.id = e.org_unit_id
      WHERE ba.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (employee_id) {
        query += ` AND ba.employee_id = $${paramIndex++}`;
        params.push(employee_id);
    }
    if (risk_level) {
        query += ` AND ba.overall_risk = $${paramIndex++}`;
        params.push(risk_level);
    }
    query += ` ORDER BY ba.assessment_date DESC LIMIT 100`;
    const result = await req.dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
    });
}));
/**
 * POST /wellbeing-extended/burnout-risk/assess
 * Submit burnout assessment (MBI-based)
 */
router.post('/burnout-risk/assess', validate(createBurnoutAssessmentSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, exhaustion_score, // 1-10
    cynicism_score, // 1-10
    inefficacy_score, // 1-10
    workload_factor, // 1-5
    autonomy_factor, // 1-5
    recognition_factor, // 1-5
     } = req.body;
    if (!employee_id) {
        throw Errors.badRequest('employee_id is required');
    }
    // Calculate overall risk
    const avgScore = (exhaustion_score + cynicism_score + inefficacy_score) / 3;
    let overall_risk = 'low';
    if (avgScore >= 7)
        overall_risk = 'critical';
    else if (avgScore >= 5)
        overall_risk = 'high';
    else if (avgScore >= 3)
        overall_risk = 'moderate';
    const recommendations = [];
    if (exhaustion_score >= 7) {
        recommendations.push({
            area: 'exhaustion',
            action: 'Considera una pausa o riduzione del carico di lavoro',
            priority: 'high',
        });
    }
    if (cynicism_score >= 7) {
        recommendations.push({
            area: 'engagement',
            action: 'Confronto con manager per riallineamento obiettivi',
            priority: 'high',
        });
    }
    if (autonomy_factor <= 2) {
        recommendations.push({
            area: 'autonomy',
            action: 'Richiedi maggiore autonomia decisionale',
            priority: 'medium',
        });
    }
    if (recognition_factor <= 2) {
        recommendations.push({
            area: 'recognition',
            action: 'Discuti con HR su feedback e riconoscimenti',
            priority: 'medium',
        });
    }
    const result = await req.dbClient.query(`
      INSERT INTO burnout_assessments (
        tenant_id, employee_id, assessment_date,
        exhaustion_score, cynicism_score, inefficacy_score,
        overall_risk, workload_factor, autonomy_factor,
        recognition_factor, recommendations, created_at
      ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `, [
        tenantId,
        employee_id,
        exhaustion_score,
        cynicism_score,
        inefficacy_score,
        overall_risk,
        workload_factor,
        autonomy_factor,
        recognition_factor,
        JSON.stringify(recommendations),
    ]);
    res.status(201).json({
        success: true,
        data: result.rows[0] || null,
        risk_level: overall_risk,
        recommendations,
    });
}));
/**
 * GET /wellbeing-extended/goals
 * Get wellbeing goals for employee
 */
router.get('/goals', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, status } = req.query;
    let query = `
      SELECT wg.*
      FROM wellbeing_goals wg
      WHERE wg.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (employee_id) {
        query += ` AND wg.employee_id = $${paramIndex++}`;
        params.push(employee_id);
    }
    if (status) {
        query += ` AND wg.status = $${paramIndex++}`;
        params.push(status);
    }
    query += ` ORDER BY wg.created_at DESC`;
    const result = await req.dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
    });
}));
/**
 * POST /wellbeing-extended/goals
 * Create a wellbeing goal
 */
router.post('/goals', validate(createWellbeingGoalSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, goal_type, title, description, target_value, unit, target_date } = req.body;
    if (!employee_id || !title) {
        throw Errors.badRequest('employee_id and title are required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO wellbeing_goals (
        tenant_id, employee_id, goal_type, title, description,
        target_value, current_value, unit, start_date, target_date,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, CURRENT_DATE, $8, 'active', NOW(), NOW())
      RETURNING *
    `, [
        tenantId,
        employee_id,
        goal_type || 'general',
        title,
        description,
        target_value,
        unit,
        target_date,
    ]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /wellbeing-extended/trends/:employeeId
 * Get personal wellbeing trends
 */
router.get('/trends/:employeeId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'];
    const { days = '30' } = req.query;
    const result = await req.dbClient.query(`
      SELECT
        checkin_date,
        mood_score,
        energy_level,
        stress_level,
        work_life_balance,
        sleep_quality
      FROM wellbeing_checkins
      WHERE employee_id = $1 AND tenant_id = $2
      AND checkin_date > CURRENT_DATE - $3::int
      ORDER BY checkin_date
    `, [employeeId, tenantId, parseInt(days)]);
    // Calculate moving averages
    const data = result.rows;
    const summary = {
        mood_avg: data.reduce((s, r) => s + (r.mood_score || 0), 0) / (data.length || 1),
        energy_avg: data.reduce((s, r) => s + (r.energy_level || 0), 0) / (data.length || 1),
        stress_avg: data.reduce((s, r) => s + (r.stress_level || 0), 0) / (data.length || 1),
        checkins_count: data.length,
    };
    res.json({
        success: true,
        data: {
            daily: data,
            summary,
        },
    });
}));
export default router;
//# sourceMappingURL=wellbeing-dashboard.js.map