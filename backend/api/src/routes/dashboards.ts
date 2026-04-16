/**
 * Dashboard Routes
 * Epic 7 - Story 7.2: Dashboard Widget Framework
 *
 * Dashboard and widget management API
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { dashboardWidgetService } from '../services/dashboard-widgets.js';
import type { WidgetType } from '../services/dashboard-widgets.js';
import { validate } from '../middleware/validate.js';
import {
  createWidgetTemplateSchema,
  createDashboardSchema,
  updateDashboardSchema,
  duplicateDashboardSchema,
  addWidgetSchema,
  updateWidgetSchema,
  updateWidgetPositionsSchema,
} from '../schemas/platform.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

// ============================================================================
// Dashboard Statistics
// ============================================================================

/**
 * GET /dashboards/stats
 * Get dashboard statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { user_id } = req.query as Record<string, string>;

    const stats = await dashboardWidgetService.getDashboardStats(tenantId, user_id as string);

    res.json({ success: true, data: stats });
  })
);

/**
 * GET /dashboards/popular-widgets
 * Get most used widget templates
 */
router.get(
  '/popular-widgets',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { limit = '10' } = req.query as Record<string, string>;

    const widgets = await dashboardWidgetService.getPopularWidgets(
      tenantId,
      safeParseInt(limit as string, { fallback: 50 })
    );

    res.json({ success: true, data: widgets });
  })
);

// ============================================================================
// Widget Templates
// ============================================================================

/**
 * GET /dashboards/templates
 * Get available widget templates
 */
router.get(
  '/templates',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { category, type, include_system = 'true' } = req.query as Record<string, string>;

    const templates = await dashboardWidgetService.getWidgetTemplates(tenantId, {
      category: category as string,
      ...(type ? { type: type as WidgetType } : {}),
      include_system: include_system === 'true',
    });

    res.json({ success: true, data: templates });
  })
);

/**
 * POST /dashboards/templates
 * Create a custom widget template
 */
router.post(
  '/templates',
  validate(createWidgetTemplateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { name, description, category, default_config, created_by } = req.body;

    if (!name || !category || !default_config) {
      throw Errors.badRequest('name, category, and default_config are required');
    }

    const template = await dashboardWidgetService.createWidgetTemplate(tenantId, {
      name,
      description,
      category,
      default_config,
      created_by: created_by || 'system',
    });

    res.status(201).json({
      success: true,
      data: template,
      message: 'Widget template created successfully',
    });
  })
);

// ============================================================================
// Dashboard CRUD
// ============================================================================

/**
 * GET /dashboards
 * List dashboards
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      user_id,
      include_public = 'true',
      search,
      page = '1',
      page_size = '20',
    } = req.query as Record<string, string>;

    if (!user_id) {
      throw Errors.badRequest('user_id is required');
    }

    const { dashboards, total } = await dashboardWidgetService.listDashboards(
      tenantId,
      user_id as string,
      {
        include_public: include_public === 'true',
        search: search as string,
        page: parseInt(page as string),
        page_size: parseInt(page_size as string),
      }
    );

    res.json({
      success: true,
      data: dashboards,
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
 * GET /dashboards/:id
 * Get dashboard by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { user_id } = req.query as Record<string, string>;

    const dashboard = await dashboardWidgetService.getDashboard(tenantId, id, user_id as string);

    if (!dashboard) {
      throw Errors.notFound('Dashboard');
    }

    res.json({ success: true, data: dashboard });
  })
);

/**
 * POST /dashboards
 * Create a new dashboard
 */
router.post(
  '/',
  validate(createDashboardSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { name, description, layout_type, is_default, is_shared, shared_with, created_by } =
      req.body;

    if (!name || !created_by) {
      throw Errors.badRequest('name and created_by are required');
    }

    const dashboard = await dashboardWidgetService.createDashboard({
      tenant_id: tenantId,
      name,
      description,
      layout_type,
      is_default,
      is_shared,
      shared_with,
      created_by,
    });

    res.status(201).json({
      success: true,
      data: dashboard,
      message: 'Dashboard created successfully',
    });
  })
);

/**
 * PATCH /dashboards/:id
 * Update dashboard
 */
router.patch(
  '/:id',
  validate(updateDashboardSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { user_id, ...updates } = req.body;

    if (!user_id) {
      throw Errors.badRequest('user_id is required');
    }

    const dashboard = await dashboardWidgetService.updateDashboard(tenantId, id, user_id, updates);

    if (!dashboard) {
      throw Errors.notFound('Dashboard');
    }

    res.json({
      success: true,
      data: dashboard,
      message: 'Dashboard updated successfully',
    });
  })
);

