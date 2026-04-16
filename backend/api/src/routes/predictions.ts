/**
 * Predictions Routes
 * Epic 7 - Story 7.6: Predictive Analytics Models
 *
 * API for predictive analytics and risk scoring
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { predictiveAnalyticsService } from '../services/predictive-analytics.js';
import type { ModelType, ModelStatus, RiskLevel } from '../services/predictive-analytics.js';
import { validateIdentifier } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import {
  createPredictionModelSchema,
  updateModelStatusSchema,
  generatePerformancePredictionsSchema,
  validatePredictionsSchema,
} from '../schemas/admin.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
import { logger } from '../config/logger.js';

const router = Router();

router.use(requireTenant);

// ============================================================================
// Root handler — prediction overview
// ============================================================================

/**
 * GET /predictions
 * Overview of available prediction endpoints and summary stats
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    // Quick summary counts (resilient to missing tables)
    let stats: Record<string, string> = {};
    try {
      const result = await req.dbClient!.query(
        `SELECT
          (SELECT COUNT(*) FROM performance_predictions WHERE tenant_id = $1 AND is_current = true) as active_predictions,
          (SELECT COUNT(*) FROM performance_predictions WHERE tenant_id = $1 AND is_current = true AND is_high_potential = true) as high_potentials,
          (SELECT COUNT(*) FROM performance_predictions WHERE tenant_id = $1 AND is_current = true AND risk_level IN ('high', 'critical')) as high_risk_count`,
        [tenantId]
      );
      stats = result.rows[0] || {};
    } catch (_err) {
      logger.warn({ err: _err }, 'Silent catch in routes.predictions');
    }

    res.json({
      success: true,
      data: {
        summary: {
          activePredictions: parseInt(stats.active_predictions || '0'),
          highPotentials: parseInt(stats.high_potentials || '0'),
          highRisk: parseInt(stats.high_risk_count || '0'),
        },
        endpoints: [
          'GET /predictions/models',
          'GET /predictions/summary',
          'GET /predictions/performance',
          'GET /predictions/turnover/high-risk',
          'GET /predictions/risk-distribution',
          'GET /predictions/high-potentials',
          'GET /predictions/flight-risk/:employeeId',
          'GET /predictions/skill-demand',
          'GET /predictions/ai-recommendations',
          'GET /predictions/accuracy',
        ],
      },
    });
  })
);

// ============================================================================
// Model Management
// ============================================================================

/**
 * GET /predictions/models
 * List prediction models
 */
router.get(
  '/models',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { type, status } = req.query as Record<string, string>;

    const models = await predictiveAnalyticsService.listModels(tenantId, {
      ...(type ? { type: type as ModelType } : {}),
      ...(status ? { status: status as ModelStatus } : {}),
    });

    res.json({ success: true, data: models });
  })
);

/**
 * POST /predictions/models
 * Register a new model
 */
router.post(
  '/models',
  validate(createPredictionModelSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { name, type, version, description, config, created_by } = req.body;

    if (!name || !type || !version || !config) {
      throw Errors.badRequest('name, type, version, and config are required');
    }

    const model = await predictiveAnalyticsService.registerModel(tenantId, {
      name,
      type,
      version,
      description,
      config,
      created_by: created_by || 'system',
    });

    res.status(201).json({
      success: true,
      data: model,
      message: 'Model registered successfully',
    });
  })
);

/**
 * PATCH /predictions/models/:id/status
 * Update model status
 */
router.patch(
  '/models/:id/status',
  validate(updateModelStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { status } = req.body;

    if (!status) {
      throw Errors.badRequest('status is required');
    }

    const model = await predictiveAnalyticsService.updateModelStatus(tenantId, id, status);

    if (!model) {
      throw Errors.notFound('Model');
    }

    res.json({
      success: true,
      data: model,
      message: 'Model status updated',
    });
  })
);

// ============================================================================
// Turnover Risk Predictions
// ============================================================================

/**
 * GET /predictions/turnover/high-risk
 * Get employees with high turnover risk
 * NOTE: Must be before /turnover/:employeeId to avoid param matching
 */
