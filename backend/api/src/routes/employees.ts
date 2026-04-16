/**
 * Employee Routes
 * CRUD operations for employees with tenant isolation
 * Epic: 3 - Employee Data Management
 * Stories: 3.1-3.6
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { createAppError } from '../middleware/errorHandler.js';
import { ErrorCodes, isValidUUID, PERMISSIONS } from '@heuresys/shared';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { requirePermission, applyScopeFilter } from '../middleware/rbpMiddleware.js';
import { checkPermission } from '../middleware/rbac.js';
import { getScopeCondition } from '../utils/scope-helpers.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { withTransaction } from '../utils/transaction.js';
import { buildMeta } from '../utils/pagination.js';
import { validate } from '../middleware/validate.js';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  archiveEmployeeSchema,
  updateSelfEmployeeSchema,
} from '../schemas/employees.js';
import { asyncHandler } from '../errors/middleware.js';
import { safeParseInt } from '../utils/query-helpers.js';
import {
  applyFieldPolicy,
  applyFieldPolicyAllDb,
  loadPolicyForRole,
} from '../utils/field-policy.js';
const router = Router();

// Tenant context required for all routes
router.use(requireTenant);
// RBAC: data read operations require EMPLOYEES_VIEW_ALL permission
// Self-service routes (/me, /me/*) and reference data (/meta/*) are accessible to any authenticated user
// Write operations (POST/PATCH/DELETE) use specific write permissions

/**
 * GET /employees/analytics-stats
 * Comprehensive HR analytics data for dashboards
 * NOTE: Must be before /:id routes
 */
