/**
 * Workforce Planning Routes
 * Sprint 2025-04 - S-ONTO-03-10
 *
 * Workforce planning with future skill projections
 */
import { Router } from 'express';
import { pool } from '../config/database.js';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { WorkforcePlanningService } from '../services/workforce-planning/index.js';
import { validate } from '../middleware/validate.js';
import { gapRiskSchema, hiringRecommendationsSchema, trainingInvestmentsSchema, createWorkforcePlanSchema, updateWorkforcePlanStatusSchema, simulateWorkforceSchema, } from '../schemas/hr-operations-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
const router = Router();
const planningService = new WorkforcePlanningService(pool);
router.use(requireTenant);
// All workforce planning operations require HR_MANAGER role
router.use(requirePermission('WORKFORCE_INTELLIGENCE', 'VIEW'));
/**
 * GET /workforce-planning/inventory
 * Get current skill inventory projection
 */
router.get('/inventory', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const orgUnitId = req.query['org_unit_id'];
    const skillIds = req.query['skill_ids']
        ? req.query['skill_ids'].split(',')
        : undefined;
    const minProficiency = req.query['min_proficiency']
        ? parseFloat(req.query['min_proficiency'])
        : undefined;
    const inventory = await planningService.getSkillInventory(tenantId, {
        ...(orgUnitId ? { org_unit_id: orgUnitId } : {}),
        ...(skillIds ? { skill_ids: skillIds } : {}),
        ...(minProficiency !== undefined ? { min_proficiency: minProficiency } : {}),
    });
    res.json({
        success: true,
        data: inventory,
        count: inventory.length,
    });
}));
/**
 * GET /workforce-planning/gap-risk
 * Get current skill gaps and risk assessment overview
 */
router.get('/gap-risk', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const orgUnitId = req.query['org_unit_id'];
    const deptFilter = orgUnitId ? 'AND es.org_unit_id = $2' : '';
    const params = [tenantId];
    if (orgUnitId)
        params.push(orgUnitId);
    const result = await req.dbClient.query(`
      WITH skill_coverage AS (
        SELECT
          s.id AS skill_id,
          s.preferred_label AS skill_name,
          COUNT(DISTINCT es.employee_id) AS employees_with_skill,
          AVG(es.proficiency_level) AS avg_proficiency,
          (SELECT COUNT(*) FROM employees e WHERE e.tenant_id = $1 AND e.is_active = true
            ${orgUnitId ? 'AND e.org_unit_id = $2' : ''}) AS total_employees
        FROM esco_skills s
        LEFT JOIN employee_skills es ON es.skill_id = s.id AND es.tenant_id = $1 ${deptFilter}
        GROUP BY s.id, s.preferred_label
        HAVING COUNT(DISTINCT es.employee_id) > 0
      )
      SELECT
        skill_id,
        skill_name,
        employees_with_skill::int,
        ROUND(avg_proficiency::numeric, 2) AS avg_proficiency,
        total_employees::int,
        CASE
          WHEN employees_with_skill::float / NULLIF(total_employees, 0) < 0.1 THEN 'critical'
          WHEN employees_with_skill::float / NULLIF(total_employees, 0) < 0.25 THEN 'high'
          WHEN employees_with_skill::float / NULLIF(total_employees, 0) < 0.5 THEN 'medium'
          ELSE 'low'
        END AS risk_level
      FROM skill_coverage
      ORDER BY employees_with_skill ASC
      LIMIT 50
    `, params);
    res.json({
        success: true,
        data: result.rows,
        meta: { count: result.rows.length },
    });
}));
/**
 * POST /workforce-planning/gap-risk
 * Compute gap and risk for given requirements
 */
router.post('/gap-risk', validate(gapRiskSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { requirements } = req.body;
    if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
        throw Errors.badRequest('requirements array is required and must not be empty');
    }
    const gapRisk = await planningService.computeGapRisk(tenantId, requirements);
    res.json({
        success: true,
        data: gapRisk,
        count: gapRisk.length,
        summary: {
            critical: gapRisk.filter((g) => g.risk_level === 'critical').length,
            high: gapRisk.filter((g) => g.risk_level === 'high').length,
            medium: gapRisk.filter((g) => g.risk_level === 'medium').length,
            low: gapRisk.filter((g) => g.risk_level === 'low').length,
        },
    });
}));
/**
 * GET /workforce-planning/hiring-recommendations
 * Get current hiring recommendations based on open requisitions and capacity gaps
 */