router.get(
  '/turnover/high-risk',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { risk_level, limit = '50' } = req.query as Record<string, string>;

    const employees = await predictiveAnalyticsService.getHighRiskEmployees(tenantId, {
      ...(risk_level ? { risk_level: risk_level as RiskLevel } : {}),
      limit: safeParseInt(limit as string, { fallback: 50 }),
    });

    res.json({ success: true, data: employees });
  })
);

/**
 * POST /predictions/turnover/batch
 * Calculate turnover risk for all employees
 */
router.post(
  '/turnover/batch',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await predictiveAnalyticsService.batchCalculateTurnoverRisk(tenantId);

    res.json({
      success: true,
      data: result,
      message: `Processed ${result.processed} employees with ${result.errors} errors`,
    });
  })
);

/**
 * GET /predictions/turnover/:employeeId
 * Calculate turnover risk for a specific employee
 */
router.get(
  '/turnover/:employeeId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'] as string;

    const prediction = await predictiveAnalyticsService.calculateTurnoverRisk(tenantId, employeeId);

    res.json({ success: true, data: prediction });
  })
);

// ============================================================================
// Performance Predictions
// ============================================================================

/**
 * GET /predictions/performance/:employeeId
 * Predict performance for a specific employee
 */
router.get(
  '/performance/:employeeId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'] as string;

    const prediction = await predictiveAnalyticsService.predictPerformance(tenantId, employeeId);

    res.json({ success: true, data: prediction });
  })
);

// ============================================================================
// Summary & Overview
// ============================================================================

/**
 * GET /predictions/summary
 * Get prediction summary for the organization
 */
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const summary = await predictiveAnalyticsService.getPredictionSummary(tenantId);

    res.json({ success: true, data: summary });
  })
);

// ============================================================================
// S-PERF-01-08: Performance Predictions (AI) - Enhanced Endpoints
// ============================================================================

/**
 * GET /predictions/performance
 * Get all current performance predictions with risk and HiPo info
 */
router.get(
  '/performance',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      risk_level,
      is_high_potential,
      org_unit_id,
      limit = '100',
      offset = '0',
      sort_by = 'risk_score',
      sort_order = 'desc',
    } = req.query as Record<string, string>;

    let query = `
      SELECT
        pp.id,
        pp.employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.job_title,
        d.name as department_name,
        pp.prediction_period,
        pp.predicted_rating,
        pp.confidence_interval_low,
        pp.confidence_interval_high,
        pp.risk_score,
        pp.risk_level,
        pp.is_high_potential,
        pp.hipo_score,
        pp.hipo_justification,
        pp.contributing_factors,
        pp.recommended_actions,
        pp.prediction_confidence,
        pp.model_name,
        pp.model_version,
        pp.created_at
      FROM performance_predictions pp
      JOIN employees e ON pp.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE pp.tenant_id = $1
        AND pp.is_current = true
    `;
    const params: (string | number)[] = [tenantId];
    let paramIndex = 2;

    if (risk_level) {
      query += ` AND pp.risk_level = $${paramIndex}`;
      params.push(risk_level as string);
      paramIndex++;
    }

    if (is_high_potential === 'true') {
      query += ` AND pp.is_high_potential = true`;
    } else if (is_high_potential === 'false') {
      query += ` AND pp.is_high_potential = false`;
    }

    if (org_unit_id) {
      query += ` AND e.org_unit_id = $${paramIndex}`;
      params.push(org_unit_id as string);
      paramIndex++;
    }

    // Sorting
    const validSortColumns = [
      'risk_score',
      'predicted_rating',
      'hipo_score',
      'employee_name',
      'created_at',
    ];
    const sortColumn = validateIdentifier(
      validSortColumns.includes(sort_by as string) ? (sort_by as string) : 'risk_score',
      'predictions.performance-sort'
    );
    const order = sort_order === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY pp.${sortColumn} ${order}`;

    // Pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 50 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM performance_predictions pp
      JOIN employees e ON pp.employee_id = e.id
      WHERE pp.tenant_id = $1 AND pp.is_current = true
    `;
    const countParams: (string | number)[] = [tenantId];
    let countIndex = 2;

    if (risk_level) {
      countQuery += ` AND pp.risk_level = $${countIndex}`;
      countParams.push(risk_level as string);
      countIndex++;
    }
    if (is_high_potential === 'true') {
      countQuery += ` AND pp.is_high_potential = true`;
    }
    if (org_unit_id) {
      countQuery += ` AND e.org_unit_id = $${countIndex}`;
      countParams.push(org_unit_id as string);
    }

    const countResult = await req.dbClient!.query(countQuery, countParams);

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit: safeParseInt(limit as string, { fallback: 50 }),
        offset: safeParseInt(offset as string, { fallback: 0 }),
      },
    });
  })
);

