/**
 * RBP Framework Middleware — Data-Driven Permission & Scope Enforcement
 * ARCH-2026-002 v1.2
 *
 * Replaces hardcoded requireRole() with DB-driven requirePermission().
 * Feature flag: USE_RBP_FRAMEWORK=true to activate.
 * When flag is false, falls back to legacy requireRole().
 *
 * Cache strategy: L1 in-memory Map (5min TTL) + L2 Redis hash (15min TTL)
 */

import { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest, Role } from './auth.js';
import { requireRole as legacyRequireRole } from './auth.js';
import { pool } from '../config/database.js';
import { getRedis } from '../config/redis.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RbpPermission {
  functional_area_code: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_export: boolean;
  scope_type: string;
}

interface RbpScopeRule {
  scope_type: string;
  sql_template: string;
  parameters: Record<string, string>;
}

interface RbpFieldPolicy {
  classification_code: string;
  action: 'SHOW' | 'MASK' | 'HIDE';
}

interface RbpUserContext {
  permissions: RbpPermission[];
  scopeRules: RbpScopeRule[];
  fieldPolicies: RbpFieldPolicy[];
  isSystemRole: boolean;
  defaultDashboardPath: string;
  dashboards: string[];
  loadedAt: number;
}

type PermissionAction = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE' | 'APPROVE' | 'EXPORT';

// Extend Express Request
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rbpContext?: RbpUserContext;
      rbpScope?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scopeFilter?: { where: string; params: any[] };
    }
  }
}

// ---------------------------------------------------------------------------
// Feature Flag
// ---------------------------------------------------------------------------

// RBP is always enabled — set USE_RBP_FRAMEWORK=false in .env only for emergency rollback
const USE_RBP_FRAMEWORK = process.env.USE_RBP_FRAMEWORK !== 'false';

// ---------------------------------------------------------------------------
// L1 Cache — In-Memory (5 min TTL)
// ---------------------------------------------------------------------------

const L1_TTL_MS = 5 * 60 * 1000; // 5 minutes
const l1Cache = new Map<string, RbpUserContext>();

function l1Get(roleCode: string): RbpUserContext | null {
  const cached = l1Cache.get(roleCode);
  if (cached && Date.now() - cached.loadedAt < L1_TTL_MS) {
    return cached;
  }
  if (cached) l1Cache.delete(roleCode);
  return null;
}

function l1Set(roleCode: string, ctx: RbpUserContext): void {
  l1Cache.set(roleCode, ctx);
}

// ---------------------------------------------------------------------------
// L2 Cache — Redis (15 min TTL)
// ---------------------------------------------------------------------------

const L2_TTL_SECONDS = 15 * 60; // 15 minutes
const L2_PREFIX = 'rbp:ctx:';

async function l2Get(roleCode: string): Promise<RbpUserContext | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;
    const data = await redis.get(`${L2_PREFIX}${roleCode}`);
    if (!data) return null;
    const parsed = JSON.parse(data) as RbpUserContext;
    parsed.loadedAt = Date.now(); // Refresh L1 TTL when loaded from L2
    return parsed;
  } catch {
    return null;
  }
}

async function l2Set(roleCode: string, ctx: RbpUserContext): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.set(`${L2_PREFIX}${roleCode}`, JSON.stringify(ctx), 'EX', L2_TTL_SECONDS);
  } catch {
    // Silent fail — cache miss is non-critical
  }
}

// ---------------------------------------------------------------------------
// Cache Invalidation (call on role_permissions/scope_rules change)
// ---------------------------------------------------------------------------

export function invalidateRbpCache(roleCode?: string): void {
  if (roleCode) {
    l1Cache.delete(roleCode);
  } else {
    l1Cache.clear();
  }
  // L2 invalidation via Redis pub/sub (optional, for multi-process)
  try {
    const redis = getRedis();
    if (redis) {
      redis.publish('rbp:invalidate', roleCode || '*');
    }
  } catch {
    // Silent
  }
}

// ---------------------------------------------------------------------------
// Load RBP Context from DB (with inheritance resolution)
// ---------------------------------------------------------------------------

