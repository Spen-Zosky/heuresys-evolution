/**
 * Auth Middleware Unit Tests
 * Comprehensive tests for JWT authentication, token generation/verification,
 * role-based access control (RBAC), and permission checks.
 *
 * Covers:
 *   - generateToken: valid JWT creation, claims, jti, issuer
 *   - generateRefreshToken: refresh token creation, jti, type claim
 *   - verifyToken: valid/invalid/expired/tampered/wrong-secret tokens
 *   - verifyRefreshToken: valid refresh, wrong secret isolation
 *   - authMiddleware: valid token, missing token, invalid format, expired, blacklisted
 *   - optionalAuthMiddleware: with/without/invalid tokens
 *   - requireRole: all 8 RBAC roles, hierarchy, legacy mappings, edge cases
 *   - requirePermission: matching, missing, SYSADMIN bypass, no user
 *   - requireAllPermissions: all match, partial match, SYSADMIN bypass, no user
 *   - getUserOrThrow: present user, missing user
 *   - ROLES hierarchy: numeric values, ordering, legacy aliases
 */
export {};
//# sourceMappingURL=auth.test.d.ts.map