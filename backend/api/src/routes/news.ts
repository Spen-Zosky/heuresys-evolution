/**
 * Company News Portal API Routes
 * Internal communications and news management
 */

import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { buildMeta } from '../utils/pagination.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  createArticleSchema,
  updateArticleSchema,
  createReactionSchema,
  createCommentSchema,
} from '../schemas/engagement.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

// Helper to get user ID from request
const getUserId = (req: Request): string | null => {
  return (req as AuthenticatedRequest).user?.userId || null;
};

// Helper to generate slug
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
};

/**
 * GET /news
 * List news articles with pagination
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const limit = safeParseInt(req.query.limit as string, { fallback: 20, max: 100 });
    const offset = safeParseInt(req.query.offset as string, { fallback: 0 });
    const status = (req.query.status as string) || 'published';

    const [countResult, dataResult] = await Promise.all([
      req.dbClient!.query(
        `SELECT COUNT(*) as total FROM news_articles WHERE tenant_id = $1 AND status = $2`,
        [tenantId, status]
      ),
      req.dbClient!.query(
        `SELECT na.id, na.title, na.slug, na.excerpt, na.status, na.is_featured,
                na.is_pinned, na.audience_type, na.cover_image_url, na.created_at
         FROM news_articles na
         WHERE na.tenant_id = $1 AND na.status = $2
         ORDER BY na.is_pinned DESC, na.created_at DESC
         LIMIT $3 OFFSET $4`,
        [tenantId, status, limit, offset]
      ),
    ]);

    res.json({
      success: true,
      data: dataResult.rows,
      meta: buildMeta(parseInt(countResult.rows[0]?.total), limit, offset),
    });
  })
);

/**
 * GET /news/categories
 * Get all news categories
 */
router.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;

    const result = await dbClient.query(
      `
      SELECT id, name, slug, description, icon, color, parent_id, sort_order
      FROM news_categories
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY sort_order, name
    `,
      [tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * GET /news/articles
 * Get published articles with pagination
 */
router.get(
  '/articles',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const userId = getUserId(req);
    const { category, featured, page = '1', limit = '10' } = req.query as Record<string, string>;
    // Note: tag filtering can be added later if needed

    const pageNum = safeParseInt(page as string, { fallback: 1 });
    const limitNum = safeParseInt(limit as string, { fallback: 10, max: 50 });
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT
        a.id,
        a.title,
        a.slug,
        a.excerpt,
        a.cover_image_url,
        a.is_featured,
        a.is_pinned,
        a.published_at,
        a.views_count,
        json_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'color', c.color) as category,
        json_build_object('id', u.id, 'name', CONCAT(e.first_name, ' ', e.last_name)) as author,
        (SELECT COUNT(*) FROM news_reactions r WHERE r.article_id = a.id) as reactions_count,
        (SELECT COUNT(*) FROM news_comments cm WHERE cm.article_id = a.id AND cm.is_hidden = false) as comments_count,
        EXISTS(SELECT 1 FROM news_reads nr WHERE nr.article_id = a.id AND nr.user_id = $2) as is_read,
        EXISTS(SELECT 1 FROM news_bookmarks nb WHERE nb.article_id = a.id AND nb.user_id = $2) as is_bookmarked
      FROM news_articles a
      LEFT JOIN news_categories c ON a.category_id = c.id
      JOIN users u ON a.author_id = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE a.tenant_id = $1 AND a.status = 'published'
    `;

    const params: (string | number)[] = [tenantId, userId as string];
    let paramIndex = 3;

    if (category) {
      query += ` AND c.slug = $${paramIndex}`;
      params.push(category as string);
      paramIndex++;
    }

    if (featured === 'true') {
      query += ` AND a.is_featured = true`;
    }

    // Count total — build a separate count query to avoid parameter mismatch
    let countQuery = `
      SELECT COUNT(*) as total
      FROM news_articles a
      LEFT JOIN news_categories c ON a.category_id = c.id
      WHERE a.tenant_id = $1 AND a.status = 'published'
    `;
    const countParams: (string | number)[] = [tenantId];
    let countParamIndex = 2;

    if (category) {
      countQuery += ` AND c.slug = $${countParamIndex}`;
      countParams.push(category as string);
      countParamIndex++;
    }

    if (featured === 'true') {
      countQuery += ` AND a.is_featured = true`;
    }

    const countResult = await dbClient.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Order and paginate
    query += `
      ORDER BY a.is_pinned DESC, a.published_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limitNum, offset);

    const result = await dbClient.query(query, params);

    res.json({
      success: true,
      data: {
        articles: result.rows,
        meta: buildMeta(total, limitNum, (pageNum - 1) * limitNum),
      },
    });
  })
);