router.get(
  '/analytics-stats',
  checkPermission(PERMISSIONS.EMPLOYEES_VIEW_ALL),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    // Run all queries in parallel for performance
    const [
      headcountResult,
      tenureResult,
      costCenterResult,
      departmentProductivity,
      turnoverResult,
    ] = await Promise.all([
      // Basic headcount
      req.dbClient!.query(
        'SELECT COUNT(*) as total FROM employees WHERE tenant_id = $1 AND is_active = true',
        [tenantId]
      ),
      // Average tenure
      req.dbClient!.query(
        `
        SELECT ROUND(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, hire_date)))::numeric, 1) as avg_tenure
        FROM employees WHERE tenant_id = $1 AND is_active = true AND hire_date IS NOT NULL
      `,
        [tenantId]
      ),
      // Cost center analysis
      req.dbClient!.query(
        `
        SELECT
          cc.name as category,
          COALESCE(cc.budget_annual_eur, 0) as amount,
          cc.cost_center_type
        FROM cost_centers cc
        WHERE cc.tenant_id = $1 AND cc.is_active = true
        ORDER BY cc.budget_annual_eur DESC NULLS LAST
        LIMIT 6
      `,
        [tenantId]
      ),
      // OrgUnit metrics (using review scores as productivity proxy)
      req.dbClient!.query(
        `
        SELECT
          d.name as department,
          ROUND(AVG(pr.overall_rating) * 20)::int as productivity,
          ROUND(AVG(pr.goal_achievement_rating) * 20)::int as efficiency,
          ROUND((COUNT(DISTINCT pr.id)::float / NULLIF(COUNT(DISTINCT e.id), 0)) * 100)::int as utilization
        FROM org_units d
        JOIN employees e ON e.org_unit_id = d.id AND e.is_active = true
        LEFT JOIN performance_reviews pr ON pr.employee_id = e.id AND pr.tenant_id = $1
        WHERE d.tenant_id = $1
        GROUP BY d.id, d.name
        HAVING AVG(pr.overall_rating) IS NOT NULL
        ORDER BY productivity DESC
        LIMIT 6
      `,
        [tenantId]
      ),
      // Turnover analysis (inactive employees)
      req.dbClient!.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE termination_reason = 'voluntary') as voluntary,
          COUNT(*) FILTER (WHERE termination_reason = 'involuntary') as involuntary,
          COUNT(*) FILTER (WHERE termination_reason = 'retirement') as retirement,
          COUNT(*) FILTER (WHERE is_active = false) as total_terminated
        FROM employees WHERE tenant_id = $1
      `,
        [tenantId]
      ),
    ]);

    const headcount = safeParseInt(headcountResult.rows[0]?.total, { fallback: 0 });
    const avgTenure = parseFloat(tenureResult.rows[0]?.avg_tenure) || 0;

    // Build cost analysis with colors
    const colors = ['#00b4d8', '#48bb78', '#9f7aea', '#ed8936', '#f56565', '#4a5568'];
    const totalBudget = costCenterResult.rows.reduce(
      (sum: number, cc: { amount: string }) => sum + (parseFloat(cc.amount) || 0),
      0
    );
    const costAnalysis = costCenterResult.rows.map(
      (cc: { category: string; amount: string }, idx: number) => ({
        category: cc.category,
        amount: parseFloat(cc.amount) || 0,
        percentage: totalBudget > 0 ? Math.round((parseFloat(cc.amount) / totalBudget) * 100) : 0,
        color: colors[idx % colors.length],
      })
    );

    // Build productivity metrics
    const productivityMetrics = departmentProductivity.rows.map(
      (d: {
        department: string;
        productivity: string;
        efficiency: string;
        utilization: string;
      }) => ({
        department: d.department,
        productivity: safeParseInt(d.productivity, { fallback: 70 }),
        efficiency: safeParseInt(d.efficiency, { fallback: 70 }),
        utilization: safeParseInt(d.utilization, { fallback: 80 }),
      })
    );

    // KPIs with calculated values
    const kpis = [
      {
        label: 'Headcount',
        value: headcount.toString(),
        change: 4.2,
        trend: 'up' as const,
        icon: 'users' as const,
      },
      {
        label: 'Tenure Media',
        value: `${avgTenure}a`,
        change: 0.5,
        trend: 'up' as const,
        icon: 'clock' as const,
      },
      {
        label: 'Budget HR',
        value: `€${(totalBudget / 1000000).toFixed(1)}M`,
        change: 2.1,
        trend: 'up' as const,
        icon: 'dollar' as const,
      },
      {
        label: 'Produttivita',
        value: `${Math.round(productivityMetrics.reduce((sum, d) => sum + d.productivity, 0) / Math.max(productivityMetrics.length, 1))}%`,
        change: 3.8,
        trend: 'up' as const,
        icon: 'zap' as const,
      },
    ];

    // Headcount trend (last 6 months simulated from total - in production would query historical data)
    const months = ['Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const headcountTrend = months.map((month, idx) => ({
      month,
      count: Math.max(headcount - (5 - idx) * 3, headcount - 15),
      target: headcount + 5,
    }));

    // Engagement scores (would come from surveys in production)
    const engagementScores = [
      { dimension: 'Leadership', score: 78, benchmark: 72 },
      { dimension: 'Growth', score: 82, benchmark: 75 },
      { dimension: 'Culture', score: 85, benchmark: 78 },
      { dimension: 'Rewards', score: 71, benchmark: 70 },
      { dimension: 'Wellbeing', score: 76, benchmark: 74 },
      { dimension: 'Purpose', score: 88, benchmark: 80 },
    ];

    const turnover = turnoverResult.rows[0];

    res.json({
      success: true,
      data: {
        kpis,
        headcountTrend,
        costAnalysis,
        productivityMetrics,
        turnoverAnalysis: {
          voluntary: safeParseInt(turnover.voluntary, { fallback: 0 }),
          involuntary: safeParseInt(turnover.involuntary, { fallback: 0 }),
          retirement: safeParseInt(turnover.retirement, { fallback: 0 }),
          avgTenure,
          riskEmployees: 0, // Would need predictive model
        },
        engagementScores,
      },
    });
  })
);

/**
 * GET /employees/stats
 * Get employee statistics for current tenant
 * NOTE: Must be before /:id routes
 */
router.get(
  '/stats',
  checkPermission(PERMISSIONS.EMPLOYEES_VIEW_ALL),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const [
      totalResult,
      activeResult,
      departmentStats,
      locationStats,
      recentHires,
      ageStats,
      genderStats,
      nationalityStats,
    ] = await Promise.all([
      req.dbClient!.query('SELECT COUNT(*) FROM employees WHERE tenant_id = $1', [tenantId]),
      req.dbClient!.query(
        'SELECT COUNT(*) FROM employees WHERE tenant_id = $1 AND is_active = true',
        [tenantId]
      ),
      req.dbClient!.query(
        `
        SELECT d.name, COUNT(e.id) as count
        FROM org_units d
        LEFT JOIN employees e ON e.org_unit_id = d.id AND e.is_active = true
        WHERE d.tenant_id = $1
        GROUP BY d.id, d.name
        ORDER BY count DESC
        LIMIT 10
      `,
        [tenantId]
      ),
      req.dbClient!.query(
        `
        SELECT l.name, COUNT(e.id) as count
        FROM locations l
        LEFT JOIN employees e ON e.location_id = l.id AND e.is_active = true
        WHERE l.tenant_id = $1
        GROUP BY l.id, l.name
        ORDER BY count DESC
        LIMIT 10
      `,
        [tenantId]
      ),
      req.dbClient!.query(
        `
        SELECT id, first_name, last_name, job_title, hire_date
        FROM employees
        WHERE tenant_id = $1 AND is_active = true
        ORDER BY hire_date DESC NULLS LAST
        LIMIT 5
      `,
        [tenantId]
      ),
      // Age distribution from birth_date
      req.dbClient!.query(
        `
        SELECT
          CASE
            WHEN EXTRACT(YEAR FROM age(birth_date)) BETWEEN 18 AND 25 THEN '18-25'
            WHEN EXTRACT(YEAR FROM age(birth_date)) BETWEEN 26 AND 35 THEN '26-35'
            WHEN EXTRACT(YEAR FROM age(birth_date)) BETWEEN 36 AND 45 THEN '36-45'
            WHEN EXTRACT(YEAR FROM age(birth_date)) BETWEEN 46 AND 55 THEN '46-55'
            ELSE '56+'
          END as range,
          COUNT(*) as count
        FROM employees
        WHERE tenant_id = $1 AND is_active = true AND birth_date IS NOT NULL
        GROUP BY range
        ORDER BY range
      `,
        [tenantId]
      ),
      // Gender distribution
      req.dbClient!.query(
        `
        SELECT
          CASE
            WHEN gender = 'Male' THEN 'Uomini'
            WHEN gender = 'Female' THEN 'Donne'
            ELSE 'Altro'
          END as gender,
          COUNT(*) as count
        FROM employees
        WHERE tenant_id = $1 AND is_active = true AND gender IS NOT NULL
        GROUP BY gender
        ORDER BY count DESC
      `,
        [tenantId]
      ),
      // Nationality distribution
      req.dbClient!.query(
        `
        SELECT
          COALESCE(nationality, 'Non specificata') as country,
          COUNT(*) as count
        FROM employees
        WHERE tenant_id = $1 AND is_active = true
        GROUP BY nationality
        ORDER BY count DESC
        LIMIT 10
      `,
        [tenantId]
      ),
    ]);

    const total = parseInt(totalResult.rows[0]?.count);

    // Calculate percentages for demographics
    const byAge = ageStats.rows.map((row: { range: string; count: string }) => ({
      range: row.range,
      count: parseInt(row.count),
      percentage: total > 0 ? Math.round((parseInt(row.count) / total) * 100) : 0,
    }));

    const byGender = genderStats.rows.map((row: { gender: string; count: string }) => ({
      gender: row.gender,
      count: parseInt(row.count),
      percentage: total > 0 ? Math.round((parseInt(row.count) / total) * 100) : 0,
    }));

    const byNationality = nationalityStats.rows.map((row: { country: string; count: string }) => ({
      country: row.country,
      count: parseInt(row.count),
    }));

    res.json({
      success: true,
      data: {
        total,
        active: parseInt(activeResult.rows[0]?.count),
        inactive: total - parseInt(activeResult.rows[0]?.count),
        byDepartment: departmentStats.rows,
        byLocation: locationStats.rows,
        recentHires: recentHires.rows,
        byAge,
        byGender,
        byNationality,
      },
    });
  })
);

/**
 * GET /employees
 * List employees for current tenant with pagination and filtering
 */
router.get(
  '/',
  requirePermission('CORE_HR', 'VIEW'),
  applyScopeFilter('CORE_HR'),
  asyncHandler(async (req: Request, res: Response) => {
    getTenantIdOrThrow(req);

    // Pagination
    const page = Math.max(1, safeParseInt(req.query['page'] as string, { fallback: 1 }));
    const limit = Math.min(
      500,
      Math.max(1, safeParseInt(req.query['limit'] as string, { fallback: 20 }))
    );
    const offset = (page - 1) * limit;

    // Filtering
    const orgUnitId = req.query['org_unit_id'] as string;
    const isActive = req.query['is_active'] as string;
    const search = req.query['search'] as string;

    // RBP scope filter (falls back to tenant_id = $1 when USE_RBP_SCOPE != true)
    const scope = getScopeCondition(req, 'e');
    let whereClause = `WHERE ${scope.where}`;
    const params: unknown[] = [...scope.params];
    let paramIndex = params.length + 1;

    if (orgUnitId) {
      whereClause += ` AND e.org_unit_id = $${paramIndex}`;
      params.push(orgUnitId);
      paramIndex++;
    }

    if (isActive !== undefined) {
      whereClause += ` AND e.is_active = $${paramIndex}`;
      params.push(isActive === 'true');
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (
        e.first_name ILIKE $${paramIndex} OR
        e.last_name ILIKE $${paramIndex} OR
        e.email ILIKE $${paramIndex}
      )`;
      params.push(`%${escapeILIKE(search)}%`);
      paramIndex++;
    }

    // Get total count
    const countResult = await req.dbClient!.query(
      `SELECT COUNT(*) as total FROM employees e ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total);

    // Get employees with resolved names for departments, locations, cost centers
    const employeesResult = await req.dbClient!.query(
      `SELECT
        e.id, e.first_name, e.last_name, e.email, e.job_title,
        e.department, e.location, e.hire_date, e.is_active, e.employment_status,
        e.org_unit_id, e.org_unit_id, e.manager_id, e.cost_center_id, e.location_id,
        d.name as department_name,
        l.name as location_name,
        cc.name as cost_center_name,
        ou.name as org_unit_name
      FROM employees e
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      LEFT JOIN locations l ON e.location_id = l.id
      LEFT JOIN cost_centers cc ON e.cost_center_id = cc.id
      LEFT JOIN org_units ou ON e.org_unit_id = ou.id
      ${whereClause}
      ORDER BY e.last_name, e.first_name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const userRole = (req as AuthenticatedRequest).user?.role || 'EMPLOYEE';
    const policyMap = await loadPolicyForRole(userRole);
    const tenantIdForPolicy = (req as AuthenticatedRequest).user?.tenantId || null;
    const filteredEmployees = await applyFieldPolicyAllDb(
      employeesResult.rows,
      'employees',
      policyMap,
      tenantIdForPolicy
    );

    res.json({
      success: true,
      data: {
        employees: filteredEmployees,
        meta: buildMeta(total, limit, offset),
      },
    });
  })
);

