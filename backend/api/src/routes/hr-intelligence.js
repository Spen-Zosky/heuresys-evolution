/**
 * HR Intelligence Routes
 * Epic 8: HR Intelligence
 * Stories: 8.1-8.5
 */
import { Router } from 'express';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { authMiddleware } from '../middleware/auth.js';
import { checkPermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '@heuresys/shared';
import { HRIntelligenceService } from '../services/hr-intelligence.js';
import { validate } from '../middleware/validate.js';
import { hrIntelligenceAddSkillSchema, hrIntelligenceUpdateSkillSchema, hrIntelligenceExtractSkillsSchema, hrIntelligenceCreateAliasSchema, hrIntelligenceGapAnalysisSchema, hrIntelligenceSkillMatrixSchema, hrIntelligenceBenchmarkReportSchema, } from '../schemas/skills-assessment.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// =============================================================================
// ROOT DASHBOARD
// =============================================================================
/**
 * GET /hr-intelligence
 * Dashboard overview with ESCO stats and recent activity
 */
router.get('/', authMiddleware, requireTenant, asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient;
    const statsResult = await dbClient.query(`SELECT
        (SELECT COUNT(*) FROM esco_skills) as total_skills,
        (SELECT COUNT(*) FROM esco_occupations) as total_occupations,
        (SELECT COUNT(*) FROM employee_skills WHERE tenant_id = $1) as mapped_skills,
        (SELECT COUNT(DISTINCT employee_id) FROM employee_skills WHERE tenant_id = $1) as employees_with_skills`, [tenantId]);
    const stats = statsResult.rows[0] || {};
    res.json({
        success: true,
        data: {
            overview: {
                total_skills: safeParseInt(stats.total_skills, { fallback: 0 }),
                total_occupations: safeParseInt(stats.total_occupations, { fallback: 0 }),
                mapped_skills: safeParseInt(stats.mapped_skills, { fallback: 0 }),
                employees_with_skills: safeParseInt(stats.employees_with_skills, { fallback: 0 }),
            },
            capabilities: [
                'skills/search',
                'occupations/search',
                'employee-skills',
                'gap-analysis',
                'skill-matrix',
                'benchmarks',
            ],
        },
    });
}));
// =============================================================================
// STORY 8.1: ESCO SKILL TAXONOMY INTEGRATION
// =============================================================================
/**
 * GET /hr-intelligence/skills/search
 * Search ESCO skills (public - no auth required for taxonomy)
 */
router.get('/skills/search', asyncHandler(async (req, res) => {
    const service = new HRIntelligenceService('system');
    const { q, skillType, limit, offset } = req.query;
    const result = await service.searchSkills(q || '', {
        skillType: skillType,
        limit: limit ? safeParseInt(limit, { fallback: 50 }) : 20,
        offset: offset ? safeParseInt(offset, { fallback: 0 }) : 0,
    });
    res.json({
        success: true,
        data: result,
    });
}));
/**
 * GET /hr-intelligence/skills/:id
 * Get ESCO skill by ID or URI
 */
router.get('/skills/:id', asyncHandler(async (req, res) => {
    const service = new HRIntelligenceService('system');
    const skill = await service.getSkill(req.params.id);
    if (!skill) {
        throw Errors.notFound('Skill');
    }
    res.json({
        success: true,
        data: { skill },
    });
}));
/**
 * GET /hr-intelligence/skills/:uri/hierarchy
 * Get skill hierarchy (broader, narrower, related)
 */
router.get('/skills/:uri/hierarchy', asyncHandler(async (req, res) => {
    const service = new HRIntelligenceService('system');
    const hierarchy = await service.getSkillHierarchy(decodeURIComponent(req.params.uri));
    res.json({
        success: true,
        data: hierarchy,
    });
}));
/**
 * GET /hr-intelligence/occupations/search
 * Search ESCO occupations
 */
router.get('/occupations/search', asyncHandler(async (req, res) => {
    const service = new HRIntelligenceService('system');
    const { q, limit, offset } = req.query;
    const result = await service.searchOccupations(q || '', {
        limit: limit ? safeParseInt(limit, { fallback: 50 }) : 20,
        offset: offset ? safeParseInt(offset, { fallback: 0 }) : 0,
    });
    res.json({
        success: true,
        data: result,
    });
}));
/**
 * GET /hr-intelligence/occupations/:uri/skills
 * Get skills required for an occupation
 */