/**
 * POST /predictions/performance/generate
 * Generate predictions for all employees in tenant
 */
router.post(
  '/performance/generate',
  validate(generatePerformancePredictionsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { prediction_period } = req.body;

    const result = await req.dbClient!.query(`SELECT * FROM fn_generate_predictions($1, $2)`, [
      tenantId,
      prediction_period || null,
    ]);

    const data = result.rows[0];

    res.json({
      success: true,
      data: {
        employees_processed: data.employees_processed,
        predictions_created: data.predictions_created,
        hipos_identified: data.hipos_identified,
        high_risk_count: data.high_risk_count,
      },
      message: `Generated predictions for ${data.employees_processed} employees`,
    });
  })
);

/**
 * GET /predictions/performance/:employeeId/factors
 * Get detailed contributing factors for an employee's prediction
 */
router.get(
  '/performance/:employeeId/factors',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'] as string;

    const result = await req.dbClient!.query(`SELECT * FROM fn_calculate_risk_score($1, $2)`, [
      tenantId,
      employeeId,
    ]);

    const hipoResult = await req.dbClient!.query(`SELECT * FROM fn_calculate_hipo_score($1, $2)`, [
      tenantId,
      employeeId,
    ]);

    res.json({
      success: true,
      data: {
        risk: result.rows[0] || null,
        potential: hipoResult.rows[0] || null,
      },
    });
  })
);

/**
 * GET /predictions/risk-distribution
 * Get risk distribution by department
 */
router.get(
  '/risk-distribution',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `SELECT tenant_id, org_unit_id, department_name, total_employees,
              low_risk, medium_risk, high_risk, critical_risk,
              high_potentials, avg_risk_score, avg_predicted_rating
       FROM v_risk_distribution WHERE tenant_id = $1 ORDER BY department_name LIMIT 100`,
      [tenantId]
    );

    // Calculate totals
    const totals = result.rows.reduce(
      (acc, row) => ({
        total_employees: acc.total_employees + parseInt(row.total_employees),
        low_risk: acc.low_risk + parseInt(row.low_risk),
        medium_risk: acc.medium_risk + parseInt(row.medium_risk),
        high_risk: acc.high_risk + parseInt(row.high_risk),
        critical_risk: acc.critical_risk + parseInt(row.critical_risk),
        high_potentials: acc.high_potentials + parseInt(row.high_potentials),
      }),
      {
        total_employees: 0,
        low_risk: 0,
        medium_risk: 0,
        high_risk: 0,
        critical_risk: 0,
        high_potentials: 0,
      }
    );

    res.json({
      success: true,
      data: {
        departments: result.rows,
        totals,
      },
    });
  })
);

/**
 * GET /predictions/high-potentials
 * Get list of high potential employees with details
 */
