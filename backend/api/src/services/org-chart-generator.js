/**
 * Org Chart Generator Service
 * Generates realistic organizational charts using AI, templates, or NACE/ESCO data
 * Part of Org Chart Generation System
 */
import { pool } from '../config/database.js';
import { createAIOrchestrator } from './ai-orchestrator.js';
import { createIndustryPrototypeService, } from './industry-prototype.js';
import { logger } from '../config/logger.js';
// =============================================================================
// AI PROMPT TEMPLATES
// =============================================================================
const ORG_CHART_SYSTEM_PROMPT = `Sei un esperto di organizzazione aziendale e progettazione di organigrammi.
Il tuo compito è generare strutture organizzative realistiche basate su:
1. Settore industriale (NACE)
2. Dimensione aziendale
3. Best practices organizzative

Regole:
- Genera sempre strutture con massimo 7 livelli gerarchici
- Usa span of control realistici (5-10 direct reports per manager)
- I titoli devono essere in italiano con equivalente inglese
- La struttura deve essere coerente con il settore industriale
- Includi sempre: CEO (L1), C-Level (L2), Director/VP (L3-L4), Manager (L5), Coordinatori (L6), Staff (L7)`;
function buildOrgChartPrompt(context, prototype) {
    return `
Genera un organigramma realistico per questa azienda:

**Azienda:** ${context.tenantName}
**Settore:** ${prototype.name} (NACE: ${prototype.naceSection}${prototype.naceDivision || ''})
**Dipendenti totali:** ${context.employeeCount}
**Classe dimensionale:** ${prototype.sizeClass}

**Dipartimenti esistenti:** ${context.departments.map((d) => `${d.name} (${d.count})`).join(', ') || 'Nessuno'}
**Sedi:** ${context.locations.map((l) => l.city).join(', ') || 'Non specificate'}
**Centri di costo:** ${context.costCenters.map((c) => c.name).join(', ') || 'Non definiti'}
**Job titles esistenti:** ${context.jobTitles.slice(0, 30).join(', ') || 'Non definiti'}

**Struttura gerarchica tipica del settore:**
${prototype.typicalHierarchy?.map((h) => `Livello ${h.level}: ${h.nameIt} (${h.nameEn})`).join('\n') || 'Standard 7 livelli'}

**Dipartimenti tipici del settore:** ${prototype.typicalDepartments.join(', ')}

Genera la struttura in formato JSON con questo schema esatto:
{
  "units": [
    {
      "code": "string (es: DIR, HR, FIN)",
      "name": "string (nome italiano)",
      "nameEn": "string (nome inglese)",
      "parentCode": "string | null (codice parent unit)",
      "level": "number (1-7)",
      "type": "string (company|division|department|team|unit)",
      "headcountBudget": "number"
    }
  ],
  "positions": [
    {
      "code": "string (es: CEO, CFO, HR_MGR)",
      "titleIt": "string (titolo italiano)",
      "titleEn": "string (titolo inglese)",
      "unitCode": "string (codice unit di appartenenza)",
      "level": "number (1-7)",
      "isManager": "boolean",
      "headcount": "number (quante persone in questa posizione)"
    }
  ]
}

Requisiti:
1. La somma degli headcount delle posizioni DEVE essere uguale a ${context.employeeCount}
2. Ogni unit deve avere almeno una posizione manager (isManager: true)
3. Level 1 ha solo 1 position (CEO)
4. Level 2 ha 3-5 positions (C-Level)
5. Distribuisci realisticamente i dipendenti nei livelli inferiori
6. Mantieni span of control tra 5-10 per i manager

Rispondi SOLO con il JSON, senza altro testo.`;
}
// =============================================================================
// ORG CHART GENERATOR SERVICE
// =============================================================================
export class OrgChartGeneratorService {
    tenantId;
    prototypeService;
    aiOrchestrator;
    constructor(tenantId, aiProvider) {
        this.tenantId = tenantId;
        this.prototypeService = createIndustryPrototypeService(tenantId);
        this.aiOrchestrator = createAIOrchestrator(tenantId, {
            provider: aiProvider || 'gemini',
            temperature: 0.3, // Lower temperature for more structured output
            maxTokens: 4096,
        });
    }
    // ---------------------------------------------------------------------------
    // SESSION MANAGEMENT
    // ---------------------------------------------------------------------------
    /**
     * Create a new generation session
     */
    async createSession(sessionName, config) {
        const context = await this.prototypeService.getTenantContext();
        const prototype = await this.prototypeService.getPrototypeForTenant();
        // Convert uppercase size class from DB to lowercase for sessions table
        const normalizedSizeClass = (prototype.sizeClass || 'medium').toLowerCase();
        const result = await pool.query(`
      INSERT INTO org_chart_generation_sessions (
        tenant_id,
        session_name,
        generation_method,
        nace_section,
        nace_division,
        nace_code,
        industry_name,
        company_size,
        tenant_context,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING id, tenant_id, session_name, status
    `, [
            this.tenantId,
            sessionName,
            config.method,
            prototype.naceSection,
            prototype.naceDivision,
            `${prototype.naceSection || ''}${prototype.naceDivision || ''}`,
            prototype.name,
            normalizedSizeClass,
            JSON.stringify({
                employeeCount: context.employeeCount,
                departments: context.departments,
                locations: context.locations,
                costCenters: context.costCenters,
                jobTitles: context.jobTitles,
            }),
        ]);
        return {
            id: result.rows[0].id,
            tenantId: result.rows[0].tenant_id,
            sessionName: result.rows[0].session_name,
            status: result.rows[0].status,
            generatedStructure: null,
        };
    }
    /**
     * Get session by ID
     */
    async getSession(sessionId) {
        const result = await pool.query(`
      SELECT
        id, tenant_id, session_name, status,
        generated_structure, error_message
      FROM org_chart_generation_sessions
      WHERE id = $1 AND tenant_id = $2
    `, [sessionId, this.tenantId]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            id: row.id,
            tenantId: row.tenant_id,
            sessionName: row.session_name,
            status: row.status,
            generatedStructure: row.generated_structure,
            error: row.error_message,
        };
    }
    // ---------------------------------------------------------------------------
    // GENERATION METHODS
    // ---------------------------------------------------------------------------
    /**
     * Generate org chart using configured method
     */
    async generate(sessionId, config) {
        // Update session status
        await pool.query(`
      UPDATE org_chart_generation_sessions
      SET status = 'generating', started_at = NOW()
      WHERE id = $1
    `, [sessionId]);
        try {
            let result;
            switch (config.method) {
                case 'web_search':
                    result = await this.generateFromWebSearch(sessionId, config);
                    break;
                case 'template':
                    result = await this.generateFromTemplate(sessionId, config);
                    break;
                case 'nace_esco':
                    result = await this.generateFromNACEESCO(sessionId, config);
                    break;
                case 'combined':
                default:
                    result = await this.generateCombined(sessionId, config);
                    break;
            }
            // Save result to session
            await pool.query(`
        UPDATE org_chart_generation_sessions
        SET
          status = 'generated',
          generated_structure = $2,
          completed_at = NOW()
        WHERE id = $1
      `, [sessionId, JSON.stringify(result)]);
            return result;
        }
        catch (error) {
            await pool.query(`
        UPDATE org_chart_generation_sessions
        SET status = 'failed', error_message = $2
        WHERE id = $1
      `, [sessionId, error.message]);
            throw error;
        }
    }
    /**
     * Generate using AI web search
     */
    async generateFromWebSearch(sessionId, _config) {
        const context = await this.prototypeService.getTenantContext();
        const prototype = await this.prototypeService.getPrototypeForTenant();
        const prompt = buildOrgChartPrompt(context, prototype);
        const messages = [
            { role: 'system', content: ORG_CHART_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
        ];
        // Store prompt in session
        await pool.query(`
      UPDATE org_chart_generation_sessions
      SET ai_prompt = $2, ai_provider = $3
      WHERE id = $1
    `, [sessionId, prompt, this.aiOrchestrator['config'].provider]);
        const response = await this.aiOrchestrator.chatCompletion({
            tenantId: this.tenantId,
            messages,
        });
        // Store AI response
        await pool.query(`
      UPDATE org_chart_generation_sessions
      SET ai_response = $2, ai_model = $3
      WHERE id = $1
    `, [
            sessionId,
            JSON.stringify({
                content: response.content,
                tokens: response.tokensInput + response.tokensOutput,
            }),
            this.aiOrchestrator['config'].model,
        ]);
        // Parse JSON from response
        const parsed = this.parseAIResponse(response.content);
        // Validate and adjust headcount
        const adjusted = this.adjustHeadcount(parsed, context.employeeCount);
        return {
            ...adjusted,
            metadata: {
                method: 'web_search',
                aiProvider: this.aiOrchestrator['config'].provider,
                aiModel: this.aiOrchestrator['config'].model,
                generatedAt: new Date().toISOString(),
                tenantContext: {
                    tenantId: context.tenantId,
                    tenantName: context.tenantName,
                    employeeCount: context.employeeCount,
                },
                industryPrototype: {
                    code: prototype.code,
                    name: prototype.name,
                    sizeClass: prototype.sizeClass,
                },
            },
        };
    }
    /**
     * Generate from database templates
     */
    async generateFromTemplate(_sessionId, _config) {
        const context = await this.prototypeService.getTenantContext();
        const prototype = await this.prototypeService.getPrototypeForTenant();
        // Get best matching template
        const templates = await this.prototypeService.getTemplatesForIndustry(prototype.naceSection || '', prototype.sizeClass);
        if (templates.length === 0) {
            // Fall back to default structure
            return this.generateDefaultStructure(context, prototype);
        }
        const template = templates[0];
        if (!template) {
            throw new Error('No matching org chart template found');
        }
        // Scale template to actual employee count
        const scaled = this.scaleTemplateToEmployeeCount(template.template_structure, context.employeeCount);
        return {
            ...scaled,
            metadata: {
                method: 'template',
                generatedAt: new Date().toISOString(),
                tenantContext: {
                    tenantId: context.tenantId,
                    tenantName: context.tenantName,
                    employeeCount: context.employeeCount,
                },
                industryPrototype: {
                    code: prototype.code,
                    name: prototype.name,
                    sizeClass: prototype.sizeClass,
                },
            },
        };
    }
    /**
     * Generate from NACE/ESCO data
     */
    async generateFromNACEESCO(_sessionId, _config) {
        const context = await this.prototypeService.getTenantContext();
        const prototype = await this.prototypeService.getPrototypeForTenant();
        // Get ESCO occupations for this industry (for future use)
        // const _escoOccupations = await this.prototypeService.getRelevantESCOOccupations(
        //   prototype.naceSection || 'K',
        //   100
        // );
        // Build structure from ESCO skill levels
        const units = [];
        const positions = [];
        // Create root unit (company)
        units.push({
            code: 'ROOT',
            name: context.tenantName,
            nameEn: context.tenantName,
            parentCode: null,
            level: 1,
            type: 'company',
            headcountBudget: context.employeeCount,
        });
        // Create departments from typical departments
        const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
        // CEO Position
        positions.push({
            code: 'CEO',
            titleIt: 'Amministratore Delegato',
            titleEn: 'Chief Executive Officer',
            unitCode: 'ROOT',
            level: 1,
            isManager: true,
            headcount: 1,
        });
        levelCounts[1] = 1;
        // Create departments and positions from prototype
        const typicalDepts = prototype.typicalDepartments || [];
        for (let i = 0; i < Math.min(typicalDepts.length, 10); i++) {
            const deptName = typicalDepts[i] || `OrgUnit ${i + 1}`;
            const deptCode = this.generateCode(deptName);
            units.push({
                code: deptCode,
                name: deptName,
                nameEn: deptName, // Would need translation
                parentCode: 'ROOT',
                level: 2,
                type: 'department',
                headcountBudget: Math.floor(context.employeeCount / typicalDepts.length),
            });
            // Add C-Level position for major departments
            if (i < 5) {
                const cLevelTitle = this.getCLevelTitle(deptName);
                positions.push({
                    code: cLevelTitle.code,
                    titleIt: cLevelTitle.it,
                    titleEn: cLevelTitle.en,
                    unitCode: deptCode,
                    level: 2,
                    isManager: true,
                    headcount: 1,
                    reportsToPositionCode: 'CEO',
                });
                levelCounts[2] = (levelCounts[2] || 0) + 1;
            }
            // Add Manager position
            positions.push({
                code: `${deptCode}_MGR`,
                titleIt: `Manager ${deptName}`,
                titleEn: `${deptName} Manager`,
                unitCode: deptCode,
                level: 5,
                isManager: true,
                headcount: 1,
                reportsToPositionCode: i < 5 ? this.getCLevelTitle(deptName).code : 'CEO',
            });
            levelCounts[5] = (levelCounts[5] || 0) + 1;
        }
        // Distribute remaining employees to level 7
        const assignedCount = Object.values(levelCounts).reduce((a, b) => a + b, 0);
        const remainingCount = context.employeeCount - assignedCount;
        if (remainingCount > 0) {
            // Add staff positions to each department
            const deptCount = Math.min(typicalDepts.length, 10);
            const staffPerDept = Math.floor(remainingCount / deptCount);
            for (let i = 0; i < deptCount; i++) {
                const deptNameStaff = typicalDepts[i] || `OrgUnit ${i + 1}`;
                const deptCode = this.generateCode(deptNameStaff);
                positions.push({
                    code: `${deptCode}_STAFF`,
                    titleIt: `Impiegato ${deptNameStaff}`,
                    titleEn: `${deptNameStaff} Employee`,
                    unitCode: deptCode,
                    level: 7,
                    isManager: false,
                    headcount: i === deptCount - 1 ? remainingCount - staffPerDept * (deptCount - 1) : staffPerDept,
                });
            }
            levelCounts[7] = remainingCount;
        }
        return {
            units,
            positions,
            totalHeadcount: context.employeeCount,
            levelDistribution: levelCounts,
            metadata: {
                method: 'nace_esco',
                generatedAt: new Date().toISOString(),
                tenantContext: {
                    tenantId: context.tenantId,
                    tenantName: context.tenantName,
                    employeeCount: context.employeeCount,
                },
                industryPrototype: {
                    code: prototype.code,
                    name: prototype.name,
                    sizeClass: prototype.sizeClass,
                },
            },
        };
    }
    /**
     * Generate using all methods and combine
     */
    async generateCombined(sessionId, config) {
        // Primary: AI Web Search
        // Fallback: Template or NACE/ESCO
        try {
            const aiResult = await this.generateFromWebSearch(sessionId, config);
            return { ...aiResult, metadata: { ...aiResult.metadata, method: 'combined' } };
        }
        catch (aiError) {
            logger.error({ err: aiError }, 'AI generation failed, falling back to NACE/ESCO:');
            try {
                const templateResult = await this.generateFromTemplate(sessionId, config);
                return { ...templateResult, metadata: { ...templateResult.metadata, method: 'combined' } };
            }
            catch (templateError) {
                logger.error({ err: templateError }, 'Template generation failed, falling back to NACE/ESCO:');
                const naceResult = await this.generateFromNACEESCO(sessionId, config);
                return { ...naceResult, metadata: { ...naceResult.metadata, method: 'combined' } };
            }
        }
    }
    // ---------------------------------------------------------------------------
    // HELPER METHODS
    // ---------------------------------------------------------------------------
    parseAIResponse(content) {
        // Extract JSON from response (may have markdown code blocks)
        const jsonMatch = content.match(/```json?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not extract JSON from AI response');
        }
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        if (!parsed.units || !Array.isArray(parsed.units)) {
            throw new Error('Invalid response: missing units array');
        }
        if (!parsed.positions || !Array.isArray(parsed.positions)) {
            throw new Error('Invalid response: missing positions array');
        }
        return {
            units: parsed.units.map((u) => ({
                code: u.code,
                name: u.name,
                nameEn: u.nameEn || u.name_en || u.name,
                parentCode: u.parentCode || u.parent_code || null,
                level: parseInt(u.level) || 1,
                type: u.type || 'department',
                headcountBudget: parseInt(u.headcountBudget || u.headcount_budget) || 0,
            })),
            positions: parsed.positions.map((p) => ({
                code: p.code,
                titleIt: p.titleIt || p.title_it || p.title,
                titleEn: p.titleEn || p.title_en || p.title,
                unitCode: p.unitCode || p.unit_code,
                level: parseInt(p.level) || 7,
                isManager: Boolean(p.isManager || p.is_manager),
                headcount: parseInt(p.headcount) || 1,
                escoCode: p.escoCode || p.esco_code,
                reportsToPositionCode: p.reportsToPositionCode || p.reports_to_position_code,
            })),
        };
    }
    adjustHeadcount(parsed, targetCount) {
        const currentTotal = parsed.positions.reduce((sum, p) => sum + p.headcount, 0);
        const diff = targetCount - currentTotal;
        if (diff === 0) {
            return this.buildChartFromParsed(parsed);
        }
        // Find level 7 positions to adjust
        const level7Positions = parsed.positions.filter((p) => p.level === 7);
        if (level7Positions.length === 0) {
            // Create a general staff position
            parsed.positions.push({
                code: 'STAFF',
                titleIt: 'Impiegato',
                titleEn: 'Employee',
                unitCode: parsed.units[0]?.code || 'ROOT',
                level: 7,
                isManager: false,
                headcount: Math.max(0, diff),
            });
        }
        else {
            // Distribute diff across level 7 positions
            const perPosition = Math.floor(Math.abs(diff) / level7Positions.length);
            const remainder = Math.abs(diff) % level7Positions.length;
            for (let i = 0; i < level7Positions.length; i++) {
                const pos = level7Positions[i];
                if (pos) {
                    const adjustment = perPosition + (i < remainder ? 1 : 0);
                    pos.headcount = Math.max(1, pos.headcount + (diff > 0 ? adjustment : -adjustment));
                }
            }
        }
        return this.buildChartFromParsed(parsed);
    }
    buildChartFromParsed(parsed) {
        const totalHeadcount = parsed.positions.reduce((sum, p) => sum + p.headcount, 0);
        const levelDistribution = {};
        for (const p of parsed.positions) {
            levelDistribution[p.level] = (levelDistribution[p.level] || 0) + p.headcount;
        }
        return {
            units: parsed.units,
            positions: parsed.positions,
            totalHeadcount,
            levelDistribution,
            metadata: {
                method: 'web_search',
                generatedAt: new Date().toISOString(),
                tenantContext: {},
                industryPrototype: {},
            },
        };
    }
    generateDefaultStructure(context, prototype) {
        // Minimal default structure
        const units = [
            {
                code: 'ROOT',
                name: context.tenantName,
                parentCode: null,
                level: 1,
                type: 'company',
                headcountBudget: context.employeeCount,
            },
        ];
        const positions = [
            {
                code: 'CEO',
                titleIt: 'Amministratore Delegato',
                titleEn: 'CEO',
                unitCode: 'ROOT',
                level: 1,
                isManager: true,
                headcount: 1,
            },
            {
                code: 'STAFF',
                titleIt: 'Dipendente',
                titleEn: 'Employee',
                unitCode: 'ROOT',
                level: 7,
                isManager: false,
                headcount: context.employeeCount - 1,
            },
        ];
        return {
            units,
            positions,
            totalHeadcount: context.employeeCount,
            levelDistribution: { 1: 1, 7: context.employeeCount - 1 },
            metadata: {
                method: 'template',
                generatedAt: new Date().toISOString(),
                tenantContext: {
                    tenantId: context.tenantId,
                    tenantName: context.tenantName,
                    employeeCount: context.employeeCount,
                },
                industryPrototype: {
                    code: prototype.code,
                    name: prototype.name,
                    sizeClass: prototype.sizeClass,
                },
            },
        };
    }
    scaleTemplateToEmployeeCount(template, targetCount) {
        if (!template || !template.units || !template.positions) {
            return {
                units: [],
                positions: [],
                totalHeadcount: 0,
                levelDistribution: {},
            };
        }
        const scaleFactor = targetCount / (template.totalHeadcount || 100);
        const scaledPositions = template.positions.map((p) => ({
            ...p,
            headcount: Math.max(1, Math.round(p.headcount * scaleFactor)),
        }));
        // Adjust to match exact count
        const currentTotal = scaledPositions.reduce((sum, p) => sum + p.headcount, 0);
        const diff = targetCount - currentTotal;
        if (diff !== 0) {
            const lastPosition = scaledPositions[scaledPositions.length - 1];
            if (lastPosition) {
                lastPosition.headcount = Math.max(1, lastPosition.headcount + diff);
            }
        }
        const levelDistribution = {};
        for (const p of scaledPositions) {
            levelDistribution[p.level] = (levelDistribution[p.level] || 0) + p.headcount;
        }
        return {
            units: template.units,
            positions: scaledPositions,
            totalHeadcount: targetCount,
            levelDistribution,
        };
    }
    generateCode(name) {
        return name
            .replace(/[àáâãäå]/gi, 'a')
            .replace(/[èéêë]/gi, 'e')
            .replace(/[ìíîï]/gi, 'i')
            .replace(/[òóôõö]/gi, 'o')
            .replace(/[ùúûü]/gi, 'u')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase()
            .substring(0, 10);
    }
    getCLevelTitle(orgUnitName) {
        const mappings = {
            'Risorse Umane': { code: 'CHRO', it: 'Chief Human Resources Officer', en: 'CHRO' },
            HR: { code: 'CHRO', it: 'Chief Human Resources Officer', en: 'CHRO' },
            Finance: { code: 'CFO', it: 'Chief Financial Officer', en: 'CFO' },
            Amministrazione: { code: 'CFO', it: 'Chief Financial Officer', en: 'CFO' },
            IT: { code: 'CTO', it: 'Chief Technology Officer', en: 'CTO' },
            Technology: { code: 'CTO', it: 'Chief Technology Officer', en: 'CTO' },
            Operations: { code: 'COO', it: 'Chief Operating Officer', en: 'COO' },
            Marketing: { code: 'CMO', it: 'Chief Marketing Officer', en: 'CMO' },
            Commerciale: { code: 'CCO', it: 'Chief Commercial Officer', en: 'CCO' },
            Legal: { code: 'CLO', it: 'Chief Legal Officer', en: 'CLO' },
            Compliance: { code: 'CCpO', it: 'Chief Compliance Officer', en: 'Chief Compliance Officer' },
            'Risk Management': { code: 'CRO', it: 'Chief Risk Officer', en: 'CRO' },
        };
        return (mappings[orgUnitName] || {
            code: `DIR_${this.generateCode(orgUnitName)}`,
            it: `Direttore ${orgUnitName}`,
            en: `${orgUnitName} Director`,
        });
    }
}
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
export function createOrgChartGeneratorService(tenantId, aiProvider) {
    return new OrgChartGeneratorService(tenantId, aiProvider);
}
export default OrgChartGeneratorService;
//# sourceMappingURL=org-chart-generator.js.map