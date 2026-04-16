/**
 * ESCO Skills Routes
 * Skills taxonomy and competencies management
 *
 * NOTE: esco_skills is a global taxonomy/reference table with no tenant_id column.
 * Queries use req.dbClient for consistency with the RLS middleware chain, even though
 * these tables are not tenant-scoped. The dbClient is set by tenant context middleware.
 */

import { Router, Request, Response } from 'express';
import { escapeILIKE } from '../utils/sql-safety.js';
import { cached } from '../services/cache.js';
import { cacheControl } from '../middleware/cacheHeaders.js';
import { validate } from '../middleware/validate.js';
import { createSkillSchema, updateSkillSchema } from '../schemas/admin.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
import { pool } from '../config/database.js';

const router = Router();

// Skills taxonomy is reference data — enable HTTP caching
router.use(cacheControl('reference'));

/**
 * GET /skills/stats
 * Get skills statistics (no tenant scope - global taxonomy)
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const data = await cached(
      'skills:stats',
      async () => {
        const result = await dbClient.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE skill_type = 'skill') as skills,
          COUNT(*) FILTER (WHERE skill_type = 'knowledge') as knowledge,
          COUNT(*) FILTER (WHERE skill_type = 'competence') as competences,
          COUNT(*) FILTER (WHERE is_digital = true) as digital_skills,
          COUNT(*) FILTER (WHERE is_green = true) as green_skills
        FROM esco_skills
      `);
        const reuseLevels = await dbClient.query(`
        SELECT reuse_level, COUNT(*) as count
        FROM esco_skills
        WHERE reuse_level IS NOT NULL
        GROUP BY reuse_level
        ORDER BY count DESC
      `);
        return { ...(result.rows[0] || {}), reuse_levels: reuseLevels.rows };
      },
      600
    );

    res.json({ success: true, data });
  })
);

/**
 * GET /skills/types
 * Get skill types breakdown
 */
router.get(
  '/types',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const data = await cached(
      'skills:types',
      async () => {
        const result = await dbClient.query(`
        SELECT skill_type, COUNT(*) as count
        FROM esco_skills
        GROUP BY skill_type
        ORDER BY count DESC
      `);
        return result.rows;
      },
      600
    );

    res.json({ success: true, data });
  })
);

/**
 * GET /skills/digital
 * Get all digital skills
 */
