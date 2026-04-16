/**
 * Marketplace Reviews Routes
 * Reviews and ratings for marketplace plugins
 * Schema verified from database - plugin_reviews table:
 *   id, tenant_id, plugin_id, user_id, rating, title, review_text,
 *   is_verified_install, helpful_count, status, created_at, updated_at
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validateIdentifier } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import { createReviewSchema, updateReviewSchema } from '../schemas/marketplace.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// All routes require tenant context
router.use(requireTenant);
/**
 * GET /api/v1/marketplace/reviews/plugin/:pluginId
 * Get reviews for a specific plugin
 */
router.get('/plugin/:pluginId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const pluginId = req.params['pluginId'];
    const { sort = 'created_at', order = 'desc', limit = '20', offset = '0', } = req.query;
    // Validate sort column
    const allowedSorts = ['created_at', 'rating', 'helpful_count'];
    const sortCol = validateIdentifier(allowedSorts.includes(sort) ? sort : 'created_at', 'marketplace-reviews.list-sort');
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const result = await req.dbClient.query(`
      SELECT
        r.id, r.rating, r.title, r.review_text, r.is_verified_install,
        r.helpful_count, r.created_at, r.updated_at,
        e.first_name || ' ' || e.last_name as reviewer_name
      FROM plugin_reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE r.plugin_id = $1 AND r.tenant_id = $2 AND r.status = 'published'
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT $3 OFFSET $4
    `, [
        pluginId,
        tenantId,
        safeParseInt(limit, { fallback: 50 }),
        safeParseInt(offset, { fallback: 0 }),
    ]);
    // Get rating breakdown
    const breakdownResult = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_reviews,
        ROUND(AVG(rating), 2) as avg_rating,
        COUNT(*) FILTER (WHERE rating = 5) as five_star,
        COUNT(*) FILTER (WHERE rating = 4) as four_star,
        COUNT(*) FILTER (WHERE rating = 3) as three_star,
        COUNT(*) FILTER (WHERE rating = 2) as two_star,
        COUNT(*) FILTER (WHERE rating = 1) as one_star
      FROM plugin_reviews
      WHERE plugin_id = $1 AND tenant_id = $2 AND status = 'published'
    `, [pluginId, tenantId]);
    res.json({
        success: true,
        data: {
            reviews: result.rows,
            summary: breakdownResult.rows[0],
        },
        meta: {
            total: parseInt(breakdownResult.rows[0]?.total_reviews),
            limit: safeParseInt(limit, { fallback: 50 }),
            offset: safeParseInt(offset, { fallback: 0 }),
        },
    });
}));
/**
 * GET /api/v1/marketplace/reviews/:id
 * Get a single review
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT
        r.*,
        e.first_name || ' ' || e.last_name as reviewer_name,
        p.name as plugin_name
      FROM plugin_reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      LEFT JOIN plugins p ON r.plugin_id = p.id
      WHERE r.id = $1 AND r.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Review');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /api/v1/marketplace/reviews
 * Create a review for a plugin
 */
router.post('/', validate(createReviewSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { plugin_id, user_id, rating, title, review_text } = req.body;
    if (!plugin_id || !user_id || rating === undefined) {
        throw Errors.badRequest('plugin_id, user_id, and rating are required');
    }
    // Validate rating range
    const ratingNum = parseInt(rating);
    if (ratingNum < 1 || ratingNum > 5) {
        throw Errors.badRequest('Rating must be between 1 and 5');
    }
    // Check if plugin exists
    const pluginCheck = await req.dbClient.query('SELECT id FROM plugins WHERE id = $1', [
        plugin_id,
    ]);
    if (pluginCheck.rows.length === 0) {
        throw Errors.badRequest('Plugin not found');
    }
    // Check if user already reviewed this plugin (UNIQUE on plugin_id, user_id)
    const existingReview = await req.dbClient.query(`SELECT id FROM plugin_reviews
       WHERE plugin_id = $1 AND user_id = $2`, [plugin_id, user_id]);
    if (existingReview.rows.length > 0) {
        throw Errors.conflict('You have already reviewed this plugin');
    }
    // Check if the user has the plugin installed (verified purchase)
    const installCheck = await req.dbClient.query(`SELECT id FROM plugin_installations
       WHERE plugin_id = $1 AND tenant_id = $2 AND status IN ('active', 'disabled')`, [plugin_id, tenantId]);
    const isVerifiedPurchase = installCheck.rows.length > 0;
    const result = await req.dbClient.query(`
      INSERT INTO plugin_reviews (
        tenant_id, plugin_id, user_id, rating, title, review_text,
        is_verified_install, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'published')
      RETURNING *
    `, [
        tenantId,
        plugin_id,
        user_id,
        ratingNum,
        title || null,
        review_text || null,
        isVerifiedPurchase,
    ]);
    // Update plugin average rating and count
    await req.dbClient.query(`
      UPDATE plugins
      SET
        avg_rating = (
          SELECT ROUND(AVG(rating), 2) FROM plugin_reviews
          WHERE plugin_id = $1 AND status = 'published'
        ),
        total_ratings = (
          SELECT COUNT(*) FROM plugin_reviews
          WHERE plugin_id = $1 AND status = 'published'
        ),
        updated_at = NOW()
      WHERE id = $1
    `, [plugin_id]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * PUT /api/v1/marketplace/reviews/:id
 * Update a review
 */
router.put('/:id', validate(updateReviewSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const { rating, title, review_text } = req.body;
    // Verify review exists and belongs to tenant
    const existing = await req.dbClient.query('SELECT id, plugin_id FROM plugin_reviews WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Review');
    }
    // Validate rating if provided
    if (rating !== undefined) {
        const ratingNum = parseInt(rating);
        if (ratingNum < 1 || ratingNum > 5) {
            throw Errors.badRequest('Rating must be between 1 and 5');
        }
    }
    const result = await req.dbClient.query(`
      UPDATE plugin_reviews SET
        rating = COALESCE($3, rating),
        title = COALESCE($4, title),
        review_text = COALESCE($5, review_text),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `, [id, tenantId, rating || null, title || null, review_text || null]);
    // Update plugin average rating
    const pluginId = existing.rows[0]?.plugin_id;
    await req.dbClient.query(`
      UPDATE plugins
      SET
        avg_rating = (
          SELECT ROUND(AVG(rating), 2) FROM plugin_reviews
          WHERE plugin_id = $1 AND status = 'published'
        ),
        updated_at = NOW()
      WHERE id = $1
    `, [pluginId]);
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * DELETE /api/v1/marketplace/reviews/:id
 * Delete a review (soft delete - set status to hidden)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id, plugin_id FROM plugin_reviews WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Review');
    }
    await req.dbClient.query(`
      UPDATE plugin_reviews
      SET status = 'hidden', updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    // Update plugin average rating
    const pluginId = existing.rows[0]?.plugin_id;
    await req.dbClient.query(`
      UPDATE plugins
      SET
        avg_rating = (
          SELECT ROUND(AVG(rating), 2) FROM plugin_reviews
          WHERE plugin_id = $1 AND status = 'published'
        ),
        total_ratings = (
          SELECT COUNT(*) FROM plugin_reviews
          WHERE plugin_id = $1 AND status = 'published'
        ),
        updated_at = NOW()
      WHERE id = $1
    `, [pluginId]);
    res.json({ success: true, message: 'Review deleted' });
}));
/**
 * POST /api/v1/marketplace/reviews/:id/helpful
 * Mark a review as helpful (increment helpful_count)
 */
router.post('/:id/helpful', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      UPDATE plugin_reviews
      SET helpful_count = helpful_count + 1
      WHERE id = $1 AND tenant_id = $2 AND status = 'published'
      RETURNING id, helpful_count
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Review');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
export default router;
//# sourceMappingURL=marketplace-reviews.js.map