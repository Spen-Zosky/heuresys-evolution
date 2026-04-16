/**
 * Staffing Rules Generator Service
 * Calculates optimal staffing, retrieves industry benchmarks, and validates ratios
 * Part of Tenant Prototype Generator System
 */

import { pool } from '../config/database.js';
import { CompanySize } from './industry-prototype.js';

// =============================================================================
// TYPES
// =============================================================================

export interface StaffingRule {
  id?: string;
  prototypeId: string;
  orgUnitTemplateId: string;
  jobTemplateId: string;
  companySize: CompanySize;
  minHeadcount: number;
  maxHeadcount?: number;
  recommendedHeadcount?: number;
  isMandatory: boolean;
  rationale?: string;
}

export interface IndustryBenchmark {
  naceCode: string;
  naceName: string;
  sizeClass: CompanySize;
  totalEmployeeRange: { min: number; max: number };
  ratios: StaffingRatio[];
  spanOfControl: SpanOfControlBenchmark[];
  productivityMetrics: ProductivityMetric[];
  source: string;
  updatedAt: Date;
}

export interface StaffingRatio {
  category: string;
  description: string;
  ratio: string;
  benchmark: number;
  unit: string;
  interpretationGuide: string;
}

export interface SpanOfControlBenchmark {
  level: number;
  levelName: string;
  minReports: number;
  maxReports: number;
  optimalReports: number;
}

export interface ProductivityMetric {
  metricCode: string;
  metricName: string;
  value: number;
  unit: string;
  benchmark: string;
}

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
  recommendations: string[];
}

export interface ValidationIssue {
  severity: 'critical' | 'major' | 'minor';
  code: string;
  message: string;
  affectedUnit?: string;
  affectedRole?: string;
  suggestedFix?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  context: string;
}

export interface StaffingPlanForValidation {
  totalHeadcount: number;
  byOrgUnit: {
    orgUnitCode: string;
    headcount: number;
    roles: { jobCode: string; count: number }[];
  }[];
  sizeClass: CompanySize;
  prototypeId?: string;
}

export interface OptimalStaffingResult {
  prototypeId: string;
  sizeClass: CompanySize;
  rules: StaffingRule[];
  totalMinHeadcount: number;
  totalMaxHeadcount: number;
  totalRecommendedHeadcount: number;
  breakdown: DepartmentStaffingBreakdown[];
  generationLog: string[];
}

export interface DepartmentStaffingBreakdown {
  orgUnitCode: string;
  orgUnitName: string;
  minHeadcount: number;
  maxHeadcount: number;
  recommendedHeadcount: number;
  roles: RoleStaffingDetail[];
}

export interface RoleStaffingDetail {
  jobCode: string;
  jobTitle: string;
  minHeadcount: number;
  maxHeadcount: number;
  recommendedHeadcount: number;
  isMandatory: boolean;
}

// =============================================================================
// INDUSTRY BENCHMARK TEMPLATES
// =============================================================================

