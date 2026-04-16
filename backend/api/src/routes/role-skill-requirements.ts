/**
 * Role Skill Requirements API Routes
 * Epic: E-ONTO-03 (Business Applications)
 * Story: S-ONTO-03-04 (Role Skill Requirements)
 *
 * Endpoints:
 * - GET /roles/:id/skill-requirements - Get skill requirements for a role
 * - PUT /roles/:id/skill-requirements - Update skill requirements
 * - POST /roles/:id/skill-requirements - Add a skill requirement
 * - DELETE /roles/:id/skill-requirements/:skillId - Remove a requirement
 * - POST /roles/:id/skill-requirements/seed-from-esco - Seed from ESCO
 */

import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { SuccessionPlanningService } from '../services/succession-planning/index.js';
import { getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import {
  replaceSkillRequirementsSchema,
  createSkillRequirementSchema,
  seedFromEscoSchema,
  copyFromRoleSchema,
} from '../schemas/skills-assessment.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();
const successionService = new SuccessionPlanningService(pool);

// =============================================================================
// GET /roles/:id/skill-requirements
// Get all skill requirements for a role
// =============================================================================

router.get(
  '/:id/skill-requirements',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { id: roleId } = req.params as Record<string, string>;
    const { importance, includeSkillDetails = 'true' } = req.query as Record<string, string>;

    // Verify role exists
    const roleResult = await dbClient.query(
      `
    SELECT id, title_en, title_it, job_code, esco_occupation_uri
    FROM job_templates WHERE id = $1
  `,
      [roleId]
    );

    if (roleResult.rows.length === 0) {
      throw Errors.notFound('Role', roleId);
    }

    const role = roleResult.rows[0];

    // Get requirements
    let query = `
    SELECT
      rsr.id,
      rsr.skill_id,
      rsr.required_knowledge_level,
      rsr.required_skill_level,
      rsr.required_ability_level,
      rsr.required_behavior_level,
      rsr.required_attitude_level,
      rsr.min_composite_score,
      rsr.importance,
      rsr.weight,
      rsr.is_primary,
      rsr.notes,
      rsr.source,
      rsr.created_at,
      rsr.updated_at
  `;

    if (includeSkillDetails === 'true') {
      query += `,
      es.preferred_label_en as skill_name,
      es.preferred_label_it as skill_name_it,
      es.description_en as skill_description,
      es.skill_type,
      esg.preferred_label_en as skill_group
    `;
    }

    query += `
    FROM role_skill_requirements rsr
    JOIN esco_skills es ON rsr.skill_id = es.id
    LEFT JOIN esco_skill_groups esg ON es.skill_group_uri = esg.uri
    WHERE rsr.role_id = $1
  `;

    const params: unknown[] = [roleId];
    let paramIndex = 2;

    if (importance) {
      query += ` AND rsr.importance = $${paramIndex++}`;
      params.push(importance);
    }

    query += ` ORDER BY rsr.is_primary DESC, rsr.importance, rsr.weight DESC, rsr.min_composite_score DESC`;

    const result = await dbClient.query(query, params);

    // Group by importance
    const byImportance: Record<string, unknown[]> = {
      essential: [],
      important: [],
      nice_to_have: [],
      developmental: [],
    };

    const requirements = result.rows.map((row) => {
      const req = {
        id: row.id,
        skillId: row.skill_id,
        ...(includeSkillDetails === 'true' && {
          skillName: row.skill_name,
          skillNameIt: row.skill_name_it,
          skillDescription: row.skill_description,
          skillType: row.skill_type,
          skillGroup: row.skill_group,
        }),
        requiredKsaba: {
          knowledge: row.required_knowledge_level,
          skill: row.required_skill_level,
          ability: row.required_ability_level,
          behavior: row.required_behavior_level,
          attitude: row.required_attitude_level,
        },
        minCompositeScore: row.min_composite_score ? parseFloat(row.min_composite_score) : null,
        importance: row.importance,
        weight: parseFloat(row.weight),
        isPrimary: row.is_primary,
        notes: row.notes,
        source: row.source,
      };

      const impArray = byImportance[row.importance];
      if (impArray) {
        impArray.push(req);
      }

      return req;
    });

    res.json({
      success: true,
      data: {
        role: {
          id: role.id,
          title: role.title_en,
          titleIt: role.title_it,
          jobCode: role.job_code,
          escoOccupationUri: role.esco_occupation_uri,
        },
        summary: {
          totalRequirements: requirements.length,
          essential: (byImportance.essential ?? []).length,
          important: (byImportance.important ?? []).length,
          niceToHave: (byImportance.nice_to_have ?? []).length,
          developmental: (byImportance.developmental ?? []).length,
          primarySkills: requirements.filter((r) => r.isPrimary).length,
        },
        requirements,
        byImportance,
      },
    });
  })
);

