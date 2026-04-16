/**
 * Role-Based Access Control (RBAC) Middleware
 * Granular permission enforcement based on PRD requirements
 * Epic: 2 - User Management & Tenant Configuration
 * Story: 2.3 - Role-Based Access Control (RBAC) Enforcement
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database.js';
import { createAppError } from './errorHandler.js';
import { ErrorCodes, PERMISSIONS, Permission } from '@heuresys/shared';
import { rbpCache } from '../services/rbp-cache.js';
import { AuthenticatedRequest, Role } from './auth.js';
import { logger } from '../config/logger.js';

// =============================================================================
// TYPES
// =============================================================================

// Full 8-role RBAC system as per RBAC Authorization Matrix
type RBACRole =
  | 'SUPERUSER'
  | 'TENANT_OWNER'
  | 'IT_ADMIN'
  | 'HR_DIRECTOR'
  | 'HR_MANAGER'
  | 'DEPT_HEAD'
  | 'LINE_MANAGER'
  | 'EMPLOYEE';

// Permission scope types matching database permission_scope ENUM
export type PermissionScope = 'own' | 'team' | 'department' | 'tenant' | 'platform';

export interface RBACContext {
  user: {
    id: string;
    role: RBACRole;
    permissions: Permission[];
    employeeId?: string;
    tenantId?: string;
    orgUnitId?: string;
  };
  scope?: PermissionScope;
  resourceOwnerId?: string;
  teamMemberIds?: string[];
  orgUnitMemberIds?: string[];
}

// =============================================================================
// PERMISSION CHECK MIDDLEWARE
// =============================================================================

/**
 * Check if user has at least one of the required permissions
 * @param requiredPermissions Array of permissions (OR logic)
 */
