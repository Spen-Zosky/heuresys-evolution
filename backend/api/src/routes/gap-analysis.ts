/**
 * Gap Analysis API Routes
 * Epic: E-ONTO-03 (Business Applications)
 * Stories: S-ONTO-03-05 (Gap Analysis Engine), S-ONTO-03-06 (Gap Analysis Recommendations)
 *
 * Endpoints:
 * - POST /gap-analysis - Run gap analysis
 * - POST /gap-analysis/employee-role - Analyze employee vs role
 * - POST /gap-analysis/team-role - Analyze team vs role
 * - POST /gap-analysis/recommendations - Generate recommendations for a gap analysis
 * - GET /gap-analysis/cached/:analysisId - Get cached analysis (future)
 */

import { Router, Request, Response } from 'express';
import { gapAnalysisService } from '../services/gap-analysis/index.js';
import { gapRecommendationsService } from '../services/gap-analysis/gap-recommendations.service.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { validate } from '../middleware/validate.js';
import {
  gapAnalysisSchema,
  employeeRoleGapSchema,
  teamRoleGapSchema,
  compareGapSchema,
  gapRecommendationsSchema,
  cachedRecommendationsSchema,
  createDevelopmentActionSchema,
} from '../schemas/talent.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

// =============================================================================
// POST /gap-analysis
// Universal gap analysis endpoint
// =============================================================================

router.post(
  '/',
  validate(gapAnalysisSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      analysisType,
      employeeId,
      employeeIds,
      roleId,
      // projectId,  // Reserved for future team_project analysis
      tenantId,
      aggregation = 'average',
    } = req.body;

    if (!analysisType) {
      throw Errors.badRequest('analysisType is required (employee_role, team_role, team_project)');
    }

    let result;

    switch (analysisType) {
      case 'employee_role':
        if (!employeeId || !roleId) {
          throw Errors.badRequest('employeeId and roleId are required for employee_role analysis');
        }
        result = await gapAnalysisService.analyzeEmployeeVsRole(employeeId, roleId, tenantId);
        break;

      case 'team_role':
        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
          throw Errors.badRequest('employeeIds array is required for team_role analysis');
        }
        if (!roleId) {
          throw Errors.badRequest('roleId is required for team_role analysis');
        }
        result = await gapAnalysisService.analyzeTeamVsRole(
          employeeIds,
          roleId,
          aggregation,
          tenantId
        );
        break;

      case 'team_project':
        res.status(501).json({
          success: false,
          error: 'team_project analysis not yet implemented',
        });
        return;

      default:
        throw Errors.badRequest(`Unknown analysisType: ${analysisType}`);
    }

    res.json({
      success: true,
      data: result,
    });
  })
);

// =============================================================================
// POST /gap-analysis/employee-role
// Analyze single employee against a role
// =============================================================================

router.post(
  '/employee-role',
  validate(employeeRoleGapSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { employeeId, roleId, tenantId } = req.body;

    if (!employeeId) {
      throw Errors.badRequest('employeeId is required');
    }

    if (!roleId) {
      throw Errors.badRequest('roleId is required');
    }

    const result = await gapAnalysisService.analyzeEmployeeVsRole(employeeId, roleId, tenantId);

    res.json({
      success: true,
      data: result,
    });
  })
);

// =============================================================================
// POST /gap-analysis/team-role
// Analyze team against a role
// =============================================================================

router.post(
  '/team-role',
  validate(teamRoleGapSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { employeeIds, roleId, aggregation = 'average', tenantId } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      throw Errors.badRequest('employeeIds array is required with at least one employee');
    }

    if (!roleId) {
      throw Errors.badRequest('roleId is required');
    }

    if (!['average', 'best', 'coverage'].includes(aggregation)) {
      throw Errors.badRequest('aggregation must be one of: average, best, coverage');
    }

    const result = await gapAnalysisService.analyzeTeamVsRole(
      employeeIds,
      roleId,
      aggregation as 'average' | 'best' | 'coverage',
      tenantId
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// =============================================================================
// GET /gap-analysis/summary/:employeeId
// Quick gap summary for an employee across all applicable roles
// =============================================================================

router.get(
  '/summary/:employeeId',
  asyncHandler(async (req: Request, res: Response) => {
    const employeeId = req.params.employeeId as string;
    const { roleIds, limit = '5' } = req.query as Record<string, string>;

    // Get employee's current role if not specified
    let targetRoleIds: string[] = [];

    if (roleIds) {
      targetRoleIds = (roleIds as string).split(',');
    } else {
      // TODO: Get employee's current job template + related roles
      throw Errors.badRequest('roleIds query parameter required (comma-separated list)');
    }

    // Run analyses in parallel
    const analyses = await Promise.all(
      targetRoleIds
        .slice(0, safeParseInt(limit as string, { fallback: 50 }))
        .map(async (roleId) => {
          try {
            const result = await gapAnalysisService.analyzeEmployeeVsRole(employeeId, roleId);
            return {
              roleId,
              roleName: result.requirementName,
              fitScore: result.overallFitScore,
              gapScore: result.overallGapScore,
              gapCount: result.gapCount,
              criticalGaps: result.severityDistribution.critical,
              highGaps: result.severityDistribution.high,
            };
          } catch (err) {
            return {
              roleId,
              error: (err as Error).message,
            };
          }
        })
    );

    // Sort by fit score
    const validAnalyses = analyses.filter((a) => !('error' in a));
    validAnalyses.sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));

    res.json({
      success: true,
      data: {
        employeeId,
        analyses: validAnalyses,
        errors: analyses.filter((a) => 'error' in a),
      },
    });
  })
);