const INDUSTRY_BENCHMARKS: Record<string, Partial<IndustryBenchmark>> = {
  'K.64': {
    naceName: 'Financial service activities, except insurance and pension funding',
    ratios: [
      {
        category: 'Staff Efficiency',
        description: 'Revenue per employee',
        ratio: 'revenue/employee',
        benchmark: 250000,
        unit: 'EUR',
        interpretationGuide: 'Higher is better. European banking average.',
      },
      {
        category: 'HR Ratio',
        description: 'HR staff to total employees',
        ratio: 'HR_staff/total',
        benchmark: 0.015,
        unit: 'ratio',
        interpretationGuide: '1.5% of total workforce. Lower in large banks.',
      },
      {
        category: 'IT Ratio',
        description: 'IT staff to total employees',
        ratio: 'IT_staff/total',
        benchmark: 0.12,
        unit: 'ratio',
        interpretationGuide: '12% of workforce. Banks are technology-intensive.',
      },
      {
        category: 'Operations Ratio',
        description: 'Operations to front-office',
        ratio: 'ops/front_office',
        benchmark: 1.5,
        unit: 'ratio',
        interpretationGuide: '1.5 ops staff per front-office staff.',
      },
      {
        category: 'Compliance Ratio',
        description: 'Compliance staff per 100 employees',
        ratio: 'compliance/100emp',
        benchmark: 3,
        unit: 'per 100',
        interpretationGuide: '3 compliance officers per 100 employees.',
      },
    ],
    spanOfControl: [
      { level: 1, levelName: 'CEO', minReports: 4, maxReports: 10, optimalReports: 7 },
      { level: 2, levelName: 'Executive', minReports: 3, maxReports: 8, optimalReports: 5 },
      { level: 3, levelName: 'Director', minReports: 4, maxReports: 12, optimalReports: 8 },
      { level: 4, levelName: 'Manager', minReports: 6, maxReports: 15, optimalReports: 10 },
      { level: 5, levelName: 'Team Lead', minReports: 5, maxReports: 12, optimalReports: 8 },
    ],
    productivityMetrics: [
      {
        metricCode: 'COST_INCOME',
        metricName: 'Cost-to-Income Ratio',
        value: 60,
        unit: '%',
        benchmark: '<65% good, <55% excellent',
      },
      {
        metricCode: 'NPL',
        metricName: 'Non-Performing Loans Ratio',
        value: 3,
        unit: '%',
        benchmark: '<5% good',
      },
      {
        metricCode: 'TIER1',
        metricName: 'Tier 1 Capital Ratio',
        value: 12,
        unit: '%',
        benchmark: '>10.5% required, >14% strong',
      },
    ],
    source: 'EBA Banking Statistics, ECB Data Warehouse',
  },
  'C.10': {
    naceName: 'Manufacture of food products',
    ratios: [
      {
        category: 'Production Efficiency',
        description: 'Revenue per production employee',
        ratio: 'revenue/prod_employee',
        benchmark: 180000,
        unit: 'EUR',
        interpretationGuide: 'Varies by product type. Processed foods higher.',
      },
      {
        category: 'Direct/Indirect Labor',
        description: 'Production workers to support staff',
        ratio: 'direct/indirect',
        benchmark: 3.0,
        unit: 'ratio',
        interpretationGuide: '3 production workers per support staff member.',
      },
      {
        category: 'Quality Staff',
        description: 'QA/QC staff per 100 production employees',
        ratio: 'QA/100prod',
        benchmark: 5,
        unit: 'per 100',
        interpretationGuide: 'Higher in regulated products (dairy, meat).',
      },
      {
        category: 'Maintenance Ratio',
        description: 'Maintenance staff per production line',
        ratio: 'maint/line',
        benchmark: 2.5,
        unit: 'per line',
        interpretationGuide: '2-3 maintenance techs per production line.',
      },
      {
        category: 'Supervisory Ratio',
        description: 'Production supervisors to workers',
        ratio: 'supervisor/worker',
        benchmark: 0.08,
        unit: 'ratio',
        interpretationGuide: '1 supervisor per 12-15 production workers.',
      },
    ],
    spanOfControl: [
      { level: 1, levelName: 'CEO', minReports: 3, maxReports: 8, optimalReports: 5 },
      { level: 2, levelName: 'Director', minReports: 3, maxReports: 7, optimalReports: 5 },
      { level: 3, levelName: 'Plant Manager', minReports: 4, maxReports: 10, optimalReports: 6 },
      { level: 4, levelName: 'OrgUnit Head', minReports: 5, maxReports: 15, optimalReports: 10 },
      { level: 5, levelName: 'Supervisor', minReports: 10, maxReports: 25, optimalReports: 15 },
    ],
    productivityMetrics: [
      {
        metricCode: 'OEE',
        metricName: 'Overall Equipment Effectiveness',
        value: 85,
        unit: '%',
        benchmark: '>85% world class',
      },
      {
        metricCode: 'YIELD',
        metricName: 'Product Yield Rate',
        value: 98,
        unit: '%',
        benchmark: '>97% good',
      },
      {
        metricCode: 'TURNOVER',
        metricName: 'Inventory Turnover',
        value: 12,
        unit: 'times/year',
        benchmark: '>10 good for food',
      },
    ],
    source: 'FoodDrinkEurope Industry Statistics, Eurostat',
  },
};

// =============================================================================
// SIZE-BASED MULTIPLIERS
// =============================================================================

const SIZE_MULTIPLIERS: Record<CompanySize, { min: number; max: number; factor: number }> = {
  micro: { min: 1, max: 9, factor: 0.2 },
  small: { min: 10, max: 49, factor: 0.5 },
  medium: { min: 50, max: 249, factor: 1.0 },
  large: { min: 250, max: 999, factor: 2.0 },
  enterprise: { min: 1000, max: 50000, factor: 5.0 },
};

