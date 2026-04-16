/**
 * Gap Analysis Service
 * Epic: E-ONTO-03 (Business Applications)
 * Story: S-ONTO-03-05 (Gap Analysis Engine)
 *
 * Analyzes skill gaps between:
 * - Employee skills vs Role requirements
 * - Team skills vs Project requirements
 */

import { pool } from '../../config/database.js';

// =============================================================================
// TYPES
// =============================================================================

export interface KsabaLevels {
  knowledge: number;
  skill: number;
  ability: number;
  behavior: number;
  attitude: number;
}

export interface SkillGap {
  skillId: string;
  skillName: string;
  skillType: string;
  skillGroup: string | null;
  current: KsabaLevels;
  required: KsabaLevels;
  gaps: KsabaLevels;
  currentComposite: number;
  requiredComposite: number;
  gapScore: number;  // Positive = gap, Negative = exceeds requirement
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  importance: string;
  weight: number;
  isPrimary: boolean;
}

export interface GapAnalysisResult {
  analysisId: string;
  analysisType: 'employee_role' | 'team_role' | 'team_project';
  timestamp: Date;

  // Target info
  targetType: 'employee' | 'team';
  targetId: string;
  targetName: string;

  // Requirement source info
  requirementType: 'role' | 'project';
  requirementId: string;
  requirementName: string;

  // Summary scores
  overallGapScore: number;  // 0-100, lower is better
  overallFitScore: number;  // 0-100, higher is better
  gapCount: number;
  skillsExceeding: number;
  skillsMeeting: number;
  skillsBelowMinor: number;
  skillsBelowMajor: number;
  skillsMissing: number;

  // Severity distribution
  severityDistribution: {
    none: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
  };

  // Detailed gaps
  gaps: SkillGap[];

