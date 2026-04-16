/**
 * O*NET Import Service
 *
 * Handles importing O*NET occupational data from the O*NET database.
 * Supports import of occupations, skills, abilities, knowledge, and work activities.
 *
 * @module services/onet-import
 * @story S-ONTO-01-04
 */
import { logger } from '../config/logger.js';
// Configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
export class ONetImportService {
    pool;
    openaiApiKey = null;
    constructor(pool) {
        this.pool = pool;
        this.initOpenAIKey();
    }
    async initOpenAIKey() {
        try {
            const result = await this.pool.query(`SELECT value FROM system_config WHERE key = 'openai_api_key' LIMIT 1`);
            this.openaiApiKey = result.rows[0]?.value || process.env.OPENAI_API_KEY || null;
        }
        catch {
            this.openaiApiKey = process.env.OPENAI_API_KEY || null;
        }
    }
    /**
     * Get O*NET statistics
     */
    async getStats() {
        const result = await this.pool.query('SELECT * FROM fn_get_onet_stats()');
        const row = result.rows[0] || {};
        return {
            occupations_total: parseInt(row.occupations_total || '0'),
            occupations_with_embeddings: parseInt(row.occupations_with_embeddings || '0'),
            skills_total: parseInt(row.skills_total || '0'),
            skills_mapped_to_esco: parseInt(row.skills_mapped_to_esco || '0'),
            abilities_total: parseInt(row.abilities_total || '0'),
            knowledge_total: parseInt(row.knowledge_total || '0'),
            work_activities_total: parseInt(row.work_activities_total || '0'),
            occupation_skill_links: parseInt(row.occupation_skill_links || '0'),
            last_import_at: row.last_import_at || null,
        };
    }
    /**
     * Create import job
     */
    async createImportJob(importType, sourceVersion) {
        const result = await this.pool.query(`INSERT INTO onet_import_jobs (import_type, source_version, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`, [importType, sourceVersion]);
        return this.rowToJob(result.rows[0]);
    }
    /**
     * Get import job status
     */
    async getImportJobStatus(jobId) {
        const result = await this.pool.query(`SELECT * FROM onet_import_jobs WHERE id = $1`, [jobId]);
        if (result.rows.length === 0)
            return null;
        return this.rowToJob(result.rows[0]);
    }
    /**
     * List import jobs
     */
    async listImportJobs(limit = 20, offset = 0) {
        const countResult = await this.pool.query(`SELECT COUNT(*) FROM onet_import_jobs`);
        const result = await this.pool.query(`SELECT * FROM onet_import_jobs
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`, [limit, offset]);
        return {
            jobs: result.rows.map(this.rowToJob),
            total: parseInt(countResult.rows[0].count),
        };
    }
    /**
     * Import occupations from data array
     */
    async importOccupations(jobId, occupations, sourceVersion) {
        const stats = {
            occupations: 0,
            skills: 0,
            abilities: 0,
            knowledge: 0,
            work_activities: 0,
            occupation_skill_links: 0,
        };
        await this.pool.query(`UPDATE onet_import_jobs SET status = 'processing', started_at = NOW(), total_records = $2 WHERE id = $1`, [jobId, occupations.length]);
        try {
            for (const occ of occupations) {
                try {
                    await this.pool.query(`INSERT INTO onet_occupations
             (onet_soc_code, title, description, job_zone, related_experience, education_required, on_job_training, source_version)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (onet_soc_code) DO UPDATE SET
               title = EXCLUDED.title,
               description = EXCLUDED.description,
               job_zone = EXCLUDED.job_zone,
               related_experience = EXCLUDED.related_experience,
               education_required = EXCLUDED.education_required,
               on_job_training = EXCLUDED.on_job_training,
               source_version = EXCLUDED.source_version,
               updated_at = NOW()`, [
                        occ.onet_soc_code,
                        occ.title,
                        occ.description,
                        occ.job_zone,
                        occ.related_experience,
                        occ.education_required,
                        occ.on_job_training,
                        sourceVersion,
                    ]);
                    stats.occupations++;
                }
                catch (error) {
                    logger.error(`Error importing occupation ${occ.onet_soc_code}:${error}`);
                }
                // Update progress
                await this.pool.query(`UPDATE onet_import_jobs SET processed_records = $2 WHERE id = $1`, [
                    jobId,
                    stats.occupations,
                ]);
            }
            await this.pool.query(`UPDATE onet_import_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`, [jobId]);
        }
        catch (error) {
            await this.pool.query(`UPDATE onet_import_jobs SET status = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1`, [jobId, error instanceof Error ? error.message : 'Unknown error']);
            throw error;
        }
        return stats;
    }
    /**
     * Import skills from data array
     */
    async importSkills(jobId, skills) {
        const stats = {
            occupations: 0,
            skills: 0,
            abilities: 0,
            knowledge: 0,
            work_activities: 0,
            occupation_skill_links: 0,
        };
        await this.pool.query(`UPDATE onet_import_jobs SET status = 'processing', started_at = NOW(), total_records = $2 WHERE id = $1`, [jobId, skills.length]);
        try {
            for (const skill of skills) {
                try {
                    await this.pool.query(`INSERT INTO onet_skills (element_id, element_name, description, category)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (element_id) DO UPDATE SET
               element_name = EXCLUDED.element_name,
               description = EXCLUDED.description,
               category = EXCLUDED.category,
               updated_at = NOW()`, [skill.element_id, skill.element_name, skill.description, skill.category]);
                    stats.skills++;
                }
                catch (error) {
                    logger.error(`Error importing skill ${skill.element_id}:${error}`);
                }
                await this.pool.query(`UPDATE onet_import_jobs SET processed_records = $2 WHERE id = $1`, [
                    jobId,
                    stats.skills,
                ]);
            }
            await this.pool.query(`UPDATE onet_import_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`, [jobId]);
        }
        catch (error) {
            await this.pool.query(`UPDATE onet_import_jobs SET status = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1`, [jobId, error instanceof Error ? error.message : 'Unknown error']);
            throw error;
        }
        return stats;
    }
    /**
     * Import abilities from data array
     */
    async importAbilities(jobId, abilities) {
        const stats = {
            occupations: 0,
            skills: 0,
            abilities: 0,
            knowledge: 0,
            work_activities: 0,
            occupation_skill_links: 0,
        };
        await this.pool.query(`UPDATE onet_import_jobs SET status = 'processing', started_at = NOW(), total_records = $2 WHERE id = $1`, [jobId, abilities.length]);
        try {
            for (const ability of abilities) {
                try {
                    await this.pool.query(`INSERT INTO onet_abilities (element_id, element_name, description, category)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (element_id) DO UPDATE SET
               element_name = EXCLUDED.element_name,
               description = EXCLUDED.description,
               category = EXCLUDED.category,
               updated_at = NOW()`, [ability.element_id, ability.element_name, ability.description, ability.category]);
                    stats.abilities++;
                }
                catch (error) {
                    logger.error(`Error importing ability ${ability.element_id}:${error}`);
                }
                await this.pool.query(`UPDATE onet_import_jobs SET processed_records = $2 WHERE id = $1`, [
                    jobId,
                    stats.abilities,
                ]);
            }
            await this.pool.query(`UPDATE onet_import_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`, [jobId]);
        }
        catch (error) {
            await this.pool.query(`UPDATE onet_import_jobs SET status = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1`, [jobId, error instanceof Error ? error.message : 'Unknown error']);
            throw error;
        }
        return stats;
    }
    /**
     * Import knowledge areas from data array
     */
    async importKnowledge(jobId, knowledgeAreas) {
        const stats = {
            occupations: 0,
            skills: 0,
            abilities: 0,
            knowledge: 0,
            work_activities: 0,
            occupation_skill_links: 0,
        };
        await this.pool.query(`UPDATE onet_import_jobs SET status = 'processing', started_at = NOW(), total_records = $2 WHERE id = $1`, [jobId, knowledgeAreas.length]);
        try {
            for (const ka of knowledgeAreas) {
                try {
                    await this.pool.query(`INSERT INTO onet_knowledge (element_id, element_name, description, domain)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (element_id) DO UPDATE SET
               element_name = EXCLUDED.element_name,
               description = EXCLUDED.description,
               domain = EXCLUDED.domain,
               updated_at = NOW()`, [ka.element_id, ka.element_name, ka.description, ka.domain]);
                    stats.knowledge++;
                }
                catch (error) {
                    logger.error(`Error importing knowledge ${ka.element_id}:${error}`);
                }
                await this.pool.query(`UPDATE onet_import_jobs SET processed_records = $2 WHERE id = $1`, [
                    jobId,
                    stats.knowledge,
                ]);
            }
            await this.pool.query(`UPDATE onet_import_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`, [jobId]);
        }
        catch (error) {
            await this.pool.query(`UPDATE onet_import_jobs SET status = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1`, [jobId, error instanceof Error ? error.message : 'Unknown error']);
            throw error;
        }
        return stats;
    }
    /**
     * Import work activities from data array
     */
    async importWorkActivities(jobId, activities) {
        const stats = {
            occupations: 0,
            skills: 0,
            abilities: 0,
            knowledge: 0,
            work_activities: 0,
            occupation_skill_links: 0,
        };
        await this.pool.query(`UPDATE onet_import_jobs SET status = 'processing', started_at = NOW(), total_records = $2 WHERE id = $1`, [jobId, activities.length]);
        try {
            for (const activity of activities) {
                try {
                    await this.pool.query(`INSERT INTO onet_work_activities (element_id, element_name, description, activity_type, parent_element_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (element_id) DO UPDATE SET
               element_name = EXCLUDED.element_name,
               description = EXCLUDED.description,
               activity_type = EXCLUDED.activity_type,
               parent_element_id = EXCLUDED.parent_element_id,
               updated_at = NOW()`, [
                        activity.element_id,
                        activity.element_name,
                        activity.description,
                        activity.activity_type,
                        activity.parent_element_id,
                    ]);
                    stats.work_activities++;
                }
                catch (error) {
                    logger.error(`Error importing work activity ${activity.element_id}:${error}`);
                }
                await this.pool.query(`UPDATE onet_import_jobs SET processed_records = $2 WHERE id = $1`, [
                    jobId,
                    stats.work_activities,
                ]);
            }
            await this.pool.query(`UPDATE onet_import_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`, [jobId]);
        }
        catch (error) {
            await this.pool.query(`UPDATE onet_import_jobs SET status = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1`, [jobId, error instanceof Error ? error.message : 'Unknown error']);
            throw error;
        }
        return stats;
    }
    /**
     * Import occupation-skill links
     */
    async importOccupationSkillLinks(jobId, links) {
        const stats = {
            occupations: 0,
            skills: 0,
            abilities: 0,
            knowledge: 0,
            work_activities: 0,
            occupation_skill_links: 0,
        };
        await this.pool.query(`UPDATE onet_import_jobs SET status = 'processing', started_at = NOW(), total_records = $2 WHERE id = $1`, [jobId, links.length]);
        try {
            for (const link of links) {
                try {
                    // Get occupation ID
                    const occResult = await this.pool.query(`SELECT id FROM onet_occupations WHERE onet_soc_code = $1`, [link.onet_soc_code]);
                    if (occResult.rows.length === 0)
                        continue;
                    const occupationId = occResult.rows[0].id;
                    // Get skill ID
                    const skillResult = await this.pool.query(`SELECT id FROM onet_skills WHERE element_id = $1`, [link.element_id]);
                    if (skillResult.rows.length === 0)
                        continue;
                    const skillId = skillResult.rows[0].id;
                    await this.pool.query(`INSERT INTO onet_occupation_skills (occupation_id, skill_id, importance, level)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (occupation_id, skill_id) DO UPDATE SET
               importance = EXCLUDED.importance,
               level = EXCLUDED.level`, [occupationId, skillId, link.importance, link.level]);
                    stats.occupation_skill_links++;
                }
                catch (error) {
                    logger.error(`Error importing link ${link.onet_soc_code}-${link.element_id}:${error}`);
                }
                await this.pool.query(`UPDATE onet_import_jobs SET processed_records = $2 WHERE id = $1`, [
                    jobId,
                    stats.occupation_skill_links,
                ]);
            }
            await this.pool.query(`UPDATE onet_import_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`, [jobId]);
        }
        catch (error) {
            await this.pool.query(`UPDATE onet_import_jobs SET status = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1`, [jobId, error instanceof Error ? error.message : 'Unknown error']);
            throw error;
        }
        return stats;
    }
    /**
     * Map O*NET skills to ESCO using semantic similarity
     */
    async mapSkillsToEsco(confidenceThreshold = 0.7) {
        const result = { mapped: 0, failed: 0 };
        if (!this.openaiApiKey) {
            logger.info('No OpenAI API key available, skipping semantic mapping');
            return result;
        }
        // Get unmapped skills
        const skills = await this.pool.query(`SELECT id, element_name, description
       FROM onet_skills
       WHERE mapped_esco_skill_id IS NULL`);
        for (const skill of skills.rows) {
            try {
                const text = `${skill.element_name}. ${skill.description || ''}`.trim();
                // Generate embedding
                const response = await fetch('https://api.openai.com/v1/embeddings', {
                    signal: AbortSignal.timeout(30000),
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${this.openaiApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: EMBEDDING_MODEL,
                        input: text.toLowerCase(),
                        dimensions: EMBEDDING_DIMENSIONS,
                    }),
                });
                if (!response.ok)
                    continue;
                const data = (await response.json());
                if (!data.data?.[0]?.embedding)
                    continue;
                const embedding = data.data[0].embedding;
                const vectorStr = `[${embedding.join(',')}]`;
                // Find best ESCO match
                const matchResult = await this.pool.query(`SELECT id, preferred_label_en,
                  1 - (embedding_en <=> $1::vector) as similarity
           FROM esco_skills
           WHERE embedding_en IS NOT NULL
           ORDER BY embedding_en <=> $1::vector
           LIMIT 1`, [vectorStr]);
                if (matchResult.rows.length > 0 &&
                    parseFloat(matchResult.rows[0].similarity) >= confidenceThreshold) {
                    await this.pool.query(`UPDATE onet_skills SET
               mapped_esco_skill_id = $1,
               mapping_confidence = $2,
               embedding_en = $3::vector,
               embedding_model = $4,
               embedding_generated_at = NOW()
             WHERE id = $5`, [
                        matchResult.rows[0].id,
                        matchResult.rows[0].similarity,
                        vectorStr,
                        EMBEDDING_MODEL,
                        skill.id,
                    ]);
                    result.mapped++;
                }
                else {
                    // Store embedding even if no match
                    await this.pool.query(`UPDATE onet_skills SET
               embedding_en = $1::vector,
               embedding_model = $2,
               embedding_generated_at = NOW()
             WHERE id = $3`, [vectorStr, EMBEDDING_MODEL, skill.id]);
                }
            }
            catch (error) {
                logger.error(`Error mapping skill ${skill.id}:${error}`);
                result.failed++;
            }
        }
        return result;
    }
    /**
     * Get occupations by skill requirements
     */
    async getOccupationsBySkill(skillId, minImportance = 50) {
        const result = await this.pool.query(`SELECT
         o.id, o.onet_soc_code, o.title,
         os.importance, os.level
       FROM onet_occupations o
       JOIN onet_occupation_skills os ON os.occupation_id = o.id
       WHERE os.skill_id = $1 AND os.importance >= $2
       ORDER BY os.importance DESC, os.level DESC
       LIMIT 50`, [skillId, minImportance]);
        return result.rows;
    }
    /**
     * Get skills required for an occupation
     */
    async getSkillsForOccupation(occupationId) {
        const result = await this.pool.query(`SELECT
         s.id, s.element_id, s.element_name, s.category,
         os.importance, os.level,
         s.mapped_esco_skill_id as esco_skill_id,
         es.preferred_label_en as esco_skill_name
       FROM onet_skills s
       JOIN onet_occupation_skills os ON os.skill_id = s.id
       LEFT JOIN esco_skills es ON es.id = s.mapped_esco_skill_id
       WHERE os.occupation_id = $1
       ORDER BY os.importance DESC, os.level DESC`, [occupationId]);
        return result.rows;
    }
    /**
     * Search occupations by text
     */
    async searchOccupations(query, limit = 20) {
        const result = await this.pool.query(`SELECT id, onet_soc_code, title, job_zone,
              ts_rank(to_tsvector('english', title || ' ' || COALESCE(description, '')), plainto_tsquery('english', $1)) as rank
       FROM onet_occupations
       WHERE to_tsvector('english', title || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $2`, [query, limit]);
        return result.rows;
    }
    /**
     * Get unified skills view
     */
    async getUnifiedSkills(sources = ['esco', 'onet_skill', 'onet_ability', 'onet_knowledge'], limit = 100, offset = 0) {
        const sourceFilter = sources.map((_, i) => `$${i + 1}`).join(', ');
        const result = await this.pool.query(`SELECT source, id, external_id, name, description, category
       FROM v_unified_skills
       WHERE source IN (${sourceFilter})
       ORDER BY source, name
       LIMIT $${sources.length + 1} OFFSET $${sources.length + 2}`, [...sources, limit, offset]);
        return result.rows;
    }
    // Helper methods
    rowToJob(row) {
        return {
            id: row.id,
            import_type: row.import_type,
            status: row.status,
            total_records: row.total_records,
            processed_records: row.processed_records,
            failed_records: row.failed_records,
            error_message: row.error_message || null,
            started_at: row.started_at || null,
            completed_at: row.completed_at || null,
        };
    }
}
export default ONetImportService;
//# sourceMappingURL=onet-import.js.map