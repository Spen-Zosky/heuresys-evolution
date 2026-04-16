/**
 * Notifications Routes
 * CRUD operations for user notifications
 *
 * IMPORTANT: Route ordering matters! All literal paths (/stats, /unread, /my, /my/*)
 * must be defined BEFORE parameterized paths (/:id, /:id/read) to prevent Express
 * from matching literal segments as route parameters.
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import {
  createNotificationSchema,
  markAllReadSchema,
  updateNotificationPreferencesSchema,
} from '../schemas/engagement.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { buildMeta } from '../utils/pagination.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

// ============================================================
// LITERAL PATHS (must come before parameterized /:id routes)
// ============================================================

/**
 * GET /notifications
 * List notifications with pagination
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const limit = safeParseInt(req.query.limit as string, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset as string, { fallback: 0 });
    const unreadOnly = req.query.unread === 'true';

    const whereClause = unreadOnly ? 'AND n.read = false' : '';

    const [countResult, dataResult] = await Promise.all([
      req.dbClient!.query(
        `SELECT COUNT(*) as total FROM notifications n WHERE n.tenant_id = $1 ${whereClause}`,
        [tenantId]
      ),
      req.dbClient!.query(
        `SELECT n.id, n.type, n.title, n.message, n.priority, n.read, n.read_at,
                n.user_id, n.action_url, n.action_label, n.created_at, n.expires_at
         FROM notifications n
         WHERE n.tenant_id = $1 ${whereClause}
         ORDER BY n.created_at DESC
         LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset]
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
 * GET /notifications/stats
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE read = false) as unread,
        COUNT(*) FILTER (WHERE read = true) as read_count,
        COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
        COUNT(DISTINCT type) as notification_types
      FROM notifications WHERE tenant_id = $1
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /notifications/unread
 */