router.get('/hiring-recommendations', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        d.id AS org_unit_id,
        d.name AS department_name,
        COUNT(r.id) FILTER (WHERE r.status = 'open') AS open_requisitions,
        COUNT(e.id) FILTER (WHERE e.is_active = true) AS current_headcount,
        COALESCE(
          (SELECT COUNT(*) FROM recruiting_candidates c
           JOIN recruiting_requisitions rr ON c.requisition_id = rr.id
           WHERE rr.department = d.name AND rr.tenant_id = $1
             AND c.stage NOT IN ('rejected', 'hired', 'withdrawn')),
          0
        )::int AS active_candidates
      FROM org_units d
      LEFT JOIN employees e ON d.id = e.org_unit_id AND e.tenant_id = $1
      LEFT JOIN recruiting_requisitions r ON r.department = d.name AND r.tenant_id = $1
      WHERE d.tenant_id = $1
      GROUP BY d.id, d.name
      HAVING COUNT(r.id) FILTER (WHERE r.status = 'open') > 0
      ORDER BY COUNT(r.id) FILTER (WHERE r.status = 'open') DESC
    `, [tenantId]);
    res.json({
        success: true,
        data: result.rows,
        meta: { count: result.rows.length },
    });
}));
/**
 * POST /workforce-planning/hiring-recommendations
 * Generate hiring recommendations from gap assessments
 */
router.post('/hiring-recommendations', validate(hiringRecommendationsSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { gap_assessments } = req.body;
    if (!gap_assessments || !Array.isArray(gap_assessments)) {
        throw Errors.badRequest('gap_assessments array is required');
    }
    const recommendations = await planningService.generateHiringRecommendations(tenantId, gap_assessments);
    const totalCost = recommendations.reduce((sum, r) => sum + r.total_estimated_cost, 0);
    const totalPositions = recommendations.reduce((sum, r) => sum + r.positions_needed, 0);
    res.json({
        success: true,
        data: recommendations,
        count: recommendations.length,
        summary: {
            total_positions: totalPositions,
            total_estimated_cost: totalCost,
        },
    });
}));
/**
 * POST /workforce-planning/training-investments
 * Generate training investment suggestions
 */
router.post('/training-investments', validate(trainingInvestmentsSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { gap_assessments } = req.body;
    if (!gap_assessments || !Array.isArray(gap_assessments)) {
        throw Errors.badRequest('gap_assessments array is required');
    }
    const investments = await planningService.generateTrainingInvestments(tenantId, gap_assessments);
    const totalCost = investments.reduce((sum, i) => sum + i.estimated_cost, 0);
    const totalEmployees = investments.reduce((sum, i) => sum + i.employees_to_train, 0);
    const totalHours = investments.reduce((sum, i) => sum + i.estimated_training_hours, 0);
    res.json({
        success: true,
        data: investments,
        count: investments.length,
        summary: {
            total_employees: totalEmployees,
            total_training_hours: totalHours,
            total_estimated_cost: totalCost,
            avg_roi: investments.length > 0
                ? Math.round((investments.reduce((sum, i) => sum + i.roi_estimate, 0) / investments.length) * 100) / 100
                : 0,
        },
    });
}));
/**
 * GET /workforce-planning/plans
 * List all workforce plans
 */
router.get('/plans', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const status = req.query['status'];
    const plans = await planningService.getWorkforcePlans(tenantId, {
        ...(status ? { status } : {}),
    });
    res.json({
        success: true,
        data: plans,
        count: plans.length,
    });
}));
/**
 * GET /workforce-planning/plans/:planId
 * Get specific workforce plan by ID
 */
router.get('/plans/:planId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const planId = req.params['planId'];
    const plan = await planningService.getWorkforcePlanById(tenantId, planId);
    if (!plan) {
        throw Errors.notFound('Workforce plan');
    }
    res.json({
        success: true,
        data: plan,
    });
}));
/**
 * POST /workforce-planning/plans
 * Create a new workforce plan
 */
router.post('/plans', validate(createWorkforcePlanSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { name, description, target_date, requirements } = req.body;
    if (!name || !target_date || !requirements || !Array.isArray(requirements)) {
        throw Errors.badRequest('name, target_date, and requirements array are required');
    }
    const plan = await planningService.createWorkforcePlan(tenantId, {
        name,
        ...(description ? { description } : {}),
        target_date,
        requirements,
    });
    res.status(201).json({
        success: true,
        data: plan,
    });
}));
/**
 * PATCH /workforce-planning/plans/:planId/status
 * Update workforce plan status
 */
router.patch('/plans/:planId/status', validate(updateWorkforcePlanStatusSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const planId = req.params['planId'];
    const { status } = req.body;
    const validStatuses = ['draft', 'active', 'completed', 'archived'];
    if (!status || !validStatuses.includes(status)) {
        res.status(400).json({
            success: false,
            error: `status must be one of: ${validStatuses.join(', ')}`,
        });
        return;
    }
    const success = await planningService.updatePlanStatus(tenantId, planId, status);
    if (!success) {
        throw Errors.notFound('Workforce plan');
    }
    res.json({
        success: true,
        message: `Plan status updated to ${status}`,
    });
}));
/**
 * POST /workforce-planning/simulate
 * Full simulation: requirements -> gap analysis -> recommendations
 */
router.post('/simulate', validate(simulateWorkforceSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { requirements } = req.body;
    if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
        throw Errors.badRequest('requirements array is required and must not be empty');
    }
    // Run full simulation
    const gapAnalysis = await planningService.computeGapRisk(tenantId, requirements);
    const hiringRecommendations = await planningService.generateHiringRecommendations(tenantId, gapAnalysis);
    const trainingInvestments = await planningService.generateTrainingInvestments(tenantId, gapAnalysis);
    // Calculate summary
    const summary = {
        total_skill_gaps: gapAnalysis.filter((g) => g.gap_count > 0 || g.proficiency_gap > 0).length,
        critical_gaps: gapAnalysis.filter((g) => g.risk_level === 'critical').length,
        high_gaps: gapAnalysis.filter((g) => g.risk_level === 'high').length,
        positions_to_hire: hiringRecommendations.reduce((sum, r) => sum + r.positions_needed, 0),
        employees_to_train: trainingInvestments.reduce((sum, t) => sum + t.employees_to_train, 0),
        total_hiring_cost: hiringRecommendations.reduce((sum, r) => sum + r.total_estimated_cost, 0),
        total_training_cost: trainingInvestments.reduce((sum, t) => sum + t.estimated_cost, 0),
        total_investment: 0,
    };
    summary.total_investment = summary.total_hiring_cost + summary.total_training_cost;
    res.json({
        success: true,
        data: {
            requirements,
            gap_analysis: gapAnalysis,
            hiring_recommendations: hiringRecommendations,
            training_investments: trainingInvestments,
            summary,
        },
    });
}));
// ============================================================================
// ANALYTICS DASHBOARD ENDPOINTS (E-ANLT-01 - S-ANLT-01-01)
// ============================================================================
/**
 * GET /workforce-planning/analytics/headcount-trend
 * Get headcount trend for 12 months historical + 6 months forecast
 */
router.get('/analytics/headcount-trend', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const orgUnitId = req.query['org_unit_id'];
    // Build department filter
    const deptFilter = orgUnitId ? 'AND e.org_unit_id = $2' : '';
    const params = [tenantId];
    if (orgUnitId)
        params.push(orgUnitId);
    // Get 12 months historical data
    const historicalResult = await req.dbClient.query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE - INTERVAL '11 months'),
          date_trunc('month', CURRENT_DATE),
          '1 month'::interval
        ) AS month
      ),
      monthly_data AS (
        SELECT
          m.month,
          (SELECT COUNT(*) FROM employees e
           WHERE e.tenant_id = $1
             ${deptFilter}
             AND e.hire_date <= m.month + INTERVAL '1 month' - INTERVAL '1 day'
             AND (e.termination_date IS NULL OR e.termination_date > m.month)
          ) AS headcount,
          (SELECT COUNT(*) FROM employees e
           WHERE e.tenant_id = $1
             ${deptFilter}
             AND date_trunc('month', e.hire_date) = m.month
          ) AS hires,
          (SELECT COUNT(*) FROM employees e
           WHERE e.tenant_id = $1
             ${deptFilter}
             AND date_trunc('month', e.termination_date) = m.month
          ) AS attrition
        FROM months m
      )
      SELECT
        TO_CHAR(month, 'YYYY-MM') AS period,
        TO_CHAR(month, 'Mon YYYY') AS label,
        headcount::int,
        hires::int,
        attrition::int,
        'historical' AS type
      FROM monthly_data
      ORDER BY month
    `, params);
    // Calculate forecast based on historical trends
    const lastHeadcount = historicalResult.rows.length > 0
        ? historicalResult.rows[historicalResult.rows.length - 1].headcount
        : 0;
    // Calculate average monthly growth rate from historical data
    const historicalData = historicalResult.rows;
    let avgGrowthRate = 0;
    if (historicalData.length > 1) {
        const growthRates = [];
        for (let i = 1; i < historicalData.length; i++) {
            const prev = historicalData[i - 1].headcount || 1;
            const curr = historicalData[i].headcount;
            growthRates.push((curr - prev) / prev);
        }
        avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
    }
    // Generate 6 months forecast
    const forecast = [];
    let projectedHeadcount = lastHeadcount;
    const now = new Date();
    for (let i = 1; i <= 6; i++) {
        const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        projectedHeadcount = Math.round(projectedHeadcount * (1 + avgGrowthRate));
        forecast.push({
            period: forecastDate.toISOString().substring(0, 7),
            label: forecastDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            headcount: projectedHeadcount,
            hires: null,
            attrition: null,
            type: 'forecast',
        });
    }
    res.json({
        success: true,
        data: {
            historical: historicalResult.rows,
            forecast,
            combined: [...historicalResult.rows, ...forecast],
            growth_rate: Math.round(avgGrowthRate * 10000) / 100,
        },
    });
}));
/**
 * GET /workforce-planning/analytics/attrition-forecast
 * Get attrition prediction by department
 */
