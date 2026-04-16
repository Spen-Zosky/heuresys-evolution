/**
 * O*NET API Routes
 *
 * Provides endpoints for O*NET occupational data:
 * - Import jobs management
 * - Occupation search and retrieval
 * - Skill-occupation relationships
 * - ESCO mapping operations
 *
 * @story S-ONTO-01-04 - O*NET Data Import Pipeline
 */
import { Router } from 'express';
import { pool } from '../config/database.js';
import { ONetImportService } from '../services/onet-import.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { onetImportJobSchema, onetImportExecuteSchema, onetMapToEscoSchema, } from '../schemas/semantic.js';
import { buildMeta } from '../utils/pagination.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// Service instance (lazy initialized)
let onetService = null;
function getONetService() {
    if (!onetService) {
        onetService = new ONetImportService(pool);
    }
    return onetService;
}
// =============================================================================
// STATISTICS
// =============================================================================
/**
 * GET /onet/stats
 * Get O*NET database statistics
 */
router.get('/stats', asyncHandler(async (_req, res) => {
    const service = getONetService();
    const stats = await service.getStats();
    res.json({
        success: true,
        data: stats,
    });
}));
// =============================================================================
// IMPORT JOBS
// =============================================================================
/**
 * POST /onet/import/jobs
 * Create a new import job
 */
router.post('/import/jobs', validate(onetImportJobSchema), asyncHandler(async (req, res) => {
    const { import_type, source_version } = req.body;
    const validTypes = [
        'full',
        'occupations',
        'skills',
        'abilities',
        'knowledge',
        'activities',
        'links',
    ];
    if (!import_type || !validTypes.includes(import_type)) {
        throw Errors.badRequest(`import_type must be one of: ${validTypes.join(', ')}`);
    }
    const service = getONetService();
    const job = await service.createImportJob(import_type, source_version);
    res.status(201).json({
        success: true,
        data: job,
    });
}));
/**
 * GET /onet/import/jobs
 * List import jobs
 */
router.get('/import/jobs', asyncHandler(async (req, res) => {
    const limit = safeParseInt(req.query.limit, { fallback: 20, max: 100 });
    const offset = safeParseInt(req.query.offset, { fallback: 0, min: 0 });
    const service = getONetService();
    const result = await service.listImportJobs(limit, offset);
    res.json({
        success: true,
        data: result.jobs,
        meta: buildMeta(result.total, limit, offset),
    });
}));
/**
 * GET /onet/import/jobs/:jobId
 * Get import job status
 */
router.get('/import/jobs/:jobId', asyncHandler(async (req, res) => {
    const jobId = req.params.jobId;
    const service = getONetService();
    const job = await service.getImportJobStatus(jobId);
    if (!job) {
        throw Errors.notFound('Import job', jobId);
    }
    res.json({
        success: true,
        data: job,
    });
}));
/**
 * POST /onet/import/jobs/:jobId/execute
 * Execute an import job with provided data
 */
router.post('/import/jobs/:jobId/execute', validate(onetImportExecuteSchema), asyncHandler(async (req, res) => {
    const jobId = req.params.jobId;
    const { data, source_version } = req.body;
    if (!data || !Array.isArray(data)) {
        throw Errors.badRequest('data array is required');
    }
    const service = getONetService();
    const job = await service.getImportJobStatus(jobId);
    if (!job) {
        throw Errors.notFound('Import job', jobId);
    }
    if (job.status !== 'pending') {
        throw Errors.badRequest(`Job is already ${job.status}, cannot execute`);
    }
    let stats;
    switch (job.import_type) {
        case 'occupations':
            stats = await service.importOccupations(jobId, data, source_version);
            break;
        case 'skills':
            stats = await service.importSkills(jobId, data);
            break;
        case 'abilities':
            stats = await service.importAbilities(jobId, data);
            break;
        case 'knowledge':
            stats = await service.importKnowledge(jobId, data);
            break;
        case 'activities':
            stats = await service.importWorkActivities(jobId, data);
            break;
        case 'links':
            stats = await service.importOccupationSkillLinks(jobId, data);
            break;
        default:
            throw Errors.badRequest(`Import type ${job.import_type} not supported for direct execution`);
    }
    res.json({
        success: true,
        data: {
            job_id: jobId,
            stats,
        },
    });
}));
// =============================================================================
// ESCO MAPPING
// =============================================================================
/**
 * POST /onet/map-to-esco
 * Map O*NET skills to ESCO using semantic similarity
 */
