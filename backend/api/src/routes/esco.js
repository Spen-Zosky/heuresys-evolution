/**
 * ESCO Explorer API Routes
 * Provides endpoints for exploring the complete ESCO classification:
 * - ISCO Groups hierarchy
 * - Occupations with search
 * - Skills with search and filters
 * - Occupation-Skill relations
 * - Skill-Skill relations
 */
import { Router } from 'express';
import { escapeILIKE, validateEmbeddingColumn } from '../utils/sql-safety.js';
import { cached } from '../services/cache.js';
import { cacheControl } from '../middleware/cacheHeaders.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// ESCO taxonomy data is static reference data — enable HTTP caching
router.use(cacheControl('static'));
// =============================================================================
// STATISTICS
// =============================================================================
/**
 * GET /esco/stats
 * Get overall ESCO statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const data = await cached('esco:stats', async () => {
        const result = await dbClient.query(`
        SELECT
          (SELECT COUNT(*) FROM esco_isco_groups) as isco_groups,
          (SELECT COUNT(*) FROM esco_occupations) as occupations,
          (SELECT COUNT(*) FROM esco_skills) as skills,
          (SELECT COUNT(*) FROM esco_skills WHERE skill_type = 'skill') as skills_count,
          (SELECT COUNT(*) FROM esco_skills WHERE skill_type = 'knowledge') as knowledge_count,
          (SELECT COUNT(*) FROM esco_skills WHERE is_digital = true) as digital_skills,
          (SELECT COUNT(*) FROM esco_skills WHERE is_green = true) as green_skills,
          (SELECT COUNT(*) FROM esco_skills WHERE is_transversal = true) as transversal_skills,
          (SELECT COUNT(*) FROM esco_skill_groups) as skill_groups,
          (SELECT COUNT(*) FROM esco_occupation_skills) as occupation_skill_relations,
          (SELECT COUNT(*) FROM esco_skill_relations) as skill_skill_relations
      `);
        return result.rows[0];
    }, 600);
    res.json({ success: true, data });
}));
// =============================================================================
// ISCO GROUPS
// =============================================================================
/**
 * GET /esco/isco-groups
 * Get ISCO groups hierarchy
 */
router.get('/isco-groups', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { level, parent_uri } = req.query;
    let query = `
      SELECT
        id, uri, code,
        preferred_label_en, preferred_label_it,
        description_en, description_it,
        parent_uri, level,
        (SELECT COUNT(*) FROM esco_isco_groups c WHERE c.parent_uri = g.uri) as children_count,
        (SELECT COUNT(*) FROM esco_occupations o WHERE o.isco_code = g.code) as occupations_count
      FROM esco_isco_groups g
      WHERE 1=1
    `;
    const params = [];
    if (level) {
        params.push(safeParseInt(level, { fallback: 0 }));
        query += ` AND level = $${params.length}`;
    }
    if (parent_uri) {
        params.push(parent_uri);
        query += ` AND parent_uri = $${params.length}`;
    }
    query += ` ORDER BY code`;
    const result = await dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        count: result.rowCount,
    });
}));
/**
 * GET /esco/isco-groups/:code
 * Get ISCO group by code with children and occupations
 */
router.get('/isco-groups/:code', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { code } = req.params;
    // Get the group
    const groupResult = await dbClient.query(`
      SELECT
        id, uri, code,
        preferred_label_en, preferred_label_it,
        description_en, description_it,
        parent_uri, level
      FROM esco_isco_groups
      WHERE code = $1
    `, [code]);
    if (groupResult.rowCount === 0) {
        throw Errors.notFound('ISCO group', code);
    }
    const group = groupResult.rows[0];
    // Get children
    const childrenResult = await dbClient.query(`
      SELECT code, preferred_label_en, preferred_label_it, level
      FROM esco_isco_groups
      WHERE parent_uri = $1
      ORDER BY code
    `, [group.uri]);
    // Get occupations
    const occupationsResult = await dbClient.query(`
      SELECT id, uri, code, isco_code,
             preferred_label_en, preferred_label_it
      FROM esco_occupations
      WHERE isco_code = $1
      ORDER BY preferred_label_en
      LIMIT 50
    `, [code]);
    res.json({
        success: true,
        data: {
            ...group,
            children: childrenResult.rows,
            occupations: occupationsResult.rows,
        },
    });
}));
// =============================================================================
// OCCUPATIONS
// =============================================================================
/**
 * GET /esco/occupations
 * Search and list occupations
 */
