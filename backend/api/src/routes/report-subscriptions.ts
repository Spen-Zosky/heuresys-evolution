/**
 * Report Subscriptions Routes
 * Epic 7 - Story 7.3: Scheduled Reports & Subscriptions
 *
 * API for managing report subscriptions and scheduled deliveries
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import {
  createReportSubscriptionSchema,
  updateReportSubscriptionSchema,
} from '../schemas/report-subscriptions.js';
import { reportSubscriptionsService } from '../services/report-subscriptions.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

// ============================================================================
// Subscription CRUD
// ============================================================================

/**
 * GET /report-subscriptions
 * List subscriptions
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      report_id,
      user_id,
      is_active,
      page = '1',
      page_size = '20',
    } = req.query as Record<string, string>;

    const filters: {
      report_id?: string;
      user_id?: string;
      is_active?: boolean;
      page?: number;
      page_size?: number;
    } = {
      page: parseInt(page as string),
      page_size: parseInt(page_size as string),
    };
    if (report_id) filters.report_id = report_id as string;
    if (user_id) filters.user_id = user_id as string;
    if (is_active !== undefined) filters.is_active = is_active === 'true';

    const { subscriptions, total } = await reportSubscriptionsService.listSubscriptions(
      tenantId,
      filters
    );

    res.json({
      success: true,
      data: subscriptions,
      meta: {
        total,
        page: parseInt(page as string),
        page_size: parseInt(page_size as string),
        total_pages: Math.ceil(total / parseInt(page_size as string)),
      },
    });
  })
);

/**
 * GET /report-subscriptions/:id
 * Get subscription details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const subscription = await reportSubscriptionsService.getSubscription(tenantId, id);

    if (!subscription) {
      throw Errors.notFound('Subscription');
    }

    res.json({ success: true, data: subscription });
  })
);

/**
 * POST /report-subscriptions
 * Create new subscription
 */
router.post(
  '/',
  validate(createReportSubscriptionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { report_id, name, description, schedule, delivery, parameters, filters, created_by } =
      req.body;

    // Validate required fields
    if (!report_id || !name || !schedule || !delivery) {
      throw Errors.badRequest('report_id, name, schedule, and delivery are required');
    }

    // Validate schedule
    if (!schedule.frequency || !schedule.time) {
      throw Errors.badRequest('schedule must include frequency and time');
    }

    // Validate delivery
    if (!delivery.methods || !Array.isArray(delivery.methods) || delivery.methods.length === 0) {
      throw Errors.badRequest('delivery must include at least one method');
    }

    const subscription = await reportSubscriptionsService.createSubscription({
      tenant_id: tenantId,
      report_id,
      name,
      description,
      schedule,
      delivery,
      parameters,
      filters,
      created_by: created_by || 'system',
    });

    res.status(201).json({
      success: true,
      data: subscription,
      message: 'Subscription created successfully',
    });
  })
);

/**
 * PATCH /report-subscriptions/:id
 * Update subscription
 */
router.patch(
  '/:id',
  validate(updateReportSubscriptionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const subscription = await reportSubscriptionsService.updateSubscription(
      tenantId,
      id,
      req.body
    );

    if (!subscription) {
      throw Errors.notFound('Subscription');
    }

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription updated successfully',
    });
  })
);

/**
 * DELETE /report-subscriptions/:id
 * Delete subscription
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const deleted = await reportSubscriptionsService.deleteSubscription(tenantId, id);

    if (!deleted) {
      throw Errors.notFound('Subscription');
    }

    res.json({ success: true, message: 'Subscription deleted successfully' });
  })
);

// ============================================================================
// Subscription Actions
// ============================================================================

/**
 * POST /report-subscriptions/:id/pause
 * Pause subscription
 */
router.post(
  '/:id/pause',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const subscription = await reportSubscriptionsService.pauseSubscription(tenantId, id);

    if (!subscription) {
      throw Errors.notFound('Subscription');
    }

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription paused successfully',
    });
  })
);

/**
 * POST /report-subscriptions/:id/resume
 * Resume subscription
 */
router.post(
  '/:id/resume',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const subscription = await reportSubscriptionsService.resumeSubscription(tenantId, id);

    if (!subscription) {
      throw Errors.notFound('Subscription');
    }

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription resumed successfully',
    });
  })
);

/**
 * POST /report-subscriptions/:id/trigger
 * Manually trigger subscription run
 */
router.post(
  '/:id/trigger',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await reportSubscriptionsService.triggerNow(tenantId, id);

    res.json({
      success: true,
      data: result,
      message: 'Subscription triggered successfully',
    });
  })
);

// ============================================================================
// Delivery History
// ============================================================================

/**
 * GET /report-subscriptions/:id/history
 * Get delivery history
 */
router.get(
  '/:id/history',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { limit = '50' } = req.query as Record<string, string>;

    const history = await reportSubscriptionsService.getDeliveryHistory(
      tenantId,
      id,
      safeParseInt(limit as string, { fallback: 50 })
    );

    res.json({ success: true, data: history });
  })
);

/**
 * GET /report-subscriptions/:id/stats
 * Get delivery statistics for a subscription
 */
router.get(
  '/:id/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const stats = await reportSubscriptionsService.getDeliveryStats(tenantId, id);

    res.json({ success: true, data: stats });
  })
);

/**
 * GET /report-subscriptions/stats/overview
 * Get overall delivery statistics
 */
router.get(
  '/stats/overview',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const stats = await reportSubscriptionsService.getDeliveryStats(tenantId);

    res.json({ success: true, data: stats });
  })
);

export default router;
