/**
 * RBP Framework API Routes
 * ARCH-2026-002 v1.2
 *
 * Endpoints for the frontend to consume RBP data:
 * - GET /api/rbp/my-permissions — user's effective permissions + dashboards
 * - GET /api/rbp/dashboard/:slug/nav-items — sidebar items for a dashboard
 * - GET /api/rbp/roles — list all roles (admin only)
 * - GET /api/rbp/functional-areas — list all functional areas (admin only)
 * - POST /api/rbp/cache/invalidate — invalidate RBP cache (sysadmin only)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware as authenticateToken } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getUserPermissions,
  getDashboardNavItems,
  invalidateRbpCache,
  isRbpEnabled,
} from '../middleware/rbpMiddleware.js';
import { pool } from '../config/database.js';

const InvalidateCacheSchema = z.object({
  role: z.string().optional(),
});

const CreateTeamSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  purpose: z.string().optional(),
});

const TeamMemberSchema = z.object({
  employeeId: z.string().uuid(),
});

const BreakGlassSchema = z.object({
  targetRole: z.string().min(1),
  reason: z.string().min(1),
  durationMinutes: z.number().int().positive().optional(),
});

const DenyBreakGlassSchema = z.object({
  reason: z.string().optional(),
});

const router = Router();

// All RBP routes require authentication
router.use(authenticateToken);

/**
 * GET /api/rbp/status
 * Check if RBP framework is enabled
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({ enabled: isRbpEnabled, version: '1.2' });
});

/**
 * GET /api/rbp/my-permissions
 * Returns the effective permissions for the authenticated user's role,
 * including inherited permissions, accessible dashboards, and default path.
 */
router.get('/my-permissions', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const roleCode = authReq.user?.role;

    if (!roleCode) {
      return res.status(401).json({ error: 'Role not found in session' });
    }

    if (!isRbpEnabled) {
      return res.status(503).json({ error: 'RBP framework is not enabled' });
    }

    const permissions = await getUserPermissions(roleCode);
    return res.json(permissions);
  } catch (err) {
    console.error('[RBP] Error loading permissions:', err);
    return res.status(500).json({ error: 'Failed to load permissions' });
  }
});

/**
 * GET /api/rbp/dashboard/:slug/nav-items
 * Returns the navigation items for a specific dashboard.
 * Only returns items if the user's role has access to that dashboard.
 */
router.get('/dashboard/:slug/nav-items', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const roleCode = authReq.user?.role;
    const slug = req.params.slug as string;

    if (!slug) {
      return res.status(400).json({ error: 'Missing dashboard slug' });
    }

    // Verify user has access to this dashboard
    const accessCheck = await pool.query(
      `SELECT 1 FROM rbp_role_dashboards rd
       JOIN rbp_roles r ON r.id = rd.role_id
       JOIN rbp_dashboards d ON d.id = rd.dashboard_id
       WHERE r.code = $1 AND d.code = $2`,
      [roleCode, slug]
    );

    if (accessCheck.rows.length === 0) {
      // SUPERUSER bypass
      const roleCheck = await pool.query(`SELECT is_system_role FROM rbp_roles WHERE code = $1`, [
        roleCode,
      ]);
      if (!roleCheck.rows[0]?.is_system_role) {
        return res.status(403).json({ error: 'No access to this dashboard' });
      }
    }

    const items = await getDashboardNavItems(slug);
    return res.json({ dashboard: slug, items });
  } catch (err) {
    console.error('[RBP] Error loading nav items:', err);
    return res.status(500).json({ error: 'Failed to load navigation' });
  }
});

/**
 * GET /api/rbp/roles
 * List all roles. Requires SECURITY.VIEW permission (TENANT_OWNER+).
 */
router.get('/roles', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const roleCode = authReq.user?.role;

    // Quick role check (TENANT_OWNER or SUPERUSER)
    if (!['SUPERUSER', 'TENANT_OWNER'].includes(roleCode)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const result = await pool.query(
      `SELECT code, name, description, description_it, description_en,
              hierarchy_level, is_system_role,
              is_assignable, inherits_from, default_dashboard_code, metadata
       FROM rbp_roles ORDER BY hierarchy_level`
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('[RBP] Error loading roles:', err);
    return res.status(500).json({ error: 'Failed to load roles' });
  }
});

/**
 * GET /api/rbp/functional-areas
 * List all functional areas. Requires SECURITY.VIEW permission.
 */
