/**
 * Workforce Planning Service
 * Sprint 2025-04 - S-ONTO-03-10
 *
 * Workforce planning with future skill projections
 */

import { Pool } from 'pg';

// Types
interface SkillInventoryItem {
  skill_id: string;
  skill_name: string;
  employee_count: number;
  avg_proficiency: number;
  proficiency_distribution: {
    level_1: number;
    level_2: number;
    level_3: number;
    level_4: number;
    level_5: number;
  };
  departments: string[];
}

interface FutureRequirement {
  id?: string;
  skill_id?: string;
  skill_name: string;
  required_count: number;
  required_proficiency: number;
  target_date: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  org_unit_id?: string;
  notes?: string;
}

interface GapRiskAssessment {
  skill_name: string;
  current_count: number;
  required_count: number;
  gap_count: number;
  current_avg_proficiency: number;
  required_proficiency: number;
  proficiency_gap: number;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  risk_factors: string[];
  time_to_target: number; // days
}

interface HiringRecommendation {
  skill_name: string;
  positions_needed: number;
  min_proficiency: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimated_cost_per_hire: number;
  total_estimated_cost: number;
  market_availability: 'scarce' | 'limited' | 'available' | 'abundant';
  rationale: string;
}

interface TrainingInvestment {
  skill_name: string;
  employees_to_train: number;
  current_avg_level: number;
  target_level: number;
  estimated_training_hours: number;
  estimated_cost: number;
  recommended_courses: Array<{
    course_id: string;
    course_title: string;
    duration_hours: number;
    cost_estimate: number;
  }>;
  time_to_proficiency_weeks: number;
  roi_estimate: number;
}

interface WorkforcePlan {
  plan_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  target_date: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  requirements: FutureRequirement[];
  gap_analysis: GapRiskAssessment[];
  hiring_recommendations: HiringRecommendation[];
  training_investments: TrainingInvestment[];
  summary: {
    total_skill_gaps: number;
    critical_gaps: number;
    positions_to_hire: number;
    employees_to_train: number;
    total_hiring_cost: number;
    total_training_cost: number;
    total_investment: number;
  };
  created_at: string;
  updated_at: string;
}

export class WorkforcePlanningService {
  constructor(private pool: Pool) {}

  // --------------------------------------------------------------------------
  // Current Skill Inventory Projection
  // --------------------------------------------------------------------------

