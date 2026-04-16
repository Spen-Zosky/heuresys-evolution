/**
 * Authentication Middleware
 * JWT-based authentication with role/permission verification
 * NOTE: Database users table columns:
 *   id, username, password_hash, role, permissions, is_active,
 *   last_login, created_at, updated_at, employee_id
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config/index.js';
import { Errors } from '../errors/factory.js';
import { isTokenBlacklisted } from '../config/redis.js';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

// Type for valid JWT expiry strings
type ExpiryString = '15m' | '1h' | '7d' | '30d' | string;

// User roles with hierarchy (lower number = higher privilege)
// RBAC system with SUPERUSER god-role + per-tenant TENANT_OWNER
//
// Current DB values: SUPERUSER, TENANT_OWNER, HR, USER, DEMO
// Extended hierarchy (IT_ADMIN, HR_DIRECTOR, HR_MANAGER, DEPT_HEAD, LINE_MANAGER,
// EMPLOYEE) is the target RBAC model. Legacy aliases map old DB values to the
// hierarchy for backward compatibility.
export const ROLES = {
  SUPERUSER: -1, // Platform god-role - Cross-tenant
  TENANT_OWNER: 0, // Per-tenant full admin (ex ADMIN/TENANT_ADMIN)
  IT_ADMIN: 1, // IT Director - Team + IT configuration
  HR_DIRECTOR: 2, // HR Strategic - All employees
  HR_MANAGER: 3, // HR Operational - All employees (limited strategic)
  DEPT_HEAD: 4, // OrgUnit Head - OrgUnit scope
  LINE_MANAGER: 5, // Team Manager - Direct reports
  EMPLOYEE: 6, // Standard Employee - Self only
  // Legacy role mappings (backwards compatibility)
  ADMIN: 0, // → TENANT_OWNER
  TENANT_ADMIN: 0, // → TENANT_OWNER
  SYSADMIN: 0, // → TENANT_OWNER (legacy alias)
  HR: 3, // → HR_MANAGER
  DEMO: 6, // → EMPLOYEE
  USER: 6, // → EMPLOYEE
} as const;

export type Role = keyof typeof ROLES;

// JWT payload structure
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

// Extended request with user info
export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}

// Get JWT secret from config (for access tokens)
const getJWTSecret = (): string => {
  return config.jwt.secret;
};

// Get refresh token secret from config (for refresh tokens)
const getRefreshSecret = (): string => {
  return config.jwt.refreshSecret;
};

/**
 * Generate JWT token for a user.
 * Includes a unique jti (JWT ID) claim for token blacklisting support.
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>): string {
  const tokenPayload = {
    ...payload,
    jti: crypto.randomUUID(),
  };
  return jwt.sign(tokenPayload, getJWTSecret(), {
    expiresIn: config.jwt.accessTokenExpiry as ExpiryString,
    issuer: 'heuresys-platform',
  } as SignOptions);
}

/**
 * Generate refresh token (longer expiration).
 * Signed with a separate refresh secret for security isolation.
 * Includes a unique jti (JWT ID) claim for token blacklisting support.
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh', jti: crypto.randomUUID() }, getRefreshSecret(), {
    expiresIn: config.jwt.refreshTokenExpiry as ExpiryString,
    issuer: 'heuresys-platform',
  } as SignOptions);
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, getJWTSecret(), {
      issuer: 'heuresys-platform',
    }) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw Errors.tokenExpired();
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw Errors.tokenInvalid();
    }
    throw error;
  }
}

/**
 * Verify and decode refresh token (uses separate refresh secret)
 */
export function verifyRefreshToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, getRefreshSecret(), {
      issuer: 'heuresys-platform',
    }) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw Errors.tokenExpired();
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw Errors.tokenInvalid();
    }
    throw error;
  }
}

/** Cookie name for httpOnly JWT storage */
export const ACCESS_TOKEN_COOKIE = 'heuresys_access_token';
export const REFRESH_TOKEN_COOKIE = 'heuresys_refresh_token';

/**
 * Cookie options for JWT tokens.
 * httpOnly prevents XSS from reading the token.
 * sameSite: 'lax' works for same-origin; production should use 'none' + secure.
 */
function getCookieOptions(maxAgeMs: number): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'none';
  path: string;
  maxAge: number;
  domain?: string;
} {
  const isProduction = config.nodeEnv === 'production';
  const cookieDomain = process.env.COOKIE_DOMAIN; // e.g. '.heuresys.com'
  const opts: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'none';
    path: string;
    maxAge: number;
    domain?: string;
  } = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
  if (cookieDomain) {
    opts.domain = cookieDomain;
  }
  return opts;
}

/** Set auth cookies on the response */
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, getCookieOptions(15 * 60 * 1000)); // 15min
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000)); // 7d
}

/** Clear auth cookies */
export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
}

/**
 * Extract token from Authorization header or httpOnly cookie (dual-mode).
 * Priority: Authorization header > httpOnly cookie
 */