  // Dimension-level aggregates
  ksabaGaps: KsabaLevels;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateKsabaGap(current: KsabaLevels, required: KsabaLevels): KsabaLevels {
  return {
    knowledge: (required.knowledge ?? 0) - (current.knowledge ?? 0),
    skill: (required.skill ?? 0) - (current.skill ?? 0),
    ability: (required.ability ?? 0) - (current.ability ?? 0),
    behavior: (required.behavior ?? 0) - (current.behavior ?? 0),
    attitude: (required.attitude ?? 0) - (current.attitude ?? 0),
  };
}

function calculateGapSeverity(gapScore: number, importance: string): 'none' | 'low' | 'medium' | 'high' | 'critical' {
  // Negative gap = employee exceeds requirement
  if (gapScore <= 0) return 'none';

  // Adjust thresholds based on importance
  const importanceMultiplier =
    importance === 'essential' ? 1.5 :
    importance === 'important' ? 1.0 :
    importance === 'nice_to_have' ? 0.5 :
    0.25;  // developmental

  const adjustedGap = gapScore * importanceMultiplier;

  if (adjustedGap < 0.5) return 'low';
  if (adjustedGap < 1.0) return 'medium';
  if (adjustedGap < 2.0) return 'high';
  return 'critical';
}

function generateAnalysisId(): string {
  return `GA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// =============================================================================
// EMPLOYEE VS ROLE ANALYSIS
// =============================================================================

export async function analyzeEmployeeVsRole(
  employeeId: string,
  roleId: string,
  tenantId?: string
): Promise<GapAnalysisResult> {
  const analysisId = generateAnalysisId();
  const timestamp = new Date();

  // Get employee info
  const employeeResult = await pool.query(`
    SELECT id, first_name, last_name, tenant_id
    FROM employees WHERE id = $1
  `, [employeeId]);

  if (employeeResult.rows.length === 0) {
    throw new Error('Employee not found');
  }

  const employee = employeeResult.rows[0];
  const effectiveTenantId = tenantId || employee.tenant_id;

  // Get role info
  const roleResult = await pool.query(`
    SELECT id, title_en, job_code FROM job_templates WHERE id = $1
  `, [roleId]);

  if (roleResult.rows.length === 0) {
    throw new Error('Role not found');
  }

  const role = roleResult.rows[0];

  // Get role requirements
  const requirementsResult = await pool.query(`
    SELECT
      rsr.skill_id,
      rsr.required_knowledge_level,
      rsr.required_skill_level,
      rsr.required_ability_level,
      rsr.required_behavior_level,
      rsr.required_attitude_level,
      rsr.min_composite_score,
      rsr.importance,
      rsr.weight,
      rsr.is_primary,
      es.preferred_label_en as skill_name,
      es.skill_type,
      esg.preferred_label_en as skill_group
    FROM role_skill_requirements rsr
    JOIN esco_skills es ON rsr.skill_id = es.id
    LEFT JOIN esco_skill_groups esg ON es.skill_group_uri = esg.uri
    WHERE rsr.role_id = $1
      AND (rsr.tenant_id = $2 OR rsr.tenant_id IS NULL)
    ORDER BY rsr.importance, rsr.weight DESC
  `, [roleId, effectiveTenantId]);

  // Get employee skills
  const skillsResult = await pool.query(`
    SELECT
      esp.skill_id,
      esp.knowledge_level,
      esp.skill_level,
      esp.ability_level,
      esp.behavior_level,
      esp.attitude_level,
      esp.composite_score
    FROM employee_skill_profiles esp
    WHERE esp.employee_id = $1
  `, [employeeId]);

  // Create skill lookup map
  const employeeSkills = new Map<string, {
    ksaba: KsabaLevels;
    composite: number;
  }>();

  for (const skill of skillsResult.rows) {
    employeeSkills.set(skill.skill_id, {
      ksaba: {
        knowledge: skill.knowledge_level ?? 0,
        skill: skill.skill_level ?? 0,
        ability: skill.ability_level ?? 0,
        behavior: skill.behavior_level ?? 0,
        attitude: skill.attitude_level ?? 0,
      },
      composite: parseFloat(skill.composite_score) || 0,
    });
  }

  // Calculate gaps for each requirement
  const gaps: SkillGap[] = [];
  const severityDistribution = { none: 0, low: 0, medium: 0, high: 0, critical: 0 };
  let skillsExceeding = 0;
  let skillsMeeting = 0;
  let skillsBelowMinor = 0;
  let skillsBelowMajor = 0;
  let skillsMissing = 0;

  const ksabaGapsTotals: KsabaLevels = {
    knowledge: 0, skill: 0, ability: 0, behavior: 0, attitude: 0,
  };

  let totalWeightedGap = 0;
  let totalWeight = 0;

  for (const req of requirementsResult.rows) {
    const current = employeeSkills.get(req.skill_id) || {
      ksaba: { knowledge: 0, skill: 0, ability: 0, behavior: 0, attitude: 0 },
      composite: 0,
    };

    const required: KsabaLevels = {
      knowledge: req.required_knowledge_level ?? 0,
      skill: req.required_skill_level ?? 0,
      ability: req.required_ability_level ?? 0,
      behavior: req.required_behavior_level ?? 0,
      attitude: req.required_attitude_level ?? 0,
    };

    const requiredComposite = parseFloat(req.min_composite_score) || 0;
    const ksabaGaps = calculateKsabaGap(current.ksaba, required);
    const gapScore = requiredComposite - current.composite;
    const severity = calculateGapSeverity(gapScore, req.importance);
    const weight = parseFloat(req.weight) || 1.0;

    // Categorize
    if (!employeeSkills.has(req.skill_id)) {
      skillsMissing++;
    } else if (gapScore <= -0.5) {
      skillsExceeding++;
    } else if (gapScore <= 0) {
      skillsMeeting++;
    } else if (gapScore < 1.0) {
      skillsBelowMinor++;
    } else {
      skillsBelowMajor++;
    }

    severityDistribution[severity]++;

    // Accumulate weighted gap
    totalWeightedGap += Math.max(0, gapScore) * weight;
    totalWeight += weight;

    // Accumulate KSABA totals
    ksabaGapsTotals.knowledge += Math.max(0, ksabaGaps.knowledge) * weight;
    ksabaGapsTotals.skill += Math.max(0, ksabaGaps.skill) * weight;
    ksabaGapsTotals.ability += Math.max(0, ksabaGaps.ability) * weight;
    ksabaGapsTotals.behavior += Math.max(0, ksabaGaps.behavior) * weight;
    ksabaGapsTotals.attitude += Math.max(0, ksabaGaps.attitude) * weight;

    gaps.push({
      skillId: req.skill_id,
      skillName: req.skill_name,
      skillType: req.skill_type,
      skillGroup: req.skill_group,
      current: current.ksaba,
      required,
      gaps: ksabaGaps,
      currentComposite: current.composite,
      requiredComposite,
      gapScore: Math.round(gapScore * 100) / 100,
      severity,
      importance: req.importance,
      weight,
      isPrimary: req.is_primary,
    });
  }

  // Calculate overall scores
  const avgGap = totalWeight > 0 ? totalWeightedGap / totalWeight : 0;
  const overallGapScore = Math.min(100, Math.round(avgGap * 20));  // Scale 0-5 gap to 0-100
  const overallFitScore = Math.max(0, 100 - overallGapScore);

  // Normalize KSABA gaps
  if (totalWeight > 0) {
    ksabaGapsTotals.knowledge = Math.round((ksabaGapsTotals.knowledge / totalWeight) * 100) / 100;
    ksabaGapsTotals.skill = Math.round((ksabaGapsTotals.skill / totalWeight) * 100) / 100;
    ksabaGapsTotals.ability = Math.round((ksabaGapsTotals.ability / totalWeight) * 100) / 100;
    ksabaGapsTotals.behavior = Math.round((ksabaGapsTotals.behavior / totalWeight) * 100) / 100;
    ksabaGapsTotals.attitude = Math.round((ksabaGapsTotals.attitude / totalWeight) * 100) / 100;
  }

  // Sort gaps by severity and importance
  gaps.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
    const importanceOrder: Record<string, number> = { essential: 0, important: 1, nice_to_have: 2, developmental: 3 };

    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }

    const aImportance = importanceOrder[a.importance] ?? 4;
    const bImportance = importanceOrder[b.importance] ?? 4;
    return aImportance - bImportance;
  });

  return {
    analysisId,
    analysisType: 'employee_role',
    timestamp,
    targetType: 'employee',
    targetId: employeeId,
    targetName: `${employee.first_name} ${employee.last_name}`,
    requirementType: 'role',
    requirementId: roleId,
    requirementName: role.title_en,
    overallGapScore,
    overallFitScore,
    gapCount: gaps.filter(g => g.gapScore > 0).length,
    skillsExceeding,
    skillsMeeting,
    skillsBelowMinor,
    skillsBelowMajor,
    skillsMissing,
    severityDistribution,
    gaps,
    ksabaGaps: ksabaGapsTotals,
  };
}

// =============================================================================
// TEAM VS ROLE ANALYSIS
// =============================================================================

export async function analyzeTeamVsRole(
  employeeIds: string[],
  roleId: string,
  aggregation: 'average' | 'best' | 'coverage' = 'average',
  tenantId?: string
): Promise<GapAnalysisResult> {
  // Run individual analyses
  const individualResults = await Promise.all(
    employeeIds.map(empId => analyzeEmployeeVsRole(empId, roleId, tenantId))
  );

  if (individualResults.length === 0) {
    throw new Error('No employees provided for team analysis');
  }

  const analysisId = generateAnalysisId();
  const timestamp = new Date();
  const firstResult = individualResults[0];

  // TypeScript guard - firstResult is guaranteed to exist after length check
  if (!firstResult) {
    throw new Error('No results from team analysis');
  }

  // Aggregate based on strategy
  if (aggregation === 'best') {
    // For each skill, take the best (lowest gap) from any team member
    const skillBestGaps = new Map<string, SkillGap>();

    for (const result of individualResults) {
      for (const gap of result.gaps) {
        const existing = skillBestGaps.get(gap.skillId);
        if (!existing || gap.gapScore < existing.gapScore) {
          skillBestGaps.set(gap.skillId, gap);
        }
      }
    }

    const gaps = Array.from(skillBestGaps.values());
    const severityDistribution = { none: 0, low: 0, medium: 0, high: 0, critical: 0 };
    gaps.forEach(g => severityDistribution[g.severity]++);

    const avgGapScore = gaps.length > 0
      ? gaps.reduce((sum, g) => sum + Math.max(0, g.gapScore), 0) / gaps.length
      : 0;

    return {
      analysisId,
      analysisType: 'team_role',
      timestamp,
      targetType: 'team',
      targetId: employeeIds.join(','),
      targetName: `Team of ${employeeIds.length}`,
      requirementType: 'role',
      requirementId: roleId,
      requirementName: firstResult.requirementName,
      overallGapScore: Math.min(100, Math.round(avgGapScore * 20)),
      overallFitScore: Math.max(0, 100 - Math.round(avgGapScore * 20)),
      gapCount: gaps.filter(g => g.gapScore > 0).length,
      skillsExceeding: gaps.filter(g => g.gapScore <= -0.5).length,
      skillsMeeting: gaps.filter(g => g.gapScore > -0.5 && g.gapScore <= 0).length,
      skillsBelowMinor: gaps.filter(g => g.gapScore > 0 && g.gapScore < 1).length,
      skillsBelowMajor: gaps.filter(g => g.gapScore >= 1).length,
      skillsMissing: 0,
      severityDistribution,
      gaps,
      ksabaGaps: {
        knowledge: gaps.reduce((s, g) => s + Math.max(0, g.gaps.knowledge), 0) / gaps.length,
        skill: gaps.reduce((s, g) => s + Math.max(0, g.gaps.skill), 0) / gaps.length,
        ability: gaps.reduce((s, g) => s + Math.max(0, g.gaps.ability), 0) / gaps.length,
        behavior: gaps.reduce((s, g) => s + Math.max(0, g.gaps.behavior), 0) / gaps.length,
        attitude: gaps.reduce((s, g) => s + Math.max(0, g.gaps.attitude), 0) / gaps.length,
      },
    };
  }

  // Default: average aggregation
  const avgGapScore = individualResults.reduce((sum, r) => sum + r.overallGapScore, 0) / individualResults.length;

  return {
    analysisId,
    analysisType: 'team_role',
    timestamp,
    targetType: 'team',
    targetId: employeeIds.join(','),
    targetName: `Team of ${employeeIds.length}`,
    requirementType: 'role',
    requirementId: roleId,
    requirementName: firstResult.requirementName,
    overallGapScore: Math.round(avgGapScore),
    overallFitScore: Math.max(0, 100 - Math.round(avgGapScore)),
    gapCount: Math.round(individualResults.reduce((s, r) => s + r.gapCount, 0) / individualResults.length),
    skillsExceeding: Math.round(individualResults.reduce((s, r) => s + r.skillsExceeding, 0) / individualResults.length),
    skillsMeeting: Math.round(individualResults.reduce((s, r) => s + r.skillsMeeting, 0) / individualResults.length),
    skillsBelowMinor: Math.round(individualResults.reduce((s, r) => s + r.skillsBelowMinor, 0) / individualResults.length),
    skillsBelowMajor: Math.round(individualResults.reduce((s, r) => s + r.skillsBelowMajor, 0) / individualResults.length),
    skillsMissing: Math.round(individualResults.reduce((s, r) => s + r.skillsMissing, 0) / individualResults.length),
    severityDistribution: {
      none: Math.round(individualResults.reduce((s, r) => s + r.severityDistribution.none, 0) / individualResults.length),
      low: Math.round(individualResults.reduce((s, r) => s + r.severityDistribution.low, 0) / individualResults.length),
      medium: Math.round(individualResults.reduce((s, r) => s + r.severityDistribution.medium, 0) / individualResults.length),
      high: Math.round(individualResults.reduce((s, r) => s + r.severityDistribution.high, 0) / individualResults.length),
      critical: Math.round(individualResults.reduce((s, r) => s + r.severityDistribution.critical, 0) / individualResults.length),
    },
    gaps: firstResult.gaps,  // Use first employee's gap structure as template
    ksabaGaps: {
      knowledge: individualResults.reduce((s, r) => s + r.ksabaGaps.knowledge, 0) / individualResults.length,
      skill: individualResults.reduce((s, r) => s + r.ksabaGaps.skill, 0) / individualResults.length,
      ability: individualResults.reduce((s, r) => s + r.ksabaGaps.ability, 0) / individualResults.length,
      behavior: individualResults.reduce((s, r) => s + r.ksabaGaps.behavior, 0) / individualResults.length,
      attitude: individualResults.reduce((s, r) => s + r.ksabaGaps.attitude, 0) / individualResults.length,
    },
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export const gapAnalysisService = {
  analyzeEmployeeVsRole,
  analyzeTeamVsRole,
};
