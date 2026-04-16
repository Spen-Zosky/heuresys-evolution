/**
 * Career Intelligence API Routes
 * Exposes Knowledge Graph functions (migration 140-142) as REST endpoints.
 * Provides career recommendations, skill gap analysis, transition planning,
 * and semantic skill/occupation search.
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// =============================================================================
// B1: GET /recommendations/:employeeId
// Career recommendations based on current skill profile
// =============================================================================
router.get('/recommendations/:employeeId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params.employeeId;
    const { maxResults = '10' } = req.query;
    if (!UUID_RE.test(employeeId)) {
        throw Errors.badRequest('Invalid employeeId format');
    }
    const dbClient = req.dbClient;
    const data = await cachedForTenant(tenantId, `career:rec:${employeeId}`, async () => {
        // Guard: employee must have at least 2 ESCO-linked skills
        const skillCheck = await dbClient.query(`SELECT count(*) FROM employee_skills WHERE employee_id = $1 AND esco_skill_id IS NOT NULL`, [employeeId]);
        const skillCount = parseInt(skillCheck.rows[0]?.count, 10);
        if (skillCount < 2) {
            return {
                recommendations: [],
                skillCount,
                message: 'Employee needs at least 2 ESCO-linked skills for recommendations',
            };
        }
        const result = await dbClient.query(`SELECT * FROM fn_employee_career_recommendations($1::uuid, $2)`, [employeeId, parseInt(maxResults, 10)]);
        return {
            recommendations: result.rows.map((r) => ({
                occupationId: r.occupation_id,
                occupationLabel: r.occupation_label,
                iscoCode: r.isco_code,
                skillCoverage: parseFloat(r.skill_coverage),
                totalEssential: r.total_essential,
                skillsHeld: r.skills_held,
                skillsMissing: r.skills_missing,
                embeddingMatch: parseFloat(r.embedding_match),
            })),
            skillCount,
        };
    }, CACHE_TTL.MODERATE);
    res.json({ success: true, data });
}));
// =============================================================================
// B2: GET /gap-analysis/:employeeId/:occupationUri
// Skill gap analysis for an employee toward a target occupation
// =============================================================================
router.get('/gap-analysis/:employeeId/:occupationUri', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params.employeeId;
    const occupationUri = decodeURIComponent(req.params.occupationUri);
    const dbClient = req.dbClient;
    if (!UUID_RE.test(employeeId)) {
        throw Errors.badRequest('Invalid employeeId format');
    }
    const data = await cachedForTenant(tenantId, `career:gap:${employeeId}:${uriHash(occupationUri)}`, async () => {
        // Verify occupation exists
        const occCheck = await dbClient.query(`SELECT preferred_label_en FROM esco_occupations WHERE uri = $1`, [occupationUri]);
        if (occCheck.rowCount === 0) {
            throw Errors.notFound('Occupation', occupationUri);
        }
        const result = await dbClient.query(`SELECT * FROM fn_skill_gap_analysis($1::uuid, $2)`, [
            employeeId,
            occupationUri,
        ]);
        const missing = result.rows;
        const total = missing.length;
        const possessedCount = total - missing.filter((r) => r.gap_difficulty !== null).length;
        const readinessPercent = total > 0 ? Math.round((possessedCount / total) * 100) : 0;
        return {
            targetOccupation: occCheck.rows[0]?.preferred_label_en,
            targetUri: occupationUri,
            summary: {
                total,
                possessed: possessedCount,
                missing: total - possessedCount,
                readinessPercent,
            },
            skills: missing.map((r) => ({
                skillId: r.missing_skill_id,
                skillLabel: r.missing_skill_label,
                skillType: r.skill_type,
                relationType: r.relation_type,
                closestExistingSkill: r.closest_existing_skill,
                transferability: r.transferability ? parseFloat(r.transferability) : 0,
                gapDifficulty: r.gap_difficulty,
            })),
        };
    }, CACHE_TTL.MODERATE);
    res.json({ success: true, data });
}));
// =============================================================================
// B3: GET /transition/:sourceUri/:targetUri
// Career transition bridge between two occupations
// =============================================================================
router.get('/transition/:sourceUri/:targetUri', asyncHandler(async (req, res) => {
    const sourceUri = decodeURIComponent(req.params.sourceUri);
    const targetUri = decodeURIComponent(req.params.targetUri);
    const dbClient = req.dbClient;
    const data = await cached(`career:trans:${uriHash(sourceUri)}:${uriHash(targetUri)}`, async () => {
        // Verify both occupations exist
        const srcCheck = await dbClient.query(`SELECT preferred_label_en FROM esco_occupations WHERE uri = $1`, [sourceUri]);
        const tgtCheck = await dbClient.query(`SELECT preferred_label_en FROM esco_occupations WHERE uri = $1`, [targetUri]);
        if (srcCheck.rowCount === 0)
            throw Errors.notFound('Source occupation', sourceUri);
        if (tgtCheck.rowCount === 0)
            throw Errors.notFound('Target occupation', targetUri);
        const result = await dbClient.query(`SELECT * FROM fn_career_transition_bridge($1, $2)`, [
            sourceUri,
            targetUri,
        ]);
        const have = result.rows.filter((r) => r.status === 'HAVE');
        const transferable = result.rows.filter((r) => r.status === 'TRANSFERABLE');
        const learn = result.rows.filter((r) => r.status === 'LEARN');
        const total = result.rows.length;
        const readinessPercent = total > 0 ? Math.round((have.length / total) * 100) : 0;
        const difficulty = readinessPercent >= 70 ? 'easy' : readinessPercent >= 40 ? 'moderate' : 'hard';
        const mapSkill = (r) => ({
            skillLabel: r.skill_label,
            skillType: r.skill_type,
            closestSourceSkill: r.closest_source_skill,
            transferability: r.transferability ? parseFloat(r.transferability) : 0,
            isEssential: r.is_essential,
        });
        return {
            sourceOccupation: srcCheck.rows[0]?.preferred_label_en,
            targetOccupation: tgtCheck.rows[0]?.preferred_label_en,
            readinessPercent,
            difficulty,
            totalSkills: total,
            have: have.map(mapSkill),
            transferable: transferable.map(mapSkill),
            learn: learn.map(mapSkill),
        };
    }, CACHE_TTL.STATIC // 1h — ESCO data is static
    );
    res.json({ success: true, data });
}));
// =============================================================================
// B4: GET /similar-skills/:skillUri
// Find semantically similar skills
// =============================================================================
router.get('/similar-skills/:skillUri', asyncHandler(async (req, res) => {
    const skillUri = decodeURIComponent(req.params.skillUri);
    const { language = 'en', threshold = '0.5', maxResults = '10', } = req.query;
    const dbClient = req.dbClient;
    const data = await cached(`career:simskill:${uriHash(skillUri)}:${language}`, async () => {
        const result = await dbClient.query(`SELECT * FROM fn_find_similar_skills($1, $2, $3::float, $4)`, [skillUri, language, parseFloat(threshold), parseInt(maxResults, 10)]);
        if (result.rowCount === 0) {
            // Check if the skill exists at all
            const exists = await dbClient.query(`SELECT 1 FROM esco_skills WHERE uri = $1`, [
                skillUri,
            ]);
            if (exists.rowCount === 0)
                throw Errors.notFound('Skill', skillUri);
        }
        return result.rows.map((r) => ({
            skillId: r.skill_id,
            uri: r.uri,
            preferredLabel: r.preferred_label,
            skillType: r.skill_type,
            reuseLevel: r.reuse_level,
            similarity: r.similarity ? parseFloat(r.similarity) : 0,
        }));
    }, CACHE_TTL.STATIC);
    res.json({ success: true, data, count: data.length });
}));
// =============================================================================
// B5: GET /matching-occupations?q=text
// Natural language → occupation matching
// =============================================================================
router.get('/matching-occupations', asyncHandler(async (req, res) => {
    const { q, language = 'en', maxResults = '10' } = req.query;
    const dbClient = req.dbClient;
    if (!q || q.length < 2) {
        throw Errors.badRequest('Query parameter "q" is required (min 2 characters)');
    }
    const result = await dbClient.query(`SELECT * FROM fn_find_matching_occupations($1, $2, $3)`, [
        q,
        language,
        parseInt(maxResults, 10),
    ]);
    res.json({
        success: true,
        data: result.rows.map((r) => ({
            occupationId: r.occupation_id,
            uri: r.uri,
            preferredLabel: r.preferred_label,
            iscoCode: r.isco_code,
            similarity: r.similarity ? parseFloat(r.similarity) : 0,
        })),
        count: result.rowCount,
    });
}));
export default router;
//# sourceMappingURL=career-intelligence.js.map