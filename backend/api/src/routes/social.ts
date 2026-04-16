/**
 * Social Routes
 * Employee social feed, clubs, and recognition features
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import {
  createSocialPostSchema,
  updateSocialPostSchema,
  socialLikeSchema,
  createSocialCommentSchema,
  createClubSchema,
  joinClubSchema,
} from '../schemas/social.js';
import { withTransaction } from '../utils/transaction.js';

import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /social/feed
 * Get social feed posts
 */
router.get(
  '/feed',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      post_type,
      author_id,
      visibility,
      limit = '50',
      offset = '0',
    } = req.query as Record<string, string>;

    let query = `
      SELECT
        sp.*,
        e.first_name || ' ' || e.last_name as author_name,
        e.job_title as author_title,
        d.name as author_department
      FROM social_posts sp
      JOIN employees e ON e.id = sp.author_id
      LEFT JOIN org_units d ON d.id = e.org_unit_id
      WHERE sp.tenant_id = $1
    `;
    const params: (string | number)[] = [tenantId];
    let paramIndex = 2;

    if (post_type) {
      query += ` AND sp.post_type = $${paramIndex++}`;
      params.push(post_type as string);
    }
    if (author_id) {
      query += ` AND sp.author_id = $${paramIndex++}`;
      params.push(author_id as string);
    }
    if (visibility) {
      query += ` AND sp.visibility = $${paramIndex++}`;
      params.push(visibility as string);
    }

    // Prioritize pinned posts, then by date
    query += ` ORDER BY sp.is_pinned DESC, sp.published_at DESC NULLS LAST, sp.created_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(
      safeParseInt(limit as string, { fallback: 50 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);

    const countResult = await req.dbClient!.query(
      'SELECT COUNT(*) FROM social_posts WHERE tenant_id = $1',
      [tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: parseInt(countResult.rows[0]?.count),
        limit: safeParseInt(limit as string, { fallback: 50 }),
        offset: safeParseInt(offset as string, { fallback: 0 }),
      },
    });
  })
);

/**
 * GET /social/posts/:id
 * Get single post with comments
 */
router.get(
  '/posts/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT
        sp.*,
        e.first_name || ' ' || e.last_name as author_name,
        e.job_title as author_title
      FROM social_posts sp
      JOIN employees e ON e.id = sp.author_id
      WHERE sp.id = $1 AND sp.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Post');
    }

    // Get comments
    const comments = await req.dbClient!.query(
      `
      SELECT
        sc.*,
        e.first_name || ' ' || e.last_name as author_name
      FROM social_comments sc
      JOIN employees e ON e.id = sc.author_id
      WHERE sc.post_id = $1
      ORDER BY sc.created_at ASC
    `,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...(result.rows[0] || {}),
        comments: comments.rows,
      },
    });
  })
);

/**
 * POST /social/posts
 * Create new post
 */
router.post(
  '/posts',
  validate(createSocialPostSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      author_id,
      content,
      post_type = 'update',
      attachments,
      poll_options,
      visibility = 'all',
      target_org_units,
    } = req.body;

    if (!author_id || !content) {
      throw Errors.badRequest('author_id and content are required');
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO social_posts (
        tenant_id, author_id, content, post_type, attachments,
        poll_options, visibility, target_org_units,
        likes_count, comments_count, is_pinned,
        published_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, false, NOW(), NOW(), NOW())
      RETURNING *
    `,
      [
        tenantId,
        author_id,
        content,
        post_type,
        JSON.stringify(attachments || []),
        JSON.stringify(poll_options || null),
        visibility,
        JSON.stringify(target_org_units || []),
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * PATCH /social/posts/:id
 * Update post
 */
router.patch(
  '/posts/:id',
  validate(updateSocialPostSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM social_posts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      throw Errors.notFound('Post');
    }

    const allowedFields = ['content', 'visibility', 'is_pinned', 'pinned_until'];
    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        values.push(req.body[field]);
      }
    }

    const result = await req.dbClient!.query(
      `UPDATE social_posts SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
       RETURNING *`,
      [...values, id, tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Post updated' });
  })
);

/**
 * DELETE /social/posts/:id
 * Delete post
 */
router.delete(
  '/posts/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      'DELETE FROM social_posts WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Post');
    }

    res.json({ success: true, message: 'Post deleted' });
  })
);

/**
 * POST /social/posts/:id/like
 * Like a post
 */