router.post('/map-to-esco', validate(onetMapToEscoSchema), asyncHandler(async (req, res) => {
    const { confidence_threshold = 0.7 } = req.body;
    const service = getONetService();
    const result = await service.mapSkillsToEsco(confidence_threshold);
    res.json({
        success: true,
        data: result,
    });
}));
// =============================================================================
// OCCUPATIONS
// =============================================================================
/**
 * GET /onet/occupations
 * List occupations with optional filters
 */
router.get('/occupations', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const limit = safeParseInt(req.query.limit, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset, { fallback: 0, min: 0 });
    const jobZone = req.query.job_zone ? parseInt(req.query.job_zone) : undefined;
    const search = req.query.search;
    let query = `
      SELECT id, onet_soc_code, title, job_zone, education_required,
             embedding_en IS NOT NULL as has_embedding
      FROM onet_occupations
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    if (jobZone) {
        query += ` AND job_zone = $${paramIndex++}`;
        params.push(jobZone);
    }
    if (search) {
        query += ` AND (title ILIKE $${paramIndex} OR onet_soc_code ILIKE $${paramIndex})`;
        params.push(`%${escapeILIKE(search)}%`);
        paramIndex++;
    }
    // Count
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await dbClient.query(countQuery, params);
    // Paginate
    query += ` ORDER BY onet_soc_code LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    const result = await dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.count), limit, offset),
    });
}));
/**
 * GET /onet/occupations/search
 * Full-text search for occupations
 */
router.get('/occupations/search', asyncHandler(async (req, res) => {
    const query = req.query.q;
    const limit = safeParseInt(req.query.limit, { fallback: 20, max: 100 });
    if (!query || query.length < 2) {
        throw Errors.badRequest('Query (q) must be at least 2 characters');
    }
    const service = getONetService();
    const results = await service.searchOccupations(query, limit);
    res.json({
        success: true,
        data: results,
    });
}));
/**
 * GET /onet/occupations/:id
 * Get occupation details
 */
router.get('/occupations/:id', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const id = req.params.id;
    const result = await dbClient.query(`SELECT id, onet_soc_code, title, description, job_zone,
              related_experience, education_required, on_job_training,
              source_version, created_at, updated_at
       FROM onet_occupations WHERE id::text = $1 OR onet_soc_code = $1`, [id]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Occupation', id);
    }
    res.json({
        success: true,
        data: result.rows[0] || null,
    });
}));
/**
 * GET /onet/occupations/:id/skills
 * Get skills required for an occupation
 */
router.get('/occupations/:id/skills', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const id = req.params.id;
    // First get the occupation ID if code was passed
    const occResult = await dbClient.query(`SELECT id FROM onet_occupations WHERE id::text = $1 OR onet_soc_code = $1`, [id]);
    if (occResult.rows.length === 0) {
        throw Errors.notFound('Occupation', id);
    }
    const occupationId = occResult.rows[0]?.id;
    const service = getONetService();
    const skills = await service.getSkillsForOccupation(occupationId);
    res.json({
        success: true,
        data: skills,
    });
}));
// =============================================================================
// SKILLS
// =============================================================================
/**
 * GET /onet/skills
 * List O*NET skills
 */