// =============================================================================
// SELF-SERVICE ROUTES (Stories 3.5 & 3.6)
// Must be BEFORE /:id routes to prevent /me being matched as an ID parameter
// =============================================================================

/**
 * GET /employees/me
 * Get current user's own employee profile (Story 3.5)
 */
router.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user.employeeId;

    if (!employeeId) {
      throw createAppError('No employee profile linked to this user', 404, ErrorCodes.NOT_FOUND);
    }

    const result = await req.dbClient!.query(
      `SELECT
        e.id, e.first_name, e.last_name, e.middle_name, e.email,
        e.job_title, e.department, e.location, e.position_id,
        e.hire_date, e.is_active, e.employment_status,
        e.seniority_date, e.probation_end_date, e.contract_end_date,
        e.termination_date, e.termination_reason,
        e.birth_date, e.birth_place, e.gender, e.nationality, e.marital_status,
        e.address_street, e.address_city, e.address_postal_code,
        e.address_country, e.address_region,
        e.temp_address_street, e.temp_address_city,
        e.temp_address_postal_code, e.temp_address_country,
        e.phone_mobile, e.phone_work, e.phone_home, e.personal_email,
        e.emergency_contact_name, e.emergency_contact_phone, e.emergency_contact_relationship,
        e.family_members, e.education_history,
        e.highest_education_level, e.highest_education_institution,
        e.highest_education_field, e.highest_education_year,
        e.tax_id, e.national_id, e.national_id_expiry,
        e.passport_number, e.passport_expiry,
        e.driver_license, e.driver_license_expiry,
        e.iban, e.swift_bic, e.bank_name, e.bank_account_number,
        e.salary, e.currency,
        e.pay_scale_area, e.pay_scale_type, e.pay_scale_group, e.pay_scale_level,
        e.pay_periods_per_year, e.work_schedule_percentage,
        e.pernr, e.company_code, e.personnel_area, e.personnel_subarea,
        e.auth_username, e.auth_role, e.auth_permissions, e.auth_last_login,
        calculate_expected_retirement_date(e.birth_date, e.hire_date, e.tenant_id) AS expected_retirement_date,
        d.name as department_name,
        o.name as org_unit_name,
        l.name as location_name,
        cc.name as cost_center_name,
        m.first_name as manager_first_name,
        m.last_name as manager_last_name,
        m.email as manager_email
      FROM employees e
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      LEFT JOIN org_units o ON e.org_unit_id = o.id
      LEFT JOIN locations l ON e.location_id = l.id
      LEFT JOIN cost_centers cc ON e.cost_center_id = cc.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.id = $1 AND e.tenant_id = $2`,
      [employeeId, tenantId]
    );

    if (result.rows.length === 0) {
      throw createAppError('Employee profile not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Get leave balances summary
    const leaveBalances = await req.dbClient!.query(
      `SELECT leave_type, balance AS balance_remaining, (balance + used_days) AS balance_total
       FROM leave_balances
       WHERE employee_id = $1 AND year = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [employeeId]
    );

    res.json({
      success: true,
      data: {
        profile: result.rows[0],
        leaveBalances: leaveBalances.rows,
      },
    });
  })
);

/**
 * PATCH /employees/me
 * Update current user's own permitted information (Story 3.6)
 * Only allows updating personal contact information
 */
router.patch(
  '/me',
  validate(updateSelfEmployeeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user.employeeId;

    if (!employeeId) {
      throw createAppError('No employee profile linked to this user', 404, ErrorCodes.NOT_FOUND);
    }

    // Only these fields can be self-updated (GDPR compliant)
    const selfUpdateableFields = [
      'phone_mobile',
      'phone_home',
      'personal_email',
      'address_street',
      'address_city',
      'address_postal_code',
      'address_country',
      'emergency_contact_name',
      'emergency_contact_phone',
      'emergency_contact_relationship',
      'iban',
      'bank_name',
      'bank_account_number',
      'swift_bic',
    ];

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of selfUpdateableFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      throw createAppError(
        'No valid fields to update. Only personal contact information can be self-updated.',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    updates.push(`updated_at = NOW()`);

    const result = await req.dbClient!.query(
      `UPDATE employees
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
       RETURNING id, first_name, last_name, phone_mobile, phone_home, personal_email,
                 address_street, address_city, address_postal_code, address_country,
                 emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
                 iban, bank_name`,
      [...values, employeeId, tenantId]
    );

    if (result.rows.length === 0) {
      throw createAppError('Employee profile not found', 404, ErrorCodes.NOT_FOUND);
    }

    res.json({
      success: true,
      data: result.rows[0] || null,
      message: 'Personal information updated successfully',
    });
  })
);

/**
 * GET /employees/me/documents
 * Get current user's documents (payslips, contracts, etc.)
 */
router.get(
  '/me/documents',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user.employeeId;

    if (!employeeId) {
      throw createAppError('No employee profile linked to this user', 404, ErrorCodes.NOT_FOUND);
    }

    // Check if documents table exists
    const tableCheck = await req.dbClient!.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'employee_documents')`
    );

    if (!tableCheck.rows[0].exists) {
      res.json({
        success: true,
        data: [],
        message: 'Documents feature not yet configured',
      });
      return;
    }

    const result = await req.dbClient!.query(
      `SELECT id, document_type, filename, file_size, upload_date, description
       FROM employee_documents
       WHERE employee_id = $1 AND tenant_id = $2
       ORDER BY upload_date DESC`,
      [employeeId, tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * GET /employees/me/team
 * Get current user's team members (if they are a manager)
 */
router.get(
  '/me/team',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user.employeeId;

    if (!employeeId) {
      throw createAppError('No employee profile linked to this user', 404, ErrorCodes.NOT_FOUND);
    }

    const result = await req.dbClient!.query(
      `SELECT
        id, first_name, last_name, email, job_title,
        department, location, hire_date, is_active
       FROM employees
       WHERE manager_id = $1 AND tenant_id = $2 AND is_active = true
       ORDER BY last_name, first_name`,
      [employeeId, tenantId]
    );

    res.json({
      success: true,
      data: {
        teamSize: result.rows.length,
        members: result.rows,
      },
    });
  })
);

/**
 * GET /employees/me/contracts (FE-007)
 * Alias for /api/v1/contracts/employee/{id} resolved from JWT employeeId
 */
router.get(
  '/me/contracts',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user.employeeId;

    if (!employeeId) {
      throw createAppError('No employee profile linked to this user', 404, ErrorCodes.NOT_FOUND);
    }

    const result = await req.dbClient!.query(
      `SELECT c.id, c.employee_id, c.contract_type, c.contract_code,
              c.start_date, c.end_date, c.probation_end_date,
              c.ccnl_type, c.ccnl_level, c.gross_annual_salary, c.currency,
              c.salary_type, c.payment_frequency, c.work_hours_weekly,
              c.work_schedule_type, c.part_time_percentage,
              c.job_title, c.status, c.termination_date, c.termination_reason,
              c.created_at, c.updated_at
         FROM contracts c
        WHERE c.tenant_id = $1 AND c.employee_id = $2
        ORDER BY c.start_date DESC`,
      [tenantId, employeeId]
    );

    const activeContract = result.rows.find((c: any) => c.status === 'active');

    res.json({
      success: true,
      data: {
        contracts: result.rows,
        activeContract: activeContract || null,
        totalContracts: result.rows.length,
      },
    });
  })
);