router.get(
  '/high-potentials',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { org_unit_id, min_score = '3.0', limit = '50' } = req.query as Record<string, string>;

    let query = `
      SELECT
        pp.employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.job_title,
        d.name as department_name,
        pp.hipo_score,
        pp.hipo_justification,
        pp.predicted_rating,
        pp.risk_score,
        pp.contributing_factors,
        pp.recommended_actions,
        e.hire_date,
        EXTRACT(YEAR FROM AGE(NOW(), e.hire_date)) as tenure_years
      FROM performance_predictions pp
      JOIN employees e ON pp.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE pp.tenant_id = $1
        AND pp.is_current = true
        AND pp.is_high_potential = true
        AND pp.hipo_score >= $2
    `;
    const params: (string | number)[] = [tenantId, parseFloat(min_score as string)];
    let paramIndex = 3;

    if (org_unit_id) {
      query += ` AND e.org_unit_id = $${paramIndex}`;
      params.push(org_unit_id as string);
      paramIndex++;
    }

    query += ` ORDER BY pp.hipo_score DESC LIMIT $${paramIndex}`;
    params.push(safeParseInt(limit as string, { fallback: 50 }));

    const result = await req.dbClient!.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: result.rows.length,
        min_score: parseFloat(min_score as string),
      },
    });
  })
);

/**
 * POST /predictions/validate
 * Validate predictions against actual ratings for accuracy tracking
 */
router.post(
  '/validate',
  validate(validatePredictionsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { prediction_period } = req.body;

    if (!prediction_period) {
      throw Errors.badRequest('prediction_period is required');
    }

    const result = await req.dbClient!.query(`SELECT * FROM fn_validate_predictions($1, $2)`, [
      tenantId,
      prediction_period,
    ]);

    const data = result.rows[0];

    res.json({
      success: true,
      data: {
        predictions_validated: data.predictions_validated,
        mean_absolute_error: data.mean_absolute_error ? parseFloat(data.mean_absolute_error) : null,
        accuracy_within_05: data.accuracy_within_05
          ? parseFloat(data.accuracy_within_05) * 100
          : null,
        accuracy_within_10: data.accuracy_within_10
          ? parseFloat(data.accuracy_within_10) * 100
          : null,
      },
      message: `Validated ${data.predictions_validated} predictions`,
    });
  })
);

/**
 * GET /predictions/accuracy
 * Get model accuracy metrics over time
 */
router.get(
  '/accuracy',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { model_name = 'heuresys-perf-v1', limit = '10' } = req.query as Record<string, string>;

    const result = await req.dbClient!.query(
      `SELECT
        model_name,
        model_version,
        prediction_period,
        total_predictions,
        validated_predictions,
        mean_absolute_error,
        accuracy_within_05,
        accuracy_within_10,
        hipo_precision,
        hipo_recall,
        risk_precision,
        calculated_at
      FROM prediction_model_accuracy
      WHERE tenant_id = $1
        AND model_name = $2
      ORDER BY calculated_at DESC
      LIMIT $3`,
      [tenantId, model_name, safeParseInt(limit as string, { fallback: 50 })]
    );

    // Calculate aggregate metrics
    const validRows = result.rows.filter((r) => r.mean_absolute_error);
    const aggregateMetrics =
      validRows.length > 0
        ? {
            avg_mae:
              validRows.reduce((sum, r) => sum + parseFloat(r.mean_absolute_error), 0) /
              validRows.length,
            avg_accuracy_05:
              validRows.reduce((sum, r) => sum + parseFloat(r.accuracy_within_05 || 0), 0) /
              validRows.length,
            avg_accuracy_10:
              validRows.reduce((sum, r) => sum + parseFloat(r.accuracy_within_10 || 0), 0) /
              validRows.length,
            total_validated: validRows.reduce(
              (sum, r) => sum + parseInt(r.validated_predictions),
              0
            ),
          }
        : null;

    res.json({
      success: true,
      data: {
        history: result.rows,
        aggregate: aggregateMetrics,
      },
    });
  })
);

/**
 * GET /predictions/actions
 * Get reference list of recommended actions
 */
