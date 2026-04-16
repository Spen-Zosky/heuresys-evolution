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
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { buildTokenPayload, resetFactories, } from '../factories/index.js';
// The setup.ts sets JWT_SECRET and REFRESH_TOKEN_SECRET for tests
const TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
const TEST_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
// ---------------------------------------------------------------------------
// ESM Mock for Redis module (must happen before importing auth)
// ---------------------------------------------------------------------------
const mockIsTokenBlacklisted = jest.fn();
mockIsTokenBlacklisted.mockResolvedValue(false);
// Use absolute path to avoid resolver issues with jest.unstable_mockModule
const redisModulePath = new URL('../../config/redis.js', import.meta.url).pathname.replace(/\.js$/, '.ts');
jest.unstable_mockModule(redisModulePath, () => ({
    isTokenBlacklisted: mockIsTokenBlacklisted,
    getRedis: jest.fn(),
    isRedisReady: jest.fn().mockReturnValue(false),
    blacklistToken: jest.fn(),
    closeRedis: jest.fn(),
}));
// Dynamic import AFTER mocking (required for ESM)
const { generateToken, generateRefreshToken, verifyToken, verifyRefreshToken, authMiddleware, optionalAuthMiddleware, requireRole, requirePermission, requireAllPermissions, getUserOrThrow, ROLES, } = await import('../../middleware/auth.js');
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createMockReq(overrides = {}) {
    return { headers: {}, body: {}, ...overrides };
}
function createMockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}
/**
 * Alias for buildTokenPayload — keeps existing tests readable while
 * delegating to the shared factory.
 */
