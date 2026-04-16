/**
 * RBP Cache Service — Data-Driven Permission Loading
 * Replaces static ROLE_PERMISSIONS and USER_ROLE_HIERARCHY constants
 * with DB-driven data from rbp_roles, rbp_functional_areas, rbp_role_permissions.
 *
 * Uses rbp_get_user_effective_permissions() SQL function for inheritance resolution.
 */
import { pool } from '../config/database.js';
import type { Permission } from '@heuresys/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RBPRole {
  code: string;
  name: string;
  descriptionIt?: string | null;
  descriptionEn?: string | null;
  hierarchyLevel: number;
  inheritsFrom: string | null;
  isSystemRole: boolean;
}

export interface RBPArea {
  code: string;
  name: string;
  nameIt?: string | null;
  nameEn?: string | null;
  descriptionIt?: string | null;
  descriptionEn?: string | null;
}

export interface RBPPermissionSet {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
  scopeType: string;
}

// ---------------------------------------------------------------------------
// Area → Permission String Translation Map
// ---------------------------------------------------------------------------
// Maps DB functional areas + flags to the legacy Permission strings used by rbac.ts.
// Scope determines granularity: SELF→:own, HIERARCHY/DEPARTMENT→:team, TENANT/PLATFORM→:all

interface PermissionMapping {
  view?: Permission[];
  viewScoped?: {
    own: Permission[];
    team: Permission[];
    all: Permission[];
  };
  create?: Permission[];
  edit?: Permission[];
  delete?: Permission[];
  approve?: Permission[];
  export?: Permission[];
}

const AREA_PERMISSION_MAP: Record<string, PermissionMapping> = {
  PLATFORM: {
    view: ['platform:admin' as Permission],
  },
  ORGANIZATION: {
    view: ['tenant:view' as Permission],
    edit: ['tenant:configure' as Permission],
  },
  SECURITY: {
    viewScoped: {
      own: ['users:view:own' as Permission],
      team: ['users:view:own' as Permission, 'users:view:all' as Permission],
      all: ['users:view:all' as Permission],
    },
    edit: ['users:manage' as Permission],
  },
  CORE_HR: {
    viewScoped: {
      own: ['employees:view:own' as Permission],
      team: ['employees:view:own' as Permission, 'employees:view:team' as Permission],
      all: [
        'employees:view:all' as Permission,
        'employees:view:team' as Permission,
        'employees:view:own' as Permission,
      ],
    },
    create: ['employees:create' as Permission],
    edit: ['employees:update' as Permission],
    delete: ['employees:delete' as Permission],
  },
  TIME_ATTENDANCE: {
    viewScoped: {
      own: ['leave:view:own' as Permission],
      team: ['leave:view:own' as Permission, 'leave:view:team' as Permission],
      all: [
        'leave:view:all' as Permission,
        'leave:view:team' as Permission,
        'leave:view:own' as Permission,
      ],
    },
    create: ['leave:request' as Permission],
    approve: ['leave:approve' as Permission],
    edit: ['leave:configure' as Permission],
  },
  ANALYTICS: {
    viewScoped: {
      own: [],
      team: ['reports:view:team' as Permission],
      all: ['reports:view:all' as Permission, 'reports:view:team' as Permission],
    },
    export: ['reports:export' as Permission],
  },
  AI_SERVICES: {
    view: ['ai:query' as Permission],
    edit: ['ai:configure' as Permission],
  },
  SELF_SERVICE: {
    viewScoped: {
      own: ['documents:view:own' as Permission],
      team: ['documents:view:own' as Permission],
      all: ['documents:view:all' as Permission, 'documents:view:own' as Permission],
    },
    create: ['documents:upload' as Permission],
    delete: ['documents:delete' as Permission],
  },
  COMPLIANCE: {
    view: ['audit:view' as Permission],
    export: ['audit:export' as Permission],
  },
};

function scopeToLevel(scope: string): 'own' | 'team' | 'all' {
  switch (scope) {
    case 'SELF':
      return 'own';
    case 'HIERARCHY':
    case 'DEPARTMENT':
    case 'TEAM':
      return 'team';
    case 'TENANT':
    case 'PLATFORM':
      return 'all';
    default:
      return 'own';
  }
}

// ---------------------------------------------------------------------------
// Cache Service
// ---------------------------------------------------------------------------

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 10_000; // 10s base, doubles each retry