  async getSkillInventory(
    tenantId: string,
    options: {
      org_unit_id?: string;
      skill_ids?: string[];
      min_proficiency?: number;
    } = {}
  ): Promise<SkillInventoryItem[]> {
    let query = `
      WITH skill_data AS (
        SELECT
          esp.skill_id,
          COALESCE(es.preferred_label_en, 'Unknown') as skill_name,
          esp.employee_id,
          esp.composite_score,
          e.org_unit_id,
          d.name as department_name
        FROM employee_skill_profiles esp
        JOIN employees e ON e.id = esp.employee_id AND e.is_active = true
        LEFT JOIN esco_skills es ON es.id = esp.skill_id
        LEFT JOIN org_units d ON d.id = e.org_unit_id
        WHERE esp.tenant_id = $1
    `;

    const params: (string | string[] | number)[] = [tenantId];
    let paramIndex = 2;

    if (options.org_unit_id) {
      query += ` AND e.org_unit_id = $${paramIndex}`;
      params.push(options.org_unit_id);
      paramIndex++;
    }

    if (options.skill_ids && options.skill_ids.length > 0) {
      query += ` AND esp.skill_id = ANY($${paramIndex}::uuid[])`;
      params.push(options.skill_ids);
      paramIndex++;
    }

    if (options.min_proficiency !== undefined) {
      query += ` AND esp.composite_score >= $${paramIndex}`;
      params.push(options.min_proficiency);
      paramIndex++;
    }

    query += `
      )
      SELECT
        skill_id,
        skill_name,
        COUNT(DISTINCT employee_id)::int as employee_count,
        ROUND(AVG(composite_score)::numeric, 2) as avg_proficiency,
        json_build_object(
          'level_1', COUNT(*) FILTER (WHERE composite_score >= 1 AND composite_score < 2),
          'level_2', COUNT(*) FILTER (WHERE composite_score >= 2 AND composite_score < 3),
          'level_3', COUNT(*) FILTER (WHERE composite_score >= 3 AND composite_score < 4),
          'level_4', COUNT(*) FILTER (WHERE composite_score >= 4 AND composite_score < 5),
          'level_5', COUNT(*) FILTER (WHERE composite_score >= 5)
        ) as proficiency_distribution,
        array_agg(DISTINCT department_name) FILTER (WHERE department_name IS NOT NULL) as departments
      FROM skill_data
      GROUP BY skill_id, skill_name
      ORDER BY employee_count DESC, skill_name
    `;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // --------------------------------------------------------------------------
  // Gap and Risk Computation
  // --------------------------------------------------------------------------

  async computeGapRisk(
    tenantId: string,
    requirements: FutureRequirement[]
  ): Promise<GapRiskAssessment[]> {
    const assessments: GapRiskAssessment[] = [];

    for (const req of requirements) {
      // Get current inventory for this skill
      const inventoryQuery = `
        SELECT
          COUNT(DISTINCT esp.employee_id)::int as current_count,
          ROUND(AVG(esp.composite_score)::numeric, 2) as current_avg_proficiency,
          COUNT(DISTINCT esp.employee_id) FILTER (WHERE esp.composite_score >= $3)::int as qualified_count
        FROM employee_skill_profiles esp
        JOIN employees e ON e.id = esp.employee_id AND e.is_active = true
        LEFT JOIN esco_skills es ON es.id = esp.skill_id
        WHERE esp.tenant_id = $1
        AND (
          esp.skill_id = $2::uuid
          OR LOWER(es.preferred_label_en) ILIKE '%' || LOWER($4) || '%'
        )
      `;

      const params = [tenantId, req.skill_id || null, req.required_proficiency, req.skill_name];

      const result = await this.pool.query(inventoryQuery, params);
      const inventory = result.rows[0] || {
        current_count: 0,
        current_avg_proficiency: 0,
        qualified_count: 0,
      };

      const gapCount = req.required_count - (inventory.qualified_count || 0);
      const proficiencyGap =
        req.required_proficiency - (parseFloat(inventory.current_avg_proficiency) || 0);

      // Calculate time to target
      const targetDate = new Date(req.target_date);
      const now = new Date();
      const timeToTarget = Math.max(
        0,
        Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );

      // Determine risk factors
      const riskFactors: string[] = [];
      if (gapCount > 0) riskFactors.push(`Need ${gapCount} more qualified employees`);
      if (proficiencyGap > 1)
        riskFactors.push(`Significant proficiency gap of ${proficiencyGap.toFixed(1)} levels`);
      if (timeToTarget < 90 && gapCount > 0) riskFactors.push('Tight timeline (<90 days)');
      if (inventory.current_count === 0) riskFactors.push('No employees with this skill');

      // Determine risk level
      let riskLevel: 'critical' | 'high' | 'medium' | 'low';
      if (
        gapCount > req.required_count * 0.5 ||
        (inventory.current_count === 0 && req.priority === 'critical')
      ) {
        riskLevel = 'critical';
      } else if (gapCount > req.required_count * 0.25 || proficiencyGap > 1.5) {
        riskLevel = 'high';
      } else if (gapCount > 0 || proficiencyGap > 0.5) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'low';
      }

      assessments.push({
        skill_name: req.skill_name,
        current_count: inventory.current_count || 0,
        required_count: req.required_count,
        gap_count: Math.max(0, gapCount),
        current_avg_proficiency: parseFloat(inventory.current_avg_proficiency) || 0,
        required_proficiency: req.required_proficiency,
        proficiency_gap: Math.max(0, proficiencyGap),
        risk_level: riskLevel,
        risk_factors: riskFactors,
        time_to_target: timeToTarget,
      });
    }

    return assessments.sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return riskOrder[a.risk_level] - riskOrder[b.risk_level];
    });
  }

  // --------------------------------------------------------------------------
  // Hiring Recommendations
  // --------------------------------------------------------------------------

  async generateHiringRecommendations(
    _tenantId: string,
    gapAssessments: GapRiskAssessment[]
  ): Promise<HiringRecommendation[]> {
    const recommendations: HiringRecommendation[] = [];

    // Base cost estimates (could be configured per tenant)
    const baseCostPerHire = 50000; // EUR
    const proficiencyMultiplier = { 1: 0.8, 2: 0.9, 3: 1.0, 4: 1.2, 5: 1.5 };

    for (const gap of gapAssessments) {
      // Only recommend hiring if there's a significant gap
      if (gap.gap_count <= 0) continue;

      // Estimate cost based on proficiency requirement
      const profLevel = Math.min(5, Math.max(1, Math.round(gap.required_proficiency)));
      const multiplier =
        proficiencyMultiplier[profLevel as keyof typeof proficiencyMultiplier] || 1;
      const costPerHire = Math.round(baseCostPerHire * multiplier);

      // Determine market availability (simplified - could use external data)
      let marketAvailability: 'scarce' | 'limited' | 'available' | 'abundant';
      if (gap.required_proficiency >= 4.5) {
        marketAvailability = 'scarce';
      } else if (gap.required_proficiency >= 4) {
        marketAvailability = 'limited';
      } else if (gap.required_proficiency >= 3) {
        marketAvailability = 'available';
      } else {
        marketAvailability = 'abundant';
      }

      // Generate rationale
      const rationale =
        gap.current_count === 0
          ? `No current employees with ${gap.skill_name} skill. External hiring essential.`
          : `Current ${gap.current_count} employees insufficient to meet requirement of ${gap.required_count}. Recommend hiring ${gap.gap_count} new employees.`;

      recommendations.push({
        skill_name: gap.skill_name,
        positions_needed: gap.gap_count,
        min_proficiency: gap.required_proficiency,
        priority: gap.risk_level,
        estimated_cost_per_hire: costPerHire,
        total_estimated_cost: costPerHire * gap.gap_count,
        market_availability: marketAvailability,
        rationale,
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  // --------------------------------------------------------------------------
  // Training Investment Suggestions
  // --------------------------------------------------------------------------

  async generateTrainingInvestments(
    tenantId: string,
    gapAssessments: GapRiskAssessment[]
  ): Promise<TrainingInvestment[]> {
    const investments: TrainingInvestment[] = [];

    for (const gap of gapAssessments) {
      // Only recommend training if there's a proficiency gap and we have employees
      if (gap.proficiency_gap <= 0 || gap.current_count === 0) continue;

      // Find relevant courses
      const coursesQuery = `
        SELECT
          c.id as course_id,
          c.title as course_title,
          c.duration_hours,
          500::numeric as cost_estimate,
          ces.proficiency_level_gained
        FROM courses c
        JOIN course_esco_skills ces ON ces.course_id = c.id
        LEFT JOIN esco_skills es ON es.uri = ces.esco_skill_uri
        WHERE c.tenant_id = $1
        AND c.status = 'published'
        AND (
          LOWER(ces.skill_name) ILIKE '%' || LOWER($2) || '%'
          OR LOWER($2) ILIKE '%' || LOWER(ces.skill_name) || '%'
        )
        ORDER BY ces.proficiency_level_gained DESC
        LIMIT 3
      `;

      const coursesResult = await this.pool.query(coursesQuery, [tenantId, gap.skill_name]);
      const courses = coursesResult.rows.map((c) => ({
        course_id: c.course_id,
        course_title: c.course_title,
        duration_hours: parseFloat(c.duration_hours) || 8,
        cost_estimate: parseFloat(c.cost_estimate) || 500,
      }));

      // Calculate training metrics
      const employeesToTrain = gap.current_count;
      const avgCourseHours =
        courses.length > 0
          ? courses.reduce((sum, c) => sum + c.duration_hours, 0) / courses.length
          : 20;
      const avgCourseCost =
        courses.length > 0
          ? courses.reduce((sum, c) => sum + c.cost_estimate, 0) / courses.length
          : 1000;

      const totalHours = avgCourseHours * employeesToTrain;
      const totalCost = avgCourseCost * employeesToTrain;
      const weeksToProf = Math.ceil(gap.proficiency_gap * 4); // 4 weeks per proficiency level

      // Simple ROI estimate (productivity gain vs training cost)
      const productivityGainPerEmployee = 5000; // EUR per year
      const roi = (productivityGainPerEmployee * employeesToTrain - totalCost) / totalCost;

      investments.push({
        skill_name: gap.skill_name,
        employees_to_train: employeesToTrain,
        current_avg_level: gap.current_avg_proficiency,
        target_level: gap.required_proficiency,
        estimated_training_hours: Math.round(totalHours),
        estimated_cost: Math.round(totalCost),
        recommended_courses: courses,
        time_to_proficiency_weeks: weeksToProf,
        roi_estimate: Math.round(roi * 100) / 100,
      });
    }

    return investments.sort((a, b) => b.roi_estimate - a.roi_estimate);
  }

  // --------------------------------------------------------------------------
  // Create Workforce Plan
  // --------------------------------------------------------------------------

  async createWorkforcePlan(
    tenantId: string,
    planData: {
      name: string;
      description?: string;
      target_date: string;
      requirements: FutureRequirement[];
    }
  ): Promise<WorkforcePlan> {
    // Compute gap analysis
    const gapAnalysis = await this.computeGapRisk(tenantId, planData.requirements);

    // Generate recommendations
    const hiringRecommendations = await this.generateHiringRecommendations(tenantId, gapAnalysis);
    const trainingInvestments = await this.generateTrainingInvestments(tenantId, gapAnalysis);

    // Calculate summary
    const summary = {
      total_skill_gaps: gapAnalysis.filter((g) => g.gap_count > 0 || g.proficiency_gap > 0).length,
      critical_gaps: gapAnalysis.filter((g) => g.risk_level === 'critical').length,
      positions_to_hire: hiringRecommendations.reduce((sum, r) => sum + r.positions_needed, 0),
      employees_to_train: trainingInvestments.reduce((sum, t) => sum + t.employees_to_train, 0),
      total_hiring_cost: hiringRecommendations.reduce((sum, r) => sum + r.total_estimated_cost, 0),
      total_training_cost: trainingInvestments.reduce((sum, t) => sum + t.estimated_cost, 0),
      total_investment: 0,
    };
    summary.total_investment = summary.total_hiring_cost + summary.total_training_cost;

    // Save to database
    const insertQuery = `
      INSERT INTO workforce_plans (
        tenant_id, name, description, target_date, status,
        requirements, gap_analysis, hiring_recommendations,
        training_investments, summary
      ) VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9)
      RETURNING id, created_at, updated_at
    `;

    const result = await this.pool.query(insertQuery, [
      tenantId,
      planData.name,
      planData.description || null,
      planData.target_date,
      JSON.stringify(planData.requirements),
      JSON.stringify(gapAnalysis),
      JSON.stringify(hiringRecommendations),
      JSON.stringify(trainingInvestments),
      JSON.stringify(summary),
    ]);

    return {
      plan_id: result.rows[0].id,
      tenant_id: tenantId,
      name: planData.name,
      ...(planData.description !== undefined ? { description: planData.description } : {}),
      target_date: planData.target_date,
      status: 'draft',
      requirements: planData.requirements,
      gap_analysis: gapAnalysis,
      hiring_recommendations: hiringRecommendations,
      training_investments: trainingInvestments,
      summary,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at,
    };
  }

  // --------------------------------------------------------------------------
  // Get Workforce Plans
  // --------------------------------------------------------------------------

  async getWorkforcePlans(
    tenantId: string,
    options: { status?: string } = {}
  ): Promise<WorkforcePlan[]> {
    let query = `
      SELECT
        id as plan_id, tenant_id, name, description, target_date::text,
        status, requirements, gap_analysis, hiring_recommendations,
        training_investments, summary, created_at::text, updated_at::text
      FROM workforce_plans
      WHERE tenant_id = $1
    `;

    const params: string[] = [tenantId];
    if (options.status) {
      query += ` AND status = $2`;
      params.push(options.status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // --------------------------------------------------------------------------
  // Get Workforce Plan by ID
  // --------------------------------------------------------------------------

  async getWorkforcePlanById(tenantId: string, planId: string): Promise<WorkforcePlan | null> {
    const result = await this.pool.query(
      `
      SELECT
        id as plan_id, tenant_id, name, description, target_date::text,
        status, requirements, gap_analysis, hiring_recommendations,
        training_investments, summary, created_at::text, updated_at::text
      FROM workforce_plans
      WHERE id = $1 AND tenant_id = $2
    `,
      [planId, tenantId]
    );

    return result.rows[0] || null;
  }

  // --------------------------------------------------------------------------
  // Update Workforce Plan Status
  // --------------------------------------------------------------------------

  async updatePlanStatus(
    tenantId: string,
    planId: string,
    status: 'draft' | 'active' | 'completed' | 'archived'
  ): Promise<boolean> {
    const result = await this.pool.query(
      `
      UPDATE workforce_plans
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING id
    `,
      [status, planId, tenantId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }
}

export default WorkforcePlanningService;
