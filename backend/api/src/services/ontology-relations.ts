/**
 * Ontology Relations Service
 * Advanced ontological analysis: skill clustering, career pathways, process-skill impact.
 * Uses ESCO knowledge graph (esco_skills, esco_occupations, esco_occupation_skills, process_skill_requirements).
 *
 * Horizon O3.7
 */

import { Pool, PoolClient } from 'pg';

// =============================================================================
// TYPES
// =============================================================================

export interface SkillCluster {
  clusterId: string;
  label: string;
  broaderUri: string;
  memberCount: number;
  topSkills: Array<{ id: string; label: string; skillType: string }>;
  relatedOccupationCount: number;
}

export interface SkillClustersResult {
  clusters: SkillCluster[];
  total: number;
}

export interface CareerStepSkill {
  id: string;
  label: string;
  skillType: string;
}

export interface CareerStep {
  occupationId: string;
  occupationLabel: string;
  iscoCode: string | null;
  skillOverlap: number;
  skillsGained: CareerStepSkill[];
  skillsLost: CareerStepSkill[];
}

export interface CareerPathwayResult {
  source: { id: string; label: string; iscoCode: string | null };
  steps: CareerStep[];
}

export interface SkillImpactEntry {
  skillId: string;
  skillLabel: string;
  skillType: string;
  processCount: number;
  processNames: string[];
  isCritical: boolean;
  isUnique: boolean;
}

export interface ProcessSkillImpactResult {
  totalSkills: number;
  criticalSkills: SkillImpactEntry[];
  uniqueSkills: SkillImpactEntry[];
}

// =============================================================================
// SERVICE
// =============================================================================

export class OntologyRelationsService {
  constructor(private readonly db: Pool | PoolClient) {}

  /**
   * Cluster ESCO skills by broader_uri hierarchy.
   * Each cluster groups skills sharing the same parent concept.
   * Supports optional filtering by skill_type (skill/knowledge/competence).
   */
  async getSkillClusters(options: {
    limit: number;
    offset: number;
    skillType?: string;
  }): Promise<SkillClustersResult> {
    const { limit, offset, skillType } = options;

    // Count total distinct broader_uri groups
    const countRes = await this.db.query(
      `SELECT COUNT(DISTINCT broader_uri)::int AS total
       FROM esco_skills
       WHERE broader_uri IS NOT NULL
         AND ($1::text IS NULL OR skill_type = $1)`,
      [skillType ?? null]
    );
    const total: number = countRes.rows[0].total;

    // Build clusters using window function for top-5 skills per group
    const res = await this.db.query(
      `WITH ranked AS (
         SELECT
           s.broader_uri,
           s.id,
           COALESCE(s.preferred_label_en, s.preferred_label) AS skill_label,
           s.skill_type,
           ROW_NUMBER() OVER (
             PARTITION BY s.broader_uri
             ORDER BY COALESCE(s.preferred_label_en, s.preferred_label)
           ) AS rn,
           COUNT(*) OVER (PARTITION BY s.broader_uri) AS member_count
         FROM esco_skills s
         WHERE s.broader_uri IS NOT NULL
           AND ($1::text IS NULL OR s.skill_type = $1)
       ),
       page_uris AS (
         SELECT DISTINCT broader_uri, member_count
         FROM ranked
         ORDER BY member_count DESC
         LIMIT $2 OFFSET $3
       ),
       aggregated AS (
         SELECT
           r.broader_uri,
           r.member_count,
           json_agg(
             json_build_object('id', r.id, 'label', r.skill_label, 'skillType', r.skill_type)
             ORDER BY r.skill_label
           ) FILTER (WHERE r.rn <= 5) AS top_skills
         FROM ranked r
         JOIN page_uris pu ON pu.broader_uri = r.broader_uri
         GROUP BY r.broader_uri, r.member_count
       ),
       occ_counts AS (
         SELECT s.broader_uri, COUNT(DISTINCT os.occupation_id)::int AS related_occupation_count
         FROM esco_skills s
         JOIN esco_occupation_skills os ON os.skill_id = s.id
         WHERE s.broader_uri IS NOT NULL
           AND ($1::text IS NULL OR s.skill_type = $1)
         GROUP BY s.broader_uri
       )
       SELECT
         a.broader_uri,
         COALESCE(parent.preferred_label_en, parent.preferred_label, 'Skill Group (' || a.member_count::text || ' skills)') AS label,
         a.member_count,
         COALESCE(oc.related_occupation_count, 0) AS related_occupation_count,
         a.top_skills
       FROM aggregated a
       LEFT JOIN esco_skills parent ON parent.uri = a.broader_uri
       LEFT JOIN occ_counts oc ON oc.broader_uri = a.broader_uri
       ORDER BY a.member_count DESC`,
      [skillType ?? null, limit, offset]
    );

    const clusters: SkillCluster[] = res.rows.map((row, idx) => ({
      clusterId: `cluster-${offset + idx}`,
      label: row.label,
      broaderUri: row.broader_uri,
      memberCount: parseInt(row.member_count, 10),
      topSkills: (row.top_skills ?? []).slice(0, 5),
      relatedOccupationCount: row.related_occupation_count,
    }));

    return { clusters, total };
  }

