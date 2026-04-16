/**
 * Error Analytics API Routes
 *
 * Endpoints for error monitoring, analytics, and pattern detection.
 */

import { Router, Request, Response } from 'express';
// ADMIN-POOL: Error analytics aggregates across all tenants for SUPERUSER — no tenant scope
import { pool } from '../config/database.js';
import { asyncHandler, sendSuccess, sendPaginatedSuccess, Errors } from '../errors/index.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import { resolveErrorPatternSchema } from '../schemas/compensation-extended.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

/**
 * Get error statistics overview
 * GET /api/v1/error-analytics/stats
 */
router.get(
  '/stats',
  authMiddleware,
  requirePermission('PLATFORM', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = (req as AuthenticatedRequest).user?.tenantId;
    const isSuperuser = (req as AuthenticatedRequest).user?.role === 'SUPERUSER';

    const period = (req.query.period as string) || '24h';
    const periodMap: Record<string, string> = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };
    const interval = periodMap[period] || '24 hours';

    // Run all stats queries in parallel — they are independent reads
    const queryParams = isSuperuser ? [interval] : [interval, tenantId];
    const tenantFilter = isSuperuser ? '' : 'AND tenant_id = $2';

    const [result, byCategoryResult, topErrorsResult] = await Promise.all([
      pool.query(
        `
    SELECT
      COUNT(*) AS total_errors,
      COUNT(DISTINCT code) AS unique_error_codes,
      COUNT(DISTINCT user_id) AS affected_users,
      COUNT(*) FILTER (WHERE severity = 'CRITICAL') AS critical_count,
      COUNT(*) FILTER (WHERE severity = 'ERROR') AS error_count,
      COUNT(*) FILTER (WHERE severity = 'WARNING') AS warning_count,
      COUNT(*) FILTER (WHERE severity = 'INFO') AS info_count
    FROM error_logs
    WHERE created_at >= NOW() - $1::interval
      ${tenantFilter}
  `,
        queryParams
      ),
      pool.query(
        `
    SELECT
      category,
      COUNT(*) AS count
    FROM error_logs
    WHERE created_at >= NOW() - $1::interval
      ${tenantFilter}
    GROUP BY category
    ORDER BY count DESC
  `,
        queryParams
      ),
      pool.query(
        `
    SELECT
      code,
      message,
      COUNT(*) AS count
    FROM error_logs
    WHERE created_at >= NOW() - $1::interval
      ${tenantFilter}
    GROUP BY code, message
    ORDER BY count DESC
    LIMIT 10
  `,
        queryParams
      ),
    ]);

    sendSuccess(res, {
      period,
      summary: {
        totalErrors: parseInt(result.rows[0]?.total_errors || '0'),
        uniqueErrorCodes: parseInt(result.rows[0]?.unique_error_codes || '0'),
        affectedUsers: parseInt(result.rows[0]?.affected_users || '0'),
      },
      bySeverity: {
        critical: parseInt(result.rows[0]?.critical_count || '0'),
        error: parseInt(result.rows[0]?.error_count || '0'),
        warning: parseInt(result.rows[0]?.warning_count || '0'),
        info: parseInt(result.rows[0]?.info_count || '0'),
      },
      byCategory: byCategoryResult.rows.reduce((acc: Record<string, number>, row: any) => {
        acc[row.category] = parseInt(row.count);
        return acc;
      }, {}),
      topErrors: topErrorsResult.rows.map((row: Record<string, any>) => ({
        code: row.code,
        message: row.message,
        count: parseInt(row.count),
      })),
    });
  })
);

/**
 * Get recent errors
 * GET /api/v1/error-analytics/recent
 */
