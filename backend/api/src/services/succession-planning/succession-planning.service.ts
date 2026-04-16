/**
 * Succession Planning Service
 * Sprint 2025-04 - S-ONTO-03-11
 *
 * Skill-based succession planning with candidate identification,
 * readiness scoring, development plans, and risk assessment
 */

import { Pool } from 'pg';

// Types
interface SuccessionCandidate {
  employee_id: string;
  employee_name: string;
  current_role: string;
  department: string;
  readiness_score: number;
  readiness_level: 'ready_now' | 'ready_1_year' | 'ready_2_years' | 'needs_development';
  skill_match_percentage: number;
  matching_skills: number;
  total_required_skills: number;
  skill_gaps: SkillGap[];
  development_plan: DevelopmentAction[];
  strengths: string[];
  time_to_ready_months: number;
}

interface SkillGap {
  skill_id: string;
  skill_name: string;
  required_level: number;
  current_level: number;
  gap: number;
  importance: string;
}

interface DevelopmentAction {
  action_type: 'training' | 'mentoring' | 'project' | 'job_rotation' | 'certification';
  skill_name: string;
  description: string;
  estimated_duration_weeks: number;
  priority: 'high' | 'medium' | 'low';
  recommended_courses?: Array<{
    course_id: string;
    course_title: string;
    duration_hours: number;
  }>;
}

interface RoleRiskAssessment {
  role_id: string;
  role_name: string;
  current_incumbent_id?: string;
  current_incumbent_name?: string;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  risk_factors: string[];
  succession_readiness: 'strong' | 'adequate' | 'weak' | 'none';
  ready_now_candidates: number;
  ready_1_year_candidates: number;
  ready_2_years_candidates: number;
  bench_strength: number;
  recommended_actions: string[];
}

interface SuccessionPlanResult {
  role: {
    id: string;
    title: string;
    department?: string;
    required_skills: number;
  };
  risk_assessment: RoleRiskAssessment;
  candidates: SuccessionCandidate[];
  summary: {
    total_candidates_evaluated: number;
    qualified_candidates: number;
    average_readiness_score: number;
    average_skill_match: number;
    coverage_ratio: number;
  };
}

export class SuccessionPlanningService {
  constructor(private pool: Pool) {}

  // --------------------------------------------------------------------------
  // Get Succession Plan for a Role
  // --------------------------------------------------------------------------

