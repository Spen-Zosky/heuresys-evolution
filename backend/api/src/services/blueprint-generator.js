/**
 * Blueprint Generator Service
 * Dual-mode engine: greenfield (generate from template) + overlay (analyze existing tenant).
 * 5 overlay analyzers: org_units, process_coverage, skill_gaps, hierarchy, KPI coverage.
 * Rule-based deterministic core — no AI calls.
 */
import { logger } from '../config/logger.js';
// =============================================================================
// TEMPLATE CONFIG DEFAULTS
// =============================================================================
const DEFAULT_MAX_SPAN_OF_CONTROL = 10;
const DEFAULT_EXPECTED_ORG_DEPTH = 5;
// =============================================================================
// SERVICE
// =============================================================================
export class BlueprintGeneratorService {
    dbClient;
    constructor(dbClient) {
        this.dbClient = dbClient;
    }
    // ---------------------------------------------------------------------------
    // ENTRY POINT
    // ---------------------------------------------------------------------------
    async runBlueprint(input) {
        const { templateId, tenantId, runMode, createdBy, inputConfig } = input;
        // Load template
        const template = await this.loadTemplate(templateId);
        if (!template) {
            throw new Error(`Blueprint template ${templateId} not found`);
        }
        // Create run record
        const run = await this.createRun({
            tenantId,
            templateId,
            runMode,
            createdBy: createdBy ?? null,
            inputConfig: inputConfig ?? {},
        });
        try {
            await this.updateRunStatus(run.id, 'running');
            let findings;
            if (runMode === 'greenfield') {
                findings = await this.runGreenfield(tenantId, template);
            }
            else {
                findings = await this.runOverlay(tenantId, template);
            }
            // Save results
            const results = await this.saveResults(run.id, findings);
            // Complete run
            const completedRun = await this.completeRun(run.id);
            // Build summary
            const summary = this.buildSummary(results);
            return { run: completedRun, results, summary };
        }
        catch (err) {
            await this.failRun(run.id, err instanceof Error ? err.message : 'Unknown error');
            throw err;
        }
    }
    // ---------------------------------------------------------------------------
    // GREENFIELD MODE
    // ---------------------------------------------------------------------------
    async runGreenfield(_tenantId, template) {
        const findings = [];
        // Load org_unit_templates for this template
        const templateUnits = await this.dbClient.query(`SELECT id, code, name_it, name_en, depth, level
       FROM org_unit_templates
       WHERE template_id = $1
       ORDER BY depth, level`, [template.id]);
        for (const unit of templateUnits.rows) {
            findings.push({
                resultType: 'org_unit_suggestion',
                entityType: 'org_unit_template',
                entityId: unit.id,
                severity: 'info',
                title: `Create org unit: ${unit.name_it || unit.name_en}`,
                description: `Suggested org unit from template — code: ${unit.code}, depth: ${unit.depth}, level: ${unit.level}`,
                suggestedAction: {
                    action: 'create_org_unit',
                    code: unit.code,
                    nameIt: unit.name_it,
                    nameEn: unit.name_en,
                    depth: unit.depth,
                    level: unit.level,
                },
            });
        }
        // Load business_processes for the template's profile
        const processes = await this.dbClient.query(`SELECT bp.id, bp.process_code, bp.process_name, bp.process_category
       FROM business_processes bp
       WHERE bp.profile_id = $1
       ORDER BY bp.value_chain_position`, [template.profileId]);
        // Load process→template mappings
        const mappings = await this.dbClient.query(`SELECT oupm.process_id, out2.code AS template_unit_code, out2.name_it AS template_unit_name
       FROM org_unit_process_mapping oupm
       JOIN org_unit_templates out2 ON out2.id = oupm.org_unit_template_id
       WHERE out2.template_id = $1`, [template.id]);
        const mappingsByProcess = new Map();
        for (const m of mappings.rows) {
            const list = mappingsByProcess.get(m.process_id) ?? [];
            list.push({ code: m.template_unit_code, name: m.template_unit_name });
            mappingsByProcess.set(m.process_id, list);
        }
        for (const proc of processes.rows) {
            const assigned = mappingsByProcess.get(proc.id) ?? [];
            findings.push({
                resultType: 'role_assignment',
                entityType: 'business_process',
                entityId: proc.id,
                severity: 'info',
                title: `Process: ${proc.process_name} (${proc.process_code})`,
                description: assigned.length > 0
                    ? `Mapped to ${assigned.length} org unit(s): ${assigned.map((a) => a.code).join(', ')}`
                    : 'No org unit mapping in template — manual assignment needed',
                suggestedAction: {
                    action: 'assign_process',
                    processCode: proc.process_code,
                    processName: proc.process_name,
                    category: proc.process_category,
                    assignedUnits: assigned,
                },
            });
        }
        return findings;
    }
    // ---------------------------------------------------------------------------
    // OVERLAY MODE
    // ---------------------------------------------------------------------------
    async runOverlay(tenantId, template) {
        const profileId = template.profileId;
        const config = (template.templateConfig ?? {});
        const [orgFindings, processFindings, skillFindings, hierarchyFindings, kpiFindings] = await Promise.all([
            this.analyzeOrgUnits(tenantId, template),
            this.analyzeProcessCoverage(tenantId, profileId),
            this.analyzeSkillGaps(tenantId, profileId),
            this.analyzeHierarchy(tenantId, config),
            this.analyzeKpiCoverage(profileId),
        ]);
        return [
            ...orgFindings,
            ...processFindings,
            ...skillFindings,
            ...hierarchyFindings,
            ...kpiFindings,
        ];
    }
    // ---------------------------------------------------------------------------
    // ANALYZER 1: ORG UNITS
    // ---------------------------------------------------------------------------
    async analyzeOrgUnits(tenantId, template) {
        const findings = [];
        try {
            // Q1: Org units with employee count
            const orgResult = await this.dbClient.query(`SELECT ou.id, ou.code, ou.name, ou.org_type, ou.org_level, ou.is_active,
                COUNT(e.id) AS employee_count
         FROM org_units ou
         LEFT JOIN employees e ON e.org_unit_id = ou.id AND e.tenant_id = $1
         WHERE ou.tenant_id = $1 AND ou.is_active = true AND ou.deleted_at IS NULL
         GROUP BY ou.id
         ORDER BY ou.org_level, ou.name`, [tenantId]);
            // Empty org units → cleanup_action
            for (const unit of orgResult.rows) {
                const count = parseInt(unit.employee_count, 10);
                if (count === 0) {
                    findings.push({
                        resultType: 'cleanup_action',
                        entityType: 'org_unit',
                        entityId: unit.id,
                        severity: 'warning',
                        title: `Empty org unit: ${unit.name} (${unit.code})`,
                        description: `Org unit "${unit.name}" (${unit.org_type}) has 0 employees assigned`,
                        suggestedAction: {
                            action: 'review_org_unit',
                            orgUnitId: unit.id,
                            code: unit.code,
                            name: unit.name,
                            recommendation: 'Consider deactivating or reassigning employees',
                        },
                    });
                }
            }
            // Compare with template org units
            const templateUnits = await this.dbClient.query(`SELECT code, name_it, name_en
         FROM org_unit_templates
         WHERE template_id = $1`, [template.id]);
            const realCodes = new Set(orgResult.rows.map((r) => r.code?.toLowerCase()));
            for (const tu of templateUnits.rows) {
                const templateCode = (tu.code ?? '').toLowerCase();
                if (!realCodes.has(templateCode)) {
                    findings.push({
                        resultType: 'org_unit_suggestion',
                        entityType: 'org_unit_template',
                        entityId: undefined,
                        severity: 'info',
                        title: `Missing org unit: ${tu.name_it || tu.name_en} (${tu.code})`,
                        description: `Template recommends org unit "${tu.code}" but it does not exist in tenant`,
                        suggestedAction: {
                            action: 'create_org_unit',
                            code: tu.code,
                            nameIt: tu.name_it,
                            nameEn: tu.name_en,
                        },
                    });
                }
            }
        }
        catch (err) {
            logger.error({ err, context: 'analyzeOrgUnits' }, 'Failed to analyze org units');
        }
        return findings;
    }
    // ---------------------------------------------------------------------------
    // ANALYZER 2: PROCESS COVERAGE
    // ---------------------------------------------------------------------------
    async analyzeProcessCoverage(tenantId, profileId) {
        const findings = [];
        try {
            // Q2: All processes for the profile
            const processResult = await this.dbClient.query(`SELECT bp.id, bp.process_code, bp.process_name, bp.process_category
         FROM business_processes bp
         WHERE bp.profile_id = $1`, [profileId]);
            // Q3: Template→process mappings
            const mappingResult = await this.dbClient.query(`SELECT oupm.process_id, out2.code AS template_unit_code, out2.name_it AS template_unit_name
         FROM org_unit_process_mapping oupm
         JOIN org_unit_templates out2 ON out2.id = oupm.org_unit_template_id
         JOIN blueprint_templates bt ON bt.id = out2.template_id
         WHERE bt.profile_id = $1`, [profileId]);
            const coveredProcessIds = new Set(mappingResult.rows.map((r) => r.process_id));
            // Processes without any org unit mapping
            for (const proc of processResult.rows) {
                if (!coveredProcessIds.has(proc.id)) {
                    findings.push({
                        resultType: 'process_mapping',
                        entityType: 'business_process',
                        entityId: proc.id,
                        severity: 'critical',
                        title: `Unmapped process: ${proc.process_name} (${proc.process_code})`,
                        description: `Process "${proc.process_name}" has no org unit template mapping — no organizational ownership defined`,
                        suggestedAction: {
                            action: 'map_process',
                            processId: proc.id,
                            processCode: proc.process_code,
                            processName: proc.process_name,
                            category: proc.process_category,
                        },
                    });
                }
            }
            // Check real org units coverage against template mappings
            const realOrgUnits = await this.dbClient.query(`SELECT code, name FROM org_units
         WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL`, [tenantId]);
            const templateCodes = new Set(mappingResult.rows.map((r) => r.template_unit_code?.toLowerCase()));
            // Real org units not in any template mapping
            for (const real of realOrgUnits.rows) {
                const code = (real.code ?? '').toLowerCase();
                if (code && !templateCodes.has(code)) {
                    findings.push({
                        resultType: 'process_mapping',
                        entityType: 'org_unit',
                        entityId: undefined,
                        severity: 'warning',
                        title: `Org unit without process mapping: ${real.name} (${real.code})`,
                        description: `Org unit "${real.name}" does not correspond to any template mapping — process ownership may be undefined`,
                        suggestedAction: {
                            action: 'review_org_unit_processes',
                            code: real.code,
                            name: real.name,
                        },
                    });
                }
            }
        }
        catch (err) {
            logger.error({ err, context: 'analyzeProcessCoverage' }, 'Failed to analyze process coverage');
        }
        return findings;
    }
    // ---------------------------------------------------------------------------
    // ANALYZER 3: SKILL GAPS
    // ---------------------------------------------------------------------------
    async analyzeSkillGaps(tenantId, profileId) {
        const findings = [];
        try {
            // Q4: Skills required by processes
            const requiredResult = await this.dbClient.query(`SELECT psr.id, psr.process_id, psr.esco_skill_id, psr.proficiency_level, psr.is_mandatory,
                bp.process_name,
                es.preferred_label AS skill_name
         FROM process_skill_requirements psr
         JOIN business_processes bp ON bp.id = psr.process_id
         JOIN esco_skills es ON es.id = psr.esco_skill_id
         WHERE bp.profile_id = $1`, [profileId]);
            if (requiredResult.rows.length === 0) {
                return findings;
            }
            // Q5: Employee skills for the tenant
            const employeeSkillsResult = await this.dbClient.query(`SELECT es2.esco_skill_id, es2.proficiency_level, COUNT(*) AS employee_count
         FROM employee_skills es2
         WHERE es2.tenant_id = $1 AND es2.esco_skill_id IS NOT NULL
         GROUP BY es2.esco_skill_id, es2.proficiency_level`, [tenantId]);
            // Build skill→proficiency→count map
            const skillMap = new Map();
            for (const row of employeeSkillsResult.rows) {
                const profMap = skillMap.get(row.esco_skill_id) ?? new Map();
                profMap.set(parseInt(row.proficiency_level, 10), parseInt(row.employee_count, 10));
                skillMap.set(row.esco_skill_id, profMap);
            }
            // Total employees for percentage calculation
            const totalResult = await this.dbClient.query(`SELECT COUNT(*) AS total FROM employees WHERE tenant_id = $1 AND is_active = true`, [tenantId]);
            const totalEmployees = parseInt(totalResult.rows[0]?.total ?? '0', 10);
            for (const req of requiredResult.rows) {
                const profMap = skillMap.get(req.esco_skill_id);
                const requiredLevel = parseInt(req.proficiency_level, 10);
                // Count employees with sufficient proficiency
                let qualifiedCount = 0;
                if (profMap) {
                    for (const [level, count] of profMap) {
                        if (level >= requiredLevel) {
                            qualifiedCount += count;
                        }
                    }
                }
                if (qualifiedCount === 0) {
                    findings.push({
                        resultType: 'skill_gap',
                        entityType: 'process_skill_requirement',
                        entityId: req.id,
                        severity: req.is_mandatory ? 'critical' : 'warning',
                        title: `Skill gap: ${req.skill_name}`,
                        description: `No employees have "${req.skill_name}" at proficiency level ${requiredLevel}+ (required by process "${req.process_name}")`,
                        suggestedAction: {
                            action: 'address_skill_gap',
                            skillName: req.skill_name,
                            escoSkillId: req.esco_skill_id,
                            requiredProficiency: requiredLevel,
                            currentQualified: 0,
                            processName: req.process_name,
                            isMandatory: req.is_mandatory,
                            recommendation: 'Hire or train employees in this skill',
                        },
                    });
                }
                else if (totalEmployees > 0 && qualifiedCount < totalEmployees * 0.5) {
                    // Less than 50% of employees qualified
                    const avgProficiency = this.computeAvgProficiency(profMap);
                    findings.push({
                        resultType: 'skill_gap',
                        entityType: 'process_skill_requirement',
                        entityId: req.id,
                        severity: 'warning',
                        title: `Low coverage: ${req.skill_name}`,
                        description: `Only ${qualifiedCount}/${totalEmployees} employees (${Math.round((qualifiedCount / totalEmployees) * 100)}%) have "${req.skill_name}" at level ${requiredLevel}+`,
                        suggestedAction: {
                            action: 'improve_skill_coverage',
                            skillName: req.skill_name,
                            escoSkillId: req.esco_skill_id,
                            requiredProficiency: requiredLevel,
                            avgProficiency,
                            currentQualified: qualifiedCount,
                            totalEmployees,
                            processName: req.process_name,
                        },
                    });
                }
            }
        }
        catch (err) {
            logger.error({ err, context: 'analyzeSkillGaps' }, 'Failed to analyze skill gaps');
        }
        return findings;
    }
    // ---------------------------------------------------------------------------
    // ANALYZER 4: HIERARCHY
    // ---------------------------------------------------------------------------
    async analyzeHierarchy(tenantId, config) {
        const findings = [];
        // expected_org_depth lives at config top level; max_span_of_control inside validation_rules
        const validationRules = (config.validation_rules ?? {});
        const maxSpan = typeof validationRules.max_span_of_control === 'number'
            ? validationRules.max_span_of_control
            : DEFAULT_MAX_SPAN_OF_CONTROL;
        const expectedDepth = typeof config.expected_org_depth === 'number'
            ? config.expected_org_depth
            : DEFAULT_EXPECTED_ORG_DEPTH;
        try {
            // Q6: Span of control
            const spanResult = await this.dbClient.query(`SELECT e.manager_id, COUNT(*) AS direct_reports,
                m.first_name || ' ' || m.last_name AS manager_name
         FROM employees e
         JOIN employees m ON m.id = e.manager_id AND m.tenant_id = $1
         WHERE e.tenant_id = $1 AND e.manager_id IS NOT NULL
         GROUP BY e.manager_id, m.first_name, m.last_name`, [tenantId]);
            for (const row of spanResult.rows) {
                const directReports = parseInt(row.direct_reports, 10);
                if (directReports > maxSpan) {
                    findings.push({
                        resultType: 'cleanup_action',
                        entityType: 'employee',
                        entityId: row.manager_id,
                        severity: 'warning',
                        title: `Excessive span of control: ${row.manager_name}`,
                        description: `Manager "${row.manager_name}" has ${directReports} direct reports (max recommended: ${maxSpan})`,
                        suggestedAction: {
                            action: 'review_span_of_control',
                            managerId: row.manager_id,
                            managerName: row.manager_name,
                            directReports,
                            maxRecommended: maxSpan,
                            recommendation: 'Consider restructuring team or adding intermediate managers',
                        },
                    });
                }
            }
            // Q7: Employees without manager (excluding top-level)
            const orphanResult = await this.dbClient.query(`SELECT e.id, e.first_name, e.last_name
         FROM employees e
         WHERE e.tenant_id = $1 AND e.manager_id IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM org_units ou
             WHERE ou.manager_id = e.id AND ou.org_level = 1 AND ou.tenant_id = $1
           )`, [tenantId]);
            for (const row of orphanResult.rows) {
                findings.push({
                    resultType: 'cleanup_action',
                    entityType: 'employee',
                    entityId: row.id,
                    severity: 'critical',
                    title: `Employee without manager: ${row.first_name} ${row.last_name}`,
                    description: `Employee "${row.first_name} ${row.last_name}" has no manager assigned and is not a top-level org unit manager`,
                    suggestedAction: {
                        action: 'assign_manager',
                        employeeId: row.id,
                        employeeName: `${row.first_name} ${row.last_name}`,
                        recommendation: 'Assign a direct manager',
                    },
                });
            }
            // Q8: Hierarchy depth
            const depthResult = await this.dbClient.query(`SELECT MAX(ou.org_level) AS max_depth FROM org_units ou
         WHERE ou.tenant_id = $1 AND ou.is_active = true AND ou.deleted_at IS NULL`, [tenantId]);
            const maxDepth = parseInt(depthResult.rows[0]?.max_depth ?? '0', 10);
            if (maxDepth > 0 && maxDepth !== expectedDepth) {
                const severity = Math.abs(maxDepth - expectedDepth) > 2 ? 'warning' : 'info';
                findings.push({
                    resultType: 'cleanup_action',
                    entityType: 'org_hierarchy',
                    severity,
                    title: `Hierarchy depth: ${maxDepth} levels (expected: ${expectedDepth})`,
                    description: `Org hierarchy has ${maxDepth} levels; template expects ${expectedDepth}. ${maxDepth > expectedDepth ? 'Consider flattening' : 'May need more structure'}`,
                    suggestedAction: {
                        action: 'review_hierarchy_depth',
                        currentDepth: maxDepth,
                        expectedDepth,
                    },
                });
            }
        }
        catch (err) {
            logger.error({ err, context: 'analyzeHierarchy' }, 'Failed to analyze hierarchy');
        }
        return findings;
    }
    // ---------------------------------------------------------------------------
    // ANALYZER 5: KPI COVERAGE
    // ---------------------------------------------------------------------------
    async analyzeKpiCoverage(profileId) {
        const findings = [];
        try {
            // Q9: Processes without KPIs
            const result = await this.dbClient.query(`SELECT bp.id, bp.process_code, bp.process_name,
                COUNT(pk.id) AS kpi_count
         FROM business_processes bp
         LEFT JOIN process_kpis pk ON pk.process_id = bp.id
         WHERE bp.profile_id = $1
         GROUP BY bp.id
         HAVING COUNT(pk.id) = 0`, [profileId]);
            for (const row of result.rows) {
                findings.push({
                    resultType: 'kpi_target',
                    entityType: 'business_process',
                    entityId: row.id,
                    severity: 'warning',
                    title: `No KPIs for process: ${row.process_name} (${row.process_code})`,
                    description: `Process "${row.process_name}" has no KPIs defined — performance cannot be measured`,
                    suggestedAction: {
                        action: 'define_kpis',
                        processId: row.id,
                        processCode: row.process_code,
                        processName: row.process_name,
                        recommendation: 'Define at least one KPI for this process',
                    },
                });
            }
        }
        catch (err) {
            logger.error({ err, context: 'analyzeKpiCoverage' }, 'Failed to analyze KPI coverage');
        }
        return findings;
    }
    // ---------------------------------------------------------------------------
    // RUN LIFECYCLE
    // ---------------------------------------------------------------------------
    async loadTemplate(templateId) {
        const result = await this.dbClient.query(`SELECT id, profile_id, template_name, template_version, description,
              template_config, is_active, created_by, created_at, updated_at
       FROM blueprint_templates
       WHERE id = $1 AND is_active = true`, [templateId]);
        if (result.rows.length === 0)
            return null;
        return this.mapTemplate(result.rows[0]);
    }
    async createRun(params) {
        const result = await this.dbClient.query(`INSERT INTO blueprint_runs (tenant_id, template_id, run_mode, status, input_config, created_by)
       VALUES ($1, $2, $3, 'pending', $4, $5)
       RETURNING *`, [
            params.tenantId,
            params.templateId,
            params.runMode,
            JSON.stringify(params.inputConfig),
            params.createdBy,
        ]);
        return this.mapRun(result.rows[0]);
    }
    async updateRunStatus(runId, status) {
        const setClauses = ['status = $2', 'updated_at = NOW()'];
        if (status === 'running') {
            setClauses.push('started_at = NOW()');
        }
        await this.dbClient.query(`UPDATE blueprint_runs SET ${setClauses.join(', ')} WHERE id = $1`, [
            runId,
            status,
        ]);
    }
    async completeRun(runId) {
        const result = await this.dbClient.query(`UPDATE blueprint_runs
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`, [runId]);
        return this.mapRun(result.rows[0]);
    }
    async failRun(runId, errorMessage) {
        try {
            await this.dbClient.query(`UPDATE blueprint_runs
         SET status = 'failed', error_message = $2, completed_at = NOW(), updated_at = NOW()
         WHERE id = $1`, [runId, errorMessage]);
        }
        catch (err) {
            logger.error({ err, runId }, 'Failed to update run status to failed');
        }
    }
    // ---------------------------------------------------------------------------
    // SAVE RESULTS
    // ---------------------------------------------------------------------------
    async saveResults(runId, findings) {
        if (findings.length === 0)
            return [];
        const results = [];
        for (const finding of findings) {
            const result = await this.dbClient.query(`INSERT INTO blueprint_results
           (run_id, result_type, entity_type, entity_id, severity, title, description, suggested_action)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`, [
                runId,
                finding.resultType,
                finding.entityType ?? null,
                finding.entityId ?? null,
                finding.severity,
                finding.title,
                finding.description,
                finding.suggestedAction ? JSON.stringify(finding.suggestedAction) : null,
            ]);
            results.push(this.mapResult(result.rows[0]));
        }
        return results;
    }
    // ---------------------------------------------------------------------------
    // SUMMARY
    // ---------------------------------------------------------------------------
    buildSummary(results) {
        const bySeverity = {};
        const byType = {};
        for (const r of results) {
            const sev = r.severity ?? 'unknown';
            bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;
            byType[r.resultType] = (byType[r.resultType] ?? 0) + 1;
        }
        return { total: results.length, bySeverity, byType };
    }
    // ---------------------------------------------------------------------------
    // HELPERS
    // ---------------------------------------------------------------------------
    computeAvgProficiency(profMap) {
        if (!profMap || profMap.size === 0)
            return 0;
        let totalLevel = 0;
        let totalCount = 0;
        for (const [level, count] of profMap) {
            totalLevel += level * count;
            totalCount += count;
        }
        return totalCount > 0 ? Math.round((totalLevel / totalCount) * 10) / 10 : 0;
    }
    // ---------------------------------------------------------------------------
    // ROW MAPPERS
    // ---------------------------------------------------------------------------
    mapTemplate(row) {
        return {
            id: row.id,
            profileId: row.profile_id,
            templateName: row.template_name,
            templateVersion: row.template_version,
            description: row.description ?? null,
            templateConfig: row.template_config ?? {},
            isActive: row.is_active,
            createdBy: row.created_by ?? null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    mapRun(row) {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            templateId: row.template_id,
            runMode: row.run_mode,
            status: row.status,
            inputConfig: row.input_config ?? {},
            startedAt: row.started_at ?? null,
            completedAt: row.completed_at ?? null,
            createdBy: row.created_by ?? null,
            errorMessage: row.error_message ?? null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    mapResult(row) {
        return {
            id: row.id,
            runId: row.run_id,
            resultType: row.result_type,
            entityType: row.entity_type ?? null,
            entityId: row.entity_id ?? null,
            severity: row.severity ?? null,
            title: row.title,
            description: row.description ?? null,
            suggestedAction: row.suggested_action ?? null,
            isApplied: row.is_applied,
            appliedAt: row.applied_at ?? null,
            appliedBy: row.applied_by ?? null,
            createdAt: row.created_at,
        };
    }
}
//# sourceMappingURL=blueprint-generator.js.map