router.get(
  '/unread',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { user_id, limit = '50' } = req.query as Record<string, string>;

    let query = `
      SELECT n.id, n.type, n.title, n.message, n.priority, n.read, n.read_at,
             n.user_id, n.tenant_id, n.action_url, n.action_label, n.metadata,
             n.created_at, n.expires_at
      FROM notifications n
      WHERE n.tenant_id = $1 AND n.read = false
        AND (n.expires_at IS NULL OR n.expires_at > NOW())
    `;
    const params: (string | boolean | number)[] = [tenantId];
    let paramIndex = 2;

    if (user_id) {
      query += ` AND n.user_id = $${paramIndex}`;
      params.push(user_id as string);
      paramIndex++;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex}`;
    params.push(safeParseInt(limit as string, { fallback: 50 }));

    const result = await req.dbClient!.query(query, params);

    res.json({ success: true, data: result.rows, count: result.rows.length });
  })
);

/**
 * GET /notifications
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      user_id,
      type,
      priority,
      read,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    let query = `
      SELECT n.id, n.type, n.title, n.message, n.priority, n.read, n.read_at,
             n.user_id, n.tenant_id, n.action_url, n.action_label, n.metadata,
             n.created_at, n.expires_at
      FROM notifications n
      WHERE n.tenant_id = $1
    `;
    const params: (string | boolean | number)[] = [tenantId];
    let paramIndex = 2;

    if (user_id) {
      query += ` AND n.user_id = $${paramIndex}`;
      params.push(user_id as string);
      paramIndex++;
    }

    if (type) {
      query += ` AND n.type = $${paramIndex}`;
      params.push(type as string);
      paramIndex++;
    }

    if (priority) {
      query += ` AND n.priority = $${paramIndex}`;
      params.push(priority as string);
      paramIndex++;
    }

    if (read !== undefined) {
      query += ` AND n.read = $${paramIndex}`;
      params.push(read === 'true');
      paramIndex++;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 100 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);
    const countResult = await req.dbClient!.query(
      'SELECT COUNT(*) FROM notifications WHERE tenant_id = $1',
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
 * POST /notifications/mark-all-read
 */
router.post(
  '/mark-all-read',
  validate(markAllReadSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { user_id } = req.body;

    let query = `UPDATE notifications SET read = true, read_at = NOW() WHERE tenant_id = $1 AND read = false`;
    const params: string[] = [tenantId];

    if (user_id) {
      query += ` AND user_id = $2`;
      params.push(user_id);
    }

    const result = await req.dbClient!.query(query + ' RETURNING id', params);

    res.json({ success: true, message: `${result.rows.length} notifications marked as read` });
  })
);

// ============================================================
// USER SELF-SERVICE ENDPOINTS (/my/*)
// Must be before /:id to prevent Express matching "my" as :id
// ============================================================

/**
 * GET /notifications/my - Get current user's notifications
 */
router.get(
  '/my',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = (req as AuthenticatedRequest).user?.userId;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const { status, type, limit = '20', offset = '0' } = req.query as Record<string, string>;

    let query = `
      SELECT id, type, title, message, priority, read, read_at,
             action_url, action_label, metadata, created_at, expires_at
      FROM notifications
      WHERE user_id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
        AND (expires_at IS NULL OR expires_at > NOW())
    `;
    const params: (string | boolean | number)[] = [userId, tenantId];
    let paramIndex = 3;

    if (status === 'unread') {
      query += ` AND read = FALSE`;
    } else if (status === 'read') {
      query += ` AND read = TRUE`;
    }

    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type as string);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 20 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);

    // Get unread count
    const countResult = await req.dbClient!.query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = $1 AND read = FALSE
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        notifications: result.rows,
        unread_count: parseInt(countResult.rows[0]?.count),
      },
    });
  })
);

/**
 * GET /notifications/my/unread-count - Get unread count for current user
 */
router.get(
  '/my/unread-count',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user?.userId;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const result = await req.dbClient!.query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = $1 AND read = FALSE
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId]
    );

    res.json({
      success: true,
      data: { count: parseInt(result.rows[0]?.count) },
    });
  })
);

/**
 * GET /notifications/my/preferences - Get current user's preferences
 */
router.get(
  '/my/preferences',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user?.userId;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const result = await req.dbClient!.query(
      `SELECT id, user_id, email_enabled, in_app_enabled, goal_reminders,
              review_reminders, flight_risk_alerts, checkin_reminders,
              survey_notifications, recognition_notifications, system_notifications,
              quiet_hours_start, quiet_hours_end, created_at, updated_at,
              mentorship_notifications, mobility_notifications, wellbeing_notifications
       FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.json({
        success: true,
        data: {
          email_enabled: true,
          in_app_enabled: true,
          goal_reminders: true,
          review_reminders: true,
          flight_risk_alerts: true,
          checkin_reminders: true,
          survey_notifications: true,
          recognition_notifications: true,
          system_notifications: true,
          mentorship_notifications: true,
          mobility_notifications: true,
          wellbeing_notifications: true,
          quiet_hours_start: null,
          quiet_hours_end: null,
        },
      });
      return;
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * PUT /notifications/my/preferences - Update current user's preferences
 */
router.put(
  '/my/preferences',
  validate(updateNotificationPreferencesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user?.userId;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const {
      email_enabled,
      in_app_enabled,
      goal_reminders,
      review_reminders,
      flight_risk_alerts,
      checkin_reminders,
      survey_notifications,
      recognition_notifications,
      system_notifications,
      quiet_hours_start,
      quiet_hours_end,
      mentorship_notifications,
      mobility_notifications,
      wellbeing_notifications,
    } = req.body;

    const result = await req.dbClient!.query(
      `
      INSERT INTO notification_preferences (user_id, email_enabled, in_app_enabled, goal_reminders,
        review_reminders, flight_risk_alerts, checkin_reminders, survey_notifications,
        recognition_notifications, system_notifications, quiet_hours_start, quiet_hours_end,
        mentorship_notifications, mobility_notifications, wellbeing_notifications, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        email_enabled = EXCLUDED.email_enabled,
        in_app_enabled = EXCLUDED.in_app_enabled,
        goal_reminders = EXCLUDED.goal_reminders,
        review_reminders = EXCLUDED.review_reminders,
        flight_risk_alerts = EXCLUDED.flight_risk_alerts,
        checkin_reminders = EXCLUDED.checkin_reminders,
        survey_notifications = EXCLUDED.survey_notifications,
        recognition_notifications = EXCLUDED.recognition_notifications,
        system_notifications = EXCLUDED.system_notifications,
        quiet_hours_start = EXCLUDED.quiet_hours_start,
        quiet_hours_end = EXCLUDED.quiet_hours_end,
        mentorship_notifications = EXCLUDED.mentorship_notifications,
        mobility_notifications = EXCLUDED.mobility_notifications,
        wellbeing_notifications = EXCLUDED.wellbeing_notifications,
        updated_at = NOW()
      RETURNING *
    `,
      [
        userId,
        email_enabled,
        in_app_enabled,
        goal_reminders,
        review_reminders,
        flight_risk_alerts,
        checkin_reminders,
        survey_notifications,
        recognition_notifications,
        system_notifications,
        quiet_hours_start,
        quiet_hours_end,
        mentorship_notifications,
        mobility_notifications,
        wellbeing_notifications,
      ]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /notifications/my/:id/read - Mark notification as read for current user
 */
router.post(
  '/my/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user?.userId;
    const id = req.params['id'] as string;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    await req.dbClient!.query(
      `UPDATE notifications SET read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    res.json({ success: true, data: { read: true } });
  })
);

/**
 * POST /notifications/my/mark-all-read - Mark all as read for current user
 */
router.post(
  '/my/mark-all-read',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user?.userId;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const result = await req.dbClient!.query(
      `UPDATE notifications SET read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND read = FALSE`,
      [userId]
    );

    res.json({ success: true, data: { updated: result.rowCount } });
  })
);

/**
 * DELETE /notifications/my/:id - Delete notification for current user
 */
router.delete(
  '/my/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user?.userId;
    const id = req.params['id'] as string;

    if (!userId) {
      throw Errors.unauthorized('Unauthorized');
    }

    await req.dbClient!.query(`DELETE FROM notifications WHERE id = $1 AND user_id = $2`, [
      id,
      userId,
    ]);

    res.json({ success: true });
  })
);

// ============================================================
// PARAMETERIZED PATHS (/:id) — must come AFTER all literal paths
// ============================================================

/**
 * GET /notifications/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT n.id, n.type, n.title, n.message, n.priority, n.read, n.read_at,
             n.user_id, n.tenant_id, n.action_url, n.action_label, n.metadata,
             n.created_at, n.expires_at
      FROM notifications n
      WHERE n.id = $1 AND n.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Notification');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /notifications
 */
router.post(
  '/',
  validate(createNotificationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      type,
      title,
      message,
      priority = 'normal',
      user_id,
      action_url,
      action_label,
      metadata,
      expires_at,
    } = req.body;

    if (!type || !title || !message) {
      throw Errors.badRequest('type, title, and message are required');
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO notifications (tenant_id, type, title, message, priority, user_id,
        action_url, action_label, metadata, read, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, NOW())
      RETURNING *
    `,
      [
        tenantId,
        type,
        title,
        message,
        priority,
        user_id,
        action_url,
        action_label,
        metadata,
        expires_at,
      ]
    );

    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Notification created' });
  })
);

/**
 * PATCH /notifications/:id/read
 */
router.patch(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      UPDATE notifications SET read = true, read_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Notification');
    }

    res.json({
      success: true,
      data: result.rows[0] || null,
      message: 'Notification marked as read',
    });
  })
);