router.get('/occupations', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { search, isco_code, limit = '50', offset = '0', lang = 'en', } = req.query;
    const validLang = lang === 'it' ? 'it' : 'en';
    const labelCol = validateEmbeddingColumn(validLang === 'it' ? 'preferred_label_it' : 'preferred_label_en', 'esco.occupations-sort');
    let query = `
      SELECT
        o.id, o.uri, o.code, o.isco_code,
        o.preferred_label_en, o.preferred_label_it,
        o.description_en, o.description_it,
        o.parent_uri,
        g.preferred_label_en as isco_group_name,
        (SELECT COUNT(*) FROM esco_occupation_skills os WHERE os.occupation_id = o.id) as skills_count
      FROM esco_occupations o
      LEFT JOIN esco_isco_groups g ON o.isco_code = g.code
      WHERE 1=1
    `;
    const params = [];
    if (search) {
        params.push(`%${escapeILIKE(search)}%`);
        const searchParam = params.length;
        query += ` AND (
        o.preferred_label_en ILIKE $${searchParam} OR
        o.preferred_label_it ILIKE $${searchParam} OR
        o.description_en ILIKE $${searchParam} OR
        o.description_it ILIKE $${searchParam} OR
        o.code ILIKE $${searchParam}
      )`;
    }
    if (isco_code) {
        params.push(isco_code);
        query += ` AND o.isco_code = $${params.length}`;
    }
    // Order by relevance if searching, otherwise by label
    if (search) {
        query += ` ORDER BY
        CASE WHEN o.${labelCol} ILIKE $1 THEN 0 ELSE 1 END,
        o.${labelCol}`;
    }
    else {
        query += ` ORDER BY o.${labelCol}`;
    }
    params.push(safeParseInt(limit, { fallback: 50 }));
    query += ` LIMIT $${params.length}`;
    params.push(safeParseInt(offset, { fallback: 0 }));
    query += ` OFFSET $${params.length}`;
    const result = await dbClient.query(query, params);
    // Get total count
    let countQuery = `SELECT COUNT(*) FROM esco_occupations o WHERE 1=1`;
    const countParams = [];
    if (search) {
        countParams.push(`%${escapeILIKE(search)}%`);
        countQuery += ` AND (
        o.preferred_label_en ILIKE $1 OR
        o.preferred_label_it ILIKE $1 OR
        o.code ILIKE $1
      )`;
    }
    if (isco_code) {
        countParams.push(isco_code);
        countQuery += ` AND o.isco_code = $${countParams.length}`;
    }
    const countResult = await dbClient.query(countQuery, countParams);
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
 * GET /esco/occupations/:id
 * Get occupation details with skills
 */
router.get('/occupations/:id', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { id } = req.params;
    // Get occupation
    const occResult = await dbClient.query(`
      SELECT
        o.id, o.uri, o.code, o.isco_code,
        o.preferred_label_en, o.preferred_label_it,
        o.description_en, o.description_it,
        o.alt_labels, o.alt_labels_it,
        o.parent_uri,
        g.preferred_label_en as isco_group_name,
        g.preferred_label_it as isco_group_name_it
      FROM esco_occupations o
      LEFT JOIN esco_isco_groups g ON o.isco_code = g.code
      WHERE o.id = $1
    `, [id]);
    if (occResult.rowCount === 0) {
        throw Errors.notFound('Occupation', id);
    }
    // Get essential skills
    const essentialSkills = await dbClient.query(`
      SELECT
        s.id, s.uri, s.skill_type,
        s.preferred_label_en, s.preferred_label_it,
        s.is_digital, s.is_green, s.is_transversal
      FROM esco_occupation_skills os
      JOIN esco_skills s ON s.id = os.skill_id
      WHERE os.occupation_id = $1 AND os.relation_type = 'essential'
      ORDER BY s.preferred_label_en
    `, [id]);
    // Get optional skills
    const optionalSkills = await dbClient.query(`
      SELECT
        s.id, s.uri, s.skill_type,
        s.preferred_label_en, s.preferred_label_it,
        s.is_digital, s.is_green, s.is_transversal
      FROM esco_occupation_skills os
      JOIN esco_skills s ON s.id = os.skill_id
      WHERE os.occupation_id = $1 AND os.relation_type = 'optional'
      ORDER BY s.preferred_label_en
    `, [id]);
    res.json({
        success: true,
        data: {
            ...(occResult.rows[0] || {}),
            essential_skills: essentialSkills.rows,
            optional_skills: optionalSkills.rows,
        },
    });
}));
// =============================================================================
// SKILLS
// =============================================================================
/**
 * GET /esco/skills
 * Search and list skills with filters
 */