// =============================================================================
// STAFFING RULES GENERATOR SERVICE
// =============================================================================

export class StaffingRulesGeneratorService {
  // tenantId is stored for future tenant-specific operations
  constructor(_tenantId: string) {
    void _tenantId;
  }

  // ---------------------------------------------------------------------------
  // OPTIMAL STAFFING CALCULATION
  // ---------------------------------------------------------------------------

  /**
   * Calculate optimal staffing for a prototype and company size
   */
  async calculateOptimalStaffing(
    prototypeId: string,
    sizeClass: CompanySize
  ): Promise<OptimalStaffingResult> {
    const log: string[] = [];
    log.push(`Starting staffing calculation for prototype ${prototypeId}, size ${sizeClass}`);

    // Get prototype details
    const prototype = await this.getPrototype(prototypeId);
    log.push(
      `Prototype found: ${prototype.name} (NACE ${prototype.nace_section}.${prototype.nace_division})`
    );

    // Get existing staffing rules from database
    const existingRules = await this.getExistingRules(prototypeId, sizeClass);
    log.push(`Found ${existingRules.length} existing rules in database`);

    // Get org unit templates for this prototype
    const orgUnits = await this.getOrgUnitTemplates(prototypeId);
    log.push(`Found ${orgUnits.length} org unit templates`);

    // Get job templates for this prototype
    const jobTemplates = await this.getJobTemplates(prototypeId);
    log.push(`Found ${jobTemplates.length} job templates`);

    // Calculate or use existing rules
    const rules: StaffingRule[] = [];
    const breakdown: DepartmentStaffingBreakdown[] = [];

    for (const orgUnit of orgUnits) {
      const orgUnitRoles: RoleStaffingDetail[] = [];
      let unitMinHeadcount = 0;
      let unitMaxHeadcount = 0;
      let unitRecommendedHeadcount = 0;

      // Find jobs for this org unit
      const orgJobs = jobTemplates.filter((j) => j.org_unit_template_id === orgUnit.id);

      for (const job of orgJobs) {
        // Check for existing rule
        const existingRule = existingRules.find(
          (r) => r.org_unit_template_id === orgUnit.id && r.job_template_id === job.id
        );

        let min: number, max: number, recommended: number, mandatory: boolean;

        if (existingRule) {
          // Use existing rule
          min = existingRule.min_headcount;
          max = existingRule.max_headcount || existingRule.min_headcount * 2;
          recommended = existingRule.recommended_headcount || Math.ceil((min + max) / 2);
          mandatory = existingRule.is_mandatory;
          log.push(`Using existing rule for ${orgUnit.code}/${job.job_code}: ${min}-${max}`);
        } else {
          // Generate rule based on size multipliers and role level
          const calculated = this.calculateRoleStaffing(job, sizeClass);
          min = calculated.min;
          max = calculated.max;
          recommended = calculated.recommended;
          mandatory = calculated.mandatory;
          log.push(`Generated rule for ${orgUnit.code}/${job.job_code}: ${min}-${max}`);
        }

        rules.push({
          prototypeId,
          orgUnitTemplateId: orgUnit.id,
          jobTemplateId: job.id,
          companySize: sizeClass,
          minHeadcount: min,
          maxHeadcount: max,
          recommendedHeadcount: recommended,
          isMandatory: mandatory,
        });

        orgUnitRoles.push({
          jobCode: job.job_code,
          jobTitle: job.title_en || job.title_it,
          minHeadcount: min,
          maxHeadcount: max,
          recommendedHeadcount: recommended,
          isMandatory: mandatory,
        });

        unitMinHeadcount += min;
        unitMaxHeadcount += max;
        unitRecommendedHeadcount += recommended;
      }

      if (orgUnitRoles.length > 0) {
        breakdown.push({
          orgUnitCode: orgUnit.code,
          orgUnitName: orgUnit.name_en || orgUnit.name_it,
          minHeadcount: unitMinHeadcount,
          maxHeadcount: unitMaxHeadcount,
          recommendedHeadcount: unitRecommendedHeadcount,
          roles: orgUnitRoles,
        });
      }
    }

    // Calculate totals
    const totalMinHeadcount = breakdown.reduce((sum, b) => sum + b.minHeadcount, 0);
    const totalMaxHeadcount = breakdown.reduce((sum, b) => sum + b.maxHeadcount, 0);
    const totalRecommendedHeadcount = breakdown.reduce((sum, b) => sum + b.recommendedHeadcount, 0);

    log.push(
      `Total staffing: ${totalMinHeadcount}-${totalMaxHeadcount}, recommended: ${totalRecommendedHeadcount}`
    );

    return {
      prototypeId,
      sizeClass,
      rules,
      totalMinHeadcount,
      totalMaxHeadcount,
      totalRecommendedHeadcount,
      breakdown,
      generationLog: log,
    };
  }