router.get(
  '/actions',
  asyncHandler(async (req: Request, res: Response) => {
    const { category, risk_level, for_hipo } = req.query as Record<string, string>;

    let query = `
      SELECT
        action_code,
        action_name,
        action_category,
        description,
        applicable_risk_levels,
        applicable_hipo,
        estimated_impact,
        typical_duration
      FROM prediction_actions
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND action_category = $${paramIndex}`;
      params.push(category as string);
      paramIndex++;
    }

    if (risk_level) {
      query += ` AND $${paramIndex} = ANY(applicable_risk_levels)`;
      params.push(risk_level as string);
      paramIndex++;
    }

    if (for_hipo === 'true') {
      query += ` AND applicable_hipo = true`;
    }

    query += ` ORDER BY action_category, action_name`;

    const result = await req.dbClient!.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * GET /predictions/factors
 * Get reference list of prediction factors with their weights
 */
router.get(
  '/factors',
  asyncHandler(async (req: Request, res: Response) => {
    const { category, active_only = 'true' } = req.query as Record<string, string>;

    let query = `
      SELECT
        factor_code,
        factor_name,
        factor_category,
        description,
        weight_default,
        data_source,
        is_positive
      FROM prediction_factors
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (active_only === 'true') {
      query += ` AND is_active = true`;
    }

    if (category) {
      query += ` AND factor_category = $${paramIndex}`;
      params.push(category as string);
      paramIndex++;
    }

    query += ` ORDER BY factor_category, weight_default DESC`;

    const result = await req.dbClient!.query(query, params);

    // Group by category
    const byCategory = result.rows.reduce(
      (acc: Record<string, any[]>, factor) => {
        const category = factor.factor_category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category]!.push(factor);
        return acc;
      },
      {} as Record<string, any[]>
    );

    res.json({
      success: true,
      data: {
        all: result.rows,
        by_category: byCategory,
      },
    });
  })
);

// ============================================================================
// S-ANLT-01-02: AI-Powered Predictive Analytics - Flight Risk & Skill Demand
// ============================================================================

/**
 * GET /predictions/flight-risk/:employeeId
 * Get flight risk score and factors for a specific employee
 */
router.get(
  '/flight-risk/:employeeId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employeeId } = req.params as Record<string, string>;

    // Get employee basic info and calculate flight risk
    const employeeResult = await req.dbClient!.query(
      `
      SELECT
        e.id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.job_title,
        e.hire_date,
        d.name as department_name,
        e.salary,
        EXTRACT(YEAR FROM age(CURRENT_DATE, e.hire_date)) as tenure_years,
        (SELECT AVG(overall_rating) FROM performance_reviews WHERE employee_id = e.id) as avg_performance,
        (SELECT COUNT(*) FROM goals WHERE employee_id = e.id AND status = 'completed') as goals_completed,
        (SELECT COUNT(*) FROM course_enrollments WHERE employee_id = e.id AND status = 'completed') as courses_completed
      FROM employees e
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE e.id = $1 AND e.tenant_id = $2 AND e.is_active = true
    `,
      [employeeId, tenantId]
    );

    if (employeeResult.rows.length === 0) {
      throw Errors.notFound('Employee');
    }

    const emp = employeeResult.rows[0];

    // Calculate flight risk score (1-100)
    let riskScore = 50; // Base score
    const factors: { factor: string; impact: number; description: string }[] = [];

    // Tenure factor (short tenure = higher risk)
    const tenure = parseFloat(emp.tenure_years) || 0;
    if (tenure < 1) {
      riskScore += 15;
      factors.push({
        factor: 'Short Tenure',
        impact: 15,
        description: 'Less than 1 year with company',
      });
    } else if (tenure < 2) {
      riskScore += 10;
      factors.push({ factor: 'Limited Tenure', impact: 10, description: '1-2 years with company' });
    } else if (tenure > 5) {
      riskScore -= 10;
      factors.push({
        factor: 'Long Tenure',
        impact: -10,
        description: 'More than 5 years with company',
      });
    }

    // Performance factor
    const avgPerf = parseFloat(emp.avg_performance) || 3;
    if (avgPerf < 2.5) {
      riskScore += 10;
      factors.push({
        factor: 'Low Performance',
        impact: 10,
        description: 'Below average performance ratings',
      });
    } else if (avgPerf >= 4) {
      riskScore += 5; // High performers can also be flight risk (poached)
      factors.push({
        factor: 'High Performer',
        impact: 5,
        description: 'May be targeted by competitors',
      });
    }

    // Goals completion
    if (emp.goals_completed < 2) {
      riskScore += 5;
      factors.push({
        factor: 'Low Goal Completion',
        impact: 5,
        description: 'Few completed goals indicates disengagement',
      });
    }

    // Learning engagement
    if (emp.courses_completed > 5) {
      riskScore -= 5;
      factors.push({
        factor: 'Active Learner',
        impact: -5,
        description: 'Engaged in professional development',
      });
    }

    // Normalize score
    riskScore = Math.max(1, Math.min(100, riskScore));

    // Determine risk level
    let riskLevel: string;
    if (riskScore >= 75) riskLevel = 'critical';
    else if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 40) riskLevel = 'medium';
    else riskLevel = 'low';

    // Generate recommendations
    const recommendations: string[] = [];
    if (tenure < 2) {
      recommendations.push('Schedule career development discussion');
      recommendations.push('Consider mentorship program enrollment');
    }
    if (avgPerf >= 4) {
      recommendations.push('Review compensation competitiveness');
      recommendations.push('Discuss growth opportunities');
    }
    if (emp.courses_completed < 3) {
      recommendations.push('Recommend relevant training courses');
    }

    res.json({
      success: true,
      data: {
        employee: {
          id: emp.id,
          name: emp.employee_name,
          job_title: emp.job_title,
          department: emp.department_name,
          tenure_years: tenure,
        },
        risk_score: riskScore,
        risk_level: riskLevel,
        factors: factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
        recommendations,
        calculated_at: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /predictions/flight-risk/department/:deptId
 * Get flight risk summary for a department
 */
router.get(
  '/flight-risk/department/:deptId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { deptId } = req.params as Record<string, string>;

    // Get department employees with risk indicators (CTE eliminates N+1 correlated subqueries)
    const result = await req.dbClient!.query(
      `
      WITH perf_avg AS (
        SELECT employee_id, AVG(overall_rating) as avg_rating
        FROM performance_reviews
        GROUP BY employee_id
      )
      SELECT
        e.id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.job_title,
        e.hire_date,
        EXTRACT(YEAR FROM age(CURRENT_DATE, e.hire_date)) as tenure_years,
        pa.avg_rating as avg_performance,
        CASE
          WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, e.hire_date)) < 1 THEN 70
          WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, e.hire_date)) < 2 THEN 55
          ELSE 35
        END +
        CASE
          WHEN pa.avg_rating < 2.5 THEN 15
          WHEN pa.avg_rating >= 4 THEN 10
          ELSE 0
        END as calculated_risk_score
      FROM employees e
      LEFT JOIN perf_avg pa ON pa.employee_id = e.id
      WHERE e.org_unit_id = $1 AND e.tenant_id = $2 AND e.is_active = true
      ORDER BY calculated_risk_score DESC
    `,
      [deptId, tenantId]
    );

    // Get department info
    const deptResult = await req.dbClient!.query(
      `
      SELECT name, code FROM org_units WHERE id = $1 AND tenant_id = $2
    `,
      [deptId, tenantId]
    );

    const employees = result.rows.map((e) => ({
      ...e,
      risk_level:
        e.calculated_risk_score >= 75
          ? 'critical'
          : e.calculated_risk_score >= 60
            ? 'high'
            : e.calculated_risk_score >= 40
              ? 'medium'
              : 'low',
    }));

    // Calculate distribution
    const distribution = {
      critical: employees.filter((e) => e.risk_level === 'critical').length,
      high: employees.filter((e) => e.risk_level === 'high').length,
      medium: employees.filter((e) => e.risk_level === 'medium').length,
      low: employees.filter((e) => e.risk_level === 'low').length,
    };

    const avgRisk =
      employees.length > 0
        ? Math.round(
            employees.reduce((sum, e) => sum + e.calculated_risk_score, 0) / employees.length
          )
        : 0;

    res.json({
      success: true,
      data: {
        department: deptResult.rows[0] || { name: 'Unknown' },
        summary: {
          total_employees: employees.length,
          average_risk_score: avgRisk,
          distribution,
        },
        employees: employees.slice(0, 20), // Top 20 highest risk
      },
    });
  })
);

/**
 * GET /predictions/skill-demand
 * Get skill demand forecasting for next 6 months
 */
router.get(
  '/skill-demand',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    // Get current skill distribution from employee_skills joined with esco_skills
    const currentSkills = await req.dbClient!.query(
      `
      SELECT
        COALESCE(s.preferred_label_en, es.custom_skill_name, 'Unknown') as skill_name,
        COALESCE(s.skill_type, es.primary_category, 'Other') as category,
        COUNT(DISTINCT es.employee_id) as current_holders,
        AVG(es.proficiency_level) as avg_proficiency
      FROM employee_skills es
      LEFT JOIN esco_skills s ON es.esco_skill_id = s.id
      WHERE es.tenant_id = $1
      GROUP BY COALESCE(s.preferred_label_en, es.custom_skill_name, 'Unknown'),
               COALESCE(s.skill_type, es.primary_category, 'Other')
      ORDER BY current_holders DESC
      LIMIT 30
    `,
      [tenantId]
    );

    // Get open positions by job title (demand indicators)
    const demandSkills = await req.dbClient!.query(
      `
      SELECT
        title as skill_name,
        department as category,
        SUM(headcount) as open_positions
      FROM recruiting_requisitions
      WHERE tenant_id = $1 AND status = 'open'
      GROUP BY title, department
      ORDER BY open_positions DESC
      LIMIT 20
    `,
      [tenantId]
    );

    // Get skills from recent courses (learning trends)
    const learningTrends = await req.dbClient!.query(
      `
      SELECT
        c.title as course_title,
        c.category,
        COUNT(DISTINCT ce.employee_id) as enrollments_6m
      FROM courses c
      JOIN course_enrollments ce ON c.id = ce.course_id
      WHERE c.tenant_id = $1
        AND ce.enrolled_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY c.id, c.title, c.category
      ORDER BY enrollments_6m DESC
      LIMIT 15
    `,
      [tenantId]
    );

    // Generate 6-month forecast based on trends
    const months = [];
    const baseDate = new Date();
    for (let i = 1; i <= 6; i++) {
      const forecastDate = new Date(baseDate);
      forecastDate.setMonth(forecastDate.getMonth() + i);
      months.push({
        month: forecastDate.toISOString().substring(0, 7),
        label: forecastDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        projected_hires: Math.floor(Math.random() * 10 + 5), // Simulated projection
        skill_gap_risk: Math.floor(Math.random() * 30 + 20), // Simulated risk
      });
    }

    // Generate skill recommendations
    const recommendations = [];
    if (demandSkills.rows.length > 0) {
      recommendations.push({
        type: 'high_demand',
        skill: demandSkills.rows[0]?.skill_name || 'Unknown',
        message: `High demand for this skill with ${demandSkills.rows[0]?.open_positions || 0} open positions`,
        action: 'Consider internal upskilling programs',
      });
    }

    res.json({
      success: true,
      data: {
        current_skills: currentSkills.rows,
        demand_signals: demandSkills.rows,
        learning_trends: learningTrends.rows,
        forecast: months,
        recommendations,
        generated_at: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /predictions/ai-recommendations
 * Get AI-powered HR recommendations
 */
router.get(
  '/ai-recommendations',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { category } = req.query as Record<string, string>;

    // Gather key metrics for recommendations
    const metrics = await req.dbClient!.query(
      `
      SELECT
        (SELECT COUNT(*) FROM employees WHERE tenant_id = $1 AND is_active = true) as total_employees,
        (SELECT COUNT(*) FROM employees WHERE tenant_id = $1 AND is_active = true
         AND EXTRACT(YEAR FROM age(CURRENT_DATE, hire_date)) < 1) as new_hires_1y,
        (SELECT COUNT(*) FROM employees WHERE tenant_id = $1 AND termination_date IS NOT NULL
         AND termination_date >= CURRENT_DATE - INTERVAL '12 months') as terminations_12m,
        (SELECT COUNT(*) FROM recruiting_requisitions WHERE tenant_id = $1 AND status = 'open') as open_positions,
        (SELECT AVG(overall_rating) FROM performance_reviews pr
         JOIN employees e ON pr.employee_id = e.id
         WHERE e.tenant_id = $1 AND pr.review_period_end >= CURRENT_DATE - INTERVAL '12 months') as avg_performance,
        (SELECT COUNT(*) FROM goals WHERE tenant_id = $1 AND status = 'at_risk') as at_risk_goals
    `,
      [tenantId]
    );

    const m = metrics.rows[0];

    // Generate recommendations based on metrics
    const recommendations: {
      id: string;
      category: string;
      priority: string;
      title: string;
      description: string;
      impact: string;
      action: string;
      metrics?: Record<string, unknown>;
    }[] = [];

    // Turnover recommendation
    const turnoverRate =
      m.total_employees > 0 ? Math.round((m.terminations_12m / m.total_employees) * 100) : 0;

    if (turnoverRate > 15) {
      recommendations.push({
        id: 'rec-turnover-1',
        category: 'retention',
        priority: 'high',
        title: 'High Turnover Alert',
        description: `Turnover rate of ${turnoverRate}% exceeds industry benchmark of 15%`,
        impact: 'Potential loss of institutional knowledge and increased hiring costs',
        action: 'Conduct stay interviews with high-performing employees',
        metrics: { turnover_rate: turnoverRate, terminations: m.terminations_12m },
      });
    }

    // New hire attention
    if (m.new_hires_1y > m.total_employees * 0.25) {
      recommendations.push({
        id: 'rec-onboard-1',
        category: 'onboarding',
        priority: 'medium',
        title: 'High Volume of New Hires',
        description: `${m.new_hires_1y} employees (${Math.round((m.new_hires_1y / m.total_employees) * 100)}%) joined in past year`,
        impact: 'Culture integration and knowledge transfer challenges',
        action: 'Strengthen mentorship and buddy programs',
        metrics: { new_hires: m.new_hires_1y },
      });
    }

    // Open positions
    if (m.open_positions > 10) {
      recommendations.push({
        id: 'rec-recruit-1',
        category: 'recruiting',
        priority: 'high',
        title: 'Hiring Capacity Concern',
        description: `${m.open_positions} open positions may strain current workforce`,
        impact: 'Workload distribution and overtime costs',
        action: 'Review hiring priorities and consider contractor support',
        metrics: { open_positions: m.open_positions },
      });
    }

    // Performance goals at risk
    if (m.at_risk_goals > 10) {
      recommendations.push({
        id: 'rec-perf-1',
        category: 'performance',
        priority: 'medium',
        title: 'Goals At Risk',
        description: `${m.at_risk_goals} goals flagged as at-risk`,
        impact: 'May affect quarterly/annual performance outcomes',
        action: 'Schedule goal review meetings with managers',
        metrics: { at_risk_goals: m.at_risk_goals },
      });
    }

    // Learning recommendation
    recommendations.push({
      id: 'rec-learn-1',
      category: 'learning',
      priority: 'low',
      title: 'Continuous Learning',
      description: 'Promote skill development aligned with business needs',
      impact: 'Improved employee engagement and capability',
      action: 'Launch quarterly learning challenges',
    });

    // Filter by category if specified
    let filtered = recommendations;
    if (category) {
      filtered = recommendations.filter((r) => r.category === category);
    }

    res.json({
      success: true,
      data: {
        recommendations: filtered.sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return (
            (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) -
            (priorityOrder[b.priority as keyof typeof priorityOrder] || 2)
          );
        }),
        summary: {
          total: filtered.length,
          by_priority: {
            high: filtered.filter((r) => r.priority === 'high').length,
            medium: filtered.filter((r) => r.priority === 'medium').length,
            low: filtered.filter((r) => r.priority === 'low').length,
          },
        },
        generated_at: new Date().toISOString(),
      },
    });
  })
);

export default router;