function extractToken(req: Request): string | null {
  // 1. Try Authorization header first (backward compatible)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1] ?? null;
    }
  }

  // 2. Fall back to httpOnly cookie
  return req.cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

/**
 * Authentication middleware
 * Verifies JWT token, checks blacklist, and attaches user to request
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      throw Errors.unauthorized('No token provided');
    }

    const payload = verifyToken(token);

    // Check if token has been blacklisted (e.g. after logout)
    if (payload.jti) {
      const blacklisted = await isTokenBlacklisted(payload.jti);
      if (blacklisted) {
        throw Errors.unauthorized('Token has been revoked');
      }
    }

    (req as AuthenticatedRequest).user = payload;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't fail if no token
 */
export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (token) {
      const payload = verifyToken(token);
      (req as AuthenticatedRequest).user = payload;
    }

    next();
  } catch (_error) {
    // Ignore token errors for optional auth
    next();
  }
}

// In-memory cache for DB role verification (prevents JWT role escalation)
const roleVerificationCache = new Map<string, { role: Role; expiry: number }>();
const ROLE_CACHE_TTL = 15_000; // 15 seconds — short TTL to limit role escalation window

/**
 * Test-only utility to pre-populate the role verification cache.
 * This avoids DB queries during unit tests, preventing mock queue consumption.
 * @internal — only for use in test files
 */
export function _prefillRoleCache(userId: string, role: Role, ttl = 300_000): void {
  roleVerificationCache.set(userId, { role, expiry: Date.now() + ttl });
}

/**
 * Test-only utility to clear the role verification cache.
 * @internal — only for use in test files
 */
export function _clearRoleCache(): void {
  roleVerificationCache.clear();
}

/**
 * Role-based authorization middleware factory
 * Allows access if user has required role or higher privilege.
 * Verifies role against database (with cache) to prevent JWT role escalation.
 */
export function requireRole(...allowedRoles: Role[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return next(Errors.unauthorized('Authentication required'));
    }

    // Verify role against database to prevent JWT escalation attacks
    const userId = authReq.user.userId;
    let verifiedRole: Role = authReq.user.role;
    const isTest = process.env.NODE_ENV === 'test';
    const now = Date.now();
    const cached = roleVerificationCache.get(userId);

    if (cached && cached.expiry > now) {
      verifiedRole = cached.role;
    } else if (!isTest) {
      // Skip DB verification in test environment to avoid consuming mock query queue.
      // In production, verify role from DB to prevent JWT role escalation attacks.
      try {
        const result = await pool.query(
          'SELECT role FROM users WHERE id = $1 AND is_active = true',
          [userId]
        );
        if (result.rows.length > 0) {
          verifiedRole = result.rows[0].role as Role;
          roleVerificationCache.set(userId, { role: verifiedRole, expiry: now + ROLE_CACHE_TTL });
        } else {
          return next(Errors.unauthorized('User account not found or inactive'));
        }
      } catch (dbErr) {
        // DB unavailable — return 503 instead of trusting potentially stale JWT role.
        // This prevents role escalation when an admin demotes a user but DB is unreachable.
        logger.error(
          `[Auth] DB unavailable for role verification: ${String((dbErr as Error).message)}`
        );
        return next(Errors.serviceUnavailable('role-verification'));
      }
    }

    const userRoleLevel = ROLES[verifiedRole] ?? ROLES.USER;
    const hasRole = allowedRoles.some((role) => userRoleLevel <= ROLES[role]);

    if (!hasRole) {
      return next(Errors.insufficientRole(allowedRoles.join(' or '), verifiedRole));
    }

    next();
  };
}

/**
 * Permission-based authorization middleware factory
 * Allows access if user has at least one of the required permissions
 */
export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return next(Errors.unauthorized('Authentication required'));
    }

    // SUPERUSER has all permissions
    if (authReq.user.role === 'SUPERUSER') {
      return next();
    }

    const userPermissions = authReq.user.permissions || [];
    const hasPermission = requiredPermissions.some((perm) => userPermissions.includes(perm));

    if (!hasPermission) {
      return next(Errors.forbidden(requiredPermissions.join(', '), 'access'));
    }

    next();
  };
}

/**
 * Require all specified permissions
 */
export function requireAllPermissions(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return next(Errors.unauthorized('Authentication required'));
    }

    // SUPERUSER has all permissions
    if (authReq.user.role === 'SUPERUSER') {
      return next();
    }

    const userPermissions = authReq.user.permissions || [];
    const hasAllPermissions = requiredPermissions.every((perm) => userPermissions.includes(perm));

    if (!hasAllPermissions) {
      return next(Errors.forbidden(requiredPermissions.join(', '), 'access'));
    }

    next();
  };
}

/**
 * Get user from request or throw error
 */
export function getUserOrThrow(req: Request): JWTPayload {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    throw Errors.unauthorized('Authentication required');
  }
  return authReq.user;
}
