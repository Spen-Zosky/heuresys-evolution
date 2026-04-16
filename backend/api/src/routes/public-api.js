/**
 * Public REST API v1 — read-only endpoints
 * Horizon O2.4
 *
 * Auth: X-API-Key (requirePublicApiKey middleware)
 * All queries use req.dbClient (RLS-scoped via appPool)
 */
import { Router } from 'express';
import { asyncHandler } from '../errors/middleware.js';
import { safeParseInt } from '../utils/query-helpers.js';
import { pool } from '../config/database.js';
const router = Router();
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function paginationParams(query) {
    return {
        limit: Math.min(safeParseInt(query.limit, { fallback: 50 }), 100),
        offset: safeParseInt(query.offset, { fallback: 0 }),
    };
}
function buildMeta(total, limit, offset) {
    return { total, limit, offset, hasMore: offset + limit < total };
}
// ---------------------------------------------------------------------------
// 5.1  GET /processes
// ---------------------------------------------------------------------------
router.get('/processes', asyncHandler(async (req, res) => {
    const { limit, offset } = paginationParams(req.query);
    const client = req.dbClient;
    const [dataResult, countResult] = await Promise.all([
        client.query(`SELECT id, process_code, process_name, process_category, description,
                value_chain_position, created_at, updated_at
         FROM business_processes
         ORDER BY process_name
         LIMIT $1 OFFSET $2`, [limit, offset]),
        client.query('SELECT COUNT(*)::int AS total FROM business_processes'),
    ]);
    res.json({
        success: true,
        data: dataResult.rows,
        meta: buildMeta(countResult.rows[0]?.total, limit, offset),
    });
}));
// ---------------------------------------------------------------------------
// 5.2  GET /processes/:id
// ---------------------------------------------------------------------------
router.get('/processes/:id', asyncHandler(async (req, res) => {
    const client = req.dbClient;
    const { id } = req.params;
    const processResult = await client.query(`SELECT id, process_code, process_name, process_category, description,
              value_chain_position, created_at, updated_at
       FROM business_processes WHERE id = $1`, [id]);
    if (processResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Process not found' });
        return;
    }
    const [phases, roles, skillReqs] = await Promise.all([
        client.query(`SELECT id, phase_code, phase_name, phase_order, description,
                estimated_duration_days, is_optional
         FROM process_phases WHERE process_id = $1 ORDER BY phase_order`, [id]),
        client.query(`SELECT pr.id, pr.role_name, pr.role_type, pr.phase_id, pr.min_headcount,
                pr.max_headcount, pr.description, pr.esco_occupation_id,
                eo.preferred_label AS esco_occupation_name
         FROM process_roles pr
         LEFT JOIN esco_occupations eo ON eo.id = pr.esco_occupation_id
         WHERE pr.process_id = $1`, [id]),
        client.query(`SELECT psr.id, psr.phase_id, psr.esco_skill_id, psr.proficiency_level,
                psr.is_mandatory, psr.description,
                es.preferred_label AS esco_skill_name
         FROM process_skill_requirements psr
         LEFT JOIN esco_skills es ON es.id = psr.esco_skill_id
         WHERE psr.process_id = $1`, [id]),
    ]);
    res.json({
        success: true,
        data: {
            ...(processResult.rows[0] || {}),
            phases: phases.rows,
            roles: roles.rows,
            skillRequirements: skillReqs.rows,
        },
    });
}));
// ---------------------------------------------------------------------------
// 5.3  GET /org-units
// ---------------------------------------------------------------------------
router.get('/org-units', asyncHandler(async (req, res) => {
    const { limit, offset } = paginationParams(req.query);
    const client = req.dbClient;
    const [dataResult, countResult] = await Promise.all([
        client.query(`SELECT id, parent_id, code, name, org_type, org_level, is_active
         FROM org_units
         ORDER BY org_level, name
         LIMIT $1 OFFSET $2`, [limit, offset]),
        client.query('SELECT COUNT(*)::int AS total FROM org_units'),
    ]);
    res.json({
        success: true,
        data: dataResult.rows,
        meta: buildMeta(countResult.rows[0]?.total, limit, offset),
    });
}));
// ---------------------------------------------------------------------------
// 5.4  GET /org-units/:id/skills
// ---------------------------------------------------------------------------
router.get('/org-units/:id/skills', asyncHandler(async (req, res) => {
    const { limit, offset } = paginationParams(req.query);
    const client = req.dbClient;
    const { id } = req.params;
    const [dataResult, countResult] = await Promise.all([
        client.query(`SELECT es.id, es.preferred_label, es.description, es.skill_type,
                COUNT(DISTINCT esp.employee_id)::int AS employee_count,
                ROUND(AVG(esp.composite_score), 2) AS avg_proficiency
         FROM employee_skill_profiles esp
         JOIN esco_skills es ON es.id = esp.skill_id
         JOIN employees e ON e.id = esp.employee_id
         WHERE e.org_unit_id = $1
         GROUP BY es.id, es.preferred_label, es.description, es.skill_type
         ORDER BY employee_count DESC
         LIMIT $2 OFFSET $3`, [id, limit, offset]),
        client.query(`SELECT COUNT(DISTINCT es.id)::int AS total
         FROM employee_skill_profiles esp
         JOIN esco_skills es ON es.id = esp.skill_id
         JOIN employees e ON e.id = esp.employee_id
         WHERE e.org_unit_id = $1`, [id]),
    ]);
    res.json({
        success: true,
        data: dataResult.rows,
        meta: buildMeta(countResult.rows[0]?.total, limit, offset),
    });
}));
// ---------------------------------------------------------------------------
// 5.5  GET /blueprint/runs
// ---------------------------------------------------------------------------
router.get('/blueprint/runs', asyncHandler(async (req, res) => {
    const { limit, offset } = paginationParams(req.query);
    const client = req.dbClient;
    const [dataResult, countResult] = await Promise.all([
        client.query(`SELECT id, template_id, run_mode, status, started_at, completed_at, created_at
         FROM blueprint_runs
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`, [limit, offset]),
        client.query('SELECT COUNT(*)::int AS total FROM blueprint_runs'),
    ]);
    res.json({
        success: true,
        data: dataResult.rows,
        meta: buildMeta(countResult.rows[0]?.total, limit, offset),
    });
}));
// ---------------------------------------------------------------------------
// 5.6  GET /blueprint/runs/:id/results
// ---------------------------------------------------------------------------
router.get('/blueprint/runs/:id/results', asyncHandler(async (req, res) => {
    const { limit, offset } = paginationParams(req.query);
    const client = req.dbClient;
    const { id } = req.params;
    const { result_type, severity } = req.query;
    let where = 'WHERE br.run_id = $1';
    const params = [id];
    let paramIdx = 2;
    if (result_type) {
        where += ` AND br.result_type = $${paramIdx++}`;
        params.push(result_type);
    }
    if (severity) {
        where += ` AND br.severity = $${paramIdx++}`;
        params.push(severity);
    }
    const [dataResult, countResult] = await Promise.all([
        client.query(`SELECT br.id, br.result_type, br.severity, br.title, br.description,
                br.suggested_action, br.created_at
         FROM blueprint_results br
         ${where}
         ORDER BY br.severity, br.created_at
         LIMIT $${paramIdx++} OFFSET $${paramIdx}`, [...params, limit, offset]),
        client.query(`SELECT COUNT(*)::int AS total FROM blueprint_results br ${where}`, params),
    ]);
    res.json({
        success: true,
        data: dataResult.rows,
        meta: buildMeta(countResult.rows[0]?.total, limit, offset),
    });
}));
// ---------------------------------------------------------------------------
// 5.7  GET /skills/search?q=
// ---------------------------------------------------------------------------
router.get('/skills/search', asyncHandler(async (req, res) => {
    const { limit, offset } = paginationParams(req.query);
    const q = (req.query.q || '').trim();
    if (!q) {
        res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
        return;
    }
    // esco_skills is global (no tenant_id), use admin pool for performance
    const [dataResult, countResult] = await Promise.all([
        pool.query(`SELECT id, preferred_label, description, skill_type, reuse_level
         FROM esco_skills
         WHERE preferred_label ILIKE '%' || $1 || '%'
            OR description ILIKE '%' || $1 || '%'
         ORDER BY
           CASE WHEN preferred_label ILIKE $1 THEN 0
                WHEN preferred_label ILIKE $1 || '%' THEN 1
                ELSE 2 END,
           preferred_label
         LIMIT $2 OFFSET $3`, [q, limit, offset]),
        pool.query(`SELECT COUNT(*)::int AS total FROM esco_skills
         WHERE preferred_label ILIKE '%' || $1 || '%'
            OR description ILIKE '%' || $1 || '%'`, [q]),
    ]);
    res.json({
        success: true,
        data: dataResult.rows,
        meta: buildMeta(countResult.rows[0]?.total, limit, offset),
    });
}));
// ---------------------------------------------------------------------------
// 5.8  GET /skills/:id
// ---------------------------------------------------------------------------
router.get('/skills/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    // esco_skills is global — admin pool
    const result = await pool.query(`SELECT id, preferred_label, alt_labels, description, skill_type,
              reuse_level, uri, created_at
       FROM esco_skills WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Skill not found' });
        return;
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
export default router;
//# sourceMappingURL=public-api.js.map