/**
 * Advanced Semantic Search Service
 * Extends base semantic search with query expansion and re-ranking
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-06-R (Advanced Semantic Search)
 * Created: 2025-12-22
 */
import { pool } from '../config/database.js';
import { getProviderFactory } from './ai-providers/index.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { logger } from '../config/logger.js';
// =============================================================================
// ADVANCED SEMANTIC SEARCH SERVICE
// =============================================================================
export class AdvancedSemanticSearchService {
    // ---------------------------------------------------------------------------
    // QUERY EXPANSION
    // ---------------------------------------------------------------------------
    /**
     * Expand query with synonyms and related terms
     */
    async expandQuery(query, language = 'en') {
        const expandedTerms = [query];
        // Step 1: Find synonyms from skill_synonyms table
        const escapedQuery = escapeILIKE(query);
        const synonymResult = await pool.query(`
      SELECT DISTINCT ss.synonym
      FROM skill_synonyms ss
      JOIN esco_skills es ON ss.esco_skill_id = es.id
      WHERE (
        LOWER(es.preferred_label_en) LIKE '%' || LOWER($1) || '%'
        OR LOWER(es.preferred_label_it) LIKE '%' || LOWER($1) || '%'
        OR ss.synonym ILIKE '%' || $1 || '%'
      )
      AND ss.language = $2
      LIMIT 5
    `, [escapedQuery, language]);
        for (const row of synonymResult.rows) {
            if (!expandedTerms.includes(row.synonym)) {
                expandedTerms.push(row.synonym);
            }
        }
        // Step 2: Find related terms from ESCO alt_labels
        const altLabelsResult = await pool.query(`
      SELECT DISTINCT jsonb_array_elements_text(alt_labels) as alt_label
      FROM esco_skills
      WHERE LOWER(preferred_label_en) LIKE '%' || LOWER($1) || '%'
         OR LOWER(preferred_label_it) LIKE '%' || LOWER($1) || '%'
      LIMIT 5
    `, [query]);
        for (const row of altLabelsResult.rows) {
            if (row.alt_label && !expandedTerms.includes(row.alt_label)) {
                expandedTerms.push(row.alt_label);
            }
        }
        // Step 3: Find semantically similar terms using embeddings
        try {
            const factory = getProviderFactory();
            const embeddingResult = await factory.generateEmbedding(query);
            const embeddingStr = `[${embeddingResult.embedding.join(',')}]`;
            const similarResult = await pool.query(`
        SELECT preferred_label_en as label
        FROM esco_skills
        WHERE embedding_en IS NOT NULL
        ORDER BY embedding_en <=> $1::vector
        LIMIT 3
      `, [embeddingStr]);
            for (const row of similarResult.rows) {
                if (row.label &&
                    !expandedTerms.includes(row.label) &&
                    row.label.toLowerCase() !== query.toLowerCase()) {
                    expandedTerms.push(row.label);
                }
            }
        }
        catch (_err) {
            logger.warn({ err: _err }, 'Silent catch in services.advanced-semantic-search');
        }
        return {
            originalQuery: query,
            expandedTerms: expandedTerms.slice(0, 10), // Limit to 10 terms
            synonymsFound: expandedTerms.length - 1,
            expansionMethod: expandedTerms.length > 1 ? 'hybrid' : 'embedding',
        };
    }
    // ---------------------------------------------------------------------------
    // CONTEXT-AWARE RE-RANKING
    // ---------------------------------------------------------------------------
    /**
     * Re-rank results based on context and relevance factors
     */
    reRankResults(results, options) {
        const { query, contextHints = [], preferredTypes = [], boostRecent = false } = options;
        const queryTerms = query.toLowerCase().split(/\s+/);
        return results
            .map((result) => {
            // Base semantic similarity (already calculated)
            const semanticSimilarity = result.similarity;
            // Context relevance: check if entity context contains query terms
            let contextRelevance = 0;
            if (result.entityContext) {
                const contextLower = result.entityContext.toLowerCase();
                const matchingTerms = queryTerms.filter((term) => contextLower.includes(term));
                contextRelevance = matchingTerms.length / queryTerms.length;
                // Boost for context hint matches
                for (const hint of contextHints) {
                    if (contextLower.includes(hint.toLowerCase())) {
                        contextRelevance += 0.1;
                    }
                }
            }
            // Recency boost (if date is available in metadata)
            let recencyBoost = 0;
            if (boostRecent && result.metadata) {
                const createdAt = result.metadata.createdAt || result.metadata.updated_at;
                if (createdAt) {
                    const age = Date.now() - new Date(createdAt).getTime();
                    const daysSinceCreation = age / (1000 * 60 * 60 * 24);
                    // Boost for items created in last 30 days
                    if (daysSinceCreation < 30) {
                        recencyBoost = 0.1 * (1 - daysSinceCreation / 30);
                    }
                }
            }
            // Type preference boost
            let typeBoost = 0;
            if (preferredTypes.includes(result.entityType)) {
                typeBoost = 0.1;
            }
            // Calculate final score with weighted factors
            const finalScore = Math.min(1, semanticSimilarity * 0.6 + contextRelevance * 0.25 + recencyBoost * 0.1 + typeBoost * 0.05);
            return {
                ...result,
                contextScore: contextRelevance,
                finalScore,
                rankingFactors: {
                    semanticSimilarity,
                    contextRelevance,
                    recencyBoost,
                    typeBoost,
                },
            };
        })
            .sort((a, b) => b.finalScore - a.finalScore);
    }
    // ---------------------------------------------------------------------------
    // ADVANCED SEARCH
    // ---------------------------------------------------------------------------
    /**
     * Perform advanced semantic search with expansion and re-ranking
     */
    async advancedSearch(options) {
        const startTime = Date.now();
        const { query, tenantId, entityTypes, limit = 20, similarityThreshold = 0.4, enableQueryExpansion = true, enableReranking = true, contextHints = [], boostRecent = false, } = options;
        // Step 1: Query expansion
        let expansion = null;
        let searchQuery = query;
        if (enableQueryExpansion) {
            expansion = await this.expandQuery(query);
            if (expansion.expandedTerms.length > 1) {
                // Combine expanded terms for embedding
                searchQuery = expansion.expandedTerms.slice(0, 3).join(' ');
            }
        }
        // Step 2: Generate embedding for search
        const factory = getProviderFactory();
        const embeddingResult = await factory.generateEmbedding(searchQuery);
        const embeddingStr = `[${embeddingResult.embedding.join(',')}]`;
        // Step 3: Execute semantic search
        let typeFilter = '';
        const params = [embeddingStr, tenantId, similarityThreshold];
        if (entityTypes && entityTypes.length > 0) {
            typeFilter = `AND entity_type = ANY($4)`;
            params.push(entityTypes);
        }
        params.push(limit * 2); // Fetch extra for re-ranking
        const searchResult = await pool.query(`
      SELECT
        entity_type,
        entity_id,
        entity_name,
        entity_context,
        metadata,
        1 - (embedding <=> $1::vector) AS similarity
      FROM semantic_entity_index
      WHERE tenant_id = $2
        AND is_active = TRUE
        AND 1 - (embedding <=> $1::vector) >= $3
        ${typeFilter}
      ORDER BY similarity DESC
      LIMIT $${params.length}
    `, params);
        // Step 4: Re-rank results
        let results;
        if (enableReranking && searchResult.rows.length > 0) {
            results = this.reRankResults(searchResult.rows.map((row) => ({
                entityType: row.entity_type,
                entityId: row.entity_id,
                entityName: row.entity_name,
                entityContext: row.entity_context,
                similarity: parseFloat(row.similarity),
                metadata: row.metadata,
            })), {
                query,
                contextHints,
                preferredTypes: entityTypes,
                boostRecent,
            });
        }
        else {
            results = searchResult.rows.map((row) => ({
                entityType: row.entity_type,
                entityId: row.entity_id,
                entityName: row.entity_name,
                entityContext: row.entity_context,
                similarity: parseFloat(row.similarity),
                contextScore: 0,
                finalScore: parseFloat(row.similarity),
                metadata: row.metadata,
                rankingFactors: {
                    semanticSimilarity: parseFloat(row.similarity),
                    contextRelevance: 0,
                    recencyBoost: 0,
                    typeBoost: 0,
                },
            }));
        }
        // Limit final results
        results = results.slice(0, limit);
        // Group by type
        const resultsByType = {};
        for (const result of results) {
            const typeKey = result.entityType;
            if (!resultsByType[typeKey]) {
                resultsByType[typeKey] = [];
            }
            const typeArray = resultsByType[typeKey];
            if (typeArray) {
                typeArray.push(result);
            }
        }
        const searchDurationMs = Date.now() - startTime;
        // Step 5: Log search analytics
        const analyticsId = await this.logSearchAnalytics({
            tenantId,
            query,
            expandedQuery: expansion?.expandedTerms.join(' ') || query,
            entityTypes: entityTypes || [],
            resultsCount: results.length,
            topResults: results.slice(0, 5),
            durationMs: searchDurationMs,
            expansionUsed: !!expansion && expansion.synonymsFound > 0,
            rerankingUsed: enableReranking,
        });
        return {
            query,
            expansion,
            totalResults: results.length,
            results,
            resultsByType,
            searchDurationMs,
            analyticsId,
        };
    }
    // ---------------------------------------------------------------------------
    // ANALYTICS
    // ---------------------------------------------------------------------------
    /**
     * Log search for analytics
     */
    async logSearchAnalytics(params) {
        const result = await pool.query(`
      INSERT INTO semantic_search_log (
        tenant_id,
        query_text,
        entity_types,
        results_count,
        top_results,
        search_duration_ms,
        filters
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
            params.tenantId,
            params.query,
            params.entityTypes,
            params.resultsCount,
            JSON.stringify(params.topResults.map((r) => ({
                entityType: r.entityType,
                entityId: r.entityId,
                entityName: r.entityName,
                finalScore: r.finalScore,
            }))),
            params.durationMs,
            JSON.stringify({
                expandedQuery: params.expandedQuery,
                expansionUsed: params.expansionUsed,
                rerankingUsed: params.rerankingUsed,
            }),
        ]);
        return result.rows[0].id;
    }
    /**
     * Get search analytics summary
     */
    async getSearchAnalytics(tenantId, days = 30) {
        const whereClause = tenantId
            ? 'WHERE tenant_id = $1 AND created_at >= NOW() - $2::INTERVAL'
            : 'WHERE created_at >= NOW() - $1::INTERVAL';
        const params = tenantId ? [tenantId, `${days} days`] : [`${days} days`];
        // Basic metrics
        const metricsResult = await pool.query(`
      SELECT
        COUNT(*) as total_searches,
        AVG(results_count) as avg_result_count,
        AVG(search_duration_ms) as avg_duration_ms,
        COUNT(*) FILTER (WHERE results_count = 0) as zero_result_queries,
        AVG(feedback_score) FILTER (WHERE feedback_score IS NOT NULL) as avg_feedback_score
      FROM semantic_search_log
      ${whereClause}
    `, params);
        // Top queries
        const topQueriesResult = await pool.query(`
      SELECT query_text as query, COUNT(*) as count
      FROM semantic_search_log
      ${whereClause}
      GROUP BY query_text
      ORDER BY count DESC
      LIMIT 10
    `, params);
        // Searches by entity type
        const entityTypeResult = await pool.query(`
      SELECT unnest(entity_types) as entity_type, COUNT(*) as count
      FROM semantic_search_log
      ${whereClause}
      GROUP BY entity_type
      ORDER BY count DESC
    `, params);
        const searchesByEntityType = {};
        for (const row of entityTypeResult.rows) {
            searchesByEntityType[row.entity_type] = parseInt(row.count);
        }
        const metrics = metricsResult.rows[0];
        return {
            totalSearches: parseInt(metrics.total_searches) || 0,
            avgResultCount: parseFloat(metrics.avg_result_count) || 0,
            avgDurationMs: Math.round(parseFloat(metrics.avg_duration_ms) || 0),
            topQueries: topQueriesResult.rows.map((r) => ({
                query: r.query,
                count: parseInt(r.count),
            })),
            searchesByEntityType,
            zeroResultQueries: parseInt(metrics.zero_result_queries) || 0,
            avgFeedbackScore: metrics.avg_feedback_score ? parseFloat(metrics.avg_feedback_score) : null,
        };
    }
    /**
     * Submit feedback for a search
     */
    async submitSearchFeedback(searchId, feedbackScore) {
        await pool.query(`
      UPDATE semantic_search_log
      SET feedback_score = $2
      WHERE id = $1
    `, [searchId, feedbackScore]);
    }
}
// =============================================================================
// SINGLETON
// =============================================================================
let serviceInstance = null;
export function getAdvancedSearchService() {
    if (!serviceInstance) {
        serviceInstance = new AdvancedSemanticSearchService();
    }
    return serviceInstance;
}
export default AdvancedSemanticSearchService;
//# sourceMappingURL=advanced-semantic-search.js.map