router.get('/functional-areas', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const roleCode = authReq.user?.role;

    if (!['SUPERUSER', 'TENANT_OWNER'].includes(roleCode)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const result = await pool.query(
      `SELECT code, name, description, name_it, name_en, description_it, description_en,
              category, sort_order, is_active
       FROM rbp_functional_areas WHERE is_active = true ORDER BY sort_order`
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('[RBP] Error loading functional areas:', err);
    return res.status(500).json({ error: 'Failed to load functional areas' });
  }
});

/**
 * GET /api/rbp/sections
 * Returns the sidebar section registry with data-driven order and labels.
 * Platform defaults (tenant_id NULL) are merged with tenant overrides if present.
 *
 * Locale resolution (added 2026-04-11 via TASK-15):
 *   1. ?locale=xx query string takes precedence (xx | xx-YY)
 *   2. Accept-Language header first preference
 *   3. Falls back to 'it'
 * The resolved locale is joined against rbp_section_translations; sections
 * lacking a translation in the requested locale fall back to label_it/label_en
 * to keep responses non-empty during the migration window.
 *
 * Response shape stays backward-compatible: each row keeps `label_it` and
 * `label_en`, and adds a new `label` field set to the resolved-locale value.
 *
 * Any authenticated user can read this.
 */
router.get('/sections', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId ?? null;

    // Locale resolution
    const queryLocale = (req.query.locale as string) || '';
    const acceptLang = (req.headers['accept-language'] || '') as string;
    const headerLocale = acceptLang.split(',')[0]?.split(';')[0]?.trim() || '';
    const rawLocale = (queryLocale || headerLocale || 'it').toLowerCase();
    // Strip region: 'it-it' -> 'it', 'en-us' -> 'en'
    const locale = (rawLocale.split('-')[0] || '').slice(0, 2) || 'it';

    // Prefer tenant-specific override when present, fall back to platform default.
    // LEFT JOIN against rbp_section_translations for the requested locale, and
    // fall back to label_it/label_en if no translation exists.
    // Cat C: use appPool (via req.dbClient) to enforce P10 RLS policy on rbp_sections
    const result = await (req.dbClient ?? pool).query(
      `
      WITH merged AS (
        SELECT DISTINCT ON (code)
               code, label_it, label_en, sort_order, icon, tenant_id
          FROM rbp_sections
         WHERE tenant_id = $1 OR tenant_id IS NULL
         ORDER BY code, (tenant_id IS NOT NULL) DESC, sort_order
      )
      SELECT
        m.code,
        m.label_it,
        m.label_en,
        COALESCE(
          (SELECT t.label
             FROM rbp_section_translations t
            WHERE t.section_code = m.code
              AND t.locale = $2
              AND (t.tenant_id = $1 OR t.tenant_id IS NULL)
            ORDER BY (t.tenant_id IS NOT NULL) DESC
            LIMIT 1),
          CASE $2 WHEN 'en' THEN m.label_en ELSE m.label_it END
        ) AS label,
        m.sort_order,
        m.icon
        FROM merged m
       ORDER BY m.sort_order, m.code
      `,
      [tenantId, locale]
    );

    return res.json({ success: true, data: result.rows, meta: { locale } });
  } catch (err) {
    console.error('[RBP] Error loading sections:', err);
    return res.status(500).json({ error: 'Failed to load sections' });
  }
});

/**
 * GET /api/rbp/dashboards
 * List all dashboards accessible to the current user's role.
 */
router.get('/dashboards', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const roleCode = authReq.user?.role;

    if (!isRbpEnabled) {
      return res.status(503).json({ error: 'RBP framework is not enabled' });
    }

    const result = await pool.query(
      `SELECT d.code, d.name, d.description, d.name_it, d.name_en,
              d.description_it, d.description_en,
              d.layout_path, d.icon, rd.is_default
       FROM rbp_role_dashboards rd
       JOIN rbp_roles r ON r.id = rd.role_id
       JOIN rbp_dashboards d ON d.id = rd.dashboard_id
       WHERE r.code = $1 AND d.is_active = true
       ORDER BY rd.is_default DESC, d.sort_order`,
      [roleCode]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('[RBP] Error loading dashboards:', err);
    return res.status(500).json({ error: 'Failed to load dashboards' });
  }
});

/**
 * GET /api/rbp/navigation
 * Unified navigation endpoint: returns all dashboards + nav items for the user's role.
 * Single call replaces per-dashboard nav-items fetching.
 */