router.get('/analytics/attrition-forecast', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      WITH dept_metrics AS (
        SELECT
          d.id as org_unit_id,
          d.name as department_name,
          COUNT(e.id) FILTER (WHERE e.is_active = true) as current_headcount,
          COUNT(e.id) FILTER (
            WHERE e.termination_date >= CURRENT_DATE - INTERVAL '12 months'
          ) as terminations_12m,
          COUNT(e.id) FILTER (
            WHERE e.hire_date >= CURRENT_DATE - INTERVAL '12 months' AND e.is_active = true
          ) as hires_12m
        FROM org_units d
        LEFT JOIN employees e ON d.id = e.org_unit_id AND e.tenant_id = $1
        WHERE d.tenant_id = $1
        GROUP BY d.id, d.name
      )
      SELECT
        org_unit_id,
        department_name,
        current_headcount,
        terminations_12m,
        hires_12m,
        CASE
          WHEN current_headcount > 0
          THEN ROUND((terminations_12m::numeric / current_headcount) * 100, 1)
          ELSE 0
        END as attrition_rate_12m,
        CASE
          WHEN current_headcount > 0
          THEN ROUND((terminations_12m::numeric / current_headcount) * 50, 1)
          ELSE 0
        END as predicted_attrition_6m,
        CASE
          WHEN (terminations_12m::numeric / NULLIF(current_headcount, 0)) * 100 > 20 THEN 'high'
          WHEN (terminations_12m::numeric / NULLIF(current_headcount, 0)) * 100 > 10 THEN 'medium'
          ELSE 'low'
        END as risk_level
      FROM dept_metrics
      WHERE current_headcount > 0
      ORDER BY attrition_rate_12m DESC
    `, [tenantId]);
    const companyResult = await req.dbClient.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_active = true) as total_headcount,
        COUNT(*) FILTER (WHERE termination_date >= CURRENT_DATE - INTERVAL '12 months') as total_terminations
      FROM employees
      WHERE tenant_id = $1
    `, [tenantId]);
    const companyData = companyResult.rows[0];
    const companyAttritionRate = companyData.total_headcount > 0
        ? Math.round((companyData.total_terminations / companyData.total_headcount) * 1000) / 10
        : 0;
    res.json({
        success: true,
        data: {
            by_org_unit: result.rows,
            company_wide: {
                total_headcount: parseInt(companyData.total_headcount),
                attrition_rate_12m: companyAttritionRate,
                predicted_attrition_6m: Math.round((companyAttritionRate / 2) * 10) / 10,
                industry_benchmark: 12.5,
            },
        },
    });
}));
/**
 * GET /workforce-planning/analytics/capacity
 * Get capacity utilization metrics
 */
