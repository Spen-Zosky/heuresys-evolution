/**
 * Process Layer Service
 * CRUD operations for process phases, roles, skill requirements, KPIs, and blueprint templates.
 * Uses req.dbClient (PoolClient with tenant context) for RLS enforcement.
 */
import { logger } from '../config/logger.js';
// =============================================================================
// PROCESS LAYER SERVICE
// =============================================================================
export class ProcessLayerService {
    dbClient;
    constructor(dbClient) {
        this.dbClient = dbClient;
    }
    // ---------------------------------------------------------------------------
    // LIST PROCESSES
    // ---------------------------------------------------------------------------
    async listProcesses(category, search) {
        try {
            const conditions = [];
            const params = [];
            let idx = 1;
            if (category) {
                conditions.push(`bp.process_category = $${idx++}`);
                params.push(category);
            }
            if (search) {
                conditions.push(`bp.process_name ILIKE $${idx++}`);
                params.push(`%${search.replace(/[%_]/g, '\\$&')}%`);
            }
            const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            const result = await this.dbClient.query(`SELECT bp.id, bp.process_code, bp.process_name, bp.process_category,
                bp.value_chain_position, bp.description,
                (SELECT COUNT(*) FROM process_phases pp WHERE pp.process_id = bp.id)::int AS phase_count,
                (SELECT COUNT(*) FROM process_roles pr WHERE pr.process_id = bp.id)::int AS role_count,
                (SELECT COUNT(*) FROM process_skill_requirements psr WHERE psr.process_id = bp.id)::int AS skill_count,
                (SELECT COUNT(*) FROM process_kpis pk WHERE pk.process_id = bp.id)::int AS kpi_count
         FROM business_processes bp
         ${where}
         ORDER BY bp.process_code`, params);
            return result.rows.map((row) => ({
                id: row.id,
                processCode: row.process_code,
                processName: row.process_name,
                processCategory: row.process_category,
                valueChainPosition: row.value_chain_position,
                description: row.description,
                phaseCount: row.phase_count,
                roleCount: row.role_count,
                skillCount: row.skill_count,
                kpiCount: row.kpi_count,
            }));
        }
        catch (error) {
            logger.error({ err: error }, 'Failed to list processes');
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // PHASES
    // ---------------------------------------------------------------------------
    async getPhasesByProcess(processId) {
        try {
            const result = await this.dbClient.query(`SELECT id, process_id, phase_code, phase_name, phase_order,
                description, estimated_duration_days, is_optional, created_at, updated_at
         FROM process_phases
         WHERE process_id = $1
         ORDER BY phase_order`, [processId]);
            return result.rows.map(this.mapPhase);
        }
        catch (error) {
            logger.error({ err: error, processId }, 'Failed to get phases');
            throw error;
        }
    }
    async createPhase(processId, data) {
        try {
            const result = await this.dbClient.query(`INSERT INTO process_phases (process_id, phase_code, phase_name, phase_order,
                                     description, estimated_duration_days, is_optional)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`, [
                processId,
                data.phaseCode,
                data.phaseName,
                data.phaseOrder,
                data.description || null,
                data.estimatedDurationDays || null,
                data.isOptional ?? false,
            ]);
            return this.mapPhase(result.rows[0]);
        }
        catch (error) {
            logger.error({ err: error, processId }, 'Failed to create phase');
            throw error;
        }
    }
    async updatePhase(phaseId, data) {
        try {
            const sets = [];
            const params = [];
            let idx = 1;
            if (data.phaseCode !== undefined) {
                sets.push(`phase_code = $${idx++}`);
                params.push(data.phaseCode);
            }
            if (data.phaseName !== undefined) {
                sets.push(`phase_name = $${idx++}`);
                params.push(data.phaseName);
            }
            if (data.phaseOrder !== undefined) {
                sets.push(`phase_order = $${idx++}`);
                params.push(data.phaseOrder);
            }
            if (data.description !== undefined) {
                sets.push(`description = $${idx++}`);
                params.push(data.description);
            }
            if (data.estimatedDurationDays !== undefined) {
                sets.push(`estimated_duration_days = $${idx++}`);
                params.push(data.estimatedDurationDays);
            }
            if (data.isOptional !== undefined) {
                sets.push(`is_optional = $${idx++}`);
                params.push(data.isOptional);
            }
            sets.push(`updated_at = NOW()`);
            params.push(phaseId);
            const result = await this.dbClient.query(`UPDATE process_phases SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params);
            if (result.rows.length === 0) {
                throw new Error(`Phase ${phaseId} not found`);
            }
            return this.mapPhase(result.rows[0]);
        }
        catch (error) {
            logger.error({ err: error, phaseId }, 'Failed to update phase');
            throw error;
        }
    }
    async deletePhase(phaseId) {
        try {
            const result = await this.dbClient.query('DELETE FROM process_phases WHERE id = $1', [
                phaseId,
            ]);
            if (result.rowCount === 0) {
                throw new Error(`Phase ${phaseId} not found`);
            }
        }
        catch (error) {
            logger.error({ err: error, phaseId }, 'Failed to delete phase');
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // ROLES
    // ---------------------------------------------------------------------------
    async getRolesByProcess(processId) {
        try {
            const result = await this.dbClient.query(`SELECT id, process_id, phase_id, role_name, role_type,
                esco_occupation_id, min_headcount, max_headcount, description,
                created_at, updated_at
         FROM process_roles
         WHERE process_id = $1
         ORDER BY role_name`, [processId]);
            return result.rows.map(this.mapRole);
        }
        catch (error) {
            logger.error({ err: error, processId }, 'Failed to get roles');
            throw error;
        }
    }
    async createRole(processId, data) {
        try {
            const result = await this.dbClient.query(`INSERT INTO process_roles (process_id, phase_id, role_name, role_type,
                                    esco_occupation_id, min_headcount, max_headcount, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`, [
                processId,
                data.phaseId || null,
                data.roleName,
                data.roleType,
                data.escoOccupationId || null,
                data.minHeadcount ?? 1,
                data.maxHeadcount || null,
                data.description || null,
            ]);
            return this.mapRole(result.rows[0]);
        }
        catch (error) {
            logger.error({ err: error, processId }, 'Failed to create role');
            throw error;
        }
    }
    async updateRole(roleId, data) {
        try {
            const sets = [];
            const params = [];
            let idx = 1;
            if (data.roleName !== undefined) {
                sets.push(`role_name = $${idx++}`);
                params.push(data.roleName);
            }
            if (data.roleType !== undefined) {
                sets.push(`role_type = $${idx++}`);
                params.push(data.roleType);
            }
            if (data.phaseId !== undefined) {
                sets.push(`phase_id = $${idx++}`);
                params.push(data.phaseId);
            }
            if (data.escoOccupationId !== undefined) {
                sets.push(`esco_occupation_id = $${idx++}`);
                params.push(data.escoOccupationId);
            }
            if (data.minHeadcount !== undefined) {
                sets.push(`min_headcount = $${idx++}`);
                params.push(data.minHeadcount);
            }
            if (data.maxHeadcount !== undefined) {
                sets.push(`max_headcount = $${idx++}`);
                params.push(data.maxHeadcount);
            }
            if (data.description !== undefined) {
                sets.push(`description = $${idx++}`);
                params.push(data.description);
            }
            sets.push(`updated_at = NOW()`);
            params.push(roleId);
            const result = await this.dbClient.query(`UPDATE process_roles SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params);
            if (result.rows.length === 0) {
                throw new Error(`Role ${roleId} not found`);
            }
            return this.mapRole(result.rows[0]);
        }
        catch (error) {
            logger.error({ err: error, roleId }, 'Failed to update role');
            throw error;
        }
    }
    async deleteRole(roleId) {
        try {
            const result = await this.dbClient.query('DELETE FROM process_roles WHERE id = $1', [roleId]);
            if (result.rowCount === 0) {
                throw new Error(`Role ${roleId} not found`);
            }
        }
        catch (error) {
            logger.error({ err: error, roleId }, 'Failed to delete role');
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // SKILL REQUIREMENTS
    // ---------------------------------------------------------------------------
    async getSkillRequirementsByProcess(processId) {
        try {
            const result = await this.dbClient.query(`SELECT id, process_id, phase_id, esco_skill_id, proficiency_level,
                is_mandatory, description, created_at, updated_at
         FROM process_skill_requirements
         WHERE process_id = $1
         ORDER BY proficiency_level DESC`, [processId]);
            return result.rows.map(this.mapSkillRequirement);
        }
        catch (error) {
            logger.error({ err: error, processId }, 'Failed to get skill requirements');
            throw error;
        }
    }
    async createSkillRequirement(processId, data) {
        try {
            const result = await this.dbClient.query(`INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id,
                                                  proficiency_level, is_mandatory, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`, [
                processId,
                data.phaseId || null,
                data.escoSkillId,
                data.proficiencyLevel,
                data.isMandatory ?? true,
                data.description || null,
            ]);
            return this.mapSkillRequirement(result.rows[0]);
        }
        catch (error) {
            logger.error({ err: error, processId }, 'Failed to create skill requirement');
            throw error;
        }
    }
    async updateSkillRequirement(reqId, data) {
        try {
            const sets = [];
            const params = [];
            let idx = 1;
            if (data.escoSkillId !== undefined) {
                sets.push(`esco_skill_id = $${idx++}`);
                params.push(data.escoSkillId);
            }
            if (data.phaseId !== undefined) {
                sets.push(`phase_id = $${idx++}`);
                params.push(data.phaseId);
            }
            if (data.proficiencyLevel !== undefined) {
                sets.push(`proficiency_level = $${idx++}`);
                params.push(data.proficiencyLevel);
            }
            if (data.isMandatory !== undefined) {
                sets.push(`is_mandatory = $${idx++}`);
                params.push(data.isMandatory);
            }
            if (data.description !== undefined) {
                sets.push(`description = $${idx++}`);
                params.push(data.description);
            }
            sets.push(`updated_at = NOW()`);
            params.push(reqId);
            const result = await this.dbClient.query(`UPDATE process_skill_requirements SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params);
            if (result.rows.length === 0) {
                throw new Error(`Skill requirement ${reqId} not found`);
            }
            return this.mapSkillRequirement(result.rows[0]);
        }
        catch (error) {
            logger.error({ err: error, reqId }, 'Failed to update skill requirement');
            throw error;
        }
    }
    async deleteSkillRequirement(reqId) {
        try {
            const result = await this.dbClient.query('DELETE FROM process_skill_requirements WHERE id = $1', [reqId]);
            if (result.rowCount === 0) {
                throw new Error(`Skill requirement ${reqId} not found`);
            }
        }
        catch (error) {
            logger.error({ err: error, reqId }, 'Failed to delete skill requirement');
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // KPIs
    // ---------------------------------------------------------------------------
    async getKpisByProcess(processId) {
        try {
            const result = await this.dbClient.query(`SELECT id, process_id, phase_id, kpi_code, kpi_name, measurement_unit,
                target_direction, benchmark_value, benchmark_min, benchmark_max,
                description, created_at, updated_at
         FROM process_kpis
         WHERE process_id = $1
         ORDER BY kpi_code`, [processId]);
            return result.rows.map(this.mapKpi);
        }
        catch (error) {
            logger.error({ err: error, processId }, 'Failed to get KPIs');
            throw error;
        }
    }
    async createKpi(processId, data) {
        try {
            const result = await this.dbClient.query(`INSERT INTO process_kpis (process_id, phase_id, kpi_code, kpi_name,
                                    measurement_unit, target_direction,
                                    benchmark_value, benchmark_min, benchmark_max, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`, [
                processId,
                data.phaseId || null,
                data.kpiCode,
                data.kpiName,
                data.measurementUnit || null,
                data.targetDirection || null,
                data.benchmarkValue || null,
                data.benchmarkMin || null,
                data.benchmarkMax || null,
                data.description || null,
            ]);
            return this.mapKpi(result.rows[0]);
        }
        catch (error) {
            logger.error({ err: error, processId }, 'Failed to create KPI');
            throw error;
        }
    }
    async updateKpi(kpiId, data) {
        try {
            const sets = [];
            const params = [];
            let idx = 1;
            if (data.kpiCode !== undefined) {
                sets.push(`kpi_code = $${idx++}`);
                params.push(data.kpiCode);
            }
            if (data.kpiName !== undefined) {
                sets.push(`kpi_name = $${idx++}`);
                params.push(data.kpiName);
            }
            if (data.phaseId !== undefined) {
                sets.push(`phase_id = $${idx++}`);
                params.push(data.phaseId);
            }
            if (data.measurementUnit !== undefined) {
                sets.push(`measurement_unit = $${idx++}`);
                params.push(data.measurementUnit);
            }
            if (data.targetDirection !== undefined) {
                sets.push(`target_direction = $${idx++}`);
                params.push(data.targetDirection);
            }
            if (data.benchmarkValue !== undefined) {
                sets.push(`benchmark_value = $${idx++}`);
                params.push(data.benchmarkValue);
            }
            if (data.benchmarkMin !== undefined) {
                sets.push(`benchmark_min = $${idx++}`);
                params.push(data.benchmarkMin);
            }
            if (data.benchmarkMax !== undefined) {
                sets.push(`benchmark_max = $${idx++}`);
                params.push(data.benchmarkMax);
            }
            if (data.description !== undefined) {
                sets.push(`description = $${idx++}`);
                params.push(data.description);
            }
            sets.push(`updated_at = NOW()`);
            params.push(kpiId);
            const result = await this.dbClient.query(`UPDATE process_kpis SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params);
            if (result.rows.length === 0) {
                throw new Error(`KPI ${kpiId} not found`);
            }
            return this.mapKpi(result.rows[0]);
        }
        catch (error) {
            logger.error({ err: error, kpiId }, 'Failed to update KPI');
            throw error;
        }
    }
    async deleteKpi(kpiId) {
        try {
            const result = await this.dbClient.query('DELETE FROM process_kpis WHERE id = $1', [kpiId]);
            if (result.rowCount === 0) {
                throw new Error(`KPI ${kpiId} not found`);
            }
        }
        catch (error) {
            logger.error({ err: error, kpiId }, 'Failed to delete KPI');
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // BLUEPRINT TEMPLATES (read-only)
    // ---------------------------------------------------------------------------
    async getTemplates(profileId) {
        try {
            let query = `SELECT id, profile_id, template_name, template_version,
                          description, template_config, is_active, created_by,
                          created_at, updated_at
                   FROM blueprint_templates`;
            const params = [];
            if (profileId) {
                query += ' WHERE profile_id = $1';
                params.push(profileId);
            }
            query += ' ORDER BY template_name';
            const result = await this.dbClient.query(query, params);
            return result.rows.map(this.mapTemplate);
        }
        catch (error) {
            logger.error({ err: error, profileId }, 'Failed to get templates');
            throw error;
        }
    }
    async getTemplateById(templateId) {
        try {
            const result = await this.dbClient.query(`SELECT id, profile_id, template_name, template_version,
                description, template_config, is_active, created_by,
                created_at, updated_at
         FROM blueprint_templates
         WHERE id = $1`, [templateId]);
            if (result.rows.length === 0)
                return null;
            return this.mapTemplate(result.rows[0]);
        }
        catch (error) {
            logger.error({ err: error, templateId }, 'Failed to get template');
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // COMPOSITE: PROCESS DETAIL
    // ---------------------------------------------------------------------------
    async getProcessDetail(processId) {
        try {
            const [processResult, phases, roles, skillReqs, kpis] = await Promise.all([
                this.dbClient.query(`SELECT id, profile_id, process_code, process_name, process_category,
                  value_chain_position, description
           FROM business_processes
           WHERE id = $1`, [processId]),
                this.getPhasesByProcess(processId),
                this.getRolesByProcess(processId),
                this.getSkillRequirementsByProcess(processId),
                this.getKpisByProcess(processId),
            ]);
            if (processResult.rows.length === 0)
                return null;
            const row = processResult.rows[0];
            return {
                process: {
                    id: row.id,
                    profileId: row.profile_id,
                    processCode: row.process_code,
                    processName: row.process_name,
                    processCategory: row.process_category,
                    valueChainPosition: row.value_chain_position,
                    description: row.description,
                },
                phases,
                roles,
                skillRequirements: skillReqs,
                kpis,
            };
        }
        catch (error) {
            logger.error({ err: error, processId }, 'Failed to get process detail');
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // MAPPERS (snake_case DB → camelCase TS)
    // ---------------------------------------------------------------------------
    mapPhase(row) {
        return {
            id: row.id,
            processId: row.process_id,
            phaseCode: row.phase_code,
            phaseName: row.phase_name,
            phaseOrder: row.phase_order,
            description: row.description,
            estimatedDurationDays: row.estimated_duration_days != null
                ? parseFloat(String(row.estimated_duration_days))
                : null,
            isOptional: row.is_optional,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    mapRole(row) {
        return {
            id: row.id,
            processId: row.process_id,
            phaseId: row.phase_id,
            roleName: row.role_name,
            roleType: row.role_type,
            escoOccupationId: row.esco_occupation_id,
            minHeadcount: row.min_headcount,
            maxHeadcount: row.max_headcount,
            description: row.description,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    mapSkillRequirement(row) {
        return {
            id: row.id,
            processId: row.process_id,
            phaseId: row.phase_id,
            escoSkillId: row.esco_skill_id,
            proficiencyLevel: row.proficiency_level,
            isMandatory: row.is_mandatory,
            description: row.description,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    mapKpi(row) {
        return {
            id: row.id,
            processId: row.process_id,
            phaseId: row.phase_id,
            kpiCode: row.kpi_code,
            kpiName: row.kpi_name,
            measurementUnit: row.measurement_unit,
            targetDirection: row.target_direction,
            benchmarkValue: row.benchmark_value != null ? parseFloat(String(row.benchmark_value)) : null,
            benchmarkMin: row.benchmark_min != null ? parseFloat(String(row.benchmark_min)) : null,
            benchmarkMax: row.benchmark_max != null ? parseFloat(String(row.benchmark_max)) : null,
            description: row.description,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    mapTemplate(row) {
        return {
            id: row.id,
            profileId: row.profile_id,
            templateName: row.template_name,
            templateVersion: row.template_version,
            description: row.description,
            templateConfig: row.template_config,
            isActive: row.is_active,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
//# sourceMappingURL=process-layer.js.map