router.get('/skills', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { search, skill_type, is_digital, is_green, is_transversal, reuse_level, limit = '50', offset = '0', lang = 'en', } = req.query;
    const validSkillLang = lang === 'it' ? 'it' : 'en';
    const skillLabelCol = validateEmbeddingColumn(validSkillLang === 'it' ? 'preferred_label_it' : 'preferred_label_en', 'esco.skills-sort');
    let query = `
      SELECT
        s.id, s.uri, s.skill_type, s.reuse_level,
        s.preferred_label_en, s.preferred_label_it,
        s.description_en, s.description_it,
        s.is_digital, s.is_green, s.is_transversal,
        s.broader_uri,
        (SELECT COUNT(*) FROM esco_occupation_skills os WHERE os.skill_id = s.id) as occupations_count,
        (SELECT COUNT(*) FROM esco_skill_relations sr WHERE sr.skill_uri = s.uri) as related_skills_count
      FROM esco_skills s
      WHERE 1=1
    `;
    const params = [];
    if (search) {
        params.push(`%${escapeILIKE(search)}%`);
        const searchParam = params.length;
        query += ` AND (
        s.preferred_label_en ILIKE $${searchParam} OR
        s.preferred_label_it ILIKE $${searchParam} OR
        s.description_en ILIKE $${searchParam} OR
        s.description_it ILIKE $${searchParam}
      )`;
    }
    if (skill_type) {
        params.push(skill_type);
        query += ` AND s.skill_type = $${params.length}`;
    }
    if (is_digital === 'true') {
        query += ` AND s.is_digital = true`;
    }
    if (is_green === 'true') {
        query += ` AND s.is_green = true`;
    }
    if (is_transversal === 'true') {
        query += ` AND s.is_transversal = true`;
    }
    if (reuse_level) {
        params.push(reuse_level);
        query += ` AND s.reuse_level = $${params.length}`;
    }
    query += ` ORDER BY s.${skillLabelCol}`;
    params.push(safeParseInt(limit, { fallback: 50 }));
    query += ` LIMIT $${params.length}`;
    params.push(safeParseInt(offset, { fallback: 0 }));
    query += ` OFFSET $${params.length}`;
    const result = await dbClient.query(query, params);
    // Get total count with same filters
    let countQuery = `SELECT COUNT(*) FROM esco_skills s WHERE 1=1`;
    const countParams = [];
    if (search) {
        countParams.push(`%${escapeILIKE(search)}%`);
        countQuery += ` AND (s.preferred_label_en ILIKE $1 OR s.preferred_label_it ILIKE $1)`;
    }
    if (skill_type) {
        countParams.push(skill_type);
        countQuery += ` AND s.skill_type = $${countParams.length}`;
    }
    if (is_digital === 'true')
        countQuery += ` AND s.is_digital = true`;
    if (is_green === 'true')
        countQuery += ` AND s.is_green = true`;
    if (is_transversal === 'true')
        countQuery += ` AND s.is_transversal = true`;
    if (reuse_level) {
        countParams.push(reuse_level);
        countQuery += ` AND s.reuse_level = $${countParams.length}`;
    }
    const countResult = await dbClient.query(countQuery, countParams);
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
 * GET /esco/skills/:id
 * Get skill details with relations
 */
router.get('/skills/:id', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { id } = req.params;
    // Get skill
    const skillResult = await dbClient.query(`
      SELECT
        s.id, s.uri, s.skill_type, s.reuse_level,
        s.preferred_label_en, s.preferred_label_it,
        s.description_en, s.description_it,
        s.alt_labels, s.alt_labels_it,
        s.is_digital, s.is_green, s.is_transversal,
        s.broader_uri, s.narrower_uris,
        sg.preferred_label_en as skill_group_name
      FROM esco_skills s
      LEFT JOIN esco_skill_groups sg ON s.skill_group_uri = sg.uri
      WHERE s.id = $1
    `, [id]);
    if (skillResult.rowCount === 0) {
        throw Errors.notFound('Skill', id);
    }
    const skill = skillResult.rows[0];
    // Get occupations that require this skill
    const occupations = await dbClient.query(`
      SELECT
        o.id, o.code, o.preferred_label_en, o.preferred_label_it,
        os.relation_type
      FROM esco_occupation_skills os
      JOIN esco_occupations o ON o.id = os.occupation_id
      WHERE os.skill_id = $1
      ORDER BY os.relation_type, o.preferred_label_en
      LIMIT 50
    `, [id]);
    // Get related skills
    const relatedSkills = await dbClient.query(`
      SELECT
        s.id, s.preferred_label_en, s.preferred_label_it,
        s.skill_type, sr.relation_type
      FROM esco_skill_relations sr
      JOIN esco_skills s ON s.uri = sr.related_skill_uri
      WHERE sr.skill_uri = $1
      ORDER BY sr.relation_type, s.preferred_label_en
    `, [skill.uri]);
    // Get skill classifications (clusters)
    const classifications = await dbClient.query(`
      SELECT
        sc.code as cluster_code, sc.name_en as cluster_name, sc.name_it as cluster_name_it,
        pc.code as parent_cluster_code, pc.name_en as parent_cluster_name,
        scl.confidence_score, scl.classification_source,
        scl.primary_category, scl.cognitive_level_label, scl.transferability
      FROM skill_classifications scl
      JOIN skill_clusters sc ON sc.id = scl.skill_cluster_id
      LEFT JOIN skill_clusters pc ON pc.id = sc.parent_cluster_id
      WHERE scl.esco_skill_id = $1
      ORDER BY scl.confidence_score DESC
    `, [id]);
    res.json({
        success: true,
        data: {
            ...skill,
            occupations: occupations.rows,
            related_skills: relatedSkills.rows,
            clusters: classifications.rows,
        },
    });
}));
// =============================================================================
// SKILL GROUPS
// =============================================================================
/**
 * GET /esco/skill-groups
 * Get skill groups
 */