router.post(
  '/posts/:id/like',
  validate(socialLikeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { employee_id } = req.body;

    if (!employee_id) {
      throw Errors.badRequest('employee_id is required');
    }

    // Verify post exists
    const postCheck = await req.dbClient!.query(
      'SELECT id FROM social_posts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (postCheck.rows.length === 0) {
      throw Errors.notFound('Post');
    }

    // Check if already liked
    const likeCheck = await req.dbClient!.query(
      'SELECT id FROM social_likes WHERE post_id = $1 AND employee_id = $2',
      [id, employee_id]
    );

    if (likeCheck.rows.length > 0) {
      throw Errors.conflict('Already liked');
    }

    // Add like and update count atomically
    await withTransaction(async (client) => {
      await client.query(
        `
        INSERT INTO social_likes (post_id, employee_id, created_at)
        VALUES ($1, $2, NOW())
      `,
        [id, employee_id]
      );

      await client.query('UPDATE social_posts SET likes_count = likes_count + 1 WHERE id = $1', [
        id,
      ]);
    }, tenantId);

    res.json({ success: true, message: 'Post liked' });
  })
);

/**
 * DELETE /social/posts/:id/like
 * Unlike a post
 */
router.delete(
  '/posts/:id/like',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { employee_id } = req.body;

    if (!employee_id) {
      throw Errors.badRequest('employee_id is required');
    }

    // Delete like and update count atomically
    const deleteResult = await withTransaction(async (client) => {
      const delResult = await client.query(
        'DELETE FROM social_likes WHERE post_id = $1 AND employee_id = $2 RETURNING id',
        [id, employee_id]
      );

      if (delResult.rows.length === 0) {
        return null;
      }

      await client.query(
        'UPDATE social_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1',
        [id]
      );

      return delResult.rows[0];
    }, tenantId);

    if (!deleteResult) {
      throw Errors.notFound('Like');
    }

    res.json({ success: true, message: 'Like removed' });
  })
);

/**
 * POST /social/posts/:id/comments
 * Add comment to post
 */
router.post(
  '/posts/:id/comments',
  validate(createSocialCommentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { author_id, content, parent_comment_id } = req.body;

    if (!author_id || !content) {
      throw Errors.badRequest('author_id and content are required');
    }

    // Verify post exists
    const postCheck = await req.dbClient!.query(
      'SELECT id FROM social_posts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (postCheck.rows.length === 0) {
      throw Errors.notFound('Post');
    }

    // Insert comment and update count atomically
    const result = await withTransaction(async (client) => {
      const insertResult = await client.query(
        `
        INSERT INTO social_comments (
          post_id, author_id, parent_comment_id, content,
          likes_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 0, NOW(), NOW())
        RETURNING *
      `,
        [id, author_id, parent_comment_id || null, content]
      );

      await client.query(
        'UPDATE social_posts SET comments_count = comments_count + 1 WHERE id = $1',
        [id]
      );

      return insertResult.rows[0];
    }, tenantId);

    res.status(201).json({ success: true, data: result });
  })
);

/**
 * GET /social/clubs
 * List employee clubs
 */
