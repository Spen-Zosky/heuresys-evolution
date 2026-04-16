/**
 * Industry Prototype Service
 * Resolves NACE codes to industry prototypes and retrieves ESCO occupations
 * Part of Org Chart Generation System
 */

import { pool } from '../config/database.js';

// =============================================================================
// TYPES
// =============================================================================

export interface IndustryPrototype {
  id: string;
  code: string;
  name: string;
  description: string | null;
  naceSection: string | null;
  naceDivision: string | null;
  naceGroup: string | null;
  sizeClass: CompanySize;
  minEmployees: number | null;
  maxEmployees: number | null;
  typicalDepartments: string[];
  typicalRoles: string[];
  typicalHierarchy: HierarchyLevel[] | null;
  typicalSpanOfControl: number[];
  escoOccupationCodes: string[];
  orgUnitTemplates: string[];
}

export type CompanySize = 'micro' | 'small' | 'medium' | 'large' | 'enterprise';

export interface HierarchyLevel {
  level: number;
  nameIt: string;
  nameEn: string;
  typicalCount: number;
  typicalRoles: string[];
}

export interface NACEInfo {
  section: string;
  sectionName: string;
  division: string;
  divisionName: string;
  group: string | null;
  groupName: string | null;
  class: string | null;
  className: string | null;
}

export interface ESCOOccupation {
  code: string;
  preferredLabel: string;
  altLabels: string[];
  description: string | null;
  skillLevel: number;
  isco08Code: string | null;
}

export interface TenantContext {
  tenantId: string;
  tenantName: string;
  industryType: string | null;
  naceCode: string | null;
  employeeCount: number;
  departments: { id: string; name: string; count: number }[];
  locations: { id: string; name: string; city: string }[];
  costCenters: { id: string; code: string; name: string }[];
  orgUnits: { id: string; code: string; name: string }[];
  jobTitles: string[];
}

// =============================================================================
// DEFAULT HIERARCHY TEMPLATE
// =============================================================================

const DEFAULT_HIERARCHY: HierarchyLevel[] = [
  {
    level: 1,
    nameIt: 'Amministratore Delegato',
    nameEn: 'CEO',
    typicalCount: 1,
    typicalRoles: ['Chief Executive Officer', 'Amministratore Delegato', 'President'],
  },
  {
    level: 2,
    nameIt: 'Direttore / C-Level',
    nameEn: 'C-Level Executive',
    typicalCount: 4,
    typicalRoles: ['CFO', 'COO', 'CTO', 'CHRO', 'CMO', 'CLO', 'Direttore Generale'],
  },
  {
    level: 3,
    nameIt: 'Vice Presidente / Direttore di Funzione',
    nameEn: 'VP / Function Director',
    typicalCount: 8,
    typicalRoles: ['VP Operations', 'VP Finance', 'VP HR', 'Direttore Commerciale', 'Direttore IT'],
  },
  {
    level: 4,
    nameIt: 'Responsabile / Director',
    nameEn: 'Director / Head of',
    typicalCount: 15,
    typicalRoles: ['Director', 'Head of OrgUnit', 'Responsabile Area', 'Responsabile Servizio'],
  },
  {
    level: 5,
    nameIt: 'Manager / Responsabile',
    nameEn: 'Manager',
    typicalCount: 25,
    typicalRoles: ['Manager', 'Team Manager', 'Project Manager', 'Capo Ufficio'],
  },
  {
    level: 6,
    nameIt: 'Coordinatore / Senior',
    nameEn: 'Senior Specialist / Coordinator',
    typicalCount: 40,
    typicalRoles: ['Senior', 'Coordinator', 'Lead', 'Specialist', 'Coordinatore'],
  },
  {
    level: 7,
    nameIt: 'Impiegato / Operatore',
    nameEn: 'Employee / Operator',
    typicalCount: -1, // Remaining
    typicalRoles: ['Impiegato', 'Operatore', 'Analista', 'Assistant', 'Junior'],
  },
];

// =============================================================================
// SIZE CLASS MAPPINGS
// =============================================================================

