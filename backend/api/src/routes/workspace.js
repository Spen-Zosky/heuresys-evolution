/**
 * Workspace Routes
 * Personal workspace (scrivania) API — user workspace + widget data
 */
import { Router } from 'express';
import { requireTenant } from '../middleware/tenantContext.js';
import { authMiddleware } from '../middleware/auth.js';
import { ROLES } from '../middleware/auth.js';
import { pool } from '../config/database.js';
import { asyncHandler } from '../errors/middleware.js';
const router = Router();
// All workspace routes require auth + tenant
router.use(authMiddleware);
router.use(requireTenant);
// ============================================================================
// Helper: resolve dashboard_id from ?dashboard=<code> query param.
// Returns null when the caller does not specify one (legacy "default" scope).
// ============================================================================
async function resolveDashboardId(dashboardCode) {
    if (!dashboardCode || typeof dashboardCode !== 'string')
        return null;
    const row = await pool.query(`SELECT id FROM rbp_dashboards WHERE code = $1 LIMIT 1`, [dashboardCode]);
    return row.rows[0]?.id ?? null;
}
// ============================================================================
// GET /me — User's workspace (or role-default template fallback)
// Supports ?dashboard=<code> to return the workspace scoped to that dashboard.
// When the parameter is omitted, falls back to the legacy "default" workspace
// (dashboard_id IS NULL) for backward compatibility.
// ============================================================================
router.get('/me', asyncHandler(async (req, res) => {
    const authReq = req;
    const userId = authReq.user.userId;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const roleLevel = ROLES[authReq.user.role] ?? ROLES.EMPLOYEE;
    const dashboardId = await resolveDashboardId(req.query.dashboard);
    // 1. Try user's personal workspace with joined widgets.
    // When a dashboard is explicitly requested we match only that scope;
    // otherwise we pick the user's default (legacy NULL-scoped) workspace.
    const userWs = await pool.query(`SELECT uw.id, uw.name, uw.layout_config, uw.dashboard_id,
              COALESCE(
                json_agg(
                  json_build_object(
                    'code', wc.code,
                    'name', wc.name,
                    'widget_type', wc.widget_type,
                    'x', ww.position_x,
                    'y', ww.position_y,
                    'w', ww.width,
                    'h', ww.height,
                    'config_override', ww.config_override,
                    'title_override', ww.title_override,
                    'is_visible', ww.is_visible,
                    'cache_ttl_seconds', wc.cache_ttl_seconds,
                    'swr_seconds', wc.swr_seconds
                  ) ORDER BY ww.sort_order
                ) FILTER (WHERE wc.id IS NOT NULL),
                '[]'::json
              ) AS widgets
       FROM user_workspaces uw
       LEFT JOIN workspace_widgets ww ON ww.workspace_id = uw.id AND ww.is_visible = true
       LEFT JOIN widget_catalog wc ON wc.id = ww.widget_catalog_id AND wc.is_active = true
       WHERE uw.user_id = $1
         AND uw.tenant_id = $2
         AND uw.dashboard_id IS NOT DISTINCT FROM $3::int
       GROUP BY uw.id
       ORDER BY uw.is_default DESC, uw.updated_at DESC
       LIMIT 1`, [userId, tenantId, dashboardId]);
    if (userWs.rows.length > 0) {
        const ws = userWs.rows[0];
        return res.json({
            success: true,
            data: {
                source: 'user',
                id: ws.id,
                name: ws.name,
                layout: ws.layout_config ?? { columns: 12, gap: 16 },
                widgets: ws.widgets,
            },
        });
    }
    // 2. Fallback: role-default template
    //    Map roleLevel (-1..6) to rbp_roles.id via hierarchy_level
    const roleRow = await pool.query(`SELECT id FROM rbp_roles WHERE hierarchy_level = $1 LIMIT 1`, [roleLevel]);
    const roleId = roleRow.rows[0]?.id;
    if (roleId) {
        const tmpl = await pool.query(`SELECT id, name, name_it, name_en, layout_config, widget_config
         FROM workspace_templates
         WHERE target_role_id = $1
           AND (tenant_id = $2 OR tenant_id IS NULL)
           AND is_active = true
         ORDER BY tenant_id DESC NULLS LAST
         LIMIT 1`, [roleId, tenantId]);
        if (tmpl.rows.length > 0) {
            const t = tmpl.rows[0];
            // widget_config is a JSONB array from the template with layout data.
            // Map widget_code → code for frontend compatibility.
            const rawWidgets = Array.isArray(t.widget_config) ? t.widget_config : [];
            const codes = rawWidgets
                .map((w) => w.widget_code || w.code)
                .filter(Boolean);
            // Batch-fetch cache_ttl_seconds + swr_seconds from widget_catalog (P9)
            // using ANY($1) to avoid N+1 queries. The cacheMap is keyed by widget code
            // so the subsequent mapping can enrich each widget with its SWR settings.
            const cacheRows = codes.length > 0
                ? (await pool.query(`SELECT code, cache_ttl_seconds, swr_seconds FROM widget_catalog WHERE code = ANY($1)`, [codes])).rows
                : [];
            const cacheMap = new Map(cacheRows.map((r) => [r.code, r]));
            const widgets = rawWidgets.map((w) => {
                const code = (w.widget_code || w.code);
                const cache = cacheMap.get(code);
                return {
                    code,
                    x: w.x,
                    y: w.y,
                    w: w.w,
                    h: w.h,
                    cache_ttl_seconds: cache?.cache_ttl_seconds ?? 0,
                    swr_seconds: cache?.swr_seconds ?? 0,
                };
            });
            return res.json({
                success: true,
                data: {
                    source: 'template',
                    id: t.id,
                    name: t.name,
                    layout: t.layout_config ?? { columns: 12, gap: 16 },
                    widgets,
                },
            });
        }
    }
    // 3. Empty workspace
    return res.json({
        success: true,
        data: {
            source: 'empty',
            layout: { columns: 12, gap: 16 },
            widgets: [],
        },
    });
}));
// ============================================================================
// GET /widget/:code/data — Per-widget data fetcher
// ============================================================================
router.get('/widget/:code/data', asyncHandler(async (req, res) => {
    const authReq = req;
    const code = req.params.code;
    const userId = authReq.user.userId;
    const employeeId = authReq.user.employeeId;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const data = await fetchWidgetData(code, { userId, employeeId, tenantId });
    return res.json({ success: true, data });
}));
// ============================================================================
// Widget composer endpoints (TASK-13)
// GET /catalog            — list widget_catalog entries for the composer UI
// POST /me/widgets        — add a widget to current user's workspace
// DELETE /me/widgets/:code — remove a widget from current user's workspace
// ============================================================================
router.get('/catalog', asyncHandler(async (_req, res) => {
    const result = await pool.query(`SELECT code, name, description, name_it, name_en, description_it, description_en,
              widget_type, functional_area_code
         FROM widget_catalog
        WHERE is_active = true
        ORDER BY COALESCE(functional_area_code, 'ZZZ'), name`);
    return res.json({ success: true, data: result.rows });
}));
/**
 * Ensures the user has a workspace row scoped to the given dashboard.
 * When dashboardId is null the legacy "default" (NULL-scoped) row is used.
 * Creates one with layout_config = { columns: 12, gap: 16 } if missing.
 */