router.get('/skill-groups', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { parent_uri } = req.query;
    let query = `
      SELECT
        id, uri,
        preferred_label_en, preferred_label_it,
        description_en, description_it,
        broader_uri,
        (SELECT COUNT(*) FROM esco_skill_groups c WHERE c.broader_uri = g.uri) as children_count,
        (SELECT COUNT(*) FROM esco_skills s WHERE s.skill_group_uri = g.uri) as skills_count
      FROM esco_skill_groups g
      WHERE 1=1
    `;
    const params = [];
    if (parent_uri) {
        params.push(parent_uri);
        query += ` AND broader_uri = $${params.length}`;
    }
    else {
        query += ` AND broader_uri IS NULL`;
    }
    query += ` ORDER BY preferred_label_en`;
    const result = await dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        count: result.rowCount,
    });
}));
// =============================================================================
// RELATIONS
// =============================================================================
/**
 * GET /esco/occupation-skills/:occupationId
 * Get all skills for an occupation
 */
router.get('/occupation-skills/:occupationId', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const occupationId = req.params.occupationId;
    const { relation_type } = req.query;
    let query = `
      SELECT
        s.id, s.uri, s.skill_type,
        s.preferred_label_en, s.preferred_label_it,
        s.description_en, s.description_it,
        s.is_digital, s.is_green, s.is_transversal,
        os.relation_type
      FROM esco_occupation_skills os
      JOIN esco_skills s ON s.id = os.skill_id
      WHERE os.occupation_id = $1
    `;
    const params = [occupationId];
    if (relation_type) {
        params.push(relation_type);
        query += ` AND os.relation_type = $${params.length}`;
    }
    query += ` ORDER BY os.relation_type, s.skill_type, s.preferred_label_en`;
    const result = await dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        count: result.rowCount,
    });
}));
/**
 * GET /esco/skill-relations/:skillId
 * Get related skills
 */