async function loadRbpContext(roleCode: string): Promise<RbpUserContext> {
  // 1. Get effective permissions (resolves inheritance via SQL function)
  const permResult = await pool.query(`SELECT * FROM rbp_get_user_effective_permissions($1)`, [
    roleCode,
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permissions: RbpPermission[] = permResult.rows.map((r: any) => ({
    functional_area_code: r.functional_area_code,
    can_view: r.can_view,
    can_create: r.can_create,
    can_edit: r.can_edit,
    can_delete: r.can_delete,
    can_approve: r.can_approve,
    can_export: r.can_export,
    scope_type: r.scope_type,
  }));

  // 2. Get scope rules
  const scopeResult = await pool.query(
    `SELECT sr.scope_type, sr.sql_template, sr.parameters
     FROM rbp_scope_rules sr
     JOIN rbp_roles r ON r.id = sr.role_id
     WHERE r.code = $1`,
    [roleCode]
  );
  const scopeRules: RbpScopeRule[] = scopeResult.rows;

  // 3. Get field policies
  const fpResult = await pool.query(
    `SELECT dc.code AS classification_code, fp.action
     FROM rbp_field_policies fp
     JOIN rbp_roles r ON r.id = fp.role_id
     JOIN rbp_data_classifications dc ON dc.id = fp.data_classification_id
     WHERE r.code = $1
     ORDER BY dc.sensitivity_level`,
    [roleCode]
  );
  const fieldPolicies: RbpFieldPolicy[] = fpResult.rows;

  // 4. Get role metadata
  const roleResult = await pool.query(
    `SELECT r.is_system_role, r.default_dashboard_code, d.layout_path
     FROM rbp_roles r
     LEFT JOIN rbp_dashboards d ON d.code = r.default_dashboard_code
     WHERE r.code = $1`,
    [roleCode]
  );
  const roleData = roleResult.rows[0] || {};

  // 5. Get all accessible dashboards
  const dashResult = await pool.query(
    `SELECT d.code
     FROM rbp_role_dashboards rd
     JOIN rbp_dashboards d ON d.id = rd.dashboard_id
     JOIN rbp_roles r ON r.id = rd.role_id
     WHERE r.code = $1 AND d.is_active = true
     ORDER BY rd.is_default DESC, d.sort_order`,
    [roleCode]
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dashboards = dashResult.rows.map((r: any) => r.code);

  return {
    permissions,
    scopeRules,
    fieldPolicies,
    isSystemRole: roleData.is_system_role || false,
    defaultDashboardPath: roleData.layout_path || '/portal',
    dashboards,
    loadedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Get or Load Context (with L1 → L2 → DB fallback)
// ---------------------------------------------------------------------------

async function getRbpContext(roleCode: string): Promise<RbpUserContext> {
  // L1 check
  const l1 = l1Get(roleCode);
  if (l1) return l1;

  // L2 check
  const l2 = await l2Get(roleCode);
  if (l2) {
    l1Set(roleCode, l2);
    return l2;
  }

  // DB load
  const ctx = await loadRbpContext(roleCode);
  l1Set(roleCode, ctx);
  await l2Set(roleCode, ctx);
  return ctx;
}

// ---------------------------------------------------------------------------
// Middleware: loadRbpContext — attaches RBP context to request
// ---------------------------------------------------------------------------

export function loadRbpContextMiddleware() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!USE_RBP_FRAMEWORK) return next();

    try {
      const authReq = req as AuthenticatedRequest;
      const roleCode = authReq.user?.role;
      if (!roleCode) return next();

      authReq.rbpContext = await getRbpContext(roleCode);
      next();
    } catch (err) {
      console.error('[RBP] Failed to load context:', err);
      next(); // Non-blocking: if RBP fails, fall through to legacy
    }
  };
}

// ---------------------------------------------------------------------------
// Middleware: requirePermission — replaces requireRole()
// ---------------------------------------------------------------------------

export function requirePermission(area: string, action: PermissionAction) {
  // If RBP is disabled, fall back to legacy requireRole behavior
  if (!USE_RBP_FRAMEWORK) {
    const legacyRole = mapAreaToLegacyRole(area) as Role;
    return legacyRequireRole(legacyRole);
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const roleCode = authReq.user?.role;

      if (!roleCode) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Ensure RBP context is loaded
      if (!authReq.rbpContext) {
        authReq.rbpContext = await getRbpContext(roleCode);
      }

      const ctx: RbpUserContext = authReq.rbpContext!;

      // System roles (SUPERUSER) bypass all permission checks
      if (ctx.isSystemRole && roleCode === 'SUPERUSER') {
        return next();
      }

      // Find permission for the requested area
      const perm = ctx.permissions.find((p) => p.functional_area_code === area);

      if (!perm) {
        return res.status(403).json({
          error: 'Access denied',
          detail: `No permission for area: ${area}`,
        });
      }

      // Check specific action
      const actionKey = `can_${action.toLowerCase()}` as keyof RbpPermission;
      if (!perm[actionKey]) {
        return res.status(403).json({
          error: 'Access denied',
          detail: `Permission denied: ${area}.${action}`,
        });
      }

      // Attach scope type for downstream scope filtering
      authReq.rbpScope = perm.scope_type;

      next();
    } catch (err) {
      console.error('[RBP] Permission check failed:', err);
      return res.status(500).json({ error: 'Internal authorization error' });
    }
  };
}

// ---------------------------------------------------------------------------
// Middleware: applyScopeFilter — injects WHERE clauses based on scope_rules
// ---------------------------------------------------------------------------

export function applyScopeFilter(area: string) {
  if (!USE_RBP_FRAMEWORK) return (_req: Request, _res: Response, next: NextFunction) => next();

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const ctx: RbpUserContext | undefined = authReq.rbpContext;

      if (!ctx) return next(); // No RBP context = no filtering

      // Get the scope type for this area
      const perm = ctx.permissions.find((p) => p.functional_area_code === area);
      const scopeType = perm?.scope_type || 'SELF';

      // Find the matching scope rule
      const rule = ctx.scopeRules.find((r) => r.scope_type === scopeType);

      if (!rule) {
        // Default to SELF scope if no rule found
        authReq.scopeFilter = {
          where: 'tenant_id = $1 AND employee_id = $2',
          params: [authReq.tenantId, authReq.user?.employeeId],
        };
        return next();
      }

      // Build WHERE clause from template
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any[] = [];
      let paramIndex = 1;
      let where = rule.sql_template;

      // Replace named parameters with positional ($1, $2, etc.)
      for (const [key, sessionPath] of Object.entries(rule.parameters)) {
        const value = resolveSessionValue(authReq, sessionPath);
        where = where.replace(`:${key}`, `$${paramIndex}`);
        params.push(value);
        paramIndex++;
      }

      authReq.scopeFilter = { where, params };
      next();
    } catch (err) {
      console.error('[RBP] Scope filter failed:', err);
      return res.status(500).json({ error: 'Internal scope error' });
    }
  };
}