/**
 * GET /employees/meta/termination-reasons
 * Get list of valid termination reasons
 */
router.get('/meta/termination-reasons', (_req: Request, res: Response) => {
  const reasons = [
    { value: 'resignation', label: 'Dimissioni volontarie' },
    { value: 'retirement', label: 'Pensionamento' },
    { value: 'contract_end', label: 'Fine contratto' },
    { value: 'layoff', label: 'Licenziamento' },
    { value: 'mutual_agreement', label: 'Risoluzione consensuale' },
    { value: 'transfer', label: 'Trasferimento' },
    { value: 'deceased', label: 'Decesso' },
    { value: 'other', label: 'Altro' },
  ];

  res.json({ success: true, data: reasons });
});

/**
 * GET /employees/meta/employment-statuses
 * Get list of valid employment statuses
 */
router.get('/meta/employment-statuses', (_req: Request, res: Response) => {
  const statuses = [
    { value: 'active', label: 'Attivo' },
    { value: 'on_leave', label: 'In aspettativa' },
    { value: 'probation', label: 'In prova' },
    { value: 'suspended', label: 'Sospeso' },
    { value: 'notice_period', label: 'In preavviso' },
    { value: 'terminated', label: 'Cessato' },
  ];

  res.json({ success: true, data: statuses });
});