  /**
   * Infer career pathways from a source occupation.
   * Finds neighboring occupations sharing >= 60% of skills, then extends one hop further.
   * Returns up to 5 direct neighbors with skill delta (gained/lost).
   */
  async getCareerPathways(occupationId: string): Promise<CareerPathwayResult> {
    const sourceRes = await this.db.query(
      `SELECT id, COALESCE(preferred_label_en, preferred_label) AS label, isco_code
       FROM esco_occupations WHERE id = $1`,
      [occupationId]
    );
    if (sourceRes.rows.length === 0) {
      return { source: { id: occupationId, label: 'Unknown', iscoCode: null }, steps: [] };
    }
    const src = sourceRes.rows[0];

    // Source skill set
    const srcSkillsRes = await this.db.query(
      `SELECT os.skill_id AS id,
              COALESCE(es.preferred_label_en, es.preferred_label) AS label,
              es.skill_type
       FROM esco_occupation_skills os
       JOIN esco_skills es ON es.id = os.skill_id
       WHERE os.occupation_id = $1`,
      [occupationId]
    );

    if (srcSkillsRes.rows.length === 0) {
      return {
        source: { id: src.id, label: src.label, iscoCode: src.isco_code },
        steps: [],
      };
    }

    const srcSkillIds: string[] = srcSkillsRes.rows.map((r: { id: string }) => r.id);
    const srcSkillMap = new Map<string, { label: string; skillType: string }>(
      srcSkillsRes.rows.map((r: { id: string; label: string; skill_type: string }) => [
        r.id,
        { label: r.label, skillType: r.skill_type },
      ])
    );

    // Find occupations with >=60% skill overlap
    const OVERLAP_THRESHOLD = 0.6;
    const neighborsRes = await this.db.query(
      `SELECT
         o.id,
         COALESCE(o.preferred_label_en, o.preferred_label) AS label,
         o.isco_code,
         COUNT(os.skill_id)::float / $2 AS overlap_ratio
       FROM esco_occupations o
       JOIN esco_occupation_skills os ON os.occupation_id = o.id
       WHERE os.skill_id = ANY($1)
         AND o.id != $3
       GROUP BY o.id, o.preferred_label_en, o.preferred_label, o.isco_code
       HAVING COUNT(os.skill_id)::float / $2 >= $4
       ORDER BY overlap_ratio DESC
       LIMIT 5`,
      [srcSkillIds, srcSkillIds.length, occupationId, OVERLAP_THRESHOLD]
    );

    const steps: CareerStep[] = [];

    for (const neighbor of neighborsRes.rows) {
      const neighborSkillsRes = await this.db.query(
        `SELECT os.skill_id AS id,
                COALESCE(es.preferred_label_en, es.preferred_label) AS label,
                es.skill_type
         FROM esco_occupation_skills os
         JOIN esco_skills es ON es.id = os.skill_id
         WHERE os.occupation_id = $1`,
        [neighbor.id]
      );

      const neighborSkillIds = new Set<string>(
        neighborSkillsRes.rows.map((r: { id: string }) => r.id)
      );
      const neighborSkillMap = new Map<string, { label: string; skillType: string }>(
        neighborSkillsRes.rows.map((r: { id: string; label: string; skill_type: string }) => [
          r.id,
          { label: r.label, skillType: r.skill_type },
        ])
      );

      const skillsGained: CareerStepSkill[] = [];
      for (const [id, info] of neighborSkillMap) {
        if (!srcSkillMap.has(id)) {
          skillsGained.push({ id, ...info });
          if (skillsGained.length >= 5) break;
        }
      }

      const skillsLost: CareerStepSkill[] = [];
      for (const [id, info] of srcSkillMap) {
        if (!neighborSkillIds.has(id)) {
          skillsLost.push({ id, ...info });
          if (skillsLost.length >= 5) break;
        }
      }

      steps.push({
        occupationId: neighbor.id,
        occupationLabel: neighbor.label,
        iscoCode: neighbor.isco_code ?? null,
        skillOverlap: parseFloat(neighbor.overlap_ratio),
        skillsGained,
        skillsLost,
      });
    }

    return {
      source: { id: src.id, label: src.label, iscoCode: src.isco_code ?? null },
      steps,
    };
  }

  /**
   * Compute process-skill impact matrix.
   * Returns which ESCO skills appear across business processes,
   * marking critical (>2 processes) and unique (exactly 1 process) skills.
   */
  async getProcessSkillImpact(): Promise<ProcessSkillImpactResult> {
    const res = await this.db.query(
      `SELECT
         es.id AS skill_id,
         COALESCE(es.preferred_label_en, es.preferred_label) AS skill_label,
         es.skill_type,
         COUNT(DISTINCT psr.process_id)::int AS process_count,
         array_agg(DISTINCT bp.process_name ORDER BY bp.process_name) AS process_names
       FROM process_skill_requirements psr
       JOIN business_processes bp ON bp.id = psr.process_id
       JOIN esco_skills es ON es.id = psr.esco_skill_id
       GROUP BY es.id, es.preferred_label_en, es.preferred_label, es.skill_type
       ORDER BY process_count DESC, skill_label`
    );

    const allSkills: SkillImpactEntry[] = res.rows.map(
      (row: {
        skill_id: string;
        skill_label: string;
        skill_type: string;
        process_count: number;
        process_names: string[];
      }) => ({
        skillId: row.skill_id,
        skillLabel: row.skill_label,
        skillType: row.skill_type,
        processCount: row.process_count,
        processNames: row.process_names,
        isCritical: row.process_count > 2,
        isUnique: row.process_count === 1,
      })
    );

    return {
      totalSkills: allSkills.length,
      criticalSkills: allSkills.filter((s) => s.isCritical),
      uniqueSkills: allSkills.filter((s) => s.isUnique),
    };
  }
}