router.get('/skill-relations/:skillId', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { skillId } = req.params;
    // First get the skill URI
    const skillResult = await dbClient.query(`SELECT uri FROM esco_skills WHERE id = $1`, [
        skillId,
    ]);
    if (skillResult.rowCount === 0) {
        throw Errors.notFound('Skill', skillId);
    }
    const skillUri = skillResult.rows[0]?.uri;
    // Get related skills
    const result = await dbClient.query(`
      SELECT
        s.id, s.uri, s.skill_type,
        s.preferred_label_en, s.preferred_label_it,
        s.is_digital, s.is_green,
        sr.relation_type
      FROM esco_skill_relations sr
      JOIN esco_skills s ON s.uri = sr.related_skill_uri
      WHERE sr.skill_uri = $1
      ORDER BY sr.relation_type, s.preferred_label_en
    `, [skillUri]);
    res.json({
        success: true,
        data: result.rows,
        count: result.rowCount,
    });
}));
// =============================================================================
// SKILL CLUSTERS & CLASSIFICATIONS
// =============================================================================
/**
 * GET /esco/skill-clusters
 * Get internal skill clusters with mapping statistics
 */
router.get('/skill-clusters', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const result = await dbClient.query(`
      SELECT
        sc.id, sc.code, sc.name_en, sc.name_it,
        sc.description, sc.cluster_level,
        pc.code as parent_code, pc.name_en as parent_name,
        (SELECT COUNT(*) FROM skill_classifications scl WHERE scl.skill_cluster_id = sc.id) as mapped_skills,
        (SELECT ROUND(AVG(scl.confidence_score), 2)
         FROM skill_classifications scl WHERE scl.skill_cluster_id = sc.id) as avg_confidence
      FROM skill_clusters sc
      LEFT JOIN skill_clusters pc ON pc.id = sc.parent_cluster_id
      ORDER BY sc.cluster_level, sc.code
    `);
    res.json({
        success: true,
        data: result.rows,
        count: result.rowCount,
    });
}));
/**
 * GET /esco/skill-clusters/:code
 * Get cluster details with mapped skills
 */
