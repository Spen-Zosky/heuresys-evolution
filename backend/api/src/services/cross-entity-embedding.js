/**
 * Cross-Entity Embedding Service
 * Extends ontology embedding to support multiple entity types for semantic search
 * Epic: E-ONTO-01 (Ontology Foundation)
 * Feature: Cross-Entity Semantic Search
 * Created: 2025-12-22
 */
import { pool } from '../config/database.js';
import { OntologyEmbeddingService } from './ontology-embedding.js';
import { validateTableName, validateEmbeddingColumn } from '../utils/sql-safety.js';
import { logger } from '../config/logger.js';
// =============================================================================
// CROSS-ENTITY EMBEDDING SERVICE
// =============================================================================
export class CrossEntityEmbeddingService extends OntologyEmbeddingService {
    // ---------------------------------------------------------------------------
    // ENTITY-SPECIFIC EMBEDDING GENERATION
    // ---------------------------------------------------------------------------
    async generateEntityEmbeddings(config) {
        switch (config.entityType) {
            case 'occupations':
                return this.processOccupationsEmbeddings(config.jobType);
            case 'jobs':
                return this.processJobTemplatesEmbeddings(config.jobType);
            case 'courses':
                return this.processCoursesEmbeddings(config.jobType);
            case 'goals':
                return this.processGoalsEmbeddings(config.jobType, config.tenantId);
            case 'industry_classifications_l1':
            case 'industry_classifications_l2':
            case 'industry_classifications_l3':
                return this.processNaceEmbeddings(config.entityType, config.jobType);
            default:
                throw new Error(`Unsupported entity type: ${config.entityType}`);
        }
    }
    async processOccupationsEmbeddings(jobType) {
        const batchSize = 100;
        let offset = 0;
        let processed = 0;
        let failed = 0;
        let totalTokens = 0;
        const whereClause = jobType === 'incremental' ? 'WHERE embedding_en IS NULL OR embedding_it IS NULL' : '';
        while (true) {
            const result = await pool.query(`
        SELECT id, preferred_label_en, preferred_label_it,
               description_en, description_it, definition, scope_note
        FROM esco_occupations
        ${whereClause}
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);
            if (result.rows.length === 0)
                break;
            const textsEn = [];
            const textsIt = [];
            const ids = [];
            for (const row of result.rows) {
                const textEn = [row.preferred_label_en, row.description_en, row.definition, row.scope_note]
                    .filter(Boolean)
                    .join('. ');
                const textIt = [
                    row.preferred_label_it || row.preferred_label_en,
                    row.description_it || row.description_en,
                    row.definition,
                    row.scope_note,
                ]
                    .filter(Boolean)
                    .join('. ');
                textsEn.push(textEn || 'No description');
                textsIt.push(textIt || textEn || 'No description');
                ids.push(row.id);
            }
            try {
                const embeddingsEn = await this.generateBatchEmbeddings(textsEn);
                const embeddingsIt = await this.generateBatchEmbeddings(textsIt);
                for (let i = 0; i < ids.length; i++) {
                    const embEn = embeddingsEn.embeddings[i];
                    const embIt = embeddingsIt.embeddings[i];
                    if (embEn && embEn.length > 0 && embIt && embIt.length > 0) {
                        await pool.query(`
              UPDATE esco_occupations
              SET embedding_en = $2::vector,
                  embedding_it = $3::vector,
                  embedding_model = $4,
                  embedding_generated_at = NOW()
              WHERE id = $1
            `, [ids[i], `[${embEn.join(',')}]`, `[${embIt.join(',')}]`, 'text-embedding-3-small']);
                        processed++;
                    }
                    else {
                        failed++;
                    }
                }
                totalTokens += embeddingsEn.totalTokens + embeddingsIt.totalTokens;
            }
            catch (error) {
                logger.error(`Occupation batch failed at offset ${offset}:${error}`);
                failed += result.rows.length;
            }
            offset += batchSize;
            await this.waitMs(100);
        }
        return { processed, failed, tokens: totalTokens };
    }
    async processJobTemplatesEmbeddings(jobType) {
        const batchSize = 100;
        let offset = 0;
        let processed = 0;
        let failed = 0;
        let totalTokens = 0;
        const whereClause = jobType === 'incremental' ? 'WHERE embedding_en IS NULL OR embedding_it IS NULL' : '';
        while (true) {
            const result = await pool.query(`
        SELECT id, title_en, title_it, description, summary
        FROM job_templates
        ${whereClause}
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);
            if (result.rows.length === 0)
                break;
            const textsEn = [];
            const textsIt = [];
            const ids = [];
            for (const row of result.rows) {
                const textEn = [row.title_en, row.description, row.summary].filter(Boolean).join('. ');
                const textIt = [row.title_it || row.title_en, row.description, row.summary]
                    .filter(Boolean)
                    .join('. ');
                textsEn.push(textEn || 'No description');
                textsIt.push(textIt || textEn || 'No description');
                ids.push(row.id);
            }
            try {
                const embeddingsEn = await this.generateBatchEmbeddings(textsEn);
                const embeddingsIt = await this.generateBatchEmbeddings(textsIt);
                for (let i = 0; i < ids.length; i++) {
                    const embEn = embeddingsEn.embeddings[i];
                    const embIt = embeddingsIt.embeddings[i];
                    if (embEn && embEn.length > 0 && embIt && embIt.length > 0) {
                        await pool.query(`
              UPDATE job_templates
              SET embedding_en = $2::vector,
                  embedding_it = $3::vector,
                  embedding_model = $4,
                  embedding_generated_at = NOW()
              WHERE id = $1
            `, [ids[i], `[${embEn.join(',')}]`, `[${embIt.join(',')}]`, 'text-embedding-3-small']);
                        processed++;
                    }
                    else {
                        failed++;
                    }
                }
                totalTokens += embeddingsEn.totalTokens + embeddingsIt.totalTokens;
            }
            catch (error) {
                logger.error(`Job templates batch failed at offset ${offset}:${error}`);
                failed += result.rows.length;
            }
            offset += batchSize;
            await this.waitMs(100);
        }
        return { processed, failed, tokens: totalTokens };
    }
    async processCoursesEmbeddings(jobType) {
        const batchSize = 50;
        let offset = 0;
        let processed = 0;
        let failed = 0;
        let totalTokens = 0;
        const whereClause = jobType === 'incremental' ? 'WHERE embedding_en IS NULL OR embedding_it IS NULL' : '';
        while (true) {
            const result = await pool.query(`
        SELECT id, title, title_en, description, description_en, category, provider
        FROM courses
        ${whereClause}
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);
            if (result.rows.length === 0)
                break;
            const textsEn = [];
            const textsIt = [];
            const ids = [];
            for (const row of result.rows) {
                const textEn = [
                    row.title_en || row.title,
                    row.description_en || row.description,
                    row.category,
                    row.provider,
                ]
                    .filter(Boolean)
                    .join('. ');
                const textIt = [
                    row.title || row.title_en,
                    row.description || row.description_en,
                    row.category,
                    row.provider,
                ]
                    .filter(Boolean)
                    .join('. ');
                textsEn.push(textEn || 'No description');
                textsIt.push(textIt || textEn || 'No description');
                ids.push(row.id);
            }
            try {
                const embeddingsEn = await this.generateBatchEmbeddings(textsEn);
                const embeddingsIt = await this.generateBatchEmbeddings(textsIt);
                for (let i = 0; i < ids.length; i++) {
                    const embEn = embeddingsEn.embeddings[i];
                    const embIt = embeddingsIt.embeddings[i];
                    if (embEn && embEn.length > 0 && embIt && embIt.length > 0) {
                        await pool.query(`
              UPDATE courses
              SET embedding_en = $2::vector,
                  embedding_it = $3::vector,
                  embedding_model = $4,
                  embedding_generated_at = NOW()
              WHERE id = $1
            `, [ids[i], `[${embEn.join(',')}]`, `[${embIt.join(',')}]`, 'text-embedding-3-small']);
                        processed++;
                    }
                    else {
                        failed++;
                    }
                }
                totalTokens += embeddingsEn.totalTokens + embeddingsIt.totalTokens;
            }
            catch (error) {
                logger.error(`Courses batch failed at offset ${offset}:${error}`);
                failed += result.rows.length;
            }
            offset += batchSize;
            await this.waitMs(100);
        }
        return { processed, failed, tokens: totalTokens };
    }
    async processGoalsEmbeddings(jobType, tenantId) {
        const batchSize = 100;
        let offset = 0;
        let processed = 0;
        let failed = 0;
        let totalTokens = 0;
        let whereClause = jobType === 'incremental' ? 'WHERE embedding IS NULL' : 'WHERE 1=1';
        const params = [batchSize, 0];
        if (tenantId) {
            whereClause += ' AND tenant_id = $3';
            params.push(tenantId);
        }
        while (true) {
            params[1] = offset;
            const result = await pool.query(`
        SELECT id, title, description, goal_type, category
        FROM goals
        ${whereClause}
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, params);
            if (result.rows.length === 0)
                break;
            const texts = [];
            const ids = [];
            for (const row of result.rows) {
                const text = [row.title, row.description, row.goal_type, row.category]
                    .filter(Boolean)
                    .join('. ');
                texts.push(text || 'No description');
                ids.push(row.id);
            }
            try {
                const embeddings = await this.generateBatchEmbeddings(texts);
                for (let i = 0; i < ids.length; i++) {
                    const emb = embeddings.embeddings[i];
                    if (emb && emb.length > 0) {
                        await pool.query(`
              UPDATE goals
              SET embedding = $2::vector,
                  embedding_model = $3,
                  embedding_generated_at = NOW()
              WHERE id = $1
            `, [ids[i], `[${emb.join(',')}]`, 'text-embedding-3-small']);
                        processed++;
                    }
                    else {
                        failed++;
                    }
                }
                totalTokens += embeddings.totalTokens;
            }
            catch (error) {
                logger.error(`Goals batch failed at offset ${offset}:${error}`);
                failed += result.rows.length;
            }
            offset += batchSize;
            await this.waitMs(100);
        }
        return { processed, failed, tokens: totalTokens };
    }
    async processNaceEmbeddings(entityType, jobType) {
        const batchSize = 50;
        let offset = 0;
        let processed = 0;
        let failed = 0;
        let totalTokens = 0;
        const tableName = validateTableName('industry_classifications', 'CrossEntityEmbedding.processNaceEmbeddings');
        const level = entityType === 'industry_classifications_l1'
            ? 1
            : entityType === 'industry_classifications_l2'
                ? 2
                : 3;
        const whereClause = jobType === 'incremental' ? 'AND (embedding_en IS NULL OR embedding_it IS NULL)' : '';
        while (true) {
            const result = await pool.query(`
        SELECT code, name_en, name_it, description_en
        FROM ${tableName}
        WHERE level = ${level} ${whereClause}
        ORDER BY code
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);
            if (result.rows.length === 0)
                break;
            const textsEn = [];
            const textsIt = [];
            const codes = [];
            for (const row of result.rows) {
                const textEn = [row.name_en, row.description_en].filter(Boolean).join('. ');
                const textIt = [row.name_it || row.name_en, row.description_en].filter(Boolean).join('. ');
                textsEn.push(textEn || 'No description');
                textsIt.push(textIt || textEn || 'No description');
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
              UPDATE ${tableName}
              SET embedding_en = $2::vector,
                  embedding_it = $3::vector,
                  embedding_model = $4,
                  embedding_generated_at = NOW()
              WHERE code = $1
            `, [codes[i], `[${embEn.join(',')}]`, `[${embIt.join(',')}]`, 'text-embedding-3-small']);
                        processed++;
                    }
                    else {
                        failed++;
                    }
                }
                totalTokens += embeddingsEn.totalTokens + embeddingsIt.totalTokens;
            }
            catch (error) {
                logger.error(`${tableName} level=${level} batch failed at offset ${offset}:${error}`);
                failed += result.rows.length;
            }
            offset += batchSize;
            await this.waitMs(100);
        }
        return { processed, failed, tokens: totalTokens };
    }
    waitMs(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    // ---------------------------------------------------------------------------
    // CROSS-ENTITY SEMANTIC SEARCH
    // ---------------------------------------------------------------------------
    async crossEntitySearch(options) {
        const startTime = Date.now();
        // Generate query embedding
        const queryResult = await this.generateEmbedding(options.query);
        const vectorStr = `[${queryResult.embedding.join(',')}]`;
        const resultsByType = {
            skills: [],
            occupations: [],
            jobs: [],
            courses: [],
            goals: [],
            industry_classifications_l1: [],
            industry_classifications_l2: [],
            industry_classifications_l3: [],
        };
        // Search each requested entity type in parallel
        const searchPromises = options.entityTypes.map(async (entityType) => {
            const results = await this.searchEntity(entityType, vectorStr, options.language, options.limit, options.similarityThreshold, options.tenantId);
            resultsByType[entityType] = results;
        });
        await Promise.all(searchPromises);
        const totalResults = Object.values(resultsByType).reduce((sum, arr) => sum + arr.length, 0);
        const searchDurationMs = Date.now() - startTime;
        // Log search for analytics
        await this.logCrossEntitySearch(options.query, vectorStr, options.entityTypes, totalResults, resultsByType, searchDurationMs, options.tenantId);
        return {
            query: options.query,
            totalResults,
            resultsByType,
            searchDurationMs,
        };
    }
    async searchEntity(entityType, vectorStr, language, limit, threshold, tenantId) {
        const embCol = validateEmbeddingColumn(language === 'it' ? 'embedding_it' : 'embedding_en', 'CrossEntityEmbedding.searchEntity.embCol');
        let query;
        const params = [vectorStr, limit];
        switch (entityType) {
            case 'skills':
                const labelCol = validateEmbeddingColumn(language === 'it' ? 'preferred_label_it' : 'preferred_label_en', 'CrossEntityEmbedding.searchEntity.skills.labelCol');
                const descCol = validateEmbeddingColumn(language === 'it' ? 'description_it' : 'description_en', 'CrossEntityEmbedding.searchEntity.skills.descCol');
                query = `
          SELECT id, ${labelCol} as label, ${descCol} as description,
                 skill_type, is_digital, is_green,
                 1 - (${embCol} <=> $1::vector) as similarity
          FROM esco_skills
          WHERE ${embCol} IS NOT NULL
          ORDER BY ${embCol} <=> $1::vector
          LIMIT $2
        `;
                break;
            case 'occupations':
                const occLabelCol = validateEmbeddingColumn(language === 'it' ? 'preferred_label_it' : 'preferred_label_en', 'CrossEntityEmbedding.searchEntity.occupations.labelCol');
                const occDescCol = validateEmbeddingColumn(language === 'it' ? 'description_it' : 'description_en', 'CrossEntityEmbedding.searchEntity.occupations.descCol');
                query = `
          SELECT id, ${occLabelCol} as label, ${occDescCol} as description,
                 isco_code, occupation_type, uri,
                 1 - (${embCol} <=> $1::vector) as similarity
          FROM esco_occupations
          WHERE ${embCol} IS NOT NULL
          ORDER BY ${embCol} <=> $1::vector
          LIMIT $2
        `;
                break;
            case 'jobs':
                const jobLabelCol = validateEmbeddingColumn(language === 'it' ? 'title_it' : 'title_en', 'CrossEntityEmbedding.searchEntity.jobs.labelCol');
                query = `
          SELECT id, COALESCE(${jobLabelCol}, title_en) as label,
                 description, summary, job_code, org_level, is_management,
                 esco_occupation_uri,
                 1 - (${embCol} <=> $1::vector) as similarity
          FROM job_templates
          WHERE ${embCol} IS NOT NULL
          ORDER BY ${embCol} <=> $1::vector
          LIMIT $2
        `;
                break;
            case 'courses':
                const courseLabelCol = validateEmbeddingColumn(language === 'it' ? 'title' : 'title_en', 'CrossEntityEmbedding.searchEntity.courses.labelCol');
                const courseDescCol = validateEmbeddingColumn(language === 'it' ? 'description' : 'description_en', 'CrossEntityEmbedding.searchEntity.courses.descCol');
                query = `
          SELECT id, COALESCE(${courseLabelCol}, title_en, title) as label,
                 COALESCE(${courseDescCol}, description_en, description) as description,
                 provider, category, duration_hours, skill_level,
                 1 - (${embCol} <=> $1::vector) as similarity
          FROM courses
          WHERE ${embCol} IS NOT NULL
          ORDER BY ${embCol} <=> $1::vector
          LIMIT $2
        `;
                break;
            case 'goals':
                // Goals have single embedding column
                query = `
          SELECT id, title as label, description,
                 goal_type, category, status,
                 1 - (embedding <=> $1::vector) as similarity
          FROM goals
          WHERE embedding IS NOT NULL
          ${tenantId ? 'AND tenant_id = $3' : ''}
          ORDER BY embedding <=> $1::vector
          LIMIT $2
        `;
                if (tenantId)
                    params.push(tenantId);
                break;
            case 'industry_classifications_l1':
                const secLabelCol = validateEmbeddingColumn(language === 'it' ? 'name_it' : 'name_en', 'CrossEntityEmbedding.searchEntity.industry_classifications_l1.labelCol');
                query = `
          SELECT code as id, ${secLabelCol} as label, description_en as description,
                 icon, color,
                 1 - (${embCol} <=> $1::vector) as similarity
          FROM industry_classifications
          WHERE level = 1 AND ${embCol} IS NOT NULL
          ORDER BY ${embCol} <=> $1::vector
          LIMIT $2
        `;
                break;
            case 'industry_classifications_l2':
                const divLabelCol = validateEmbeddingColumn(language === 'it' ? 'name_it' : 'name_en', 'CrossEntityEmbedding.searchEntity.industry_classifications_l2.labelCol');
                query = `
          SELECT code as id, ${divLabelCol} as label, description_en as description,
                 parent_code,
                 1 - (${embCol} <=> $1::vector) as similarity
          FROM industry_classifications
          WHERE level = 2 AND ${embCol} IS NOT NULL
          ORDER BY ${embCol} <=> $1::vector
          LIMIT $2
        `;
                break;
            case 'industry_classifications_l3':
                const grpLabelCol = validateEmbeddingColumn(language === 'it' ? 'name_it' : 'name_en', 'CrossEntityEmbedding.searchEntity.industry_classifications_l3.labelCol');
                query = `
          SELECT code as id, ${grpLabelCol} as label, description_en as description,
                 parent_code,
                 1 - (${embCol} <=> $1::vector) as similarity
          FROM industry_classifications
          WHERE level = 3 AND ${embCol} IS NOT NULL
          ORDER BY ${embCol} <=> $1::vector
          LIMIT $2
        `;
                break;
            default:
                return [];
        }
        try {
            const result = await pool.query(query, params);
            return result.rows
                .filter((row) => row.similarity >= threshold)
                .map((row) => {
                const { id, label, description, similarity, ...rest } = row;
                return {
                    entityType,
                    id: String(id),
                    label: label || '',
                    description: description || '',
                    similarity: parseFloat(similarity.toFixed(4)),
                    metadata: rest,
                };
            });
        }
        catch (error) {
            logger.error(`Cross-entity search failed for ${entityType}:${error}`);
            return [];
        }
    }
    async logCrossEntitySearch(queryText, queryEmbedding, entityTypes, resultsCount, topResults, durationMs, tenantId) {
        try {
            // Summarize top results
            const summary = {};
            for (const [type, results] of Object.entries(topResults)) {
                if (results.length > 0) {
                    summary[type] = results.slice(0, 3).map((r) => ({
                        id: r.id,
                        label: r.label,
                        similarity: r.similarity,
                    }));
                }
            }
            await pool.query(`
        INSERT INTO cross_entity_searches (
          query_text, query_embedding, entity_types, results_count,
          top_results, search_duration_ms, tenant_id
        ) VALUES ($1, $2::vector, $3, $4, $5, $6, $7)
      `, [
                queryText,
                queryEmbedding,
                entityTypes,
                resultsCount,
                JSON.stringify(summary),
                durationMs,
                tenantId || null,
            ]);
        }
        catch (_err) {
            logger.warn({ err: _err }, 'Silent catch in services.cross-entity-embedding');
        }
    }
    // ---------------------------------------------------------------------------
    // ORGANIZATION ADVISORY
    // ---------------------------------------------------------------------------
    async getOrganizationAdvice(request) {
        // Step 1: Find matching industry via semantic search
        const industryMatch = await this.findMatchingIndustry(request.industry, request.additionalContext, request.language);
        if (!industryMatch) {
            throw new Error('Could not identify matching industry from the provided description');
        }
        // Step 2: Find relevant occupations for this industry
        const occupations = await this.findIndustryOccupations(industryMatch.code, industryMatch.level, request.companySize, request.language);
        // Step 3: Build organizational structure based on company size
        const structure = this.buildOrgStructure(occupations, request.companySize);
        // Step 4: Find skills required across all roles
        const skillsProfile = await this.buildSkillsProfile(occupations.map((o) => o.occupationUri), request.language);
        // Step 5: Generate recommendations
        const recommendations = this.generateRecommendations(industryMatch, request.companySize, structure, request.language);
        return {
            matchedIndustry: {
                naceCode: industryMatch.code,
                nameEn: industryMatch.nameEn,
                nameIt: industryMatch.nameIt,
                level: industryMatch.level,
            },
            companySize: request.companySize,
            suggestedStructure: structure,
            totalHeadcount: structure.org_units.reduce((sum, d) => sum + d.headcount, 0),
            keyRoles: occupations.filter((o) => o.isCore).slice(0, 10),
            skillsProfile: skillsProfile.slice(0, 20),
            recommendations,
        };
    }
    async findMatchingIndustry(industry, additionalContext, language) {
        // Combine industry description with additional context
        const searchText = [industry, additionalContext].filter(Boolean).join('. ');
        // Generate embedding for the search text
        const queryResult = await this.generateEmbedding(searchText);
        const vectorStr = `[${queryResult.embedding.join(',')}]`;
        const embCol = validateEmbeddingColumn(language === 'it' ? 'embedding_it' : 'embedding_en', 'CrossEntityEmbedding.findMatchingIndustry.embCol');
        // Search across all NACE levels, prioritizing more specific (groups > divisions > sections)
        const queries = [
            {
                level: 'group',
                query: `
          SELECT code, name_en, name_it,
                 1 - (${embCol} <=> $1::vector) as similarity
          FROM industry_classifications
          WHERE level = 3 AND ${embCol} IS NOT NULL
          ORDER BY ${embCol} <=> $1::vector
          LIMIT 1
        `,
            },
            {
                level: 'division',
                query: `
          SELECT code, name_en, name_it,
                 1 - (${embCol} <=> $1::vector) as similarity
          FROM industry_classifications
          WHERE level = 2 AND ${embCol} IS NOT NULL
          ORDER BY ${embCol} <=> $1::vector
          LIMIT 1
        `,
            },
            {
                level: 'section',
                query: `
          SELECT code, name_en, name_it,
                 1 - (${embCol} <=> $1::vector) as similarity
          FROM industry_classifications
          WHERE level = 1 AND ${embCol} IS NOT NULL
          ORDER BY ${embCol} <=> $1::vector
          LIMIT 1
        `,
            },
        ];
        let bestMatch = null;
        for (const { level, query } of queries) {
            const result = await pool.query(query, [vectorStr]);
            if (result.rows.length > 0) {
                const row = result.rows[0];
                const similarity = parseFloat(row.similarity);
                // Use the most specific level that has good enough similarity
                // Groups need higher threshold since they're more specific
                const threshold = level === 'group' ? 0.7 : level === 'division' ? 0.65 : 0.6;
                if (similarity >= threshold &&
                    (!bestMatch ||
                        level === 'group' ||
                        (level === 'division' && bestMatch.level === 'section'))) {
                    bestMatch = {
                        code: row.code,
                        nameEn: row.name_en,
                        nameIt: row.name_it,
                        level,
                        similarity,
                    };
                }
            }
        }
        return bestMatch;
    }
    async findIndustryOccupations(naceCode, level, companySize, language) {
        // Get the industry embedding to find semantically related occupations
        const embCol = validateEmbeddingColumn(language === 'it' ? 'embedding_it' : 'embedding_en', 'CrossEntityEmbedding.findIndustryOccupations.embCol');
        const tableName = validateTableName('industry_classifications', 'CrossEntityEmbedding.findIndustryOccupations');
        const naceLevel = level === 'group' ? 3 : level === 'division' ? 2 : 1;
        // Get industry embedding
        const industryResult = await pool.query(`
      SELECT ${embCol} as embedding FROM ${tableName} WHERE code = $1 AND level = ${naceLevel}
    `, [naceCode]);
        if (industryResult.rows.length === 0 || !industryResult.rows[0].embedding) {
            return this.getDefaultOccupations(companySize, language);
        }
        const industryEmbedding = industryResult.rows[0].embedding;
        const labelCol = validateEmbeddingColumn(language === 'it' ? 'preferred_label_it' : 'preferred_label_en', 'CrossEntityEmbedding.findIndustryOccupations.labelCol');
        const descCol = validateEmbeddingColumn(language === 'it' ? 'description_it' : 'description_en', 'CrossEntityEmbedding.findIndustryOccupations.descCol');
        // Find most relevant occupations using the industry embedding
        const occResult = await pool.query(`
      SELECT id, uri, ${labelCol} as label, ${descCol} as description,
             isco_code, occupation_type,
             1 - (${embCol} <=> $1::vector) as similarity
      FROM esco_occupations
      WHERE ${embCol} IS NOT NULL
      ORDER BY ${embCol} <=> $1::vector
      LIMIT 50
    `, [industryEmbedding]);
        // Assign roles based on company size and occupation characteristics
        return this.assignRolesToCompany(occResult.rows, companySize);
    }
    getDefaultOccupations(companySize, language) {
        // Fallback generic roles for any company
        const defaultRoles = [
            {
                occupationUri: 'generic:general_manager',
                occupationTitle: language === 'it' ? 'Direttore Generale' : 'General Manager',
                count: 1,
                isCore: true,
                department: language === 'it' ? 'Direzione' : 'Management',
                notes: language === 'it'
                    ? "Responsabile generale dell'azienda"
                    : 'Overall company responsibility',
                requiredSkills: [],
            },
            {
                occupationUri: 'generic:administrative',
                occupationTitle: language === 'it' ? 'Impiegato Amministrativo' : 'Administrative Clerk',
                count: Math.max(1, Math.floor(companySize * 0.1)),
                isCore: true,
                department: language === 'it' ? 'Amministrazione' : 'Administration',
                requiredSkills: [],
            },
        ];
        return defaultRoles;
    }
    assignRolesToCompany(occupations, companySize) {
        const roles = [];
        // Determine structure based on company size
        const needsManagement = companySize >= 5;
        const needsSpecialists = companySize >= 8;
        // Separate occupations by type based on ISCO code
        const managers = occupations.filter((o) => o.isco_code?.startsWith('1'));
        const professionals = occupations.filter((o) => o.isco_code?.startsWith('2'));
        const technicians = occupations.filter((o) => o.isco_code?.startsWith('3'));
        const clerks = occupations.filter((o) => o.isco_code?.startsWith('4'));
        const skilled = occupations.filter((o) => o.isco_code?.startsWith('7') || o.isco_code?.startsWith('8'));
        // Add management roles
        if (needsManagement && managers.length > 0) {
            const topManager = managers[0];
            roles.push({
                occupationUri: topManager.uri,
                occupationTitle: topManager.label || 'Manager',
                count: 1,
                isCore: true,
                department: 'Management',
                notes: topManager.description?.substring(0, 200),
                requiredSkills: [],
            });
        }
        // Add core production/technical roles (based on industry match)
        const coreOccupations = skilled.length > 0 ? skilled : technicians.length > 0 ? technicians : professionals;
        const coreCount = Math.floor(companySize * 0.6); // 60% core workers
        const topCore = coreOccupations.slice(0, 3);
        for (const occ of topCore) {
            const count = Math.max(1, Math.floor(coreCount / topCore.length));
            roles.push({
                occupationUri: occ.uri,
                occupationTitle: occ.label || 'Worker',
                count,
                isCore: true,
                department: 'Production',
                notes: occ.description?.substring(0, 200),
                requiredSkills: [],
            });
        }
        // Add administrative support
        if (clerks.length > 0 && companySize >= 5) {
            const clerk = clerks[0];
            roles.push({
                occupationUri: clerk.uri,
                occupationTitle: clerk.label || 'Administrative',
                count: Math.max(1, Math.floor(companySize * 0.1)),
                isCore: false,
                department: 'Administration',
                requiredSkills: [],
            });
        }
        // Add specialists if large enough
        if (needsSpecialists && professionals.length > 0) {
            const specialist = professionals[0];
            roles.push({
                occupationUri: specialist.uri,
                occupationTitle: specialist.label || 'Specialist',
                count: Math.max(1, Math.floor(companySize * 0.15)),
                isCore: true,
                department: 'Technical',
                requiredSkills: [],
            });
        }
        return roles;
    }
    buildOrgStructure(roles, _companySize) {
        // Group roles by department
        const deptMap = new Map();
        for (const role of roles) {
            const dept = role.department || 'General';
            if (!deptMap.has(dept)) {
                deptMap.set(dept, []);
            }
            deptMap.get(dept).push(role);
        }
        const departments = Array.from(deptMap.entries()).map(([name, deptRoles]) => ({
            name,
            headcount: deptRoles.reduce((sum, r) => sum + r.count, 0),
            roles: deptRoles,
        }));
        // Sort by headcount descending
        departments.sort((a, b) => b.headcount - a.headcount);
        return { org_units: departments };
    }
    async buildSkillsProfile(occupationUris, language) {
        if (occupationUris.length === 0)
            return [];
        const labelCol = validateEmbeddingColumn(language === 'it' ? 'preferred_label_it' : 'preferred_label_en', 'CrossEntityEmbedding.buildSkillsProfile.labelCol');
        // Find skills associated with these occupations via semantic similarity
        // Since we don't have explicit occupation-skill mappings, use embedding similarity
        const result = await pool.query(`
      WITH occupation_embeddings AS (
        SELECT embedding_en as emb
        FROM esco_occupations
        WHERE uri = ANY($1)
        AND embedding_en IS NOT NULL
        LIMIT 5
      )
      SELECT DISTINCT ON (s.id)
        s.id,
        s.${labelCol} as label,
        s.skill_type,
        s.is_digital,
        s.is_green
      FROM esco_skills s
      CROSS JOIN occupation_embeddings oe
      WHERE s.embedding_en IS NOT NULL
      ORDER BY s.id, s.embedding_en <=> oe.emb
      LIMIT 30
    `, [occupationUris]);
        // Count frequency and assign importance
        const skillFrequency = new Map();
        for (const row of result.rows) {
            const count = skillFrequency.get(row.id) || 0;
            skillFrequency.set(row.id, count + 1);
        }
        return result.rows.map((row) => ({
            skillId: row.id,
            skillLabel: row.label || '',
            frequency: skillFrequency.get(row.id) || 1,
            importance: row.is_digital || row.is_green ? 'high' : 'medium',
        }));
    }
    generateRecommendations(industry, companySize, structure, language) {
        const recommendations = [];
        if (language === 'it') {
            recommendations.push(`La tua azienda rientra nel settore "${industry.nameIt}" (NACE ${industry.code}).`);
            if (companySize <= 10) {
                recommendations.push('Con meno di 10 dipendenti, consigliamo una struttura piatta con ruoli multifunzionali.', "Considera l'outsourcing per funzioni specialistiche come contabilità e IT.");
            }
            else if (companySize <= 50) {
                recommendations.push('Con questa dimensione, è importante definire chiaramente i ruoli e le responsabilità.', 'Considera di introdurre un livello di middle management per la supervisione operativa.');
            }
            if (structure.org_units.length > 3) {
                recommendations.push('Con più reparti, stabilisci canali di comunicazione chiari tra i team.');
            }
        }
        else {
            recommendations.push(`Your company falls within the "${industry.nameEn}" sector (NACE ${industry.code}).`);
            if (companySize <= 10) {
                recommendations.push('With fewer than 10 employees, we recommend a flat structure with multi-functional roles.', 'Consider outsourcing specialized functions like accounting and IT.');
            }
            else if (companySize <= 50) {
                recommendations.push('At this size, clearly defining roles and responsibilities is important.', 'Consider introducing middle management for operational oversight.');
            }
            if (structure.org_units.length > 3) {
                recommendations.push('With multiple departments, establish clear communication channels between teams.');
            }
        }
        return recommendations;
    }
    // ---------------------------------------------------------------------------
    // EMBEDDING STATUS
    // ---------------------------------------------------------------------------
    async getEmbeddingStatus() {
        const entities = [
            'skills',
            'occupations',
            'jobs',
            'courses',
            'goals',
            'industry_classifications_l1',
            'industry_classifications_l2',
            'industry_classifications_l3',
        ];
        const status = {};
        const queries = {
            skills: { table: 'esco_skills', embCol: 'embedding_en' },
            occupations: { table: 'esco_occupations', embCol: 'embedding_en' },
            jobs: { table: 'job_templates', embCol: 'embedding_en' },
            courses: { table: 'courses', embCol: 'embedding_en' },
            goals: { table: 'goals', embCol: 'embedding' },
            industry_classifications_l1: {
                table: 'industry_classifications',
                embCol: 'embedding_en',
                levelFilter: 'AND level = 1',
            },
            industry_classifications_l2: {
                table: 'industry_classifications',
                embCol: 'embedding_en',
                levelFilter: 'AND level = 2',
            },
            industry_classifications_l3: {
                table: 'industry_classifications',
                embCol: 'embedding_en',
                levelFilter: 'AND level = 3',
            },
        };
        for (const entity of entities) {
            const { table, embCol, levelFilter } = queries[entity];
            const validatedTable = validateTableName(table, `CrossEntityEmbedding.getEmbeddingStatus(${entity})`);
            const validatedEmbCol = validateEmbeddingColumn(embCol, `CrossEntityEmbedding.getEmbeddingStatus(${entity})`);
            const result = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(${validatedEmbCol}) as embedded
        FROM ${validatedTable}
        WHERE 1=1 ${levelFilter || ''}
      `);
            const total = parseInt(result.rows[0].total);
            const embedded = parseInt(result.rows[0].embedded);
            status[entity] = {
                total,
                embedded,
                percentage: total > 0 ? Math.round((embedded / total) * 100) : 0,
            };
        }
        return status;
    }
}
// =============================================================================
// FACTORY
// =============================================================================
export function createCrossEntityService(provider = 'openai') {
    return new CrossEntityEmbeddingService(provider);
}
export default CrossEntityEmbeddingService;
//# sourceMappingURL=cross-entity-embedding.js.map