function getSizeClassFromCount(employeeCount: number): CompanySize {
  if (employeeCount < 10) return 'micro';
  if (employeeCount < 50) return 'small';
  if (employeeCount < 250) return 'medium';
  if (employeeCount < 1000) return 'large';
  return 'enterprise';
}

function getTypicalSpanOfControl(sizeClass: CompanySize): number[] {
  switch (sizeClass) {
    case 'micro':
      return [3, 3, 3, 3, 3, 2];
    case 'small':
      return [4, 4, 5, 5, 4, 3];
    case 'medium':
      return [5, 6, 7, 7, 6, 4];
    case 'large':
      return [6, 7, 8, 8, 7, 5];
    case 'enterprise':
      return [8, 8, 10, 10, 8, 6];
  }
}

// =============================================================================
// INDUSTRY PROTOTYPE SERVICE
// =============================================================================

export class IndustryPrototypeService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  // ---------------------------------------------------------------------------
  // TENANT CONTEXT
  // ---------------------------------------------------------------------------

  /**
   * Get complete tenant context for org chart generation
   */
  async getTenantContext(): Promise<TenantContext> {
    // Get tenant info
    const tenantResult = await pool.query(
      `
      SELECT id, name, industry_type, nace_code
      FROM tenants
      WHERE id = $1
    `,
      [this.tenantId]
    );

    if (tenantResult.rows.length === 0) {
      throw new Error(`Tenant not found: ${this.tenantId}`);
    }

    const tenant = tenantResult.rows[0];

    // Get employee count
    const employeeCountResult = await pool.query(
      `
      SELECT COUNT(*) as count FROM employees WHERE tenant_id = $1 AND is_active = true
    `,
      [this.tenantId]
    );

    // Get departments with counts
    const deptResult = await pool.query(
      `
      SELECT
        d.id,
        d.name,
        COUNT(e.id) as count
      FROM org_units d
      LEFT JOIN employees e ON e.org_unit_id = d.id AND e.is_active = true
      WHERE d.tenant_id = $1
      GROUP BY d.id, d.name
      ORDER BY count DESC
    `,
      [this.tenantId]
    );

    // Get locations
    const locResult = await pool.query(
      `
      SELECT id, name, city FROM locations WHERE tenant_id = $1
    `,
      [this.tenantId]
    );

    // Get cost centers
    const ccResult = await pool.query(
      `
      SELECT id, code, name FROM cost_centers WHERE tenant_id = $1
    `,
      [this.tenantId]
    );

    // Get org units
    const ouResult = await pool.query(
      `
      SELECT id, code, name FROM org_units WHERE tenant_id = $1
    `,
      [this.tenantId]
    );

    // Get unique job titles
    const jobResult = await pool.query(
      `
      SELECT DISTINCT job_title
      FROM employees
      WHERE tenant_id = $1 AND is_active = true AND job_title IS NOT NULL
      ORDER BY job_title
    `,
      [this.tenantId]
    );

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      industryType: tenant.industry_type,
      naceCode: tenant.nace_code,
      employeeCount: parseInt(employeeCountResult.rows[0].count),
      departments: deptResult.rows.map((r) => ({
        id: r.id,
        name: r.name,
        count: parseInt(r.count),
      })),
      locations: locResult.rows.map((r) => ({
        id: r.id,
        name: r.name,
        city: r.city,
      })),
      costCenters: ccResult.rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
      })),
      orgUnits: ouResult.rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
      })),
      jobTitles: jobResult.rows.map((r) => r.job_title),
    };
  }

  // ---------------------------------------------------------------------------
  // NACE RESOLUTION
  // ---------------------------------------------------------------------------

  /**
   * Get NACE information from code
   */
  async getNACEInfo(naceCode: string): Promise<NACEInfo | null> {
    if (!naceCode) return null;

    // Extract section, division, group, class from NACE code
    // Format: Section (letter) + Division (2 digits) + Group (1 digit) + Class (1 digit)
    // Example: K64.19 -> Section K, Division 64, Group 641, Class 6419

    const sectionMatch = naceCode.match(/^([A-Z])/i);
    const divisionMatch = naceCode.match(/([0-9]{2})/);
    const fullCode = naceCode.replace(/\./g, '');

    // Query NACE codes table
    const result = await pool.query(
      `
      SELECT
        code,
        description,
        level,
        parent_code
      FROM nace_codes
      WHERE code = $1 OR code = $2 OR code = $3
      ORDER BY length(code) DESC
    `,
      [
        fullCode, // Full code
        divisionMatch ? divisionMatch[1] : null, // Division only
        sectionMatch ? sectionMatch[1] : null, // Section only
      ]
    );

    if (result.rows.length === 0) {
      // Return basic info from code parsing
      const sectionCode = sectionMatch?.[1]?.toUpperCase() ?? '';
      const divisionCode = divisionMatch?.[1] ?? '';
      return {
        section: sectionCode,
        sectionName: this.getNACESectionName(sectionCode),
        division: divisionCode,
        divisionName: '',
        group: null,
        groupName: null,
        class: null,
        className: null,
      };
    }

    // Build info from results
    const info: NACEInfo = {
      section: '',
      sectionName: '',
      division: '',
      divisionName: '',
      group: null,
      groupName: null,
      class: null,
      className: null,
    };

    for (const row of result.rows) {
      switch (row.level) {
        case 1: // Section
          info.section = row.code;
          info.sectionName = row.description;
          break;
        case 2: // Division
          info.division = row.code;
          info.divisionName = row.description;
          break;
        case 3: // Group
          info.group = row.code;
          info.groupName = row.description;
          break;
        case 4: // Class
          info.class = row.code;
          info.className = row.description;
          break;
      }
    }

    return info;
  }

  private getNACESectionName(section: string): string {
    const sections: Record<string, string> = {
      A: 'Agricoltura, silvicoltura e pesca',
      B: 'Estrazione di minerali',
      C: 'Attività manifatturiere',
      D: 'Fornitura di energia elettrica, gas, vapore',
      E: 'Fornitura di acqua; reti fognarie',
      F: 'Costruzioni',
      G: "Commercio all'ingrosso e al dettaglio",
      H: 'Trasporto e magazzinaggio',
      I: 'Attività dei servizi di alloggio e ristorazione',
      J: 'Servizi di informazione e comunicazione',
      K: 'Attività finanziarie e assicurative',
      L: 'Attività immobiliari',
      M: 'Attività professionali, scientifiche e tecniche',
      N: 'Noleggio, agenzie di viaggio, servizi alle imprese',
      O: 'Amministrazione pubblica e difesa',
      P: 'Istruzione',
      Q: 'Sanità e assistenza sociale',
      R: 'Attività artistiche, sportive, di intrattenimento',
      S: 'Altre attività di servizi',
      T: 'Attività di famiglie e convivenze',
      U: 'Organizzazioni e organismi extraterritoriali',
    };
    return sections[section] || 'Settore sconosciuto';
  }

  // ---------------------------------------------------------------------------
  // INDUSTRY PROTOTYPE
  // ---------------------------------------------------------------------------

  /**
   * Get industry prototype for tenant based on NACE and size
   */
  async getPrototypeForTenant(): Promise<IndustryPrototype> {
    const context = await this.getTenantContext();
    const sizeClass = getSizeClassFromCount(context.employeeCount);

    // Try to find matching prototype in database
    let prototype = await this.findPrototypeInDB(context.naceCode, sizeClass);

    if (!prototype) {
      // Generate default prototype
      prototype = this.generateDefaultPrototype(context, sizeClass);
    }

    return prototype;
  }

  private async findPrototypeInDB(
    naceCode: string | null,
    sizeClass: CompanySize
  ): Promise<IndustryPrototype | null> {
    if (!naceCode) return null;

    const naceSection = naceCode.match(/^([A-Z])/i)?.[1]?.toUpperCase();
    const naceDivision = naceCode.match(/([0-9]{2})/)?.[1];

    // Convert lowercase size class to uppercase for DB enum
    const dbSizeClass = sizeClass.toUpperCase();

    const result = await pool.query(
      `
      SELECT * FROM industry_profiles
      WHERE company_size_code = $1
        AND nace_class_code LIKE $2
      ORDER BY LENGTH(nace_class_code) DESC
      LIMIT 1
    `,
      [dbSizeClass, naceDivision ? naceDivision + '%' : naceSection + '%']
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      naceSection: row.nace_section,
      naceDivision: row.nace_division,
      naceGroup: row.nace_group,
      sizeClass: row.size_class,
      minEmployees: row.min_employees,
      maxEmployees: row.max_employees,
      typicalDepartments: row.typical_departments || [],
      typicalRoles: row.typical_roles || [],
      typicalHierarchy: row.typical_hierarchy?.levels || DEFAULT_HIERARCHY,
      typicalSpanOfControl: row.typical_span_of_control || getTypicalSpanOfControl(sizeClass),
      escoOccupationCodes: row.esco_occupation_codes || [],
      orgUnitTemplates: row.department_templates || [],
    };
  }

  private generateDefaultPrototype(
    context: TenantContext,
    sizeClass: CompanySize
  ): IndustryPrototype {
    const naceSection = context.naceCode?.match(/^([A-Z])/i)?.[1]?.toUpperCase() || '';
    const naceDivision = context.naceCode?.match(/([0-9]{2})/)?.[1] || '';

    // Generate typical departments based on size
    const typicalDepartments = this.getTypicalDepartments(sizeClass, naceSection);

    return {
      id: 'generated',
      code: `${naceSection}${naceDivision}_${sizeClass}`,
      name: `${this.getNACESectionName(naceSection)} - ${sizeClass}`,
      description: `Generated prototype for ${context.tenantName}`,
      naceSection,
      naceDivision,
      naceGroup: null,
      sizeClass,
      minEmployees: this.getSizeRange(sizeClass).min,
      maxEmployees: this.getSizeRange(sizeClass).max,
      typicalDepartments,
      typicalRoles: context.jobTitles.slice(0, 20),
      typicalHierarchy: DEFAULT_HIERARCHY,
      typicalSpanOfControl: getTypicalSpanOfControl(sizeClass),
      escoOccupationCodes: [],
      orgUnitTemplates: typicalDepartments,
    };
  }

  private getTypicalDepartments(sizeClass: CompanySize, naceSection: string): string[] {
    const core = ['Direzione Generale', 'Amministrazione', 'Risorse Umane'];

    const bySize: Record<CompanySize, string[]> = {
      micro: core,
      small: [...core, 'Commerciale', 'Operations'],
      medium: [...core, 'Commerciale', 'Operations', 'IT', 'Marketing', 'Finance'],
      large: [...core, 'Commerciale', 'Operations', 'IT', 'Marketing', 'Finance', 'Legal', 'R&D'],
      enterprise: [
        ...core,
        'Commerciale',
        'Operations',
        'IT',
        'Marketing',
        'Finance',
        'Legal',
        'R&D',
        'Compliance',
        'Internal Audit',
        'Strategy',
        'Corporate Communications',
      ],
    };

    // Add sector-specific departments
    const bySector: Record<string, string[]> = {
      K: ['Risk Management', 'Credit', 'Treasury', 'Compliance'],
      C: ['Produzione', 'Qualità', 'Logistica', 'Acquisti'],
      J: ['Sviluppo Software', 'Infrastruttura', 'Sicurezza IT'],
      Q: ['Servizi Clinici', 'Servizi Sociali'],
      G: ['Vendite', 'Supply Chain', 'Customer Service'],
    };

    const sectorDepts = bySector[naceSection] || [];
    return [...bySize[sizeClass], ...sectorDepts].slice(0, 15);
  }

  private getSizeRange(sizeClass: CompanySize): { min: number; max: number } {
    const ranges: Record<CompanySize, { min: number; max: number }> = {
      micro: { min: 1, max: 9 },
      small: { min: 10, max: 49 },
      medium: { min: 50, max: 249 },
      large: { min: 250, max: 999 },
      enterprise: { min: 1000, max: 10000 },
    };
    return ranges[sizeClass];
  }

  // ---------------------------------------------------------------------------
  // ESCO OCCUPATIONS
  // ---------------------------------------------------------------------------

  /**
   * Get ESCO occupations relevant for industry
   */
  async getRelevantESCOOccupations(
    naceSection: string,
    limit: number = 50
  ): Promise<ESCOOccupation[]> {
    // Map NACE sections to ESCO ISCO major groups
    const naceToIsco: Record<string, string[]> = {
      K: ['1', '2', '3', '4'], // Financial services -> Managers, Professionals, Technicians, Clerical
      C: ['1', '2', '3', '7', '8'], // Manufacturing -> + Craft workers, Operators
      J: ['1', '2', '3'], // IT -> Managers, Professionals, Technicians
      Q: ['1', '2', '3', '5'], // Healthcare -> + Service workers
      G: ['1', '2', '3', '4', '5'], // Retail -> + Clerical, Service
      F: ['1', '2', '3', '7'], // Construction -> + Craft workers
      H: ['1', '3', '4', '8'], // Transport -> + Operators
      I: ['1', '4', '5', '9'], // Hospitality -> + Elementary occupations
    };

    const iscoGroups = naceToIsco[naceSection] || ['1', '2', '3', '4', '5'];

    const result = await pool.query(
      `
      SELECT
        code,
        preferred_label,
        alt_labels,
        description,
        skill_level,
        isco_08_code
      FROM esco_occupations
      WHERE LEFT(isco_08_code, 1) = ANY($1)
      ORDER BY skill_level DESC, preferred_label
      LIMIT $2
    `,
      [iscoGroups, limit]
    );

    return result.rows.map((row) => ({
      code: row.code,
      preferredLabel: row.preferred_label,
      altLabels: row.alt_labels || [],
      description: row.description,
      skillLevel: row.skill_level,
      isco08Code: row.isco_08_code,
    }));
  }

  /**
   * Match job title to ESCO occupation
   */
  async matchJobTitleToESCO(jobTitle: string): Promise<ESCOOccupation | null> {
    const result = await pool.query(
      `
      SELECT
        code,
        preferred_label,
        alt_labels,
        description,
        skill_level,
        isco_08_code,
        ts_rank(
          to_tsvector('italian', preferred_label || ' ' || COALESCE(array_to_string(alt_labels, ' '), '')),
          plainto_tsquery('italian', $1)
        ) as rank
      FROM esco_occupations
      WHERE to_tsvector('italian', preferred_label || ' ' || COALESCE(array_to_string(alt_labels, ' '), ''))
            @@ plainto_tsquery('italian', $1)
      ORDER BY rank DESC
      LIMIT 1
    `,
      [jobTitle]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      code: row.code,
      preferredLabel: row.preferred_label,
      altLabels: row.alt_labels || [],
      description: row.description,
      skillLevel: row.skill_level,
      isco08Code: row.isco_08_code,
    };
  }

  // ---------------------------------------------------------------------------
  // ORG CHART TEMPLATES
  // ---------------------------------------------------------------------------

  /**
   * Get org chart templates for industry/size
   */
  async getTemplatesForIndustry(
    naceSection: string,
    sizeClass: CompanySize
  ): Promise<Record<string, any>[]> {
    const result = await pool.query(
      `
      SELECT
        t.id,
        t.name,
        t.description,
        t.template_structure,
        t.position_definitions,
        t.level_count
      FROM org_chart_templates t
      JOIN industry_profiles p ON t.profile_id = p.id
      WHERE t.is_active = true
        AND (t.nace_section = $1 OR t.nace_section IS NULL)
        AND (t.size_class = $2 OR t.size_class IS NULL)
      ORDER BY
        CASE WHEN t.nace_section = $1 AND t.size_class = $2 THEN 1
             WHEN t.nace_section = $1 THEN 2
             WHEN t.size_class = $2 THEN 3
             ELSE 4
        END
      LIMIT 5
    `,
      [naceSection, sizeClass]
    );

    return result.rows;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createIndustryPrototypeService(tenantId: string): IndustryPrototypeService {
  return new IndustryPrototypeService(tenantId);
}

export default IndustryPrototypeService;
