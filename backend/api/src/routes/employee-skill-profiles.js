/**
 * Employee Skill Profiles API Routes
 * Epic: E-ONTO-03 (Business Applications)
 * Story: S-ONTO-03-02 (Employee Skill Profile API)
 *
 * Mounted at: /api/v1/employee-skill-profiles
 *
 * Endpoints:
 * - GET /employee-skill-profiles/:id - Get complete skill profile
 * - PUT /employee-skill-profiles/:id - Update skill levels
 * - POST /employee-skill-profiles/:id/declare - Declare a new skill
 * - GET /employee-skill-profiles/:id/history - Get skill history
 * - GET /employee-skill-profiles/:id/pending - Get pending verifications
 */
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { updateSkillProfileSchema, declareSkillSchema } from '../schemas/hr-operations.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
// =============================================================================
// GET /employee-skill-profiles/:id
// Get complete skill profile with KSABA dimensions
// =============================================================================
router.get('/:id', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { id: employeeId } = req.params;
    const { includeHistory = 'false', includeSkillDetails = 'true' } = req.query;
    // Get employee info (always scoped by tenant)
    const tenantId = getTenantIdOrThrow(req);
    const employeeResult = await dbClient.query(`SELECT id, first_name, last_name, job_title, org_unit_id, tenant_id FROM employees WHERE id = $1 AND tenant_id = $2`, [employeeId, tenantId]);
    if (employeeResult.rows.length === 0) {
        throw Errors.notFound('Employee', employeeId);
    }
    const employee = employeeResult.rows[0];
    // Get skill profile with ESCO skill details
    let skillQuery = `
      SELECT
        esp.id,
        esp.skill_id,
        esp.knowledge_level,
        esp.skill_level,
        esp.ability_level,
        esp.behavior_level,
        esp.attitude_level,
        esp.composite_score,
        esp.source,
        esp.source_description,
        esp.acquired_date,
        esp.last_demonstrated,
        esp.evidence_type,
        esp.evidence_id,
        esp.evidence_url,
        esp.verification_status,
        esp.verified_by,
        esp.verified_at,
        esp.confidence_score,
        esp.is_primary,
        esp.is_target,
        esp.target_level,
        esp.created_at,
        esp.updated_at
    `;
    if (includeSkillDetails === 'true') {
        skillQuery += `,
        es.preferred_label_en as skill_name,
        es.preferred_label_it as skill_name_it,
        es.description_en as skill_description,
        es.skill_type,
        es.reuse_level,
        esg.preferred_label_en as skill_group
      `;
    }
    skillQuery += `
      FROM employee_skill_profiles esp
      JOIN esco_skills es ON esp.skill_id = es.id
      LEFT JOIN esco_skill_groups esg ON es.skill_group_uri = esg.uri
      WHERE esp.employee_id = $1
      ORDER BY esp.is_primary DESC, esp.composite_score DESC
    `;
    const skillsResult = await dbClient.query(skillQuery, [employeeId]);
    // Get summary statistics
    const summaryResult = await dbClient.query(`
      SELECT
        COUNT(*) as total_skills,
        COUNT(*) FILTER (WHERE verification_status = 'verified') as verified_skills,
        COUNT(*) FILTER (WHERE verification_status = 'pending') as pending_skills,
        ROUND(AVG(composite_score), 2) as avg_composite_score,
        MAX(composite_score) as max_composite_score,
        COUNT(*) FILTER (WHERE is_primary) as primary_skills,
        COUNT(*) FILTER (WHERE is_target) as target_skills
      FROM employee_skill_profiles
      WHERE employee_id = $1
    `, [employeeId]);
    const summary = summaryResult.rows[0];
    // Format skills with KSABA breakdown
    const skills = skillsResult.rows.map((row) => ({
        id: row.id,
        skillId: row.skill_id,
        ...(includeSkillDetails === 'true' && {
            skillName: row.skill_name,
            skillNameIt: row.skill_name_it,
            skillDescription: row.skill_description,
            skillType: row.skill_type,
            skillGroup: row.skill_group,
        }),
        ksaba: {
            knowledge: row.knowledge_level,
            skill: row.skill_level,
            ability: row.ability_level,
            behavior: row.behavior_level,
            attitude: row.attitude_level,
        },
        compositeScore: parseFloat(row.composite_score),
        source: row.source,
        sourceDescription: row.source_description,
        acquiredDate: row.acquired_date,
        lastDemonstrated: row.last_demonstrated,
        evidence: row.evidence_type
            ? {
                type: row.evidence_type,
                id: row.evidence_id,
                url: row.evidence_url,
            }
            : null,
        verification: {
            status: row.verification_status,
            verifiedBy: row.verified_by,
            verifiedAt: row.verified_at,
        },
        confidence: parseFloat(row.confidence_score),
        isPrimary: row.is_primary,
        isTarget: row.is_target,
        targetLevel: row.target_level,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));
    // Optionally include history
    let history;
    if (includeHistory === 'true' && skills.length > 0) {
        const profileIds = skills.map((s) => s.id);
        const historyResult = await dbClient.query(`
        SELECT
          esh.profile_id,
          esh.previous_composite_score,
          esh.new_composite_score,
          esh.change_type,
          esh.change_reason,
          esh.changed_at,
          e.first_name || ' ' || e.last_name as changed_by_name
        FROM employee_skill_history esh
        LEFT JOIN employees e ON esh.changed_by = e.id
        WHERE esh.profile_id = ANY($1)
        ORDER BY esh.changed_at DESC
        LIMIT 50
      `, [profileIds]);
        history = historyResult.rows;
    }
    res.json({
        success: true,
        data: {
            employee: {
                id: employee.id,
                name: `${employee.first_name} ${employee.last_name}`,
                jobTitle: employee.job_title,
                orgUnitId: employee.org_unit_id,
            },
            summary: {
                totalSkills: parseInt(summary.total_skills),
                verifiedSkills: parseInt(summary.verified_skills),
                pendingSkills: parseInt(summary.pending_skills),
                avgCompositeScore: summary.avg_composite_score
                    ? parseFloat(summary.avg_composite_score)
                    : 0,
                maxCompositeScore: summary.max_composite_score
                    ? parseFloat(summary.max_composite_score)
                    : 0,
                primarySkills: parseInt(summary.primary_skills),
                targetSkills: parseInt(summary.target_skills),
            },
            skills,
            ...(history && { history }),
        },
    });
}));
// =============================================================================
// PUT /employee-skill-profiles/:id
// Update skill levels (bulk update)
// =============================================================================
router.put('/:id', validate(updateSkillProfileSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { id: employeeId } = req.params;
    const { skills } = req.body;
    if (!Array.isArray(skills) || skills.length === 0) {
        throw Errors.badRequest('skills array is required');
    }
    // Verify employee exists (always scoped by tenant)
    const tenantId = getTenantIdOrThrow(req);
    const employeeResult = await dbClient.query('SELECT id FROM employees WHERE id = $1 AND tenant_id = $2', [employeeId, tenantId]);
    if (employeeResult.rows.length === 0) {
        throw Errors.notFound('Employee', employeeId);
    }
    const errors = [];
    // Validate and collect valid skills for batch upsert
    const validSkills = [];
    for (const skill of skills) {
        const { skillId } = skill;
        if (!skillId) {
            errors.push({ skillId: 'unknown', error: 'skillId is required' });
            continue;
        }
        validSkills.push({
            skillId,
            knowledge: skill.knowledge,
            skillLevel: skill.skill,
            ability: skill.ability,
            behavior: skill.behavior,
            attitude: skill.attitude,
            isPrimary: skill.isPrimary,
            isTarget: skill.isTarget,
            targetLevel: skill.targetLevel,
        });
    }
    // Batch upsert all valid skills in a single query using UNNEST
    let updated = [];
    if (validSkills.length > 0) {
        const tenantIds = validSkills.map(() => tenantId);
        const employeeIds = validSkills.map(() => employeeId);
        const skillIds = validSkills.map((s) => s.skillId);
        const knowledgeLevels = validSkills.map((s) => s.knowledge ?? null);
        const skillLevels = validSkills.map((s) => s.skillLevel ?? null);
        const abilityLevels = validSkills.map((s) => s.ability ?? null);
        const behaviorLevels = validSkills.map((s) => s.behavior ?? null);
        const attitudeLevels = validSkills.map((s) => s.attitude ?? null);
        const isPrimaryFlags = validSkills.map((s) => s.isPrimary ?? null);
        const isTargetFlags = validSkills.map((s) => s.isTarget ?? null);
        const targetLevels = validSkills.map((s) => s.targetLevel ?? null);
        try {
            const result = await dbClient.query(`
          INSERT INTO employee_skill_profiles (
            tenant_id, employee_id, skill_id,
            knowledge_level, skill_level, ability_level, behavior_level, attitude_level,
            is_primary, is_target, target_level,
            source
          )
          SELECT
            t.tenant_id, t.employee_id, t.skill_id,
            t.knowledge_level, t.skill_level, t.ability_level,
            t.behavior_level, t.attitude_level,
            t.is_primary, t.is_target, t.target_level,
            'self_declaration'
          FROM UNNEST(
            $1::uuid[], $2::uuid[], $3::uuid[],
            $4::numeric[], $5::numeric[], $6::numeric[],
            $7::numeric[], $8::numeric[],
            $9::boolean[], $10::boolean[], $11::numeric[]
          ) AS t(
            tenant_id, employee_id, skill_id,
            knowledge_level, skill_level, ability_level,
            behavior_level, attitude_level,
            is_primary, is_target, target_level
          )
          ON CONFLICT (tenant_id, employee_id, skill_id)
          DO UPDATE SET
            knowledge_level = COALESCE(EXCLUDED.knowledge_level, employee_skill_profiles.knowledge_level),
            skill_level = COALESCE(EXCLUDED.skill_level, employee_skill_profiles.skill_level),
            ability_level = COALESCE(EXCLUDED.ability_level, employee_skill_profiles.ability_level),
            behavior_level = COALESCE(EXCLUDED.behavior_level, employee_skill_profiles.behavior_level),
            attitude_level = COALESCE(EXCLUDED.attitude_level, employee_skill_profiles.attitude_level),
            is_primary = COALESCE(EXCLUDED.is_primary, employee_skill_profiles.is_primary),
            is_target = COALESCE(EXCLUDED.is_target, employee_skill_profiles.is_target),
            target_level = COALESCE(EXCLUDED.target_level, employee_skill_profiles.target_level),
            updated_at = NOW()
          RETURNING skill_id
        `, [
                tenantIds,
                employeeIds,
                skillIds,
                knowledgeLevels,
                skillLevels,
                abilityLevels,
                behaviorLevels,
                attitudeLevels,
                isPrimaryFlags,
                isTargetFlags,
                targetLevels,
            ]);
            updated = result.rows.map((r) => r.skill_id);
        }
        catch (err) {
            const error = err;
            // If the batch fails, report error for all skills in this batch
            for (const s of validSkills) {
                errors.push({ skillId: s.skillId, error: error.message });
            }
        }
    }
    res.json({
        success: true,
        data: {
            updated: updated.length,
            errors: errors.length,
            updatedSkillIds: updated,
            ...(errors.length > 0 && { errorDetails: errors }),
        },
    });
}));
// =============================================================================
// POST /employee-skill-profiles/:id/declare
// Declare a new skill
// =============================================================================
router.post('/:id/declare', validate(declareSkillSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { id: employeeId } = req.params;
    const { skillId, knowledge = 0, skill = 0, ability = 0, behavior = 0, attitude = 0, sourceDescription, acquiredDate, evidenceType, evidenceId, evidenceUrl, evidenceNotes, isPrimary = false, isTarget = false, targetLevel, } = req.body;
    if (!skillId) {
        throw Errors.badRequest('skillId is required');
    }
    // Validate skill exists
    const skillResult = await dbClient.query('SELECT id, preferred_label_en FROM esco_skills WHERE id = $1', [skillId]);
    if (skillResult.rows.length === 0) {
        throw Errors.notFound('Skill', skillId);
    }
    // Get employee (always scoped by tenant)
    const tenantId = getTenantIdOrThrow(req);
    const employeeResult = await dbClient.query('SELECT id FROM employees WHERE id = $1 AND tenant_id = $2', [employeeId, tenantId]);
    if (employeeResult.rows.length === 0) {
        throw Errors.notFound('Employee', employeeId);
    }
    // Insert the skill declaration
    const result = await dbClient.query(`
      INSERT INTO employee_skill_profiles (
        tenant_id, employee_id, skill_id,
        knowledge_level, skill_level, ability_level, behavior_level, attitude_level,
        source, source_description, acquired_date,
        evidence_type, evidence_id, evidence_url, evidence_notes,
        is_primary, is_target, target_level,
        verification_status
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7, $8,
        'self_declaration', $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17,
        'pending'
      )
      ON CONFLICT (tenant_id, employee_id, skill_id)
      DO UPDATE SET
        knowledge_level = $4,
        skill_level = $5,
        ability_level = $6,
        behavior_level = $7,
        attitude_level = $8,
        source_description = COALESCE($9, employee_skill_profiles.source_description),
        acquired_date = COALESCE($10, employee_skill_profiles.acquired_date),
        verification_status = 'pending',
        updated_at = NOW()
      RETURNING id, composite_score, verification_status
    `, [
        tenantId,
        employeeId,
        skillId,
        knowledge,
        skill,
        ability,
        behavior,
        attitude,
        sourceDescription,
        acquiredDate,
        evidenceType,
        evidenceId,
        evidenceUrl,
        evidenceNotes,
        isPrimary,
        isTarget,
        targetLevel,
    ]);
    const profile = result.rows[0];
    res.status(201).json({
        success: true,
        data: {
            profileId: profile.id,
            skillId,
            skillName: skillResult.rows[0]?.preferred_label_en,
            compositeScore: parseFloat(profile.composite_score),
            verificationStatus: profile.verification_status,
            message: 'Skill declared successfully. Pending manager verification.',
        },
    });
}));
// =============================================================================
// GET /employee-skill-profiles/:id/history
// Get skill change history
// =============================================================================
router.get('/:id/history', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { id: employeeId } = req.params;
    const { skillId, limit = '50', offset = '0' } = req.query;
    const tenantId = getTenantIdOrThrow(req);
    let query = `
      SELECT
        esh.id,
        esh.profile_id,
        esp.skill_id,
        es.preferred_label_en as skill_name,
        esh.previous_knowledge_level,
        esh.previous_skill_level,
        esh.previous_ability_level,
        esh.previous_behavior_level,
        esh.previous_attitude_level,
        esh.previous_composite_score,
        esh.new_knowledge_level,
        esh.new_skill_level,
        esh.new_ability_level,
        esh.new_behavior_level,
        esh.new_attitude_level,
        esh.new_composite_score,
        esh.change_type,
        esh.change_reason,
        esh.changed_at,
        e.first_name || ' ' || e.last_name as changed_by_name
      FROM employee_skill_history esh
      JOIN employee_skill_profiles esp ON esh.profile_id = esp.id
      JOIN esco_skills es ON esp.skill_id = es.id
      LEFT JOIN employees e ON esh.changed_by = e.id
      WHERE esp.employee_id = $1
        AND esp.tenant_id = $2
    `;
    const params = [employeeId, tenantId];
    let paramIndex = 3;
    if (skillId) {
        query += ` AND esp.skill_id = $${paramIndex++}`;
        params.push(skillId);
    }
    query += ` ORDER BY esh.changed_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await dbClient.query(query, params);
    res.json({
        success: true,
        data: {
            history: result.rows.map((row) => ({
                id: row.id,
                skillId: row.skill_id,
                skillName: row.skill_name,
                previous: {
                    ksaba: {
                        knowledge: row.previous_knowledge_level,
                        skill: row.previous_skill_level,
                        ability: row.previous_ability_level,
                        behavior: row.previous_behavior_level,
                        attitude: row.previous_attitude_level,
                    },
                    compositeScore: row.previous_composite_score
                        ? parseFloat(row.previous_composite_score)
                        : null,
                },
                new: {
                    ksaba: {
                        knowledge: row.new_knowledge_level,
                        skill: row.new_skill_level,
                        ability: row.new_ability_level,
                        behavior: row.new_behavior_level,
                        attitude: row.new_attitude_level,
                    },
                    compositeScore: row.new_composite_score ? parseFloat(row.new_composite_score) : null,
                },
                changeType: row.change_type,
                changeReason: row.change_reason,
                changedAt: row.changed_at,
                changedByName: row.changed_by_name,
            })),
            meta: {
                total: safeParseInt(offset, { fallback: 0 }) + result.rows.length,
                limit: safeParseInt(limit, { fallback: 50 }),
                offset: safeParseInt(offset, { fallback: 0 }),
                hasMore: result.rows.length === safeParseInt(limit, { fallback: 50 }),
            },
        },
    });
}));
// =============================================================================
// GET /employee-skill-profiles/:id/pending
// Get skills pending verification
// =============================================================================
router.get('/:id/pending', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { id: employeeId } = req.params;
    const tenantId = getTenantIdOrThrow(req);
    const result = await dbClient.query(`
      SELECT
        esp.id,
        esp.skill_id,
        es.preferred_label_en as skill_name,
        es.skill_type,
        esp.knowledge_level,
        esp.skill_level,
        esp.ability_level,
        esp.behavior_level,
        esp.attitude_level,
        esp.composite_score,
        esp.source,
        esp.source_description,
        esp.evidence_type,
        esp.evidence_url,
        esp.created_at
      FROM employee_skill_profiles esp
      JOIN esco_skills es ON esp.skill_id = es.id
      WHERE esp.employee_id = $1
        AND esp.tenant_id = $2
        AND esp.verification_status = 'pending'
      ORDER BY esp.created_at DESC
    `, [employeeId, tenantId]);
    res.json({
        success: true,
        data: {
            pending: result.rows.map((row) => ({
                profileId: row.id,
                skillId: row.skill_id,
                skillName: row.skill_name,
                skillType: row.skill_type,
                ksaba: {
                    knowledge: row.knowledge_level,
                    skill: row.skill_level,
                    ability: row.ability_level,
                    behavior: row.behavior_level,
                    attitude: row.attitude_level,
                },
                compositeScore: parseFloat(row.composite_score),
                source: row.source,
                sourceDescription: row.source_description,
                evidence: row.evidence_type
                    ? {
                        type: row.evidence_type,
                        url: row.evidence_url,
                    }
                    : null,
                createdAt: row.created_at,
            })),
            count: result.rows.length,
        },
    });
}));
export default router;
//# sourceMappingURL=employee-skill-profiles.js.map