router.get('/navigation', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const roleCode = authReq.user?.role;

    if (!isRbpEnabled) {
      return res.status(503).json({ error: 'RBP framework is not enabled' });
    }

    const result = await pool.query(
      `SELECT d.code AS dashboard_code, d.name AS dashboard_name,
              d.name_it AS dashboard_name_it, d.name_en AS dashboard_name_en,
              d.layout_path,
              d.icon AS dashboard_icon, rd.is_default,
              COALESCE(ni.label_override, p.name) AS label,
              ni.label_override_it, ni.label_override_en,
              p.name_it AS page_name_it, p.name_en AS page_name_en,
              p.route_path AS href,
              COALESCE(ni.icon_override, p.icon) AS icon,
              ni.section, ni.sort_order, ni.is_visible, ni.item_type
       FROM rbp_role_dashboards rd
       JOIN rbp_roles r ON r.id = rd.role_id
       JOIN rbp_dashboards d ON d.id = rd.dashboard_id
       LEFT JOIN rbp_dashboard_nav_items ni ON ni.dashboard_id = d.id AND ni.is_visible = true
       LEFT JOIN rbp_pages p ON ni.target_page_id = p.id
       WHERE r.code = $1 AND d.is_active = true
       ORDER BY rd.is_default DESC, d.sort_order, ni.sort_order`,
      [roleCode]
    );

    // Group rows by dashboard
    const dashboardMap = new Map<
      string,
      {
        code: string;
        name: string;
        nameIt: string | null;
        nameEn: string | null;
        layoutPath: string;
        icon: string;
        isDefault: boolean;
        navItems: Array<{
          label: string;
          labelIt: string | null;
          labelEn: string | null;
          path: string;
          icon: string;
          section: string;
          sortOrder: number;
        }>;
      }
    >();

    for (const row of result.rows) {
      if (!dashboardMap.has(row.dashboard_code)) {
        dashboardMap.set(row.dashboard_code, {
          code: row.dashboard_code,
          name: row.dashboard_name,
          nameIt: row.dashboard_name_it ?? null,
          nameEn: row.dashboard_name_en ?? null,
          layoutPath: row.layout_path,
          icon: row.dashboard_icon,
          isDefault: row.is_default,
          navItems: [],
        });
      }
      if (row.label && row.href) {
        dashboardMap.get(row.dashboard_code)!.navItems.push({
          label: row.label,
          labelIt: row.label_override_it ?? row.page_name_it ?? null,
          labelEn: row.label_override_en ?? row.page_name_en ?? null,
          path: row.href,
          icon: row.icon || 'LayoutDashboard',
          section: row.section || 'general',
          sortOrder: row.sort_order ?? 0,
        });
      }
    }

    return res.json({ dashboards: Array.from(dashboardMap.values()) });
  } catch (err) {
    console.error('[RBP] Error loading navigation:', err);
    return res.status(500).json({ error: 'Failed to load navigation' });
  }
});

/**
 * POST /api/rbp/cache/invalidate
 * Invalidate the RBP permission cache. TENANT_OWNER+ only.
 */
router.post(
  '/cache/invalidate',
  validate(InvalidateCacheSchema),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const roleCode = authReq.user?.role;

      if (!['SUPERUSER', 'TENANT_OWNER'].includes(roleCode)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { role } = req.body; // Optional: invalidate specific role
      invalidateRbpCache(role);

      return res.json({ success: true, invalidated: role || 'all' });
    } catch (err) {
      console.error('[RBP] Cache invalidation failed:', err);
      return res.status(500).json({ error: 'Cache invalidation failed' });
    }
  }
);

// ============================================================================
// TEAM MANAGEMENT
// ============================================================================

/**
 * GET /api/rbp/teams
 * List all teams for the current tenant. HR_MANAGER+ only.
 */
router.get('/teams', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.tenantId || authReq.user?.tenantId;

    // Cat A: use appPool (via req.dbClient) to enforce RLS on rbp_teams
    const result = await (req.dbClient ?? pool).query(
      `SELECT t.id, t.code, t.name, t.description, t.purpose, t.is_active, t.created_at,
              (SELECT COUNT(*) FROM rbp_team_members tm WHERE tm.team_id = t.id) as member_count,
              (SELECT COUNT(*) FROM rbp_team_leaders tl WHERE tl.team_id = t.id) as leader_count
       FROM rbp_teams t
       WHERE t.tenant_id = $1
       ORDER BY t.name`,
      [tenantId]
    );

    return res.json({ teams: result.rows });
  } catch (err) {
    console.error('[RBP] Error loading teams:', err);
    return res.status(500).json({ error: 'Failed to load teams' });
  }
});

/**
 * POST /api/rbp/teams
 * Create a new team. HR_MANAGER+ only.
 */
