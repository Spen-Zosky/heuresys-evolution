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
declare global {
    namespace Express {
        interface Request {
            rbpContext?: RbpUserContext;
            rbpScope?: string;
            scopeFilter?: {
                where: string;
                params: any[];
            };
        }
    }
}
export declare function invalidateRbpCache(roleCode?: string): void;
export declare function loadRbpContextMiddleware(): (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare function requirePermission(area: string, action: PermissionAction): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare function applyScopeFilter(area: string): (_req: Request, _res: Response, next: NextFunction) => void;
export declare function getUserPermissions(roleCode: string): Promise<{
    permissions: RbpPermission[];
    dashboards: string[];
    defaultDashboardPath: string;
    isSystemRole: boolean;
}>;
export declare function getDashboardNavItems(dashboardCode: string): Promise<{
    id: any;
    type: any;
    section: any;
    sortOrder: any;
    label: any;
    icon: any;
    routePath: any;
    externalUrl: any;
    pageCode: any;
    targetDashboard: any;
}[]>;
/**
 * Response middleware that masks or hides sensitive fields based on the user's
 * role and the field's data classification level.
 *
 * Actions per field:
 * - SHOW: field passes through unchanged
 * - MASK: field value replaced with '***'
 * - HIDE: field removed from response entirely
 */
export declare function applyFieldPolicy(): (_req: Request, _res: Response, next: NextFunction) => void;
export declare const isRbpEnabled: boolean;
export {};
//# sourceMappingURL=rbpMiddleware.d.ts.map