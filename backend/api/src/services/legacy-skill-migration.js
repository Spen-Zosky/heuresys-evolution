/**
 * Legacy Skill Migration Service
 *
 * Bridges legacy skill data to the ESCO ontology using semantic matching.
 * Handles: employee_skills, extracted_skills, unknown_skills
 *
 * @module services/legacy-skill-migration
 * @story S-ONTO-01-05
 */
import { logger } from '../config/logger.js';
// Configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.75;
const DEFAULT_BATCH_SIZE = 50;
export class LegacySkillMigrationService {
    pool;
    openaiApiKey = null;
    constructor(pool) {
        this.pool = pool;
        this.initOpenAIKey();
    }
    async initOpenAIKey() {
        // Try to get API key from database first, then environment
        try {
            const result = await this.pool.query(`SELECT value FROM system_config WHERE key = 'openai_api_key' LIMIT 1`);
            this.openaiApiKey = result.rows[0]?.value || process.env.OPENAI_API_KEY || null;
        }
        catch {
            // system_config may not exist, use env var
            this.openaiApiKey = process.env.OPENAI_API_KEY || null;
        }
    }
    /**
     * Create a new migration job
     */
    async createMigrationJob(tenantId, jobType = 'all') {
        // Count records to process
        const counts = await this.countUnmappedRecords(tenantId, jobType);
        const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
        const result = await this.pool.query(`INSERT INTO skill_migration_jobs
       (tenant_id, job_type, status, total_records, processed_records, matched_records, failed_records)
       VALUES ($1, $2, 'pending', $3, 0, 0, 0)
       RETURNING *`, [tenantId, jobType, totalRecords]);
        return this.rowToJob(result.rows[0]);
    }
    /**
     * Count unmapped records by type
     */
    async countUnmappedRecords(tenantId, jobType) {
        const counts = {};
        if (jobType === 'all' || jobType === 'employee_skills') {
            const res = await this.pool.query(`SELECT COUNT(*) FROM employee_skills
         WHERE tenant_id = $1 AND esco_skill_id IS NULL AND custom_skill_name IS NOT NULL`, [tenantId]);
            counts.employee_skills = parseInt(res.rows[0].count);
        }
        if (jobType === 'all' || jobType === 'extracted_skills') {
            const res = await this.pool.query(`SELECT COUNT(*) FROM extracted_skills
         WHERE tenant_id = $1 AND esco_skill_id IS NULL`, [tenantId]);
            counts.extracted_skills = parseInt(res.rows[0].count);
        }
        if (jobType === 'all' || jobType === 'unknown_skills') {
            const res = await this.pool.query(`SELECT COUNT(*) FROM unknown_skills
         WHERE tenant_id = $1 AND review_status = 'pending' AND mapped_to_esco_id IS NULL`, [tenantId]);
            counts.unknown_skills = parseInt(res.rows[0].count);
        }
        return counts;
    }
    /**
     * Execute migration job
     */
    async executeMigrationJob(jobId, options = {}) {
        const { confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD, batchSize = DEFAULT_BATCH_SIZE, createCustomSkills = true, } = options;
        // Get job details
        const jobResult = await this.pool.query(`UPDATE skill_migration_jobs SET status = 'processing', started_at = NOW()
       WHERE id = $1 RETURNING *`, [jobId]);
        if (jobResult.rows.length === 0) {
            throw new Error(`Migration job ${jobId} not found`);
        }
        const job = this.rowToJob(jobResult.rows[0]);
        const stats = {
            total: job.total_records,
            processed: 0,
            matched: 0,
            custom_created: 0,
            skipped: 0,
            failed: 0,
        };
        try {
            // Process each type based on job_type
            if (job.job_type === 'all' || job.job_type === 'employee_skills') {
                const empStats = await this.migrateEmployeeSkills(job.tenant_id, confidenceThreshold, batchSize, createCustomSkills);
                this.mergeStats(stats, empStats);
            }
            if (job.job_type === 'all' || job.job_type === 'extracted_skills') {
                const extStats = await this.migrateExtractedSkills(job.tenant_id, confidenceThreshold, batchSize);
                this.mergeStats(stats, extStats);
            }
            if (job.job_type === 'all' || job.job_type === 'unknown_skills') {
                const unkStats = await this.migrateUnknownSkills(job.tenant_id, confidenceThreshold, batchSize);
                this.mergeStats(stats, unkStats);
            }
            // Update job as completed
            await this.pool.query(`UPDATE skill_migration_jobs SET
         status = 'completed',
         completed_at = NOW(),
         processed_records = $2,
         matched_records = $3,
         failed_records = $4
         WHERE id = $1`, [jobId, stats.processed, stats.matched, stats.failed]);
        }
        catch (error) {
            // Update job as failed
            await this.pool.query(`UPDATE skill_migration_jobs SET
         status = 'failed',
         completed_at = NOW(),
         processed_records = $2,
         matched_records = $3,
         failed_records = $4,
         error_message = $5
         WHERE id = $1`, [
                jobId,
                stats.processed,
                stats.matched,
                stats.failed,
                error instanceof Error ? error.message : 'Unknown error',
            ]);
            throw error;
        }
        return stats;
    }
    /**
     * Migrate employee_skills with custom_skill_name to ESCO
     */
    async migrateEmployeeSkills(tenantId, confidenceThreshold, batchSize, createCustomSkills) {
        const stats = {
            total: 0,
            processed: 0,
            matched: 0,
            custom_created: 0,
            skipped: 0,
            failed: 0,
        };
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const batch = await this.pool.query(`SELECT id, custom_skill_name, employee_id
         FROM employee_skills
         WHERE tenant_id = $1 AND esco_skill_id IS NULL AND custom_skill_name IS NOT NULL
         ORDER BY id
         LIMIT $2 OFFSET $3`, [tenantId, batchSize, offset]);
            if (batch.rows.length === 0) {
                hasMore = false;
                break;
            }
            stats.total += batch.rows.length;
            for (const row of batch.rows) {
                try {
                    const match = await this.findBestEscoMatch(row.custom_skill_name);
                    if (match && match.confidence >= confidenceThreshold) {
                        // Update with ESCO mapping
                        await this.pool.query(`UPDATE employee_skills SET
               esco_skill_id = $1,
               confidence_score = $2,
               source = 'ai_migration',
               updated_at = NOW()
               WHERE id = $3`, [match.esco_skill_id, match.confidence, row.id]);
                        stats.matched++;
                    }
                    else if (createCustomSkills && match) {
                        // Create as tenant custom skill if below threshold but has a match
                        const customSkillId = await this.createTenantCustomSkill(tenantId, row.custom_skill_name, match.esco_skill_id, match.confidence);
                        // Link employee skill to custom skill (keep custom_skill_name)
                        await this.pool.query(`UPDATE employee_skills SET
               source = 'ai_migration_custom',
               confidence_score = $1,
               notes = COALESCE(notes, '') || ' [Migrated to custom skill: ' || $2 || ']',
               updated_at = NOW()
               WHERE id = $3`, [match.confidence, customSkillId, row.id]);
                        stats.custom_created++;
                    }
                    else {
                        stats.skipped++;
                    }
                    stats.processed++;
                }
                catch (error) {
                    logger.error(`Error migrating employee skill ${row.id}:${error}`);
                    stats.failed++;
                    stats.processed++;
                }
            }
            offset += batchSize;
        }
        return stats;
    }
    /**
     * Migrate extracted_skills to ESCO
     */
    async migrateExtractedSkills(tenantId, confidenceThreshold, batchSize) {
        const stats = {
            total: 0,
            processed: 0,
            matched: 0,
            custom_created: 0,
            skipped: 0,
            failed: 0,
        };
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const batch = await this.pool.query(`SELECT id, raw_text
         FROM extracted_skills
         WHERE tenant_id = $1 AND esco_skill_id IS NULL
         ORDER BY id
         LIMIT $2 OFFSET $3`, [tenantId, batchSize, offset]);
            if (batch.rows.length === 0) {
                hasMore = false;
                break;
            }
            stats.total += batch.rows.length;
            for (const row of batch.rows) {
                try {
                    const match = await this.findBestEscoMatch(row.raw_text);
                    if (match && match.confidence >= confidenceThreshold) {
                        await this.pool.query(`UPDATE extracted_skills SET
               esco_skill_id = $1,
               mapping_confidence = $2
               WHERE id = $3`, [match.esco_skill_id, match.confidence, row.id]);
                        stats.matched++;
                    }
                    else {
                        stats.skipped++;
                    }
                    stats.processed++;
                }
                catch (error) {
                    logger.error(`Error migrating extracted skill ${row.id}:${error}`);
                    stats.failed++;
                    stats.processed++;
                }
            }
            offset += batchSize;
        }
        return stats;
    }
    /**
     * Suggest ESCO mappings for unknown_skills
     */
    async migrateUnknownSkills(tenantId, confidenceThreshold, batchSize) {
        const stats = {
            total: 0,
            processed: 0,
            matched: 0,
            custom_created: 0,
            skipped: 0,
            failed: 0,
        };
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const batch = await this.pool.query(`SELECT id, raw_text
         FROM unknown_skills
         WHERE tenant_id = $1 AND review_status = 'pending' AND mapped_to_esco_id IS NULL
         ORDER BY occurrence_count DESC
         LIMIT $2 OFFSET $3`, [tenantId, batchSize, offset]);
            if (batch.rows.length === 0) {
                hasMore = false;
                break;
            }
            stats.total += batch.rows.length;
            for (const row of batch.rows) {
                try {
                    const match = await this.findBestEscoMatch(row.raw_text);
                    if (match) {
                        // Update with suggestion (doesn't auto-approve)
                        await this.pool.query(`UPDATE unknown_skills SET
               suggested_esco_id = $1,
               suggested_confidence = $2,
               review_status = CASE WHEN $2 >= $4 THEN 'suggested' ELSE 'low_confidence' END,
               last_seen_at = NOW()
               WHERE id = $3`, [match.esco_skill_id, match.confidence, row.id, confidenceThreshold]);
                        if (match.confidence >= confidenceThreshold) {
                            stats.matched++;
                        }
                        else {
                            stats.skipped++;
                        }
                    }
                    else {
                        stats.skipped++;
                    }
                    stats.processed++;
                }
                catch (error) {
                    logger.error(`Error processing unknown skill ${row.id}:${error}`);
                    stats.failed++;
                    stats.processed++;
                }
            }
            offset += batchSize;
        }
        return stats;
    }
    /**
     * Find best ESCO skill match using semantic search
     */
    async findBestEscoMatch(skillText) {
        if (!this.openaiApiKey) {
            // Fallback to text search if no OpenAI key
            return this.findBestEscoMatchByText(skillText);
        }
        try {
            // Generate embedding for the skill text using OpenAI API directly
            const response = await fetch('https://api.openai.com/v1/embeddings', {
                signal: AbortSignal.timeout(30000),
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: EMBEDDING_MODEL,
                    input: skillText.toLowerCase().trim(),
                    dimensions: EMBEDDING_DIMENSIONS,
                }),
            });
            if (!response.ok) {
                const errorData = (await response.json());
                throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
            }
            const data = (await response.json());
            if (!data.data?.[0]?.embedding) {
                throw new Error('No embedding returned from OpenAI API');
            }
            const embedding = data.data[0].embedding;
            const vectorStr = `[${embedding.join(',')}]`;
            // Search in esco_skills using vector similarity
            const result = await this.pool.query(`SELECT id, preferred_label_en,
                1 - (embedding_en <=> $1::vector) as similarity
         FROM esco_skills
         WHERE embedding_en IS NOT NULL
         ORDER BY embedding_en <=> $1::vector
         LIMIT 1`, [vectorStr]);
            if (result.rows.length > 0) {
                return {
                    esco_skill_id: result.rows[0].id,
                    skill_name: result.rows[0].preferred_label_en,
                    confidence: parseFloat(result.rows[0].similarity),
                };
            }
            return null;
        }
        catch (error) {
            logger.error({ err: error }, 'Error in semantic search, falling back to text:');
            return this.findBestEscoMatchByText(skillText);
        }
    }
    /**
     * Fallback text-based matching
     */
    async findBestEscoMatchByText(skillText) {
        const normalizedText = skillText.toLowerCase().trim();
        // Try exact match first
        let result = await this.pool.query(`SELECT id, preferred_label_en, 1.0 as similarity
       FROM esco_skills
       WHERE LOWER(preferred_label_en) = $1
       LIMIT 1`, [normalizedText]);
        if (result.rows.length > 0) {
            return {
                esco_skill_id: result.rows[0].id,
                skill_name: result.rows[0].preferred_label_en,
                confidence: 1.0,
            };
        }
        // Try partial match
        result = await this.pool.query(`SELECT id, preferred_label_en,
              similarity(LOWER(preferred_label_en), $1) as sim
       FROM esco_skills
       WHERE LOWER(preferred_label_en) % $1
       ORDER BY sim DESC
       LIMIT 1`, [normalizedText]);
        if (result.rows.length > 0) {
            return {
                esco_skill_id: result.rows[0].id,
                skill_name: result.rows[0].preferred_label_en,
                confidence: parseFloat(result.rows[0].sim),
            };
        }
        return null;
    }
    /**
     * Create a tenant custom skill linked to nearest ESCO
     */
    async createTenantCustomSkill(tenantId, skillName, nearestEscoId, similarity) {
        // Generate a code from skill name (slug format)
        const code = skillName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);
        const result = await this.pool.query(`INSERT INTO tenant_custom_skills
       (tenant_id, code, name_en, name_it, description_en, description_it, base_esco_skill_id, similarity_score, source, is_active)
       VALUES ($1, $2, $3, $3, $4, $4, $5, $6, 'ai_migration', true)
       ON CONFLICT (tenant_id, code)
       DO UPDATE SET updated_at = NOW()
       RETURNING id`, [
            tenantId,
            code,
            skillName,
            `Custom skill derived from: ${skillName}`,
            nearestEscoId,
            similarity,
        ]);
        return result.rows[0].id;
    }
    /**
     * Get migration job status
     */
    async getJobStatus(jobId) {
        const result = await this.pool.query(`SELECT * FROM skill_migration_jobs WHERE id = $1`, [
            jobId,
        ]);
        if (result.rows.length === 0)
            return null;
        return this.rowToJob(result.rows[0]);
    }
    /**
     * List migration jobs for a tenant
     */
    async listJobs(tenantId, limit = 20, offset = 0) {
        const countResult = await this.pool.query(`SELECT COUNT(*) FROM skill_migration_jobs WHERE tenant_id = $1`, [tenantId]);
        const result = await this.pool.query(`SELECT * FROM skill_migration_jobs
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`, [tenantId, limit, offset]);
        return {
            jobs: result.rows.map(this.rowToJob),
            total: parseInt(countResult.rows[0].count),
        };
    }
    /**
     * Approve unknown skill suggestion
     */
    async approveUnknownSkillMapping(skillId, approvedBy, usesuggested = true, overrideEscoId) {
        const escoId = overrideEscoId ||
            (usesuggested
                ? (await this.pool.query(`SELECT suggested_esco_id FROM unknown_skills WHERE id = $1`, [
                    skillId,
                ])).rows[0]?.suggested_esco_id
                : null);
        if (!escoId) {
            throw new Error('No ESCO skill ID to approve');
        }
        await this.pool.query(`UPDATE unknown_skills SET
       mapped_to_esco_id = $1,
       review_status = 'approved',
       reviewed_by = $2,
       reviewed_at = NOW()
       WHERE id = $3`, [escoId, approvedBy, skillId]);
    }
    /**
     * Reject unknown skill suggestion
     */
    async rejectUnknownSkillMapping(skillId, reviewedBy) {
        await this.pool.query(`UPDATE unknown_skills SET
       review_status = 'rejected',
       reviewed_by = $1,
       reviewed_at = NOW()
       WHERE id = $2`, [reviewedBy, skillId]);
    }
    /**
     * Get migration summary for a tenant
     */
    async getMigrationSummary(tenantId) {
        const [empSkills, extSkills, unkSkills, customSkills] = await Promise.all([
            this.pool.query(`SELECT
          COUNT(*) as total,
          COUNT(esco_skill_id) as mapped,
          COUNT(*) - COUNT(esco_skill_id) as unmapped
         FROM employee_skills WHERE tenant_id = $1`, [tenantId]),
            this.pool.query(`SELECT
          COUNT(*) as total,
          COUNT(esco_skill_id) as mapped,
          COUNT(*) - COUNT(esco_skill_id) as unmapped
         FROM extracted_skills WHERE tenant_id = $1`, [tenantId]),
            this.pool.query(`SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE review_status = 'approved') as approved,
          COUNT(*) FILTER (WHERE review_status = 'pending' OR review_status = 'suggested' OR review_status = 'low_confidence') as pending,
          COUNT(*) FILTER (WHERE review_status = 'rejected') as rejected
         FROM unknown_skills WHERE tenant_id = $1`, [tenantId]),
            this.pool.query(`SELECT COUNT(*) FROM tenant_custom_skills WHERE tenant_id = $1`, [tenantId]),
        ]);
        return {
            employee_skills: {
                total: parseInt(empSkills.rows[0].total),
                mapped: parseInt(empSkills.rows[0].mapped),
                unmapped: parseInt(empSkills.rows[0].unmapped),
            },
            extracted_skills: {
                total: parseInt(extSkills.rows[0].total),
                mapped: parseInt(extSkills.rows[0].mapped),
                unmapped: parseInt(extSkills.rows[0].unmapped),
            },
            unknown_skills: {
                total: parseInt(unkSkills.rows[0].total),
                approved: parseInt(unkSkills.rows[0].approved),
                pending: parseInt(unkSkills.rows[0].pending),
                rejected: parseInt(unkSkills.rows[0].rejected),
            },
            custom_skills: parseInt(customSkills.rows[0].count),
        };
    }
    // Helper methods
    rowToJob(row) {
        return {
            id: row.id,
            tenant_id: row.tenant_id,
            job_type: row.job_type,
            status: row.status,
            total_records: row.total_records,
            processed_records: row.processed_records,
            matched_records: row.matched_records,
            failed_records: row.failed_records,
            created_at: row.created_at,
            started_at: row.started_at,
            completed_at: row.completed_at,
            error_message: row.error_message,
        };
    }
    mergeStats(target, source) {
        target.total += source.total;
        target.processed += source.processed;
        target.matched += source.matched;
        target.custom_created += source.custom_created;
        target.skipped += source.skipped;
        target.failed += source.failed;
    }
}
export default LegacySkillMigrationService;
//# sourceMappingURL=legacy-skill-migration.js.map