router.get(
  '/recent',
  authMiddleware,
  requirePermission('PLATFORM', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = (req as AuthenticatedRequest).user?.tenantId;
    const isSuperuser = (req as AuthenticatedRequest).user?.role === 'SUPERUSER';

    const page = safeParseInt(req.query.page as string, { fallback: 1 });
    const pageSize = safeParseInt(req.query.pageSize as string, { fallback: 20, max: 100 });
    const offset = (page - 1) * pageSize;

    const severity = req.query.severity as string;
    const category = req.query.category as string;

    let whereClause = `WHERE created_at >= NOW() - INTERVAL '7 days'`;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (!isSuperuser) {
      whereClause += ` AND tenant_id = $${paramIndex++}`;
      params.push(tenantId!);
    }

    if (severity) {
      whereClause += ` AND severity = $${paramIndex++}`;
      params.push((severity as string).toUpperCase());
    }

    if (category) {
      whereClause += ` AND category = $${paramIndex++}`;
      params.push(category.toUpperCase());
    }

    // Run count and data queries in parallel — they are independent reads
    const [countResult, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM error_logs ${whereClause}`, params),
      pool.query(
        `
    SELECT
      el.id,
      el.error_id,
      el.code,
      el.category,
      el.severity,
      el.message,
      el.http_status,
      el.request_method,
      el.request_path,
      el.tenant_id,
      t.name AS tenant_name,
      el.user_id,
      u.username,
      el.details,
      el.created_at
    FROM error_logs el
    LEFT JOIN tenants t ON el.tenant_id = t.id
    LEFT JOIN users u ON el.user_id = u.id
    ${whereClause}
    ORDER BY el.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `,
        [...params, pageSize, offset]
      ),
    ]);
    const total = parseInt(countResult.rows[0]?.count);

    sendPaginatedSuccess(res, result.rows, { page, pageSize, total });
  })
);

/**
 * Get error details
 * GET /api/v1/error-analytics/:errorId
 */
router.get(
  '/:errorId',
  authMiddleware,
  requirePermission('PLATFORM', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const { errorId } = req.params as Record<string, string>;
    const tenantId = (req as AuthenticatedRequest).user?.tenantId;
    const isSuperuser = (req as AuthenticatedRequest).user?.role === 'SUPERUSER';

    const result = await pool.query(
      `
    SELECT
      el.*,
      t.name AS tenant_name,
      u.username
    FROM error_logs el
    LEFT JOIN tenants t ON el.tenant_id = t.id
    LEFT JOIN users u ON el.user_id = u.id
    WHERE el.error_id = $1
      ${isSuperuser ? '' : 'AND el.tenant_id = $2'}
  `,
      isSuperuser ? [errorId] : [errorId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Error log', errorId);
    }

    sendSuccess(res, result.rows[0]);
  })
);

/**
 * Get error trends (hourly aggregated data)
 * GET /api/v1/error-analytics/trends
 */
router.get(
  '/trends/hourly',
  authMiddleware,
  requirePermission('PLATFORM', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = (req as AuthenticatedRequest).user?.tenantId;
    const isSuperuser = (req as AuthenticatedRequest).user?.role === 'SUPERUSER';

    const hours = safeParseInt(req.query.hours as string, { fallback: 24, max: 168 }); // Max 7 days

    const result = await pool.query(
      `
    SELECT
      hour_start,
      category,
      severity,
      SUM(error_count) AS error_count,
      SUM(unique_errors) AS unique_errors,
      SUM(affected_users) AS affected_users
    FROM error_analytics_hourly
    WHERE hour_start >= NOW() - ($1 || ' hours')::interval
      ${isSuperuser ? '' : 'AND tenant_id = $2'}
    GROUP BY hour_start, category, severity
    ORDER BY hour_start DESC
  `,
      isSuperuser ? [hours] : [hours, tenantId]
    );

    sendSuccess(res, {
      hours,
      data: result.rows,
    });
  })
);

/**
 * Detect error spikes
 * GET /api/v1/error-analytics/spikes
 */
router.get(
  '/spikes/detect',
  authMiddleware,
  requirePermission('PLATFORM', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = (req as AuthenticatedRequest).user?.tenantId;
    const isSuperuser = (req as AuthenticatedRequest).user?.role === 'SUPERUSER';

    const threshold = parseFloat(req.query.threshold as string) || 2.0;
    const minErrors = safeParseInt(req.query.minErrors as string, { fallback: 5 });

    const result = await pool.query(
      `
    SELECT * FROM detect_error_spike($1, $2)
    ${isSuperuser ? '' : 'WHERE tenant_id = $3'}
    ORDER BY spike_ratio DESC
  `,
      isSuperuser ? [threshold, minErrors] : [threshold, minErrors, tenantId]
    );

    sendSuccess(res, {
      threshold,
      minErrors,
      spikes: result.rows.map((row: Record<string, any>) => ({
        category: row.category,
        severity: row.severity,
        tenantId: row.tenant_id,
        currentHourCount: parseInt(row.current_hour_count),
        avgHourlyCount: parseFloat(row.avg_hourly_count),
        spikeRatio: parseFloat(row.spike_ratio),
      })),
    });
  })
);

/**
 * Get error patterns
 * GET /api/v1/error-analytics/patterns
 */
router.get(
  '/patterns/list',
  authMiddleware,
  requirePermission('PLATFORM', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = (req as AuthenticatedRequest).user?.tenantId;
    const isSuperuser = (req as AuthenticatedRequest).user?.role === 'SUPERUSER';

    const includeResolved = req.query.includeResolved === 'true';

    const result = await pool.query(
      `
    SELECT
      ep.*,
      u.username AS resolved_by_username
    FROM error_patterns ep
    LEFT JOIN users u ON ep.resolved_by = u.id
    WHERE ($1 OR ep.is_resolved = false)
      ${isSuperuser ? '' : 'AND $2 = ANY(ep.affected_tenants)'}
    ORDER BY ep.last_seen DESC
    LIMIT 50
  `,
      isSuperuser ? [includeResolved] : [includeResolved, tenantId]
    );

    sendSuccess(res, result.rows);
  })
);

/**
 * Resolve an error pattern
 * PATCH /api/v1/error-analytics/patterns/:id/resolve
 */
router.patch(
  '/patterns/:id/resolve',
  authMiddleware,
  requirePermission('PLATFORM', 'EDIT'),
  validate(resolveErrorPatternSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as Record<string, string>;
    const { resolutionNotes } = req.body;
    const userId = (req as AuthenticatedRequest).user?.userId;

    const result = await pool.query(
      `
    UPDATE error_patterns
    SET
      is_resolved = true,
      resolution_notes = $2,
      resolved_at = NOW(),
      resolved_by = $3,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,
      [id, resolutionNotes, userId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Error pattern', id);
    }

    sendSuccess(res, result.rows[0]);
  })
);