router.get('/skill-clusters/:code', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { code } = req.params;
    const { limit = '50', offset = '0' } = req.query;
    // Get cluster
    const clusterResult = await dbClient.query(`
      SELECT
        sc.id, sc.code, sc.name_en, sc.name_it,
        sc.description, sc.cluster_level,
        pc.code as parent_code, pc.name_en as parent_name
      FROM skill_clusters sc
      LEFT JOIN skill_clusters pc ON pc.id = sc.parent_cluster_id
      WHERE sc.code = $1
    `, [code]);
    if (clusterResult.rowCount === 0) {
        throw Errors.notFound('Cluster', code);
    }
    const cluster = clusterResult.rows[0];
    // Get mapped skills
    const skillsResult = await dbClient.query(`
      SELECT
        s.id, s.preferred_label_en, s.preferred_label_it,
        s.skill_type, s.reuse_level,
        scl.confidence_score, scl.classification_source,
        scl.primary_category, scl.needs_review
      FROM skill_classifications scl
      JOIN esco_skills s ON s.id = scl.esco_skill_id
      WHERE scl.skill_cluster_id = $1
      ORDER BY scl.confidence_score DESC, s.preferred_label_en
      LIMIT $2 OFFSET $3
    `, [
        cluster.id,
        safeParseInt(limit, { fallback: 50 }),
        safeParseInt(offset, { fallback: 0 }),
    ]);
    // Get count
    const countResult = await dbClient.query(`
      SELECT COUNT(*) FROM skill_classifications WHERE skill_cluster_id = $1
    `, [cluster.id]);
    res.json({
        success: true,
        data: {
            ...cluster,
            skills: skillsResult.rows,
        },
        meta: {
            total: parseInt(countResult.rows[0]?.count),
            limit: safeParseInt(limit, { fallback: 50 }),
            offset: safeParseInt(offset, { fallback: 0 }),
        },
    });
}));
/**
 * GET /esco/skill-classifications/:skillId
 * Get classifications for a specific skill
 */
router.get('/skill-classifications/:skillId', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { skillId } = req.params;
    const result = await dbClient.query(`
      SELECT
        scl.id,
        sc.code as cluster_code, sc.name_en as cluster_name, sc.name_it as cluster_name_it,
        pc.code as parent_cluster_code, pc.name_en as parent_cluster_name,
        scl.confidence_score, scl.classification_source,
        scl.primary_category, scl.primary_category_confidence,
        scl.cognitive_level, scl.cognitive_level_label,
        scl.social_dimension, scl.transferability,
        scl.needs_review, scl.review_notes
      FROM skill_classifications scl
      JOIN skill_clusters sc ON sc.id = scl.skill_cluster_id
      LEFT JOIN skill_clusters pc ON pc.id = sc.parent_cluster_id
      WHERE scl.esco_skill_id = $1
      ORDER BY scl.confidence_score DESC
    `, [skillId]);
    res.json({
        success: true,
        data: result.rows,
        count: result.rowCount,
    });
}));
/**
 * GET /esco/classification-stats
 * Get skill classification statistics
 */
router.get('/classification-stats', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const result = await dbClient.query(`
      SELECT
        (SELECT COUNT(*) FROM esco_skills) as total_skills,
        (SELECT COUNT(DISTINCT esco_skill_id) FROM skill_classifications) as mapped_skills,
        (SELECT COUNT(*) FROM skill_classifications) as total_classifications,
        (SELECT COUNT(*) FROM skill_clusters) as total_clusters,
        (SELECT COUNT(*) FROM skill_clusters WHERE cluster_level = 1) as l1_clusters,
        (SELECT COUNT(*) FROM skill_clusters WHERE cluster_level = 2) as l2_clusters,
        (SELECT ROUND(AVG(confidence_score), 2) FROM skill_classifications) as avg_confidence,
        (SELECT COUNT(*) FROM skill_classifications WHERE needs_review = true) as needs_review,
        (SELECT COUNT(*) FROM skill_classifications WHERE confidence_score >= 0.8) as high_confidence,
        (SELECT COUNT(*) FROM skill_classifications WHERE confidence_score >= 0.5 AND confidence_score < 0.8) as medium_confidence,
        (SELECT COUNT(*) FROM skill_classifications WHERE confidence_score < 0.5) as low_confidence
    `);
    res.json({
        success: true,
        data: result.rows[0] || null,
    });
}));
export default router;
//# sourceMappingURL=esco.js.map