/**
 * Role-Based Access Control (RBAC) Middleware
 * Granular permission enforcement based on PRD requirements
 * Epic: 2 - User Management & Tenant Configuration
 * Story: 2.3 - Role-Based Access Control (RBAC) Enforcement
 */
import { Request, Response, NextFunction } from 'express';
import { Permission } from '@heuresys/shared';
import { Role } from './auth.js';
type RBACRole = 'SUPERUSER' | 'TENANT_OWNER' | 'IT_ADMIN' | 'HR_DIRECTOR' | 'HR_MANAGER' | 'DEPT_HEAD' | 'LINE_MANAGER' | 'EMPLOYEE';
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
/**
 * Check if user has at least one of the required permissions
 * @param requiredPermissions Array of permissions (OR logic)
 */
export declare function checkPermission(...requiredPermissions: Permission[]): (req: Request, _res: Response, next: NextFunction) => Promise<void>;
/**
 * Check if user has ALL of the required permissions
 * @param requiredPermissions Array of permissions (AND logic)
 */
export declare function checkAllPermissions(...requiredPermissions: Permission[]): (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare function determineAccessScope(resource: 'employees' | 'leave' | 'reports' | 'goals' | 'performance' | 'compensation'): (req: Request, _res: Response, next: NextFunction) => Promise<void>;
/**
 * Filter query results based on access scope
 * Use after determineAccessScope middleware
 */
export declare function applyScopeFilter(tableName?: string): (req: Request, _res: Response, next: NextFunction) => void;
/**
 * Check if user owns a resource or has permission to access it
 */
export declare function checkResourceOwnership(resourceType: string, getOwnerId: (req: Request) => string | Promise<string>): (req: Request, _res: Response, next: NextFunction) => Promise<void>;
/**
 * Log permission-related access for audit trail
 */
export declare function logPermissionAccess(userId: string, tenantId: string | undefined, action: string, resourceType: string, resourceId: string, granted: boolean, details?: Record<string, unknown>): Promise<void>;
/**
 * Get user's effective permissions (role + custom)
 */
export declare function getEffectivePermissions(role: Role, customPermissions?: string[]): Permission[];
/**
 * Check if role A has higher privilege than role B
 */
export declare function hasHigherPrivilege(roleA: RBACRole, roleB: RBACRole): boolean;
export declare const canViewAllEmployees: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const canViewTeamEmployees: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const canManageEmployees: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const canApproveLeave: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const canConfigureTenant: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const canManageUsers: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const canViewAllReports: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const canExportReports: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const canQueryAI: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const canConfigureAI: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const canViewAuditLogs: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const canExportAuditLogs: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export {};
//# sourceMappingURL=rbac.d.ts.map