async function ensureDashboardWorkspace(userId, tenantId, dashboardId) {
    const existing = await pool.query(`SELECT id FROM user_workspaces
      WHERE user_id = $1
        AND tenant_id = $2
        AND dashboard_id IS NOT DISTINCT FROM $3::int
      ORDER BY is_default DESC, updated_at DESC
      LIMIT 1`, [userId, tenantId, dashboardId]);
    if (existing.rows.length > 0)
        return existing.rows[0].id;
    let resolvedName = 'My Workspace';
    if (dashboardId) {
        const dashRow = await pool.query(`SELECT name FROM rbp_dashboards WHERE id = $1 LIMIT 1`, [dashboardId]);
        const fetched = dashRow.rows[0]?.name;
        resolvedName = fetched ? fetched : `Workspace dashboard ${dashboardId}`;
    }
    const created = await pool.query(`INSERT INTO user_workspaces
       (user_id, tenant_id, dashboard_id, name, is_default, is_active, layout_config)
     VALUES ($1, $2, $3, $4, true, true, '{"columns": 12, "gap": 16}'::jsonb)
     RETURNING id`, [userId, tenantId, dashboardId, resolvedName]);
    return created.rows[0].id;
}
/**
 * GET /my-dashboards — list of dashboards the user can compose a workspace for.
 * Used by the composer UI to render its dashboard switcher. The list is the
 * union of (a) all active rbp_dashboards, (b) a virtual "default" entry with
 * dashboard_id null that represents the legacy unscoped workspace.
 */