router.get('/analytics/capacity', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const deptResult = await req.dbClient.query(`
      SELECT
        d.id as org_unit_id,
        d.name as department_name,
        COUNT(e.id) FILTER (WHERE e.is_active = true) as current_headcount,
        COUNT(e.id) FILTER (WHERE e.is_active = true) as target_headcount,
        (SELECT COUNT(*) FROM recruiting_requisitions r
         WHERE r.department = d.name AND r.status = 'open' AND r.tenant_id = $1
        ) as open_positions
      FROM org_units d
      LEFT JOIN employees e ON d.id = e.org_unit_id AND e.tenant_id = $1
      WHERE d.tenant_id = $1
      GROUP BY d.id, d.name
      ORDER BY d.name
    `, [tenantId]);
    const orgUnitData = deptResult.rows.map((row) => {
        const target = parseInt(row.target_headcount) || parseInt(row.current_headcount);
        const current = parseInt(row.current_headcount);
        const openPositions = parseInt(row.open_positions);
        return {
            org_unit_id: row.org_unit_id,
            department_name: row.department_name,
            current_headcount: current,
            target_headcount: target,
            open_positions: openPositions,
            capacity_gap: target - current,
            utilization_percent: target > 0 ? Math.round((current / target) * 100) : 100,
            status: current >= target ? 'optimal' : current >= target * 0.9 ? 'near_target' : 'understaffed',
        };
    });
    const totalCurrent = orgUnitData.reduce((sum, d) => sum + d.current_headcount, 0);
    const totalTarget = orgUnitData.reduce((sum, d) => sum + d.target_headcount, 0);
    const totalOpenPositions = orgUnitData.reduce((sum, d) => sum + d.open_positions, 0);
    res.json({
        success: true,
        data: {
            by_org_unit: orgUnitData,
            summary: {
                total_current: totalCurrent,
                total_target: totalTarget,
                total_open_positions: totalOpenPositions,
                overall_utilization: totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 100,
                capacity_gap: totalTarget - totalCurrent,
            },
        },
    });
}));
/**
 * GET /workforce-planning/analytics/positions-gap
 * Get open positions vs capacity gap analysis
 */