class RBPCacheService {
  private roles: Map<string, RBPRole> = new Map();
  private areas: Map<string, RBPArea> = new Map();
  private rolePermissionStrings: Map<string, Permission[]> = new Map();
  private rawPermissions: Map<string, Map<string, RBPPermissionSet>> = new Map();
  private loadedAt = 0;
  private ttlMs: number;
  private _initialized = false;

  constructor() {
    this.ttlMs = parseInt(process.env.RBP_CACHE_TTL_MS || '', 10) || DEFAULT_TTL_MS;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  isInitialized(): boolean {
    return this._initialized;
  }

  getStats(): { roles: number; areas: number; permissions: number } {
    return {
      roles: this.roles.size,
      areas: this.areas.size,
      permissions:
        this.rawPermissions.size > 0
          ? Array.from(this.rawPermissions.values()).reduce((sum, m) => sum + m.size, 0)
          : 0,
    };
  }

  /**
   * Get legacy Permission[] array for a role — compatible with ROLE_PERMISSIONS constant.
   * Handles legacy role aliases (SYSADMIN→TENANT_OWNER, ADMIN→TENANT_OWNER, etc.)
   */
  getRolePermissions(roleCode: string): Permission[] {
    this.ensureLoaded();
    const mapped = this.mapLegacyRoleCode(roleCode);
    return this.rolePermissionStrings.get(mapped) || [];
  }

  /**
   * Get hierarchy level for a role — compatible with USER_ROLE_HIERARCHY constant.
   */
  getRoleLevel(roleCode: string): number {
    this.ensureLoaded();
    const mapped = this.mapLegacyRoleCode(roleCode);
    const role = this.roles.get(mapped);
    return role?.hierarchyLevel ?? 999;
  }

  /**
   * Get area-specific permission set for a role.
   */
  getAreaPermission(roleCode: string, areaCode: string): RBPPermissionSet | null {
    this.ensureLoaded();
    const mapped = this.mapLegacyRoleCode(roleCode);
    const rolePerms = this.rawPermissions.get(mapped);
    if (!rolePerms) return null;
    return rolePerms.get(areaCode) || null;
  }

  getAllRoles(): RBPRole[] {
    this.ensureLoaded();
    return Array.from(this.roles.values());
  }

  /**
   * Force reload from DB.
   */
  async refresh(): Promise<void> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await this.loadFromDB();
        this._initialized = true;
        this.loadedAt = Date.now();
        return;
      } catch (err) {
        lastError = err as Error;
        const delayMs = RETRY_BASE_MS * Math.pow(2, attempt);
        console.error(
          `[RBP Cache] Load attempt ${attempt + 1}/${MAX_RETRIES} failed: ${(err as Error).message}. Retry in ${delayMs / 1000}s`
        );
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    throw new Error(`[RBP Cache] Failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private ensureLoaded(): void {
    if (!this._initialized) {
      // Synchronous check — if not loaded, return empty (graceful degradation)
      console.warn('[RBP Cache] Not initialized — returning empty permissions');
      return;
    }
    // Check TTL
    if (Date.now() - this.loadedAt > this.ttlMs) {
      // Trigger async refresh but don't block
      this.refresh().catch((err) =>
        console.error('[RBP Cache] Background refresh failed:', (err as Error).message)
      );
    }
  }

  private async loadFromDB(): Promise<void> {
    // 1. Load roles
    const rolesResult = await pool.query(`
      SELECT code, name, description_it, description_en, hierarchy_level, inherits_from, is_system_role
      FROM rbp_roles ORDER BY hierarchy_level
    `);
    this.roles.clear();
    for (const row of rolesResult.rows) {
      this.roles.set(row.code, {
        code: row.code,
        name: row.name,
        descriptionIt: row.description_it ?? null,
        descriptionEn: row.description_en ?? null,
        hierarchyLevel: row.hierarchy_level,
        inheritsFrom: row.inherits_from,
        isSystemRole: row.is_system_role,
      });
    }

    // 2. Load functional areas
    const areasResult = await pool.query(`
      SELECT code, name, name_it, name_en, description_it, description_en FROM rbp_functional_areas ORDER BY code
    `);
    this.areas.clear();
    for (const row of areasResult.rows) {
      this.areas.set(row.code, {
        code: row.code,
        name: row.name,
        nameIt: row.name_it ?? null,
        nameEn: row.name_en ?? null,
        descriptionIt: row.description_it ?? null,
        descriptionEn: row.description_en ?? null,
      });
    }

    // 3. Load effective permissions per role (using inheritance-resolving SQL function)
    this.rawPermissions.clear();
    this.rolePermissionStrings.clear();

    for (const [roleCode, role] of this.roles) {
      // SUPERUSER gets all permissions
      if (role.isSystemRole && roleCode === 'SUPERUSER') {
        this.rolePermissionStrings.set(roleCode, this.buildSuperuserPermissions());
        this.rawPermissions.set(roleCode, new Map());
        continue;
      }

      const permResult = await pool.query(
        `
        SELECT * FROM rbp_get_user_effective_permissions($1)
      `,
        [roleCode]
      );

      const rolePermsMap = new Map<string, RBPPermissionSet>();
      for (const row of permResult.rows) {
        rolePermsMap.set(row.functional_area_code, {
          canView: row.can_view,
          canCreate: row.can_create,
          canEdit: row.can_edit,
          canDelete: row.can_delete,
          canApprove: row.can_approve,
          canExport: row.can_export,
          scopeType: row.scope_type,
        });
      }
      this.rawPermissions.set(roleCode, rolePermsMap);

      // Translate to permission strings
      const permStrings = this.translateToPermissionStrings(rolePermsMap);
      this.rolePermissionStrings.set(roleCode, permStrings);
    }
  }

  private buildSuperuserPermissions(): Permission[] {
    // SUPERUSER gets every possible permission string
    const allPerms: Set<Permission> = new Set();
    for (const mapping of Object.values(AREA_PERMISSION_MAP)) {
      if (mapping.view) mapping.view.forEach((p) => allPerms.add(p));
      if (mapping.viewScoped) {
        mapping.viewScoped.all.forEach((p) => allPerms.add(p));
        mapping.viewScoped.team.forEach((p) => allPerms.add(p));
        mapping.viewScoped.own.forEach((p) => allPerms.add(p));
      }
      if (mapping.create) mapping.create.forEach((p) => allPerms.add(p));
      if (mapping.edit) mapping.edit.forEach((p) => allPerms.add(p));
      if (mapping.delete) mapping.delete.forEach((p) => allPerms.add(p));
      if (mapping.approve) mapping.approve.forEach((p) => allPerms.add(p));
      if (mapping.export) mapping.export.forEach((p) => allPerms.add(p));
    }
    return Array.from(allPerms);
  }

  private translateToPermissionStrings(perms: Map<string, RBPPermissionSet>): Permission[] {
    const result: Set<Permission> = new Set();

    for (const [areaCode, perm] of perms) {
      const mapping = AREA_PERMISSION_MAP[areaCode];
      if (!mapping) continue;

      const level = scopeToLevel(perm.scopeType);

      if (perm.canView) {
        if (mapping.viewScoped) {
          // Add permissions up to the scope level
          mapping.viewScoped[level]?.forEach((p) => result.add(p));
        }
        if (mapping.view) {
          mapping.view.forEach((p) => result.add(p));
        }
      }
      if (perm.canCreate && mapping.create) {
        mapping.create.forEach((p) => result.add(p));
      }
      if (perm.canEdit && mapping.edit) {
        mapping.edit.forEach((p) => result.add(p));
      }
      if (perm.canDelete && mapping.delete) {
        mapping.delete.forEach((p) => result.add(p));
      }
      if (perm.canApprove && mapping.approve) {
        mapping.approve.forEach((p) => result.add(p));
      }
      if (perm.canExport && mapping.export) {
        mapping.export.forEach((p) => result.add(p));
      }
    }

    return Array.from(result);
  }

  /**
   * Map legacy role codes to current DB role codes.
   * Must match mapLegacyRole() in rbac.ts.
   */
  private mapLegacyRoleCode(role: string): string {
    const legacyMap: Record<string, string> = {
      ADMIN: 'TENANT_OWNER',
      TENANT_ADMIN: 'TENANT_OWNER',
      SYSADMIN: 'TENANT_OWNER',
      HR: 'HR_MANAGER',
      DEMO: 'EMPLOYEE',
      USER: 'EMPLOYEE',
    };
    return legacyMap[role] || role;
  }
}

// Singleton export
export const rbpCache = new RBPCacheService();
