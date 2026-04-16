/**
 * Graph Navigation Service
 * Traverses the knowledge graph connecting processes, skills, employees, org units, and industry classifications.
 * Uses req.dbClient (PoolClient with tenant context) for RLS enforcement.
 */
// =============================================================================
// SERVICE
// =============================================================================
export class GraphNavigationService {
    dbClient;
    constructor(dbClient) {
        this.dbClient = dbClient;
    }
    // ---------------------------------------------------------------------------
    // 1. GET /process/:processId/deep — Full process with all children
    // ---------------------------------------------------------------------------
    async getProcessDeep(processId) {
        const [processRes, phasesRes, rolesRes, skillsRes, kpisRes] = await Promise.all([
            this.dbClient.query(`SELECT id, process_code, process_name, process_category,
                value_chain_position, description, typical_inputs, typical_outputs
         FROM business_processes WHERE id = $1`, [processId]),
            this.dbClient.query(`SELECT id, phase_code, phase_name, phase_order, description,
                estimated_duration_days, is_optional
         FROM process_phases WHERE process_id = $1 ORDER BY phase_order`, [processId]),
            this.dbClient.query(`SELECT pr.id, pr.role_name, pr.role_type, pr.phase_id,
                pr.min_headcount, pr.max_headcount, pr.description,
                eo.preferred_label AS occupation_label, eo.isco_code,
                eo.uri AS occupation_uri
         FROM process_roles pr
         LEFT JOIN esco_occupations eo ON eo.id = pr.esco_occupation_id
         WHERE pr.process_id = $1`, [processId]),
            this.dbClient.query(`SELECT psr.id, psr.phase_id, psr.proficiency_level, psr.is_mandatory,
                psr.description,
                es.preferred_label AS skill_label, es.skill_type, es.uri AS skill_uri
         FROM process_skill_requirements psr
         JOIN esco_skills es ON es.id = psr.esco_skill_id
         WHERE psr.process_id = $1`, [processId]),
            this.dbClient.query(`SELECT id, kpi_code, kpi_name, phase_id, measurement_unit,
                target_direction, benchmark_value, benchmark_min, benchmark_max,
                description
         FROM process_kpis WHERE process_id = $1`, [processId]),
        ]);
        if (processRes.rows.length === 0)
            return null;
        const p = processRes.rows[0];
        return {
            process: {
                id: p.id,
                processCode: p.process_code,
                processName: p.process_name,
                processCategory: p.process_category,
                valueChainPosition: parseFloat(p.value_chain_position),
                description: p.description,
                typicalInputs: p.typical_inputs,
                typicalOutputs: p.typical_outputs,
            },
            phases: phasesRes.rows.map((r) => ({
                id: r.id,
                phaseCode: r.phase_code,
                phaseName: r.phase_name,
                phaseOrder: r.phase_order,
                description: r.description,
                estimatedDurationDays: r.estimated_duration_days != null ? parseFloat(r.estimated_duration_days) : null,
                isOptional: r.is_optional,
            })),
            roles: rolesRes.rows.map((r) => ({
                id: r.id,
                roleName: r.role_name,
                roleType: r.role_type,
                phaseId: r.phase_id,
                minHeadcount: r.min_headcount,
                maxHeadcount: r.max_headcount,
                description: r.description,
                occupationLabel: r.occupation_label,
                iscoCode: r.isco_code,
                occupationUri: r.occupation_uri,
            })),
            skillRequirements: skillsRes.rows.map((r) => ({
                id: r.id,
                phaseId: r.phase_id,
                proficiencyLevel: r.proficiency_level,
                isMandatory: r.is_mandatory,
                description: r.description,
                skillLabel: r.skill_label,
                skillType: r.skill_type,
                skillUri: r.skill_uri,
            })),
            kpis: kpisRes.rows.map((r) => ({
                id: r.id,
                kpiCode: r.kpi_code,
                kpiName: r.kpi_name,
                phaseId: r.phase_id,
                measurementUnit: r.measurement_unit,
                targetDirection: r.target_direction,
                benchmarkValue: r.benchmark_value != null ? parseFloat(r.benchmark_value) : null,
                benchmarkMin: r.benchmark_min != null ? parseFloat(r.benchmark_min) : null,
                benchmarkMax: r.benchmark_max != null ? parseFloat(r.benchmark_max) : null,
                description: r.description,
            })),
        };
    }
    // ---------------------------------------------------------------------------
    // 2. GET /process/:processId/skills — Skills with tenant coverage
    // ---------------------------------------------------------------------------
    async getProcessSkills(processId, tenantId) {
        const result = await this.dbClient.query(`SELECT psr.id, psr.phase_id, psr.proficiency_level, psr.is_mandatory,
              psr.description AS requirement_description,
              es.id AS esco_skill_id, es.preferred_label, es.description AS skill_description,
              es.skill_type, es.uri,
              pp.phase_name,
              (SELECT COUNT(DISTINCT esk.employee_id)
               FROM employee_skills esk
               WHERE esk.esco_skill_id = es.id
                 AND esk.tenant_id = $2
                 AND COALESCE(esk.proficiency_level, 0) >= psr.proficiency_level
              ) AS qualified_employee_count,
              (SELECT COUNT(DISTINCT esk.employee_id)
               FROM employee_skills esk
               WHERE esk.esco_skill_id = es.id
                 AND esk.tenant_id = $2
              ) AS total_employee_count
       FROM process_skill_requirements psr
       JOIN esco_skills es ON es.id = psr.esco_skill_id
       LEFT JOIN process_phases pp ON pp.id = psr.phase_id
       WHERE psr.process_id = $1
       ORDER BY pp.phase_order NULLS FIRST, es.preferred_label`, [processId, tenantId]);
        return result.rows.map((r) => ({
            id: r.id,
            phaseId: r.phase_id,
            proficiencyLevel: r.proficiency_level,
            isMandatory: r.is_mandatory,
            requirementDescription: r.requirement_description,
            escoSkillId: r.esco_skill_id,
            preferredLabel: r.preferred_label,
            skillDescription: r.skill_description,
            skillType: r.skill_type,
            uri: r.uri,
            phaseName: r.phase_name,
            qualifiedEmployeeCount: parseInt(r.qualified_employee_count, 10),
            totalEmployeeCount: parseInt(r.total_employee_count, 10),
        }));
    }
    // ---------------------------------------------------------------------------
    // 3. GET /skill/:skillId/processes — Reverse lookup skill → processes
    // ---------------------------------------------------------------------------
    async getSkillProcesses(skillId) {
        const result = await this.dbClient.query(`SELECT bp.id AS process_id, bp.process_code, bp.process_name,
              bp.process_category,
              psr.proficiency_level, psr.is_mandatory,
              psr.phase_id,
              pp.phase_name, pp.phase_order
       FROM process_skill_requirements psr
       JOIN business_processes bp ON bp.id = psr.process_id
       LEFT JOIN process_phases pp ON pp.id = psr.phase_id
       WHERE psr.esco_skill_id = $1
       ORDER BY bp.process_code, pp.phase_order NULLS FIRST`, [skillId]);
        return result.rows.map((r) => ({
            processId: r.process_id,
            processCode: r.process_code,
            processName: r.process_name,
            processCategory: r.process_category,
            proficiencyLevel: r.proficiency_level,
            isMandatory: r.is_mandatory,
            phaseId: r.phase_id,
            phaseName: r.phase_name,
            phaseOrder: r.phase_order,
        }));
    }
    // ---------------------------------------------------------------------------
    // 4. GET /employee/:employeeId/process-qualification
    // ---------------------------------------------------------------------------
    async getEmployeeProcessQualification(employeeId) {
        const [employeeSkillsRes, processReqsRes] = await Promise.all([
            // Q4a: Employee skills (ESCO-linked only)
            this.dbClient.query(`SELECT esk.esco_skill_id, COALESCE(esk.proficiency_level, 0) AS proficiency_level
         FROM employee_skills esk
         WHERE esk.employee_id = $1
           AND esk.esco_skill_id IS NOT NULL`, [employeeId]),
            // Q4b: All processes with their skill requirements
            this.dbClient.query(`SELECT bp.id AS process_id, bp.process_code, bp.process_name,
                psr.esco_skill_id, psr.proficiency_level AS required_level,
                psr.is_mandatory,
                es.preferred_label AS skill_label
         FROM business_processes bp
         JOIN process_skill_requirements psr ON psr.process_id = bp.id
         JOIN esco_skills es ON es.id = psr.esco_skill_id`),
        ]);
        // Build employee skill map: esco_skill_id → proficiency_level
        const employeeSkillMap = new Map();
        for (const row of employeeSkillsRes.rows) {
            employeeSkillMap.set(row.esco_skill_id, row.proficiency_level);
        }
        // Group requirements by process
        const processMap = new Map();
        for (const row of processReqsRes.rows) {
            if (!processMap.has(row.process_id)) {
                processMap.set(row.process_id, {
                    processCode: row.process_code,
                    processName: row.process_name,
                    requirements: [],
                });
            }
            processMap.get(row.process_id).requirements.push({
                escoSkillId: row.esco_skill_id,
                skillLabel: row.skill_label,
                requiredLevel: row.required_level,
                isMandatory: row.is_mandatory,
            });
        }
        // Calculate qualification per process
        const results = [];
        for (const [processId, proc] of processMap) {
            const totalRequirements = proc.requirements.length;
            let metRequirements = 0;
            const gaps = [];
            for (const req of proc.requirements) {
                const empLevel = employeeSkillMap.get(req.escoSkillId) ?? 0;
                if (empLevel >= req.requiredLevel) {
                    metRequirements++;
                }
                else {
                    gaps.push({
                        escoSkillId: req.escoSkillId,
                        skillLabel: req.skillLabel,
                        requiredLevel: req.requiredLevel,
                        employeeLevel: empLevel,
                    });
                }
            }
            results.push({
                processId,
                processCode: proc.processCode,
                processName: proc.processName,
                totalRequirements,
                metRequirements,
                qualificationScore: totalRequirements > 0
                    ? Math.round((metRequirements / totalRequirements) * 10000) / 100
                    : 100,
                gaps,
            });
        }
        // Sort by qualification score descending
        results.sort((a, b) => b.qualificationScore - a.qualificationScore);
        return results;
    }
    // ---------------------------------------------------------------------------
    // 5. GET /org-unit/:orgUnitId/coverage
    // ---------------------------------------------------------------------------
    async getOrgUnitCoverage(orgUnitId, tenantId) {
        const [employeesRes, skillProfileRes, processesRes] = await Promise.all([
            // Q5a: Employees in org unit
            this.dbClient.query(`SELECT e.id, e.first_name, e.last_name, e.job_title
         FROM employees e
         WHERE e.org_unit_id = $1 AND e.is_active = true`, [orgUnitId]),
            // Q5b: Aggregate skill profile
            this.dbClient.query(`SELECT es.id AS skill_id, es.preferred_label, es.skill_type,
                COUNT(DISTINCT esk.employee_id) AS employee_count,
                ROUND(AVG(COALESCE(esk.proficiency_level, 0)), 1) AS avg_proficiency
         FROM employee_skills esk
         JOIN employees e ON e.id = esk.employee_id
         JOIN esco_skills es ON es.id = esk.esco_skill_id
         WHERE e.org_unit_id = $1 AND e.is_active = true
           AND esk.esco_skill_id IS NOT NULL
         GROUP BY es.id, es.preferred_label, es.skill_type
         ORDER BY employee_count DESC`, [orgUnitId]),
            // Q5c: Mapped processes (via org_unit_templates join on code)
            this.dbClient.query(`SELECT bp.id AS process_id, bp.process_code, bp.process_name,
                opm.responsibility_level
         FROM org_unit_process_mapping opm
         JOIN business_processes bp ON bp.id = opm.process_id
         JOIN org_unit_templates out2 ON out2.id = opm.org_unit_template_id
         JOIN org_units ou ON ou.code = out2.code AND ou.tenant_id = $2
         WHERE ou.id = $1`, [orgUnitId, tenantId]),
        ]);
        return {
            employees: employeesRes.rows.map((r) => ({
                id: r.id,
                firstName: r.first_name,
                lastName: r.last_name,
                jobTitle: r.job_title,
            })),
            skillProfile: skillProfileRes.rows.map((r) => ({
                skillId: r.skill_id,
                preferredLabel: r.preferred_label,
                skillType: r.skill_type,
                employeeCount: parseInt(r.employee_count, 10),
                avgProficiency: parseFloat(r.avg_proficiency),
            })),
            mappedProcesses: processesRes.rows.map((r) => ({
                processId: r.process_id,
                processCode: r.process_code,
                processName: r.process_name,
                responsibilityLevel: r.responsibility_level,
            })),
        };
    }
    // ---------------------------------------------------------------------------
    // 6. GET /org-unit/:orgUnitId/skill-gaps
    // Gap analysis: required skills (from mapped processes) vs available (employee profiles)
    // ---------------------------------------------------------------------------
    async getOrgUnitSkillGaps(orgUnitId, tenantId) {
        const result = await this.dbClient.query(`WITH org_employees AS (
         SELECT id FROM employees WHERE org_unit_id = $1 AND is_active = true
       ),
       required_skills AS (
         SELECT
           psr.esco_skill_id,
           MAX(psr.proficiency_level)::int AS required_level,
           BOOL_OR(psr.is_mandatory) AS is_mandatory,
           COUNT(DISTINCT psr.process_id)::int AS process_count
         FROM process_skill_requirements psr
         JOIN business_processes bp ON bp.id = psr.process_id
         JOIN org_unit_process_mapping opm ON opm.process_id = bp.id
         JOIN org_unit_templates out2 ON out2.id = opm.org_unit_template_id
         JOIN org_units ou ON ou.code = out2.code AND ou.tenant_id = $2
         WHERE ou.id = $1
         GROUP BY psr.esco_skill_id
       ),
       employee_coverage AS (
         SELECT
           esk.esco_skill_id,
           COUNT(DISTINCT esk.employee_id)::int AS employees_with_skill,
           COALESCE(MAX(esk.proficiency_level), 0)::int AS max_proficiency
         FROM employee_skills esk
         WHERE esk.employee_id IN (SELECT id FROM org_employees)
           AND esk.esco_skill_id IS NOT NULL
         GROUP BY esk.esco_skill_id
       ),
       total_emp AS (
         SELECT COUNT(*)::int AS cnt FROM org_employees
       )
       SELECT
         rs.esco_skill_id AS skill_id,
         es.preferred_label AS skill_label,
         es.skill_type,
         rs.required_level,
         COALESCE(ec.max_proficiency, 0) AS available_level,
         rs.is_mandatory,
         rs.process_count,
         COALESCE(ec.employees_with_skill, 0) AS employees_with_skill,
         (SELECT cnt FROM total_emp) AS total_employees
       FROM required_skills rs
       JOIN esco_skills es ON es.id = rs.esco_skill_id
       LEFT JOIN employee_coverage ec ON ec.esco_skill_id = rs.esco_skill_id
       ORDER BY (rs.required_level - COALESCE(ec.max_proficiency, 0)) DESC,
                rs.is_mandatory DESC,
                es.preferred_label`, [orgUnitId, tenantId]);
        return result.rows.map((r) => {
            const requiredLevel = parseInt(r.required_level, 10);
            const availableLevel = parseInt(r.available_level, 10);
            const gapLevel = Math.max(0, requiredLevel - availableLevel);
            const coveragePercent = requiredLevel > 0
                ? Math.round((Math.min(availableLevel, requiredLevel) / requiredLevel) * 100)
                : 100;
            return {
                skillId: r.skill_id,
                skillLabel: r.skill_label,
                skillType: r.skill_type,
                requiredLevel,
                availableLevel,
                gapLevel,
                isMandatory: r.is_mandatory,
                processCount: parseInt(r.process_count, 10),
                employeesWithSkill: parseInt(r.employees_with_skill, 10),
                totalEmployees: parseInt(r.total_employees, 10),
                coveragePercent,
            };
        });
    }
    // ---------------------------------------------------------------------------
    // 7. GET /industry/:industryCode/process-map
    // ---------------------------------------------------------------------------
    async getIndustryProcessMap(industryCode) {
        const [occupationsRes, processesRes, skillsRes] = await Promise.all([
            // Q6a: Occupations linked to industry code
            this.dbClient.query(`SELECT eo.id, eo.preferred_label, eo.isco_code, eo.uri,
                oic.relevance_score
         FROM occupation_industry_classifications oic
         JOIN esco_occupations eo ON eo.id = oic.occupation_id
         WHERE oic.classification_code = $1
         ORDER BY oic.relevance_score DESC`, [industryCode]),
            // Q6b: Processes with roles that have those occupations
            this.dbClient.query(`SELECT DISTINCT bp.id AS process_id, bp.process_code, bp.process_name,
                bp.process_category
         FROM process_roles pr
         JOIN business_processes bp ON bp.id = pr.process_id
         JOIN occupation_industry_classifications oic ON oic.occupation_id = pr.esco_occupation_id
         WHERE oic.classification_code = $1`, [industryCode]),
            // Q6c: Common skills across industry occupations
            this.dbClient.query(`SELECT es.id, es.preferred_label, es.skill_type,
                COUNT(DISTINCT oic.occupation_id) AS occupation_count
         FROM occupation_industry_classifications oic
         JOIN esco_occupations eo ON eo.id = oic.occupation_id
         JOIN process_roles pr ON pr.esco_occupation_id = eo.id
         JOIN process_skill_requirements psr ON psr.process_id = pr.process_id
         JOIN esco_skills es ON es.id = psr.esco_skill_id
         WHERE oic.classification_code = $1
         GROUP BY es.id, es.preferred_label, es.skill_type
         ORDER BY occupation_count DESC`, [industryCode]),
        ]);
        return {
            occupations: occupationsRes.rows.map((r) => ({
                id: r.id,
                preferredLabel: r.preferred_label,
                iscoCode: r.isco_code,
                uri: r.uri,
                relevanceScore: r.relevance_score != null ? parseFloat(r.relevance_score) : null,
            })),
            processes: processesRes.rows.map((r) => ({
                processId: r.process_id,
                processCode: r.process_code,
                processName: r.process_name,
                processCategory: r.process_category,
            })),
            commonSkills: skillsRes.rows.map((r) => ({
                id: r.id,
                preferredLabel: r.preferred_label,
                skillType: r.skill_type,
                occupationCount: parseInt(r.occupation_count, 10),
            })),
        };
    }
    // ---------------------------------------------------------------------------
    // 8. GET /process/:processId/kpi-cascade — KPI cascade with roles and org units
    // ---------------------------------------------------------------------------
    async getProcessKpiCascade(processId, tenantId) {
        const [processRes, kpisRes, rolesRes, orgUnitsRes] = await Promise.all([
            this.dbClient.query(`SELECT id, process_code, process_name
         FROM business_processes WHERE id = $1`, [processId]),
            this.dbClient.query(`SELECT pk.id, pk.kpi_code, pk.kpi_name, pk.phase_id,
                pk.measurement_unit, pk.target_direction,
                pk.benchmark_value, pk.benchmark_min, pk.benchmark_max,
                pk.description,
                pp.phase_name
         FROM process_kpis pk
         LEFT JOIN process_phases pp ON pp.id = pk.phase_id
         WHERE pk.process_id = $1
         ORDER BY pp.phase_order NULLS FIRST, pk.kpi_code`, [processId]),
            this.dbClient.query(`SELECT pr.id, pr.role_name, pr.role_type, pr.phase_id,
                eo.preferred_label AS occupation_label
         FROM process_roles pr
         LEFT JOIN esco_occupations eo ON eo.id = pr.esco_occupation_id
         WHERE pr.process_id = $1`, [processId]),
            this.dbClient.query(`SELECT out2.id AS template_id,
                out2.name_it AS name,
                out2.code,
                opm.responsibility_level,
                COUNT(DISTINCT g.employee_id) AS employees_with_goals,
                COUNT(DISTINCT e.id) AS total_employees
         FROM org_unit_process_mapping opm
         JOIN org_unit_templates out2 ON out2.id = opm.org_unit_template_id
         LEFT JOIN org_units ou ON ou.code = out2.code AND ou.deleted_at IS NULL
                                AND ou.tenant_id = $2
         LEFT JOIN employees e ON e.org_unit_id = ou.id AND e.tenant_id = $2
                               AND e.deleted_at IS NULL
         LEFT JOIN goals g ON g.employee_id = e.id AND g.tenant_id = $2
                           AND g.status IN ('in_progress', 'completed')
         WHERE opm.process_id = $1
         GROUP BY out2.id, out2.name_it, out2.code, opm.responsibility_level`, [processId, tenantId]),
        ]);
        if (processRes.rows.length === 0)
            return null;
        const p = processRes.rows[0];
        const allRoles = rolesRes.rows.map((r) => ({
            id: r.id,
            roleName: r.role_name,
            roleType: r.role_type,
            phaseId: r.phase_id,
            occupationLabel: r.occupation_label,
        }));
        const orgUnits = orgUnitsRes.rows.map((r) => ({
            templateId: r.template_id,
            name: r.name,
            code: r.code,
            responsibilityLevel: r.responsibility_level,
            employeesWithGoals: parseInt(r.employees_with_goals, 10),
            totalEmployees: parseInt(r.total_employees, 10),
        }));
        // Compute overall org-unit goal coverage for alignment derivation
        const totalWithGoals = orgUnits.reduce((s, o) => s + o.employeesWithGoals, 0);
        const totalEmployees = orgUnits.reduce((s, o) => s + o.totalEmployees, 0);
        const coverageRatio = totalEmployees > 0 ? totalWithGoals / totalEmployees : 0;
        const kpis = kpisRes.rows.map((r) => {
            const hasBenchmark = r.benchmark_value != null || (r.benchmark_min != null && r.benchmark_max != null);
            // Roles apply if KPI is phase-specific (same phase) or if no phase (all roles)
            const roles = r.phase_id != null
                ? allRoles.filter((role) => role.phaseId === r.phase_id || role.phaseId === null)
                : allRoles;
            let alignmentStatus;
            if (hasBenchmark && coverageRatio >= 0.6) {
                alignmentStatus = 'aligned';
            }
            else if (hasBenchmark || coverageRatio > 0) {
                alignmentStatus = 'partial';
            }
            else {
                alignmentStatus = 'unaligned';
            }
            return {
                id: r.id,
                kpiCode: r.kpi_code,
                kpiName: r.kpi_name,
                phaseId: r.phase_id,
                phaseName: r.phase_name,
                measurementUnit: r.measurement_unit,
                targetDirection: r.target_direction,
                benchmarkValue: r.benchmark_value != null ? parseFloat(r.benchmark_value) : null,
                benchmarkMin: r.benchmark_min != null ? parseFloat(r.benchmark_min) : null,
                benchmarkMax: r.benchmark_max != null ? parseFloat(r.benchmark_max) : null,
                description: r.description,
                roles,
                alignmentStatus,
            };
        });
        return {
            processId: p.id,
            processName: p.process_name,
            processCode: p.process_code,
            kpis,
            orgUnits,
        };
    }
}
//# sourceMappingURL=graph-navigation.js.map