router.get('/occupations/:uri/skills', asyncHandler(async (req, res) => {
    const service = new HRIntelligenceService('system');
    const result = await service.getOccupationSkills(decodeURIComponent(req.params.uri));
    res.json({
        success: true,
        data: result,
    });
}));
// =============================================================================
// EMPLOYEE SKILLS MANAGEMENT (requires auth)
// =============================================================================
/**
 * POST /hr-intelligence/employees/:employeeId/skills
 * Add skill to employee
 */
router.post('/employees/:employeeId/skills', authMiddleware, requireTenant, validate(hrIntelligenceAddSkillSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new HRIntelligenceService(tenantId);
    const { employeeId } = req.params;
    const skillId = await service.addEmployeeSkill(employeeId, req.body);
    res.status(201).json({
        success: true,
        data: { id: skillId },
        message: 'Employee skill added successfully',
    });
}));
/**
 * GET /hr-intelligence/employees/:employeeId/skills
 * Get employee skills
 */
router.get('/employees/:employeeId/skills', authMiddleware, requireTenant, asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new HRIntelligenceService(tenantId);
    const { employeeId } = req.params;
    const includeESCODetails = req.query.includeESCODetails === 'true';
    const skills = await service.getEmployeeSkills(employeeId, { includeESCODetails });
    res.json({
        success: true,
        data: { skills },
    });
}));
/**
 * PATCH /hr-intelligence/employees/:employeeId/skills/:skillId
 * Update employee skill
 */
router.patch('/employees/:employeeId/skills/:skillId', authMiddleware, requireTenant, validate(hrIntelligenceUpdateSkillSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new HRIntelligenceService(tenantId);
    const { skillId } = req.params;
    await service.updateEmployeeSkill(skillId, req.body);
    res.json({
        success: true,
        message: 'Employee skill updated successfully',
    });
}));
/**
 * POST /hr-intelligence/employees/:employeeId/skills/:skillId/verify
 * Verify employee skill
 */
router.post('/employees/:employeeId/skills/:skillId/verify', authMiddleware, requireTenant, checkPermission(PERMISSIONS.USERS_MANAGE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new HRIntelligenceService(tenantId);
    const authReq = req;
    const { skillId } = req.params;
    await service.verifyEmployeeSkill(skillId, authReq.user?.userId ?? 'system');
    res.json({
        success: true,
        message: 'Employee skill verified successfully',
    });
}));
/**
 * DELETE /hr-intelligence/employees/:employeeId/skills/:skillId
 * Delete employee skill
 */
router.delete('/employees/:employeeId/skills/:skillId', authMiddleware, requireTenant, asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new HRIntelligenceService(tenantId);
    const { skillId } = req.params;
    await service.deleteEmployeeSkill(skillId);
    res.json({
        success: true,
        message: 'Employee skill deleted successfully',
    });
}));
// =============================================================================
// STORY 8.2: JOB MARKET DATA
// =============================================================================
/**
 * GET /hr-intelligence/job-market/sources
 * List job market data sources
 */
router.get('/job-market/sources', authMiddleware, requireTenant, asyncHandler(async (_req, res) => {
    const service = new HRIntelligenceService('system');
    const sources = await service.getJobMarketSources();
    res.json({
        success: true,
        data: { sources },
    });
}));
/**
 * GET /hr-intelligence/job-market/postings
 * Search job market postings
 */
router.get('/job-market/postings', authMiddleware, requireTenant, asyncHandler(async (req, res) => {
    const service = new HRIntelligenceService('system');
    const { q, skills, location, countryCode, industry, experienceLevel, salaryMin, salaryMax, employmentType, locationType, limit, offset, } = req.query;
    const searchOptions = {
        limit: limit ? safeParseInt(limit, { fallback: 50 }) : 20,
        offset: offset ? safeParseInt(offset, { fallback: 0 }) : 0,
    };
    if (q)
        searchOptions.query = q;
    if (skills)
        searchOptions.skills = skills.split(',');
    if (location)
        searchOptions.location = location;
    if (countryCode)
        searchOptions.countryCode = countryCode;
    if (industry)
        searchOptions.industry = industry;
    if (experienceLevel)
        searchOptions.experienceLevel = experienceLevel;
    if (salaryMin)
        searchOptions.salaryMin = parseInt(salaryMin);
    if (salaryMax)
        searchOptions.salaryMax = parseInt(salaryMax);
    if (employmentType)
        searchOptions.employmentType = employmentType;
    if (locationType)
        searchOptions.locationType = locationType;
    const result = await service.searchJobPostings(searchOptions);
    res.json({
        success: true,
        data: result,
    });
}));
/**
 * GET /hr-intelligence/job-market/statistics
 * Get job market statistics
 */