// =============================================================================
// POST /gap-analysis/compare
// Compare multiple employees for a role
// =============================================================================

router.post(
  '/compare',
  validate(compareGapSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { employeeIds, roleId, tenantId } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length < 2) {
      throw Errors.badRequest('employeeIds array with at least 2 employees is required');
    }

    if (!roleId) {
      throw Errors.badRequest('roleId is required');
    }

    // Run individual analyses
    const analyses = await Promise.all(
      employeeIds.map(async (empId) => {
        try {
          return await gapAnalysisService.analyzeEmployeeVsRole(empId, roleId, tenantId);
        } catch (err) {
          return { error: (err as Error).message, employeeId: empId };
        }
      })
    );

    // Filter valid results and sort by fit score
    const validResults = analyses.filter((a) => !('error' in a)) as Awaited<
      ReturnType<typeof gapAnalysisService.analyzeEmployeeVsRole>
    >[];
    validResults.sort((a, b) => b.overallFitScore - a.overallFitScore);

    const firstValid = validResults[0];
    res.json({
      success: true,
      data: {
        roleId,
        roleName: firstValid ? firstValid.requirementName : 'Unknown',
        ranking: validResults.map((r, idx) => ({
          rank: idx + 1,
          employeeId: r.targetId,
          employeeName: r.targetName,
          fitScore: r.overallFitScore,
          gapScore: r.overallGapScore,
          gapCount: r.gapCount,
          criticalGaps: r.severityDistribution.critical,
          skillsExceeding: r.skillsExceeding,
        })),
        detailedResults: validResults,
        errors: analyses.filter((a) => 'error' in a),
      },
    });
  })
);

// =============================================================================
// POST /gap-analysis/recommendations
// Generate recommendations for closing skill gaps
// =============================================================================

router.post(
  '/recommendations',
  validate(gapRecommendationsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { employeeId, roleId, tenantId, options = {} } = req.body;

    if (!employeeId || !roleId) {
      throw Errors.badRequest('employeeId and roleId are required');
    }

    // First run the gap analysis
    const gapAnalysis = await gapAnalysisService.analyzeEmployeeVsRole(
      employeeId,
      roleId,
      tenantId
    );

    // Then generate recommendations
    const recommendations = await gapRecommendationsService.generateRecommendations(gapAnalysis, {
      maxPerSkill: options.maxPerSkill || 5,
      includeTypes: options.includeTypes || [
        'training',
        'mentoring',
        'self_study',
        'certification',
      ],
      minSeverity: options.minSeverity || 'low',
    });

    res.json({
      success: true,
      data: {
        gapAnalysis: {
          analysisId: gapAnalysis.analysisId,
          targetName: gapAnalysis.targetName,
          requirementName: gapAnalysis.requirementName,
          overallFitScore: gapAnalysis.overallFitScore,
          overallGapScore: gapAnalysis.overallGapScore,
          gapCount: gapAnalysis.gapCount,
          severityDistribution: gapAnalysis.severityDistribution,
        },
        recommendations,
      },
    });
  })
);

// =============================================================================
// POST /gap-analysis/:analysisId/recommendations
// Generate recommendations from existing gap analysis (if cached)
// For now, just re-runs the analysis
// =============================================================================