  private calculateRoleStaffing(
    job: any,
    sizeClass: CompanySize
  ): {
    min: number;
    max: number;
    recommended: number;
    mandatory: boolean;
  } {
    const multiplier = SIZE_MULTIPLIERS[sizeClass];
    const orgLevel = job.org_level || 4;

    // Base staffing by org level
    const baseStaffing: Record<number, { min: number; max: number }> = {
      1: { min: 1, max: 1 }, // CEO - always 1
      2: { min: 1, max: 2 }, // Director
      3: { min: 1, max: 4 }, // Manager
      4: { min: 2, max: 10 }, // Specialist
      5: { min: 3, max: 20 }, // Staff
      6: { min: 5, max: 50 }, // Operative
    };

    const base = baseStaffing[orgLevel] || baseStaffing[4]!;

    // Apply size multiplier
    let min = Math.max(1, Math.ceil(base!.min * multiplier.factor));
    let max = Math.max(min, Math.ceil(base!.max * multiplier.factor));

    // Adjust for micro/small companies
    if (sizeClass === 'micro') {
      max = Math.min(max, 3);
      min = Math.min(min, 1);
    } else if (sizeClass === 'small') {
      max = Math.min(max, 10);
    }

    // Management roles are typically singular
    if (job.is_management || orgLevel <= 2) {
      if (sizeClass !== 'enterprise') {
        min = 1;
        max = Math.min(max, 2);
      }
    }

    const recommended = Math.ceil((min + max) / 2);
    const mandatory = orgLevel <= 3 || job.is_mandatory;

    return { min, max, recommended, mandatory };
  }

  // ---------------------------------------------------------------------------
  // INDUSTRY BENCHMARKS
  // ---------------------------------------------------------------------------

  /**
   * Get industry benchmarks for a NACE code
   */
  async getIndustryBenchmarks(naceCode: string): Promise<IndustryBenchmark> {
    // First check database for cached benchmarks
    const cached = await this.getCachedBenchmark(naceCode);
    if (cached) {
      return cached;
    }

    // Get from templates or generate
    const template = INDUSTRY_BENCHMARKS[naceCode];
    if (template) {
      const benchmark: IndustryBenchmark = {
        naceCode,
        naceName: template.naceName || `Industry ${naceCode}`,
        sizeClass: 'medium',
        totalEmployeeRange: SIZE_MULTIPLIERS.medium,
        ratios: template.ratios || [],
        spanOfControl: template.spanOfControl || this.getDefaultSpanOfControl(),
        productivityMetrics: template.productivityMetrics || [],
        source: template.source || 'Generated from industry templates',
        updatedAt: new Date(),
      };

      return benchmark;
    }

    // Return generic benchmark
    return this.generateGenericBenchmark(naceCode);
  }