/**
 * DELETE /dashboards/:id
 * Delete dashboard
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { user_id } = req.query as Record<string, string>;

    if (!user_id) {
      throw Errors.badRequest('user_id is required');
    }

    const deleted = await dashboardWidgetService.deleteDashboard(tenantId, id, user_id as string);

    if (!deleted) {
      throw Errors.notFound('Dashboard');
    }

    res.json({ success: true, message: 'Dashboard deleted successfully' });
  })
);

/**
 * POST /dashboards/:id/duplicate
 * Duplicate a dashboard
 */
router.post(
  '/:id/duplicate',
  validate(duplicateDashboardSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { name, user_id } = req.body;

    if (!name || !user_id) {
      throw Errors.badRequest('name and user_id are required');
    }

    const dashboard = await dashboardWidgetService.duplicateDashboard(tenantId, id, user_id, name);

    res.status(201).json({
      success: true,
      data: dashboard,
      message: 'Dashboard duplicated successfully',
    });
  })
);

// ============================================================================
// Dashboard Widgets
// ============================================================================

/**
 * GET /dashboards/:id/widgets
 * Get widgets for a dashboard
 */
router.get(
  '/:id/widgets',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const widgets = await dashboardWidgetService.getWidgets(tenantId, id);

    res.json({ success: true, data: widgets });
  })
);

/**
 * POST /dashboards/:id/widgets
 * Add widget to dashboard
 */
router.post(
  '/:id/widgets',
  validate(addWidgetSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { template_id, config, position, created_by } = req.body;

    if (!config || !position || !created_by) {
      throw Errors.badRequest('config, position, and created_by are required');
    }

    const widget = await dashboardWidgetService.addWidget({
      dashboard_id: id,
      tenant_id: tenantId,
      template_id,
      config,
      position,
      created_by,
    });

    res.status(201).json({
      success: true,
      data: widget,
      message: 'Widget added successfully',
    });
  })
);

/**
 * PATCH /dashboards/:id/widgets/:widgetId
 * Update widget
 */
router.patch(
  '/:id/widgets/:widgetId',
  validate(updateWidgetSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const widgetId = req.params['widgetId'] as string;
    const { config, position } = req.body;

    const widget = await dashboardWidgetService.updateWidget(tenantId, widgetId, {
      config,
      position,
    });

    if (!widget) {
      throw Errors.notFound('Widget');
    }

    res.json({
      success: true,
      data: widget,
      message: 'Widget updated successfully',
    });
  })
);

/**
 * DELETE /dashboards/:id/widgets/:widgetId
 * Delete widget
 */
router.delete(
  '/:id/widgets/:widgetId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const widgetId = req.params['widgetId'] as string;

    const deleted = await dashboardWidgetService.deleteWidget(tenantId, widgetId);

    if (!deleted) {
      throw Errors.notFound('Widget');
    }

    res.json({ success: true, message: 'Widget deleted successfully' });
  })
);

/**
 * PUT /dashboards/:id/widgets/positions
 * Update multiple widget positions (batch update for drag/drop)
 */
router.put(
  '/:id/widgets/positions',
  validate(updateWidgetPositionsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { positions } = req.body;

    if (!positions || !Array.isArray(positions)) {
      throw Errors.badRequest('positions array is required');
    }

    await dashboardWidgetService.updateWidgetPositions(tenantId, id, positions);

    res.json({ success: true, message: 'Widget positions updated successfully' });
  })
);

// ============================================================================
// Widget Data
// ============================================================================

/**
 * GET /dashboards/:id/data
 * Fetch data for all widgets in dashboard
 */
router.get(
  '/:id/data',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const dataMap = await dashboardWidgetService.fetchDashboardData(tenantId, id);

    // Convert Map to object for JSON response
    const data: Record<string, any> = {};
    dataMap.forEach((value, key) => {
      data[key] = value;
    });

    res.json({ success: true, data });
  })
);

/**
 * GET /dashboards/:id/widgets/:widgetId/data
 * Fetch data for a specific widget
 */
router.get(
  '/:id/widgets/:widgetId/data',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const widgetId = req.params['widgetId'] as string;

    const widgets = await dashboardWidgetService.getWidgets(tenantId, id);
    const widget = widgets.find((w) => w.id === widgetId);

    if (!widget) {
      throw Errors.notFound('Widget');
    }

    const data = await dashboardWidgetService.fetchWidgetData(tenantId, widget);

    res.json({ success: true, data });
  })
);

export default router;
