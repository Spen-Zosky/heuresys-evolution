/**
 * Manager Skill Verification API Routes
 * Epic: E-ONTO-03 (Business Applications)
 * Story: S-ONTO-03-03 (Manager Skill Verification)
 *
 * Endpoints:
 * - GET /skill-verifications/team/:managerId - List pending verifications for team
 * - GET /skill-verifications/pending - List all pending verifications (tenant-wide)
 * - POST /skill-verifications/:profileId/approve - Approve skill declaration
 * - POST /skill-verifications/:profileId/reject - Reject skill declaration
 * - POST /skill-verifications/:profileId/override - Override skill levels
 * - GET /skill-verifications/audit/:profileId - Get verification audit trail
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { validate } from '../middleware/validate.js';
import {
  approveSkillSchema,
  rejectSkillSchema,
  overrideSkillSchema,
  bulkApproveSchema,
} from '../schemas/skills-assessment.js';
import { buildMeta } from '../utils/pagination.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

// =============================================================================
// GET /skill-verifications/team/:managerId
// List pending skill verifications for manager's team
// =============================================================================

router.get(
  '/team/:managerId',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { managerId } = req.params as Record<string, string>;
    const {
      includeExpired = 'false',
      limit = '50',
      offset = '0',
    } = req.query as Record<string, string>;

    // Verify manager exists
    const tenantId = req.headers['x-tenant-id'] as string;
    const managerResult = await dbClient.query(
      tenantId
        ? 'SELECT id, tenant_id, first_name, last_name FROM employees WHERE id = $1 AND tenant_id = $2'
        : 'SELECT id, tenant_id, first_name, last_name FROM employees WHERE id = $1',
      tenantId ? [managerId, tenantId] : [managerId]
    );

    if (managerResult.rows.length === 0) {
      throw Errors.notFound('Manager', managerId);
    }

    const manager = managerResult.rows[0];

    // Build query for team members' pending verifications
    let query = `
    SELECT
      esp.id as profile_id,
      esp.employee_id,
      e.first_name || ' ' || e.last_name as employee_name,
      e.job_title,
      d.name as department_name,
      esp.skill_id,
      es.preferred_label_en as skill_name,
      es.preferred_label_it as skill_name_it,
      es.skill_type,
      esg.preferred_label_en as skill_group,
      esp.knowledge_level,
      esp.skill_level,
      esp.ability_level,
      esp.behavior_level,
      esp.attitude_level,
      esp.composite_score,
      esp.source,
      esp.source_description,
      esp.acquired_date,
      esp.evidence_type,
      esp.evidence_id,
      esp.evidence_url,
      esp.evidence_notes,
      esp.verification_status,
      esp.created_at,
      esp.updated_at
    FROM employee_skill_profiles esp
    JOIN employees e ON esp.employee_id = e.id
    LEFT JOIN org_units d ON e.org_unit_id = d.id
    JOIN esco_skills es ON esp.skill_id = es.id
    LEFT JOIN esco_skill_groups esg ON es.skill_group_uri = esg.uri
    WHERE e.manager_id = $1
      AND esp.tenant_id = $2
  `;

    const params: unknown[] = [managerId, manager.tenant_id];
    let paramIndex = 3;

    if (includeExpired === 'false') {
      query += ` AND esp.verification_status = 'pending'`;
    } else {
      query += ` AND esp.verification_status IN ('pending', 'expired')`;
    }

    query += ` ORDER BY esp.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(
      safeParseInt(limit as string, { fallback: 50 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await dbClient.query(query, params);

    // Get counts
    const countResult = await dbClient.query(
      `
    SELECT
      COUNT(*) FILTER (WHERE esp.verification_status = 'pending') as pending_count,
      COUNT(*) FILTER (WHERE esp.verification_status = 'expired') as expired_count,
      COUNT(DISTINCT esp.employee_id) as employees_with_pending
    FROM employee_skill_profiles esp
    JOIN employees e ON esp.employee_id = e.id
    WHERE e.manager_id = $1
      AND esp.tenant_id = $2
      AND esp.verification_status IN ('pending', 'expired')
  `,
      [managerId, manager.tenant_id]
    );

    const counts = countResult.rows[0];

    res.json({
      success: true,
      data: {
        manager: {
          id: manager.id,
          name: `${manager.first_name} ${manager.last_name}`,
        },
        summary: {
          pendingCount: parseInt(counts.pending_count),
          expiredCount: parseInt(counts.expired_count),
          employeesWithPending: parseInt(counts.employees_with_pending),
        },
        verifications: result.rows.map((row) => ({
          profileId: row.profile_id,
          employee: {
            id: row.employee_id,
            name: row.employee_name,
            jobTitle: row.job_title,
            department: row.department_name,
          },
          skill: {
            id: row.skill_id,
            name: row.skill_name,
            nameIt: row.skill_name_it,
            type: row.skill_type,
            group: row.skill_group,
          },
          declared: {
            ksaba: {
              knowledge: row.knowledge_level,
              skill: row.skill_level,
              ability: row.ability_level,
              behavior: row.behavior_level,
              attitude: row.attitude_level,
            },
            compositeScore: parseFloat(row.composite_score),
          },
          source: row.source,
          sourceDescription: row.source_description,
          acquiredDate: row.acquired_date,
          evidence: row.evidence_type
            ? {
                type: row.evidence_type,
                id: row.evidence_id,
                url: row.evidence_url,
                notes: row.evidence_notes,
              }
            : null,
          status: row.verification_status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
        meta: buildMeta(
          parseInt(counts.pending_count) + parseInt(counts.expired_count),
          safeParseInt(limit as string, { fallback: 50 }),
          safeParseInt(offset as string, { fallback: 0 })
        ),
      },
    });
  })
);

// =============================================================================
// GET /skill-verifications/pending
// List all pending verifications (tenant-wide, for HR/Admin)
// =============================================================================

router.get(
  '/pending',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const tenantId = req.headers['x-tenant-id'] as string;
    const {
      orgUnitId,
      employeeId,
      limit = '50',
      offset = '0',
    } = req.query as Record<string, string>;

    if (!tenantId) {
      throw Errors.badRequest('x-tenant-id header is required');
    }

    let query = `
    SELECT
      esp.id as profile_id,
      esp.employee_id,
      e.first_name || ' ' || e.last_name as employee_name,
      e.job_title,
      e.manager_id,
      m.first_name || ' ' || m.last_name as manager_name,
      d.name as department_name,
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
      esp.evidence_type,
      esp.verification_status,
      esp.created_at
    FROM employee_skill_profiles esp
    JOIN employees e ON esp.employee_id = e.id
    LEFT JOIN employees m ON e.manager_id = m.id
    LEFT JOIN org_units d ON e.org_unit_id = d.id
    JOIN esco_skills es ON esp.skill_id = es.id
    WHERE esp.tenant_id = $1
      AND esp.verification_status = 'pending'
  `;

    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (orgUnitId) {
      query += ` AND e.org_unit_id = $${paramIndex++}`;
      params.push(orgUnitId);
    }

    if (employeeId) {
      query += ` AND esp.employee_id = $${paramIndex++}`;
      params.push(employeeId);
    }

    query += ` ORDER BY esp.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(
      safeParseInt(limit as string, { fallback: 50 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await dbClient.query(query, params);

    // Get total count
    let countQuery = `
    SELECT COUNT(*) as total
    FROM employee_skill_profiles esp
    JOIN employees e ON esp.employee_id = e.id
    WHERE esp.tenant_id = $1
      AND esp.verification_status = 'pending'
  `;
    const countParams: unknown[] = [tenantId];
    let countParamIndex = 2;

    if (orgUnitId) {
      countQuery += ` AND e.org_unit_id = $${countParamIndex++}`;
      countParams.push(orgUnitId);
    }
    if (employeeId) {
      countQuery += ` AND esp.employee_id = $${countParamIndex++}`;
      countParams.push(employeeId);
    }

    const countResult = await dbClient.query(countQuery, countParams);

    res.json({
      success: true,
      data: {
        verifications: result.rows.map((row) => ({
          profileId: row.profile_id,
          employeeId: row.employee_id,
          employeeName: row.employee_name,
          jobTitle: row.job_title,
          managerId: row.manager_id,
          managerName: row.manager_name,
          department: row.department_name,
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
          hasEvidence: !!row.evidence_type,
          createdAt: row.created_at,
        })),
        meta: buildMeta(
          parseInt(countResult.rows[0]?.total),
          safeParseInt(limit as string, { fallback: 50 }),
          safeParseInt(offset as string, { fallback: 0 })
        ),
      },
    });
  })
);

// =============================================================================
// POST /skill-verifications/:profileId/approve
// Approve a skill declaration
// =============================================================================

router.post(
  '/:profileId/approve',
  validate(approveSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { profileId } = req.params as Record<string, string>;
    const { verifierId, notes, expiresAt } = req.body;

    if (!verifierId) {
      throw Errors.badRequest('verifierId is required');
    }

    // Get current profile state
    const profileResult = await dbClient.query(
      `
    SELECT
      esp.id,
      esp.employee_id,
      esp.skill_id,
      esp.verification_status,
      esp.knowledge_level,
      esp.skill_level,
      esp.ability_level,
      esp.behavior_level,
      esp.attitude_level,
      esp.composite_score,
      e.first_name || ' ' || e.last_name as employee_name,
      es.preferred_label_en as skill_name
    FROM employee_skill_profiles esp
    JOIN employees e ON esp.employee_id = e.id
    JOIN esco_skills es ON esp.skill_id = es.id
    WHERE esp.id = $1
  `,
      [profileId]
    );

    if (profileResult.rows.length === 0) {
      throw Errors.notFound('Skill profile', profileId);
    }

    const profile = profileResult.rows[0];

    if (profile.verification_status === 'verified') {
      throw Errors.badRequest('Skill already verified');
    }

    // Calculate default expiry (1 year from now if not specified)
    const expiryDate =
      expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Update verification status
    const updateResult = await dbClient.query(
      `
    UPDATE employee_skill_profiles
    SET
      verification_status = 'verified',
      verified_by = $2,
      verified_at = NOW(),
      verification_notes = $3,
      verification_expires_at = $4,
      confidence_score = GREATEST(confidence_score, 0.8),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,
      [profileId, verifierId, notes, expiryDate]
    );

    // Log to history
    await dbClient.query(
      `
    INSERT INTO employee_skill_history (
      profile_id,
      previous_knowledge_level, previous_skill_level, previous_ability_level,
      previous_behavior_level, previous_attitude_level, previous_composite_score,
      new_knowledge_level, new_skill_level, new_ability_level,
      new_behavior_level, new_attitude_level, new_composite_score,
      change_type, change_reason, changed_by
    ) VALUES (
      $1,
      $2, $3, $4, $5, $6, $7,
      $2, $3, $4, $5, $6, $7,
      'verification', $8, $9
    )
  `,
      [
        profileId,
        profile.knowledge_level,
        profile.skill_level,
        profile.ability_level,
        profile.behavior_level,
        profile.attitude_level,
        profile.composite_score,
        notes || 'Skill approved by manager',
        verifierId,
      ]
    );

    const updated = updateResult.rows[0];

    res.json({
      success: true,
      data: {
        profileId,
        employeeId: profile.employee_id,
        employeeName: profile.employee_name,
        skillId: profile.skill_id,
        skillName: profile.skill_name,
        previousStatus: profile.verification_status,
        newStatus: 'verified',
        verifiedBy: verifierId,
        verifiedAt: updated.verified_at,
        expiresAt: updated.verification_expires_at,
        notes,
      },
    });
  })
);

// =============================================================================
// POST /skill-verifications/:profileId/reject
// Reject a skill declaration
// =============================================================================

router.post(
  '/:profileId/reject',
  validate(rejectSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { profileId } = req.params as Record<string, string>;
    const { verifierId, reason } = req.body;

    if (!verifierId) {
      throw Errors.badRequest('verifierId is required');
    }

    if (!reason) {
      throw Errors.badRequest('reason is required for rejection');
    }

    // Get current profile
    const profileResult = await dbClient.query(
      `
    SELECT
      esp.id,
      esp.employee_id,
      esp.skill_id,
      esp.verification_status,
      esp.knowledge_level,
      esp.skill_level,
      esp.ability_level,
      esp.behavior_level,
      esp.attitude_level,
      esp.composite_score,
      e.first_name || ' ' || e.last_name as employee_name,
      es.preferred_label_en as skill_name
    FROM employee_skill_profiles esp
    JOIN employees e ON esp.employee_id = e.id
    JOIN esco_skills es ON esp.skill_id = es.id
    WHERE esp.id = $1
  `,
      [profileId]
    );

    if (profileResult.rows.length === 0) {
      throw Errors.notFound('Skill profile', profileId);
    }

    const profile = profileResult.rows[0];

    if (profile.verification_status === 'rejected') {
      throw Errors.badRequest('Skill already rejected');
    }

    // Update to rejected status
    const updateResult = await dbClient.query(
      `
    UPDATE employee_skill_profiles
    SET
      verification_status = 'rejected',
      verified_by = $2,
      verified_at = NOW(),
      verification_notes = $3,
      confidence_score = LEAST(confidence_score, 0.3),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,
      [profileId, verifierId, reason]
    );

    // Log to history
    await dbClient.query(
      `
    INSERT INTO employee_skill_history (
      profile_id,
      previous_knowledge_level, previous_skill_level, previous_ability_level,
      previous_behavior_level, previous_attitude_level, previous_composite_score,
      new_knowledge_level, new_skill_level, new_ability_level,
      new_behavior_level, new_attitude_level, new_composite_score,
      change_type, change_reason, changed_by
    ) VALUES (
      $1,
      $2, $3, $4, $5, $6, $7,
      $2, $3, $4, $5, $6, $7,
      'verification', $8, $9
    )
  `,
      [
        profileId,
        profile.knowledge_level,
        profile.skill_level,
        profile.ability_level,
        profile.behavior_level,
        profile.attitude_level,
        profile.composite_score,
        `Rejected: ${reason}`,
        verifierId,
      ]
    );

    const updated = updateResult.rows[0];

    res.json({
      success: true,
      data: {
        profileId,
        employeeId: profile.employee_id,
        employeeName: profile.employee_name,
        skillId: profile.skill_id,
        skillName: profile.skill_name,
        previousStatus: profile.verification_status,
        newStatus: 'rejected',
        rejectedBy: verifierId,
        rejectedAt: updated.verified_at,
        reason,
      },
    });
  })
);

// =============================================================================
// POST /skill-verifications/:profileId/override
// Manager override of skill levels
// =============================================================================

router.post(
  '/:profileId/override',
  validate(overrideSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { profileId } = req.params as Record<string, string>;
    const {
      verifierId,
      knowledge,
      skill,
      ability,
      behavior,
      attitude,
      reason,
      autoApprove = true,
    } = req.body;

    if (!verifierId) {
      throw Errors.badRequest('verifierId is required');
    }

    if (!reason) {
      throw Errors.badRequest('reason is required for override');
    }

    // At least one level must be provided
    if (
      knowledge === undefined &&
      skill === undefined &&
      ability === undefined &&
      behavior === undefined &&
      attitude === undefined
    ) {
      throw Errors.badRequest('At least one KSABA dimension must be provided for override');
    }

    // Get current profile
    const profileResult = await dbClient.query(
      `
    SELECT
      esp.*,
      e.first_name || ' ' || e.last_name as employee_name,
      es.preferred_label_en as skill_name
    FROM employee_skill_profiles esp
    JOIN employees e ON esp.employee_id = e.id
    JOIN esco_skills es ON esp.skill_id = es.id
    WHERE esp.id = $1
  `,
      [profileId]
    );

    if (profileResult.rows.length === 0) {
      throw Errors.notFound('Skill profile', profileId);
    }

    const profile = profileResult.rows[0];

    // Build update with COALESCE for partial overrides
    const newKnowledge = knowledge ?? profile.knowledge_level;
    const newSkill = skill ?? profile.skill_level;
    const newAbility = ability ?? profile.ability_level;
    const newBehavior = behavior ?? profile.behavior_level;
    const newAttitude = attitude ?? profile.attitude_level;

    // Calculate new expiry (1 year from now)
    const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Update with override
    const updateResult = await dbClient.query(
      `
    UPDATE employee_skill_profiles
    SET
      knowledge_level = $2,
      skill_level = $3,
      ability_level = $4,
      behavior_level = $5,
      attitude_level = $6,
      source = 'manager_override',
      source_description = $7,
      verification_status = CASE WHEN $8 THEN 'verified' ELSE verification_status END,
      verified_by = $9,
      verified_at = CASE WHEN $8 THEN NOW() ELSE verified_at END,
      verification_notes = $7,
      verification_expires_at = CASE WHEN $8 THEN $10::date ELSE verification_expires_at END,
      confidence_score = 0.9,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,
      [
        profileId,
        newKnowledge,
        newSkill,
        newAbility,
        newBehavior,
        newAttitude,
        `Manager override: ${reason}`,
        autoApprove,
        verifierId,
        expiryDate,
      ]
    );

    // Log to history (trigger will handle this, but we add explicit reason)
    await dbClient.query(
      `
    INSERT INTO employee_skill_history (
      profile_id,
      previous_knowledge_level, previous_skill_level, previous_ability_level,
      previous_behavior_level, previous_attitude_level, previous_composite_score,
      new_knowledge_level, new_skill_level, new_ability_level,
      new_behavior_level, new_attitude_level, new_composite_score,
      change_type, change_reason, changed_by
    ) VALUES (
      $1,
      $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13,
      'manager_override', $14, $15
    )
  `,
      [
        profileId,
        profile.knowledge_level,
        profile.skill_level,
        profile.ability_level,
        profile.behavior_level,
        profile.attitude_level,
        profile.composite_score,
        newKnowledge,
        newSkill,
        newAbility,
        newBehavior,
        newAttitude,
        updateResult.rows[0]?.composite_score,
        reason,
        verifierId,
      ]
    );

    const updated = updateResult.rows[0];

    res.json({
      success: true,
      data: {
        profileId,
        employeeId: profile.employee_id,
        employeeName: profile.employee_name,
        skillId: profile.skill_id,
        skillName: profile.skill_name,
        previous: {
          ksaba: {
            knowledge: profile.knowledge_level,
            skill: profile.skill_level,
            ability: profile.ability_level,
            behavior: profile.behavior_level,
            attitude: profile.attitude_level,
          },
          compositeScore: parseFloat(profile.composite_score),
        },
        new: {
          ksaba: {
            knowledge: newKnowledge,
            skill: newSkill,
            ability: newAbility,
            behavior: newBehavior,
            attitude: newAttitude,
          },
          compositeScore: parseFloat(updated.composite_score),
        },
        verificationStatus: updated.verification_status,
        overrideBy: verifierId,
        overrideAt: updated.updated_at,
        reason,
      },
    });
  })
);

// =============================================================================
// GET /skill-verifications/audit/:profileId
// Get verification audit trail for a skill profile
// =============================================================================

router.get(
  '/audit/:profileId',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { profileId } = req.params as Record<string, string>;
    const { limit = '50', offset = '0' } = req.query as Record<string, string>;

    // Get profile info
    const profileResult = await dbClient.query(
      `
    SELECT
      esp.id,
      esp.employee_id,
      e.first_name || ' ' || e.last_name as employee_name,
      esp.skill_id,
      es.preferred_label_en as skill_name,
      esp.verification_status,
      esp.verified_by,
      v.first_name || ' ' || v.last_name as verified_by_name,
      esp.verified_at,
      esp.verification_notes,
      esp.verification_expires_at
    FROM employee_skill_profiles esp
    JOIN employees e ON esp.employee_id = e.id
    JOIN esco_skills es ON esp.skill_id = es.id
    LEFT JOIN employees v ON esp.verified_by = v.id
    WHERE esp.id = $1
  `,
      [profileId]
    );

    if (profileResult.rows.length === 0) {
      throw Errors.notFound('Skill profile', profileId);
    }

    const profile = profileResult.rows[0];

    // Get audit history
    const historyResult = await dbClient.query(
      `
    SELECT
      esh.id,
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
    LEFT JOIN employees e ON esh.changed_by = e.id
    WHERE esh.profile_id = $1
    ORDER BY esh.changed_at DESC
    LIMIT $2 OFFSET $3
  `,
      [
        profileId,
        safeParseInt(limit as string, { fallback: 50 }),
        safeParseInt(offset as string, { fallback: 0 }),
      ]
    );

    // Get total count
    const countResult = await dbClient.query(
      'SELECT COUNT(*) as total FROM employee_skill_history WHERE profile_id = $1',
      [profileId]
    );

    res.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          employeeId: profile.employee_id,
          employeeName: profile.employee_name,
          skillId: profile.skill_id,
          skillName: profile.skill_name,
          currentStatus: profile.verification_status,
          verifiedBy: profile.verified_by,
          verifiedByName: profile.verified_by_name,
          verifiedAt: profile.verified_at,
          verificationNotes: profile.verification_notes,
          expiresAt: profile.verification_expires_at,
        },
        auditTrail: historyResult.rows.map((row) => ({
          id: row.id,
          changeType: row.change_type,
          changeReason: row.change_reason,
          changedAt: row.changed_at,
          changedByName: row.changed_by_name,
          previous:
            row.previous_composite_score !== null
              ? {
                  ksaba: {
                    knowledge: row.previous_knowledge_level,
                    skill: row.previous_skill_level,
                    ability: row.previous_ability_level,
                    behavior: row.previous_behavior_level,
                    attitude: row.previous_attitude_level,
                  },
                  compositeScore: parseFloat(row.previous_composite_score),
                }
              : null,
          new: {
            ksaba: {
              knowledge: row.new_knowledge_level,
              skill: row.new_skill_level,
              ability: row.new_ability_level,
              behavior: row.new_behavior_level,
              attitude: row.new_attitude_level,
            },
            compositeScore: parseFloat(row.new_composite_score),
          },
        })),
        meta: buildMeta(
          parseInt(countResult.rows[0]?.total),
          safeParseInt(limit as string, { fallback: 50 }),
          safeParseInt(offset as string, { fallback: 0 })
        ),
      },
    });
  })
);

// =============================================================================
// POST /skill-verifications/bulk-approve
// Bulk approve multiple skill declarations
// =============================================================================

router.post(
  '/bulk-approve',
  validate(bulkApproveSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { profileIds, verifierId, notes } = req.body;

    if (!verifierId) {
      throw Errors.badRequest('verifierId is required');
    }

    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      throw Errors.badRequest('profileIds array is required');
    }

    const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const approved: string[] = [];
    const errors: { profileId: string; error: string }[] = [];

    for (const profileId of profileIds) {
      try {
        const result = await dbClient.query(
          `
        UPDATE employee_skill_profiles
        SET
          verification_status = 'verified',
          verified_by = $2,
          verified_at = NOW(),
          verification_notes = $3,
          verification_expires_at = $4,
          confidence_score = GREATEST(confidence_score, 0.8),
          updated_at = NOW()
        WHERE id = $1
          AND verification_status = 'pending'
        RETURNING id
      `,
          [profileId, verifierId, notes || 'Bulk approved', expiryDate]
        );

        if (result.rows.length > 0) {
          approved.push(profileId);
        } else {
          errors.push({ profileId, error: 'Not found or already verified' });
        }
      } catch (err) {
        errors.push({ profileId, error: (err as Error).message });
      }
    }

    res.json({
      success: true,
      data: {
        approved: approved.length,
        failed: errors.length,
        approvedIds: approved,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  })
);

export default router;