// =============================================================================
// PARAMETERIZED ROUTES (/:id and sub-routes)
// =============================================================================

/**
 * GET /employees/:id
 * Get single employee by ID
 */
router.get(
  '/:id',
  checkPermission(PERMISSIONS.EMPLOYEES_VIEW_ALL),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid employee ID format', 400, ErrorCodes.INVALID_INPUT);
    }

    const result = await req.dbClient!.query(
      `SELECT
        e.*,
        d.name as department_name,
        o.name as org_unit_name,
        l.name as location_name,
        cc.name as cost_center_name,
        m.first_name as manager_first_name,
        m.last_name as manager_last_name
      FROM employees e
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      LEFT JOIN org_units o ON e.org_unit_id = o.id
      LEFT JOIN locations l ON e.location_id = l.id
      LEFT JOIN cost_centers cc ON e.cost_center_id = cc.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.id = $1 AND e.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw createAppError('Employee not found', 404, ErrorCodes.NOT_FOUND);
    }

    // RBP Step 2.2 (TASK-08 foundation): apply field policy to mask/hide
    // sensitive columns based on the requesting user's role. The policy
    // map is loaded from rbp_field_policies; the field-classification map
    // lives in utils/field-policy.ts (FIELD_CLASSIFICATION_REGISTRY) and
    // will eventually move to a DB table.
    const userRole = (req as AuthenticatedRequest).user?.role || 'EMPLOYEE';
    const policyMap = await loadPolicyForRole(userRole);
    const filtered = applyFieldPolicy(result.rows[0], 'employees', policyMap);

    res.json({
      success: true,
      data: filtered,
    });
  })
);

/**
 * POST /employees
 * Create new employee
 */
router.post(
  '/',
  requirePermission('CORE_HR', 'CREATE'),
  validate(createEmployeeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      first_name,
      last_name,
      email,
      job_title,
      org_unit_id,
      location_id,
      manager_id,
      hire_date,
    } = req.body;

    // Validation
    if (!first_name || !last_name || !email) {
      throw createAppError(
        'Missing required fields: first_name, last_name, email',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Check email uniqueness within tenant
    const existingEmail = await req.dbClient!.query(
      'SELECT id FROM employees WHERE email = $1 AND tenant_id = $2',
      [email, tenantId]
    );

    if (existingEmail.rows.length > 0) {
      throw createAppError('Email already exists', 409, ErrorCodes.ALREADY_EXISTS);
    }

    const result = await req.dbClient!.query(
      `INSERT INTO employees (
        tenant_id, first_name, last_name, email, job_title,
        org_unit_id, org_unit_id, location_id, manager_id, hire_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        tenantId,
        first_name,
        last_name,
        email,
        job_title || null,
        org_unit_id || null,
        org_unit_id || null,
        location_id || null,
        manager_id || null,
        hire_date || null,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0] || null,
      message: 'Employee created successfully',
    });
  })
);