router.get(
  '/clubs',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { category, is_public, limit = '50', offset = '0' } = req.query as Record<string, string>;

    let query = `
      SELECT
        ec.*,
        owner.first_name || ' ' || owner.last_name as owner_name
      FROM employee_clubs ec
      LEFT JOIN employees owner ON owner.id = ec.owner_id
      WHERE ec.tenant_id = $1
    `;
    const params: (string | number | boolean)[] = [tenantId];
    let paramIndex = 2;

    if (category) {
      query += ` AND ec.category = $${paramIndex++}`;
      params.push(category as string);
    }
    if (is_public !== undefined) {
      query += ` AND ec.is_public = $${paramIndex++}`;
      params.push(is_public === 'true');
    }

    query += ` ORDER BY ec.members_count DESC, ec.created_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(
      safeParseInt(limit as string, { fallback: 50 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  })
);

/**
 * GET /social/clubs/:id
 * Get club details with members
 */
router.get(
  '/clubs/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT
        ec.*,
        owner.first_name || ' ' || owner.last_name as owner_name
      FROM employee_clubs ec
      LEFT JOIN employees owner ON owner.id = ec.owner_id
      WHERE ec.id = $1 AND ec.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Club');
    }

    // Get members
    const members = await req.dbClient!.query(
      `
      SELECT
        cm.*,
        e.first_name || ' ' || e.last_name as member_name,
        e.job_title
      FROM club_memberships cm
      JOIN employees e ON e.id = cm.employee_id
      WHERE cm.club_id = $1
      ORDER BY cm.joined_at
    `,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...(result.rows[0] || {}),
        members: members.rows,
      },
    });
  })
);

/**
 * POST /social/clubs
 * Create new club
 */
router.post(
  '/clubs',
  validate(createClubSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      name,
      description,
      category,
      icon,
      cover_image_url,
      is_public = true,
      requires_approval = false,
      max_members,
      owner_id,
    } = req.body;

    if (!name || !owner_id) {
      throw Errors.badRequest('name and owner_id are required');
    }

    // Create club and add owner membership atomically
    const result = await withTransaction(async (client) => {
      const insertResult = await client.query(
        `
        INSERT INTO employee_clubs (
          tenant_id, name, description, category, icon, cover_image_url,
          is_public, requires_approval, max_members, members_count,
          owner_id, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, true, NOW(), NOW())
        RETURNING *
      `,
        [
          tenantId,
          name,
          description,
          category,
          icon,
          cover_image_url,
          is_public,
          requires_approval,
          max_members,
          owner_id,
        ]
      );

      // Add owner as member
      await client.query(
        `
        INSERT INTO club_memberships (club_id, employee_id, role, status, joined_at)
        VALUES ($1, $2, 'owner', 'active', NOW())
      `,
        [insertResult.rows[0]?.id, owner_id]
      );

      return insertResult.rows[0];
    }, tenantId);

    res.status(201).json({ success: true, data: result });
  })
);

/**
 * POST /social/clubs/:id/join
 * Join a club
 */
router.post(
  '/clubs/:id/join',
  validate(joinClubSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { employee_id } = req.body;

    if (!employee_id) {
      throw Errors.badRequest('employee_id is required');
    }

    // Verify club exists
    const clubCheck = await req.dbClient!.query(
      'SELECT id, requires_approval, max_members, members_count FROM employee_clubs WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (clubCheck.rows.length === 0) {
      throw Errors.notFound('Club');
    }

    const club = clubCheck.rows[0];

    // Check max members
    if (club.max_members && club.members_count >= club.max_members) {
      throw Errors.badRequest('Club is at maximum capacity');
    }

    // Check if already member
    const memberCheck = await req.dbClient!.query(
      'SELECT id FROM club_memberships WHERE club_id = $1 AND employee_id = $2',
      [id, employee_id]
    );

    if (memberCheck.rows.length > 0) {
      throw Errors.conflict('Already a member');
    }

    const status = club.requires_approval ? 'pending' : 'active';

    // Insert membership and update count atomically
    await withTransaction(async (client) => {
      await client.query(
        `
        INSERT INTO club_memberships (club_id, employee_id, role, status, joined_at)
        VALUES ($1, $2, 'member', $3, NOW())
      `,
        [id, employee_id, status]
      );

      if (status === 'active') {
        await client.query(
          'UPDATE employee_clubs SET members_count = members_count + 1 WHERE id = $1',
          [id]
        );
      }
    }, tenantId);

    res.json({
      success: true,
      message: status === 'pending' ? 'Join request submitted' : 'Joined club successfully',
    });
  })
);

/**
 * DELETE /social/clubs/:id/leave
 * Leave a club
 */
router.delete(
  '/clubs/:id/leave',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { employee_id } = req.body;

    if (!employee_id) {
      throw Errors.badRequest('employee_id is required');
    }

    // Delete membership and update count atomically
    const leaveResult = await withTransaction(async (client) => {
      const delResult = await client.query(
        'DELETE FROM club_memberships WHERE club_id = $1 AND employee_id = $2 AND role != $3 RETURNING id',
        [id, employee_id, 'owner']
      );

      if (delResult.rows.length === 0) {
        return null;
      }

      await client.query(
        'UPDATE employee_clubs SET members_count = GREATEST(members_count - 1, 0) WHERE id = $1',
        [id]
      );

      return delResult.rows[0];
    }, tenantId);

    if (!leaveResult) {
      res
        .status(404)
        .json({ success: false, error: 'Membership not found or cannot leave as owner' });
      return;
    }

    res.json({ success: true, message: 'Left club successfully' });
  })
);

/**
 * GET /social/stats
 * Get social engagement statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const postStats = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total_posts,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as posts_this_week,
        SUM(likes_count) as total_likes,
        SUM(comments_count) as total_comments,
        COUNT(DISTINCT author_id) as unique_authors
      FROM social_posts
      WHERE tenant_id = $1
    `,
      [tenantId]
    );

    const clubStats = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total_clubs,
        COUNT(*) FILTER (WHERE is_active = true) as active_clubs,
        SUM(members_count) as total_memberships,
        AVG(members_count)::numeric(5,1) as avg_members_per_club
      FROM employee_clubs
      WHERE tenant_id = $1
    `,
      [tenantId]
    );

    const topPosts = await req.dbClient!.query(
      `
      SELECT
        sp.id,
        sp.content,
        sp.likes_count,
        sp.comments_count,
        e.first_name || ' ' || e.last_name as author_name
      FROM social_posts sp
      JOIN employees e ON e.id = sp.author_id
      WHERE sp.tenant_id = $1
      ORDER BY sp.likes_count + sp.comments_count DESC
      LIMIT 5
    `,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        posts: postStats.rows[0],
        clubs: clubStats.rows[0],
        top_posts: topPosts.rows,
      },
    });
  })
);

export default router;