router.get('/job-market/statistics', authMiddleware, requireTenant, asyncHandler(async (req, res) => {
    const service = new HRIntelligenceService('system');
    const { countryCode, industry, period, days } = req.query;
    const statistics = await service.getJobMarketStatistics({
        countryCode: countryCode,
        industry: industry,
        period: period,
        days: days ? parseInt(days) : 30,
    });
    res.json({
        success: true,
        data: { statistics },
    });
}));
/**
 * GET /hr-intelligence/job-market/trending-skills
 * Get trending skills from job market
 */
router.get('/job-market/trending-skills', authMiddleware, requireTenant, asyncHandler(async (req, res) => {
    const service = new HRIntelligenceService('system');
    const { countryCode, industry, days, limit } = req.query;
    const trendingSkills = await service.getTrendingSkills({
        countryCode: countryCode,
        industry: industry,
        days: days ? parseInt(days) : 30,
        limit: limit ? safeParseInt(limit, { fallback: 50 }) : 20,
    });
    res.json({
        success: true,
        data: { trendingSkills },
    });
}));
// =============================================================================
// STORY 8.3: SKILL EXTRACTION & NORMALIZATION
// =============================================================================
/**
 * POST /hr-intelligence/skills/extract
 * Extract skills from text
 */
router.post('/skills/extract', authMiddleware, requireTenant, validate(hrIntelligenceExtractSkillsSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new HRIntelligenceService(tenantId);
    const { text, source, jobType } = req.body;
    if (!text) {
        throw Errors.badRequest('Text is required for skill extraction');
    }
    const result = await service.extractSkills(text, { source, jobType });
    res.json({
        success: true,
        data: result,
    });
}));
/**
 * POST /hr-intelligence/skills/aliases
 * Add skill alias
 */
router.post('/skills/aliases', authMiddleware, requireTenant, checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(hrIntelligenceCreateAliasSchema), asyncHandler(async (req, res) => {
    const service = new HRIntelligenceService('system');
    const { escoSkillId, aliasText, aliasType } = req.body;
    if (!escoSkillId || !aliasText) {
        throw Errors.badRequest('escoSkillId and aliasText are required');
    }
    const aliasId = await service.addSkillAlias(escoSkillId, aliasText, aliasType);
    res.status(201).json({
        success: true,
        data: { id: aliasId },
        message: 'Skill alias added successfully',
    });
}));
// =============================================================================
// STORY 8.4: SKILL GAP ANALYSIS
// =============================================================================
/**
 * POST /hr-intelligence/skill-gap-analyses
 * Create skill gap analysis for an employee
 */
router.post('/skill-gap-analyses', authMiddleware, requireTenant, validate(hrIntelligenceGapAnalysisSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new HRIntelligenceService(tenantId);
    const { employeeId, targetPositionId, analysisName } = req.body;
    if (!employeeId || !targetPositionId || !analysisName) {
        throw Errors.badRequest('employeeId, targetPositionId, and analysisName are required');
    }
    const analysis = await service.createSkillGapAnalysis(employeeId, targetPositionId, analysisName);
    res.status(201).json({
        success: true,
        data: { analysis },
        message: 'Skill gap analysis created successfully',
    });
}));
/**
 * GET /hr-intelligence/skill-gap-analyses
 * List skill gap analyses
 */
router.get('/skill-gap-analyses', authMiddleware, requireTenant, asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new HRIntelligenceService(tenantId);
    const { entityType, entityId, limit, offset } = req.query;
    const result = await service.listSkillGapAnalyses({
        entityType: entityType,
        entityId: entityId,
        limit: limit ? safeParseInt(limit, { fallback: 50 }) : 20,
        offset: offset ? safeParseInt(offset, { fallback: 0 }) : 0,
    });
    res.json({
        success: true,
        data: result,
    });
}));
/**
 * GET /hr-intelligence/skill-gap-analyses/:id
 * Get skill gap analysis by ID
 */