/**
 * PATCH /employees/:id
 * Update employee
 */
router.patch(
  '/:id',
  requirePermission('CORE_HR', 'EDIT'),
  validate(updateEmployeeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid employee ID format', 400, ErrorCodes.INVALID_INPUT);
    }

    // Check employee exists
    const existing = await req.dbClient!.query(
      'SELECT id FROM employees WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      throw createAppError('Employee not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Build update query dynamically
    const allowedFields = [
      'first_name',
      'last_name',
      'email',
      'job_title',
      'org_unit_id',
      'org_unit_id',
      'location_id',
      'manager_id',
      'hire_date',
      'is_active',
      'employment_status',
    ];

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      throw createAppError('No fields to update', 400, ErrorCodes.VALIDATION_ERROR);
    }

    updates.push(`updated_at = NOW()`);

    const result = await req.dbClient!.query(
      `UPDATE employees
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
       RETURNING *`,
      [...values, id, tenantId]
    );

    res.json({
      success: true,
      data: result.rows[0] || null,
      message: 'Employee updated successfully',
    });
  })
);

/**
 * DELETE /employees/:id
 * Soft delete employee (set is_active = false)
 */
router.delete(
  '/:id',
  requirePermission('CORE_HR', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const hardDelete = req.query['hard'] === 'true';

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid employee ID format', 400, ErrorCodes.INVALID_INPUT);
    }

    if (hardDelete) {
      // Hard delete - actually remove the record
      const result = await req.dbClient!.query(
        'DELETE FROM employees WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [id, tenantId]
      );

      if (result.rows.length === 0) {
        throw createAppError('Employee not found', 404, ErrorCodes.NOT_FOUND);
      }

      res.json({
        success: true,
        message: 'Employee permanently deleted',
      });
    } else {
      // Soft delete - set is_active to false
      const result = await req.dbClient!.query(
        `UPDATE employees
         SET is_active = false, employment_status = 'terminated', termination_date = NOW(), updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2
         RETURNING id`,
        [id, tenantId]
      );

      if (result.rows.length === 0) {
        throw createAppError('Employee not found', 404, ErrorCodes.NOT_FOUND);
      }

      res.json({
        success: true,
        message: 'Employee deactivated successfully',
      });
    }
  })
);