// ---------------------------------------------------------------------------
// Helper: resolve session values from request
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveSessionValue(req: any, path: string): any {
  switch (path) {
    case 'session.tenant_id':
      return req.tenantId || req.user?.tenantId;
    case 'session.employee_id':
      return req.user?.employeeId;
    case 'session.org_unit_id':
      return req.user?.orgUnitId;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Helper: map functional area to legacy role (fallback mode)
// ---------------------------------------------------------------------------

function mapAreaToLegacyRole(area: string): string {
  const areaToRole: Record<string, string> = {
    PLATFORM: 'SUPERUSER',
    SECURITY: 'TENANT_OWNER',
    MARKETPLACE: 'TENANT_OWNER',
    AI_SERVICES: 'EMPLOYEE',
    CORE_HR: 'HR_MANAGER',
    TALENT: 'HR_MANAGER',
    PERFORMANCE: 'HR_MANAGER',
    COMPENSATION: 'HR_DIRECTOR',
    TIME_ATTENDANCE: 'HR_MANAGER',
    LEARNING: 'HR_MANAGER',
    RECRUITMENT: 'HR_MANAGER',
    CAREER: 'HR_MANAGER',
    ANALYTICS: 'HR_MANAGER',
    COMPANY_ANALYTICS: 'HR_MANAGER',
    WORKFORCE_INTELLIGENCE: 'HR_DIRECTOR',
    ORGANIZATION: 'HR_MANAGER',
    TEAMS: 'HR_MANAGER',
    ENGAGEMENT: 'HR_MANAGER',
    COMPLIANCE: 'HR_MANAGER',
    SELF_SERVICE: 'EMPLOYEE',
  };
  return areaToRole[area] || 'HR_MANAGER';
}

// ---------------------------------------------------------------------------
// API: Get user's effective permissions (for frontend)
// ---------------------------------------------------------------------------

export async function getUserPermissions(roleCode: string) {
  const ctx = await getRbpContext(roleCode);
  return {
    permissions: ctx.permissions,
    dashboards: ctx.dashboards,
    defaultDashboardPath: ctx.defaultDashboardPath,
    isSystemRole: ctx.isSystemRole,
  };
}

// ---------------------------------------------------------------------------
// API: Get dashboard nav items (for sidebar builder)
// ---------------------------------------------------------------------------

export async function getDashboardNavItems(dashboardCode: string) {
  const result = await pool.query(
    `SELECT
       ni.id, ni.item_type, ni.section, ni.sort_order, ni.is_visible,
       ni.label_override, ni.icon_override, ni.external_url,
       p.code AS page_code, p.name AS page_name, p.route_path, p.icon AS page_icon,
       d.code AS target_dashboard_code, d.name AS target_dashboard_name,
       d.layout_path AS target_layout_path, d.icon AS target_dashboard_icon
     FROM rbp_dashboard_nav_items ni
     LEFT JOIN rbp_pages p ON p.id = ni.target_page_id
     LEFT JOIN rbp_dashboards d ON d.id = ni.target_dashboard_id
     WHERE ni.dashboard_id = (SELECT id FROM rbp_dashboards WHERE code = $1)
       AND ni.is_visible = true
     ORDER BY ni.section, ni.sort_order`,
    [dashboardCode]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.rows.map((r: any) => ({
    id: r.id,
    type: r.item_type,
    section: r.section,
    sortOrder: r.sort_order,
    label: r.label_override || r.page_name || r.target_dashboard_name,
    icon: r.icon_override || r.page_icon || r.target_dashboard_icon,
    routePath: r.route_path || r.target_layout_path,
    externalUrl: r.external_url,
    pageCode: r.page_code,
    targetDashboard: r.target_dashboard_code,
  }));
}

// ---------------------------------------------------------------------------
// Middleware: applyFieldPolicy — masks/hides sensitive fields in responses
// ---------------------------------------------------------------------------

// Map fields to their data classification level
const FIELD_CLASSIFICATIONS: Record<string, string> = {
  // RESTRICTED (salary, compensation)
  salary: 'RESTRICTED',
  base_salary: 'RESTRICTED',
  salary_offered: 'RESTRICTED',
  avg_salary_offered: 'RESTRICTED',
  salary_min: 'RESTRICTED',
  salary_max: 'RESTRICTED',
  total_compensation: 'RESTRICTED',
  bonus_amount: 'RESTRICTED',
  bonus_percentage: 'RESTRICTED',
  commission_amount: 'RESTRICTED',
  equity_value: 'RESTRICTED',
  stock_options: 'RESTRICTED',
  hourly_rate: 'RESTRICTED',
  overtime_rate: 'RESTRICTED',
  net_pay: 'RESTRICTED',
  gross_pay: 'RESTRICTED',
  // SENSITIVE (medical, disciplinary)
  medical_notes: 'SENSITIVE',
  disability_status: 'SENSITIVE',
  health_condition: 'SENSITIVE',
  disciplinary_notes: 'SENSITIVE',
  disciplinary_action: 'SENSITIVE',
  // CONFIDENTIAL (evaluations, feedback)
  overall_rating: 'CONFIDENTIAL',
  manager_comments: 'CONFIDENTIAL',
  calibration_score: 'CONFIDENTIAL',
  peer_feedback: 'CONFIDENTIAL',
  performance_score: 'CONFIDENTIAL',
  // INTERNAL (PII)
  ssn: 'INTERNAL',
  tax_id: 'INTERNAL',
  bank_account: 'INTERNAL',
  iban: 'INTERNAL',
  personal_phone: 'INTERNAL',
  personal_email: 'INTERNAL',
  home_address: 'INTERNAL',
  birth_date: 'INTERNAL',
};

const MASK_VALUE = '***';

/**
 * Response middleware that masks or hides sensitive fields based on the user's
 * role and the field's data classification level.
 *
 * Actions per field:
 * - SHOW: field passes through unchanged
 * - MASK: field value replaced with '***'
 * - HIDE: field removed from response entirely
 */
export function applyFieldPolicy() {
  if (!USE_RBP_FRAMEWORK) return (_req: Request, _res: Response, next: NextFunction) => next();

  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const ctx: RbpUserContext | undefined = authReq.rbpContext;

    if (!ctx || ctx.fieldPolicies.length === 0) return next();

    // Build classification→action lookup
    const policyMap = new Map<string, 'SHOW' | 'MASK' | 'HIDE'>();
    for (const fp of ctx.fieldPolicies) {
      policyMap.set(fp.classification_code, fp.action);
    }

    // Override res.json to apply field masking
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      const masked = maskFields(body, policyMap);
      return originalJson(masked);
    };

    next();
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maskFields(data: any, policyMap: Map<string, 'SHOW' | 'MASK' | 'HIDE'>): any {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map((item) => maskFields(item, policyMap));

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const classification = FIELD_CLASSIFICATIONS[key];
      if (!classification) {
        // Not a classified field — recurse into nested objects
        result[key] = typeof value === 'object' ? maskFields(value, policyMap) : value;
        continue;
      }

      const action = policyMap.get(classification) || 'SHOW';
      switch (action) {
        case 'HIDE':
          // Skip field entirely
          break;
        case 'MASK':
          result[key] = MASK_VALUE;
          break;
        case 'SHOW':
        default:
          result[key] = value;
          break;
      }
    }
    return result;
  }

  return data;
}

// ---------------------------------------------------------------------------
// Export flag for external checks
// ---------------------------------------------------------------------------

export const isRbpEnabled = USE_RBP_FRAMEWORK;
