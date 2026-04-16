/**
 * Business Process Research Service
 * AI-powered research for industry business processes based on Porter's Value Chain
 * Part of Tenant Prototype Generator System
 */
import { pool } from '../config/database.js';
import { AIOrchestrator } from './ai-orchestrator.js';
import { logger } from '../config/logger.js';
// =============================================================================
// PORTER'S VALUE CHAIN FRAMEWORK
// =============================================================================
export const VALUE_CHAIN_POSITIONS = {
    PRIMARY: {
        INBOUND_LOGISTICS: 1,
        OPERATIONS: 2,
        OUTBOUND_LOGISTICS: 3,
        MARKETING_SALES: 4,
        SERVICE: 5,
    },
    SUPPORT: {
        PROCUREMENT: 6,
        TECHNOLOGY: 7,
        HUMAN_RESOURCES: 8,
        INFRASTRUCTURE: 9,
    },
};
export const VALUE_CHAIN_DESCRIPTIONS = {
    1: { name: 'Inbound Logistics', description: 'Receiving, storing, and distributing inputs' },
    2: { name: 'Operations', description: 'Transforming inputs into final products/services' },
    3: { name: 'Outbound Logistics', description: 'Collecting, storing, and distributing outputs' },
    4: { name: 'Marketing & Sales', description: 'Promoting and selling products/services' },
    5: { name: 'Service', description: 'Maintaining and enhancing product/service value' },
    6: { name: 'Procurement', description: 'Purchasing inputs and managing suppliers' },
    7: { name: 'Technology Development', description: 'Developing and maintaining technology' },
    8: {
        name: 'Human Resource Management',
        description: 'Recruiting, training, and managing people',
    },
    9: { name: 'Firm Infrastructure', description: 'General management, finance, planning, quality' },
};
// =============================================================================
// AI PROMPTS FOR RESEARCH
// =============================================================================
const PROCESS_RESEARCH_PROMPT = `You are an expert business analyst specializing in industry process mapping.
Analyze the business processes for the specified industry following Porter's Value Chain framework.

For each process, provide:
1. A unique process code (e.g., BP-001)
2. Process name
3. Whether it's a primary or support activity
4. Its position in the value chain (1-9)
5. A brief description
6. Typical inputs (3-5 items)
7. Typical outputs (3-5 items)

Respond in JSON format with this structure:
{
  "processes": [
    {
      "processCode": "BP-001",
      "processName": "Process Name",
      "processCategory": "primary",
      "valueChainPosition": 1,
      "description": "Description",
      "typicalInputs": ["input1", "input2"],
      "typicalOutputs": ["output1", "output2"]
    }
  ]
}

Value Chain Positions:
1: Inbound Logistics
2: Operations
3: Outbound Logistics
4: Marketing & Sales
5: Service
6: Procurement
7: Technology Development
8: Human Resource Management
9: Firm Infrastructure`;
export const COST_CENTER_PROMPT = `You are an expert financial analyst specializing in cost center design.
Based on the business processes provided, identify the appropriate cost centers.

For each cost center, provide:
1. A unique code (e.g., CC-PROD)
2. Name
3. Cost type (direct, indirect, or overhead)
4. Description

Respond in JSON format:
{
  "costCenters": [
    {
      "costCenterCode": "CC-PROD",
      "costCenterName": "Production",
      "costType": "direct",
      "description": "Manufacturing operations"
    }
  ]
}`;
// =============================================================================
// INDUSTRY-SPECIFIC PROCESS TEMPLATES
// =============================================================================
const INDUSTRY_PROCESS_TEMPLATES = {
    K: [
        // Financial services
        {
            processCode: 'BP-K-01',
            processName: 'Customer Acquisition',
            processCategory: 'primary',
            valueChainPosition: 1,
            description: 'Acquiring new customers through various channels',
            typicalInputs: ['Lead lists', 'Marketing campaigns'],
            typicalOutputs: ['Qualified leads', 'Customer applications'],
        },
        {
            processCode: 'BP-K-02',
            processName: 'Account Management',
            processCategory: 'primary',
            valueChainPosition: 2,
            description: 'Managing customer accounts and transactions',
            typicalInputs: ['Customer data', 'Transaction requests'],
            typicalOutputs: ['Account statements', 'Transaction confirmations'],
        },
        {
            processCode: 'BP-K-03',
            processName: 'Lending Operations',
            processCategory: 'primary',
            valueChainPosition: 2,
            description: 'Processing and managing loans',
            typicalInputs: ['Loan applications', 'Credit assessments'],
            typicalOutputs: ['Approved loans', 'Disbursements'],
        },
        {
            processCode: 'BP-K-04',
            processName: 'Risk Management',
            processCategory: 'support',
            valueChainPosition: 9,
            description: 'Identifying and managing financial risks',
            typicalInputs: ['Risk data', 'Market conditions'],
            typicalOutputs: ['Risk assessments', 'Mitigation strategies'],
        },
        {
            processCode: 'BP-K-05',
            processName: 'Regulatory Compliance',
            processCategory: 'support',
            valueChainPosition: 9,
            description: 'Ensuring regulatory compliance',
            typicalInputs: ['Regulations', 'Audit findings'],
            typicalOutputs: ['Compliance reports', 'Policy updates'],
        },
    ],
    C: [
        // Manufacturing
        {
            processCode: 'BP-C-01',
            processName: 'Raw Material Procurement',
            processCategory: 'primary',
            valueChainPosition: 1,
            description: 'Sourcing and purchasing raw materials',
            typicalInputs: ['Supplier contracts', 'Purchase orders'],
            typicalOutputs: ['Raw materials', 'Goods receipts'],
        },
        {
            processCode: 'BP-C-02',
            processName: 'Production Planning',
            processCategory: 'primary',
            valueChainPosition: 2,
            description: 'Planning production schedules',
            typicalInputs: ['Sales forecasts', 'Inventory levels'],
            typicalOutputs: ['Production schedules', 'Work orders'],
        },
        {
            processCode: 'BP-C-03',
            processName: 'Manufacturing',
            processCategory: 'primary',
            valueChainPosition: 2,
            description: 'Core manufacturing operations',
            typicalInputs: ['Raw materials', 'Work instructions'],
            typicalOutputs: ['Finished goods', 'Production reports'],
        },
        {
            processCode: 'BP-C-04',
            processName: 'Quality Control',
            processCategory: 'primary',
            valueChainPosition: 2,
            description: 'Testing and quality assurance',
            typicalInputs: ['Samples', 'Specifications'],
            typicalOutputs: ['Test results', 'Quality certificates'],
        },
        {
            processCode: 'BP-C-05',
            processName: 'Logistics',
            processCategory: 'primary',
            valueChainPosition: 3,
            description: 'Distribution and delivery',
            typicalInputs: ['Customer orders', 'Finished goods'],
            typicalOutputs: ['Deliveries', 'Shipping documents'],
        },
    ],
    J: [
        // IT/Technology
        {
            processCode: 'BP-J-01',
            processName: 'Product Development',
            processCategory: 'primary',
            valueChainPosition: 2,
            description: 'Developing software products',
            typicalInputs: ['Requirements', 'Design specs'],
            typicalOutputs: ['Software releases', 'Documentation'],
        },
        {
            processCode: 'BP-J-02',
            processName: 'Service Delivery',
            processCategory: 'primary',
            valueChainPosition: 2,
            description: 'Delivering IT services',
            typicalInputs: ['Service requests', 'SLAs'],
            typicalOutputs: ['Service reports', 'Resolved tickets'],
        },
        {
            processCode: 'BP-J-03',
            processName: 'Customer Support',
            processCategory: 'primary',
            valueChainPosition: 5,
            description: 'Technical support services',
            typicalInputs: ['Support tickets', 'User queries'],
            typicalOutputs: ['Resolutions', 'Knowledge articles'],
        },
        {
            processCode: 'BP-J-04',
            processName: 'Infrastructure Management',
            processCategory: 'support',
            valueChainPosition: 7,
            description: 'Managing IT infrastructure',
            typicalInputs: ['System requirements', 'Monitoring data'],
            typicalOutputs: ['System availability', 'Performance reports'],
        },
        {
            processCode: 'BP-J-05',
            processName: 'Security Management',
            processCategory: 'support',
            valueChainPosition: 9,
            description: 'Managing cybersecurity',
            typicalInputs: ['Threat intelligence', 'Security policies'],
            typicalOutputs: ['Security reports', 'Incident responses'],
        },
    ],
};
// =============================================================================
// BUSINESS PROCESS RESEARCH SERVICE
// =============================================================================
export class BusinessProcessResearchService {
    tenantId;
    aiOrchestrator;
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.aiOrchestrator = new AIOrchestrator(tenantId, {
            provider: 'gemini',
            model: 'gemini-1.5-flash',
            temperature: 0.3,
        });
    }
    // ---------------------------------------------------------------------------
    // MAIN RESEARCH METHOD
    // ---------------------------------------------------------------------------
    /**
     * Research industry processes based on NACE code and company size
     */
    async researchIndustryProcesses(naceCode, companySize) {
        // 1. Check cache first
        const cached = await this.getCachedResearch(naceCode, companySize);
        if (cached) {
            return cached.research;
        }
        // 2. Check database for existing processes
        const dbProcesses = await this.getProcessesFromDatabase(naceCode);
        if (dbProcesses.length > 0) {
            const result = await this.buildResultFromDatabase(naceCode, companySize, dbProcesses);
            await this.cacheResearch(naceCode, companySize, result);
            return result;
        }
        // 3. Use industry templates if available
        const naceSection = naceCode.match(/^([A-Z])/i)?.[1]?.toUpperCase();
        if (naceSection && INDUSTRY_PROCESS_TEMPLATES[naceSection]) {
            const result = await this.buildResultFromTemplate(naceCode, companySize, naceSection);
            await this.cacheResearch(naceCode, companySize, result);
            return result;
        }
        // 4. Use AI to generate processes
        const aiResult = await this.generateProcessesWithAI(naceCode, companySize);
        await this.cacheResearch(naceCode, companySize, aiResult);
        return aiResult;
    }
    // ---------------------------------------------------------------------------
    // DATABASE METHODS
    // ---------------------------------------------------------------------------
    async getProcessesFromDatabase(naceCode) {
        const naceSection = naceCode.match(/^([A-Z])/i)?.[1]?.toUpperCase();
        const naceDivision = naceCode.match(/([0-9]{2})/)?.[1];
        const result = await pool.query(`
      SELECT
        bp.process_code,
        bp.process_name,
        bp.process_category,
        bp.value_chain_position,
        bp.description,
        bp.typical_inputs,
        bp.typical_outputs
      FROM business_processes bp
      JOIN industry_profiles ip ON bp.profile_id = ip.id
      WHERE LEFT(ip.nace_class_code, 1) = $1
        OR LEFT(ip.nace_class_code, 2) = $2
      ORDER BY bp.value_chain_position
    `, [naceSection, naceDivision]);
        return result.rows.map((row) => ({
            processCode: row.process_code,
            processName: row.process_name,
            processCategory: row.process_category,
            valueChainPosition: row.value_chain_position,
            description: row.description,
            typicalInputs: row.typical_inputs || [],
            typicalOutputs: row.typical_outputs || [],
        }));
    }
    async buildResultFromDatabase(naceCode, companySize, processes) {
        // naceSection can be used for more specific industry matching in future
        void naceCode.match(/^([A-Z])/i)?.[1]?.toUpperCase();
        const industryName = await this.getIndustryName(naceCode);
        const costCenters = await this.getCostCentersFromDatabase(naceCode);
        return {
            naceCode,
            industryName,
            companySize,
            processes,
            costCenters,
            valueChainMapping: this.mapToValueChain(processes),
            researchSource: 'database',
            generatedAt: new Date(),
        };
    }
    async getCostCentersFromDatabase(naceCode) {
        const naceSection = naceCode.match(/^([A-Z])/i)?.[1]?.toUpperCase();
        const naceDivision = naceCode.match(/([0-9]{2})/)?.[1];
        const result = await pool.query(`
      SELECT DISTINCT
        pcc.cost_center_code,
        pcc.cost_center_name,
        pcc.cost_type,
        pcc.description
      FROM process_cost_centers pcc
      JOIN business_processes bp ON pcc.process_id = bp.id
      JOIN industry_profiles ip ON bp.profile_id = ip.id
      WHERE LEFT(ip.nace_class_code, 1) = $1
        OR LEFT(ip.nace_class_code, 2) = $2
    `, [naceSection, naceDivision]);
        return result.rows.map((row) => ({
            costCenterCode: row.cost_center_code,
            costCenterName: row.cost_center_name,
            costType: row.cost_type,
            description: row.description,
        }));
    }
    // ---------------------------------------------------------------------------
    // TEMPLATE METHODS
    // ---------------------------------------------------------------------------
    async buildResultFromTemplate(naceCode, companySize, naceSection) {
        const processes = INDUSTRY_PROCESS_TEMPLATES[naceSection] || [];
        const industryName = await this.getIndustryName(naceCode);
        const costCenters = this.generateCostCentersFromProcesses(processes);
        return {
            naceCode,
            industryName,
            companySize,
            processes,
            costCenters,
            valueChainMapping: this.mapToValueChain(processes),
            researchSource: 'cached',
            generatedAt: new Date(),
        };
    }
    generateCostCentersFromProcesses(processes) {
        const costCenters = [];
        const seen = new Set();
        for (const process of processes) {
            const code = `CC-${process.processCode.split('-')[1]}`;
            if (seen.has(code))
                continue;
            seen.add(code);
            costCenters.push({
                costCenterCode: code,
                costCenterName: process.processName,
                costType: process.processCategory === 'primary' ? 'direct' : 'overhead',
                description: `Cost center for ${process.processName}`,
            });
        }
        return costCenters;
    }
    // ---------------------------------------------------------------------------
    // AI GENERATION METHODS
    // ---------------------------------------------------------------------------
    async generateProcessesWithAI(naceCode, companySize) {
        const industryName = await this.getIndustryName(naceCode);
        // Generate processes
        const processPrompt = `${PROCESS_RESEARCH_PROMPT}

Industry: ${industryName}
NACE Code: ${naceCode}
Company Size: ${companySize}

Generate 15-20 business processes covering all value chain activities.`;
        const messages = [{ role: 'user', content: processPrompt }];
        try {
            const response = await this.aiOrchestrator.chatCompletion({
                tenantId: this.tenantId,
                messages,
            });
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to parse AI response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            const processes = parsed.processes || [];
            // Generate cost centers based on processes
            const costCenters = this.generateCostCentersFromProcesses(processes);
            return {
                naceCode,
                industryName,
                companySize,
                processes,
                costCenters,
                valueChainMapping: this.mapToValueChain(processes),
                researchSource: 'ai_generated',
                generatedAt: new Date(),
            };
        }
        catch (error) {
            logger.error({ err: error }, 'AI generation failed, using fallback:');
            // Fallback to generic processes
            return this.generateGenericProcesses(naceCode, companySize, industryName);
        }
    }
    generateGenericProcesses(naceCode, companySize, industryName) {
        const processes = [
            {
                processCode: 'BP-GEN-01',
                processName: 'Procurement',
                processCategory: 'primary',
                valueChainPosition: 1,
                description: 'Acquiring resources and materials',
                typicalInputs: ['Purchase requests', 'Supplier quotes'],
                typicalOutputs: ['Purchase orders', 'Received goods'],
            },
            {
                processCode: 'BP-GEN-02',
                processName: 'Operations',
                processCategory: 'primary',
                valueChainPosition: 2,
                description: 'Core business operations',
                typicalInputs: ['Resources', 'Work instructions'],
                typicalOutputs: ['Products/Services', 'Reports'],
            },
            {
                processCode: 'BP-GEN-03',
                processName: 'Delivery',
                processCategory: 'primary',
                valueChainPosition: 3,
                description: 'Delivering to customers',
                typicalInputs: ['Orders', 'Products'],
                typicalOutputs: ['Deliveries', 'Confirmations'],
            },
            {
                processCode: 'BP-GEN-04',
                processName: 'Sales & Marketing',
                processCategory: 'primary',
                valueChainPosition: 4,
                description: 'Promoting and selling',
                typicalInputs: ['Market data', 'Leads'],
                typicalOutputs: ['Sales', 'Campaigns'],
            },
            {
                processCode: 'BP-GEN-05',
                processName: 'Customer Service',
                processCategory: 'primary',
                valueChainPosition: 5,
                description: 'Supporting customers',
                typicalInputs: ['Inquiries', 'Complaints'],
                typicalOutputs: ['Resolutions', 'Feedback'],
            },
            {
                processCode: 'BP-GEN-06',
                processName: 'Finance',
                processCategory: 'support',
                valueChainPosition: 9,
                description: 'Financial management',
                typicalInputs: ['Transactions', 'Reports'],
                typicalOutputs: ['Statements', 'Analysis'],
            },
            {
                processCode: 'BP-GEN-07',
                processName: 'HR',
                processCategory: 'support',
                valueChainPosition: 8,
                description: 'Human resources',
                typicalInputs: ['Staffing needs', 'Employee data'],
                typicalOutputs: ['Hires', 'Training'],
            },
            {
                processCode: 'BP-GEN-08',
                processName: 'IT',
                processCategory: 'support',
                valueChainPosition: 7,
                description: 'Technology support',
                typicalInputs: ['Requirements', 'Issues'],
                typicalOutputs: ['Systems', 'Support'],
            },
        ];
        const costCenters = this.generateCostCentersFromProcesses(processes);
        return {
            naceCode,
            industryName,
            companySize,
            processes,
            costCenters,
            valueChainMapping: this.mapToValueChain(processes),
            researchSource: 'cached',
            generatedAt: new Date(),
        };
    }
    // ---------------------------------------------------------------------------
    // VALUE CHAIN MAPPING
    // ---------------------------------------------------------------------------
    mapToValueChain(processes) {
        const primaryActivities = processes.filter((p) => p.processCategory === 'primary');
        const supportActivities = processes.filter((p) => p.processCategory === 'support');
        return {
            primaryActivities: primaryActivities.sort((a, b) => a.valueChainPosition - b.valueChainPosition),
            supportActivities: supportActivities.sort((a, b) => a.valueChainPosition - b.valueChainPosition),
            totalProcesses: processes.length,
        };
    }
    // ---------------------------------------------------------------------------
    // CACHING
    // ---------------------------------------------------------------------------
    async getCachedResearch(naceCode, companySize) {
        const naceSection = naceCode.match(/^([A-Z])/i)?.[1]?.toUpperCase();
        const naceDivision = naceCode.match(/([0-9]{2})/)?.[1];
        const result = await pool.query(`
      SELECT id, nace_section, nace_division, company_size, research_data, created_at, expires_at
      FROM business_process_cache
      WHERE nace_section = $1
        AND nace_division = $2
        AND company_size = $3
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `, [naceSection, naceDivision, companySize]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            id: row.id,
            naceSection: row.nace_section,
            naceDivision: row.nace_division,
            companySize: row.company_size,
            research: row.research_data,
            createdAt: row.created_at,
            expiresAt: row.expires_at,
        };
    }
    async cacheResearch(naceCode, companySize, research) {
        const naceSection = naceCode.match(/^([A-Z])/i)?.[1]?.toUpperCase();
        const naceDivision = naceCode.match(/([0-9]{2})/)?.[1];
        try {
            await pool.query(`
        INSERT INTO business_process_cache (nace_section, nace_division, company_size, research_data, expires_at)
        VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')
        ON CONFLICT (nace_section, nace_division, company_size)
        DO UPDATE SET research_data = $4, expires_at = NOW() + INTERVAL '30 days'
      `, [naceSection, naceDivision, companySize, JSON.stringify(research)]);
        }
        catch {
            // Cache table might not exist yet - gracefully ignore
            logger.info('Cache not available, skipping');
        }
    }
    // ---------------------------------------------------------------------------
    // HELPER METHODS
    // ---------------------------------------------------------------------------
    async getIndustryName(naceCode) {
        const naceSection = naceCode.match(/^([A-Z])/i)?.[1]?.toUpperCase();
        const naceDivision = naceCode.match(/([0-9]{2})/)?.[1];
        const result = await pool.query(`
      SELECT name_en as description FROM industry_classifications WHERE code = $1 AND level = 2
      UNION ALL
      SELECT name_en as description FROM industry_classifications WHERE code = $2 AND level = 1
      LIMIT 1
    `, [naceDivision, naceSection]);
        if (result.rows.length > 0) {
            return result.rows[0].description;
        }
        // Fallback names
        const sectionNames = {
            A: 'Agriculture, Forestry and Fishing',
            B: 'Mining and Quarrying',
            C: 'Manufacturing',
            D: 'Electricity, Gas, Steam Supply',
            E: 'Water Supply; Sewerage',
            F: 'Construction',
            G: 'Wholesale and Retail Trade',
            H: 'Transportation and Storage',
            I: 'Accommodation and Food Service',
            J: 'Information and Communication',
            K: 'Financial and Insurance Activities',
            L: 'Real Estate Activities',
            M: 'Professional, Scientific Activities',
            N: 'Administrative and Support Services',
            O: 'Public Administration',
            P: 'Education',
            Q: 'Human Health and Social Work',
            R: 'Arts, Entertainment and Recreation',
            S: 'Other Service Activities',
            T: 'Activities of Households',
            U: 'Extraterritorial Organizations',
        };
        return sectionNames[naceSection || ''] || 'Unknown Industry';
    }
    // ---------------------------------------------------------------------------
    // IDENTIFY COST CENTERS FOR A PROCESS
    // ---------------------------------------------------------------------------
    identifyCostCenters(process) {
        const costCenters = [];
        // Map value chain positions to typical cost center types
        const positionToCostType = {
            1: 'direct',
            2: 'direct',
            3: 'direct',
            4: 'indirect',
            5: 'indirect',
            6: 'overhead',
            7: 'overhead',
            8: 'overhead',
            9: 'overhead',
        };
        costCenters.push({
            costCenterCode: `CC-${process.processCode}`,
            costCenterName: process.processName,
            costType: positionToCostType[process.valueChainPosition] || 'indirect',
            description: `Cost center for ${process.processName}`,
        });
        return costCenters;
    }
}
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
export function createBusinessProcessResearchService(tenantId) {
    return new BusinessProcessResearchService(tenantId);
}
export default BusinessProcessResearchService;
//# sourceMappingURL=business-process-research.js.map