/**
 * Blueprint Standalone — Self-Service Mode (O3.5)
 * GET  /api/v1/blueprint/standalone/industries  — lista profili disponibili
 * POST /api/v1/blueprint/standalone/generate    — genera blueprint in-memory
 *
 * Auth: nessuna. Rate limit: 3 req / 10 min per IP.
 * Usa pool admin (bypassa RLS su blueprint_templates).
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../errors/middleware.js';
import { validate } from '../middleware/validate.js';
import { pool } from '../config/database.js';
import { z } from 'zod';
const router = Router();
// ---------------------------------------------------------------------------
// RATE LIMITER
// ---------------------------------------------------------------------------
const standaloneRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 3 : 1000,
    message: {
        success: false,
        error: 'Limite richieste raggiunto. Riprova tra 10 minuti.',
        code: 'BLUEPRINT_RATE_LIMIT_EXCEEDED',
        retryAfter: 600,
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
});
// ---------------------------------------------------------------------------
// ZOD SCHEMA
// ---------------------------------------------------------------------------
const generateSchema = z.object({
    naceCode: z.string().min(1).max(20),
    companySize: z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']),
    customProcesses: z.array(z.string().min(1).max(200)).max(20).optional(),
});
// ---------------------------------------------------------------------------
// ORG SIZE CONFIG
// ---------------------------------------------------------------------------
const SIZE_CONFIG = {
    MICRO: { headcount: '1–9', departments: 2, layers: 2, label: 'Micro (<10)' },
    SMALL: { headcount: '10–49', departments: 4, layers: 3, label: 'Piccola (10–49)' },
    MEDIUM: { headcount: '50–249', departments: 6, layers: 4, label: 'Media (50–249)' },
    LARGE: { headcount: '250–999', departments: 10, layers: 5, label: 'Grande (250–999)' },
    ENTERPRISE: { headcount: '1000+', departments: 20, layers: 6, label: 'Enterprise (1000+)' },
};
// ---------------------------------------------------------------------------
// GET /industries
// ---------------------------------------------------------------------------
router.get('/industries', asyncHandler(async (_req, res) => {
    const result = await pool.query(`SELECT ip.nace_class_code AS "naceCode",
              ip.company_size_code AS "companySizeCode",
              ip.code AS "profileCode",
              ip.name AS "profileName",
              ic.name_it AS "industryNameIt",
              ic.name_en AS "industryNameEn",
              ic.level AS "naceLevel"
       FROM industry_profiles ip
       JOIN industry_classifications ic ON ic.code = ip.nace_class_code
       WHERE ip.is_active = true
       ORDER BY ic.name_it, ip.company_size_code`);
    res.json({ success: true, data: result.rows });
}));
// ---------------------------------------------------------------------------
// POST /generate
// ---------------------------------------------------------------------------
router.post('/generate', standaloneRateLimiter, validate(generateSchema), asyncHandler(async (req, res) => {
    const { naceCode, companySize, customProcesses } = req.body;
    // 1. Trova il profilo industria (match esatto, fallback stesso NACE qualsiasi size)
    const profileResult = await pool.query(`SELECT ip.id, ip.code, ip.name, ip.nace_class_code, ip.company_size_code,
              ip.typical_hierarchy, ip.typical_roles, ip.typical_departments,
              ip.typical_span_of_control,
              ic.name_it AS "industryNameIt", ic.name_en AS "industryNameEn"
       FROM industry_profiles ip
       JOIN industry_classifications ic ON ic.code = ip.nace_class_code
       WHERE ip.is_active = true
         AND ip.nace_class_code = $1
         AND ip.company_size_code = $2
       LIMIT 1`, [naceCode, companySize]);
    let profile = profileResult.rows[0] ?? null;
    if (!profile) {
        const fallback = await pool.query(`SELECT ip.id, ip.code, ip.name, ip.nace_class_code, ip.company_size_code,
                ip.typical_hierarchy, ip.typical_roles, ip.typical_departments,
                ip.typical_span_of_control,
                ic.name_it AS "industryNameIt", ic.name_en AS "industryNameEn"
         FROM industry_profiles ip
         JOIN industry_classifications ic ON ic.code = ip.nace_class_code
         WHERE ip.is_active = true AND ip.nace_class_code = $1
         LIMIT 1`, [naceCode]);
        profile = fallback.rows[0] ?? null;
    }
    let processes = [];
    let roles = [];
    let skills = [];
    let kpis = [];
    let orgUnits = [];
    if (profile) {
        // 2. Processi del profilo
        const procResult = await pool.query(`SELECT id, process_code AS "processCode", process_name AS "processName",
                process_category AS "processCategory",
                description, value_chain_position AS "valueChainPosition",
                typical_inputs AS "typicalInputs", typical_outputs AS "typicalOutputs"
         FROM business_processes
         WHERE profile_id = $1
         ORDER BY value_chain_position, process_name`, [profile.id]);
        processes = procResult.rows;
        if (processes.length > 0) {
            const processIds = processes.map((p) => p.id);
            // 3. Ruoli
            const roleResult = await pool.query(`SELECT pr.process_id AS "processId", pr.role_name AS "roleName",
                  pr.role_type AS "roleType",
                  pr.min_headcount AS "minHeadcount", pr.max_headcount AS "maxHeadcount",
                  pr.description,
                  eo.preferred_label AS "occupationLabel"
           FROM process_roles pr
           LEFT JOIN esco_occupations eo ON eo.id = pr.esco_occupation_id
           WHERE pr.process_id = ANY($1)
           ORDER BY pr.process_id, pr.role_type`, [processIds]);
            roles = roleResult.rows;
            // 4. KPI
            const kpiResult = await pool.query(`SELECT pk.process_id AS "processId", pk.kpi_code AS "kpiCode",
                  pk.kpi_name AS "kpiName", pk.measurement_unit AS "measurementUnit",
                  pk.target_direction AS "targetDirection",
                  pk.benchmark_value AS "benchmarkValue",
                  pk.description,
                  bp.process_name AS "processName", bp.process_code AS "processCode"
           FROM process_kpis pk
           JOIN business_processes bp ON bp.id = pk.process_id
           WHERE pk.process_id = ANY($1)
           ORDER BY bp.value_chain_position, pk.kpi_name
           LIMIT 30`, [processIds]);
            kpis = kpiResult.rows;
            // 5. Skill
            const skillResult = await pool.query(`SELECT DISTINCT ON (psr.esco_skill_id)
                  psr.process_id AS "processId",
                  psr.proficiency_level AS "proficiencyLevel",
                  psr.is_mandatory AS "isMandatory",
                  es.preferred_label AS "skillName", es.skill_type AS "skillType",
                  bp.process_name AS "processName", bp.process_code AS "processCode"
           FROM process_skill_requirements psr
           JOIN esco_skills es ON es.id = psr.esco_skill_id
           JOIN business_processes bp ON bp.id = psr.process_id
           WHERE psr.process_id = ANY($1)
           ORDER BY psr.esco_skill_id, psr.is_mandatory DESC, psr.proficiency_level DESC
           LIMIT 30`, [processIds]);
            skills = skillResult.rows;
        }
        // 6. Org unit templates (pool admin bypassa RLS su blueprint_templates)
        const templateResult = await pool.query(`SELECT id FROM blueprint_templates
         WHERE profile_id = $1 AND is_active = true
         ORDER BY created_at LIMIT 1`, [profile.id]);
        if (templateResult.rows.length > 0) {
            const ouResult = await pool.query(`SELECT code, name_it AS "nameIt", name_en AS "nameEn",
                  depth, level, level_name AS "levelName",
                  nature, is_line AS "isLine", is_management AS "isManagement"
           FROM org_unit_templates
           WHERE template_id = $1
           ORDER BY depth, sort_order`, [templateResult.rows[0]?.id]);
            orgUnits = ouResult.rows;
        }
    }
    // 7. Processi custom
    const customList = (customProcesses ?? []).map((name, i) => ({
        id: `custom-${i}`,
        processCode: `CUSTOM-${String(i + 1).padStart(3, '0')}`,
        processName: name,
        processCategory: 'custom',
        description: null,
        valueChainPosition: 99 + i,
        typicalInputs: [],
        typicalOutputs: [],
    }));
    res.json({
        success: true,
        data: {
            meta: {
                naceCode,
                companySize,
                orgConfig: SIZE_CONFIG[companySize],
                industry: profile
                    ? { nameIt: profile['industryNameIt'], nameEn: profile['industryNameEn'] }
                    : null,
                profile: profile ? { name: profile.name, code: profile.code } : null,
                generatedAt: new Date().toISOString(),
                matchedExact: !!profileResult.rows[0],
            },
            processes: [...processes, ...customList],
            roles,
            skills,
            kpis,
            orgUnits,
            typicalStructure: profile?.typical_hierarchy ?? null,
            typicalRoles: profile?.typical_roles ?? [],
            typicalDepartments: profile?.typical_departments ?? [],
        },
    });
}));
export default router;
//# sourceMappingURL=blueprint-standalone.js.map