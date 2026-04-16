import type { Permission } from '@heuresys/shared';
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
declare class RBPCacheService {
    private roles;
    private areas;
    private rolePermissionStrings;
    private rawPermissions;
    private loadedAt;
    private ttlMs;
    private _initialized;
    constructor();
    isInitialized(): boolean;
    getStats(): {
        roles: number;
        areas: number;
        permissions: number;
    };
    /**
     * Get legacy Permission[] array for a role — compatible with ROLE_PERMISSIONS constant.
     * Handles legacy role aliases (SYSADMIN→TENANT_OWNER, ADMIN→TENANT_OWNER, etc.)
     */
    getRolePermissions(roleCode: string): Permission[];
    /**
     * Get hierarchy level for a role — compatible with USER_ROLE_HIERARCHY constant.
     */
    getRoleLevel(roleCode: string): number;
    /**
     * Get area-specific permission set for a role.
     */
    getAreaPermission(roleCode: string, areaCode: string): RBPPermissionSet | null;
    getAllRoles(): RBPRole[];
    /**
     * Force reload from DB.
     */
    refresh(): Promise<void>;
    private ensureLoaded;
    private loadFromDB;
    private buildSuperuserPermissions;
    private translateToPermissionStrings;
    /**
     * Map legacy role codes to current DB role codes.
     * Must match mapLegacyRole() in rbac.ts.
     */
    private mapLegacyRoleCode;
}
export declare const rbpCache: RBPCacheService;
export {};
//# sourceMappingURL=rbp-cache.d.ts.map