router.get('/skills', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const limit = safeParseInt(req.query.limit, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset, { fallback: 0, min: 0 });
    const category = req.query.category;
    const mappedOnly = req.query.mapped_only === 'true';
    let query = `
      SELECT s.id, s.element_id, s.element_name, s.category,
             s.mapped_esco_skill_id, s.mapping_confidence,
             es.preferred_label_en as esco_skill_name
      FROM onet_skills s
      LEFT JOIN esco_skills es ON es.id = s.mapped_esco_skill_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    if (category) {
        query += ` AND s.category = $${paramIndex++}`;
        params.push(category);
    }
    if (mappedOnly) {
        query += ` AND s.mapped_esco_skill_id IS NOT NULL`;
    }
    // Count
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await dbClient.query(countQuery, params);
    // Paginate
    query += ` ORDER BY s.element_name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    const result = await dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.count), limit, offset),
    });
}));
/**
 * GET /onet/skills/:id/occupations
 * Get occupations requiring a skill
 */
router.get('/skills/:id/occupations', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const id = req.params.id;
    const minImportance = safeParseInt(req.query.min_importance, { fallback: 50 });
    // Get skill ID if element_id was passed
    const skillResult = await dbClient.query(`SELECT id FROM onet_skills WHERE id::text = $1 OR element_id = $1`, [id]);
    if (skillResult.rows.length === 0) {
        throw Errors.notFound('Skill', id);
    }
    const skillId = skillResult.rows[0]?.id;
    const service = getONetService();
    const occupations = await service.getOccupationsBySkill(skillId, minImportance);
    res.json({
        success: true,
        data: occupations,
    });
}));
// =============================================================================
// UNIFIED SKILLS VIEW
// =============================================================================
/**
 * GET /onet/unified-skills
 * Get unified view of skills across taxonomies
 */
router.get('/unified-skills', asyncHandler(async (req, res) => {
    const limit = safeParseInt(req.query.limit, { fallback: 100, max: 500 });
    const offset = safeParseInt(req.query.offset, { fallback: 0, min: 0 });
    const sources = req.query.sources?.split(',') || [
        'esco',
        'onet_skill',
        'onet_ability',
        'onet_knowledge',
    ];
    const service = getONetService();
    const skills = await service.getUnifiedSkills(sources, limit, offset);
    res.json({
        success: true,
        data: skills,
    });
}));
// =============================================================================
// ABILITIES
// =============================================================================
/**
 * GET /onet/abilities
 * List O*NET abilities
 */
router.get('/abilities', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const limit = safeParseInt(req.query.limit, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset, { fallback: 0, min: 0 });
    const category = req.query.category;
    let query = `
      SELECT id, element_id, element_name, description, category,
             mapped_esco_skill_id, mapping_confidence
      FROM onet_abilities
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    if (category) {
        query += ` AND category = $${paramIndex++}`;
        params.push(category);
    }
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await dbClient.query(countQuery, params);
    query += ` ORDER BY element_name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    const result = await dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.count), limit, offset),
    });
}));
// =============================================================================
// KNOWLEDGE
// =============================================================================
/**
 * GET /onet/knowledge
 * List O*NET knowledge areas
 */
router.get('/knowledge', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const limit = safeParseInt(req.query.limit, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset, { fallback: 0, min: 0 });
    const domain = req.query.domain;
    let query = `
      SELECT id, element_id, element_name, description, domain,
             mapped_esco_skill_id, mapping_confidence
      FROM onet_knowledge
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    if (domain) {
        query += ` AND domain = $${paramIndex++}`;
        params.push(domain);
    }
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await dbClient.query(countQuery, params);
    query += ` ORDER BY element_name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    const result = await dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.count), limit, offset),
    });
}));
// =============================================================================
// WORK ACTIVITIES
// =============================================================================
/**
 * GET /onet/work-activities
 * List O*NET work activities
 */
router.get('/work-activities', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const limit = safeParseInt(req.query.limit, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset, { fallback: 0, min: 0 });
    const activityType = req.query.activity_type;
    let query = `
      SELECT id, element_id, element_name, description, activity_type, parent_element_id
      FROM onet_work_activities
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    if (activityType) {
        query += ` AND activity_type = $${paramIndex++}`;
        params.push(activityType);
    }
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await dbClient.query(countQuery, params);
    query += ` ORDER BY element_name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    const result = await dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.count), limit, offset),
    });
}));
export default router;
//# sourceMappingURL=onet.js.map