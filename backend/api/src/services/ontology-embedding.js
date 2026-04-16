/**
 * Ontology Embedding Service
 * Specialized embedding generation and vector search for skill ontology
 * Epic: E-ONTO-01 (Ontology Foundation)
 * Story: S-ONTO-01-08 (Basic Semantic Search)
 * Created: 2025-12-22
 */
import { pool } from '../config/database.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { logger } from '../config/logger.js';
// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================
const DEFAULT_CONFIGS = {
    openai: {
        provider: 'openai',
        model: 'text-embedding-ada-002', // 1536 dimensions, most compatible
        dimensions: 1536,
        batchSize: 100, // OpenAI allows up to 2048 inputs
        rateLimitDelay: 100,
    },
    gemini: {
        provider: 'gemini',
        model: 'text-embedding-004',
        dimensions: 768,
        batchSize: 50,
        rateLimitDelay: 200,
    },
};
// Cost per 1000 tokens (approximate USD)
const TOKEN_COSTS = {
    'text-embedding-ada-002': 0.0001,
    'text-embedding-3-small': 0.00002,
    'text-embedding-3-large': 0.00013,
    'text-embedding-004': 0.000025,
};
// =============================================================================
// ONTOLOGY EMBEDDING SERVICE
// =============================================================================
export class OntologyEmbeddingService {
    config;
    constructor(provider = 'openai') {
        this.config = { ...DEFAULT_CONFIGS[provider] };
    }
    // ---------------------------------------------------------------------------
    // CONFIGURATION
    // ---------------------------------------------------------------------------
    setApiKey(apiKey) {
        this.config.apiKey = apiKey;
    }
    async loadApiKeyFromDb(tenantId) {
        // Try tenant-specific key first, then global
        const result = await pool.query(`
      SELECT api_key_encrypted
      FROM rag_provider_keys
      WHERE provider = $1
        AND is_valid = true
        ${tenantId ? 'AND tenant_id = $2' : 'AND tenant_id IS NULL'}
      ORDER BY created_at DESC
      LIMIT 1
    `, tenantId ? [this.config.provider, tenantId] : [this.config.provider]);
        if (result.rows.length > 0) {
            // In production, decrypt the key here
            this.config.apiKey = result.rows[0].api_key_encrypted;
            return true;
        }
        return false;
    }
    // ---------------------------------------------------------------------------
    // SINGLE EMBEDDING GENERATION
    // ---------------------------------------------------------------------------
    async generateEmbedding(text) {
        if (!this.config.apiKey) {
            throw new Error('API key not configured. Call setApiKey() or loadApiKeyFromDb() first.');
        }
        switch (this.config.provider) {
            case 'openai':
                return this.openAIEmbedding(text);
            case 'gemini':
                return this.geminiEmbedding(text);
            default:
                throw new Error(`Unsupported embedding provider: ${this.config.provider}`);
        }
    }
    async openAIEmbedding(text) {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            signal: AbortSignal.timeout(30000),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                input: text,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI Embedding API error: ${error}`);
        }
        const data = (await response.json());
        const embedding = data.data[0]?.embedding;
        if (!embedding) {
            throw new Error('No embedding returned from OpenAI API');
        }
        return {
            embedding,
            model: this.config.model,
            tokensUsed: data.usage.total_tokens,
        };
    }
    async geminiEmbedding(text) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:embedContent?key=${this.config.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: `models/${this.config.model}`,
                content: { parts: [{ text }] },
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini Embedding API error: ${error}`);
        }
        const data = (await response.json());
        // Gemini doesn't return token count, estimate based on text length
        const estimatedTokens = Math.ceil(text.length / 4);
        return {
            embedding: data.embedding.values,
            model: this.config.model,
            tokensUsed: estimatedTokens,
        };
    }
    // ---------------------------------------------------------------------------
    // BATCH EMBEDDING GENERATION
    // ---------------------------------------------------------------------------
    async generateBatchEmbeddings(texts) {
        if (!this.config.apiKey) {
            throw new Error('API key not configured');
        }
        const embeddings = [];
        let totalTokens = 0;
        let successCount = 0;
        let failedCount = 0;
        // Process in batches
        for (let i = 0; i < texts.length; i += this.config.batchSize) {
            const batch = texts.slice(i, i + this.config.batchSize);
            try {
                if (this.config.provider === 'openai') {
                    const result = await this.openAIBatchEmbedding(batch);
                    embeddings.push(...result.embeddings);
                    totalTokens += result.tokens;
                    successCount += batch.length;
                }
                else {
                    // Gemini doesn't support batch, process individually
                    for (const text of batch) {
                        try {
                            const result = await this.geminiEmbedding(text);
                            embeddings.push(result.embedding);
                            totalTokens += result.tokensUsed;
                            successCount++;
                        }
                        catch {
                            embeddings.push([]); // Empty placeholder
                            failedCount++;
                        }
                    }
                }
            }
            catch {
                // Mark entire batch as failed
                for (let j = 0; j < batch.length; j++) {
                    embeddings.push([]);
                }
                failedCount += batch.length;
            }
            // Rate limiting between batches
            if (i + this.config.batchSize < texts.length) {
                await this.delay(this.config.rateLimitDelay);
            }
        }
        return {
            embeddings,
            model: this.config.model,
            totalTokens,
            successCount,
            failedCount,
        };
    }
    async openAIBatchEmbedding(texts) {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            signal: AbortSignal.timeout(30000),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                input: texts,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI Batch Embedding API error: ${error}`);
        }
        const data = (await response.json());
        // Sort by index to maintain order
        const sorted = data.data.sort((a, b) => a.index - b.index);
        return {
            embeddings: sorted.map((d) => d.embedding),
            tokens: data.usage.total_tokens,
        };
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    // ---------------------------------------------------------------------------
    // VECTOR SEARCH
    // ---------------------------------------------------------------------------
    async searchSkillsByVector(options) {
        // Generate embedding for query
        const queryResult = await this.generateEmbedding(options.query);
        const queryVector = queryResult.embedding;
        // Format vector for PostgreSQL
        const vectorStr = `[${queryVector.join(',')}]`;
        const embeddingColumn = options.language === 'it' ? 'embedding_it' : 'embedding_en';
        const labelColumn = options.language === 'it' ? 'preferred_label_it' : 'preferred_label_en';
        const descColumn = options.language === 'it' ? 'description_it' : 'description_en';
        // Build WHERE conditions
        const conditions = [`${embeddingColumn} IS NOT NULL`];
        const params = [vectorStr, options.limit];
        let paramIndex = 3;
        if (options.skillType) {
            conditions.push(`skill_type = $${paramIndex}`);
            params.push(options.skillType);
            paramIndex++;
        }
        if (options.isDigital !== undefined) {
            conditions.push(`is_digital = $${paramIndex}`);
            params.push(options.isDigital);
            paramIndex++;
        }
        if (options.isGreen !== undefined) {
            conditions.push(`is_green = $${paramIndex}`);
            params.push(options.isGreen);
            paramIndex++;
        }
        if (options.isTransversal !== undefined) {
            conditions.push(`is_transversal = $${paramIndex}`);
            params.push(options.isTransversal);
            paramIndex++;
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        // Vector similarity search using pgvector's <=> operator (cosine distance)
        // Similarity = 1 - distance
        const escoQuery = `
      SELECT
        id,
        ${labelColumn} as preferred_label,
        COALESCE(alt_labels_en, '{}') as alt_labels,
        COALESCE(${descColumn}, description_en) as description,
        skill_type,
        1 - (${embeddingColumn} <=> $1::vector) as similarity,
        'esco' as source
      FROM esco_skills
      ${whereClause}
      ORDER BY ${embeddingColumn} <=> $1::vector
      LIMIT $2
    `;
        const results = [];
        try {
            const escoResult = await pool.query(escoQuery, params);
            for (const row of escoResult.rows) {
                // Filter by similarity threshold
                if (row.similarity >= options.similarityThreshold) {
                    results.push({
                        id: row.id,
                        preferredLabel: row.preferred_label || '',
                        altLabels: row.alt_labels || [],
                        description: row.description || '',
                        skillType: row.skill_type || 'skill',
                        similarity: parseFloat(row.similarity.toFixed(4)),
                        source: 'esco',
                    });
                }
            }
        }
        catch (error) {
            // If vector search fails (e.g., no embeddings), fall back to text search
            logger.error({ err: error }, 'Vector search failed, falling back to text search:');
            return this.fallbackTextSearch(options);
        }
        // Include tenant custom skills if requested
        if (options.includeCustomSkills && options.tenantId) {
            const customResults = await this.searchCustomSkillsByVector(vectorStr, options.tenantId, options.language, options.limit, options.similarityThreshold);
            results.push(...customResults);
            // Re-sort combined results by similarity
            results.sort((a, b) => b.similarity - a.similarity);
        }
        return results.slice(0, options.limit);
    }
    async searchCustomSkillsByVector(vectorStr, tenantId, language, limit, threshold) {
        const embeddingColumn = language === 'it' ? 'embedding_it' : 'embedding_en';
        const nameColumn = language === 'it' ? 'name_it' : 'name_en';
        const descColumn = language === 'it' ? 'description_it' : 'description_en';
        const query = `
      SELECT
        id,
        COALESCE(${nameColumn}, name_en) as name,
        COALESCE(${descColumn}, description_en) as description,
        skill_type,
        1 - (${embeddingColumn} <=> $1::vector) as similarity
      FROM tenant_custom_skills
      WHERE tenant_id = $2
        AND is_active = true
        AND ${embeddingColumn} IS NOT NULL
      ORDER BY ${embeddingColumn} <=> $1::vector
      LIMIT $3
    `;
        const result = await pool.query(query, [vectorStr, tenantId, limit]);
        return result.rows
            .filter((row) => row.similarity >= threshold)
            .map((row) => ({
            id: row.id,
            preferredLabel: row.name,
            altLabels: [],
            description: row.description || '',
            skillType: row.skill_type,
            similarity: parseFloat(row.similarity.toFixed(4)),
            source: 'tenant_custom',
        }));
    }
    async fallbackTextSearch(options) {
        const labelColumn = options.language === 'it' ? 'preferred_label_it' : 'preferred_label_en';
        const descColumn = options.language === 'it' ? 'description_it' : 'description_en';
        const conditions = [];
        const params = [
            `%${escapeILIKE(options.query)}%`,
            options.limit,
        ];
        let paramIndex = 3;
        if (options.skillType) {
            conditions.push(`skill_type = $${paramIndex}`);
            params.push(options.skillType);
            paramIndex++;
        }
        const whereExtra = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
        const query = `
      SELECT
        id,
        ${labelColumn} as preferred_label,
        COALESCE(alt_labels_en, '{}') as alt_labels,
        COALESCE(${descColumn}, description_en) as description,
        skill_type,
        CASE
          WHEN LOWER(${labelColumn}) = LOWER($1) THEN 1.0
          WHEN LOWER(${labelColumn}) LIKE LOWER($1) THEN 0.9
          ELSE 0.7
        END as similarity,
        'esco' as source
      FROM esco_skills
      WHERE (
        ${labelColumn} ILIKE $1
        OR ${descColumn} ILIKE $1
        OR EXISTS (SELECT 1 FROM unnest(alt_labels_en) AS alt WHERE alt ILIKE $1)
      )
      ${whereExtra}
      ORDER BY
        CASE WHEN LOWER(${labelColumn}) = LOWER($1) THEN 0 ELSE 1 END,
        ${labelColumn}
      LIMIT $2
    `;
        const result = await pool.query(query, params);
        return result.rows.map((row) => ({
            id: row.id,
            preferredLabel: row.preferred_label || '',
            altLabels: row.alt_labels || [],
            description: row.description || '',
            skillType: row.skill_type || 'skill',
            similarity: parseFloat(row.similarity),
            source: 'esco',
        }));
    }
    // ---------------------------------------------------------------------------
    // EMBEDDING JOB MANAGEMENT
    // ---------------------------------------------------------------------------
    async createEmbeddingJob(targetTable, jobType, tenantId) {
        // Count items to process
        let countQuery;
        const countParams = [];
        if (targetTable === 'industry_classifications') {
            if (jobType === 'full') {
                countQuery = 'SELECT COUNT(*) FROM industry_classifications WHERE is_active = TRUE';
            }
            else {
                countQuery =
                    'SELECT COUNT(*) FROM industry_classifications WHERE is_active = TRUE AND (embedding_en IS NULL OR embedding_it IS NULL)';
            }
        }
        else if (targetTable === 'esco_skills') {
            if (jobType === 'full') {
                countQuery = 'SELECT COUNT(*) FROM esco_skills';
            }
            else {
                countQuery =
                    'SELECT COUNT(*) FROM esco_skills WHERE embedding_en IS NULL OR embedding_it IS NULL';
            }
        }
        else {
            if (!tenantId)
                throw new Error('tenantId required for tenant_custom_skills');
            if (jobType === 'full') {
                countQuery =
                    'SELECT COUNT(*) FROM tenant_custom_skills WHERE tenant_id = $1 AND is_active = true';
            }
            else {
                countQuery =
                    'SELECT COUNT(*) FROM tenant_custom_skills WHERE tenant_id = $1 AND is_active = true AND embedding_en IS NULL';
            }
            countParams.push(tenantId);
        }
        const countResult = await pool.query(countQuery, countParams);
        const totalItems = parseInt(countResult.rows[0].count, 10);
        // Estimate cost (rough estimate: ~50 tokens per skill text)
        const estimatedTokens = totalItems * 50 * 2; // *2 for en + it
        const costPerToken = TOKEN_COSTS[this.config.model] || 0.0001;
        const estimatedCost = (estimatedTokens / 1000) * costPerToken;
        // Create job record
        const result = await pool.query(`
      INSERT INTO ontology_embedding_jobs (
        job_type, target_table, tenant_id, status,
        total_items, provider, model, estimated_cost
      ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
      RETURNING id
    `, [
            jobType,
            targetTable,
            tenantId || null,
            totalItems,
            this.config.provider,
            this.config.model,
            estimatedCost,
        ]);
        return result.rows[0].id;
    }
    async getJobStatus(jobId) {
        const result = await pool.query(`
      SELECT
        id, status, total_items, processed_items, failed_items,
        tokens_used, estimated_cost
      FROM ontology_embedding_jobs
      WHERE id = $1
    `, [jobId]);
        if (result.rows.length === 0) {
            throw new Error(`Job not found: ${jobId}`);
        }
        const row = result.rows[0];
        return {
            jobId: row.id,
            status: row.status,
            totalItems: row.total_items,
            processedItems: row.processed_items,
            failedItems: row.failed_items,
            tokensUsed: row.tokens_used,
            estimatedCost: parseFloat(row.estimated_cost),
        };
    }
    async processEmbeddingJob(jobId) {
        // Get job details
        const jobResult = await pool.query(`
      SELECT * FROM ontology_embedding_jobs WHERE id = $1
    `, [jobId]);
        if (jobResult.rows.length === 0) {
            throw new Error(`Job not found: ${jobId}`);
        }
        const job = jobResult.rows[0];
        if (job.status !== 'pending') {
            throw new Error(`Job is not in pending status: ${job.status}`);
        }
        // Mark as processing
        await pool.query(`
      UPDATE ontology_embedding_jobs
      SET status = 'processing', started_at = NOW()
      WHERE id = $1
    `, [jobId]);
        try {
            let processed = 0;
            let failed = 0;
            let totalTokens = 0;
            if (job.target_table === 'industry_classifications') {
                const result = await this.processIndustryClassificationsEmbeddings(job.job_type, jobId, (p, f, t) => {
                    processed = p;
                    failed = f;
                    totalTokens = t;
                });
                processed = result.processed;
                failed = result.failed;
                totalTokens = result.tokens;
            }
            else if (job.target_table === 'esco_skills') {
                const result = await this.processEscoSkillsEmbeddings(job.job_type, jobId, (p, f, t) => {
                    processed = p;
                    failed = f;
                    totalTokens = t;
                });
                processed = result.processed;
                failed = result.failed;
                totalTokens = result.tokens;
            }
            else if (job.target_table === 'tenant_custom_skills' && job.tenant_id) {
                const result = await this.processTenantSkillsEmbeddings(job.tenant_id, job.job_type, jobId, (p, f, t) => {
                    processed = p;
                    failed = f;
                    totalTokens = t;
                });
                processed = result.processed;
                failed = result.failed;
                totalTokens = result.tokens;
            }
            // Mark as completed
            await pool.query(`
        UPDATE ontology_embedding_jobs
        SET status = 'completed', completed_at = NOW(),
            processed_items = $2, failed_items = $3, tokens_used = $4
        WHERE id = $1
      `, [jobId, processed, failed, totalTokens]);
            return this.getJobStatus(jobId);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await pool.query(`
        UPDATE ontology_embedding_jobs
        SET status = 'failed', last_error = $2
        WHERE id = $1
      `, [jobId, errorMessage]);
            throw error;
        }
    }
    async processEscoSkillsEmbeddings(jobType, jobId, onProgress) {
        const batchSize = this.config.batchSize;
        let offset = 0;
        let processed = 0;
        let failed = 0;
        let totalTokens = 0;
        const whereClause = jobType === 'incremental' ? 'WHERE embedding_en IS NULL OR embedding_it IS NULL' : '';
        while (true) {
            const skillsResult = await pool.query(`
        SELECT id, preferred_label_en, preferred_label_it, description_en, description_it
        FROM esco_skills
        ${whereClause}
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);
            if (skillsResult.rows.length === 0)
                break;
            // Prepare texts for batch embedding
            const textsEn = [];
            const textsIt = [];
            const skillIds = [];
            for (const skill of skillsResult.rows) {
                const textEn = `${skill.preferred_label_en || ''}. ${skill.description_en || ''}`.trim();
                const textIt = `${skill.preferred_label_it || skill.preferred_label_en || ''}. ${skill.description_it || skill.description_en || ''}`.trim();
                textsEn.push(textEn || 'No description');
                textsIt.push(textIt || textEn || 'No description');
                skillIds.push(skill.id);
            }
            // Generate embeddings
            try {
                const embeddingsEn = await this.generateBatchEmbeddings(textsEn);
                const embeddingsIt = await this.generateBatchEmbeddings(textsIt);
                // Update database
                for (let i = 0; i < skillIds.length; i++) {
                    const embEn = embeddingsEn.embeddings[i];
                    const embIt = embeddingsIt.embeddings[i];
                    if (embEn && embEn.length > 0 && embIt && embIt.length > 0) {
                        await pool.query(`
              UPDATE esco_skills
              SET embedding_en = $2::vector,
                  embedding_it = $3::vector,
                  embedding_model = $4,
                  embedding_generated_at = NOW()
              WHERE id = $1
            `, [skillIds[i], `[${embEn.join(',')}]`, `[${embIt.join(',')}]`, this.config.model]);
                        processed++;
                    }
                    else {
                        failed++;
                    }
                }
                totalTokens += embeddingsEn.totalTokens + embeddingsIt.totalTokens;
                onProgress(processed, failed, totalTokens);
                // Update job progress
                await pool.query(`
          UPDATE ontology_embedding_jobs
          SET processed_items = $2, failed_items = $3, tokens_used = $4
          WHERE id = $1
        `, [jobId, processed, failed, totalTokens]);
            }
            catch (error) {
                logger.error(`Batch embedding failed at offset ${offset}:${error}`);
                failed += skillsResult.rows.length;
            }
            offset += batchSize;
            await this.delay(this.config.rateLimitDelay);
        }
        return { processed, failed, tokens: totalTokens };
    }
    async processTenantSkillsEmbeddings(tenantId, jobType, jobId, onProgress) {
        const batchSize = this.config.batchSize;
        let offset = 0;
        let processed = 0;
        let failed = 0;
        let totalTokens = 0;
        const whereClause = jobType === 'incremental' ? 'AND (embedding_en IS NULL)' : '';
        while (true) {
            const skillsResult = await pool.query(`
        SELECT id, name_en, name_it, description_en, description_it
        FROM tenant_custom_skills
        WHERE tenant_id = $1 AND is_active = true ${whereClause}
        ORDER BY id
        LIMIT $2 OFFSET $3
      `, [tenantId, batchSize, offset]);
            if (skillsResult.rows.length === 0)
                break;
            const textsEn = [];
            const textsIt = [];
            const skillIds = [];
            for (const skill of skillsResult.rows) {
                const textEn = `${skill.name_en || ''}. ${skill.description_en || ''}`.trim();
                const textIt = `${skill.name_it || skill.name_en || ''}. ${skill.description_it || skill.description_en || ''}`.trim();
                textsEn.push(textEn || 'No description');
                textsIt.push(textIt || textEn || 'No description');
                skillIds.push(skill.id);
            }
            try {
                const embeddingsEn = await this.generateBatchEmbeddings(textsEn);
                const embeddingsIt = await this.generateBatchEmbeddings(textsIt);
                for (let i = 0; i < skillIds.length; i++) {
                    const embEn = embeddingsEn.embeddings[i];
                    const embIt = embeddingsIt.embeddings[i];
                    if (embEn && embEn.length > 0 && embIt && embIt.length > 0) {
                        await pool.query(`
              UPDATE tenant_custom_skills
              SET embedding_en = $2::vector,
                  embedding_it = $3::vector,
                  embedding_model = $4,
                  embedding_generated_at = NOW()
              WHERE id = $1
            `, [skillIds[i], `[${embEn.join(',')}]`, `[${embIt.join(',')}]`, this.config.model]);
                        processed++;
                    }
                    else {
                        failed++;
                    }
                }
                totalTokens += embeddingsEn.totalTokens + embeddingsIt.totalTokens;
                onProgress(processed, failed, totalTokens);
                await pool.query(`
          UPDATE ontology_embedding_jobs
          SET processed_items = $2, failed_items = $3, tokens_used = $4
          WHERE id = $1
        `, [jobId, processed, failed, totalTokens]);
            }
            catch (error) {
                logger.error(`Batch embedding failed at offset ${offset}:${error}`);
                failed += skillsResult.rows.length;
            }
            offset += batchSize;
            await this.delay(this.config.rateLimitDelay);
        }
        return { processed, failed, tokens: totalTokens };
    }
    // ---------------------------------------------------------------------------
    // INDUSTRY CLASSIFICATIONS EMBEDDING
    // ---------------------------------------------------------------------------
    async processIndustryClassificationsEmbeddings(jobType, jobId, onProgress) {
        const batchSize = this.config.batchSize;
        let offset = 0;
        let processed = 0;
        let failed = 0;
        let totalTokens = 0;
        const whereClause = jobType === 'incremental'
            ? 'WHERE is_active = TRUE AND (embedding_en IS NULL OR embedding_it IS NULL)'
            : 'WHERE is_active = TRUE';
        while (true) {
            const icResult = await pool.query(`
        SELECT code, name_it, name_en
        FROM industry_classifications
        ${whereClause}
        ORDER BY level, code
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);
            if (icResult.rows.length === 0)
                break;
            const textsEn = [];
            const textsIt = [];
            const codes = [];
            for (const row of icResult.rows) {
                const nameIt = (row.name_it || '').trim();
                const nameEn = (row.name_en || '').trim();
                textsEn.push(nameEn || nameIt || 'No description');
                textsIt.push(nameIt || nameEn || 'No description');
                codes.push(row.code);
            }
            try {
                const embeddingsEn = await this.generateBatchEmbeddings(textsEn);
                const embeddingsIt = await this.generateBatchEmbeddings(textsIt);
                for (let i = 0; i < codes.length; i++) {
                    const embEn = embeddingsEn.embeddings[i];
                    const embIt = embeddingsIt.embeddings[i];
                    if (embEn && embEn.length > 0 && embIt && embIt.length > 0) {
                        await pool.query(`
              UPDATE industry_classifications
              SET embedding_en = $2::vector,
                  embedding_it = $3::vector,
                  embedding_model = $4,
                  embedding_generated_at = NOW()
              WHERE code = $1
            `, [codes[i], `[${embEn.join(',')}]`, `[${embIt.join(',')}]`, this.config.model]);
                        processed++;
                    }
                    else {
                        failed++;
                    }
                }
                totalTokens += embeddingsEn.totalTokens + embeddingsIt.totalTokens;
                onProgress(processed, failed, totalTokens);
                await pool.query(`
          UPDATE ontology_embedding_jobs
          SET processed_items = $2, failed_items = $3, tokens_used = $4
          WHERE id = $1
        `, [jobId, processed, failed, totalTokens]);
            }
            catch (error) {
                logger.error(`Industry classifications batch embedding failed at offset ${offset}:${error}`);
                failed += icResult.rows.length;
            }
            offset += batchSize;
            await this.delay(this.config.rateLimitDelay);
        }
        return { processed, failed, tokens: totalTokens };
    }
    // ---------------------------------------------------------------------------
    // SIMILARITY INFERENCE
    // ---------------------------------------------------------------------------
    async inferSkillRelations(similarityThreshold = 0.85, limit = 1000) {
        // Create inference job
        const jobResult = await pool.query(`
      INSERT INTO ontology_inference_jobs (
        job_type, status, similarity_threshold
      ) VALUES ('full_inference', 'processing', $1)
      RETURNING id
    `, [similarityThreshold]);
        const jobId = jobResult.rows[0].id;
        try {
            // Find similar skill pairs using vector similarity
            const pairsResult = await pool.query(`
        SELECT
          a.id as source_id,
          b.id as target_id,
          1 - (a.embedding_en <=> b.embedding_en) as similarity
        FROM esco_skills a
        CROSS JOIN esco_skills b
        WHERE a.id < b.id
          AND a.embedding_en IS NOT NULL
          AND b.embedding_en IS NOT NULL
          AND (1 - (a.embedding_en <=> b.embedding_en)) >= $1
        ORDER BY similarity DESC
        LIMIT $2
      `, [similarityThreshold, limit]);
            let relationsFound = 0;
            for (const pair of pairsResult.rows) {
                // Insert relation if not exists
                await pool.query(`
          INSERT INTO ontology_skill_relations (
            source_skill_id, target_skill_id, relation_type,
            strength, source, confidence, model_version, inference_date,
            approval_status
          ) VALUES ($1, $2, 'similar_to', $3, 'ai_inferred', $3, $4, NOW(), 'pending')
          ON CONFLICT (source_skill_id, target_skill_id, relation_type) DO NOTHING
        `, [pair.source_id, pair.target_id, pair.similarity, this.config.model]);
                relationsFound++;
            }
            // Update job as completed
            await pool.query(`
        UPDATE ontology_inference_jobs
        SET status = 'completed', completed_at = NOW(),
            processed_pairs = $2, relations_found = $3
        WHERE id = $1
      `, [jobId, pairsResult.rows.length, relationsFound]);
            return { relationsFound, jobId };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await pool.query(`
        UPDATE ontology_inference_jobs
        SET status = 'failed', error = $2
        WHERE id = $1
      `, [jobId, errorMessage]);
            throw error;
        }
    }
}
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
export function createOntologyEmbeddingService(provider = 'openai') {
    return new OntologyEmbeddingService(provider);
}
export default OntologyEmbeddingService;
//# sourceMappingURL=ontology-embedding.js.map