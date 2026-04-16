/**
 * RBP Cache Service — Data-Driven Permission Loading
 * Replaces static ROLE_PERMISSIONS and USER_ROLE_HIERARCHY constants
 * with DB-driven data from rbp_roles, rbp_functional_areas, rbp_role_permissions.
 *
 * Uses rbp_get_user_effective_permissions() SQL function for inheritance resolution.
 */
import { pool } from '../config/database.js';
const AREA_PERMISSION_MAP = {
    PLATFORM: {
        view: ['platform:admin'],
    },
    ORGANIZATION: {
        view: ['tenant:view'],
        edit: ['tenant:configure'],
    },
    SECURITY: {
        viewScoped: {
            own: ['users:view:own'],
            team: ['users:view:own', 'users:view:all'],
            all: ['users:view:all'],
        },
        edit: ['users:manage'],
    },
    CORE_HR: {
        viewScoped: {
            own: ['employees:view:own'],
            team: ['employees:view:own', 'employees:view:team'],
            all: [
                'employees:view:all',
                'employees:view:team',
                'employees:view:own',
            ],
        },
        create: ['employees:create'],
        edit: ['employees:update'],
        delete: ['employees:delete'],
    },
    TIME_ATTENDANCE: {
        viewScoped: {
            own: ['leave:view:own'],
            team: ['leave:view:own', 'leave:view:team'],
            all: [
                'leave:view:all',
                'leave:view:team',
                'leave:view:own',
            ],
        },
        create: ['leave:request'],
        approve: ['leave:approve'],
        edit: ['leave:configure'],
    },
    ANALYTICS: {
        viewScoped: {
            own: [],
            team: ['reports:view:team'],
            all: ['reports:view:all', 'reports:view:team'],
        },
        export: ['reports:export'],
    },
    AI_SERVICES: {
        view: ['ai:query'],
        edit: ['ai:configure'],
    },
    SELF_SERVICE: {
        viewScoped: {
            own: ['documents:view:own'],
            team: ['documents:view:own'],
            all: ['documents:view:all', 'documents:view:own'],
        },
        create: ['documents:upload'],
        delete: ['documents:delete'],
    },
    COMPLIANCE: {
        view: ['audit:view'],
        export: ['audit:export'],
    },
};
function scopeToLevel(scope) {
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
    roles = new Map();
    areas = new Map();
    rolePermissionStrings = new Map();
    rawPermissions = new Map();
    loadedAt = 0;
    ttlMs;
    _initialized = false;
    constructor() {
        this.ttlMs = parseInt(process.env.RBP_CACHE_TTL_MS || '', 10) || DEFAULT_TTL_MS;
    }
    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------
    isInitialized() {
        return this._initialized;
    }
    getStats() {
        return {
            roles: this.roles.size,
            areas: this.areas.size,
            permissions: this.rawPermissions.size > 0
                ? Array.from(this.rawPermissions.values()).reduce((sum, m) => sum + m.size, 0)
                : 0,
        };
    }
    /**
     * Get legacy Permission[] array for a role — compatible with ROLE_PERMISSIONS constant.
     * Handles legacy role aliases (SYSADMIN→TENANT_OWNER, ADMIN→TENANT_OWNER, etc.)
     */
    getRolePermissions(roleCode) {
        this.ensureLoaded();
        const mapped = this.mapLegacyRoleCode(roleCode);
        return this.rolePermissionStrings.get(mapped) || [];
    }
    /**
     * Get hierarchy level for a role — compatible with USER_ROLE_HIERARCHY constant.
     */
    getRoleLevel(roleCode) {
        this.ensureLoaded();
        const mapped = this.mapLegacyRoleCode(roleCode);
        const role = this.roles.get(mapped);
        return role?.hierarchyLevel ?? 999;
    }
    /**
     * Get area-specific permission set for a role.
     */
    getAreaPermission(roleCode, areaCode) {
        this.ensureLoaded();
        const mapped = this.mapLegacyRoleCode(roleCode);
        const rolePerms = this.rawPermissions.get(mapped);
        if (!rolePerms)
            return null;
        return rolePerms.get(areaCode) || null;
    }
    getAllRoles() {
        this.ensureLoaded();
        return Array.from(this.roles.values());
    }
    /**
     * Force reload from DB.
     */
    async refresh() {
        let lastError = null;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                await this.loadFromDB();
                this._initialized = true;
                this.loadedAt = Date.now();
                return;
            }
            catch (err) {
                lastError = err;
                const delayMs = RETRY_BASE_MS * Math.pow(2, attempt);
                console.error(`[RBP Cache] Load attempt ${attempt + 1}/${MAX_RETRIES} failed: ${err.message}. Retry in ${delayMs / 1000}s`);
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
    ensureLoaded() {
        if (!this._initialized) {
            // Synchronous check — if not loaded, return empty (graceful degradation)
            console.warn('[RBP Cache] Not initialized — returning empty permissions');
            return;
        }
        // Check TTL
        if (Date.now() - this.loadedAt > this.ttlMs) {
            // Trigger async refresh but don't block
            this.refresh().catch((err) => console.error('[RBP Cache] Background refresh failed:', err.message));
        }
    }
    async loadFromDB() {
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
            const permResult = await pool.query(`
        SELECT * FROM rbp_get_user_effective_permissions($1)
      `, [roleCode]);
            const rolePermsMap = new Map();
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
    buildSuperuserPermissions() {
        // SUPERUSER gets every possible permission string
        const allPerms = new Set();
        for (const mapping of Object.values(AREA_PERMISSION_MAP)) {
            if (mapping.view)
                mapping.view.forEach((p) => allPerms.add(p));
            if (mapping.viewScoped) {
                mapping.viewScoped.all.forEach((p) => allPerms.add(p));
                mapping.viewScoped.team.forEach((p) => allPerms.add(p));
                mapping.viewScoped.own.forEach((p) => allPerms.add(p));
            }
            if (mapping.create)
                mapping.create.forEach((p) => allPerms.add(p));
            if (mapping.edit)
                mapping.edit.forEach((p) => allPerms.add(p));
            if (mapping.delete)
                mapping.delete.forEach((p) => allPerms.add(p));
            if (mapping.approve)
                mapping.approve.forEach((p) => allPerms.add(p));
            if (mapping.export)
                mapping.export.forEach((p) => allPerms.add(p));
        }
        return Array.from(allPerms);
    }
    translateToPermissionStrings(perms) {
        const result = new Set();
        for (const [areaCode, perm] of perms) {
            const mapping = AREA_PERMISSION_MAP[areaCode];
            if (!mapping)
                continue;
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
    mapLegacyRoleCode(role) {
        const legacyMap = {
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
//# sourceMappingURL=rbp-cache.js.map