router.get('/my-dashboards', asyncHandler(async (_req, res) => {
    const result = await pool.query(`SELECT id, code, name, name_it, name_en, icon
         FROM rbp_dashboards
        WHERE is_active = true
        ORDER BY sort_order, code`);
    return res.json({ success: true, data: result.rows });
}));
router.post('/me/widgets', asyncHandler(async (req, res) => {
    const authReq = req;
    const userId = authReq.user.userId;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const { code } = req.body;
    const dashboardId = await resolveDashboardId(req.query.dashboard);
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ success: false, error: 'code is required' });
    }
    // Resolve widget_catalog id
    const cat = await pool.query(`SELECT id FROM widget_catalog WHERE code = $1 AND is_active = true LIMIT 1`, [code]);
    if (cat.rows.length === 0) {
        return res.status(404).json({ success: false, error: `unknown widget code: ${code}` });
    }
    const widgetCatalogId = cat.rows[0].id;
    const workspaceId = await ensureDashboardWorkspace(userId, tenantId, dashboardId);
    // Is it already present? Make endpoint idempotent.
    const existing = await pool.query(`SELECT id FROM workspace_widgets
        WHERE workspace_id = $1 AND widget_catalog_id = $2
        LIMIT 1`, [workspaceId, widgetCatalogId]);
    if (existing.rows.length > 0) {
        return res.json({
            success: true,
            data: { id: existing.rows[0].id, status: 'already_present' },
        });
    }
    // Compute next sort_order
    const maxSort = await pool.query(`SELECT COALESCE(MAX(sort_order), 0)::int AS max_sort
         FROM workspace_widgets WHERE workspace_id = $1`, [workspaceId]);
    const sortOrder = (maxSort.rows[0]?.max_sort ?? 0) + 10;
    const inserted = await pool.query(`INSERT INTO workspace_widgets
         (workspace_id, widget_catalog_id, position_x, position_y, width, height,
          is_visible, sort_order)
       VALUES ($1, $2, 0, 0, 4, 3, true, $3)
       RETURNING id`, [workspaceId, widgetCatalogId, sortOrder]);
    return res.status(201).json({
        success: true,
        data: {
            id: inserted.rows[0].id,
            status: 'added',
            sort_order: sortOrder,
            dashboard_id: dashboardId,
        },
    });
}));
router.delete('/me/widgets/:code', asyncHandler(async (req, res) => {
    const authReq = req;
    const userId = authReq.user.userId;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const code = req.params.code;
    const dashboardId = await resolveDashboardId(req.query.dashboard);
    const result = await pool.query(`DELETE FROM workspace_widgets ww
         USING user_workspaces uw, widget_catalog wc
        WHERE ww.workspace_id = uw.id
          AND ww.widget_catalog_id = wc.id
          AND uw.user_id = $1
          AND uw.tenant_id = $2
          AND uw.dashboard_id IS NOT DISTINCT FROM $3::int
          AND wc.code = $4
       RETURNING ww.id`, [userId, tenantId, dashboardId, code]);
    return res.json({
        success: true,
        data: { removed: result.rowCount ?? 0, dashboard_id: dashboardId },
    });
}));
/**
 * PATCH /workspace/me/widgets/:code
 * Update position_x, position_y, width, height for a widget in the current
 * dashboard-scoped workspace. Used by the (forthcoming) DnD layout editor.
 * Body accepts any subset of { position_x, position_y, width, height,
 * is_visible, sort_order }. Missing keys are preserved.
 */
