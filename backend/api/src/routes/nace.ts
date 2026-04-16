/**
 * NACE/ATECO Classification API Routes
 * Provides endpoints for industry classifications (unified hierarchy)
 * Migrated from nace_sections/divisions/groups to industry_classifications
 */

import { Router, Request, Response } from 'express';
import { cached } from '../services/cache.js';
import { validate } from '../middleware/validate.js';
import { naceDivisionsQuerySchema, naceGroupsQuerySchema } from '../schemas/workforce-analytics.js';
import { asyncHandler } from '../errors/middleware.js';

const router = Router();

/**
 * GET /nace/sections
 * Get all NACE sections (level 1)
 */
router.get(
  '/sections',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;

    const data = await cached(
      'nace:sections',
      async () => {
        const result = await dbClient.query(`
        SELECT code, name_it, name_en, description_it AS description, icon, color, is_active
        FROM industry_classifications
        WHERE level = 1 AND is_active = true
        ORDER BY code
      `);
        return result.rows;
      },
      3600
    );

    res.json({ success: true, data });
  })
);

/**
 * GET /nace/divisions
 * Get NACE divisions (level 2), optionally filtered by section
 */
router.get(
  '/divisions',
  validate(naceDivisionsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { section } = req.query as Record<string, string>;
    const cacheKey = section ? `nace:divisions:${section}` : 'nace:divisions:all';

    const data = await cached(
      cacheKey,
      async () => {
        let query = `
        SELECT code, parent_code AS section_code, name_it, name_en, description_it AS description, is_active
        FROM industry_classifications
        WHERE level = 2 AND is_active = true
      `;
        const params: string[] = [];

        if (section) {
          query += ` AND parent_code = $1`;
          params.push(String(section));
        }

        query += ` ORDER BY code`;
        const result = await dbClient.query(query, params);
        return result.rows;
      },
      3600
    );

    res.json({ success: true, data });
  })
);

/**
 * GET /nace/groups
 * Get NACE groups (level 3), optionally filtered by division
 */
router.get(
  '/groups',
  validate(naceGroupsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { division } = req.query as Record<string, string>;
    const cacheKey = division ? `nace:groups:${division}` : 'nace:groups:all';

    const data = await cached(
      cacheKey,
      async () => {
        let query = `
          SELECT code, parent_code AS division_code, name_it, name_en, description_it AS description, is_active
          FROM industry_classifications
          WHERE level = 3 AND is_active = true
        `;
        const params: string[] = [];

        if (division) {
          query += ` AND parent_code = $1`;
          params.push(String(division));
        }

        query += ` ORDER BY code`;
        const result = await dbClient.query(query, params);
        return result.rows;
      },
      3600
    );

    res.json({ success: true, data });
  })
);

/**
 * GET /nace/size-classes
 * Get available company size classes
 */
router.get(
  '/size-classes',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;

    const result = await dbClient.query(`
      SELECT code, name_it, name_en, min_employees, max_employees, sort_order
      FROM company_sizes
      WHERE is_active = true
      ORDER BY sort_order
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * GET /nace/hierarchy
 * Get full NACE hierarchy for cascading dropdowns
 */
router.get(
  '/hierarchy',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;

    const [sections, divisions, groups] = await Promise.all([
      dbClient.query(`
        SELECT code, name_it, name_en, icon, color
        FROM industry_classifications
        WHERE level = 1 AND is_active = true
        ORDER BY code
      `),
      dbClient.query(`
        SELECT code, parent_code AS section_code, name_it, name_en
        FROM industry_classifications
        WHERE level = 2 AND is_active = true
        ORDER BY code
      `),
      dbClient.query(`
        SELECT code, parent_code AS division_code, name_it, name_en
        FROM industry_classifications
        WHERE level = 3 AND is_active = true
        ORDER BY code
      `),
    ]);

    res.json({
      success: true,
      data: {
        sections: sections.rows,
        divisions: divisions.rows,
        groups: groups.rows,
      },
    });
  })
);

export default router;
