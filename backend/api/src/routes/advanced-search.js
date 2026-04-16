/**
 * Advanced Semantic Search Routes
 * API endpoints for query expansion, re-ranking, and search analytics
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-06-R (Advanced Semantic Search)
 * Created: 2025-12-22
 */
import { Router } from 'express';
import { getAdvancedSearchService, } from '../services/advanced-semantic-search.js';
import { validate } from '../middleware/validate.js';
import { advancedSearchSchema, expandQuerySchema, searchFeedbackSchema, } from '../schemas/skills-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// =============================================================================
// ADVANCED SEARCH ENDPOINTS
// =============================================================================
/**
 * POST /advanced-search/search
 * Perform advanced semantic search with query expansion and re-ranking
 */
router.post('/search', validate(advancedSearchSchema), asyncHandler(async (req, res) => {
    const options = req.body;
    if (!options.query || typeof options.query !== 'string') {
        throw Errors.badRequest('query is required and must be a string');
    }
    if (!options.tenantId || typeof options.tenantId !== 'string') {
        throw Errors.badRequest('tenantId is required');
    }
    if (options.query.length < 2) {
        throw Errors.badRequest('query must be at least 2 characters');
    }
    const service = getAdvancedSearchService();
    const result = await service.advancedSearch(options);
    res.json({
        success: true,
        data: result,
    });
}));
/**
 * POST /advanced-search/expand
 * Expand a query with synonyms and related terms
 */
router.post('/expand', validate(expandQuerySchema), asyncHandler(async (req, res) => {
    const { query, language } = req.body;
    if (!query || typeof query !== 'string') {
        throw Errors.badRequest('query is required and must be a string');
    }
    const service = getAdvancedSearchService();
    const expansion = await service.expandQuery(query, language || 'en');
    res.json({
        success: true,
        data: expansion,
    });
}));
// =============================================================================
// ANALYTICS ENDPOINTS
// =============================================================================
/**
 * GET /advanced-search/analytics
 * Get search analytics summary
 */
router.get('/analytics', asyncHandler(async (req, res) => {
    const { tenantId, days } = req.query;
    const daysNum = safeParseInt(days, { fallback: 30 });
    const service = getAdvancedSearchService();
    const analytics = await service.getSearchAnalytics(tenantId, Math.min(daysNum, 365));
    res.json({
        success: true,
        data: analytics,
    });
}));
/**
 * POST /advanced-search/feedback/:searchId
 * Submit feedback for a search result
 */
router.post('/feedback/:searchId', validate(searchFeedbackSchema), asyncHandler(async (req, res) => {
    const { searchId } = req.params;
    const { score } = req.body;
    if (!searchId) {
        throw Errors.badRequest('searchId is required');
    }
    if (typeof score !== 'number' || score < 1 || score > 5) {
        throw Errors.badRequest('score is required and must be a number between 1 and 5');
    }
    const service = getAdvancedSearchService();
    await service.submitSearchFeedback(searchId, score);
    res.json({
        success: true,
        message: 'Feedback submitted successfully',
    });
}));
export default router;
//# sourceMappingURL=advanced-search.js.map