router.post('/teams', validate(CreateTeamSchema), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.tenantId || authReq.user?.tenantId;
    const userId = authReq.user?.userId;
    const { code, name, description, purpose } = req.body;

    // Cat A: use appPool (via req.dbClient) to enforce RLS on rbp_teams INSERT
    const result = await (req.dbClient ?? pool).query(
      `INSERT INTO rbp_teams (tenant_id, code, name, description, purpose, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, code, name, description || null, purpose || null, userId]
    );

    return res.status(201).json({ team: result.rows[0] });
  } catch (err) {
    console.error('[RBP] Error creating team:', err);
    return res.status(500).json({ error: 'Failed to create team' });
  }
});

/**
 * POST /api/rbp/teams/:teamId/members
 * Add a member to a team. Team leader or HR_MANAGER+ only.
 */
router.post(
  '/teams/:teamId/members',
  validate(TeamMemberSchema),
  async (req: Request, res: Response) => {
    try {
      const teamId = parseInt(req.params.teamId as string);
      const { employeeId } = req.body;

      // Cat A: use appPool (via req.dbClient) to enforce RLS on rbp_team_members INSERT
      const result = await (req.dbClient ?? pool).query(
        `INSERT INTO rbp_team_members (team_id, employee_id)
       VALUES ($1, $2)
       ON CONFLICT (team_id, employee_id) DO NOTHING
       RETURNING *`,
        [teamId, employeeId]
      );

      return res.status(201).json({
        member: result.rows[0] || {
          team_id: teamId,
          employee_id: employeeId,
          status: 'already_member',
        },
      });
    } catch (err) {
      console.error('[RBP] Error adding team member:', err);
      return res.status(500).json({ error: 'Failed to add team member' });
    }
  }
);

/**
 * POST /api/rbp/teams/:teamId/leaders
 * Assign a team leader. HR_MANAGER+ only.
 */
router.post(
  '/teams/:teamId/leaders',
  validate(TeamMemberSchema),
  async (req: Request, res: Response) => {
    try {
      const teamId = parseInt(req.params.teamId as string);
      const { employeeId } = req.body;

      // Cat A: use appPool (via req.dbClient) to enforce RLS on rbp_team_leaders INSERT
      const result = await (req.dbClient ?? pool).query(
        `INSERT INTO rbp_team_leaders (team_id, employee_id)
       VALUES ($1, $2)
       ON CONFLICT (team_id, employee_id) DO NOTHING
       RETURNING *`,
        [teamId, employeeId]
      );

      return res.status(201).json({
        leader: result.rows[0] || {
          team_id: teamId,
          employee_id: employeeId,
          status: 'already_leader',
        },
      });
    } catch (err) {
      console.error('[RBP] Error assigning team leader:', err);
      return res.status(500).json({ error: 'Failed to assign team leader' });
    }
  }
);

// ============================================================================
// BREAK-GLASS — Temporary role elevation with audit trail
// ============================================================================

/**
 * POST /api/rbp/break-glass
 * Request temporary role elevation. Creates an audit log entry.
 * Only TENANT_OWNER+ can approve (future: approval workflow).
 */
router.post('/break-glass', validate(BreakGlassSchema), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;
    const roleCode = authReq.user?.role;
    const { targetRole, reason, durationMinutes } = req.body;

    const duration = Math.min(durationMinutes || 60, 480); // Max 8 hours

    // Cat A: use appPool (via req.dbClient) for tenant-scoped audit_logs INSERT
    await (req.dbClient ?? pool).query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, description, metadata, ip_address)
       VALUES ($1, $2, 'BREAK_GLASS_REQUEST', 'rbp_role_elevation', $3, $4, $5)`,
      [
        authReq.tenantId,
        userId,
        `Break-glass: ${roleCode} → ${targetRole}. Reason: ${reason}`,
        JSON.stringify({
          currentRole: roleCode,
          targetRole,
          reason,
          durationMinutes: duration,
          requestedAt: new Date().toISOString(),
          status: 'PENDING',
        }),
        req.ip,
      ]
    );

    console.warn(
      `[RBP] BREAK-GLASS: User ${userId} (${roleCode}) requested elevation to ${targetRole}. Reason: ${reason}`
    );

    return res.json({
      status: 'PENDING',
      message: 'Break-glass request logged. Requires TENANT_OWNER approval.',
      currentRole: roleCode,
      targetRole,
      durationMinutes: duration,
    });
  } catch (err) {
    console.error('[RBP] Break-glass request failed:', err);
    return res.status(500).json({ error: 'Break-glass request failed' });
  }
});

/**
 * GET /api/rbp/break-glass/pending
 * List pending break-glass requests. TENANT_OWNER+ only.
 */
