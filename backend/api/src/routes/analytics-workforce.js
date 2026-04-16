/**
 * Workforce Analytics Routes
 * Provides workforce overview analytics from analytics.v_workforce_planning_dashboard view.
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { asyncHandler } from '../errors/middleware.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /api/v1/analytics/workforce
 * Workforce planning dashboard summary for the current tenant
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        tenant_name,
        industry_type,
        total_headcount,
        active_employees,
        new_hires_30d,
        new_hires_90d,
        terminations_30d,
        terminations_90d,
        turnover_rate_annual,
        net_change_90d,
        critical_roles_count,
        roles_with_ready_successor,
        high_flight_risk_count,
        medium_flight_risk_count,
        top_talent_count,
        solid_performers_count,
        needs_action_count,
        avg_tenure_years,
        tenure_under_1y,
        tenure_1_3y,
        tenure_3_5y,
        tenure_over_5y,
        avg_span_of_control,
        max_span_of_control
      FROM analytics.v_workforce_planning_dashboard
      WHERE tenant_id = $1
      `, [tenantId]);
    res.json({ success: true, data: result.rows[0] || {} });
}));
/**
 * GET /api/v1/analytics/workforce/overview
 * Simplified workforce overview
 */
router.get('/overview', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        tenant_name,
        total_employees,
        active_employees,
        location_count,
        org_unit_count,
        avg_tenure_years
      FROM v_workforce_overview
      WHERE tenant_id = $1
      `, [tenantId]);
    res.json({ success: true, data: result.rows[0] || {} });
}));
/**
 * GET /api/v1/analytics/workforce/demographics
 * Workforce demographics: age, gender, contract type, seniority distributions
 */
router.get('/demographics', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    // Total active employees
    const totalRes = await req.dbClient.query(`SELECT COUNT(*) as total FROM employees WHERE tenant_id = $1 AND is_active = true`, [tenantId]);
    const totalEmployees = parseInt(totalRes.rows[0]?.total || '0', 10);
    // Gender distribution
    const genderRes = await req.dbClient.query(`
      SELECT
        COALESCE(gender, 'Non specificato') as gender,
        COUNT(*) as count
      FROM employees
      WHERE tenant_id = $1 AND is_active = true
      GROUP BY gender
      ORDER BY count DESC
      `, [tenantId]);
    const genderDistribution = genderRes.rows.map((r) => ({
        gender: r.gender,
        count: parseInt(r.count, 10),
        percentage: totalEmployees > 0 ? Math.round((parseInt(r.count, 10) / totalEmployees) * 1000) / 10 : 0,
    }));
    // Age distribution
    const ageRes = await req.dbClient.query(`
      SELECT age_range, count FROM (
        SELECT
          CASE
            WHEN birth_date IS NULL THEN 'Sconosciuta'
            WHEN EXTRACT(YEAR FROM AGE(birth_date)) < 30 THEN 'Under 30'
            WHEN EXTRACT(YEAR FROM AGE(birth_date)) < 40 THEN '30-39'
            WHEN EXTRACT(YEAR FROM AGE(birth_date)) < 50 THEN '40-49'
            WHEN EXTRACT(YEAR FROM AGE(birth_date)) < 60 THEN '50-59'
            ELSE '60+'
          END as age_range,
          COUNT(*) as count
        FROM employees
        WHERE tenant_id = $1 AND is_active = true
        GROUP BY 1
      ) sub
      ORDER BY
        CASE age_range
          WHEN 'Under 30' THEN 1
          WHEN '30-39' THEN 2
          WHEN '40-49' THEN 3
          WHEN '50-59' THEN 4
          WHEN '60+' THEN 5
          ELSE 6
        END
      `, [tenantId]);
    const ageDistribution = ageRes.rows.map((r) => ({
        range: r.age_range,
        count: parseInt(r.count, 10),
        percentage: totalEmployees > 0 ? Math.round((parseInt(r.count, 10) / totalEmployees) * 1000) / 10 : 0,
    }));
    // Contract type distribution
    const contractRes = await req.dbClient.query(`
      SELECT
        COALESCE(ec.contract_type, 'Non specificato') as type,
        COUNT(DISTINCT e.id) as count
      FROM employees e
      LEFT JOIN employee_contracts ec ON ec.employee_id = e.id AND ec.tenant_id = e.tenant_id
      WHERE e.tenant_id = $1 AND e.is_active = true
      GROUP BY ec.contract_type
      ORDER BY count DESC
      `, [tenantId]);
    const contractTypeDistribution = contractRes.rows.map((r) => ({
        type: r.type,
        count: parseInt(r.count, 10),
        percentage: totalEmployees > 0 ? Math.round((parseInt(r.count, 10) / totalEmployees) * 1000) / 10 : 0,
    }));
    // Seniority distribution (years since hire_date)
    const seniorityRes = await req.dbClient.query(`
      SELECT seniority_range, count FROM (
        SELECT
          CASE
            WHEN hire_date IS NULL THEN 'Sconosciuta'
            WHEN EXTRACT(YEAR FROM AGE(hire_date)) < 1 THEN '< 1 anno'
            WHEN EXTRACT(YEAR FROM AGE(hire_date)) < 3 THEN '1-3 anni'
            WHEN EXTRACT(YEAR FROM AGE(hire_date)) < 5 THEN '3-5 anni'
            WHEN EXTRACT(YEAR FROM AGE(hire_date)) < 10 THEN '5-10 anni'
            ELSE '10+ anni'
          END as seniority_range,
          COUNT(*) as count
        FROM employees
        WHERE tenant_id = $1 AND is_active = true
        GROUP BY 1
      ) sub
      ORDER BY
        CASE seniority_range
          WHEN '< 1 anno' THEN 1
          WHEN '1-3 anni' THEN 2
          WHEN '3-5 anni' THEN 3
          WHEN '5-10 anni' THEN 4
          WHEN '10+ anni' THEN 5
          ELSE 6
        END
      `, [tenantId]);
    const seniorityDistribution = seniorityRes.rows.map((r) => ({
        range: r.seniority_range,
        count: parseInt(r.count, 10),
        percentage: totalEmployees > 0 ? Math.round((parseInt(r.count, 10) / totalEmployees) * 1000) / 10 : 0,
    }));
    res.json({
        success: true,
        data: {
            total_employees: totalEmployees,
            gender_distribution: genderDistribution,
            age_distribution: ageDistribution,
            contract_type_distribution: contractTypeDistribution,
            seniority_distribution: seniorityDistribution,
        },
    });
}));
export default router;
//# sourceMappingURL=analytics-workforce.js.map