/**
 * GET /employees/:id/direct-reports
 * Get direct reports for an employee
 */
router.get(
  '/:id/direct-reports',
  checkPermission(PERMISSIONS.EMPLOYEES_VIEW_ALL),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid employee ID format', 400, ErrorCodes.INVALID_INPUT);
    }

    const result = await req.dbClient!.query(
      `SELECT
        id, first_name, last_name, email, job_title,
        department, is_active, hire_date
      FROM employees
      WHERE manager_id = $1 AND tenant_id = $2 AND is_active = true
      ORDER BY last_name, first_name
      LIMIT 200`,
      [id, tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * POST /employees/:id/reactivate
 * Reactivate a deactivated employee
 */
router.post(
  '/:id/reactivate',
  requirePermission('CORE_HR', 'EDIT'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid employee ID format', 400, ErrorCodes.INVALID_INPUT);
    }

    // Check employee exists and is inactive
    const existing = await req.dbClient!.query(
      'SELECT id, is_active, first_name, last_name FROM employees WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      throw createAppError('Employee not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (existing.rows[0].is_active) {
      throw createAppError('Employee is already active', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE employees SET
           is_active = true,
           employment_status = 'active',
           termination_date = NULL,
           termination_reason = NULL,
           updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );

      // Update tenant employee count
      await client.query(
        'UPDATE tenants SET employee_count = (SELECT COUNT(*) FROM employees WHERE tenant_id = $1 AND is_active = true) WHERE id = $1',
        [tenantId]
      );
    }, tenantId);

    res.json({
      success: true,
      message: `Employee '${existing.rows[0]?.first_name} ${existing.rows[0]?.last_name}' reactivated successfully`,
    });
  })
);

/**
 * POST /employees/:id/archive
 * Archive employee with reason (Story 3.2)
 */
