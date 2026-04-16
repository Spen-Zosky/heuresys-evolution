/**
 * Job Skills Enrichment Service
 * Integrates enhanced skill taxonomy with job skills:
 * - Enriches job_skills with classification data from skill_classifications
 * - Suggests skills for job templates based on ESCO occupation codes
 * - Calculates skill distribution (Hard/Soft/Hybrid balance)
 */
import { pool } from '../config/database.js';
import { SkillClassificationService } from './skill-classification.js';
// =============================================================================
// JOB SKILLS ENRICHMENT SERVICE
// =============================================================================
export class JobSkillsEnrichmentService {
    _tenantId;
    classificationService;
    constructor(tenantId) {
        this._tenantId = tenantId;
        this.classificationService = new SkillClassificationService(tenantId);
    }
    get tenantId() { return this._tenantId; }
    // ===========================================================================
    // ENRICHMENT METHODS
    // ===========================================================================
    /**
     * Enrich all job_skills with classification data from skill_classifications
     * This syncs the taxonomy data to job_skills table
     */
    async enrichAllJobSkills() {
        const result = {
            total_skills: 0,
            enriched: 0,
            not_found: 0,
            errors: []
        };
        // Get all job skills that need enrichment
        const jobSkillsResult = await pool.query(`
      SELECT js.id, js.esco_skill_uri
      FROM job_skills js
      WHERE js.esco_skill_uri IS NOT NULL
        AND (js.primary_category IS NULL OR js.skill_cluster_id IS NULL)
    `);
        result.total_skills = jobSkillsResult.rows.length;
        for (const row of jobSkillsResult.rows) {
            try {
                // Find the ESCO skill by URI
                const escoSkill = await pool.query(`
          SELECT id FROM esco_skills WHERE uri = $1
        `, [row.esco_skill_uri]);
                if (escoSkill.rows.length === 0) {
                    result.not_found++;
                    continue;
                }
                // Get classification for this skill
                const classification = await this.classificationService.getClassification(escoSkill.rows[0].id);
                if (classification) {
                    // Update job_skills with classification data
                    await pool.query(`
            UPDATE job_skills SET
              primary_category = $2,
              cognitive_level = $3,
              transferability = $4,
              skill_cluster_id = $5
            WHERE id = $1
          `, [
                        row.id,
                        classification.primary_category,
                        classification.cognitive_level,
                        classification.transferability,
                        classification.skill_cluster_id
                    ]);
                    result.enriched++;
                }
                else {
                    result.not_found++;
                }
            }
            catch (error) {
                result.errors.push(`Error enriching skill ${row.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        return result;
    }
    /**
     * Enrich job_skills for a specific job template
     */
    async enrichJobTemplateSkills(jobTemplateId) {
        const result = {
            total_skills: 0,
            enriched: 0,
            not_found: 0,
            errors: []
        };
        // Get job skills for this template
        const jobSkillsResult = await pool.query(`
      SELECT js.id, js.esco_skill_uri
      FROM job_skills js
      WHERE js.job_template_id = $1
        AND js.esco_skill_uri IS NOT NULL
    `, [jobTemplateId]);
        result.total_skills = jobSkillsResult.rows.length;
        for (const row of jobSkillsResult.rows) {
            try {
                // Find the ESCO skill by URI
                const escoSkill = await pool.query(`
          SELECT id FROM esco_skills WHERE uri = $1
        `, [row.esco_skill_uri]);
                if (escoSkill.rows.length === 0) {
                    result.not_found++;
                    continue;
                }
                const classification = await this.classificationService.getClassification(escoSkill.rows[0].id);
                if (classification) {
                    await pool.query(`
            UPDATE job_skills SET
              primary_category = $2,
              cognitive_level = $3,
              transferability = $4,
              skill_cluster_id = $5
            WHERE id = $1
          `, [
                        row.id,
                        classification.primary_category,
                        classification.cognitive_level,
                        classification.transferability,
                        classification.skill_cluster_id
                    ]);
                    result.enriched++;
                }
                else {
                    result.not_found++;
                }
            }
            catch (error) {
                result.errors.push(`Error enriching skill ${row.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        return result;
    }
    // ===========================================================================
    // SKILL SUGGESTION METHODS
    // ===========================================================================
    /**
     * Suggest skills for a job template based on occupation codes and existing skills
     */
    async suggestSkillsForJobTemplate(jobTemplateId, options) {
        const maxSuggestions = options?.max_suggestions ?? 20;
        const includeHard = options?.include_hard ?? true;
        const includeSoft = options?.include_soft ?? true;
        const includeHybrid = options?.include_hybrid ?? true;
        const minTransferability = options?.min_transferability_score ?? 0;
        // Get the job template details
        const templateResult = await pool.query(`
      SELECT jt.*, eo.id as esco_occupation_id, eo.uri as esco_occupation_uri
      FROM job_templates jt
      LEFT JOIN esco_occupations eo ON jt.esco_occupation_uri = eo.uri
      WHERE jt.id = $1
    `, [jobTemplateId]);
        if (templateResult.rows.length === 0) {
            return [];
        }
        // Template exists, continue with suggestions
        // const template = templateResult.rows[0];
        // Get already assigned skills to exclude
        const existingSkillsResult = await pool.query(`
      SELECT es.id
      FROM job_skills js
      INNER JOIN esco_skills es ON js.esco_skill_uri = es.uri
      WHERE js.job_template_id = $1
    `, [jobTemplateId]);
        const excludeIds = existingSkillsResult.rows.map(r => r.id);
        // Build category filter
        const categories = [];
        if (includeHard)
            categories.push('hard');
        if (includeSoft)
            categories.push('soft');
        if (includeHybrid)
            categories.push('hybrid');
        // Get skills that match the template's occupation cluster
        const suggestionsResult = await pool.query(`
      SELECT
        es.id as esco_skill_id,
        es.preferred_label,
        es.description,
        sc.primary_category,
        sc.cognitive_level,
        sc.transferability,
        sc.transferability_score,
        skc.code as skill_cluster_code,
        CASE
          WHEN sc.skill_cluster_id IS NOT NULL THEN 0.80
          WHEN sc.transferability = 'transferable' THEN 0.70
          WHEN sc.transferability = 'adjacent' THEN 0.60
          ELSE 0.50
        END as relevance_score,
        CASE
          WHEN sc.skill_cluster_id IS NOT NULL THEN 'Same skill cluster'
          WHEN sc.transferability = 'transferable' THEN 'Highly transferable skill'
          WHEN sc.transferability = 'adjacent' THEN 'Adjacent skill'
          ELSE 'Potentially relevant'
        END as relevance_reason
      FROM esco_skills es
      INNER JOIN skill_classifications sc ON es.id = sc.esco_skill_id
      LEFT JOIN skill_clusters skc ON sc.skill_cluster_id = skc.id
      WHERE sc.primary_category = ANY($1)
        AND sc.transferability_score >= $2
        AND es.id != ALL($3::uuid[])
      ORDER BY relevance_score DESC, sc.transferability_score DESC
      LIMIT $4
    `, [categories, minTransferability, excludeIds, maxSuggestions]);
        return suggestionsResult.rows.map(row => ({
            esco_skill_id: row.esco_skill_id,
            preferred_label: row.preferred_label,
            description: row.description,
            primary_category: row.primary_category,
            cognitive_level: row.cognitive_level,
            transferability: row.transferability,
            transferability_score: parseFloat(row.transferability_score),
            skill_cluster_code: row.skill_cluster_code,
            relevance_score: parseFloat(row.relevance_score),
            relevance_reason: row.relevance_reason
        }));
    }
    /**
     * Suggest skills by skill cluster to fill gaps
     */
    async suggestSkillsByCluster(clusterId, excludeSkillIds, limit = 10) {
        const result = await pool.query(`
      SELECT
        es.id as esco_skill_id,
        es.preferred_label,
        es.description,
        sc.primary_category,
        sc.cognitive_level,
        sc.transferability,
        sc.transferability_score,
        skc.code as skill_cluster_code,
        0.85 as relevance_score,
        'Same skill cluster' as relevance_reason
      FROM esco_skills es
      INNER JOIN skill_classifications sc ON es.id = sc.esco_skill_id
      LEFT JOIN skill_clusters skc ON sc.skill_cluster_id = skc.id
      WHERE sc.skill_cluster_id = $1
        AND es.id != ALL($2::uuid[])
      ORDER BY sc.transferability_score DESC, es.preferred_label
      LIMIT $3
    `, [clusterId, excludeSkillIds || [], limit]);
        return result.rows.map(row => ({
            esco_skill_id: row.esco_skill_id,
            preferred_label: row.preferred_label,
            description: row.description,
            primary_category: row.primary_category,
            cognitive_level: row.cognitive_level,
            transferability: row.transferability,
            transferability_score: parseFloat(row.transferability_score || '0'),
            skill_cluster_code: row.skill_cluster_code,
            relevance_score: parseFloat(row.relevance_score),
            relevance_reason: row.relevance_reason
        }));
    }
    // ===========================================================================
    // DISTRIBUTION ANALYSIS METHODS
    // ===========================================================================
    /**
     * Get skill distribution analysis for a job template
     */
    async getJobSkillDistribution(jobTemplateId) {
        const result = await pool.query(`
      SELECT
        jt.id as job_template_id,
        jt.title_en as job_title,
        COUNT(js.id) as total_skills,
        COUNT(*) FILTER (WHERE js.primary_category = 'hard') as hard_skills,
        COUNT(*) FILTER (WHERE js.primary_category = 'soft') as soft_skills,
        COUNT(*) FILTER (WHERE js.primary_category = 'hybrid') as hybrid_skills,
        COUNT(*) FILTER (WHERE js.cognitive_level = 1) as level_1,
        COUNT(*) FILTER (WHERE js.cognitive_level = 2) as level_2,
        COUNT(*) FILTER (WHERE js.cognitive_level = 3) as level_3,
        COUNT(*) FILTER (WHERE js.cognitive_level = 4) as level_4,
        COUNT(*) FILTER (WHERE js.transferability = 'specialized') as specialized,
        COUNT(*) FILTER (WHERE js.transferability = 'adjacent') as adjacent,
        COUNT(*) FILTER (WHERE js.transferability = 'transferable') as transferable
      FROM job_templates jt
      LEFT JOIN job_skills js ON jt.id = js.job_template_id
      WHERE jt.id = $1
      GROUP BY jt.id, jt.title_en
    `, [jobTemplateId]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        const total = parseInt(row.total_skills) || 1; // Avoid division by zero
        // Get cluster distribution
        const clusterResult = await pool.query(`
      SELECT
        skc.code,
        skc.name_en as name,
        COUNT(*) as count
      FROM job_skills js
      INNER JOIN skill_clusters skc ON js.skill_cluster_id = skc.id
      WHERE js.job_template_id = $1
      GROUP BY skc.id, skc.code, skc.name_en
      ORDER BY count DESC
    `, [jobTemplateId]);
        return {
            job_template_id: row.job_template_id,
            job_title: row.job_title,
            total_skills: parseInt(row.total_skills),
            hard_skills: parseInt(row.hard_skills),
            soft_skills: parseInt(row.soft_skills),
            hybrid_skills: parseInt(row.hybrid_skills),
            hard_skill_percentage: Math.round((parseInt(row.hard_skills) / total) * 100),
            soft_skill_percentage: Math.round((parseInt(row.soft_skills) / total) * 100),
            hybrid_skill_percentage: Math.round((parseInt(row.hybrid_skills) / total) * 100),
            cognitive_level_distribution: {
                level_1: parseInt(row.level_1),
                level_2: parseInt(row.level_2),
                level_3: parseInt(row.level_3),
                level_4: parseInt(row.level_4)
            },
            transferability_distribution: {
                specialized: parseInt(row.specialized),
                adjacent: parseInt(row.adjacent),
                transferable: parseInt(row.transferable)
            },
            clusters: clusterResult.rows.map(r => ({
                code: r.code,
                name: r.name,
                count: parseInt(r.count)
            }))
        };
    }
    /**
     * Get skill balance recommendations for a job template
     */
    async getSkillBalanceRecommendations(jobTemplateId) {
        const distribution = await this.getJobSkillDistribution(jobTemplateId);
        if (!distribution) {
            return {
                distribution: null,
                recommendations: ['Job template not found'],
                suggested_skills: []
            };
        }
        const recommendations = [];
        const suggestedSkills = [];
        // Analyze balance and provide recommendations
        if (distribution.total_skills < 5) {
            recommendations.push(`Consider adding more skills. Currently only ${distribution.total_skills} skills defined.`);
        }
        // Check Hard/Soft balance
        if (distribution.soft_skill_percentage < 20) {
            recommendations.push('Consider adding more soft skills for a balanced profile. Current soft skill percentage is low.');
            const softSuggestions = await this.suggestSkillsForJobTemplate(jobTemplateId, {
                max_suggestions: 5,
                include_hard: false,
                include_soft: true,
                include_hybrid: false
            });
            suggestedSkills.push(...softSuggestions);
        }
        if (distribution.hard_skill_percentage < 30) {
            recommendations.push('Consider adding more technical/hard skills for role competency requirements.');
            const hardSuggestions = await this.suggestSkillsForJobTemplate(jobTemplateId, {
                max_suggestions: 5,
                include_hard: true,
                include_soft: false,
                include_hybrid: false
            });
            suggestedSkills.push(...hardSuggestions);
        }
        // Check cognitive level distribution
        const totalCognitive = distribution.cognitive_level_distribution.level_1 +
            distribution.cognitive_level_distribution.level_2 +
            distribution.cognitive_level_distribution.level_3 +
            distribution.cognitive_level_distribution.level_4;
        if (totalCognitive > 0) {
            const advancedSkillsPct = ((distribution.cognitive_level_distribution.level_3 +
                distribution.cognitive_level_distribution.level_4) / totalCognitive) * 100;
            if (advancedSkillsPct < 25) {
                recommendations.push('Consider adding more advanced skills (Analyze/Evaluate/Create levels) for senior or complex roles.');
            }
        }
        // Check transferability
        if (distribution.transferability_distribution.transferable < 3) {
            recommendations.push('Consider adding more transferable skills to enable internal mobility and career development.');
        }
        if (recommendations.length === 0) {
            recommendations.push('Skill profile is well-balanced!');
        }
        return {
            distribution,
            recommendations,
            suggested_skills: suggestedSkills
        };
    }
    // ===========================================================================
    // BULK OPERATIONS
    // ===========================================================================
    /**
     * Add suggested skill to job template
     */
    async addSkillToJobTemplate(jobTemplateId, escoSkillId, options) {
        // Get the ESCO skill with classification
        const skillResult = await pool.query(`
      SELECT
        es.*,
        sc.primary_category,
        sc.cognitive_level,
        sc.transferability,
        sc.skill_cluster_id
      FROM esco_skills es
      LEFT JOIN skill_classifications sc ON es.id = sc.esco_skill_id
      WHERE es.id = $1
    `, [escoSkillId]);
        if (skillResult.rows.length === 0) {
            return { id: '', success: false, message: 'Skill not found' };
        }
        const skill = skillResult.rows[0];
        // Check if already assigned
        const existingResult = await pool.query(`
      SELECT id FROM job_skills WHERE job_template_id = $1 AND esco_skill_uri = $2
    `, [jobTemplateId, skill.uri]);
        if (existingResult.rows.length > 0) {
            return { id: existingResult.rows[0].id, success: false, message: 'Skill already assigned to this job template' };
        }
        // Insert job skill with classification data
        const insertResult = await pool.query(`
      INSERT INTO job_skills (
        job_template_id, skill_name_en, skill_name_it, esco_skill_uri,
        esco_skill_type, required_level, is_required, importance,
        primary_category, cognitive_level, transferability, skill_cluster_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
            jobTemplateId,
            skill.preferred_label,
            skill.preferred_label, // Use same for IT for now
            skill.uri,
            skill.skill_type,
            options?.required_level ?? 3,
            options?.is_required ?? true,
            options?.importance ?? 'medium',
            skill.primary_category,
            skill.cognitive_level,
            skill.transferability,
            skill.skill_cluster_id
        ]);
        return {
            id: insertResult.rows[0].id,
            success: true,
            message: 'Skill added successfully'
        };
    }
}
export default JobSkillsEnrichmentService;
//# sourceMappingURL=job-skills-enrichment.js.map