/**
 * Get aggregated error data
 * GET /api/v1/error-analytics/aggregate
 */
router.get(
  '/aggregate',
  authMiddleware,
  requirePermission('PLATFORM', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = (req as AuthenticatedRequest).user?.tenantId;
    const isSuperuser = (req as AuthenticatedRequest).user?.role === 'SUPERUSER';

    const period = (req.query.period as string) || '24h';
    const periodMap: Record<string, string> = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };
    const interval = periodMap[period] || '24 hours';

    const result = await pool.query(
      `
      SELECT
        hour_start,
        category,
        severity,
        SUM(error_count) AS error_count,
        SUM(unique_errors) AS unique_errors,
        SUM(affected_users) AS affected_users
      FROM error_analytics_hourly
      WHERE hour_start >= NOW() - $1::interval
        ${isSuperuser ? '' : 'AND tenant_id = $2'}
      GROUP BY hour_start, category, severity
      ORDER BY hour_start DESC
      LIMIT 200
    `,
      isSuperuser ? [interval] : [interval, tenantId]
    );

    sendSuccess(res, {
      period,
      data: result.rows,
      meta: { count: result.rows.length },
    });
  })
);

/**
 * Trigger hourly aggregation manually (SUPERUSER only)
 * POST /api/v1/error-analytics/aggregate
 */
router.post(
  '/aggregate',
  authMiddleware,
  requirePermission('PLATFORM', 'CREATE'),
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await pool.query(`
    SELECT aggregate_errors_hourly() AS rows_processed
  `);

    sendSuccess(res, {
      message: 'Aggregation completed',
      rowsProcessed: result.rows[0]?.rows_processed,
    });
  })
);

/**
 * Get error count by HTTP status
 * GET /api/v1/error-analytics/by-status
 */
router.get(
  '/by-status',
  authMiddleware,
  requirePermission('PLATFORM', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = (req as AuthenticatedRequest).user?.tenantId;
    const isSuperuser = (req as AuthenticatedRequest).user?.role === 'SUPERUSER';

    const period = (req.query.period as string) || '24h';
    const periodMap: Record<string, string> = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };
    const interval = periodMap[period] || '24 hours';

    const result = await pool.query(
      `
    SELECT
      http_status,
      COUNT(*) AS count
    FROM error_logs
    WHERE created_at >= NOW() - $1::interval
      ${isSuperuser ? '' : 'AND tenant_id = $2'}
    GROUP BY http_status
    ORDER BY count DESC
  `,
      isSuperuser ? [interval] : [interval, tenantId]
    );

    sendSuccess(res, {
      period,
      data: result.rows.map((row: Record<string, any>) => ({
        httpStatus: row.http_status,
        count: parseInt(row.count),
      })),
    });
  })
);

export default router;