router.post(
  '/:id/archive',
  checkPermission(PERMISSIONS.EMPLOYEES_UPDATE),
  validate(archiveEmployeeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { reason, termination_date, notes } = req.body;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid employee ID format', 400, ErrorCodes.INVALID_INPUT);
    }

    if (!reason) {
      throw createAppError('Termination reason is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check employee exists
    const existing = await req.dbClient!.query(
      'SELECT id, first_name, last_name, is_active FROM employees WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      throw createAppError('Employee not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (!existing.rows[0].is_active) {
      throw createAppError('Employee is already archived', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Archive the employee and update tenant count atomically
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE employees SET
           is_active = false,
           employment_status = 'terminated',
           termination_date = COALESCE($3, NOW()),
           termination_reason = $4,
           updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId, termination_date, `${reason}${notes ? ' - ' + notes : ''}`]
      );

      // Update tenant employee count
      await client.query(
        'UPDATE tenants SET employee_count = (SELECT COUNT(*) FROM employees WHERE tenant_id = $1 AND is_active = true) WHERE id = $1',
        [tenantId]
      );
    }, tenantId);

    res.json({
      success: true,
      message: `Employee '${existing.rows[0]?.first_name} ${existing.rows[0]?.last_name}' archived successfully`,
      data: {
        reason,
        terminationDate: termination_date || new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /employees/:id/org-chart
 * Get organizational chart data for an employee
 */
router.get(
  '/:id/org-chart',
  checkPermission(PERMISSIONS.EMPLOYEES_VIEW_ALL),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const depth = Math.min(5, safeParseInt(req.query['depth'] as string, { fallback: 2 }));

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid employee ID format', 400, ErrorCodes.INVALID_INPUT);
    }

    const employeeResult = await req.dbClient!.query(
      'SELECT id, tenant_id, first_name, last_name, job_title, manager_id FROM employees WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (employeeResult.rows.length === 0) {
      throw createAppError('Employee not found', 404, ErrorCodes.NOT_FOUND);
    }

    const employee = employeeResult.rows[0];

    // Get manager chain (upward) — single CTE instead of N+1 loop
    const managerChainResult = await req.dbClient!.query(
      `WITH RECURSIVE manager_chain AS (
        SELECT id, first_name, last_name, job_title, manager_id, 1 as chain_depth
        FROM employees
        WHERE id = $3 AND tenant_id = $2
        UNION ALL
        SELECT e.id, e.first_name, e.last_name, e.job_title, e.manager_id, mc.chain_depth + 1
        FROM employees e
        JOIN manager_chain mc ON e.id = mc.manager_id
        WHERE e.tenant_id = $2 AND mc.chain_depth < 10
      )
      SELECT id, first_name, last_name, job_title, manager_id
      FROM manager_chain
      ORDER BY chain_depth DESC`,
      [id, tenantId, employee.manager_id]
    );
    const managerChain = employee.manager_id ? managerChainResult.rows : [];

    // Get direct reports (downward) — single CTE instead of N+1 recursive calls
    const reportsResult = await req.dbClient!.query(
      `WITH RECURSIVE report_tree AS (
        SELECT id, first_name, last_name, job_title, manager_id, 1 as tree_depth
        FROM employees
        WHERE manager_id = $1 AND tenant_id = $2 AND is_active = true
        UNION ALL
        SELECT e.id, e.first_name, e.last_name, e.job_title, e.manager_id, rt.tree_depth + 1
        FROM employees e
        JOIN report_tree rt ON e.manager_id = rt.id
        WHERE e.tenant_id = $2 AND e.is_active = true AND rt.tree_depth < $3
      )
      SELECT id, first_name, last_name, job_title, manager_id, tree_depth
      FROM report_tree
      ORDER BY tree_depth, last_name, first_name`,
      [id, tenantId, depth]
    );

    // Build nested tree structure from flat CTE result
    const buildTree = (rows: typeof reportsResult.rows, parentId: string): unknown[] => {
      return rows
        .filter((r) => r.manager_id === parentId)
        .map((r) => ({
          id: r.id,
          first_name: r.first_name,
          last_name: r.last_name,
          job_title: r.job_title,
          manager_id: r.manager_id,
          directReports: buildTree(rows, r.id),
        }));
    };

    const directReports = buildTree(reportsResult.rows, id);

    res.json({
      success: true,
      data: {
        employee: {
          id: employee.id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          job_title: employee.job_title,
        },
        managerChain,
        directReports,
      },
    });
  })
);

export default router;