  async getSuccessionPlan(
    tenantId: string,
    roleId: string,
    options: {
      min_skill_match?: number;
      max_candidates?: number;
      include_development_plans?: boolean;
      org_unit_id?: string;
    } = {}
  ): Promise<SuccessionPlanResult> {
    const minSkillMatch = options.min_skill_match ?? 0.5;
    const maxCandidates = options.max_candidates ?? 10;
    const includeDevelopmentPlans = options.include_development_plans ?? true;

    // Get role information
    const roleQuery = `
      SELECT
        jt.id,
        COALESCE(jt.title_en, jt.title_it) as title,
        jt.job_code,
        COALESCE(out.name_en, out.name_it) as department,
        (SELECT COUNT(*) FROM role_skill_requirements WHERE role_id = jt.id) as required_skills
      FROM job_templates jt
      LEFT JOIN org_unit_templates out ON out.id = jt.org_unit_template_id
      WHERE jt.id = $1
    `;

    const roleResult = await this.pool.query(roleQuery, [roleId]);

    if (roleResult.rows.length === 0) {
      throw new Error('Role not found');
    }

    const role = roleResult.rows[0];

    // Get role skill requirements
    const requirementsQuery = `
      SELECT
        rsr.skill_id,
        COALESCE(es.preferred_label_en, es.preferred_label_it, 'Unknown') as skill_name,
        rsr.min_composite_score as required_level,
        rsr.importance,
        rsr.weight
      FROM role_skill_requirements rsr
      LEFT JOIN esco_skills es ON es.id = rsr.skill_id
      WHERE rsr.role_id = $1
      ORDER BY rsr.importance DESC, rsr.weight DESC
    `;

    const requirementsResult = await this.pool.query(requirementsQuery, [roleId]);
    const requirements = requirementsResult.rows;

    if (requirements.length === 0) {
      return {
        role: {
          id: role.id,
          title: role.title,
          department: role.department,
          required_skills: 0,
        },
        risk_assessment: this.assessRoleRisk(role, []),
        candidates: [],
        summary: {
          total_candidates_evaluated: 0,
          qualified_candidates: 0,
          average_readiness_score: 0,
          average_skill_match: 0,
          coverage_ratio: 0,
        },
      };
    }

    // Find potential candidates
    const candidates = await this.findCandidates(
      tenantId,
      requirements,
      minSkillMatch,
      maxCandidates,
      options.org_unit_id
    );

    // Generate development plans if requested
    if (includeDevelopmentPlans) {
      for (const candidate of candidates) {
        candidate.development_plan = await this.generateDevelopmentPlan(
          tenantId,
          candidate.skill_gaps
        );
      }
    }

    // Calculate risk assessment
    const riskAssessment = this.assessRoleRisk(role, candidates);

    // Calculate summary
    const qualifiedCandidates = candidates.filter(
      (c) => c.skill_match_percentage >= minSkillMatch * 100
    );
    const avgReadiness =
      candidates.length > 0
        ? candidates.reduce((sum, c) => sum + c.readiness_score, 0) / candidates.length
        : 0;
    const avgSkillMatch =
      candidates.length > 0
        ? candidates.reduce((sum, c) => sum + c.skill_match_percentage, 0) / candidates.length
        : 0;

    return {
      role: {
        id: role.id,
        title: role.title,
        department: role.department,
        required_skills: requirements.length,
      },
      risk_assessment: riskAssessment,
      candidates,
      summary: {
        total_candidates_evaluated: candidates.length,
        qualified_candidates: qualifiedCandidates.length,
        average_readiness_score: Math.round(avgReadiness * 100) / 100,
        average_skill_match: Math.round(avgSkillMatch * 100) / 100,
        coverage_ratio: qualifiedCandidates.length > 0 ? 1 : 0,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Find Candidates Based on Skill Match
  // --------------------------------------------------------------------------

  private async findCandidates(
    tenantId: string,
    requirements: Array<{
      skill_id: string;
      skill_name: string;
      required_level: number;
      importance: string;
      weight: number;
    }>,
    minSkillMatch: number,
    maxCandidates: number,
    orgUnitId?: string
  ): Promise<SuccessionCandidate[]> {
    const skillIds = requirements.map((r) => r.skill_id).filter((id) => id);

    if (skillIds.length === 0) {
      return [];
    }

    // Find employees with matching skills
    let candidateQuery = `
      SELECT DISTINCT ON (e.id)
        e.id as employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.job_title as current_role,
        d.name as department,
        COUNT(DISTINCT esp.skill_id) FILTER (WHERE esp.skill_id = ANY($2::uuid[])) as matching_skills,
        AVG(esp.composite_score) FILTER (WHERE esp.skill_id = ANY($2::uuid[])) as avg_skill_level
      FROM employees e
      JOIN employee_skill_profiles esp ON esp.employee_id = e.id
      LEFT JOIN org_units d ON d.id = e.org_unit_id
      WHERE e.tenant_id = $1
        AND e.is_active = true
        AND esp.skill_id = ANY($2::uuid[])
    `;

    const params: (string | string[])[] = [tenantId, skillIds];
    let paramIndex = 3;

    if (orgUnitId) {
      candidateQuery += ` AND e.org_unit_id = $${paramIndex}`;
      params.push(orgUnitId);
      paramIndex++;
    }

    candidateQuery += `
      GROUP BY e.id, e.first_name, e.last_name, e.job_title, d.name
      HAVING COUNT(DISTINCT esp.skill_id) FILTER (WHERE esp.skill_id = ANY($2::uuid[])) > 0
      ORDER BY e.id, matching_skills DESC, avg_skill_level DESC
      LIMIT $${paramIndex}
    `;
    params.push(String(maxCandidates * 2)); // Get more to filter later

    const candidatesResult = await this.pool.query(candidateQuery, params);

    // Process each candidate
    const candidates: SuccessionCandidate[] = [];

    for (const row of candidatesResult.rows) {
      // Get detailed skill match for this candidate
      const skillMatchQuery = `
        SELECT
          esp.skill_id,
          COALESCE(es.preferred_label_en, 'Unknown') as skill_name,
          esp.composite_score as current_level
        FROM employee_skill_profiles esp
        LEFT JOIN esco_skills es ON es.id = esp.skill_id
        WHERE esp.employee_id = $1
        AND esp.skill_id = ANY($2::uuid[])
      `;

      const skillMatchResult = await this.pool.query(skillMatchQuery, [row.employee_id, skillIds]);
      const employeeSkills = new Map(
        skillMatchResult.rows.map((s) => [
          s.skill_id,
          { name: s.skill_name, level: parseFloat(s.current_level) || 0 },
        ])
      );

      // Calculate skill gaps and match
      const skillGaps: SkillGap[] = [];
      const strengths: string[] = [];
      let totalWeight = 0;
      let matchedWeight = 0;

      for (const req of requirements) {
        const empSkill = employeeSkills.get(req.skill_id);
        const currentLevel = empSkill?.level ?? 0;
        const requiredLevel = parseFloat(String(req.required_level)) || 3;
        const weight = parseFloat(String(req.weight)) || 1;

        totalWeight += weight;

        if (currentLevel >= requiredLevel) {
          matchedWeight += weight;
          if (currentLevel >= requiredLevel + 0.5) {
            strengths.push(req.skill_name);
          }
        } else {
          skillGaps.push({
            skill_id: req.skill_id,
            skill_name: req.skill_name,
            required_level: requiredLevel,
            current_level: currentLevel,
            gap: requiredLevel - currentLevel,
            importance: req.importance,
          });
        }
      }

      const skillMatchPercentage = totalWeight > 0 ? (matchedWeight / totalWeight) * 100 : 0;

      // Skip candidates below threshold
      if (skillMatchPercentage < minSkillMatch * 100) continue;

      // Calculate readiness score and level
      const readinessScore = this.calculateReadinessScore(skillMatchPercentage, skillGaps);
      const readinessLevel = this.determineReadinessLevel(readinessScore, skillGaps);
      const timeToReady = this.estimateTimeToReady(skillGaps);

      candidates.push({
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        current_role: row.current_role || 'Unknown',
        department: row.department || 'Unknown',
        readiness_score: readinessScore,
        readiness_level: readinessLevel,
        skill_match_percentage: Math.round(skillMatchPercentage * 10) / 10,
        matching_skills: parseInt(row.matching_skills),
        total_required_skills: requirements.length,
        skill_gaps: skillGaps.sort((a, b) => {
          const importanceOrder: Record<string, number> = {
            critical: 0,
            high: 1,
            medium: 2,
            low: 3,
          };
          return (importanceOrder[a.importance] || 2) - (importanceOrder[b.importance] || 2);
        }),
        development_plan: [],
        strengths: strengths.slice(0, 5),
        time_to_ready_months: timeToReady,
      });
    }

    // Sort by readiness score and limit
    return candidates.sort((a, b) => b.readiness_score - a.readiness_score).slice(0, maxCandidates);
  }

  // --------------------------------------------------------------------------
  // Calculate Readiness Score
  // --------------------------------------------------------------------------

  private calculateReadinessScore(skillMatchPercentage: number, skillGaps: SkillGap[]): number {
    // Base score from skill match
    let score = skillMatchPercentage * 0.7;

    // Penalty for critical/high importance gaps
    const criticalGaps = skillGaps.filter((g) => g.importance === 'critical').length;
    const highGaps = skillGaps.filter((g) => g.importance === 'high').length;

    score -= criticalGaps * 10;
    score -= highGaps * 5;

    // Penalty for large gaps
    const largeGaps = skillGaps.filter((g) => g.gap > 1.5).length;
    score -= largeGaps * 5;

    return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
  }

  // --------------------------------------------------------------------------
  // Determine Readiness Level
  // --------------------------------------------------------------------------

  private determineReadinessLevel(
    readinessScore: number,
    skillGaps: SkillGap[]
  ): 'ready_now' | 'ready_1_year' | 'ready_2_years' | 'needs_development' {
    const hasCriticalGaps = skillGaps.some((g) => g.importance === 'critical' && g.gap > 0.5);
    const totalGap = skillGaps.reduce((sum, g) => sum + g.gap, 0);

    if (readinessScore >= 85 && !hasCriticalGaps && totalGap < 2) {
      return 'ready_now';
    } else if (readinessScore >= 70 && totalGap < 5) {
      return 'ready_1_year';
    } else if (readinessScore >= 50) {
      return 'ready_2_years';
    } else {
      return 'needs_development';
    }
  }

  // --------------------------------------------------------------------------
  // Estimate Time to Ready
  // --------------------------------------------------------------------------

  private estimateTimeToReady(skillGaps: SkillGap[]): number {
    if (skillGaps.length === 0) return 0;

    // Estimate: 2 months per proficiency level gap for critical, 1.5 for high, 1 for medium
    let totalMonths = 0;

    for (const gap of skillGaps) {
      const multiplier = gap.importance === 'critical' ? 2 : gap.importance === 'high' ? 1.5 : 1;
      totalMonths += gap.gap * multiplier;
    }

    return Math.ceil(totalMonths);
  }

  // --------------------------------------------------------------------------
  // Generate Development Plan
  // --------------------------------------------------------------------------

  private async generateDevelopmentPlan(
    tenantId: string,
    skillGaps: SkillGap[]
  ): Promise<DevelopmentAction[]> {
    const plan: DevelopmentAction[] = [];

    for (const gap of skillGaps) {
      // Determine action type based on gap size
      let actionType: DevelopmentAction['action_type'];
      let description: string;
      let durationWeeks: number;

      if (gap.gap > 2) {
        actionType = 'training';
        description = `Complete formal training program to develop ${gap.skill_name} from level ${gap.current_level.toFixed(1)} to ${gap.required_level.toFixed(1)}`;
        durationWeeks = Math.ceil(gap.gap * 4);
      } else if (gap.gap > 1) {
        actionType = 'mentoring';
        description = `Work with senior mentor to develop ${gap.skill_name} through guided practice`;
        durationWeeks = Math.ceil(gap.gap * 6);
      } else {
        actionType = 'project';
        description = `Take on stretch assignments to practice ${gap.skill_name}`;
        durationWeeks = Math.ceil(gap.gap * 4);
      }

      const priority: 'high' | 'medium' | 'low' =
        gap.importance === 'critical' ? 'high' : gap.importance === 'high' ? 'medium' : 'low';

      // Find recommended courses
      const coursesQuery = `
        SELECT
          c.id as course_id,
          c.title as course_title,
          c.duration_hours
        FROM courses c
        JOIN course_esco_skills ces ON ces.course_id = c.id
        LEFT JOIN esco_skills es ON es.uri = ces.esco_skill_uri
        WHERE c.tenant_id = $1
        AND c.status = 'published'
        AND (
          es.id = $2
          OR LOWER(ces.skill_name) ILIKE '%' || LOWER($3) || '%'
        )
        ORDER BY ces.proficiency_level_gained DESC
        LIMIT 2
      `;

      const coursesResult = await this.pool.query(coursesQuery, [
        tenantId,
        gap.skill_id,
        gap.skill_name,
      ]);

      plan.push({
        action_type: actionType,
        skill_name: gap.skill_name,
        description,
        estimated_duration_weeks: durationWeeks,
        priority,
        recommended_courses: coursesResult.rows.map((c) => ({
          course_id: c.course_id,
          course_title: c.course_title,
          duration_hours: parseFloat(c.duration_hours) || 8,
        })),
      });
    }

    // Sort by priority
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return plan.sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));
  }

  // --------------------------------------------------------------------------
  // Assess Role Risk
  // --------------------------------------------------------------------------

  private assessRoleRisk(
    role: { id: string; title: string; department?: string },
    candidates: SuccessionCandidate[]
  ): RoleRiskAssessment {
    const readyNow = candidates.filter((c) => c.readiness_level === 'ready_now').length;
    const ready1Year = candidates.filter((c) => c.readiness_level === 'ready_1_year').length;
    const ready2Years = candidates.filter((c) => c.readiness_level === 'ready_2_years').length;

    // Calculate bench strength (0-100)
    const benchStrength = Math.min(100, readyNow * 40 + ready1Year * 25 + ready2Years * 10);

    // Determine succession readiness
    let successionReadiness: 'strong' | 'adequate' | 'weak' | 'none';
    if (readyNow >= 2) {
      successionReadiness = 'strong';
    } else if (readyNow >= 1 || ready1Year >= 2) {
      successionReadiness = 'adequate';
    } else if (ready1Year >= 1 || ready2Years >= 2) {
      successionReadiness = 'weak';
    } else {
      successionReadiness = 'none';
    }

    // Determine risk level
    const riskFactors: string[] = [];
    let riskLevel: 'critical' | 'high' | 'medium' | 'low';

    if (readyNow === 0 && ready1Year === 0) {
      riskLevel = 'critical';
      riskFactors.push('No candidates ready within 1 year');
    } else if (readyNow === 0) {
      riskLevel = 'high';
      riskFactors.push('No immediately ready candidates');
    } else if (readyNow === 1) {
      riskLevel = 'medium';
      riskFactors.push('Only one candidate ready now (single point of failure)');
    } else {
      riskLevel = 'low';
    }

    if (candidates.length < 3) {
      riskFactors.push('Limited succession pipeline depth');
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    // Generate recommended actions
    const recommendedActions: string[] = [];

    if (riskLevel === 'critical') {
      recommendedActions.push('Prioritize external recruitment for succession candidates');
      recommendedActions.push('Accelerate development programs for high-potential employees');
    }

    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendedActions.push('Implement knowledge transfer from current role holder');
      recommendedActions.push('Consider interim succession arrangements');
    }

    if (ready1Year > 0 || ready2Years > 0) {
      recommendedActions.push('Invest in targeted development to accelerate readiness');
    }

    if (candidates.length < 5) {
      recommendedActions.push('Expand succession candidate pool through talent identification');
    }

    return {
      role_id: role.id,
      role_name: role.title,
      risk_level: riskLevel,
      risk_factors: riskFactors,
      succession_readiness: successionReadiness,
      ready_now_candidates: readyNow,
      ready_1_year_candidates: ready1Year,
      ready_2_years_candidates: ready2Years,
      bench_strength: benchStrength,
      recommended_actions: recommendedActions,
    };
  }
}

export default SuccessionPlanningService;