export function checkPermission(...requiredPermissions: Permission[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      if (!authReq.user) {
        throw createAppError('Authentication required', 401, ErrorCodes.UNAUTHORIZED);
      }

      // SUPERUSER and TENANT_OWNER-level roles have all permissions
      const mappedRole = mapLegacyRole(authReq.user.role as Role);
      if (mappedRole === 'SUPERUSER' || mappedRole === 'TENANT_OWNER') {
        return next();
      }
      const rolePermissions = rbpCache.getRolePermissions(mappedRole);

      // Check if user has any of the required permissions
      const userPermissions = [
        ...rolePermissions,
        ...(authReq.user.permissions || []),
      ] as Permission[];

      const hasPermission = requiredPermissions.some((p) => userPermissions.includes(p));

      if (!hasPermission) {
        throw createAppError('Insufficient permissions', 403, ErrorCodes.FORBIDDEN, {
          required: requiredPermissions,
          userRole: authReq.user.role,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if user has ALL of the required permissions
 * @param requiredPermissions Array of permissions (AND logic)
 */
export function checkAllPermissions(...requiredPermissions: Permission[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      if (!authReq.user) {
        throw createAppError('Authentication required', 401, ErrorCodes.UNAUTHORIZED);
      }

      // SUPERUSER has all permissions
      if (authReq.user.role === 'SUPERUSER') {
        return next();
      }

      const mappedRole = mapLegacyRole(authReq.user.role as Role);
      const rolePermissions = rbpCache.getRolePermissions(mappedRole);

      const userPermissions = [
        ...rolePermissions,
        ...(authReq.user.permissions || []),
      ] as Permission[];

      const hasAllPermissions = requiredPermissions.every((p) => userPermissions.includes(p));

      if (!hasAllPermissions) {
        const missing = requiredPermissions.filter((p) => !userPermissions.includes(p));
        throw createAppError('Insufficient permissions', 403, ErrorCodes.FORBIDDEN, {
          required: requiredPermissions,
          missing,
          userRole: authReq.user.role,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// SCOPE-BASED ACCESS CONTROL
// =============================================================================

/**
 * Middleware to determine access scope based on user role
 * Sets req.accessScope to 'own', 'team', or 'all'
 */
// Resource → functional area mapping (source of truth for A.3 data-driven refactor).
// Kept here (not in DB) because the resource identifier is an API-layer concept,
// while rbp_functional_areas is a domain concept. Decoupling allows goals and
// performance to share the same domain area (PERFORMANCE) while remaining
// distinct API resources.
const RESOURCE_TO_AREA: Record<string, string> = {
  employees: 'CORE_HR',
  leave: 'TIME_ATTENDANCE',
  reports: 'ANALYTICS',
  goals: 'PERFORMANCE',
  performance: 'PERFORMANCE',
  compensation: 'COMPENSATION',
};

// DB scope_type (UPPERCASE) → TS PermissionScope (lowercase)
// Note: HIERARCHY in DB semantically differs from TEAM (transitive vs flat
// membership). This mapping collapses HIERARCHY to 'team' for backward compat
// with the existing TS contract; a richer distinction is tracked as future debt.
const DB_SCOPE_TO_TS: Record<string, PermissionScope> = {
  PLATFORM: 'platform',
  TENANT: 'tenant',
  DEPARTMENT: 'department',
  TEAM: 'team',
  HIERARCHY: 'team',
  SELF: 'own',
};

export function determineAccessScope(
  resource: 'employees' | 'leave' | 'reports' | 'goals' | 'performance' | 'compensation'
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest & {
        accessScope?: PermissionScope;
        teamMemberIds?: string[];
        orgUnitMemberIds?: string[];
      };

      if (!authReq.user) {
        throw createAppError('Authentication required', 401, ErrorCodes.UNAUTHORIZED);
      }

      const userRole = authReq.user.role as Role;
      const mappedRole = mapLegacyRole(userRole);

      // Determine scope based on role and resource (8-role RBAC matrix)
      const scopeMatrix: Record<string, Record<RBACRole, PermissionScope>> = {
        employees: {
          SUPERUSER: 'platform',
          TENANT_OWNER: 'tenant',

          IT_ADMIN: 'team',
          HR_DIRECTOR: 'tenant',
          HR_MANAGER: 'tenant',
          DEPT_HEAD: 'department',
          LINE_MANAGER: 'team',
          EMPLOYEE: 'own',
        },
        leave: {
          SUPERUSER: 'platform',
          TENANT_OWNER: 'tenant',

          IT_ADMIN: 'team',
          HR_DIRECTOR: 'tenant',
          HR_MANAGER: 'tenant',
          DEPT_HEAD: 'department',
          LINE_MANAGER: 'team',
          EMPLOYEE: 'own',
        },
        reports: {
          SUPERUSER: 'platform',
          TENANT_OWNER: 'tenant',

          IT_ADMIN: 'tenant',
          HR_DIRECTOR: 'tenant',
          HR_MANAGER: 'tenant',
          DEPT_HEAD: 'department',
          LINE_MANAGER: 'team',
          EMPLOYEE: 'own',
        },
        goals: {
          SUPERUSER: 'platform',
          TENANT_OWNER: 'tenant',

          IT_ADMIN: 'team',
          HR_DIRECTOR: 'tenant',
          HR_MANAGER: 'tenant',
          DEPT_HEAD: 'department',
          LINE_MANAGER: 'team',
          EMPLOYEE: 'own',
        },
        performance: {
          SUPERUSER: 'platform',
          TENANT_OWNER: 'tenant',

          IT_ADMIN: 'team',
          HR_DIRECTOR: 'tenant',
          HR_MANAGER: 'tenant',
          DEPT_HEAD: 'department',
          LINE_MANAGER: 'team',
          EMPLOYEE: 'own',
        },
        compensation: {
          SUPERUSER: 'platform',
          TENANT_OWNER: 'tenant',

          IT_ADMIN: 'own',
          HR_DIRECTOR: 'tenant',
          HR_MANAGER: 'tenant',
          DEPT_HEAD: 'own',
          LINE_MANAGER: 'own',
          EMPLOYEE: 'own',
        },
      };

      // Legacy hardcoded scope (fallback / default).
      const legacyScope = scopeMatrix[resource]?.[mappedRole] || 'own';

      // Data-driven scope lookup (feature flag USE_DATA_DRIVEN_SCOPE_MATRIX).
      // Currently default OFF pending resolution of 8 known mismatches between
      // the hardcoded matrix and rbp_role_permissions (see C.1b REPORT A.3).
      let scope: PermissionScope = legacyScope;
      if (process.env.USE_DATA_DRIVEN_SCOPE_MATRIX === 'true') {
        const areaCode = RESOURCE_TO_AREA[resource];
        const perm = areaCode ? rbpCache.getAreaPermission(mappedRole, areaCode) : null;
        if (perm) {
          const dbScope = DB_SCOPE_TO_TS[perm.scopeType];
          if (dbScope) {
            scope = dbScope;
            if (dbScope !== legacyScope) {
              logger.debug(
                `[rbac] data-driven scope override: resource=${resource} role=${mappedRole} legacy=${legacyScope} db=${dbScope}`
              );
            }
          }
        }
      }

      authReq.accessScope = scope;

      // If scope is 'team', fetch team member IDs (direct reports)
      if (scope === 'team' && authReq.user.employeeId) {
        const teamResult = await pool.query(
          `SELECT id FROM employees WHERE manager_id = $1 AND is_active = true`,
          [authReq.user.employeeId]
        );
        authReq.teamMemberIds = teamResult.rows.map((r) => r.id);
      }

      // If scope is 'department', fetch department member IDs
      if (scope === 'department' && authReq.user.employeeId) {
        const deptResult = await pool.query(
          `SELECT e.id FROM employees e
           WHERE e.org_unit_id = (
             SELECT org_unit_id FROM employees WHERE id = $1
           )
           AND e.is_active = true`,
          [authReq.user.employeeId]
        );
        authReq.orgUnitMemberIds = deptResult.rows.map((r) => r.id);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Filter query results based on access scope
 * Use after determineAccessScope middleware
 */
export function applyScopeFilter(tableName: string = 'e') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest & {
      accessScope?: PermissionScope;
      teamMemberIds?: string[];
      orgUnitMemberIds?: string[];
      scopeFilter?: { where: string; params: unknown[] };
    };

    if (!authReq.accessScope) {
      authReq.scopeFilter = { where: '', params: [] };
      return next();
    }

    switch (authReq.accessScope) {
      case 'own':
        authReq.scopeFilter = {
          where: ` AND ${tableName}.id = $SCOPE_PARAM`,
          params: [authReq.user?.employeeId],
        };
        break;

      case 'team':
        if (authReq.teamMemberIds?.length) {
          authReq.scopeFilter = {
            where: ` AND (${tableName}.id = ANY($SCOPE_PARAM) OR ${tableName}.id = $OWN_PARAM)`,
            params: [authReq.teamMemberIds, authReq.user?.employeeId],
          };
        } else {
          authReq.scopeFilter = {
            where: ` AND ${tableName}.id = $SCOPE_PARAM`,
            params: [authReq.user?.employeeId],
          };
        }
        break;

      case 'department':
        if (authReq.orgUnitMemberIds?.length) {
          authReq.scopeFilter = {
            where: ` AND ${tableName}.id = ANY($SCOPE_PARAM)`,
            params: [authReq.orgUnitMemberIds],
          };
        } else {
          // Fallback to own if no department members found
          authReq.scopeFilter = {
            where: ` AND ${tableName}.id = $SCOPE_PARAM`,
            params: [authReq.user?.employeeId],
          };
        }
        break;

      case 'tenant':
        // Filter by tenant_id - assumes table has tenant_id column
        if (authReq.user?.tenantId) {
          authReq.scopeFilter = {
            where: ` AND ${tableName}.tenant_id = $SCOPE_PARAM`,
            params: [authReq.user.tenantId],
          };
        } else {
          authReq.scopeFilter = { where: '', params: [] };
        }
        break;

      case 'platform':
        // No filter - TENANT_OWNER can see everything
        authReq.scopeFilter = { where: '', params: [] };
        break;

      default:
        authReq.scopeFilter = { where: '', params: [] };
        break;
    }

    next();
  };
}

// =============================================================================
// RESOURCE OWNERSHIP CHECK
// =============================================================================

/**
 * Check if user owns a resource or has permission to access it
 */
export function checkResourceOwnership(
  resourceType: string,
  getOwnerId: (req: Request) => string | Promise<string>
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      if (!authReq.user) {
        throw createAppError('Authentication required', 401, ErrorCodes.UNAUTHORIZED);
      }

      // SUPERUSER, TENANT_OWNER and ADMIN can access anything
      if (['SUPERUSER', 'TENANT_OWNER', 'ADMIN'].includes(authReq.user.role)) {
        return next();
      }

      const ownerId = await getOwnerId(req);

      // Check if user is the owner
      if (authReq.user.employeeId === ownerId) {
        return next();
      }

      // Check if user is the manager of the owner (for team access)
      if (authReq.user.employeeId) {
        const managerCheck = await pool.query(
          `SELECT 1 FROM employees WHERE id = $1 AND manager_id = $2`,
          [ownerId, authReq.user.employeeId]
        );

        if (managerCheck.rows.length > 0) {
          return next();
        }
      }

      // Check if user has elevated permission for this resource
      const mappedRole = mapLegacyRole(authReq.user.role as Role);
      const rolePermissions = rbpCache.getRolePermissions(mappedRole);
      const allAccessPermission = `${resourceType}:view:all` as Permission;

      if (rolePermissions.includes(allAccessPermission)) {
        return next();
      }

      throw createAppError('Access denied to this resource', 403, ErrorCodes.FORBIDDEN);
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

/**
 * Log permission-related access for audit trail
 */
export async function logPermissionAccess(
  userId: string,
  tenantId: string | undefined,
  action: string,
  resourceType: string,
  resourceId: string,
  granted: boolean,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs
        (user_id, tenant_id, action, category, resource_type, resource_id,
         description, success, metadata)
       VALUES ($1, $2, $3, 'AUTH', $4, $5, $6, $7, $8)`,
      [
        userId,
        tenantId,
        action,
        resourceType,
        resourceId,
        `Permission check: ${action} on ${resourceType}/${resourceId}`,
        granted,
        JSON.stringify(details || {}),
      ]
    );
  } catch {
    // Don't fail the request if audit logging fails
    logger.error('Failed to log permission access');
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Map legacy roles to new RBAC roles
 * Handles both old 5-role system and new 8-role system
 */
function mapLegacyRole(role: Role): RBACRole {
  const roleMap: Record<string, RBACRole> = {
    // Current role system
    SUPERUSER: 'SUPERUSER',
    TENANT_OWNER: 'TENANT_OWNER',
    IT_ADMIN: 'IT_ADMIN',
    HR_DIRECTOR: 'HR_DIRECTOR',
    HR_MANAGER: 'HR_MANAGER',
    DEPT_HEAD: 'DEPT_HEAD',
    LINE_MANAGER: 'LINE_MANAGER',
    EMPLOYEE: 'EMPLOYEE',
    // Legacy role mappings (backwards compatibility)
    ADMIN: 'TENANT_OWNER',
    TENANT_ADMIN: 'TENANT_OWNER',
    SYSADMIN: 'TENANT_OWNER', // legacy alias
    HR: 'HR_MANAGER',
    DEMO: 'EMPLOYEE',
    USER: 'EMPLOYEE',
  };
  return roleMap[role] || 'EMPLOYEE';
}

/**
 * Get user's effective permissions (role + custom)
 */
export function getEffectivePermissions(
  role: Role,
  customPermissions: string[] = []
): Permission[] {
  const mappedRole = mapLegacyRole(role);
  const rolePerms = rbpCache.getRolePermissions(mappedRole);
  return [...new Set([...rolePerms, ...customPermissions])] as Permission[];
}

/**
 * Check if role A has higher privilege than role B
 */
export function hasHigherPrivilege(roleA: RBACRole, roleB: RBACRole): boolean {
  const levelA = rbpCache.getRoleLevel(roleA) ?? 999;
  const levelB = rbpCache.getRoleLevel(roleB) ?? 999;
  return levelA < levelB;
}

// =============================================================================
// COMMON PERMISSION SHORTCUTS
// =============================================================================

export const canViewAllEmployees = checkPermission(PERMISSIONS.EMPLOYEES_VIEW_ALL);
export const canViewTeamEmployees = checkPermission(
  PERMISSIONS.EMPLOYEES_VIEW_TEAM,
  PERMISSIONS.EMPLOYEES_VIEW_ALL
);
export const canManageEmployees = checkPermission(
  PERMISSIONS.EMPLOYEES_CREATE,
  PERMISSIONS.EMPLOYEES_UPDATE
);
export const canApproveLeave = checkPermission(PERMISSIONS.LEAVE_APPROVE);
export const canConfigureTenant = checkPermission(PERMISSIONS.TENANT_CONFIGURE);
export const canManageUsers = checkPermission(PERMISSIONS.USERS_MANAGE);
export const canViewAllReports = checkPermission(PERMISSIONS.REPORTS_VIEW_ALL);
export const canExportReports = checkPermission(PERMISSIONS.REPORTS_EXPORT);
export const canQueryAI = checkPermission(PERMISSIONS.AI_QUERY);
export const canConfigureAI = checkPermission(PERMISSIONS.AI_CONFIGURE);
export const canViewAuditLogs = checkPermission(PERMISSIONS.AUDIT_VIEW);
export const canExportAuditLogs = checkPermission(PERMISSIONS.AUDIT_EXPORT);