router.patch('/me/widgets/:code', asyncHandler(async (req, res) => {
    const authReq = req;
    const userId = authReq.user.userId;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const code = req.params.code;
    const dashboardId = await resolveDashboardId(req.query.dashboard);
    const body = (req.body ?? {});
    const allowed = ['position_x', 'position_y', 'width', 'height', 'is_visible', 'sort_order'];
    const sets = [];
    const params = [userId, tenantId, dashboardId, code];
    for (const key of allowed) {
        if (body[key] !== undefined) {
            params.push(body[key]);
            sets.push(`${key} = $${params.length}`);
        }
    }
    if (sets.length === 0) {
        return res.status(400).json({ success: false, error: 'no updatable fields in body' });
    }
    const result = await pool.query(`UPDATE workspace_widgets ww
          SET ${sets.join(', ')}, updated_at = NOW()
         FROM user_workspaces uw, widget_catalog wc
        WHERE ww.workspace_id = uw.id
          AND ww.widget_catalog_id = wc.id
          AND uw.user_id = $1
          AND uw.tenant_id = $2
          AND uw.dashboard_id IS NOT DISTINCT FROM $3::int
          AND wc.code = $4
       RETURNING ww.id, ww.position_x, ww.position_y, ww.width, ww.height, ww.is_visible, ww.sort_order`, params);
    if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'widget not present in workspace' });
    }
    return res.json({ success: true, data: result.rows[0] });
}));
/**
 * PATCH /workspace/me
 * Update layout_config (columns, gap) on the dashboard-scoped workspace.
 */
router.patch('/me', asyncHandler(async (req, res) => {
    const authReq = req;
    const userId = authReq.user.userId;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const dashboardId = await resolveDashboardId(req.query.dashboard);
    const layoutConfig = req.body?.layout_config;
    if (!layoutConfig || typeof layoutConfig !== 'object') {
        return res.status(400).json({ success: false, error: 'layout_config (object) required' });
    }
    const workspaceId = await ensureDashboardWorkspace(userId, tenantId, dashboardId);
    await pool.query(`UPDATE user_workspaces
          SET layout_config = $2::jsonb, updated_at = NOW()
        WHERE id = $1`, [workspaceId, JSON.stringify(layoutConfig)]);
    return res.json({ success: true, data: { id: workspaceId, layout_config: layoutConfig } });
}));
// ============================================================================
// Composer Bulk Actions (P3-15)
// ============================================================================
/**
 * POST /workspace/me/duplicate — Clone current workspace
 * Uses a transaction to ensure atomicity (fix H5).
 */
router.post('/me/duplicate', asyncHandler(async (req, res) => {
    const authReq = req;
    const userId = authReq.user.userId;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const dashboardId = await resolveDashboardId(req.query.dashboard);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Find the source workspace
        const sourceWs = await client.query(`SELECT id, name, layout_config, dashboard_id
           FROM user_workspaces
          WHERE user_id = $1
            AND tenant_id = $2
            AND dashboard_id IS NOT DISTINCT FROM $3::int
          ORDER BY is_default DESC, updated_at DESC
          LIMIT 1`, [userId, tenantId, dashboardId]);
        if (sourceWs.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'No workspace to duplicate' });
        }
        const src = sourceWs.rows[0];
        // Create new workspace row
        const newWs = await client.query(`INSERT INTO user_workspaces
           (user_id, tenant_id, dashboard_id, name, is_default, is_active, layout_config)
         VALUES ($1, $2, $3, $4, false, true, $5::jsonb)
         RETURNING id, name`, [userId, tenantId, dashboardId, `${src.name} (copy)`, JSON.stringify(src.layout_config)]);
        const newWsId = newWs.rows[0].id;
        // Copy all widgets
        const copied = await client.query(`INSERT INTO workspace_widgets
           (workspace_id, widget_catalog_id, position_x, position_y, width, height,
            is_visible, sort_order, config_override, title_override)
         SELECT $1, widget_catalog_id, position_x, position_y, width, height,
                is_visible, sort_order, config_override, title_override
           FROM workspace_widgets
          WHERE workspace_id = $2
         RETURNING id`, [newWsId, src.id]);
        await client.query('COMMIT');
        return res.status(201).json({
            success: true,
            data: {
                id: newWsId,
                name: newWs.rows[0].name,
                widgetsCopied: copied.rowCount ?? 0,
                dashboard_id: dashboardId,
            },
        });
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}));
/**
 * POST /workspace/me/reset — Reset workspace (delete all widgets)
 */
router.post('/me/reset', asyncHandler(async (req, res) => {
    const authReq = req;
    const userId = authReq.user.userId;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const dashboardId = await resolveDashboardId(req.query.dashboard);
    const result = await pool.query(`DELETE FROM workspace_widgets ww
         USING user_workspaces uw
        WHERE ww.workspace_id = uw.id
          AND uw.user_id = $1
          AND uw.tenant_id = $2
          AND uw.dashboard_id IS NOT DISTINCT FROM $3::int
       RETURNING ww.id`, [userId, tenantId, dashboardId]);
    return res.json({
        success: true,
        data: { widgetsRemoved: result.rowCount ?? 0, dashboard_id: dashboardId },
    });
}));
/**
 * GET /workspace/me/export — Export workspace as JSON
 */