router.post(
  '/:analysisId/recommendations',
  validate(cachedRecommendationsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { employeeId, roleId, tenantId, options = {} } = req.body;

    if (!employeeId || !roleId) {
      throw Errors.badRequest('employeeId and roleId are required to regenerate analysis');
    }

    // Re-run the gap analysis (future: fetch from cache by analysisId)
    const gapAnalysis = await gapAnalysisService.analyzeEmployeeVsRole(
      employeeId,
      roleId,
      tenantId
    );

    // Generate recommendations
    const recommendations = await gapRecommendationsService.generateRecommendations(gapAnalysis, {
      maxPerSkill: options.maxPerSkill,
      includeTypes: options.includeTypes,
      minSeverity: options.minSeverity,
    });

    res.json({
      success: true,
      data: recommendations,
    });
  })
);

// =============================================================================
// GET /gap-analysis/development-plan/:employeeId
// Generate a complete development plan for an employee
// =============================================================================

router.get(
  '/development-plan/:employeeId',
  asyncHandler(async (req: Request, res: Response) => {
    const employeeId = req.params.employeeId as string;
    const { roleId } = req.query as Record<string, string>;
    // const { includeCurrentRole = 'true' } = req.query as Record<string, string>; // Reserved for future multi-role plans

    if (!roleId) {
      throw Errors.badRequest('roleId query parameter is required');
    }

    // Run analysis
    const gapAnalysis = await gapAnalysisService.analyzeEmployeeVsRole(
      employeeId,
      roleId as string
    );

    // Generate comprehensive recommendations
    const recommendations = await gapRecommendationsService.generateRecommendations(gapAnalysis, {
      maxPerSkill: 3,
      includeTypes: ['training', 'mentoring', 'self_study', 'certification'],
      minSeverity: 'low',
    });

    // Build development plan summary
    const plan = {
      employee: {
        id: employeeId,
        name: gapAnalysis.targetName,
      },
      targetRole: {
        id: roleId,
        name: gapAnalysis.requirementName,
      },
      currentFitScore: gapAnalysis.overallFitScore,
      gapScore: gapAnalysis.overallGapScore,
      totalSkillGaps: gapAnalysis.gapCount,
      criticalGaps: gapAnalysis.severityDistribution.critical,
      highGaps: gapAnalysis.severityDistribution.high,

      // Time investment required
      estimatedTotalHours: recommendations.totalEstimatedHours,
      estimatedWeeks: Math.ceil(recommendations.totalEstimatedHours / 10), // 10 hours/week development

      // Priority actions
      immediateActions: recommendations.topRecommendations
        .filter((r) => r.priority === 'critical' || r.priority === 'high')
        .slice(0, 5)
        .map((r) => ({
          type: r.type,
          title: r.title,
          skillName: r.skillName,
          estimatedHours: r.estimatedHours,
          expectedImpact: r.expectedGapReduction,
          resourceName: r.resourceName,
        })),

      // Full recommendation breakdown
      recommendationsByPriority: recommendations.byPriority,
      recommendationsByType: recommendations.byType,

      // Skill-by-skill plan
      skillDevelopmentPlan: recommendations.skillRecommendations.map((sr) => ({
        skill: sr.skillName,
        currentGap: sr.gapScore,
        severity: sr.gapSeverity,
        actions: sr.recommendations.map((r) => ({
          type: r.type,
          title: r.title,
          hours: r.estimatedHours,
          expectedGain: r.expectedLevelGain,
        })),
      })),
    };

    res.json({
      success: true,
      data: plan,
    });
  })
);

// =============================================================================
// POST /gap-analysis/:employeeId/development-actions
// Save a development action assignment for an employee
// =============================================================================

router.post(
  '/:employeeId/development-actions',
  validate(createDevelopmentActionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { employeeId } = req.params as Record<string, string>;
    const {
      recommendationId,
      title,
      type,
      priority,
      skillCoverage,
      deadline,
      status,
      notes,
      estimatedImpact,
      duration,
    } = req.body;

    if (!title || !type) {
      throw Errors.badRequest('Title and type are required');
    }

    // For now, store in skill_development_paths with recommended_actions as JSON
    const dbClient = req.dbClient!;

    const result = await dbClient.query(
      `
    INSERT INTO skill_development_paths (
      employee_id,
      missing_skills,
      recommended_actions,
      progress_percent,
      is_active,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, 0, true, NOW(), NOW())
    RETURNING *
  `,
      [
        employeeId,
        skillCoverage || [],
        JSON.stringify({
          id: recommendationId,
          title,
          type,
          priority,
          deadline,
          status,
          notes,
          estimatedImpact,
          duration,
          assignedAt: new Date().toISOString(),
        }),
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0] || null,
      message: 'Development action assigned successfully',
    });
  })
);

export default router;