/**
 * GET /news/articles/:id
 * Get single article by ID or slug
 */
router.get(
  '/articles/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const userId = getUserId(req);
    const { id } = req.params as Record<string, string>;

    if (!id) {
      throw Errors.badRequest('Article ID required');
    }

    // Check if id is UUID or slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const result = await dbClient.query(
      `
      SELECT
        a.*,
        json_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'color', c.color) as category,
        json_build_object(
          'id', u.id,
          'name', CONCAT(e.first_name, ' ', e.last_name),
          'job_title', e.job_title
        ) as author,
        COALESCE((
          SELECT json_object_agg(type, cnt)
          FROM (SELECT type, COUNT(*) as cnt FROM news_reactions WHERE article_id = a.id GROUP BY type) r
        ), '{}'::json) as reactions,
        (SELECT type FROM news_reactions WHERE article_id = a.id AND user_id = $3) as my_reaction,
        EXISTS(SELECT 1 FROM news_bookmarks WHERE article_id = a.id AND user_id = $3) as is_bookmarked
      FROM news_articles a
      LEFT JOIN news_categories c ON a.category_id = c.id
      JOIN users u ON a.author_id = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE a.tenant_id = $1 AND ${isUuid ? 'a.id = $2' : 'a.slug = $2'}
    `,
      [tenantId, id, userId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Article', id);
    }

    const article = result.rows[0];

    // Get tags
    const tagsResult = await dbClient.query(
      `
      SELECT t.name, t.slug
      FROM news_tags t
      JOIN news_article_tags at ON t.id = at.tag_id
      WHERE at.article_id = $1
    `,
      [article.id]
    );

    article.tags = tagsResult.rows;

    // Mark as read if user is logged in
    if (userId) {
      await dbClient.query(
        `
        INSERT INTO news_reads (tenant_id, article_id, user_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (article_id, user_id) DO UPDATE SET read_at = NOW()
      `,
        [tenantId, article.id, userId]
      );
    }

    res.json({
      success: true,
      data: article,
    });
  })
);

/**
 * POST /news/articles
 * Create new article (admin/author only)
 */
router.post(
  '/articles',
  validate(createArticleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const userId = getUserId(req);
    const {
      title,
      content,
      excerpt,
      cover_image_url,
      category_id,
      tags,
      is_featured,
      is_pinned,
      allow_comments,
      requires_acknowledgment,
      audience_type,
      audience_ids,
      publish_at,
      status,
    } = req.body;

    if (!title || !content) {
      throw Errors.badRequest('Title and content are required');
    }

    const slug = generateSlug(title) + '-' + Date.now().toString(36);

    const finalStatus = status || (publish_at ? 'scheduled' : 'draft');
    const publishedAt = finalStatus === 'published' ? new Date() : null;

    const result = await dbClient.query(
      `
      INSERT INTO news_articles (
        tenant_id, author_id, title, slug, excerpt, content, cover_image_url,
        category_id, is_featured, is_pinned, allow_comments, requires_acknowledgment,
        audience_type, audience_ids, publish_at, published_at, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `,
      [
        tenantId,
        userId,
        title,
        slug,
        excerpt || null,
        content,
        cover_image_url || null,
        category_id || null,
        is_featured || false,
        is_pinned || false,
        allow_comments !== false,
        requires_acknowledgment || false,
        audience_type || 'all',
        JSON.stringify(audience_ids || []),
        publish_at || null,
        publishedAt,
        finalStatus,
      ]
    );

    const articleId = result.rows[0]?.id;

    // Handle tags
    if (tags && Array.isArray(tags)) {
      for (const tagName of tags) {
        const tagSlug = generateSlug(tagName);
        // Upsert tag
        const tagResult = await dbClient.query(
          `
          INSERT INTO news_tags (tenant_id, name, slug)
          VALUES ($1, $2, $3)
          ON CONFLICT (tenant_id, slug) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `,
          [tenantId, tagName, tagSlug]
        );

        // Link to article
        await dbClient.query(
          `
          INSERT INTO news_article_tags (article_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `,
          [articleId, tagResult.rows[0]?.id]
        );
      }
    }

    res.status(201).json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

/**
 * PUT /news/articles/:id
 * Update article
 */
router.put(
  '/articles/:id',
  validate(updateArticleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const { id } = req.params as Record<string, string>;
    const {
      title,
      content,
      excerpt,
      cover_image_url,
      category_id,
      is_featured,
      is_pinned,
      allow_comments,
      requires_acknowledgment,
      audience_type,
      audience_ids,
      publish_at,
      status,
    } = req.body;

    // Check if publishing
    let publishedAt = null;
    if (status === 'published') {
      const existing = await dbClient.query(
        'SELECT published_at FROM news_articles WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      if (existing.rows[0] && !existing.rows[0].published_at) {
        publishedAt = new Date();
      }
    }

    await dbClient.query(
      `
      UPDATE news_articles
      SET
        title = COALESCE($3, title),
        content = COALESCE($4, content),
        excerpt = COALESCE($5, excerpt),
        cover_image_url = COALESCE($6, cover_image_url),
        category_id = COALESCE($7, category_id),
        is_featured = COALESCE($8, is_featured),
        is_pinned = COALESCE($9, is_pinned),
        allow_comments = COALESCE($10, allow_comments),
        requires_acknowledgment = COALESCE($11, requires_acknowledgment),
        audience_type = COALESCE($12, audience_type),
        audience_ids = COALESCE($13, audience_ids),
        publish_at = COALESCE($14, publish_at),
        status = COALESCE($15, status),
        published_at = COALESCE($16, published_at),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `,
      [
        id,
        tenantId,
        title,
        content,
        excerpt,
        cover_image_url,
        category_id,
        is_featured,
        is_pinned,
        allow_comments,
        requires_acknowledgment,
        audience_type,
        audience_ids ? JSON.stringify(audience_ids) : null,
        publish_at,
        status,
        publishedAt,
      ]
    );

    res.json({ success: true });
  })
);

/**
 * DELETE /news/articles/:id
 * Delete or archive article
 */
router.delete(
  '/articles/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const { id } = req.params as Record<string, string>;
    const { archive } = req.query as Record<string, string>;

    if (archive === 'true') {
      await dbClient.query(
        `
        UPDATE news_articles
        SET status = 'archived', archived_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
      `,
        [id, tenantId]
      );
    } else {
      await dbClient.query(
        `
        DELETE FROM news_articles WHERE id = $1 AND tenant_id = $2
      `,
        [id, tenantId]
      );
    }

    res.json({ success: true });
  })
);