// =============================================================================
// PUT /roles/:id/skill-requirements
// Bulk update skill requirements
// =============================================================================

router.put(
  '/:id/skill-requirements',
  validate(replaceSkillRequirementsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { id: roleId } = req.params as Record<string, string>;
    const { requirements, tenantId } = req.body;

    if (!Array.isArray(requirements) || requirements.length === 0) {
      throw Errors.badRequest('requirements array is required');
    }

    // Verify role exists
    const roleCheck = await dbClient.query('SELECT id FROM job_templates WHERE id = $1', [roleId]);
    if (roleCheck.rows.length === 0) {
      throw Errors.notFound('Role', roleId);
    }

    const updated: string[] = [];
    const errors: { skillId: string; error: string }[] = [];

    for (const req of requirements) {
      try {
        const {
          skillId,
          knowledge,
          skill,
          ability,
          behavior,
          attitude,
          minCompositeScore,
          importance = 'important',
          weight = 1.0,
          isPrimary = false,
          notes,
        } = req;

        if (!skillId) {
          errors.push({ skillId: 'unknown', error: 'skillId is required' });
          continue;
        }

        const result = await dbClient.query(
          `
        INSERT INTO role_skill_requirements (
          tenant_id, role_id, skill_id,
          required_knowledge_level, required_skill_level, required_ability_level,
          required_behavior_level, required_attitude_level, min_composite_score,
          importance, weight, is_primary, notes, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'manual')
        ON CONFLICT (tenant_id, role_id, skill_id)
        DO UPDATE SET
          required_knowledge_level = COALESCE($4, role_skill_requirements.required_knowledge_level),
          required_skill_level = COALESCE($5, role_skill_requirements.required_skill_level),
          required_ability_level = COALESCE($6, role_skill_requirements.required_ability_level),
          required_behavior_level = COALESCE($7, role_skill_requirements.required_behavior_level),
          required_attitude_level = COALESCE($8, role_skill_requirements.required_attitude_level),
          min_composite_score = COALESCE($9, role_skill_requirements.min_composite_score),
          importance = COALESCE($10, role_skill_requirements.importance),
          weight = COALESCE($11, role_skill_requirements.weight),
          is_primary = COALESCE($12, role_skill_requirements.is_primary),
          notes = COALESCE($13, role_skill_requirements.notes),
          updated_at = NOW()
        RETURNING id
      `,
          [
            tenantId || null,
            roleId,
            skillId,
            knowledge,
            skill,
            ability,
            behavior,
            attitude,
            minCompositeScore,
            importance,
            weight,
            isPrimary,
            notes,
          ]
        );

        if (result.rows.length > 0) {
          updated.push(skillId);
        }
      } catch (err) {
        const error = err as Error;
        errors.push({ skillId: req.skillId || 'unknown', error: error.message });
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
  })
);

// =============================================================================
// POST /roles/:id/skill-requirements
// Add a single skill requirement
// =============================================================================

router.post(
  '/:id/skill-requirements',
  validate(createSkillRequirementSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { id: roleId } = req.params as Record<string, string>;
    const {
      skillId,
      knowledge,
      skill,
      ability,
      behavior,
      attitude,
      minCompositeScore,
      importance = 'important',
      weight = 1.0,
      isPrimary = false,
      notes,
      tenantId,
    } = req.body;

    if (!skillId) {
      throw Errors.badRequest('skillId is required');
    }

    // Verify role and skill exist
    const [roleCheck, skillCheck] = await Promise.all([
      dbClient.query('SELECT id, title_en FROM job_templates WHERE id = $1', [roleId]),
      dbClient.query('SELECT id, preferred_label_en FROM esco_skills WHERE id = $1', [skillId]),
    ]);

    if (roleCheck.rows.length === 0) {
      throw Errors.notFound('Role', roleId);
    }

    if (skillCheck.rows.length === 0) {
      throw Errors.notFound('Skill', skillId);
    }

    const result = await dbClient.query(
      `
    INSERT INTO role_skill_requirements (
      tenant_id, role_id, skill_id,
      required_knowledge_level, required_skill_level, required_ability_level,
      required_behavior_level, required_attitude_level, min_composite_score,
      importance, weight, is_primary, notes, source
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'manual')
    RETURNING id, min_composite_score
  `,
      [
        tenantId || null,
        roleId,
        skillId,
        knowledge,
        skill,
        ability,
        behavior,
        attitude,
        minCompositeScore,
        importance,
        weight,
        isPrimary,
        notes,
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.rows[0]?.id,
        roleId,
        roleName: roleCheck.rows[0]?.title_en,
        skillId,
        skillName: skillCheck.rows[0]?.preferred_label_en,
        minCompositeScore: result.rows[0]?.min_composite_score
          ? parseFloat(result.rows[0]?.min_composite_score)
          : null,
        importance,
      },
    });
  })
);

