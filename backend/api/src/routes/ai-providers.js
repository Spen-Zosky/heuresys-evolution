/**
 * AI Providers Routes
 * API endpoints for AI provider management, metrics, and usage
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-01 (AI Provider Abstraction Layer)
 * Created: 2025-12-22
 */
import { Router } from 'express';
import { getProviderFactory, initProviderFactory, } from '../services/ai-providers/index.js';
import { validate } from '../middleware/validate.js';
import { updateProviderConfigSchema, testProviderSchema, testFallbackSchema, } from '../schemas/ai-chat.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { buildMeta } from '../utils/pagination.js';
import { logger } from '../config/logger.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// =============================================================================
// INITIALIZATION
// =============================================================================
// Initialize provider factory on first request
let initialized = false;
const ensureInitialized = async (_req, _res, next) => {
    if (!initialized) {
        try {
            await initProviderFactory();
            initialized = true;
        }
        catch (error) {
            logger.error({ err: error }, 'Failed to initialize AI providers:');
        }
    }
    next();
};
router.use(ensureInitialized);
// =============================================================================
// PROVIDER STATUS AND HEALTH
// =============================================================================
/**
 * GET /ai-providers/status
 * Get status of all configured AI providers
 */
router.get('/status', asyncHandler(async (_req, res) => {
    const factory = getProviderFactory();
    const health = await factory.healthCheck();
    res.json({
        success: true,
        data: health,
    });
}));
/**
 * GET /ai-providers/metrics
 * Get current metrics for all providers
 */
router.get('/metrics', asyncHandler(async (_req, res) => {
    const factory = getProviderFactory();
    const metrics = factory.getMetrics();
    res.json({
        success: true,
        data: {
            providers: metrics,
            timestamp: new Date().toISOString(),
        },
    });
}));
/**
 * POST /ai-providers/metrics/save
 * Save current metrics to database
 */
router.post('/metrics/save', asyncHandler(async (_req, res) => {
    const factory = getProviderFactory();
    await factory.saveMetricsToDb();
    res.json({
        success: true,
        message: 'Metrics saved to database',
    });
}));
// =============================================================================
// COST TRACKING
// =============================================================================
/**
 * GET /ai-providers/costs
 * Get cost summary with optional filters
 */
router.get('/costs', asyncHandler(async (req, res) => {
    const { provider, days } = req.query;
    const daysNum = safeParseInt(days, { fallback: 30 });
    const since = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);
    const factory = getProviderFactory();
    const costs = await factory.loadCostSummary(provider, since);
    res.json({
        success: true,
        data: {
            period: {
                days: daysNum,
                since: since.toISOString(),
            },
            costs,
            totalCost: costs.reduce((sum, c) => sum + c.totalCost, 0),
            totalTokens: costs.reduce((sum, c) => sum + c.totalTokens, 0),
            totalRequests: costs.reduce((sum, c) => sum + c.totalRequests, 0),
        },
    });
}));
/**
 * GET /ai-providers/costs/daily
 * Get daily cost breakdown
 */
router.get('/costs/daily', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { provider, days } = req.query;
    const daysNum = safeParseInt(days, { fallback: 7 });
    let query = `
    SELECT date, provider, model, operation, request_count, total_tokens,
           total_cost, avg_latency_ms, success_count, error_count
    FROM v_ai_daily_costs
    WHERE date >= CURRENT_DATE - $1::INTEGER
  `;
    const params = [daysNum];
    if (provider) {
        query += ` AND provider = $2`;
        params.push(provider);
    }
    query += ` ORDER BY date DESC, provider`;
    const result = await dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
    });
}));
/**
 * GET /ai-providers/costs/monthly
 * Get monthly cost summary
 */
router.get('/costs/monthly', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { provider, months } = req.query;
    const monthsNum = safeParseInt(months, { fallback: 3 });
    let query = `
    SELECT month, provider, request_count, total_tokens, total_cost,
           avg_latency_ms, success_rate
    FROM v_ai_monthly_costs
    WHERE month >= DATE_TRUNC('month', CURRENT_DATE) - ($1::INTEGER || ' months')::INTERVAL
  `;
    const params = [monthsNum];
    if (provider) {
        query += ` AND provider = $2`;
        params.push(provider);
    }
    query += ` ORDER BY month DESC, provider`;
    const result = await dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
    });
}));
/**
 * GET /ai-providers/costs/by-tenant
 * Get cost breakdown by tenant
 */
router.get('/costs/by-tenant', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const result = await dbClient.query(`SELECT tenant_code, tenant_name, provider, request_count, total_tokens, total_cost FROM v_ai_tenant_costs`);
    res.json({
        success: true,
        data: result.rows,
    });
}));
// =============================================================================
// USAGE LOG
// =============================================================================
/**
 * GET /ai-providers/usage
 * Get recent usage log entries
 */
