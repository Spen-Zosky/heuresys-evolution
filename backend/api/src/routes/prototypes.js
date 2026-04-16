/**
 * Prototypes Routes
 * API endpoints for industry prototypes, business processes, and prototype generation
 * Part of Tenant Prototype Generator System
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { BusinessProcessResearchService } from '../services/business-process-research.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { PrototypeGeneratorService } from '../services/prototype-generator.js';
import { StaffingRulesGeneratorService } from '../services/staffing-rules-generator.js';
import { JobSkillsEnrichmentService } from '../services/job-skills-enrichment.js';
import { validate } from '../middleware/validate.js';
import { prototypeResearchSchema, createProcessSchema, createStaffingRulesSchema, calculateStaffingSchema, generatePrototypeSchema, previewPrototypeSchema, validateStaffingSchema, addJobSkillSchema, } from '../schemas/hr-operations-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// All prototype operations require TENANT_OWNER role
router.use(requirePermission('AI_SERVICES', 'VIEW'));
// NOTE: Prototypes are global reference data, NOT tenant-specific.
// Tenant context is only required for routes under /tenants/:tenantId/*
// which apply the prototype to a specific tenant's organizational structure.
// =============================================================================
// INDUSTRY PROTOTYPES (No tenant required - global reference data)
// =============================================================================
/**
 * GET /prototypes
 * List all industry prototypes
 */
