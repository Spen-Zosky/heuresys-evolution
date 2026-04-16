/**
 * Organization Intelligence API Routes
 * Exposes organizational skill intelligence, occupation similarity,
 * and concentration risk analysis endpoints.
 */
import { Router } from 'express';
import { cached, cachedForTenant, CACHE_TTL } from '../services/cache.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { getTenantIdOrThrow } from '../middleware/tenantContext.js';
import crypto from 'crypto';
const router = Router();
function uriHash(uri) {
    return crypto.createHash('md5').update(uri).digest('hex').slice(0, 12);
}
// =============================================================================
// C1: GET /skill-intelligence
// Organizational skill distribution, penetration, and risk assessment
// =============================================================================
router.get('/skill-intelligence', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const tenantCode = req.tenantCode;
    const dbClient = req.dbClient;
    const data = await cachedForTenant(tenantId, 'org:intel', async () => {
        const result = await dbClient.query(`SELECT skill_label, skill_type, reuse_level,
                  employees_with_skill, avg_proficiency,
                  round(penetration_rate::numeric, 4) AS penetration_rate,
                  open_demand, risk_level
           FROM vw_organizational_skill_intelligence
           WHERE tenant_code = $1
           ORDER BY employees_with_skill DESC`, [tenantCode]);
        const summary = {
            totalSkills: result.rowCount,
            critical: result.rows.filter((r) => r.risk_level === 'CRITICAL_GAP').length,
            scarce: result.rows.filter((r) => r.risk_level === 'SCARCE')
                .length,
            healthy: result.rows.filter((r) => r.risk_level === 'HEALTHY')
                .length,
            widespread: result.rows.filter((r) => r.risk_level === 'WIDESPREAD').length,
        };
        return {
            summary,
            skills: result.rows.map((r) => ({
                skillLabel: r.skill_label,
                skillType: r.skill_type,
                reuseLevel: r.reuse_level,
                employeesWithSkill: parseInt(r.employees_with_skill, 10),
                avgProficiency: r.avg_proficiency ? parseFloat(r.avg_proficiency) : null,
                penetrationRate: parseFloat(r.penetration_rate),
                openDemand: parseInt(r.open_demand, 10),
                riskLevel: r.risk_level,
            })),
        };
    }, CACHE_TTL.REFERENCE);
    res.json({ success: true, data });
}));
// =============================================================================
// C2: GET /similar-occupations/:occupationUri
// Find similar occupations from pre-computed materialized view
// =============================================================================
router.get('/similar-occupations/:occupationUri', asyncHandler(async (req, res) => {
    const occupationUri = decodeURIComponent(req.params.occupationUri);
    const { maxResults = '10' } = req.query;
    const dbClient = req.dbClient;
    const data = await cached(`org:simocc:${uriHash(occupationUri)}`, async () => {
        // Find occupation ID
        const occResult = await dbClient.query(`SELECT id, preferred_label_en FROM esco_occupations WHERE uri = $1`, [occupationUri]);
        if (occResult.rowCount === 0)
            throw Errors.notFound('Occupation', occupationUri);
        const occId = occResult.rows[0]?.id;
        const limit = parseInt(maxResults, 10);
        const result = await dbClient.query(`SELECT
             CASE WHEN occ_a_id = $1 THEN label_b ELSE label_a END AS occupation_label,
             CASE WHEN occ_a_id = $1 THEN isco_b ELSE isco_a END AS isco_code,
             CASE WHEN occ_a_id = $1 THEN occ_b_id ELSE occ_a_id END AS occupation_id,
             round(embedding_similarity::numeric, 4) AS embedding_similarity,
             round(skill_overlap_ratio::numeric, 4) AS skill_overlap,
             round(combined_score::numeric, 4) AS combined_score
           FROM mv_occupation_similarity
           WHERE occ_a_id = $1 OR occ_b_id = $1
           ORDER BY combined_score DESC
           LIMIT $2`, [occId, limit]);
        return {
            occupation: occResult.rows[0]?.preferred_label_en,
            uri: occupationUri,
            similarOccupations: result.rows.map((r) => ({
                occupationId: r.occupation_id,
                occupationLabel: r.occupation_label,
                iscoCode: r.isco_code,
                embeddingSimilarity: parseFloat(r.embedding_similarity),
                skillOverlap: parseFloat(r.skill_overlap),
                combinedScore: parseFloat(r.combined_score),
            })),
        };
    }, CACHE_TTL.STATIC);
    res.json({ success: true, data });
}));
// =============================================================================
// C3: GET /concentration-risk
// Skill concentration risk: single points of failure in the workforce
// =============================================================================
router.get('/concentration-risk', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient;
    const data = await cachedForTenant(tenantId, 'org:risk', async () => {
        // Total employees in tenant
        const empCount = await dbClient.query(`SELECT count(*) FROM employees WHERE tenant_id = $1 AND deleted_at IS NULL`, [tenantId]);
        const totalEmployees = parseInt(empCount.rows[0]?.count, 10);
        // Skills with holder counts and names
        const result = await dbClient.query(`SELECT
             COALESCE(s.preferred_label_en, es.custom_skill_name) AS skill_label,
             s.skill_type,
             count(DISTINCT es.employee_id) AS employee_count,
             array_agg(DISTINCT e.first_name || ' ' || e.last_name ORDER BY e.first_name || ' ' || e.last_name) AS holders
           FROM employee_skills es
           JOIN employees e ON e.id = es.employee_id AND e.deleted_at IS NULL
           LEFT JOIN esco_skills s ON s.id = es.esco_skill_id
           WHERE es.tenant_id = $1
           GROUP BY COALESCE(s.preferred_label_en, es.custom_skill_name), s.skill_type
           ORDER BY count(DISTINCT es.employee_id) ASC`, [tenantId]);
        const risks = result.rows.map((r) => {
            const empCnt = parseInt(r.employee_count, 10);
            const penetration = totalEmployees > 0 ? empCnt / totalEmployees : 0;
            let riskLevel;
            if (empCnt <= 2)
                riskLevel = 'critical';
            else if (empCnt <= 4 || penetration < 0.05)
                riskLevel = 'high';
            else if (penetration < 0.1)
                riskLevel = 'moderate';
            else
                riskLevel = 'healthy';
            return {
                skillLabel: r.skill_label,
                skillType: r.skill_type,
                employeeCount: empCnt,
                penetrationRate: Math.round(penetration * 10000) / 10000,
                riskLevel,
                holders: r.holders.slice(0, 10), // limit to 10 names
            };
        });
        const summary = {
            totalEmployees,
            totalSkills: risks.length,
            critical: risks.filter((r) => r.riskLevel === 'critical').length,
            high: risks.filter((r) => r.riskLevel === 'high').length,
            moderate: risks.filter((r) => r.riskLevel === 'moderate').length,
            healthy: risks.filter((r) => r.riskLevel === 'healthy').length,
        };
        return {
            summary,
            risks: risks.filter((r) => r.riskLevel !== 'healthy'),
        };
    }, CACHE_TTL.REFERENCE);
    res.json({ success: true, data });
}));
export default router;
//# sourceMappingURL=organization-intelligence.js.map