/**
 * POST /news/articles/:id/reactions
 * Add or update reaction
 */
router.post(
  '/articles/:id/reactions',
  validate(createReactionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const userId = getUserId(req);
    const { id } = req.params as Record<string, string>;
    const { type } = req.body;

    if (!userId) {
      throw Errors.unauthorized('Authentication required');
    }

    if (!type) {
      // Remove reaction
      await dbClient.query(
        `
        DELETE FROM news_reactions
        WHERE article_id = $1 AND user_id = $2 AND tenant_id = $3
      `,
        [id, userId, tenantId]
      );
    } else {
      // Add/update reaction
      await dbClient.query(
        `
        INSERT INTO news_reactions (tenant_id, article_id, user_id, type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (article_id, user_id) DO UPDATE SET type = EXCLUDED.type, created_at = NOW()
      `,
        [tenantId, id, userId, type]
      );
    }

    res.json({ success: true });
  })
);

/**
 * GET /news/articles/:id/comments
 * Get article comments
 */
router.get(
  '/articles/:id/comments',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const { id } = req.params as Record<string, string>;

    const result = await dbClient.query(
      `
      SELECT
        c.id,
        c.content,
        c.parent_id,
        c.created_at,
        json_build_object(
          'id', u.id,
          'name', CONCAT(e.first_name, ' ', e.last_name),
          'job_title', e.job_title
        ) as author
      FROM news_comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE c.article_id = $1 AND c.tenant_id = $2 AND c.is_hidden = false
      ORDER BY c.created_at ASC
    `,
      [id, tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * POST /news/articles/:id/comments
 * Add comment
 */
router.post(
  '/articles/:id/comments',
  validate(createCommentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const userId = getUserId(req);
    const { id } = req.params as Record<string, string>;
    const { content, parent_id } = req.body;

    if (!userId) {
      throw Errors.unauthorized('Authentication required');
    }

    if (!content?.trim()) {
      throw Errors.badRequest('Content is required');
    }

    const result = await dbClient.query(
      `
      INSERT INTO news_comments (tenant_id, article_id, user_id, parent_id, content)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
      [tenantId, id, userId, parent_id || null, content.trim()]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

/**
 * POST /news/articles/:id/bookmark
 * Toggle bookmark
 */
router.post(
  '/articles/:id/bookmark',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const userId = getUserId(req);
    const { id } = req.params as Record<string, string>;

    if (!userId) {
      throw Errors.unauthorized('Authentication required');
    }

    // Check if bookmark exists
    const existing = await dbClient.query(
      `
      SELECT id FROM news_bookmarks WHERE article_id = $1 AND user_id = $2
    `,
      [id, userId]
    );

    if (existing.rows.length > 0) {
      // Remove bookmark
      await dbClient.query(
        `
        DELETE FROM news_bookmarks WHERE article_id = $1 AND user_id = $2
      `,
        [id, userId]
      );
      res.json({ success: true, bookmarked: false });
    } else {
      // Add bookmark
      await dbClient.query(
        `
        INSERT INTO news_bookmarks (tenant_id, article_id, user_id)
        VALUES ($1, $2, $3)
      `,
        [tenantId, id, userId]
      );
      res.json({ success: true, bookmarked: true });
    }
  })
);

/**
 * POST /news/articles/:id/acknowledge
 * Acknowledge required reading
 */
router.post(
  '/articles/:id/acknowledge',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const userId = getUserId(req);
    const { id } = req.params as Record<string, string>;

    if (!userId) {
      throw Errors.unauthorized('Authentication required');
    }

    await dbClient.query(
      `
      INSERT INTO news_reads (tenant_id, article_id, user_id, acknowledged_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (article_id, user_id)
      DO UPDATE SET acknowledged_at = NOW()
    `,
      [tenantId, id, userId]
    );

    res.json({ success: true });
  })
);

/**
 * GET /news/bookmarks
 * Get user's bookmarked articles
 */
router.get(
  '/bookmarks',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const userId = getUserId(req);

    if (!userId) {
      throw Errors.unauthorized('Authentication required');
    }

    const result = await dbClient.query(
      `
      SELECT
        a.id,
        a.title,
        a.slug,
        a.excerpt,
        a.cover_image_url,
        a.published_at,
        json_build_object('id', c.id, 'name', c.name, 'slug', c.slug) as category,
        b.created_at as bookmarked_at
      FROM news_bookmarks b
      JOIN news_articles a ON b.article_id = a.id
      LEFT JOIN news_categories c ON a.category_id = c.id
      WHERE b.user_id = $1 AND b.tenant_id = $2 AND a.status = 'published'
      ORDER BY b.created_at DESC
    `,
      [userId, tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * GET /news/unread-count
 * Get count of unread articles
 */
router.get(
  '/unread-count',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const userId = getUserId(req);

    if (!userId) {
      res.json({ success: true, data: { count: 0 } });
      return;
    }

    const result = await dbClient.query(
      `
      SELECT COUNT(*) as count
      FROM news_articles a
      WHERE a.tenant_id = $1 AND a.status = 'published'
        AND NOT EXISTS (
          SELECT 1 FROM news_reads nr
          WHERE nr.article_id = a.id AND nr.user_id = $2
        )
    `,
      [tenantId, userId]
    );

    res.json({
      success: true,
      data: { count: parseInt(result.rows[0]?.count) },
    });
  })
);

/**
 * GET /news/analytics
 * Get news analytics (admin)
 */
router.get(
  '/analytics',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;

    const statsResult = await dbClient.query(
      `
      SELECT
        (SELECT COUNT(*) FROM news_articles WHERE tenant_id = $1 AND status = 'published') as total_articles,
        (SELECT SUM(views_count) FROM news_articles WHERE tenant_id = $1) as total_views,
        (SELECT COUNT(*) FROM news_reactions WHERE tenant_id = $1) as total_reactions,
        (SELECT COUNT(*) FROM news_comments WHERE tenant_id = $1 AND is_hidden = false) as total_comments
    `,
      [tenantId]
    );

    const topArticlesResult = await dbClient.query(
      `
      SELECT id, title, views_count, published_at
      FROM news_articles
      WHERE tenant_id = $1 AND status = 'published'
      ORDER BY views_count DESC
      LIMIT 5
    `,
      [tenantId]
    );

    const viewsByCategoryResult = await dbClient.query(
      `
      SELECT c.name as category, SUM(a.views_count) as views
      FROM news_articles a
      JOIN news_categories c ON a.category_id = c.id
      WHERE a.tenant_id = $1 AND a.status = 'published'
      GROUP BY c.name
      ORDER BY views DESC
    `,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        ...(statsResult.rows[0] || {}),
        top_articles: topArticlesResult.rows,
        views_by_category: viewsByCategoryResult.rows,
      },
    });
  })
);

export default router;