router.get('/analytics/positions-gap', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      WITH dept_analysis AS (
        SELECT
          d.id as org_unit_id,
          d.name as department_name,
          COUNT(e.id) FILTER (WHERE e.is_active = true) as current_headcount,
          COUNT(e.id) FILTER (WHERE e.is_active = true) as target_headcount,
          (SELECT COUNT(*) FROM recruiting_requisitions r
           WHERE r.department = d.name AND r.status = 'open' AND r.tenant_id = $1
          ) as open_requisitions,
          (SELECT COUNT(*) FROM recruiting_candidates c
           JOIN recruiting_requisitions r ON c.requisition_id = r.id
           WHERE r.department = d.name AND c.stage NOT IN ('rejected', 'hired', 'withdrawn')
           AND r.tenant_id = $1
          ) as active_candidates
        FROM org_units d
        LEFT JOIN employees e ON d.id = e.org_unit_id AND e.tenant_id = $1
        WHERE d.tenant_id = $1
        GROUP BY d.id, d.name
      )
      SELECT
        org_unit_id,
        department_name,
        current_headcount::int,
        target_headcount::int,
        open_requisitions::int as capacity_gap,
        open_requisitions::int,
        active_candidates::int,
        100 as gap_coverage_percent
      FROM dept_analysis
      WHERE current_headcount > 0 OR target_headcount > 0
      ORDER BY open_requisitions DESC
    `, [tenantId]);
    res.json({
        success: true,
        data: result.rows,
    });
}));
/**
 * GET /workforce-planning/analytics/department/:id
 * Get detailed workforce planning for a specific department
 */
router.get('/analytics/department/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const orgUnitId = req.params['id'];
    const deptResult = await req.dbClient.query(`
      SELECT
        d.id,
        d.name,
        d.code,
        COUNT(e.id) FILTER (WHERE e.is_active = true) as current_headcount,
        COUNT(e.id) FILTER (WHERE e.is_active = true) as target_headcount,
        COUNT(e.id) FILTER (WHERE e.termination_date >= CURRENT_DATE - INTERVAL '12 months') as terminations_12m,
        COUNT(e.id) FILTER (WHERE e.hire_date >= CURRENT_DATE - INTERVAL '12 months' AND e.is_active = true) as hires_12m,
        AVG(EXTRACT(YEAR FROM age(CURRENT_DATE, e.hire_date))) FILTER (WHERE e.is_active = true) as avg_tenure_years
      FROM org_units d
      LEFT JOIN employees e ON d.id = e.org_unit_id AND e.tenant_id = $1
      WHERE d.tenant_id = $1 AND d.id = $2
      GROUP BY d.id, d.name, d.code
    `, [tenantId, orgUnitId]);
    if (deptResult.rows.length === 0) {
        throw Errors.notFound('OrgUnit');
    }
    const dept = deptResult.rows[0];
    const rolesResult = await req.dbClient.query(`
      SELECT
        COALESCE(job_title, 'Unspecified') as role,
        COUNT(*) as count
      FROM employees
      WHERE tenant_id = $1 AND org_unit_id = $2 AND is_active = true
      GROUP BY job_title
      ORDER BY count DESC
      LIMIT 10
    `, [tenantId, orgUnitId]);
    const tenureResult = await req.dbClient.query(`
      SELECT tenure_band, count FROM (
        SELECT
          CASE
            WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, hire_date)) < 1 THEN '< 1 year'
            WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, hire_date)) < 3 THEN '1-3 years'
            WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, hire_date)) < 5 THEN '3-5 years'
            WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, hire_date)) < 10 THEN '5-10 years'
            ELSE '10+ years'
          END as tenure_band,
          COUNT(*) as count
        FROM employees
        WHERE tenant_id = $1 AND org_unit_id = $2 AND is_active = true
        GROUP BY 1
      ) sub
      ORDER BY
        CASE tenure_band
          WHEN '< 1 year' THEN 1
          WHEN '1-3 years' THEN 2
          WHEN '3-5 years' THEN 3
          WHEN '5-10 years' THEN 4
          ELSE 5
        END
    `, [tenantId, orgUnitId]);
    res.json({
        success: true,
        data: {
            department: {
                id: dept.id,
                name: dept.name,
                code: dept.code,
                current_headcount: parseInt(dept.current_headcount),
                target_headcount: parseInt(dept.target_headcount) || parseInt(dept.current_headcount),
                terminations_12m: parseInt(dept.terminations_12m),
                hires_12m: parseInt(dept.hires_12m),
                avg_tenure_years: Math.round(parseFloat(dept.avg_tenure_years) * 10) / 10 || 0,
                net_change_12m: parseInt(dept.hires_12m) - parseInt(dept.terminations_12m),
            },
            roles: rolesResult.rows,
            tenure_distribution: tenureResult.rows,
        },
    });
}));
/**
 * GET /workforce-planning/analytics/org-units
 * Get list of departments for filtering
 */
router.get('/analytics/org-units', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        d.id,
        d.name,
        COUNT(e.id) FILTER (WHERE e.is_active = true) as employee_count
      FROM org_units d
      LEFT JOIN employees e ON d.id = e.org_unit_id AND e.tenant_id = $1
      WHERE d.tenant_id = $1
      GROUP BY d.id, d.name
      ORDER BY d.name
    `, [tenantId]);
    res.json({
        success: true,
        data: result.rows,
    });
}));
export default router;
//# sourceMappingURL=workforce-planning.js.map