router.get('/', asyncHandler(async (req, res) => {
    const { nace_section, size_class, search, limit = '50', offset = '0', } = req.query;
    let query = `
      SELECT ip.*,
        (SELECT COUNT(*) FROM business_processes WHERE profile_id = ip.id) as process_count,
        0 as staffing_rules_count,
        (SELECT COUNT(*) FROM org_chart_templates WHERE profile_id = ip.id) as org_chart_count
      FROM industry_profiles ip
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    if (nace_section) {
        query += ` AND ip.nace_class_code LIKE $${paramIndex}`;
        params.push(nace_section + '%');
        paramIndex++;
    }
    if (size_class) {
        query += ` AND ip.company_size_code = $${paramIndex}`;
        params.push(size_class.toUpperCase());
        paramIndex++;
    }
    if (search) {
        query += ` AND (ip.name ILIKE $${paramIndex} OR ip.code ILIKE $${paramIndex} OR ip.description ILIKE $${paramIndex})`;
        params.push(`%${escapeILIKE(search)}%`);
        paramIndex++;
    }
    query += ` ORDER BY ip.nace_class_code, ip.company_size_code LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query('SELECT COUNT(*) FROM industry_profiles');
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
 * GET /prototypes/nace-sections
 * List available NACE sections
 */
router.get('/nace-sections', asyncHandler(async (req, res) => {
    const result = await req.dbClient.query(`
      SELECT ic.code, ic.name_en AS name, ic.name_it, ic.icon, ic.color,
        COALESCE(pc.profile_count, 0) AS profile_count
      FROM industry_classifications ic
      LEFT JOIN (
        SELECT LEFT(nace_class_code, 1) AS section_code, COUNT(*) AS profile_count
        FROM industry_profiles
        GROUP BY LEFT(nace_class_code, 1)
      ) pc ON pc.section_code = ic.code
      WHERE ic.level = 1 AND ic.is_active = true
      ORDER BY ic.code
    `);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /prototypes/:id
 * Get prototype details
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT ip.*,
        (SELECT COUNT(*) FROM business_processes WHERE profile_id = ip.id) as process_count,
        0 as staffing_rules_count,
        (SELECT COUNT(*) FROM org_chart_templates WHERE profile_id = ip.id) as org_chart_count
      FROM industry_profiles ip
      WHERE ip.id = $1
    `, [id]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Prototype');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /prototypes/research
 * Research and create a new prototype based on NACE code
 */
router.post('/research', validate(prototypeResearchSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { nace_code, company_size = 'medium' } = req.body;
    if (!nace_code) {
        throw Errors.badRequest('NACE code is required');
    }
    const service = new BusinessProcessResearchService(tenantId);
    const result = await service.researchIndustryProcesses(nace_code, company_size);
    res.json({
        success: true,
        data: result,
        message: `Research completed for NACE ${nace_code}`,
    });
}));
// =============================================================================
// BUSINESS PROCESSES
// =============================================================================
/**
 * GET /prototypes/:id/processes
 * Get business processes for a prototype
 */
router.get('/:id/processes', asyncHandler(async (req, res) => {
    const prototypeId = req.params['id'];
    const { process_category } = req.query;
    let query = `
      SELECT bp.*,
        (SELECT COUNT(*) FROM process_cost_centers WHERE process_id = bp.id) as cost_center_count
      FROM business_processes bp
      WHERE bp.profile_id = $1
    `;
    const params = [prototypeId];
    const paramIndex = 2;
    if (process_category) {
        query += ` AND bp.process_category = $${paramIndex}`;
        params.push(process_category);
    }
    query += ' ORDER BY bp.value_chain_position, bp.process_code';
    const result = await req.dbClient.query(query, params);
    res.json({ success: true, data: result.rows });
}));
/**
 * POST /prototypes/:id/processes
 * Add a business process to a prototype
 */
router.post('/:id/processes', validate(createProcessSchema), asyncHandler(async (req, res) => {
    const prototypeId = req.params['id'];
    const { process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, } = req.body;
    if (!process_code || !process_name || !process_category || !value_chain_position) {
        throw Errors.badRequest('process_code, process_name, process_category, and value_chain_position are required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO business_processes (
        profile_id, process_code, process_name, process_category,
        value_chain_position, description, typical_inputs, typical_outputs
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
        prototypeId,
        process_code,
        process_name,
        process_category,
        value_chain_position,
        description,
        typical_inputs,
        typical_outputs,
    ]);
    res.status(201).json({
        success: true,
        data: result.rows[0] || null,
        message: 'Business process created',
    });
}));
/**
 * GET /processes/:id/cost-centers
 * Get cost centers for a business process
 */
router.get('/processes/:id/cost-centers', asyncHandler(async (req, res) => {
    const processId = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT pcc.*
      FROM process_cost_centers pcc
      WHERE pcc.process_id = $1
      ORDER BY pcc.cost_center_code
    `, [processId]);
    res.json({ success: true, data: result.rows });
}));
// =============================================================================
// STAFFING RULES
// =============================================================================
/**
 * GET /prototypes/:id/staffing-rules
 * Get staffing rules for a prototype
 */
router.get('/:id/staffing-rules', asyncHandler(async (req, res) => {
    const prototypeId = req.params['id'];
    const { company_size } = req.query;
    const service = new StaffingRulesGeneratorService('system');
    const rules = await service.getStaffingRules(prototypeId, company_size ? company_size : undefined);
    res.json({ success: true, data: rules });
}));
/**
 * POST /prototypes/:id/staffing-rules
 * Create or update staffing rules for a prototype
 */
router.post('/:id/staffing-rules', validate(createStaffingRulesSchema), asyncHandler(async (req, res) => {
    const prototypeId = req.params['id'];
    const { rules } = req.body;
    if (!rules || !Array.isArray(rules)) {
        throw Errors.badRequest('rules array is required');
    }
    const service = new StaffingRulesGeneratorService('system');
    // Add prototypeId to each rule
    const enrichedRules = rules.map((r) => ({
        ...r,
        prototypeId,
    }));
    await service.saveStaffingRules(enrichedRules);
    res.json({
        success: true,
        message: `${rules.length} staffing rules saved`,
    });
}));
/**
 * POST /prototypes/:id/staffing-rules/calculate
 * Calculate optimal staffing for a prototype
 */
router.post('/:id/staffing-rules/calculate', validate(calculateStaffingSchema), asyncHandler(async (req, res) => {
    const prototypeId = req.params['id'];
    const { company_size = 'medium' } = req.body;
    const service = new StaffingRulesGeneratorService('system');
    const result = await service.calculateOptimalStaffing(prototypeId, company_size);
    res.json({ success: true, data: result });
}));
/**
 * GET /prototypes/:id/benchmarks
 * Get industry benchmarks for a prototype
 */
router.get('/:id/benchmarks', asyncHandler(async (req, res) => {
    const prototypeId = req.params['id'];
    // Get profile NACE code
    const protoResult = await req.dbClient.query('SELECT nace_class_code FROM industry_profiles WHERE id = $1', [prototypeId]);
    if (protoResult.rows.length === 0) {
        throw Errors.notFound('Profile');
    }
    const naceCode = protoResult.rows[0]?.nace_class_code;
    const service = new StaffingRulesGeneratorService('system');
    const benchmarks = await service.getIndustryBenchmarks(naceCode);
    res.json({ success: true, data: benchmarks });
}));
// =============================================================================
// PROTOTYPE GENERATION (Tenant-specific operations)
// These routes apply prototypes to specific tenants - tenantId from path param
// =============================================================================
/**
 * POST /tenants/:tenantId/generate
 * Generate complete organizational structure from prototype
 */
router.post('/tenants/:tenantId/generate', requireTenant, validate(generatePrototypeSchema), asyncHandler(async (req, res) => {
    const tenantId = req.params['tenantId'];
    const { profile_id, prototype_id, config } = req.body;
    const effectiveProfileId = profile_id || prototype_id;
    if (!effectiveProfileId) {
        throw Errors.badRequest('profile_id is required');
    }
    const service = new PrototypeGeneratorService(tenantId);
    const result = await service.generateFromPrototype(effectiveProfileId, config);
    res.json({
        success: true,
        data: result,
        message: 'Structure generated successfully',
    });
}));
// generation-status route removed — prototype_generation_sessions table dropped in phase 6
/**
 * POST /tenants/:tenantId/generate/preview
 * Preview generation without applying changes
 */
router.post('/tenants/:tenantId/generate/preview', requireTenant, validate(previewPrototypeSchema), asyncHandler(async (req, res) => {
    const tenantId = req.params['tenantId'];
    const { profile_id, prototype_id, company_size = 'medium' } = req.body;
    const effectiveProfileId = profile_id || prototype_id;
    if (!effectiveProfileId) {
        throw Errors.badRequest('profile_id is required');
    }
    // Get prototype details
    const protoResult = await req.dbClient.query(`SELECT id, code, name, description, nace_class_code,
              company_size_code, min_employees, max_employees, typical_departments,
              typical_roles, created_at, updated_at, typical_hierarchy,
              typical_span_of_control, esco_occupation_codes, department_templates
       FROM industry_profiles WHERE id = $1`, [effectiveProfileId]);
    if (protoResult.rows.length === 0) {
        throw Errors.notFound('Prototype');
    }
    const prototype = protoResult.rows[0];
    // Get business processes
    const processesResult = await req.dbClient.query(`SELECT id, profile_id, process_code, process_name, process_category,
              value_chain_position, description, typical_inputs, typical_outputs,
              created_at, updated_at
       FROM business_processes WHERE profile_id = $1 ORDER BY value_chain_position`, [effectiveProfileId]);
    // Get staffing rules
    const staffingService = new StaffingRulesGeneratorService(tenantId);
    const staffingResult = await staffingService.calculateOptimalStaffing(effectiveProfileId, company_size);
    // Get org chart template
    const orgChartResult = await req.dbClient.query(`
      SELECT oct.*,
        (SELECT COUNT(*) FROM org_unit_templates WHERE org_chart_template_id = oct.id) as unit_count,
        (SELECT COUNT(*) FROM job_templates jt
         JOIN org_unit_templates out ON jt.org_unit_template_id = out.id
         WHERE out.org_chart_template_id = oct.id) as job_count
      FROM org_chart_templates oct
      WHERE oct.profile_id = $1
    `, [effectiveProfileId]);
    res.json({
        success: true,
        data: {
            prototype,
            processes: processesResult.rows,
            staffing: staffingResult,
            orgChart: orgChartResult.rows[0] || null,
            preview: true,
        },
    });
}));
/**
 * POST /tenants/:tenantId/validate-staffing
 * Validate a staffing plan
 */
router.post('/tenants/:tenantId/validate-staffing', requireTenant, validate(validateStaffingSchema), asyncHandler(async (req, res) => {
    const tenantId = req.params['tenantId'];
    const { staffing_plan } = req.body;
    if (!staffing_plan) {
        throw Errors.badRequest('staffing_plan is required');
    }
    const service = new StaffingRulesGeneratorService(tenantId);
    const validation = await service.validateStaffingRatios(staffing_plan);
    res.json({ success: true, data: validation });
}));
// =============================================================================
// EXPORT
// =============================================================================
/**
 * GET /tenants/:tenantId/org-chart/excalidraw
 * Export org chart to Excalidraw format
 */
router.get('/tenants/:tenantId/org-chart/excalidraw', requireTenant, asyncHandler(async (req, res) => {
    const tenantId = req.params['tenantId'];
    // Get org units for tenant
    const orgUnitsResult = await req.dbClient.query(`
      SELECT id, code, name as name_en, name_it, level,
        (SELECT code FROM org_units p WHERE p.id = o.parent_id) as parent_code
      FROM org_units o
      WHERE o.tenant_id = $1
      ORDER BY o.level, o.code
    `, [tenantId]);
    const service = new PrototypeGeneratorService(tenantId);
    const orgUnits = orgUnitsResult.rows.map((row) => ({
        code: row.code,
        nameIt: row.name_it || row.name_en,
        nameEn: row.name_en,
        level: row.level,
        parentCode: row.parent_code,
        processIds: [],
    }));
    const excalidraw = await service.exportToExcalidraw(orgUnits);
    res.json({
        success: true,
        data: excalidraw,
        contentType: 'application/json',
    });
}));
/**
 * GET /tenants/:tenantId/prototype-report
 * Get complete prototype report for a tenant
 */
router.get('/tenants/:tenantId/prototype-report', requireTenant, asyncHandler(async (req, res) => {
    const tenantId = req.params['tenantId'];
    // Get tenant info with industry profile
    const tenantResult = await req.dbClient.query(`SELECT t.id, t.code, t.name, t.description, t.region, t.status,
              t.employee_count, t.subscription_plan, t.industry_type,
              t.industry_profile_id, ip.code AS profile_code, ip.name AS profile_name,
              t.created_at, t.updated_at
       FROM tenants t
       LEFT JOIN industry_profiles ip ON t.industry_profile_id = ip.id
       WHERE t.id = $1`, [tenantId]);
    if (tenantResult.rows.length === 0) {
        throw Errors.notFound('Tenant');
    }
    const tenant = tenantResult.rows[0];
    // Get org stats
    const statsResult = await req.dbClient.query(`
      SELECT
        (SELECT COUNT(*) FROM org_units WHERE tenant_id = $1) as org_unit_count,
        (SELECT COUNT(*) FROM employees WHERE tenant_id = $1) as employee_count,
        (SELECT COUNT(*) FROM cost_centers WHERE tenant_id = $1) as cost_center_count
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            tenant,
            statistics: statsResult.rows[0],
        },
    });
}));
// =============================================================================
// ORG UNIT TASKS & KPIS
// =============================================================================
/**
 * GET /prototypes/:id/tasks
 * Get tasks for prototype org units
 */
router.get('/:id/tasks', asyncHandler(async (req, res) => {
    const prototypeId = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT out.*, out.code as org_unit_code, out.name_en as org_unit_name
      FROM org_unit_tasks out
      JOIN org_unit_templates outtpl ON out.org_unit_template_id = outtpl.id
      JOIN org_chart_templates oct ON outtpl.org_chart_template_id = oct.id
      WHERE oct.profile_id = $1
      ORDER BY outtpl.code, out.task_code
    `, [prototypeId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /prototypes/:id/kpis
 * Get KPIs for prototype org units
 */
router.get('/:id/kpis', asyncHandler(async (req, res) => {
    const prototypeId = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT ouk.*, outtpl.code as org_unit_code, outtpl.name_en as org_unit_name
      FROM org_unit_kpis ouk
      JOIN org_unit_templates outtpl ON ouk.org_unit_template_id = outtpl.id
      JOIN org_chart_templates oct ON outtpl.org_chart_template_id = oct.id
      WHERE oct.profile_id = $1
      ORDER BY outtpl.code, ouk.kpi_code
    `, [prototypeId]);
    res.json({ success: true, data: result.rows });
}));
// =============================================================================
// JOB SKILLS ENRICHMENT (Skill Taxonomy Integration)
// =============================================================================
/**
 * POST /prototypes/job-skills/enrich-all
 * Enrich all job skills with taxonomy classification data
 */
router.post('/job-skills/enrich-all', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new JobSkillsEnrichmentService(tenantId);
    const result = await service.enrichAllJobSkills();
    res.json({
        success: true,
        data: result,
        message: `Enriched ${result.enriched} of ${result.total_skills} job skills`,
    });
}));
/**
 * POST /prototypes/job-templates/:jobTemplateId/enrich-skills
 * Enrich job skills for a specific job template with taxonomy data
 */
router.post('/job-templates/:jobTemplateId/enrich-skills', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const jobTemplateId = req.params['jobTemplateId'];
    if (!jobTemplateId) {
        throw Errors.badRequest('Job template ID is required');
    }
    const service = new JobSkillsEnrichmentService(tenantId);
    const result = await service.enrichJobTemplateSkills(jobTemplateId);
    res.json({
        success: true,
        data: result,
        message: `Enriched ${result.enriched} of ${result.total_skills} skills`,
    });
}));
/**
 * GET /prototypes/job-templates/:jobTemplateId/skill-distribution
 * Get skill distribution analysis for a job template
 */
router.get('/job-templates/:jobTemplateId/skill-distribution', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const jobTemplateId = req.params['jobTemplateId'];
    if (!jobTemplateId) {
        throw Errors.badRequest('Job template ID is required');
    }
    const service = new JobSkillsEnrichmentService(tenantId);
    const distribution = await service.getJobSkillDistribution(jobTemplateId);
    if (!distribution) {
        throw Errors.notFound('Job template');
    }
    res.json({ success: true, data: distribution });
}));
/**
 * GET /prototypes/job-templates/:jobTemplateId/skill-balance
 * Get skill balance recommendations for a job template
 */
router.get('/job-templates/:jobTemplateId/skill-balance', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const jobTemplateId = req.params['jobTemplateId'];
    if (!jobTemplateId) {
        throw Errors.badRequest('Job template ID is required');
    }
    const service = new JobSkillsEnrichmentService(tenantId);
    const result = await service.getSkillBalanceRecommendations(jobTemplateId);
    res.json({ success: true, data: result });
}));
/**
 * GET /prototypes/job-templates/:jobTemplateId/suggest-skills
 * Suggest skills for a job template based on taxonomy
 */
router.get('/job-templates/:jobTemplateId/suggest-skills', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const jobTemplateId = req.params['jobTemplateId'];
    const { max_suggestions = '20', include_hard, include_soft, include_hybrid, min_transferability, } = req.query;
    if (!jobTemplateId) {
        throw Errors.badRequest('Job template ID is required');
    }
    const service = new JobSkillsEnrichmentService(tenantId);
    const suggestions = await service.suggestSkillsForJobTemplate(jobTemplateId, {
        max_suggestions: parseInt(max_suggestions),
        include_hard: include_hard !== 'false',
        include_soft: include_soft !== 'false',
        include_hybrid: include_hybrid !== 'false',
        min_transferability_score: min_transferability
            ? parseFloat(min_transferability)
            : undefined,
    });
    res.json({ success: true, data: suggestions, count: suggestions.length });
}));
/**
 * POST /prototypes/job-templates/:jobTemplateId/add-skill
 * Add a suggested skill to a job template
 */
router.post('/job-templates/:jobTemplateId/add-skill', validate(addJobSkillSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const jobTemplateId = req.params['jobTemplateId'];
    const { esco_skill_id, required_level, is_required, importance } = req.body;
    if (!jobTemplateId) {
        throw Errors.badRequest('Job template ID is required');
    }
    if (!esco_skill_id) {
        throw Errors.badRequest('esco_skill_id is required');
    }
    const service = new JobSkillsEnrichmentService(tenantId);
    const result = await service.addSkillToJobTemplate(jobTemplateId, esco_skill_id, {
        required_level,
        is_required,
        importance,
    });
    if (!result.success) {
        throw Errors.badRequest(result.message);
    }
    res.status(201).json({ success: true, data: result, message: result.message });
}));
/**
 * GET /prototypes/clusters/:clusterId/suggest-skills
 * Suggest skills from a specific cluster
 */
router.get('/clusters/:clusterId/suggest-skills', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const clusterId = req.params['clusterId'];
    const { exclude_ids, limit = '10' } = req.query;
    if (!clusterId) {
        throw Errors.badRequest('Cluster ID is required');
    }
    const excludeIds = exclude_ids ? exclude_ids.split(',') : [];
    const service = new JobSkillsEnrichmentService(tenantId);
    const suggestions = await service.suggestSkillsByCluster(clusterId, excludeIds, safeParseInt(limit, { fallback: 50 }));
    res.json({ success: true, data: suggestions, count: suggestions.length });
}));
export default router;
//# sourceMappingURL=prototypes.js.map