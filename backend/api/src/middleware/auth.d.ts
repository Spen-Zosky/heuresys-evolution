/**
 * Authentication Middleware
 * JWT-based authentication with role/permission verification
 * NOTE: Database users table columns:
 *   id, username, password_hash, role, permissions, is_active,
 *   last_login, created_at, updated_at, employee_id
 */
import { Request, Response, NextFunction } from 'express';
export declare const ROLES: {
    readonly SUPERUSER: -1;
    readonly TENANT_OWNER: 0;
    readonly IT_ADMIN: 1;
    readonly HR_DIRECTOR: 2;
    readonly HR_MANAGER: 3;
    readonly DEPT_HEAD: 4;
    readonly LINE_MANAGER: 5;
    readonly EMPLOYEE: 6;
    readonly ADMIN: 0;
    readonly TENANT_ADMIN: 0;
    readonly SYSADMIN: 0;
    readonly HR: 3;
    readonly DEMO: 6;
    readonly USER: 6;
};
export type Role = keyof typeof ROLES;
export interface JWTPayload {
    userId: string;
    username: string;
    role: Role;
    permissions: string[];
    employeeId?: string;
    tenantId?: string;
    activeTenantId?: string;
    jti?: string;
    iat?: number;
    exp?: number;
}
export interface AuthenticatedRequest extends Request {
    user: JWTPayload;
}
/**
 * Generate JWT token for a user.
 * Includes a unique jti (JWT ID) claim for token blacklisting support.
 */
export declare function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>): string;
/**
 * Generate refresh token (longer expiration).
 * Signed with a separate refresh secret for security isolation.
 * Includes a unique jti (JWT ID) claim for token blacklisting support.
 */
export declare function generateRefreshToken(userId: string): string;
/**
 * Verify and decode JWT token
 */
export declare function verifyToken(token: string): JWTPayload;
/**
 * Verify and decode refresh token (uses separate refresh secret)
 */
export declare function verifyRefreshToken(token: string): JWTPayload;
/** Cookie name for httpOnly JWT storage */
export declare const ACCESS_TOKEN_COOKIE = "heuresys_access_token";
export declare const REFRESH_TOKEN_COOKIE = "heuresys_refresh_token";
/** Set auth cookies on the response */
export declare function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void;
/** Clear auth cookies */
export declare function clearAuthCookies(res: Response): void;
/**
 * Authentication middleware
 * Verifies JWT token, checks blacklist, and attaches user to request
 */
export declare function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void>;
/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't fail if no token
 */
export declare function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void>;
/**
 * Test-only utility to pre-populate the role verification cache.
 * This avoids DB queries during unit tests, preventing mock queue consumption.
 * @internal — only for use in test files
 */
export declare function _prefillRoleCache(userId: string, role: Role, ttl?: number): void;
/**
 * Test-only utility to clear the role verification cache.
 * @internal — only for use in test files
 */
export declare function _clearRoleCache(): void;
/**
 * Role-based authorization middleware factory
 * Allows access if user has required role or higher privilege.
 * Verifies role against database (with cache) to prevent JWT role escalation.
 */
export declare function requireRole(...allowedRoles: Role[]): (req: Request, _res: Response, next: NextFunction) => Promise<void>;
/**
 * Permission-based authorization middleware factory
 * Allows access if user has at least one of the required permissions
 */
export declare function requirePermission(...requiredPermissions: string[]): (req: Request, _res: Response, next: NextFunction) => void;
/**
 * Require all specified permissions
 */
export declare function requireAllPermissions(...requiredPermissions: string[]): (req: Request, _res: Response, next: NextFunction) => void;
/**
 * Get user from request or throw error
 */
export declare function getUserOrThrow(req: Request): JWTPayload;
//# sourceMappingURL=auth.d.ts.map