router.get('/usage', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { provider, operation, limit, offset } = req.query;
    const limitNum = safeParseInt(limit, { fallback: 50, max: 500 });
    const offsetNum = safeParseInt(offset, { fallback: 0 });
    let query = `
    SELECT
      id, provider, model, operation,
      total_tokens, cost, latency_ms,
      success, error_message,
      tenant_id, created_at
    FROM ai_usage_log
    WHERE 1=1
  `;
    const params = [];
    let paramIndex = 1;
    if (provider) {
        query += ` AND provider = $${paramIndex++}`;
        params.push(provider);
    }
    if (operation) {
        query += ` AND operation = $${paramIndex++}`;
        params.push(operation);
    }
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limitNum, offsetNum);
    const result = await dbClient.query(query, params);
    // Get total count
    let countQuery = `SELECT COUNT(*) FROM ai_usage_log WHERE 1=1`;
    const countParams = [];
    let countParamIndex = 1;
    if (provider) {
        countQuery += ` AND provider = $${countParamIndex++}`;
        countParams.push(provider);
    }
    if (operation) {
        countQuery += ` AND operation = $${countParamIndex}`;
        countParams.push(operation);
    }
    const countResult = await dbClient.query(countQuery, countParams);
    res.json({
        success: true,
        data: {
            entries: result.rows,
            meta: buildMeta(parseInt(countResult.rows[0]?.count), limitNum, offsetNum),
        },
    });
}));
// =============================================================================
// CONFIGURATION
// =============================================================================
/**
 * GET /ai-providers/config
 * Get provider configuration
 */
router.get('/config', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const result = await dbClient.query(`
    SELECT
      provider, model, is_enabled, priority,
      rate_limit_per_minute, cost_per_1k_tokens, max_batch_size,
      created_at, updated_at
    FROM ai_provider_config
    ORDER BY priority
  `);
    res.json({
        success: true,
        data: result.rows,
    });
}));
/**
 * PUT /ai-providers/config/:provider
 * Update provider configuration
 */
router.put('/config/:provider', validate(updateProviderConfigSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { provider } = req.params;
    const { model, is_enabled, priority, rate_limit_per_minute, cost_per_1k_tokens, max_batch_size, } = req.body;
    const updates = [];
    const params = [];
    let paramIndex = 1;
    if (model !== undefined) {
        updates.push(`model = $${paramIndex++}`);
        params.push(model);
    }
    if (is_enabled !== undefined) {
        updates.push(`is_enabled = $${paramIndex++}`);
        params.push(is_enabled);
    }
    if (priority !== undefined) {
        updates.push(`priority = $${paramIndex++}`);
        params.push(priority);
    }
    if (rate_limit_per_minute !== undefined) {
        updates.push(`rate_limit_per_minute = $${paramIndex++}`);
        params.push(rate_limit_per_minute);
    }
    if (cost_per_1k_tokens !== undefined) {
        updates.push(`cost_per_1k_tokens = $${paramIndex++}`);
        params.push(cost_per_1k_tokens);
    }
    if (max_batch_size !== undefined) {
        updates.push(`max_batch_size = $${paramIndex++}`);
        params.push(max_batch_size);
    }
    if (updates.length === 0) {
        throw Errors.badRequest('No fields to update');
    }
    updates.push('updated_at = NOW()');
    params.push(provider);
    const result = await dbClient.query(`
      UPDATE ai_provider_config
      SET ${updates.join(', ')}
      WHERE provider = $${paramIndex}
      RETURNING *
    `, params);
    if (result.rows.length === 0) {
        throw Errors.notFound('Provider configuration', provider);
    }
    res.json({
        success: true,
        data: result.rows[0] || null,
    });
}));
// =============================================================================
// TEST ENDPOINTS
// =============================================================================
/**
 * POST /ai-providers/test/:provider
 * Test a specific provider
 */
router.post('/test/:provider', validate(testProviderSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const providerName = req.params.provider;
    const { text } = req.body;
    if (!text) {
        throw Errors.badRequest('text is required');
    }
    const factory = getProviderFactory();
    const provider = factory.getProvider(providerName);
    const isValid = await provider.validateApiKey();
    if (!isValid) {
        throw Errors.serviceUnavailable(`Provider ${providerName} API key is invalid`);
    }
    const result = await provider.generateEmbedding(text);
    // Log the usage
    await dbClient.query(`
      SELECT log_ai_usage($1, $2, $3, $4, $5, $6, $7)
    `, [
        result.provider,
        result.model,
        'embedding',
        result.tokensUsed,
        provider.estimateCost(result.tokensUsed),
        result.latencyMs,
        true,
    ]);
    res.json({
        success: true,
        data: {
            provider: result.provider,
            model: result.model,
            dimensions: result.embedding.length,
            tokensUsed: result.tokensUsed,
            latencyMs: result.latencyMs,
            estimatedCost: provider.estimateCost(result.tokensUsed),
            // Only return first few dimensions as preview
            embeddingPreview: result.embedding.slice(0, 5),
        },
    });
}));
/**
 * POST /ai-providers/test-fallback
 * Test fallback mechanism
 */
router.post('/test-fallback', validate(testFallbackSchema), asyncHandler(async (req, res) => {
    const { text, preferredProvider } = req.body;
    if (!text) {
        throw Errors.badRequest('text is required');
    }
    const factory = getProviderFactory();
    const result = await factory.generateEmbedding(text, preferredProvider);
    res.json({
        success: true,
        data: {
            provider: result.provider,
            model: result.model,
            dimensions: result.embedding.length,
            tokensUsed: result.tokensUsed,
            latencyMs: result.latencyMs,
        },
    });
}));
export default router;
//# sourceMappingURL=ai-providers.js.map