function makePayload(overrides = {}) {
    return buildTokenPayload({
        userId: 'user-001',
        ...overrides,
    });
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Auth Middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    beforeEach(() => {
        resetFactories();
        mockReq = createMockReq();
        mockRes = createMockRes();
        mockNext = jest.fn();
        mockIsTokenBlacklisted.mockReset();
        mockIsTokenBlacklisted.mockResolvedValue(false);
    });
    // =========================================================================
    // generateToken
    // =========================================================================
    describe('generateToken', () => {
        it('should generate a valid JWT with 3 dot-separated segments', () => {
            const token = generateToken(makePayload());
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3);
        });
        it('should embed all payload fields in the token', () => {
            const payload = makePayload({
                userId: 'u-42',
                username: 'admin',
                role: 'SYSADMIN',
                permissions: ['ALL'],
                employeeId: 'emp-99',
                tenantId: 'ten-01',
            });
            const token = generateToken(payload);
            const decoded = jwt.decode(token);
            expect(decoded['userId']).toBe('u-42');
            expect(decoded['username']).toBe('admin');
            expect(decoded['role']).toBe('SYSADMIN');
            expect(decoded['permissions']).toEqual(['ALL']);
            expect(decoded['employeeId']).toBe('emp-99');
            expect(decoded['tenantId']).toBe('ten-01');
        });
        it('should include a jti (JWT ID) claim', () => {
            const token = generateToken(makePayload());
            const decoded = jwt.decode(token);
            expect(decoded['jti']).toBeDefined();
            expect(typeof decoded['jti']).toBe('string');
            expect(decoded['jti'].length).toBeGreaterThan(0);
        });
        it('should generate unique jti for each token', () => {
            const t1 = generateToken(makePayload());
            const t2 = generateToken(makePayload());
            const d1 = jwt.decode(t1);
            const d2 = jwt.decode(t2);
            expect(d1['jti']).not.toBe(d2['jti']);
        });
        it('should set the issuer to heuresys-platform', () => {
            const token = generateToken(makePayload());
            const decoded = jwt.decode(token);
            expect(decoded['iss']).toBe('heuresys-platform');
        });
        it('should set iat and exp claims', () => {
            const token = generateToken(makePayload());
            const decoded = jwt.decode(token);
            expect(typeof decoded['iat']).toBe('number');
            expect(typeof decoded['exp']).toBe('number');
            expect(decoded['exp']).toBeGreaterThan(decoded['iat']);
        });
        it('should be verifiable with the correct secret', () => {
            const token = generateToken(makePayload());
            const verified = jwt.verify(token, TEST_JWT_SECRET, {
                issuer: 'heuresys-platform',
            });
            expect(verified['userId']).toBe('user-001');
        });
    });
    // =========================================================================
    // generateRefreshToken
    // =========================================================================
    describe('generateRefreshToken', () => {
        it('should generate a valid refresh token string', () => {
            const token = generateRefreshToken('user-123');
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3);
        });
        it('should contain userId and type=refresh claims', () => {
            const token = generateRefreshToken('user-abc');
            const decoded = jwt.decode(token);
            expect(decoded['userId']).toBe('user-abc');
            expect(decoded['type']).toBe('refresh');
        });
        it('should include a jti claim for blacklisting support', () => {
            const token = generateRefreshToken('user-123');
            const decoded = jwt.decode(token);
            expect(decoded['jti']).toBeDefined();
            expect(typeof decoded['jti']).toBe('string');
        });
        it('should set issuer to heuresys-platform', () => {
            const token = generateRefreshToken('user-123');
            const decoded = jwt.decode(token);
            expect(decoded['iss']).toBe('heuresys-platform');
        });
        it('should be signed with the refresh secret, not the access secret', () => {
            const token = generateRefreshToken('user-123');
            // Should verify with refresh secret
            const verified = jwt.verify(token, TEST_REFRESH_SECRET, {
                issuer: 'heuresys-platform',
            });
            expect(verified['userId']).toBe('user-123');
            // Should NOT verify with access secret
            expect(() => jwt.verify(token, TEST_JWT_SECRET, { issuer: 'heuresys-platform' })).toThrow();
        });
    });
    // =========================================================================
    // verifyToken
    // =========================================================================
    describe('verifyToken', () => {
        it('should verify a valid token and return payload', () => {
            const payload = makePayload({ userId: 'u-verify' });
            const token = generateToken(payload);
            const result = verifyToken(token);
            expect(result.userId).toBe('u-verify');
            expect(result.username).toBe('testuser');
            expect(result.role).toBe('EMPLOYEE');
        });
        it('should throw on completely invalid token string', () => {
            expect(() => verifyToken('not-a-jwt')).toThrow();
        });
        it('should throw on tampered token', () => {
            const token = generateToken(makePayload());
            const tampered = token.slice(0, -5) + 'XXXXX';
            expect(() => verifyToken(tampered)).toThrow();
        });
        it('should throw on expired token', () => {
            const expired = jwt.sign({ userId: 'u-exp', username: 'expired', role: 'EMPLOYEE', permissions: [] }, TEST_JWT_SECRET, { expiresIn: '-1s', issuer: 'heuresys-platform' });
            expect(() => verifyToken(expired)).toThrow();
        });
        it('should throw on token signed with wrong secret', () => {
            const wrongSecret = jwt.sign({ userId: 'u-wrong', username: 'wrong', role: 'EMPLOYEE', permissions: [] }, 'wrong-secret-key', { expiresIn: '1h', issuer: 'heuresys-platform' });
            expect(() => verifyToken(wrongSecret)).toThrow();
        });
        it('should throw on token with wrong issuer', () => {
            const wrongIssuer = jwt.sign({ userId: 'u-iss', username: 'issuer', role: 'EMPLOYEE', permissions: [] }, TEST_JWT_SECRET, { expiresIn: '1h', issuer: 'wrong-issuer' });
            expect(() => verifyToken(wrongIssuer)).toThrow();
        });
    });
    // =========================================================================
    // verifyRefreshToken
    // =========================================================================
    describe('verifyRefreshToken', () => {
        it('should verify a valid refresh token', () => {
            const token = generateRefreshToken('user-refresh');
            const result = verifyRefreshToken(token);
            expect(result.userId).toBe('user-refresh');
        });
        it('should reject an access token (wrong secret)', () => {
            const accessToken = generateToken(makePayload());
            expect(() => verifyRefreshToken(accessToken)).toThrow();
        });
        it('should reject expired refresh token', () => {
            const expired = jwt.sign({ userId: 'u-exp', type: 'refresh' }, TEST_REFRESH_SECRET, {
                expiresIn: '-1s',
                issuer: 'heuresys-platform',
            });
            expect(() => verifyRefreshToken(expired)).toThrow();
        });
        it('should reject token with wrong issuer', () => {
            const wrongIssuer = jwt.sign({ userId: 'u-iss', type: 'refresh' }, TEST_REFRESH_SECRET, {
                expiresIn: '7d',
                issuer: 'other-platform',
            });
            expect(() => verifyRefreshToken(wrongIssuer)).toThrow();
        });
    });
    // =========================================================================
    // authMiddleware
    // =========================================================================
    describe('authMiddleware', () => {
        it('should call next() with no arguments on valid Bearer token', async () => {
            const token = generateToken(makePayload({ userId: 'u-mid' }));
            mockReq.headers = { authorization: `Bearer ${token}` };
            await authMiddleware(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(mockNext.mock.calls[0]?.[0]).toBeUndefined();
        });
        it('should attach user payload to req.user', async () => {
            const token = generateToken(makePayload({ userId: 'u-attach', username: 'attached' }));
            mockReq.headers = { authorization: `Bearer ${token}` };
            await authMiddleware(mockReq, mockRes, mockNext);
            const user = mockReq.user;
            expect(user).toBeDefined();
            expect(user['userId']).toBe('u-attach');
            expect(user['username']).toBe('attached');
        });
        it('should reject request with no Authorization header (401)', async () => {
            mockReq.headers = {};
            await authMiddleware(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(1);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(401);
            expect(err?.message).toBe('No token provided');
        });
        it('should reject request with non-Bearer authorization scheme', async () => {
            mockReq.headers = { authorization: 'Basic dXNlcjpwYXNz' };
            await authMiddleware(mockReq, mockRes, mockNext);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(401);
        });
        it('should reject request with malformed Bearer header (no space)', async () => {
            mockReq.headers = { authorization: 'Bearertoken123' };
            await authMiddleware(mockReq, mockRes, mockNext);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(401);
        });
        it('should reject expired token (401)', async () => {
            const expired = jwt.sign({ userId: 'u-exp', username: 'exp', role: 'EMPLOYEE', permissions: [] }, TEST_JWT_SECRET, { expiresIn: '-1s', issuer: 'heuresys-platform' });
            mockReq.headers = { authorization: `Bearer ${expired}` };
            await authMiddleware(mockReq, mockRes, mockNext);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(401);
        });
        it('should reject blacklisted token (401)', async () => {
            mockIsTokenBlacklisted.mockResolvedValue(true);
            const token = generateToken(makePayload());
            mockReq.headers = { authorization: `Bearer ${token}` };
            await authMiddleware(mockReq, mockRes, mockNext);
            expect(mockIsTokenBlacklisted).toHaveBeenCalled();
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(401);
            expect(err?.message).toBe('Token has been revoked');
        });
        it('should allow non-blacklisted token', async () => {
            mockIsTokenBlacklisted.mockResolvedValue(false);
            const token = generateToken(makePayload());
            mockReq.headers = { authorization: `Bearer ${token}` };
            await authMiddleware(mockReq, mockRes, mockNext);
            expect(mockIsTokenBlacklisted).toHaveBeenCalled();
            expect(mockNext.mock.calls[0]?.[0]).toBeUndefined();
        });
    });
    // =========================================================================
    // optionalAuthMiddleware
    // =========================================================================
    describe('optionalAuthMiddleware', () => {
        it('should call next() without error when no token is present', async () => {
            mockReq.headers = {};
            await optionalAuthMiddleware(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
            expect(mockReq.user).toBeUndefined();
        });
        it('should attach user when valid token is present', async () => {
            const token = generateToken(makePayload({ userId: 'u-opt' }));
            mockReq.headers = { authorization: `Bearer ${token}` };
            await optionalAuthMiddleware(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
            const user = mockReq.user;
            expect(user['userId']).toBe('u-opt');
        });
        it('should call next() without error when token is invalid (silent fail)', async () => {
            mockReq.headers = { authorization: 'Bearer invalid-garbage-token' };
            await optionalAuthMiddleware(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
            expect(mockReq.user).toBeUndefined();
        });
    });
    // =========================================================================
    // requireRole - comprehensive RBAC testing
    // =========================================================================
    describe('requireRole', () => {
        function authReq(role) {
            return {
                user: { userId: 'u1', username: 'test', role, permissions: [] },
            };
        }
        it('should allow SUPERUSER for any role requirement (god-role, migration 109)', async () => {
            const mw = requireRole('EMPLOYEE');
            await mw(authReq('SUPERUSER'), mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
        });
        it('should allow SYSADMIN for any role requirement (per-tenant admin)', async () => {
            const mw = requireRole('EMPLOYEE');
            await mw(authReq('SYSADMIN'), mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
        });
        it('should allow TENANT_ADMIN when TENANT_ADMIN is required', async () => {
            const mw = requireRole('TENANT_ADMIN');
            await mw(authReq('TENANT_ADMIN'), mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
        });
        it('should allow IT_ADMIN when DEPT_HEAD is required (higher privilege)', async () => {
            const mw = requireRole('DEPT_HEAD');
            await mw(authReq('IT_ADMIN'), mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
        });
        it('should allow HR_DIRECTOR when HR_MANAGER is required (higher privilege)', async () => {
            const mw = requireRole('HR_MANAGER');
            await mw(authReq('HR_DIRECTOR'), mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
        });
        it('should allow HR_MANAGER for HR_MANAGER requirement (exact match)', async () => {
            const mw = requireRole('HR_MANAGER');
            await mw(authReq('HR_MANAGER'), mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
        });
        it('should allow DEPT_HEAD for DEPT_HEAD requirement (exact match)', async () => {
            const mw = requireRole('DEPT_HEAD');
            await mw(authReq('DEPT_HEAD'), mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
        });
        it('should allow LINE_MANAGER for LINE_MANAGER requirement (exact match)', async () => {
            const mw = requireRole('LINE_MANAGER');
            await mw(authReq('LINE_MANAGER'), mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
        });
        it('should allow EMPLOYEE for EMPLOYEE requirement (exact match)', async () => {
            const mw = requireRole('EMPLOYEE');
            await mw(authReq('EMPLOYEE'), mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
        });
        it('should deny EMPLOYEE when TENANT_ADMIN is required (403)', async () => {
            const mw = requireRole('TENANT_ADMIN');
            await mw(authReq('EMPLOYEE'), mockRes, mockNext);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(403);
        });
        it('should deny LINE_MANAGER when HR_DIRECTOR is required (403)', async () => {
            const mw = requireRole('HR_DIRECTOR');
            await mw(authReq('LINE_MANAGER'), mockRes, mockNext);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(403);
        });
        it('should deny DEPT_HEAD when IT_ADMIN is required (403)', async () => {
            const mw = requireRole('IT_ADMIN');
            await mw(authReq('DEPT_HEAD'), mockRes, mockNext);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(403);
        });
        it('should return 401 when no user is attached to request', async () => {
            const mw = requireRole('EMPLOYEE');
            await mw({}, mockRes, mockNext);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(401);
        });
        it('should accept multiple allowed roles (OR logic)', async () => {
            const mw = requireRole('HR_MANAGER', 'DEPT_HEAD');
            await mw(authReq('HR_MANAGER'), mockRes, mockNext);
            expect(mockNext.mock.calls[0]?.[0]).toBeUndefined();
        });
        // Legacy role mappings
        it('should treat legacy ADMIN as TENANT_ADMIN (level 1)', async () => {
            const mw = requireRole('TENANT_ADMIN');
            await mw(authReq('ADMIN'), mockRes, mockNext);
            expect(mockNext.mock.calls[0]?.[0]).toBeUndefined();
        });
        it('should treat legacy HR as HR_MANAGER (level 4)', async () => {
            const mw = requireRole('HR_MANAGER');
            await mw(authReq('HR'), mockRes, mockNext);
            expect(mockNext.mock.calls[0]?.[0]).toBeUndefined();
        });
        it('should treat legacy USER as EMPLOYEE (level 7)', async () => {
            const mw = requireRole('EMPLOYEE');
            await mw(authReq('USER'), mockRes, mockNext);
            expect(mockNext.mock.calls[0]?.[0]).toBeUndefined();
        });
        it('should treat legacy DEMO as EMPLOYEE (level 7)', async () => {
            const mw = requireRole('EMPLOYEE');
            await mw(authReq('DEMO'), mockRes, mockNext);
            expect(mockNext.mock.calls[0]?.[0]).toBeUndefined();
        });
    });
    // =========================================================================
    // requirePermission (any-of logic)
    // =========================================================================
    describe('requirePermission', () => {
        it('should allow SUPERUSER regardless of permissions (god-role, migration 109)', () => {
            const mw = requirePermission('SUPER_SPECIAL_PERM');
            const req = {
                user: {
                    userId: 'u1',
                    username: 'sys',
                    role: 'SUPERUSER',
                    permissions: [],
                },
            };
            mw(req, mockRes, mockNext);
            expect(mockNext.mock.calls[0]?.[0]).toBeUndefined();
        });
        it('should NOT bypass permission check for SYSADMIN (only SUPERUSER bypasses)', () => {
            const mw = requirePermission('SUPER_SPECIAL_PERM');
            const req = {
                user: {
                    userId: 'u1',
                    username: 'admin',
                    role: 'SYSADMIN',
                    permissions: [],
                },
            };
            mw(req, mockRes, mockNext);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(403);
        });
        it('should allow user with at least one matching permission', () => {
            const mw = requirePermission('PERM_A', 'PERM_B');
            const req = {
                user: {
                    userId: 'u1',
                    username: 'hr',
                    role: 'HR_MANAGER',
                    permissions: ['PERM_B'],
                },
            };
            mw(req, mockRes, mockNext);
            expect(mockNext.mock.calls[0]?.[0]).toBeUndefined();
        });
        it('should deny user with no matching permissions (403)', () => {
            const mw = requirePermission('ADMIN_ONLY');
            const req = {
                user: {
                    userId: 'u1',
                    username: 'emp',
                    role: 'EMPLOYEE',
                    permissions: ['VIEW_SELF'],
                },
            };
            mw(req, mockRes, mockNext);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(403);
        });
        it('should deny user with empty permissions array (403)', () => {
            const mw = requirePermission('ANY_PERM');
            const req = {
                user: {
                    userId: 'u1',
                    username: 'emp',
                    role: 'EMPLOYEE',
                    permissions: [],
                },
            };
            mw(req, mockRes, mockNext);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(403);
        });
        it('should return 401 when no user is on the request', () => {
            const mw = requirePermission('ANY');
            mw({}, mockRes, mockNext);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(401);
        });
    });
    // =========================================================================
    // requireAllPermissions (all-of logic)
    // =========================================================================
    describe('requireAllPermissions', () => {
        it('should allow user with ALL required permissions', () => {
            const mw = requireAllPermissions('VIEW_USERS', 'EDIT_USERS');
            const req = {
                user: {
                    userId: 'u1',
                    username: 'hr',
                    role: 'HR_MANAGER',
                    permissions: ['VIEW_USERS', 'EDIT_USERS', 'OTHER'],
                },
            };
            mw(req, mockRes, mockNext);
            expect(mockNext.mock.calls[0]?.[0]).toBeUndefined();
        });
        it('should deny user missing ANY required permission (403)', () => {
            const mw = requireAllPermissions('VIEW_USERS', 'EDIT_USERS', 'DELETE_USERS');
            const req = {
                user: {
                    userId: 'u1',
                    username: 'viewer',
                    role: 'EMPLOYEE',
                    permissions: ['VIEW_USERS', 'EDIT_USERS'],
                },
            };
            mw(req, mockRes, mockNext);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(403);
        });
        it('should allow SUPERUSER without checking permissions (god-role, migration 109)', () => {
            const mw = requireAllPermissions('P1', 'P2', 'P3');
            const req = {
                user: {
                    userId: 'u1',
                    username: 'sys',
                    role: 'SUPERUSER',
                    permissions: [],
                },
            };
            mw(req, mockRes, mockNext);
            expect(mockNext.mock.calls[0]?.[0]).toBeUndefined();
        });
        it('should NOT bypass permission check for SYSADMIN (only SUPERUSER bypasses)', () => {
            const mw = requireAllPermissions('P1', 'P2', 'P3');
            const req = {
                user: {
                    userId: 'u1',
                    username: 'admin',
                    role: 'SYSADMIN',
                    permissions: [],
                },
            };
            mw(req, mockRes, mockNext);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(403);
        });
        it('should return 401 when no user is on the request', () => {
            const mw = requireAllPermissions('P1');
            mw({}, mockRes, mockNext);
            const err = mockNext.mock.calls[0]?.[0];
            expect(err?.httpStatus).toBe(401);
        });
    });
    // =========================================================================
    // getUserOrThrow
    // =========================================================================
    describe('getUserOrThrow', () => {
        it('should return user when present on request', () => {
            const user = {
                userId: 'u1',
                username: 'test',
                role: 'EMPLOYEE',
                permissions: [],
            };
            const req = { user };
            const result = getUserOrThrow(req);
            expect(result).toEqual(user);
        });
        it('should throw with message containing "Authentication required" when no user', () => {
            expect(() => getUserOrThrow({})).toThrow();
            try {
                getUserOrThrow({});
            }
            catch (e) {
                const err = e;
                expect(err.message).toContain('Authentication required');
            }
        });
    });
    // =========================================================================
    // ROLES hierarchy
    // =========================================================================
    describe('ROLES hierarchy', () => {
        it('should define all primary roles with correct numeric levels (migration 109)', () => {
            // SUPERUSER is the platform god-role (added in migration 109)
            expect(ROLES.SUPERUSER).toBe(-1);
            expect(ROLES.SYSADMIN).toBe(0);
            expect(ROLES.IT_ADMIN).toBe(1);
            expect(ROLES.HR_DIRECTOR).toBe(2);
            expect(ROLES.HR_MANAGER).toBe(3);
            expect(ROLES.DEPT_HEAD).toBe(4);
            expect(ROLES.LINE_MANAGER).toBe(5);
            expect(ROLES.EMPLOYEE).toBe(6);
        });
        it('should map legacy aliases correctly', () => {
            expect(ROLES.ADMIN).toBe(ROLES.SYSADMIN); // ADMIN → SYSADMIN
            expect(ROLES.TENANT_ADMIN).toBe(ROLES.SYSADMIN); // TENANT_ADMIN → SYSADMIN
            expect(ROLES.HR).toBe(ROLES.HR_MANAGER);
            expect(ROLES.DEMO).toBe(ROLES.EMPLOYEE);
            expect(ROLES.USER).toBe(ROLES.EMPLOYEE);
        });
        it('should have SUPERUSER as highest privilege (lowest number)', () => {
            const allPrimary = [
                ROLES.SUPERUSER,
                ROLES.SYSADMIN,
                ROLES.IT_ADMIN,
                ROLES.HR_DIRECTOR,
                ROLES.HR_MANAGER,
                ROLES.DEPT_HEAD,
                ROLES.LINE_MANAGER,
                ROLES.EMPLOYEE,
            ];
            const minVal = Math.min(...allPrimary);
            expect(minVal).toBe(ROLES.SUPERUSER);
        });
        it('should have EMPLOYEE as lowest privilege (highest number)', () => {
            const allPrimary = [
                ROLES.SUPERUSER,
                ROLES.SYSADMIN,
                ROLES.IT_ADMIN,
                ROLES.HR_DIRECTOR,
                ROLES.HR_MANAGER,
                ROLES.DEPT_HEAD,
                ROLES.LINE_MANAGER,
                ROLES.EMPLOYEE,
            ];
            const maxVal = Math.max(...allPrimary);
            expect(maxVal).toBe(ROLES.EMPLOYEE);
        });
        it('should maintain strict ordering across the full hierarchy', () => {
            expect(ROLES.SUPERUSER).toBeLessThan(ROLES.SYSADMIN);
            expect(ROLES.SYSADMIN).toBeLessThan(ROLES.IT_ADMIN);
            expect(ROLES.IT_ADMIN).toBeLessThan(ROLES.HR_DIRECTOR);
            expect(ROLES.HR_DIRECTOR).toBeLessThan(ROLES.HR_MANAGER);
            expect(ROLES.HR_MANAGER).toBeLessThan(ROLES.DEPT_HEAD);
            expect(ROLES.DEPT_HEAD).toBeLessThan(ROLES.LINE_MANAGER);
            expect(ROLES.LINE_MANAGER).toBeLessThan(ROLES.EMPLOYEE);
        });
    });
});
//# sourceMappingURL=auth.test.js.map