  private async getCachedBenchmark(naceCode: string): Promise<IndustryBenchmark | null> {
    // Check if we have prototype with benchmark data
    const result = await pool.query(
      `
      SELECT ip.*, ip.typical_span_of_control
      FROM industry_profiles ip
      WHERE ip.nace_class_code = $1
      LIMIT 1
    `,
      [naceCode]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const proto = result.rows[0];
    const soc = proto.typical_span_of_control || [5, 7, 10, 8, 6, 4];

    return {
      naceCode,
      naceName: proto.name,
      sizeClass: (proto.company_size_code?.toLowerCase() as CompanySize) || 'medium',
      totalEmployeeRange: {
        min: proto.min_employees || 50,
        max: proto.max_employees || 249,
      },
      ratios: [],
      spanOfControl: soc.map((optimal: number, index: number) => ({
        level: index + 1,
        levelName:
          ['CEO', 'Director', 'Manager', 'Team Lead', 'Supervisor', 'Staff'][index] ||
          `Level ${index + 1}`,
        minReports: Math.max(1, optimal - 3),
        maxReports: optimal + 5,
        optimalReports: optimal,
      })),
      productivityMetrics: [],
      source: 'Database prototype',
      updatedAt: proto.updated_at || proto.created_at || new Date(),
    };
  }

  private getDefaultSpanOfControl(): SpanOfControlBenchmark[] {
    return [
      { level: 1, levelName: 'CEO', minReports: 3, maxReports: 10, optimalReports: 6 },
      { level: 2, levelName: 'Director', minReports: 3, maxReports: 10, optimalReports: 7 },
      { level: 3, levelName: 'Manager', minReports: 5, maxReports: 15, optimalReports: 10 },
      { level: 4, levelName: 'Team Lead', minReports: 5, maxReports: 12, optimalReports: 8 },
      { level: 5, levelName: 'Supervisor', minReports: 8, maxReports: 20, optimalReports: 12 },
    ];
  }

  private generateGenericBenchmark(naceCode: string): IndustryBenchmark {
    return {
      naceCode,
      naceName: `Industry ${naceCode}`,
      sizeClass: 'medium',
      totalEmployeeRange: SIZE_MULTIPLIERS.medium,
      ratios: [
        {
          category: 'HR Ratio',
          description: 'HR staff to total employees',
          ratio: 'HR_staff/total',
          benchmark: 0.02,
          unit: 'ratio',
          interpretationGuide: 'Generic 2% of workforce',
        },
        {
          category: 'Admin Ratio',
          description: 'Admin staff to total employees',
          ratio: 'admin_staff/total',
          benchmark: 0.1,
          unit: 'ratio',
          interpretationGuide: 'Generic 10% of workforce',
        },
      ],
      spanOfControl: this.getDefaultSpanOfControl(),
      productivityMetrics: [],
      source: 'Generic industry template',
      updatedAt: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // STAFFING VALIDATION
  // ---------------------------------------------------------------------------

  /**
   * Validate a staffing plan against rules and benchmarks
   */
  async validateStaffingRatios(staffingPlan: StaffingPlanForValidation): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Validate total headcount against size class
    const sizeRange = SIZE_MULTIPLIERS[staffingPlan.sizeClass];
    if (staffingPlan.totalHeadcount < sizeRange.min) {
      issues.push({
        severity: 'major',
        code: 'UNDER_STAFFED',
        message: `Total headcount (${staffingPlan.totalHeadcount}) is below minimum for ${staffingPlan.sizeClass} companies (${sizeRange.min})`,
        suggestedFix: `Increase headcount to at least ${sizeRange.min}`,
      });
      score -= 20;
    } else if (staffingPlan.totalHeadcount > sizeRange.max) {
      warnings.push({
        code: 'OVER_STAFFED',
        message: `Total headcount (${staffingPlan.totalHeadcount}) exceeds typical maximum for ${staffingPlan.sizeClass} companies (${sizeRange.max})`,
        context: 'Consider if this is appropriate for your industry',
      });
      score -= 5;
    }

    // Validate org unit distribution
    const maxUnitHeadcount = Math.max(...staffingPlan.byOrgUnit.map((u) => u.headcount));
    // minUnitHeadcount can be used for more detailed analysis in future
    void Math.min(...staffingPlan.byOrgUnit.map((u) => u.headcount));
    const avgUnitHeadcount = staffingPlan.totalHeadcount / staffingPlan.byOrgUnit.length;

    if (maxUnitHeadcount > avgUnitHeadcount * 3) {
      warnings.push({
        code: 'UNBALANCED_DISTRIBUTION',
        message: `Some org units have significantly more staff than others (max: ${maxUnitHeadcount}, avg: ${Math.round(avgUnitHeadcount)})`,
        context: 'This may indicate organizational imbalance',
      });
      recommendations.push(
        'Review the org unit with maximum headcount for potential restructuring'
      );
    }

    // Validate against prototype rules if provided
    if (staffingPlan.prototypeId) {
      const optimalStaffing = await this.calculateOptimalStaffing(
        staffingPlan.prototypeId,
        staffingPlan.sizeClass
      );

      // Check against recommended staffing
      const deviation = Math.abs(
        staffingPlan.totalHeadcount - optimalStaffing.totalRecommendedHeadcount
      );
      const deviationPercent = (deviation / optimalStaffing.totalRecommendedHeadcount) * 100;

      if (deviationPercent > 30) {
        issues.push({
          severity: 'major',
          code: 'SIGNIFICANT_DEVIATION',
          message: `Total headcount deviates ${Math.round(deviationPercent)}% from recommended staffing (${staffingPlan.totalHeadcount} vs ${optimalStaffing.totalRecommendedHeadcount})`,
          suggestedFix: `Consider adjusting to closer to ${optimalStaffing.totalRecommendedHeadcount} employees`,
        });
        score -= 15;
      } else if (deviationPercent > 15) {
        warnings.push({
          code: 'MODERATE_DEVIATION',
          message: `Total headcount deviates ${Math.round(deviationPercent)}% from recommended`,
          context: `Recommended: ${optimalStaffing.totalRecommendedHeadcount}`,
        });
        score -= 5;
      }

      // Validate mandatory roles
      for (const rule of optimalStaffing.rules) {
        if (rule.isMandatory) {
          // Find corresponding unit in plan
          const matchingUnit = staffingPlan.byOrgUnit.find((u) =>
            optimalStaffing.breakdown.find(
              (b) =>
                b.orgUnitCode === u.orgUnitCode &&
                b.roles.some((r) => r.jobCode === rule.jobTemplateId && r.isMandatory)
            )
          );

          if (!matchingUnit || matchingUnit.headcount === 0) {
            issues.push({
              severity: 'critical',
              code: 'MISSING_MANDATORY_ROLE',
              message: `Mandatory role is missing or understaffed`,
              affectedUnit: rule.orgUnitTemplateId,
              suggestedFix: 'Add at least 1 person to this role',
            });
            score -= 10;
          }
        }
      }
    }

    // Validate span of control
    for (const unit of staffingPlan.byOrgUnit) {
      const managementRoles = unit.roles.filter(
        (r) =>
          r.jobCode.includes('-DIR') || r.jobCode.includes('-MGR') || r.jobCode.includes('-EXEC')
      );
      const nonManagementRoles = unit.roles.filter(
        (r) =>
          !r.jobCode.includes('-DIR') && !r.jobCode.includes('-MGR') && !r.jobCode.includes('-EXEC')
      );

      const managers = managementRoles.reduce((sum, r) => sum + r.count, 0);
      const staff = nonManagementRoles.reduce((sum, r) => sum + r.count, 0);

      if (managers > 0 && staff > 0) {
        const spanOfControl = staff / managers;

        if (spanOfControl > 20) {
          issues.push({
            severity: 'major',
            code: 'EXCESSIVE_SPAN_OF_CONTROL',
            message: `Span of control too high in ${unit.orgUnitCode} (${Math.round(spanOfControl)} reports per manager)`,
            affectedUnit: unit.orgUnitCode,
            suggestedFix: 'Add more management positions',
          });
          score -= 10;
        } else if (spanOfControl < 3 && staffingPlan.sizeClass !== 'micro') {
          warnings.push({
            code: 'LOW_SPAN_OF_CONTROL',
            message: `Span of control is low in ${unit.orgUnitCode} (${Math.round(spanOfControl)} reports per manager)`,
            context: 'Consider if all management positions are necessary',
          });
          score -= 3;
        }
      }
    }

    // Generate recommendations
    if (score < 80) {
      recommendations.push('Review overall staffing structure against industry benchmarks');
    }
    if (issues.some((i) => i.code === 'MISSING_MANDATORY_ROLE')) {
      recommendations.push('Fill all mandatory roles before proceeding');
    }
    if (warnings.some((w) => w.code === 'UNBALANCED_DISTRIBUTION')) {
      recommendations.push('Consider reorganizing to balance workload across departments');
    }

    return {
      isValid: score >= 60 && !issues.some((i) => i.severity === 'critical'),
      score: Math.max(0, score),
      issues,
      warnings,
      recommendations,
    };
  }

  // ---------------------------------------------------------------------------
  // CRUD OPERATIONS FOR STAFFING RULES
  // ---------------------------------------------------------------------------

  /**
   * Save staffing rules to database
   */
  async saveStaffingRules(rules: StaffingRule[]): Promise<void> {
    for (const rule of rules) {
      await pool.query(
        `
        INSERT INTO org_prototype_rules (
          prototype_id,
          org_unit_template_id,
          job_template_id,
          company_size,
          min_headcount,
          max_headcount,
          recommended_headcount,
          is_mandatory,
          rationale
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (prototype_id, org_unit_template_id, job_template_id, company_size)
        DO UPDATE SET
          min_headcount = $5,
          max_headcount = $6,
          recommended_headcount = $7,
          is_mandatory = $8,
          rationale = $9,
          updated_at = NOW()
      `,
        [
          rule.prototypeId,
          rule.orgUnitTemplateId,
          rule.jobTemplateId,
          rule.companySize.toUpperCase(),
          rule.minHeadcount,
          rule.maxHeadcount,
          rule.recommendedHeadcount,
          rule.isMandatory,
          rule.rationale,
        ]
      );
    }
  }

  /**
   * Get staffing rules for a prototype
   */
  async getStaffingRules(prototypeId: string, sizeClass?: CompanySize): Promise<StaffingRule[]> {
    let query = `
      SELECT
        psr.*,
        out.code as org_unit_code,
        out.name_en as org_unit_name,
        jt.job_code,
        jt.title_en as job_title
      FROM org_prototype_rules psr
      JOIN org_unit_templates out ON psr.org_unit_template_id = out.id
      JOIN job_templates jt ON psr.job_template_id = jt.id
      WHERE psr.prototype_id = $1
    `;
    const params: unknown[] = [prototypeId];

    if (sizeClass) {
      query += ' AND psr.company_size = $2';
      params.push(sizeClass.toUpperCase());
    }

    query += ' ORDER BY out.code, jt.job_code';

    const result = await pool.query(query, params);

    return result.rows.map((row) => ({
      id: row.id,
      prototypeId: row.prototype_id,
      orgUnitTemplateId: row.org_unit_template_id,
      jobTemplateId: row.job_template_id,
      companySize: row.company_size.toLowerCase() as CompanySize,
      minHeadcount: row.min_headcount,
      maxHeadcount: row.max_headcount,
      recommendedHeadcount: row.recommended_headcount,
      isMandatory: row.is_mandatory,
      rationale: row.rationale,
    }));
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  private async getPrototype(prototypeId: string): Promise<Record<string, any>> {
    const result = await pool.query('SELECT * FROM industry_profiles WHERE id = $1', [prototypeId]);

    if (result.rows.length === 0) {
      throw new Error(`Prototype not found: ${prototypeId}`);
    }

    return result.rows[0];
  }

  private async getExistingRules(
    prototypeId: string,
    sizeClass: CompanySize
  ): Promise<Record<string, any>[]> {
    const result = await pool.query(
      `
      SELECT * FROM org_prototype_rules
      WHERE prototype_id = $1 AND company_size = $2
    `,
      [prototypeId, sizeClass.toUpperCase()]
    );

    return result.rows;
  }

  private async getOrgUnitTemplates(prototypeId: string): Promise<Record<string, any>[]> {
    const result = await pool.query(
      `
      SELECT out.*
      FROM org_unit_templates out
      JOIN org_chart_templates oct ON out.org_chart_template_id = oct.id
      WHERE oct.id = (
        SELECT id FROM org_chart_templates
        WHERE profile_id = $1
        LIMIT 1
      )
      ORDER BY out.level, out.code
    `,
      [prototypeId]
    );

    return result.rows;
  }

  private async getJobTemplates(prototypeId: string): Promise<Record<string, any>[]> {
    const result = await pool.query(
      `
      SELECT jt.*
      FROM job_templates jt
      JOIN org_unit_templates out ON jt.org_unit_template_id = out.id
      JOIN org_chart_templates oct ON out.org_chart_template_id = oct.id
      WHERE oct.id = (
        SELECT id FROM org_chart_templates
        WHERE profile_id = $1
        LIMIT 1
      )
      ORDER BY jt.org_level, jt.job_code
    `,
      [prototypeId]
    );

    return result.rows;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createStaffingRulesGeneratorService(
  tenantId: string
): StaffingRulesGeneratorService {
  return new StaffingRulesGeneratorService(tenantId);
}

export default StaffingRulesGeneratorService;
