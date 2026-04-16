/**
 * Skill Classification Service
 * Manages enhanced skill taxonomy: Hard/Soft classification, Cognitive Levels,
 * Social Dimensions, Transferability, and Skill Clusters
 */

import { pool } from '../config/database.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type PrimaryCategory = 'hard' | 'soft' | 'hybrid';
export type CognitiveLevel = 1 | 2 | 3 | 4;
export type SocialDimension = 'intrapersonal' | 'interpersonal' | 'task_oriented';
export type Transferability = 'specialized' | 'adjacent' | 'transferable';
export type ClassificationSource = 'esco_derived' | 'rule_based' | 'ai_assisted' | 'manual';

export interface SkillCluster {
  id: string;
  code: string;
  name_en: string;
  name_it?: string;
  description?: string;
  parent_cluster_id?: string;
  cluster_level: number;
  career_path_codes?: string[];
  industry_codes?: string[];
  is_active: boolean;
  skill_count?: number;
}

export interface SkillClassification {
  id: string;
  esco_skill_id: string;
  primary_category: PrimaryCategory;
  primary_category_confidence?: number | undefined;
  cognitive_level?: CognitiveLevel | undefined;
  cognitive_level_label?: string | undefined;
  social_dimension?: SocialDimension | undefined;
  transferability: Transferability;
  transferability_score?: number | undefined;
  skill_cluster_id?: string | undefined;
  skill_cluster?: SkillCluster | undefined;
  classification_source: ClassificationSource;
  needs_review: boolean;
  classified_by?: string | undefined;
  classified_at?: string | undefined;
}

export interface ClassifiedSkill {
  id: string;
  uri: string;
  preferred_label: string;
  description?: string | undefined;
  esco_skill_type?: string | undefined;
  reuse_level?: string | undefined;
  is_digital: boolean;
  is_green: boolean;
  classification?: SkillClassification | undefined;
}

export interface ClassificationStats {
  total_skills: number;
  classified_skills: number;
  unclassified_skills: number;
  classification_percentage: number;
  hard_skills: number;
  soft_skills: number;
  hybrid_skills: number;
  cognitive_level_1: number;
  cognitive_level_2: number;
  cognitive_level_3: number;
  cognitive_level_4: number;
  intrapersonal: number;
  interpersonal: number;
  task_oriented: number;
  specialized: number;
  adjacent: number;
  transferable: number;
  needs_review: number;
}

export interface ClusterSuggestion {
  cluster: SkillCluster;
  confidence: number;
  reason: string;
}

export interface AIClassificationSuggestion {
  primary_category: PrimaryCategory;
  cognitive_level: CognitiveLevel;
  social_dimension: SocialDimension;
  transferability: Transferability;
  suggested_cluster_id?: string;
  confidence: number;
  reasoning: string;
}

// =============================================================================
// SKILL CLASSIFICATION SERVICE
// =============================================================================

export class SkillClassificationService {
  constructor(private _tenantId: string) {}

  // Getter in case needed in future
  get tenantId(): string { return this._tenantId; }

  // ===========================================================================
  // CLASSIFICATION METHODS
  // ===========================================================================