router.get(
  '/digital',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const { limit = '100', offset = '0' } = req.query as Record<string, string>;

    const result = await dbClient.query(
      `
      SELECT id, uri, preferred_label_en, description_en, skill_type,
        reuse_level, is_digital, is_green, primary_category, is_transversal,
        created_at, updated_at
      FROM esco_skills
      WHERE is_digital = true
      ORDER BY preferred_label_en
      LIMIT $1 OFFSET $2
    `,
      [
        safeParseInt(limit as string, { fallback: 50 }),
        safeParseInt(offset as string, { fallback: 0 }),
      ]
    );

    const countResult = await dbClient.query(
      'SELECT COUNT(*) FROM esco_skills WHERE is_digital = true'
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
 * GET /skills/green
 * Get all green skills
 */
router.get(
  '/green',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const { limit = '100', offset = '0' } = req.query as Record<string, string>;

    const result = await dbClient.query(
      `
      SELECT id, uri, preferred_label_en, description_en, skill_type,
        reuse_level, is_digital, is_green, primary_category, is_transversal,
        created_at, updated_at
      FROM esco_skills
      WHERE is_green = true
      ORDER BY preferred_label_en
      LIMIT $1 OFFSET $2
    `,
      [
        safeParseInt(limit as string, { fallback: 50 }),
        safeParseInt(offset as string, { fallback: 0 }),
      ]
    );

    const countResult = await dbClient.query(
      'SELECT COUNT(*) FROM esco_skills WHERE is_green = true'
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
 * GET /skills/search
 * Search skills by label or description
 */
router.get(
  '/search',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const {
      q,
      skill_type,
      reuse_level,
      is_digital,
      is_green,
      limit = '50',
    } = req.query as Record<string, string>;

    if (!q) {
      throw Errors.badRequest('Search query (q) is required');
    }

    let query = `
      SELECT id, uri, preferred_label_en, description_en, skill_type,
        reuse_level, is_digital, is_green, primary_category, is_transversal,
        created_at, updated_at
      FROM esco_skills
      WHERE (preferred_label_en ILIKE $1 OR description_en ILIKE $1)
    `;
    const params: (string | boolean | number)[] = [`%${escapeILIKE(q as string)}%`];
    let paramIndex = 2;

    if (skill_type) {
      query += ` AND skill_type = $${paramIndex}`;
      params.push(skill_type as string);
      paramIndex++;
    }

    if (reuse_level) {
      query += ` AND reuse_level = $${paramIndex}`;
      params.push(reuse_level as string);
      paramIndex++;
    }

    if (is_digital === 'true') {
      query += ` AND is_digital = true`;
    }

    if (is_green === 'true') {
      query += ` AND is_green = true`;
    }

    query += ` ORDER BY preferred_label_en LIMIT $${paramIndex}`;
    params.push(safeParseInt(limit as string, { fallback: 50 }));

    const result = await dbClient.query(query, params);

    res.json({ success: true, data: result.rows, count: result.rows.length });
  })
);

/**
 * GET /skills
 * List all skills with filtering
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const {
      skill_type,
      reuse_level,
      is_digital,
      is_green,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    let query = `SELECT id, uri, preferred_label_en, description_en, skill_type,
        reuse_level, is_digital, is_green, primary_category, is_transversal,
        created_at, updated_at
      FROM esco_skills WHERE 1=1`;
    const params: (string | boolean | number)[] = [];
    let paramIndex = 1;

    if (skill_type) {
      query += ` AND skill_type = $${paramIndex}`;
      params.push(skill_type as string);
      paramIndex++;
    }

    if (reuse_level) {
      query += ` AND reuse_level = $${paramIndex}`;
      params.push(reuse_level as string);
      paramIndex++;
    }

    if (is_digital === 'true') {
      query += ` AND is_digital = true`;
    }

    if (is_green === 'true') {
      query += ` AND is_green = true`;
    }

    query += ` ORDER BY preferred_label_en LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 100 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await dbClient.query(query, params);
    const countResult = await dbClient.query('SELECT COUNT(*) FROM esco_skills');

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
 * GET /skills/:id
 * Get a single skill by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const id = req.params['id'] as string;

    const result = await dbClient.query(
      `SELECT id, uri, preferred_label, description, skill_type, reuse_level,
              is_digital, is_green, created_at, alt_labels, broader_uri,
              narrower_uris, related_uris, isco_groups, updated_at,
              primary_category, cognitive_level, is_classified,
              skill_group_uri, preferred_label_en, preferred_label_it,
              is_transversal, description_en, description_it, alt_labels_it
       FROM esco_skills WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Skill', id);
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /skills
 * Create a new skill (for custom skills)
 */
router.post(
  '/',
  validate(createSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const {
      uri,
      preferred_label_en,
      description_en,
      skill_type,
      reuse_level,
      is_digital = false,
      is_green = false,
    } = req.body;

    if (!uri || !preferred_label_en || !skill_type) {
      throw Errors.badRequest('uri, preferred_label_en, and skill_type are required');
    }

    const result = await dbClient.query(
      `
      INSERT INTO esco_skills (uri, preferred_label_en, description_en, skill_type, reuse_level, is_digital, is_green, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `,
      [uri, preferred_label_en, description_en, skill_type, reuse_level, is_digital, is_green]
    );

    res.status(201).json({ success: true, data: result.rows[0] || null, message: 'Skill created' });
  })
);

/**
 * PATCH /skills/:id
 * Update a skill
 */
router.patch(
  '/:id',
  validate(updateSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const id = req.params['id'] as string;

    const existing = await dbClient.query('SELECT id FROM esco_skills WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw Errors.notFound('Skill', id);
    }

    const allowedFields = [
      'uri',
      'preferred_label_en',
      'description_en',
      'skill_type',
      'reuse_level',
      'is_digital',
      'is_green',
    ];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      throw Errors.badRequest('No fields to update');
    }

    const result = await dbClient.query(
      `UPDATE esco_skills SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      [...values, id]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Skill updated' });
  })
);

/**
 * DELETE /skills/:id
 * Delete a skill
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient || pool;
    const id = req.params['id'] as string;

    const result = await dbClient.query('DELETE FROM esco_skills WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      throw Errors.notFound('Skill', id);
    }

    res.json({ success: true, message: 'Skill deleted' });
  })
);

export default router;