router.get('/me/export', asyncHandler(async (req, res) => {
    const authReq = req;
    const userId = authReq.user.userId;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const dashboardId = await resolveDashboardId(req.query.dashboard);
    const wsResult = await pool.query(`SELECT uw.id, uw.name, uw.layout_config, uw.dashboard_id
         FROM user_workspaces uw
        WHERE uw.user_id = $1
          AND uw.tenant_id = $2
          AND uw.dashboard_id IS NOT DISTINCT FROM $3::int
        ORDER BY uw.is_default DESC, uw.updated_at DESC
        LIMIT 1`, [userId, tenantId, dashboardId]);
    if (wsResult.rows.length === 0) {
        return res.json({
            success: true,
            data: {
                workspace: {
                    layout_config: { columns: 12, gap: 16 },
                    widgets: [],
                },
            },
        });
    }
    const ws = wsResult.rows[0];
    const widgetsResult = await pool.query(`SELECT wc.code, wc.name, wc.name_it, wc.name_en, wc.widget_type,
              ww.position_x, ww.position_y, ww.width, ww.height,
              ww.is_visible, ww.sort_order, ww.config_override, ww.title_override
         FROM workspace_widgets ww
         JOIN widget_catalog wc ON wc.id = ww.widget_catalog_id
        WHERE ww.workspace_id = $1
        ORDER BY ww.sort_order`, [ws.id]);
    return res.json({
        success: true,
        data: {
            workspace: {
                name: ws.name,
                layout_config: ws.layout_config ?? { columns: 12, gap: 16 },
                dashboard_id: ws.dashboard_id,
                widgets: widgetsResult.rows,
            },
        },
    });
}));
async function fetchWidgetData(code, ctx) {
    switch (code) {
        case 'my_card':
            return fetchMyCard(ctx);
        case 'notifications_feed':
            return fetchNotifications(ctx);
        case 'my_tasks':
            return fetchMyTasks();
        case 'my_documents':
            return fetchMyDocuments(ctx);
        case 'learning_progress':
            return fetchLearningProgress(ctx);
        case 'career_path':
            return fetchCareerPath(ctx);
        case 'quick_links':
            return fetchQuickLinks();
        case 'headcount_kpi':
            return fetchHeadcountKpi(ctx);
        case 'open_positions_kpi':
            return fetchOpenPositionsKpi(ctx);
        case 'engagement_score':
            return fetchEngagementScore(ctx);
        case 'performance_scores':
            return fetchPerformanceScores(ctx);
        case 'leave_balance':
            return fetchLeaveBalance(ctx);
        case 'pending_approvals':
            return fetchPendingApprovals(ctx);
        default:
            return fetchPlaceholderMetadata(code, ctx);
    }
}
// ----------------------------------------------------------------------------
// Dedicated resolvers added in TASK-04 (6 widget bundle)
// ----------------------------------------------------------------------------
async function fetchHeadcountKpi(ctx) {
    if (!ctx.tenantId)
        return { label: 'Headcount', value: null, sublabel: null };
    try {
        const result = await pool.query(`SELECT COUNT(*)::int AS total
         FROM employees
        WHERE tenant_id = $1 AND employment_status = 'active'`, [ctx.tenantId]);
        const total = result.rows[0]?.total ?? 0;
        return {
            label: 'Dipendenti attivi',
            value: total,
            sublabel: `${total} totali`,
            icon: 'Users',
        };
    }
    catch {
        return { label: 'Headcount', value: null, sublabel: null };
    }
}
async function fetchOpenPositionsKpi(ctx) {
    if (!ctx.tenantId)
        return { label: 'Posizioni aperte', value: null };
    try {
        const result = await pool.query(`SELECT COUNT(*)::int AS total,
              COALESCE(SUM(headcount), 0)::int AS headcount_total
         FROM recruiting_requisitions
        WHERE tenant_id = $1 AND status = 'open'`, [ctx.tenantId]);
        const total = result.rows[0]?.total ?? 0;
        const headcount = result.rows[0]?.headcount_total ?? 0;
        return {
            label: 'Posizioni aperte',
            value: total,
            sublabel: `${headcount} headcount richiesti`,
            icon: 'Briefcase',
        };
    }
    catch {
        return { label: 'Posizioni aperte', value: null };
    }
}
async function fetchEngagementScore(ctx) {
    if (!ctx.tenantId)
        return { label: 'Engagement', value: null };
    try {
        const result = await pool.query(`SELECT engagement_score, respondents
         FROM v_engagement_summary
        WHERE tenant_id = $1
          AND engagement_score IS NOT NULL
        ORDER BY respondents DESC NULLS LAST
        LIMIT 1`, [ctx.tenantId]);
        const row = result.rows[0];
        if (!row) {
            return {
                label: 'Engagement',
                value: null,
                sublabel: 'Nessun sondaggio recente',
                icon: 'Heart',
            };
        }
        const score = Number(row.engagement_score);
        return {
            label: 'Engagement score',
            value: score.toFixed(1),
            sublabel: `${row.respondents ?? 0} risposte`,
            icon: 'Heart',
        };
    }
    catch {
        return { label: 'Engagement', value: null };
    }
}
async function fetchPerformanceScores(ctx) {
    if (!ctx.tenantId)
        return { label: 'Performance', value: null };
    try {
        const result = await pool.query(`SELECT
          AVG(overall_rating)::numeric(10,2) AS avg_rating,
          COUNT(*)::int                       AS reviews
         FROM performance_reviews
        WHERE tenant_id = $1
          AND overall_rating IS NOT NULL
          AND status IN ('completed', 'finalized', 'submitted', 'shared')`, [ctx.tenantId]);
        const row = result.rows[0];
        const avg = row?.avg_rating ? Number(row.avg_rating) : null;
        return {
            label: 'Performance media',
            value: avg !== null ? avg : null,
            sublabel: row?.reviews ? `${row.reviews} review valutate` : 'Nessuna review',
            icon: 'TrendingUp',
        };
    }
    catch {
        return { label: 'Performance', value: null };
    }
}
async function fetchLeaveBalance(ctx) {
    if (!ctx.employeeId || !ctx.tenantId)
        return { year: null, lines: [] };
    try {
        const currentYear = new Date().getFullYear();
        const result = await pool.query(`SELECT leave_type, balance, used_days, pending_days, year
         FROM leave_balances
        WHERE tenant_id = $1 AND employee_id = $2
          AND year = $3
        ORDER BY leave_type`, [ctx.tenantId, ctx.employeeId, currentYear]);
        return { year: currentYear, lines: result.rows };
    }
    catch {
        return { year: null, lines: [] };
    }
}
async function fetchPendingApprovals(ctx) {
    if (!ctx.userId || !ctx.tenantId)
        return { total: 0, items: [] };
    try {
        const result = await pool.query(`SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.days_requested,
              (e.first_name || ' ' || e.last_name) AS employee_name
         FROM leave_requests lr
         JOIN employees e ON e.id = lr.employee_id AND e.tenant_id = lr.tenant_id
        WHERE lr.tenant_id = $1
          AND lr.status = 'pending'
          AND lr.approver_id = $2
        ORDER BY lr.created_at DESC
        LIMIT 8`, [ctx.tenantId, ctx.userId]);
        return { total: result.rows.length, items: result.rows };
    }
    catch {
        return { total: 0, items: [] };
    }
}
/**
 * Fallback resolver for widget codes that don't have a dedicated implementation
 * yet. Reads metadata from widget_catalog and returns them so the frontend
 * GenericPlaceholder can render a coherent "coming soon" card with real
 * catalog data. Enforces P9: no hardcoded placeholder text.
 */