/**
 * DELETE /notifications/:id
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      'DELETE FROM notifications WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Notification');
    }

    res.json({ success: true, message: 'Notification deleted' });
  })
);

// ============================================================
// ADMIN PREFERENCES ENDPOINTS (/preferences/:userId)
// ============================================================

/**
 * GET /notifications/preferences/:userId
 */
router.get(
  '/preferences/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params['userId'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT id, user_id, email_enabled, in_app_enabled, goal_reminders,
              review_reminders, flight_risk_alerts, checkin_reminders,
              survey_notifications, recognition_notifications, system_notifications,
              quiet_hours_start, quiet_hours_end, created_at, updated_at,
              mentorship_notifications, mobility_notifications, wellbeing_notifications
       FROM notification_preferences WHERE user_id = $1
    `,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default preferences
      res.json({
        success: true,
        data: {
          user_id: userId,
          email_enabled: true,
          in_app_enabled: true,
          goal_reminders: true,
          review_reminders: true,
          checkin_reminders: true,
          system_notifications: true,
        },
      });
      return;
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * PUT /notifications/preferences/:userId
 */
router.put(
  '/preferences/:userId',
  validate(updateNotificationPreferencesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params['userId'] as string;
    const {
      email_enabled,
      in_app_enabled,
      goal_reminders,
      review_reminders,
      flight_risk_alerts,
      checkin_reminders,
      survey_notifications,
      recognition_notifications,
      system_notifications,
      quiet_hours_start,
      quiet_hours_end,
      mentorship_notifications,
      mobility_notifications,
      wellbeing_notifications,
    } = req.body;

    // Upsert preferences
    const result = await req.dbClient!.query(
      `
      INSERT INTO notification_preferences (user_id, email_enabled, in_app_enabled, goal_reminders,
        review_reminders, flight_risk_alerts, checkin_reminders, survey_notifications,
        recognition_notifications, system_notifications, quiet_hours_start, quiet_hours_end,
        mentorship_notifications, mobility_notifications, wellbeing_notifications, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        email_enabled = EXCLUDED.email_enabled,
        in_app_enabled = EXCLUDED.in_app_enabled,
        goal_reminders = EXCLUDED.goal_reminders,
        review_reminders = EXCLUDED.review_reminders,
        flight_risk_alerts = EXCLUDED.flight_risk_alerts,
        checkin_reminders = EXCLUDED.checkin_reminders,
        survey_notifications = EXCLUDED.survey_notifications,
        recognition_notifications = EXCLUDED.recognition_notifications,
        system_notifications = EXCLUDED.system_notifications,
        quiet_hours_start = EXCLUDED.quiet_hours_start,
        quiet_hours_end = EXCLUDED.quiet_hours_end,
        mentorship_notifications = EXCLUDED.mentorship_notifications,
        mobility_notifications = EXCLUDED.mobility_notifications,
        wellbeing_notifications = EXCLUDED.wellbeing_notifications,
        updated_at = NOW()
      RETURNING *
    `,
      [
        userId,
        email_enabled,
        in_app_enabled,
        goal_reminders,
        review_reminders,
        flight_risk_alerts,
        checkin_reminders,
        survey_notifications,
        recognition_notifications,
        system_notifications,
        quiet_hours_start,
        quiet_hours_end,
        mentorship_notifications,
        mobility_notifications,
        wellbeing_notifications,
      ]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Preferences updated' });
  })
);

export default router;
