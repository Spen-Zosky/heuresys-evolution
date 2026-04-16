/**
 * Talent Skill Profiles API Routes
 * Epic: E-ONTO-03 (Business Applications)
 *
 * Provides list and aggregated views of employee skill profiles
 * for talent management dashboards.
 *
 * Endpoints:
 * - GET /talent/skill-profiles - List all employee skill profiles with summary stats
 * - GET /talent/skill-profiles/:id - Get detailed skill profile for an employee
 */
import { Router } from 'express';
import { escapeILIKE } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import { buildMeta } from '../utils/pagination.js';
import { uuidParamSchema } from '../schemas/common.js';
import { talentSkillProfilesListQuerySchema } from '../schemas/workforce-analytics.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// =============================================================================
// GET /talent/skill-profiles
// List all employee skill profiles with aggregated KSABA stats
// =============================================================================
router.get('/', validate(talentSkillProfilesListQuerySchema, 'query'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = req.tenantId;
    if (!tenantId) {
        throw Errors.badRequest('Tenant context required');
    }
    const { limit = '50', offset = '0', org_unit_id, min_score, max_score, search, include_stats = 'true', } = req.query;
    // Build query for employees with skill profile summaries
    let query = `
      SELECT
        e.id as employee_id,
        e.first_name,
        e.last_name,
        e.job_title,
        e.email,
        d.name as department_name,
        d.id as org_unit_id,
        COALESCE(sp.total_skills, 0) as total_skills,
        COALESCE(sp.verified_skills, 0) as verified_skills,
        COALESCE(sp.pending_skills, 0) as pending_skills,
        COALESCE(sp.avg_knowledge, 0) as avg_knowledge,
        COALESCE(sp.avg_skill, 0) as avg_skill,
        COALESCE(sp.avg_ability, 0) as avg_ability,
        COALESCE(sp.avg_behavior, 0) as avg_behavior,
        COALESCE(sp.avg_attitude, 0) as avg_attitude,
        COALESCE(sp.avg_composite_score, 0) as avg_composite_score,
        sp.last_updated
      FROM employees e
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) as total_skills,
          COUNT(*) FILTER (WHERE verification_status = 'verified') as verified_skills,
          COUNT(*) FILTER (WHERE verification_status = 'pending') as pending_skills,
          ROUND(AVG(knowledge_level)::numeric, 2) as avg_knowledge,
          ROUND(AVG(skill_level)::numeric, 2) as avg_skill,
          ROUND(AVG(ability_level)::numeric, 2) as avg_ability,
          ROUND(AVG(behavior_level)::numeric, 2) as avg_behavior,
          ROUND(AVG(attitude_level)::numeric, 2) as avg_attitude,
          ROUND(AVG(composite_score)::numeric, 2) as avg_composite_score,
          MAX(updated_at) as last_updated
        FROM employee_skill_profiles esp
        WHERE esp.employee_id = e.id
      ) sp ON true
      WHERE e.tenant_id = $1
        AND e.is_active = true
    `;
    const params = [tenantId];
    let paramIndex = 2;
    // Filter by department
    if (org_unit_id) {
        query += ` AND e.org_unit_id = $${paramIndex++}`;
        params.push(org_unit_id);
    }
    // Filter by minimum score
    if (min_score) {
        query += ` AND COALESCE(sp.avg_composite_score, 0) >= $${paramIndex++}`;
        params.push(parseFloat(min_score));
    }
    // Filter by maximum score
    if (max_score) {
        query += ` AND COALESCE(sp.avg_composite_score, 0) <= $${paramIndex++}`;
        params.push(parseFloat(max_score));
    }
    // Search by name
    if (search) {
        query += ` AND (
        e.first_name ILIKE $${paramIndex} OR
        e.last_name ILIKE $${paramIndex} OR
        e.job_title ILIKE $${paramIndex}
      )`;
        params.push(`%${escapeILIKE(search)}%`);
        paramIndex++;
    }
    // Order and pagination
    query += ` ORDER BY sp.avg_composite_score DESC NULLS LAST, e.last_name ASC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await dbClient.query(query, params);
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(composite_score)::numeric, 2) as avg_composite_score
        FROM employee_skill_profiles esp
        WHERE esp.employee_id = e.id
      ) sp ON true
      WHERE e.tenant_id = $1 AND e.is_active = true
    `;
    const countParams = [tenantId];
    let countParamIndex = 2;
    if (org_unit_id) {
        countQuery += ` AND e.org_unit_id = $${countParamIndex++}`;
        countParams.push(org_unit_id);
    }
    if (min_score) {
        countQuery += ` AND COALESCE(sp.avg_composite_score, 0) >= $${countParamIndex++}`;
        countParams.push(parseFloat(min_score));
    }
    if (max_score) {
        countQuery += ` AND COALESCE(sp.avg_composite_score, 0) <= $${countParamIndex++}`;
        countParams.push(parseFloat(max_score));
    }
    if (search) {
        countQuery += ` AND (e.first_name ILIKE $${countParamIndex} OR e.last_name ILIKE $${countParamIndex} OR e.job_title ILIKE $${countParamIndex})`;
        countParams.push(`%${escapeILIKE(search)}%`);
    }
    const countResult = await dbClient.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.total);
    // Format response
    const profiles = result.rows.map((row) => ({
        employee_id: row.employee_id,
        first_name: row.first_name,
        last_name: row.last_name,
        full_name: `${row.first_name} ${row.last_name}`,
        job_title: row.job_title,
        email: row.email,
        department: {
            id: row.org_unit_id,
            name: row.department_name,
        },
        skill_summary: {
            total_skills: parseInt(row.total_skills),
            verified_skills: parseInt(row.verified_skills),
            pending_skills: parseInt(row.pending_skills),
            ksaba: {
                knowledge: parseFloat(row.avg_knowledge) || 0,
                skill: parseFloat(row.avg_skill) || 0,
                ability: parseFloat(row.avg_ability) || 0,
                behavior: parseFloat(row.avg_behavior) || 0,
                attitude: parseFloat(row.avg_attitude) || 0,
            },
            avg_composite_score: parseFloat(row.avg_composite_score) || 0,
            last_updated: row.last_updated,
        },
    }));
    // Get aggregate stats if requested
    let stats = null;
    if (include_stats === 'true') {
        const statsResult = await dbClient.query(`
        SELECT
          COUNT(DISTINCT e.id) as total_employees,
          COUNT(DISTINCT esp.employee_id) as employees_with_skills,
          COALESCE(SUM(skill_counts.total), 0) as total_skill_records,
          ROUND(AVG(skill_counts.avg_score)::numeric, 2) as org_avg_score
        FROM employees e
        LEFT JOIN employee_skill_profiles esp ON e.id = esp.employee_id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) as total,
            AVG(composite_score) as avg_score
          FROM employee_skill_profiles
          WHERE employee_id = e.id
        ) skill_counts ON true
        WHERE e.tenant_id = $1 AND e.is_active = true
      `, [tenantId]);
        stats = {
            total_employees: parseInt(statsResult.rows[0]?.total_employees),
            employees_with_skills: parseInt(statsResult.rows[0]?.employees_with_skills),
            total_skill_records: parseInt(statsResult.rows[0]?.total_skill_records),
            org_avg_score: parseFloat(statsResult.rows[0]?.org_avg_score) || 0,
        };
    }
    res.json({
        success: true,
        data: profiles,
        ...(stats && { stats }),
        meta: buildMeta(total, safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 })),
    });
}));
// =============================================================================
// GET /talent/skill-profiles/:id
// Get detailed skill profile for a specific employee
// =============================================================================
router.get('/:id', validate(uuidParamSchema, 'params'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { id: employeeId } = req.params;
    const tenantId = req.tenantId;
    if (!tenantId) {
        throw Errors.badRequest('Tenant context required');
    }
    // Get employee info
    const employeeResult = await dbClient.query(`
      SELECT
        e.id, e.first_name, e.last_name, e.job_title, e.email,
        d.id as org_unit_id, d.name as department_name,
        e.hire_date, e.is_active
      FROM employees e
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE e.id = $1 AND e.tenant_id = $2
    `, [employeeId, tenantId]);
    if (employeeResult.rows.length === 0) {
        throw Errors.notFound('Employee');
    }
    const employee = employeeResult.rows[0];
    // Get all skills with ESCO details
    const skillsResult = await dbClient.query(`
      SELECT
        esp.id as profile_id,
        esp.skill_id,
        es.preferred_label_en as skill_name,
        es.preferred_label_it as skill_name_it,
        es.description_en as skill_description,
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
        esp.last_demonstrated,
        esp.verification_status,
        esp.verified_by,
        esp.verified_at,
        esp.confidence_score,
        esp.is_primary,
        esp.is_target,
        esp.target_level,
        esp.evidence_type,
        esp.evidence_url,
        esp.created_at,
        esp.updated_at
      FROM employee_skill_profiles esp
      JOIN esco_skills es ON esp.skill_id = es.id
      LEFT JOIN esco_skill_groups esg ON es.skill_group_uri = esg.uri
      WHERE esp.employee_id = $1
      ORDER BY esp.is_primary DESC, esp.composite_score DESC
    `, [employeeId]);
    // Calculate KSABA summary
    const ksabaSummary = {
        knowledge: { avg: 0, min: 0, max: 0 },
        skill: { avg: 0, min: 0, max: 0 },
        ability: { avg: 0, min: 0, max: 0 },
        behavior: { avg: 0, min: 0, max: 0 },
        attitude: { avg: 0, min: 0, max: 0 },
    };
    if (skillsResult.rows.length > 0) {
        const skills = skillsResult.rows;
        const calc = (field) => ({
            avg: parseFloat((skills.reduce((sum, s) => sum + (parseFloat(s[field]) || 0), 0) / skills.length).toFixed(2)),
            min: Math.min(...skills.map((s) => parseFloat(s[field]) || 0)),
            max: Math.max(...skills.map((s) => parseFloat(s[field]) || 0)),
        });
        ksabaSummary.knowledge = calc('knowledge_level');
        ksabaSummary.skill = calc('skill_level');
        ksabaSummary.ability = calc('ability_level');
        ksabaSummary.behavior = calc('behavior_level');
        ksabaSummary.attitude = calc('attitude_level');
    }
    // Format skills
    const skills = skillsResult.rows.map((row) => ({
        id: row.profile_id,
        skill_id: row.skill_id,
        skill_name: row.skill_name,
        skill_name_it: row.skill_name_it,
        skill_description: row.skill_description,
        skill_type: row.skill_type,
        skill_group: row.skill_group,
        ksaba: {
            knowledge: parseFloat(row.knowledge_level) || 0,
            skill: parseFloat(row.skill_level) || 0,
            ability: parseFloat(row.ability_level) || 0,
            behavior: parseFloat(row.behavior_level) || 0,
            attitude: parseFloat(row.attitude_level) || 0,
        },
        composite_score: parseFloat(row.composite_score) || 0,
        source: row.source,
        source_description: row.source_description,
        acquired_date: row.acquired_date,
        last_demonstrated: row.last_demonstrated,
        verification: {
            status: row.verification_status,
            verified_by: row.verified_by,
            verified_at: row.verified_at,
        },
        confidence_score: parseFloat(row.confidence_score) || 0,
        is_primary: row.is_primary,
        is_target: row.is_target,
        target_level: row.target_level,
        evidence: row.evidence_type
            ? {
                type: row.evidence_type,
                url: row.evidence_url,
            }
            : null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }));
    res.json({
        success: true,
        data: {
            employee: {
                id: employee.id,
                first_name: employee.first_name,
                last_name: employee.last_name,
                full_name: `${employee.first_name} ${employee.last_name}`,
                job_title: employee.job_title,
                email: employee.email,
                department: {
                    id: employee.org_unit_id,
                    name: employee.department_name,
                },
                hire_date: employee.hire_date,
                is_active: employee.is_active,
            },
            summary: {
                total_skills: skills.length,
                verified_skills: skills.filter((s) => s.verification.status === 'verified').length,
                pending_skills: skills.filter((s) => s.verification.status === 'pending').length,
                primary_skills: skills.filter((s) => s.is_primary).length,
                target_skills: skills.filter((s) => s.is_target).length,
                avg_composite_score: skills.length > 0
                    ? parseFloat((skills.reduce((sum, s) => sum + s.composite_score, 0) / skills.length).toFixed(2))
                    : 0,
            },
            ksaba_summary: ksabaSummary,
            skills,
        },
    });
}));
export default router;
//# sourceMappingURL=talent-skill-profiles.js.map