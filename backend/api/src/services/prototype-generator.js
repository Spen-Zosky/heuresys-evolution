/**
 * Prototype Generator Service
 * Generates complete organizational structures from industry prototypes
 * Part of Tenant Prototype Generator System
 */
import { pool } from '../config/database.js';
import { BusinessProcessResearchService } from './business-process-research.js';
// =============================================================================
// PROTOTYPE GENERATOR SERVICE
// =============================================================================
export class PrototypeGeneratorService {
    tenantId;
    processResearchService;
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.processResearchService = new BusinessProcessResearchService(tenantId);
    }
    // ---------------------------------------------------------------------------
    // MAIN GENERATION METHOD
    // ---------------------------------------------------------------------------
    /**
     * Generate complete organizational structure from prototype
     */
    async generateFromPrototype(prototypeId, _config) {
        const startTime = Date.now();
        // Create generation session
        const sessionId = await this.createSession(prototypeId);
        try {
            // Get prototype details
            const prototype = await this.getPrototype(prototypeId);
            await this.updateSessionStatus(sessionId, 'researching');
            // Research business processes
            const naceCode = `${prototype.naceSection}${prototype.naceDivision}`;
            const processResearch = await this.processResearchService.researchIndustryProcesses(naceCode, prototype.sizeClass);
            // Generate org structure
            await this.updateSessionStatus(sessionId, 'generating_structure');
            const orgUnits = await this.generateOrgStructure(prototype, processResearch.processes);
            // Generate job roles
            await this.updateSessionStatus(sessionId, 'generating_roles');
            const jobRoles = await this.generateJobRoles(prototype, orgUnits);
            // Calculate staffing
            await this.updateSessionStatus(sessionId, 'calculating_staffing');
            const staffingPlan = await this.generateStaffing(prototypeId, orgUnits, jobRoles, prototype.sizeClass);
            // Define tasks
            await this.updateSessionStatus(sessionId, 'defining_tasks');
            const tasks = await this.generateTasks(orgUnits, processResearch.processes);
            // Define KPIs
            await this.updateSessionStatus(sessionId, 'defining_kpis');
            const kpis = await this.generateKPIs(orgUnits, processResearch.processes);
            // Distribute tasks and KPIs
            await this.updateSessionStatus(sessionId, 'distributing');
            const taskDistributions = await this.distributeTasksToRoles(tasks, jobRoles);
            const kpiDistributions = await this.distributeKPIsToRoles(kpis, jobRoles);
            // Build result
            const processingTimeMs = Date.now() - startTime;
            const result = {
                sessionId,
                tenantId: this.tenantId,
                prototypeId,
                status: 'completed',
                statistics: {
                    orgUnitsGenerated: orgUnits.length,
                    jobRolesAssigned: jobRoles.length,
                    staffingRulesApplied: staffingPlan.byOrgUnit.length,
                    tasksCreated: tasks.length,
                    kpisCreated: kpis.length,
                    taskDistributions: taskDistributions.length,
                    kpiDistributions: kpiDistributions.length,
                    processingTimeMs,
                },
                orgUnits,
                jobRoles,
                staffingPlan,
                tasks,
                kpis,
                taskDistributions,
                kpiDistributions,
                generatedAt: new Date(),
                completedAt: new Date(),
            };
            // Update session with results
            await this.completeSession(sessionId, result);
            return result;
        }
        catch (error) {
            await this.failSession(sessionId, error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // SESSION MANAGEMENT
    // ---------------------------------------------------------------------------
    async createSession(_prototypeId) {
        const result = await pool.query(`
      INSERT INTO org_chart_generation_sessions (tenant_id, status, started_at)
      VALUES ($1, 'pending', NOW())
      RETURNING id
    `, [this.tenantId]);
        return result.rows[0].id;
    }
    async updateSessionStatus(sessionId, status) {
        await pool.query(`
      UPDATE org_chart_generation_sessions
      SET status = $2, updated_at = NOW()
      WHERE id = $1
    `, [sessionId, status]);
    }
    async completeSession(sessionId, result) {
        await pool.query(`
      UPDATE org_chart_generation_sessions
      SET status = 'completed',
          generated_structure = $2,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [sessionId, JSON.stringify(result.statistics)]);
    }
    async failSession(sessionId, errorMessage) {
        await pool.query(`
      UPDATE org_chart_generation_sessions
      SET status = 'failed',
          error_message = $2,
          updated_at = NOW()
      WHERE id = $1
    `, [sessionId, errorMessage]);
    }
    // ---------------------------------------------------------------------------
    // PROTOTYPE RETRIEVAL
    // ---------------------------------------------------------------------------
    async getPrototype(prototypeId) {
        const result = await pool.query(`
      SELECT * FROM industry_profiles WHERE id = $1
    `, [prototypeId]);
        if (result.rows.length === 0) {
            throw new Error(`Prototype not found: ${prototypeId}`);
        }
        const row = result.rows[0];
        return {
            id: row.id,
            code: row.code,
            name: row.name,
            description: row.description,
            naceSection: row.nace_section,
            naceDivision: row.nace_division,
            naceGroup: row.nace_group,
            sizeClass: row.size_class.toLowerCase(),
            minEmployees: row.min_employees,
            maxEmployees: row.max_employees,
            typicalDepartments: row.typical_departments || [],
            typicalRoles: row.typical_roles || [],
            typicalHierarchy: row.typical_hierarchy?.levels || [],
            typicalSpanOfControl: row.typical_span_of_control || [5, 7, 10, 8, 6, 4],
            escoOccupationCodes: row.esco_occupation_codes || [],
            orgUnitTemplates: row.department_templates || [],
        };
    }
    // ---------------------------------------------------------------------------
    // ORG STRUCTURE GENERATION
    // ---------------------------------------------------------------------------
    async generateOrgStructure(prototype, processes) {
        const orgUnits = [];
        // CEO level
        orgUnits.push({
            code: 'CEO',
            nameIt: 'Amministratore Delegato',
            nameEn: 'Chief Executive Officer',
            level: 1,
            processIds: [],
        });
        // Generate divisions based on value chain
        const primaryProcesses = processes.filter((p) => p.processCategory === 'primary');
        const supportProcesses = processes.filter((p) => p.processCategory === 'support');
        // Group primary processes into divisions
        const divisionMappings = this.groupProcessesToDivisions(primaryProcesses, supportProcesses);
        let divisionIndex = 0;
        for (const [divisionName, divisionProcesses] of Object.entries(divisionMappings)) {
            divisionIndex++;
            const divCode = `DIR-${this.getDivisionCode(divisionName)}`;
            // Add division
            orgUnits.push({
                code: divCode,
                nameIt: this.getItalianName(divisionName),
                nameEn: divisionName,
                level: 2,
                parentCode: 'CEO',
                processIds: divisionProcesses.map((p) => p.processCode),
            });
            // Add departments under division (for medium+ companies)
            if (prototype.sizeClass !== 'micro' && prototype.sizeClass !== 'small') {
                for (let deptNum = 1; deptNum <= 2; deptNum++) {
                    const deptCode = `DEPT-${this.getDivisionCode(divisionName)}-${deptNum}`;
                    orgUnits.push({
                        code: deptCode,
                        nameIt: `${this.getItalianName(divisionName)} - Reparto ${deptNum}`,
                        nameEn: `${divisionName} - OrgUnit ${deptNum}`,
                        level: 3,
                        parentCode: divCode,
                        processIds: [],
                    });
                }
            }
        }
        return orgUnits;
    }
    groupProcessesToDivisions(primaryProcesses, supportProcesses) {
        const divisions = {
            Operations: [],
            Commercial: [],
            'Finance & Admin': [],
            'Human Resources': [],
            'Information Technology': [],
            'Quality & Compliance': [],
        };
        // Map primary processes
        for (const process of primaryProcesses) {
            switch (process.valueChainPosition) {
                case 1: // Inbound logistics
                case 2: // Operations
                case 3: // Outbound logistics
                    divisions['Operations'].push(process);
                    break;
                case 4: // Marketing & Sales
                case 5: // Service
                    divisions['Commercial'].push(process);
                    break;
            }
        }
        // Map support processes
        for (const process of supportProcesses) {
            switch (process.valueChainPosition) {
                case 6: // Procurement
                    divisions['Operations'].push(process);
                    break;
                case 7: // Technology
                    divisions['Information Technology'].push(process);
                    break;
                case 8: // HR
                    divisions['Human Resources'].push(process);
                    break;
                case 9: // Infrastructure
                    if (process.processName.toLowerCase().includes('risk') ||
                        process.processName.toLowerCase().includes('compliance') ||
                        process.processName.toLowerCase().includes('quality')) {
                        divisions['Quality & Compliance'].push(process);
                    }
                    else {
                        divisions['Finance & Admin'].push(process);
                    }
                    break;
            }
        }
        // Remove empty divisions
        return Object.fromEntries(Object.entries(divisions).filter(([, processes]) => processes.length > 0));
    }
    getDivisionCode(divisionName) {
        const codes = {
            Operations: 'OPS',
            Commercial: 'COMM',
            'Finance & Admin': 'AFC',
            'Human Resources': 'HR',
            'Information Technology': 'IT',
            'Quality & Compliance': 'QSE',
            'Research & Development': 'RD',
            Corporate: 'CORP',
        };
        return codes[divisionName] || divisionName.substring(0, 3).toUpperCase();
    }
    getItalianName(englishName) {
        const translations = {
            Operations: 'Operazioni',
            Commercial: 'Commerciale',
            'Finance & Admin': 'Amministrazione e Finanza',
            'Human Resources': 'Risorse Umane',
            'Information Technology': 'Sistemi Informativi',
            'Quality & Compliance': 'Qualità e Compliance',
            'Research & Development': 'Ricerca e Sviluppo',
            Corporate: 'Direzione Generale',
        };
        return translations[englishName] || englishName;
    }
    // ---------------------------------------------------------------------------
    // JOB ROLE GENERATION
    // ---------------------------------------------------------------------------
    async generateJobRoles(prototype, orgUnits) {
        const jobRoles = [];
        for (const orgUnit of orgUnits) {
            const roles = this.getRolesForOrgUnit(orgUnit, prototype.sizeClass);
            jobRoles.push(...roles);
        }
        return jobRoles;
    }
    getRolesForOrgUnit(orgUnit, sizeClass) {
        const roles = [];
        switch (orgUnit.level) {
            case 1: // CEO
                roles.push({
                    jobCode: `${orgUnit.code}-EXEC`,
                    titleIt: 'Amministratore Delegato',
                    titleEn: 'Chief Executive Officer',
                    orgUnitCode: orgUnit.code,
                    orgLevel: 1,
                    isManagement: true,
                });
                break;
            case 2: // Division
                roles.push({
                    jobCode: `${orgUnit.code}-DIR`,
                    titleIt: 'Direttore',
                    titleEn: 'Director',
                    orgUnitCode: orgUnit.code,
                    orgLevel: 2,
                    isManagement: true,
                });
                if (sizeClass !== 'micro' && sizeClass !== 'small') {
                    roles.push({
                        jobCode: `${orgUnit.code}-VDIR`,
                        titleIt: 'Vice Direttore',
                        titleEn: 'Deputy Director',
                        orgUnitCode: orgUnit.code,
                        orgLevel: 2,
                        isManagement: true,
                    });
                }
                break;
            case 3: // OrgUnit
                roles.push({
                    jobCode: `${orgUnit.code}-MGR`,
                    titleIt: 'Responsabile',
                    titleEn: 'Manager',
                    orgUnitCode: orgUnit.code,
                    orgLevel: 3,
                    isManagement: true,
                });
                roles.push({
                    jobCode: `${orgUnit.code}-SMGR`,
                    titleIt: 'Senior Manager',
                    titleEn: 'Senior Manager',
                    orgUnitCode: orgUnit.code,
                    orgLevel: 3,
                    isManagement: false,
                });
                break;
        }
        return roles;
    }
    // ---------------------------------------------------------------------------
    // STAFFING CALCULATION
    // ---------------------------------------------------------------------------
    async generateStaffing(prototypeId, orgUnits, jobRoles, sizeClass) {
        // Get staffing rules from database
        const rulesResult = await pool.query(`
      SELECT
        psr.org_unit_template_id,
        psr.job_template_id,
        psr.min_headcount,
        psr.max_headcount,
        psr.recommended_headcount,
        psr.is_mandatory,
        out.code as org_unit_code,
        jt.job_code
      FROM org_prototype_rules psr
      JOIN org_unit_templates out ON psr.org_unit_template_id = out.id
      JOIN job_templates jt ON psr.job_template_id = jt.id
      WHERE psr.prototype_id = $1
        AND psr.company_size = $2
    `, [prototypeId, sizeClass.toUpperCase()]);
        const staffingByOrgUnit = [];
        let totalHeadcount = 0;
        // Build staffing plan by org unit
        for (const orgUnit of orgUnits) {
            const unitRoles = jobRoles.filter((r) => r.orgUnitCode === orgUnit.code);
            const roleHeadcounts = [];
            for (const role of unitRoles) {
                // Find matching rule
                const rule = rulesResult.rows.find((r) => r.org_unit_code === orgUnit.code && r.job_code === role.jobCode);
                const count = rule?.recommended_headcount || rule?.min_headcount || 1;
                roleHeadcounts.push({ jobCode: role.jobCode, count });
                totalHeadcount += count;
            }
            if (unitRoles.length > 0) {
                staffingByOrgUnit.push({
                    orgUnitCode: orgUnit.code,
                    headcount: roleHeadcounts.reduce((sum, r) => sum + r.count, 0),
                    roles: roleHeadcounts,
                });
            }
        }
        return {
            totalHeadcount,
            byOrgUnit: staffingByOrgUnit,
            bySizeClass: sizeClass,
        };
    }
    // ---------------------------------------------------------------------------
    // TASK GENERATION
    // ---------------------------------------------------------------------------
    async generateTasks(orgUnits, processes) {
        const tasks = [];
        let taskIndex = 0;
        for (const orgUnit of orgUnits) {
            if (orgUnit.level < 2)
                continue; // Skip CEO level
            // Generate tasks based on associated processes
            const unitProcesses = processes.filter((p) => orgUnit.processIds.includes(p.processCode));
            if (unitProcesses.length === 0) {
                // Generate generic tasks for units without specific processes
                const genericTasks = this.generateGenericTasks(orgUnit);
                tasks.push(...genericTasks);
            }
            else {
                for (const process of unitProcesses) {
                    taskIndex++;
                    tasks.push({
                        taskCode: `TSK-${orgUnit.code}-${String(taskIndex).padStart(2, '0')}`,
                        taskName: `Manage ${process.processName}`,
                        orgUnitCode: orgUnit.code,
                        frequency: 'daily',
                        complexityLevel: 3,
                        estimatedHours: 4,
                    });
                }
            }
        }
        return tasks;
    }
    generateGenericTasks(orgUnit) {
        const tasks = [];
        const divisionCode = orgUnit.code.split('-')[1] ?? '';
        const genericTasksByDivision = {
            OPS: [
                { name: 'Daily Operations Review', frequency: 'daily', complexity: 3 },
                { name: 'Process Optimization', frequency: 'weekly', complexity: 4 },
            ],
            COMM: [
                { name: 'Sales Pipeline Review', frequency: 'weekly', complexity: 3 },
                { name: 'Customer Relationship Management', frequency: 'daily', complexity: 3 },
            ],
            AFC: [
                { name: 'Financial Reporting', frequency: 'monthly', complexity: 4 },
                { name: 'Budget Analysis', frequency: 'weekly', complexity: 3 },
            ],
            HR: [
                { name: 'Recruitment Management', frequency: 'on_demand', complexity: 3 },
                { name: 'Performance Review Coordination', frequency: 'quarterly', complexity: 4 },
            ],
            IT: [
                { name: 'System Monitoring', frequency: 'daily', complexity: 2 },
                { name: 'Change Management', frequency: 'weekly', complexity: 4 },
            ],
            QSE: [
                { name: 'Compliance Monitoring', frequency: 'daily', complexity: 4 },
                { name: 'Risk Assessment', frequency: 'monthly', complexity: 5 },
            ],
        };
        const divisionTasks = genericTasksByDivision[divisionCode] || [
            { name: 'OrgUnit Management', frequency: 'daily', complexity: 3 },
        ];
        for (let i = 0; i < divisionTasks.length; i++) {
            const task = divisionTasks[i];
            tasks.push({
                taskCode: `TSK-${orgUnit.code}-${String(i + 1).padStart(2, '0')}`,
                taskName: task.name,
                orgUnitCode: orgUnit.code,
                frequency: task.frequency,
                complexityLevel: task.complexity,
                estimatedHours: task.complexity * 2,
            });
        }
        return tasks;
    }
    // ---------------------------------------------------------------------------
    // KPI GENERATION
    // ---------------------------------------------------------------------------
    async generateKPIs(orgUnits, _processes) {
        const kpis = [];
        for (const orgUnit of orgUnits) {
            if (orgUnit.level < 2)
                continue;
            const unitKPIs = this.getKPIsForOrgUnit(orgUnit);
            kpis.push(...unitKPIs);
        }
        return kpis;
    }
    getKPIsForOrgUnit(orgUnit) {
        const kpis = [];
        const divisionCode = orgUnit.code.split('-')[1] ?? '';
        const kpiTemplates = {
            OPS: [
                { name: 'Operational Efficiency', unit: '%', direction: 'increase', benchmark: 90 },
                { name: 'Quality Rate', unit: '%', direction: 'increase', benchmark: 98 },
            ],
            COMM: [
                { name: 'Revenue Growth', unit: '%', direction: 'increase', benchmark: 10 },
                { name: 'Customer Satisfaction', unit: 'score', direction: 'increase', benchmark: 4.5 },
            ],
            AFC: [
                { name: 'Cost-to-Income Ratio', unit: '%', direction: 'decrease', benchmark: 60 },
                { name: 'Budget Variance', unit: '%', direction: 'decrease', benchmark: 5 },
            ],
            HR: [
                { name: 'Employee Turnover', unit: '%', direction: 'decrease', benchmark: 10 },
                { name: 'Training Completion', unit: '%', direction: 'increase', benchmark: 95 },
            ],
            IT: [
                { name: 'System Availability', unit: '%', direction: 'increase', benchmark: 99.5 },
                { name: 'Incident Resolution Time', unit: 'hours', direction: 'decrease', benchmark: 4 },
            ],
            QSE: [
                { name: 'Compliance Score', unit: '%', direction: 'increase', benchmark: 100 },
                { name: 'Audit Findings', unit: 'count', direction: 'decrease', benchmark: 0 },
            ],
        };
        const divisionKPIs = kpiTemplates[divisionCode] || [
            { name: 'Performance Index', unit: '%', direction: 'increase', benchmark: 90 },
        ];
        for (let i = 0; i < divisionKPIs.length; i++) {
            const kpi = divisionKPIs[i];
            kpis.push({
                kpiCode: `KPI-${orgUnit.code}-${String(i + 1).padStart(2, '0')}`,
                kpiName: kpi.name,
                orgUnitCode: orgUnit.code,
                measurementUnit: kpi.unit,
                targetDirection: kpi.direction,
                benchmarkValue: kpi.benchmark,
            });
        }
        return kpis;
    }
    // ---------------------------------------------------------------------------
    // DISTRIBUTION METHODS
    // ---------------------------------------------------------------------------
    async distributeTasksToRoles(tasks, roles) {
        const distributions = [];
        for (const task of tasks) {
            // Find roles in the same org unit
            const unitRoles = roles.filter((r) => r.orgUnitCode === task.orgUnitCode || task.orgUnitCode.startsWith(r.orgUnitCode));
            if (unitRoles.length === 0)
                continue;
            // Assign primary owner (manager)
            const manager = unitRoles.find((r) => r.isManagement);
            if (manager) {
                distributions.push({
                    jobCode: manager.jobCode,
                    taskCode: task.taskCode,
                    responsibilityPercentage: 30,
                    isPrimaryOwner: true,
                });
            }
            // Assign secondary contributors
            const contributors = unitRoles.filter((r) => !r.isManagement);
            const remainingPercent = manager ? 70 : 100;
            const perContributor = contributors.length > 0 ? Math.floor(remainingPercent / contributors.length) : 0;
            for (const contributor of contributors) {
                distributions.push({
                    jobCode: contributor.jobCode,
                    taskCode: task.taskCode,
                    responsibilityPercentage: perContributor,
                    isPrimaryOwner: false,
                });
            }
        }
        return distributions;
    }
    async distributeKPIsToRoles(kpis, roles) {
        const distributions = [];
        for (const kpi of kpis) {
            // Find roles in the same org unit
            const unitRoles = roles.filter((r) => r.orgUnitCode === kpi.orgUnitCode || kpi.orgUnitCode.startsWith(r.orgUnitCode));
            if (unitRoles.length === 0)
                continue;
            // Director is owner
            const director = unitRoles.find((r) => r.jobCode.includes('-DIR') && !r.jobCode.includes('-VDIR'));
            if (director) {
                distributions.push({
                    jobCode: director.jobCode,
                    kpiCode: kpi.kpiCode,
                    accountabilityLevel: 'owner',
                    weightPercentage: 40,
                });
            }
            // Managers are contributors
            const managers = unitRoles.filter((r) => r.jobCode.includes('-MGR') || r.jobCode.includes('-SMGR') || r.jobCode.includes('-VDIR'));
            const perManager = managers.length > 0 ? Math.floor(60 / managers.length) : 0;
            for (const manager of managers) {
                distributions.push({
                    jobCode: manager.jobCode,
                    kpiCode: kpi.kpiCode,
                    accountabilityLevel: 'contributor',
                    weightPercentage: perManager,
                });
            }
        }
        return distributions;
    }
    // ---------------------------------------------------------------------------
    // EXPORT METHODS
    // ---------------------------------------------------------------------------
    /**
     * Export org structure to Excalidraw format
     */
    async exportToExcalidraw(orgUnits) {
        // Build hierarchical structure
        const elements = [];
        const yOffset = 50;
        const xCenter = 400;
        const boxWidth = 200;
        const boxHeight = 60;
        const levelSpacing = 100;
        const levelGroups = this.groupByLevel(orgUnits);
        for (const [level, units] of Object.entries(levelGroups)) {
            const levelNum = parseInt(level);
            const xSpacing = 250;
            const startX = xCenter - ((units.length - 1) * xSpacing) / 2;
            for (let i = 0; i < units.length; i++) {
                const unit = units[i];
                const x = startX + i * xSpacing;
                const y = yOffset + levelNum * levelSpacing;
                elements.push({
                    id: `box-${unit.code}`,
                    type: 'rectangle',
                    x,
                    y,
                    width: boxWidth,
                    height: boxHeight,
                    strokeColor: '#1e88e5',
                    backgroundColor: levelNum === 1 ? '#bbdefb' : '#e3f2fd',
                    fillStyle: 'solid',
                    strokeWidth: 2,
                    roughness: 0,
                });
                elements.push({
                    id: `text-${unit.code}`,
                    type: 'text',
                    x: x + 10,
                    y: y + 20,
                    width: boxWidth - 20,
                    height: boxHeight - 20,
                    text: unit.nameEn,
                    fontSize: 14,
                    fontFamily: 1,
                    textAlign: 'center',
                });
            }
        }
        return {
            type: 'excalidraw',
            version: 2,
            source: 'heuresys-prototype-generator',
            elements,
            appState: {
                viewBackgroundColor: '#ffffff',
                gridSize: null,
            },
        };
    }
    groupByLevel(orgUnits) {
        const groups = {};
        for (const unit of orgUnits) {
            if (!groups[unit.level]) {
                groups[unit.level] = [];
            }
            groups[unit.level].push(unit);
        }
        return groups;
    }
}
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
export function createPrototypeGeneratorService(tenantId) {
    return new PrototypeGeneratorService(tenantId);
}
export default PrototypeGeneratorService;
//# sourceMappingURL=prototype-generator.js.map