router.get('/break-glass/pending', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const roleCode = authReq.user?.role;

    if (!['SUPERUSER', 'TENANT_OWNER'].includes(roleCode)) {
      return res.status(403).json({ error: 'Only TENANT_OWNER+ can view break-glass requests' });
    }

    // Cat A: use appPool (via req.dbClient) for tenant-scoped audit_logs SELECT
    const result = await (req.dbClient ?? pool).query(
      `SELECT id, user_id, metadata, ip_address, created_at
       FROM audit_logs
       WHERE action = 'BREAK_GLASS_REQUEST'
         AND resource_type = 'rbp_role_elevation'
         AND (metadata->>'status') = 'PENDING'
       ORDER BY created_at DESC
       LIMIT 50`
    );

    return res.json({ requests: result.rows });
  } catch (err) {
    console.error('[RBP] Error listing break-glass requests:', err);
    return res.status(500).json({ error: 'Failed to list break-glass requests' });
  }
});

/**
 * POST /api/rbp/break-glass/:requestId/approve
 * Approve a break-glass request. TENANT_OWNER+ only.
 * Temporarily elevates the user's role in the session.
 */
router.post('/break-glass/:requestId/approve', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const approverRole = authReq.user?.role;
    const approverId = authReq.user?.userId;
    const requestId = req.params.requestId as string;

    if (!['SUPERUSER', 'TENANT_OWNER'].includes(approverRole)) {
      return res.status(403).json({ error: 'Only TENANT_OWNER+ can approve break-glass requests' });
    }

    // Cat A: use appPool (via req.dbClient) for tenant-scoped audit_logs operations
    const requestResult = await (req.dbClient ?? pool).query(
      `SELECT id, user_id, metadata FROM audit_logs
       WHERE id = $1 AND action = 'BREAK_GLASS_REQUEST'
         AND (metadata->>'status') = 'PENDING'`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Break-glass request not found or already processed' });
    }

    const request = requestResult.rows[0];
    const details = request.metadata;
    const expiresAt = new Date(Date.now() + (details.durationMinutes || 60) * 60 * 1000);

    // Update status to APPROVED
    await (req.dbClient ?? pool).query(
      `UPDATE audit_logs SET metadata = metadata || $1
       WHERE id = $2`,
      [
        JSON.stringify({
          status: 'APPROVED',
          approvedBy: approverId,
          approvedAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
        }),
        requestId,
      ]
    );

    // Log approval
    await (req.dbClient ?? pool).query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, metadata, ip_address)
       VALUES ($1, $2, 'BREAK_GLASS_APPROVED', 'rbp_role_elevation', $3, $4)`,
      [
        authReq.tenantId,
        approverId,
        JSON.stringify({
          requestId,
          requestedBy: request.user_id,
          targetRole: details.targetRole,
          expiresAt: expiresAt.toISOString(),
        }),
        req.ip,
      ]
    );

    console.warn(
      `[RBP] BREAK-GLASS APPROVED: Request ${requestId} approved by ${approverId}. Expires: ${expiresAt.toISOString()}`
    );

    return res.json({
      status: 'APPROVED',
      requestId,
      targetRole: details.targetRole,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('[RBP] Break-glass approval failed:', err);
    return res.status(500).json({ error: 'Break-glass approval failed' });
  }
});

/**
 * POST /api/rbp/break-glass/:requestId/deny
 * Deny a break-glass request. TENANT_OWNER+ only.
 */
router.post(
  '/break-glass/:requestId/deny',
  validate(DenyBreakGlassSchema),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const approverRole = authReq.user?.role;
      const approverId = authReq.user?.userId;
      const requestId = req.params.requestId as string;
      const { reason } = req.body;

      if (!['SUPERUSER', 'TENANT_OWNER'].includes(approverRole)) {
        return res.status(403).json({ error: 'Only TENANT_OWNER+ can deny break-glass requests' });
      }

      // Cat A: use appPool (via req.dbClient) for tenant-scoped audit_logs UPDATE
      await (req.dbClient ?? pool).query(
        `UPDATE audit_logs SET metadata = metadata || $1
       WHERE id = $2 AND action = 'BREAK_GLASS_REQUEST'`,
        [
          JSON.stringify({
            status: 'DENIED',
            deniedBy: approverId,
            deniedAt: new Date().toISOString(),
            denyReason: reason || 'No reason provided',
          }),
          requestId,
        ]
      );

      return res.json({ status: 'DENIED', requestId });
    } catch (err) {
      console.error('[RBP] Break-glass denial failed:', err);
      return res.status(500).json({ error: 'Break-glass denial failed' });
    }
  }
);

export default router;