router.get('/skill-gap-analyses/:id', authMiddleware, requireTenant, asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new HRIntelligenceService(tenantId);
    const analysis = await service.getSkillGapAnalysis(req.params.id);
    if (!analysis) {
        throw Errors.notFound('Skill gap analysis');
    }
    res.json({
        success: true,
        data: { analysis },
    });
}));
/**
 * GET /hr-intelligence/skill-matrices
 * List generated skill matrices
 */
router.get('/skill-matrices', authMiddleware, requireTenant, asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { entityType, limit = '20', offset = '0' } = req.query;
    let query = `
      SELECT sm.id, sm.entity_type, sm.entity_id, sm.matrix_name,
             sm.status, sm.created_at, sm.updated_at,
             CASE
               WHEN sm.entity_type = 'department' THEN d.name
               ELSE sm.entity_id::text
             END AS entity_name
      FROM skill_matrices sm
      LEFT JOIN org_units d ON sm.entity_type = 'department' AND sm.entity_id = d.id
      WHERE sm.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (entityType) {
        query += ` AND sm.entity_type = $${paramIndex++}`;
        params.push(entityType);
    }
    query += ` ORDER BY sm.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        meta: { count: result.rows.length },
    });
}));
/**
 * POST /hr-intelligence/skill-matrices
 * Generate skill matrix for team/department
 */
router.post('/skill-matrices', authMiddleware, requireTenant, validate(hrIntelligenceSkillMatrixSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new HRIntelligenceService(tenantId);
    const { entityType, entityId, matrixName } = req.body;
    if (!entityType || !entityId || !matrixName) {
        throw Errors.badRequest('entityType, entityId, and matrixName are required');
    }
    if (!['team', 'department'].includes(entityType)) {
        throw Errors.badRequest('entityType must be "team" or "department"');
    }
    const matrixId = await service.generateSkillMatrix(entityType, entityId, matrixName);
    res.status(201).json({
        success: true,
        data: { id: matrixId },
        message: 'Skill matrix generated successfully',
    });
}));
// =============================================================================
// STORY 8.5: MARKET BENCHMARK DASHBOARD
// =============================================================================
/**
 * GET /hr-intelligence/benchmarks/configs
 * Get benchmark configurations
 */
router.get('/benchmarks/configs', authMiddleware, requireTenant, asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new HRIntelligenceService(tenantId);
    const configs = await service.getBenchmarkConfigs();
    res.json({
        success: true,
        data: { configs },
    });
}));
/**
 * POST /hr-intelligence/benchmarks/reports
 * Create benchmark report
 */
router.post('/benchmarks/reports', authMiddleware, requireTenant, validate(hrIntelligenceBenchmarkReportSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new HRIntelligenceService(tenantId);
    const { configId, reportName, reportType } = req.body;
    if (!reportName || !reportType) {
        throw Errors.badRequest('reportName and reportType are required');
    }
    if (!['salary_benchmark', 'skill_demand', 'talent_availability'].includes(reportType)) {
        throw Errors.badRequest('reportType must be "salary_benchmark", "skill_demand", or "talent_availability"');
    }
    const reportId = await service.createBenchmarkReport(configId || null, reportName, reportType);
    res.status(201).json({
        success: true,
        data: { id: reportId },
        message: 'Benchmark report created successfully',
    });
}));
/**
 * GET /hr-intelligence/benchmarks/reports
 * List benchmark reports
 */
router.get('/benchmarks/reports', authMiddleware, requireTenant, asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new HRIntelligenceService(tenantId);
    const { reportType, limit, offset } = req.query;
    const result = await service.listBenchmarkReports({
        reportType: reportType,
        limit: limit ? safeParseInt(limit, { fallback: 50 }) : 20,
        offset: offset ? safeParseInt(offset, { fallback: 0 }) : 0,
    });
    res.json({
        success: true,
        data: result,
    });
}));
/**
 * GET /hr-intelligence/benchmarks/reports/:id
 * Get benchmark report by ID
 */
router.get('/benchmarks/reports/:id', authMiddleware, requireTenant, asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new HRIntelligenceService(tenantId);
    const report = await service.getBenchmarkReport(req.params.id);
    if (!report) {
        throw Errors.notFound('Benchmark report');
    }
    res.json({
        success: true,
        data: { report },
    });
}));
export default router;
//# sourceMappingURL=hr-intelligence.js.map