  /**
   * Get classification for a specific ESCO skill
   */
  async getClassification(escoSkillId: string): Promise<SkillClassification | null> {
    const result = await pool.query(`
      SELECT
        sc.*,
        skc.code as cluster_code,
        skc.name_en as cluster_name,
        skc.name_it as cluster_name_it,
        skc.cluster_level
      FROM skill_classifications sc
      LEFT JOIN skill_clusters skc ON sc.skill_cluster_id = skc.id
      WHERE sc.esco_skill_id = $1
    `, [escoSkillId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      esco_skill_id: row.esco_skill_id,
      primary_category: row.primary_category,
      primary_category_confidence: row.primary_category_confidence ? parseFloat(row.primary_category_confidence) : undefined,
      cognitive_level: row.cognitive_level,
      cognitive_level_label: row.cognitive_level_label,
      social_dimension: row.social_dimension,
      transferability: row.transferability,
      transferability_score: row.transferability_score ? parseFloat(row.transferability_score) : undefined,
      skill_cluster_id: row.skill_cluster_id,
      skill_cluster: row.skill_cluster_id ? {
        id: row.skill_cluster_id,
        code: row.cluster_code,
        name_en: row.cluster_name,
        name_it: row.cluster_name_it,
        cluster_level: row.cluster_level,
        is_active: true
      } : undefined,
      classification_source: row.classification_source,
      needs_review: row.needs_review,
      classified_by: row.classified_by,
      classified_at: row.classified_at
    };
  }

  /**
   * Get all classifications with optional filters
   */
  async getAllClassifications(filters?: {
    primary_category?: PrimaryCategory;
    cognitive_level?: CognitiveLevel;
    social_dimension?: SocialDimension;
    transferability?: Transferability;
    cluster_id?: string;
    needs_review?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: SkillClassification[]; total: number }> {
    const conditions: string[] = [];
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (filters?.primary_category) {
      conditions.push(`sc.primary_category = $${paramIndex++}`);
      params.push(filters.primary_category);
    }
    if (filters?.cognitive_level) {
      conditions.push(`sc.cognitive_level = $${paramIndex++}`);
      params.push(filters.cognitive_level);
    }
    if (filters?.social_dimension) {
      conditions.push(`sc.social_dimension = $${paramIndex++}`);
      params.push(filters.social_dimension);
    }
    if (filters?.transferability) {
      conditions.push(`sc.transferability = $${paramIndex++}`);
      params.push(filters.transferability);
    }
    if (filters?.cluster_id) {
      conditions.push(`sc.skill_cluster_id = $${paramIndex++}`);
      params.push(filters.cluster_id);
    }
    if (filters?.needs_review !== undefined) {
      conditions.push(`sc.needs_review = $${paramIndex++}`);
      params.push(filters.needs_review);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM skill_classifications sc ${whereClause}
    `, params);

    const dataResult = await pool.query(`
      SELECT
        sc.*,
        es.preferred_label,
        es.uri,
        skc.code as cluster_code,
        skc.name_en as cluster_name
      FROM skill_classifications sc
      INNER JOIN esco_skills es ON sc.esco_skill_id = es.id
      LEFT JOIN skill_clusters skc ON sc.skill_cluster_id = skc.id
      ${whereClause}
      ORDER BY es.preferred_label
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, limit, offset]);

    return {
      data: dataResult.rows.map(row => ({
        id: row.id,
        esco_skill_id: row.esco_skill_id,
        primary_category: row.primary_category,
        primary_category_confidence: row.primary_category_confidence ? parseFloat(row.primary_category_confidence) : undefined,
        cognitive_level: row.cognitive_level,
        cognitive_level_label: row.cognitive_level_label,
        social_dimension: row.social_dimension,
        transferability: row.transferability,
        transferability_score: row.transferability_score ? parseFloat(row.transferability_score) : undefined,
        skill_cluster_id: row.skill_cluster_id,
        skill_cluster: row.skill_cluster_id ? {
          id: row.skill_cluster_id,
          code: row.cluster_code,
          name_en: row.cluster_name,
          cluster_level: 0,
          is_active: true
        } : undefined,
        classification_source: row.classification_source,
        needs_review: row.needs_review
      })),
      total: parseInt(countResult.rows[0].total)
    };
  }

  /**
   * Create or update classification for a skill
   */
  async upsertClassification(
    escoSkillId: string,
    classification: Partial<SkillClassification>,
    classifiedBy?: string
  ): Promise<SkillClassification> {
    const result = await pool.query(`
      INSERT INTO skill_classifications (
        esco_skill_id, primary_category, primary_category_confidence,
        cognitive_level, social_dimension, transferability, transferability_score,
        skill_cluster_id, classification_source, needs_review,
        classified_by, classified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (esco_skill_id) DO UPDATE SET
        primary_category = COALESCE($2, skill_classifications.primary_category),
        primary_category_confidence = COALESCE($3, skill_classifications.primary_category_confidence),
        cognitive_level = COALESCE($4, skill_classifications.cognitive_level),
        social_dimension = COALESCE($5, skill_classifications.social_dimension),
        transferability = COALESCE($6, skill_classifications.transferability),
        transferability_score = COALESCE($7, skill_classifications.transferability_score),
        skill_cluster_id = COALESCE($8, skill_classifications.skill_cluster_id),
        classification_source = COALESCE($9, skill_classifications.classification_source),
        needs_review = COALESCE($10, skill_classifications.needs_review),
        classified_by = COALESCE($11, skill_classifications.classified_by),
        classified_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `, [
      escoSkillId,
      classification.primary_category,
      classification.primary_category_confidence,
      classification.cognitive_level,
      classification.social_dimension,
      classification.transferability,
      classification.transferability_score,
      classification.skill_cluster_id,
      classification.classification_source || 'manual',
      classification.needs_review ?? false,
      classifiedBy
    ]);

    return result.rows[0];
  }

  /**
   * Validate a classification (mark as reviewed)
   */
  async validateClassification(
    classificationId: string,
    validatedBy: string,
    updates?: Partial<SkillClassification>
  ): Promise<SkillClassification> {
    const result = await pool.query(`
      UPDATE skill_classifications SET
        primary_category = COALESCE($3, primary_category),
        cognitive_level = COALESCE($4, cognitive_level),
        social_dimension = COALESCE($5, social_dimension),
        transferability = COALESCE($6, transferability),
        skill_cluster_id = COALESCE($7, skill_cluster_id),
        needs_review = false,
        classified_by = $2,
        classified_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      classificationId,
      validatedBy,
      updates?.primary_category,
      updates?.cognitive_level,
      updates?.social_dimension,
      updates?.transferability,
      updates?.skill_cluster_id
    ]);

    return result.rows[0];
  }

  // ===========================================================================
  // CLUSTER METHODS
  // ===========================================================================

  /**
   * Get all skill clusters
   */
  async getClusters(options?: {
    level?: number;
    parent_id?: string;
    include_skill_count?: boolean;
  }): Promise<SkillCluster[]> {
    let query: string;

    if (options?.include_skill_count) {
      query = `
        SELECT
          skc.*,
          COUNT(sc.id) as skill_count
        FROM skill_clusters skc
        LEFT JOIN skill_classifications sc ON skc.id = sc.skill_cluster_id
        WHERE skc.is_active = true
        ${options.level ? `AND skc.cluster_level = $1` : ''}
        ${options.parent_id ? `AND skc.parent_cluster_id = $${options.level ? 2 : 1}` : ''}
        GROUP BY skc.id
        ORDER BY skc.sort_order, skc.name_en
      `;
    } else {
      query = `
        SELECT * FROM skill_clusters
        WHERE is_active = true
        ${options?.level ? `AND cluster_level = $1` : ''}
        ${options?.parent_id ? `AND parent_cluster_id = $${options?.level ? 2 : 1}` : ''}
        ORDER BY sort_order, name_en
      `;
    }

    const params: (number | string)[] = [];
    if (options?.level) params.push(options.level);
    if (options?.parent_id) params.push(options.parent_id);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get skills in a cluster (including sub-clusters)
   */
  async getSkillsInCluster(clusterId: string): Promise<ClassifiedSkill[]> {
    const result = await pool.query(`
      SELECT * FROM get_cluster_skills($1)
    `, [clusterId]);

    return result.rows.map(row => ({
      id: row.skill_id,
      uri: '',
      preferred_label: row.preferred_label,
      is_digital: false,
      is_green: false,
      classification: {
        id: '',
        esco_skill_id: row.skill_id,
        primary_category: row.primary_category,
        cognitive_level: row.cognitive_level,
        transferability: 'transferable',
        classification_source: 'rule_based',
        needs_review: false,
        skill_cluster: {
          id: clusterId,
          code: row.cluster_code,
          name_en: row.cluster_name,
          cluster_level: 0,
          is_active: true
        }
      }
    }));
  }

  /**
   * Create a new skill cluster
   */
  async createCluster(cluster: Partial<SkillCluster>): Promise<SkillCluster> {
    const result = await pool.query(`
      INSERT INTO skill_clusters (
        code, name_en, name_it, description,
        parent_cluster_id, cluster_level,
        career_path_codes, industry_codes, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      cluster.code,
      cluster.name_en,
      cluster.name_it,
      cluster.description,
      cluster.parent_cluster_id,
      cluster.cluster_level || 1,
      cluster.career_path_codes,
      cluster.industry_codes,
      cluster.skill_count || 0
    ]);

    return result.rows[0];
  }

  /**
   * Assign a skill to a cluster
   */
  async assignToCluster(escoSkillId: string, clusterId: string): Promise<void> {
    await pool.query(`
      UPDATE skill_classifications
      SET skill_cluster_id = $2, updated_at = NOW()
      WHERE esco_skill_id = $1
    `, [escoSkillId, clusterId]);
  }

  /**
   * Suggest clusters for a skill based on its properties
   */
  async suggestCluster(escoSkillId: string): Promise<ClusterSuggestion[]> {
    // Get the skill details
    const skillResult = await pool.query(`
      SELECT * FROM esco_skills WHERE id = $1
    `, [escoSkillId]);

    if (skillResult.rows.length === 0) return [];

    const skill = skillResult.rows[0];
    const suggestions: ClusterSuggestion[] = [];

    // Get all clusters
    const clusters = await this.getClusters({ level: 1 });

    // Simple keyword-based suggestion
    const label = skill.preferred_label.toLowerCase();
    const description = (skill.description || '').toLowerCase();

    for (const cluster of clusters) {
      let confidence = 0;
      let reason = '';

      // Check keywords based on cluster
      switch (cluster.code) {
        case 'TECH-DEV':
          if (/programming|software|web|database|network|cloud/.test(label + description)) {
            confidence = 0.85;
            reason = 'Contains technology-related keywords';
          }
          break;
        case 'DATA-ANA':
          if (/data|analy|statistic|machine learning/.test(label + description)) {
            confidence = 0.80;
            reason = 'Contains data/analytics keywords';
          }
          break;
        case 'BUS-MGT':
          if (/management|business|strategy|project/.test(label + description)) {
            confidence = 0.75;
            reason = 'Contains business/management keywords';
          }
          break;
        case 'COMM-INT':
          if (/communicat|presentation|team|collaborat/.test(label + description)) {
            confidence = 0.80;
            reason = 'Contains communication/interpersonal keywords';
          }
          break;
        // Add more cases as needed
      }

      if (confidence > 0) {
        suggestions.push({ cluster, confidence, reason });
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);
    return suggestions.slice(0, 3);
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  /**
   * Get skills by primary category
   */
  async getSkillsByCategory(category: PrimaryCategory): Promise<ClassifiedSkill[]> {
    const result = await pool.query(`
      SELECT
        es.*,
        sc.primary_category,
        sc.cognitive_level,
        sc.social_dimension,
        sc.transferability
      FROM esco_skills es
      INNER JOIN skill_classifications sc ON es.id = sc.esco_skill_id
      WHERE sc.primary_category = $1
      ORDER BY es.preferred_label
    `, [category]);

    return result.rows.map(row => ({
      id: row.id,
      uri: row.uri,
      preferred_label: row.preferred_label,
      description: row.description,
      esco_skill_type: row.skill_type,
      reuse_level: row.reuse_level,
      is_digital: row.is_digital,
      is_green: row.is_green,
      classification: {
        id: '',
        esco_skill_id: row.id,
        primary_category: row.primary_category,
        cognitive_level: row.cognitive_level,
        social_dimension: row.social_dimension,
        transferability: row.transferability,
        classification_source: 'rule_based',
        needs_review: false
      }
    }));
  }

  /**
   * Get skills by cognitive level
   */
  async getSkillsByCognitiveLevel(level: CognitiveLevel): Promise<ClassifiedSkill[]> {
    const result = await pool.query(`
      SELECT
        es.*,
        sc.primary_category,
        sc.cognitive_level,
        sc.cognitive_level_label,
        sc.social_dimension,
        sc.transferability
      FROM esco_skills es
      INNER JOIN skill_classifications sc ON es.id = sc.esco_skill_id
      WHERE sc.cognitive_level = $1
      ORDER BY es.preferred_label
    `, [level]);

    return result.rows.map(row => ({
      id: row.id,
      uri: row.uri,
      preferred_label: row.preferred_label,
      description: row.description,
      is_digital: row.is_digital,
      is_green: row.is_green,
      classification: {
        id: '',
        esco_skill_id: row.id,
        primary_category: row.primary_category,
        cognitive_level: row.cognitive_level,
        cognitive_level_label: row.cognitive_level_label,
        social_dimension: row.social_dimension,
        transferability: row.transferability,
        classification_source: 'rule_based',
        needs_review: false
      }
    }));
  }

  /**
   * Get skills by transferability
   */
  async getSkillsByTransferability(transferability: Transferability): Promise<ClassifiedSkill[]> {
    const result = await pool.query(`
      SELECT
        es.*,
        sc.primary_category,
        sc.cognitive_level,
        sc.social_dimension,
        sc.transferability,
        sc.transferability_score
      FROM esco_skills es
      INNER JOIN skill_classifications sc ON es.id = sc.esco_skill_id
      WHERE sc.transferability = $1
      ORDER BY sc.transferability_score DESC, es.preferred_label
    `, [transferability]);

    return result.rows.map(row => ({
      id: row.id,
      uri: row.uri,
      preferred_label: row.preferred_label,
      description: row.description,
      is_digital: row.is_digital,
      is_green: row.is_green,
      classification: {
        id: '',
        esco_skill_id: row.id,
        primary_category: row.primary_category,
        cognitive_level: row.cognitive_level,
        social_dimension: row.social_dimension,
        transferability: row.transferability,
        transferability_score: row.transferability_score ? parseFloat(row.transferability_score) : undefined,
        classification_source: 'rule_based',
        needs_review: false
      }
    }));
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get classification statistics
   */
  async getStats(): Promise<ClassificationStats> {
    const result = await pool.query(`SELECT * FROM v_skill_classification_stats`);
    const row = result.rows[0];

    return {
      total_skills: parseInt(row.total_skills),
      classified_skills: parseInt(row.classified_skills),
      unclassified_skills: parseInt(row.unclassified_skills),
      classification_percentage: parseFloat(row.classification_percentage),
      hard_skills: parseInt(row.hard_skills),
      soft_skills: parseInt(row.soft_skills),
      hybrid_skills: parseInt(row.hybrid_skills),
      cognitive_level_1: parseInt(row.cognitive_level_1),
      cognitive_level_2: parseInt(row.cognitive_level_2),
      cognitive_level_3: parseInt(row.cognitive_level_3),
      cognitive_level_4: parseInt(row.cognitive_level_4),
      intrapersonal: parseInt(row.intrapersonal),
      interpersonal: parseInt(row.interpersonal),
      task_oriented: parseInt(row.task_oriented),
      specialized: parseInt(row.specialized),
      adjacent: parseInt(row.adjacent),
      transferable: parseInt(row.transferable),
      needs_review: parseInt(row.needs_review)
    };
  }

  /**
   * Get cluster summary with skill counts
   */
  async getClusterSummary(): Promise<SkillCluster[]> {
    const result = await pool.query(`SELECT * FROM v_skill_clusters_summary ORDER BY name_en`);
    return result.rows;
  }
}

export default SkillClassificationService;