async function fetchPlaceholderMetadata(code, ctx) {
    if (!ctx.tenantId)
        return { placeholder: true, code, metadata: null };
    try {
        const result = await pool.query(`SELECT code, name, description, name_it, name_en, description_it, description_en,
              widget_type, data_source_type,
              icon, functional_area_code, perspective_code
         FROM widget_catalog
        WHERE code = $1 AND is_active = true
        LIMIT 1`, [code]);
        return {
            placeholder: true,
            code,
            metadata: result.rows[0] || null,
            message: result.rows[0]
                ? 'Widget non ancora implementato. Vedi widget_catalog per metadati.'
                : `Codice widget sconosciuto: ${code}`,
        };
    }
    catch {
        return { placeholder: true, code, metadata: null };
    }
}
async function fetchMyCard(ctx) {
    if (!ctx.employeeId || !ctx.tenantId)
        return { employee: null };
    try {
        const result = await pool.query(`SELECT e.id, e.first_name, e.last_name, e.email, e.job_title, e.hire_date,
              ou.name AS department_name,
              ec.contract_type, ec.annual_salary AS base_salary, ec.currency, ec.level, ec.ccnl_code
       FROM employees e
       LEFT JOIN org_units ou ON ou.code = e.department AND ou.tenant_id = e.tenant_id
       LEFT JOIN employee_contracts ec ON ec.employee_id = e.id AND ec.tenant_id = e.tenant_id AND ec.is_current = true
       WHERE e.id = $1 AND e.tenant_id = $2
       LIMIT 1`, [ctx.employeeId, ctx.tenantId]);
        return { employee: result.rows[0] ?? null };
    }
    catch {
        return { employee: null };
    }
}
async function fetchNotifications(ctx) {
    if (!ctx.userId || !ctx.tenantId)
        return { items: [] };
    try {
        const result = await pool.query(`SELECT id, type, title, message, priority, read, action_url, created_at
       FROM notifications
       WHERE user_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC
       LIMIT 5`, [ctx.userId, ctx.tenantId]);
        return { items: result.rows };
    }
    catch {
        return { items: [] };
    }
}
async function fetchMyTasks() {
    // tasks table does not exist — return empty gracefully
    return { items: [] };
}
async function fetchMyDocuments(ctx) {
    if (!ctx.employeeId || !ctx.tenantId)
        return { items: [] };
    try {
        const result = await pool.query(`SELECT id, title, document_type, category, status, created_at
       FROM employee_documents
       WHERE employee_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC
       LIMIT 5`, [ctx.employeeId, ctx.tenantId]);
        return { items: result.rows };
    }
    catch {
        return { items: [] };
    }
}
async function fetchLearningProgress(ctx) {
    if (!ctx.employeeId)
        return { total: 0, completed: 0, in_progress: 0 };
    try {
        const result = await pool.query(`SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed,
         COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress
       FROM course_enrollments
       WHERE employee_id = $1`, [ctx.employeeId]);
        const row = result.rows[0];
        return {
            total: parseInt(row.total, 10),
            completed: parseInt(row.completed, 10),
            in_progress: parseInt(row.in_progress, 10),
        };
    }
    catch {
        return { total: 0, completed: 0, in_progress: 0 };
    }
}
async function fetchCareerPath(ctx) {
    if (!ctx.employeeId || !ctx.tenantId)
        return { job_title: null, career_paths: [] };
    try {
        const empResult = await pool.query(`SELECT job_title FROM employees WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [ctx.employeeId, ctx.tenantId]);
        const jobTitle = empResult.rows[0]?.job_title ?? null;
        const pathResult = await pool.query(`SELECT cp.id, cp.name, cp.path_type
       FROM career_paths cp
       WHERE cp.tenant_id = $1 AND cp.is_active = true
       ORDER BY cp.name
       LIMIT 5`, [ctx.tenantId]);
        return { job_title: jobTitle, career_paths: pathResult.rows };
    }
    catch {
        return { job_title: null, career_paths: [] };
    }
}
async function fetchQuickLinks() {
    return {
        links: [
            { label: 'Il Mio Profilo', labelEn: 'My Profile', path: '/portal/profile', icon: 'User' },
            { label: 'Retribuzione', labelEn: 'Payroll', path: '/portal/payroll', icon: 'Gem' },
            { label: 'Valutazioni', labelEn: 'Reviews', path: '/portal/reviews', icon: 'TrendingUp' },
            { label: 'Obiettivi', labelEn: 'Goals', path: '/portal/goals', icon: 'Target' },
            { label: 'Formazione', labelEn: 'Learning', path: '/portal/learning', icon: 'BookOpen' },
            { label: 'Organigramma', labelEn: 'Org Chart', path: '/admin/org-chart', icon: 'GitBranch' },
            { label: 'AI Chat', labelEn: 'AI Chat', path: '/admin/ai', icon: 'Bot' },
        ],
    };
}
export default router;
//# sourceMappingURL=workspace.js.map