// =============================================================================
// DELETE /roles/:id/skill-requirements/:skillId
// Remove a skill requirement
// =============================================================================

router.delete(
  '/:id/skill-requirements/:skillId',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { id: roleId, skillId } = req.params as Record<string, string>;
    const { tenantId } = req.query as Record<string, string>;

    let query = 'DELETE FROM role_skill_requirements WHERE role_id = $1 AND skill_id = $2';
    const params: unknown[] = [roleId, skillId];

    if (tenantId) {
      query += ' AND tenant_id = $3';
      params.push(tenantId);
    } else {
      query += ' AND tenant_id IS NULL';
    }

    query += ' RETURNING id';

    const result = await dbClient.query(query, params);

    if (result.rows.length === 0) {
      throw Errors.notFound('Skill requirement');
    }

    res.json({
      success: true,
      data: {
        deleted: true,
        roleId,
        skillId,
      },
    });
  })
);

// =============================================================================
// POST /roles/:id/skill-requirements/seed-from-esco
// Seed requirements from ESCO occupation mapping
// =============================================================================

router.post(
  '/:id/skill-requirements/seed-from-esco',
  validate(seedFromEscoSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { id: roleId } = req.params as Record<string, string>;
    const { tenantId, defaultImportance = 'important', defaultLevel = 3 } = req.body;

    // Call the seed function
    const result = await dbClient.query(
      `
    SELECT seed_role_requirements_from_esco($1, $2, $3::requirement_importance, $4::SMALLINT) as count
  `,
      [roleId, tenantId || null, defaultImportance, defaultLevel]
    );

    const seededCount = result.rows[0]?.count;

    res.json({
      success: true,
      data: {
        seeded: seededCount,
        roleId,
        message:
          seededCount > 0
            ? `Seeded ${seededCount} skill requirements from ESCO occupation mapping`
            : 'No ESCO occupation mapped for this role or no skills found',
      },
    });
  })
);

// =============================================================================
// POST /roles/:id/skill-requirements/copy-from/:sourceRoleId
// Copy requirements from another role
// =============================================================================

router.post(
  '/:id/skill-requirements/copy-from/:sourceRoleId',
  validate(copyFromRoleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { id: targetRoleId, sourceRoleId } = req.params as Record<string, string>;
    const { tenantId } = req.body;

    // Verify both roles exist
    const rolesCheck = await dbClient.query(
      `
    SELECT id, title_en FROM job_templates WHERE id IN ($1, $2)
  `,
      [sourceRoleId, targetRoleId]
    );

    if (rolesCheck.rows.length < 2) {
      throw Errors.notFound('Source or target role');
    }

    // Copy requirements
    const result = await dbClient.query(
      `
    SELECT copy_role_requirements($1, $2, $3) as count
  `,
      [sourceRoleId, targetRoleId, tenantId || null]
    );

    const copiedCount = result.rows[0]?.count;

    res.json({
      success: true,
      data: {
        copied: copiedCount,
        sourceRoleId,
        targetRoleId,
        message:
          copiedCount > 0
            ? `Copied ${copiedCount} skill requirements`
            : 'No requirements to copy or all already exist',
      },
    });
  })
);

// =============================================================================
// GET /roles/:id/succession
// Get succession plan for a role (skill-based candidate identification)
// =============================================================================

router.get(
  '/:id/succession',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const roleId = req.params['id'] as string;
    const minSkillMatch = req.query['min_skill_match']
      ? parseFloat(req.query['min_skill_match'] as string)
      : undefined;
    const maxCandidates = safeParseInt(req.query['max_candidates'] as string, { fallback: 0 });
    const includeDevelopmentPlans = req.query['include_development_plans'] !== 'false';
    const orgUnitId = req.query['org_unit_id'] as string | undefined;

    try {
      const successionPlan = await successionService.getSuccessionPlan(tenantId, roleId, {
        ...(minSkillMatch !== undefined ? { min_skill_match: minSkillMatch } : {}),
        ...(maxCandidates !== undefined ? { max_candidates: maxCandidates } : {}),
        include_development_plans: includeDevelopmentPlans,
        ...(orgUnitId ? { org_unit_id: orgUnitId } : {}),
      });

      res.json({
        success: true,
        data: successionPlan,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Role not found') {
        throw Errors.notFound('Role', roleId);
      }
      throw error;
    }
  })
);

export default router;
