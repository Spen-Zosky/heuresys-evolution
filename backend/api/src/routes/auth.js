/**
 * Authentication Routes
 * Login, logout, token refresh, password management, and account lockout
 * NOTE: Database users table columns:
 *   id, username, password_hash, role, permissions, is_active,
 *   last_login, created_at, updated_at, employee_id
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// ADMIN-POOL: Pre-auth endpoints (login, refresh, verify) MUST use pool because they
// run BEFORE authentication — no tenant context or dbClient is available.
// Post-auth endpoints (me, change-password, logout, unlock-account) use dbClient
// for RLS-enforced queries where tenant context is established.
import { pool } from '../config/database.js';
import { config } from '../config/index.js';
import { generateToken, generateRefreshToken, verifyToken, verifyRefreshToken, authMiddleware, setAuthCookies, clearAuthCookies, REFRESH_TOKEN_COOKIE, } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validatePassword } from '../utils/password-policy.js';
import { blacklistToken } from '../config/redis.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, refreshTokenSchema, changePasswordSchema } from '../schemas/auth.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { logger } from '../config/logger.js';
const router = Router();
// ---------------------------------------------------------------------------
// Account Lockout Helpers
// ---------------------------------------------------------------------------
/**
 * Progressive lockout durations in seconds, indexed by attempt number (1-based).
 * Attempts 1-4: no lockout. Attempt 5: 60s, 6: 300s, 7: 900s, 8: 3600s, 9+: 86400s.
 */
const LOCKOUT_DURATIONS = [0, 0, 0, 0, 0, 60, 300, 900, 3600, 86400];
/**
 * Get lockout duration in seconds for a given attempt count.
 */
function getLockoutDuration(attemptCount) {
    if (attemptCount < LOCKOUT_DURATIONS.length) {
        return LOCKOUT_DURATIONS[attemptCount] ?? 0;
    }
    return LOCKOUT_DURATIONS[LOCKOUT_DURATIONS.length - 1] ?? 86400;
}
/**
 * Check if the account is currently locked. Returns the number of seconds
 * remaining if locked, or 0 if not locked.
 * pool: pre-auth helper — called from login before authentication/tenant context
 */
async function checkAccountLock(username) {
    const result = await pool.query('SELECT attempt_count, locked_until FROM login_attempts WHERE username = $1', [username]);
    if (result.rows.length === 0) {
        return { locked: false, retryAfter: 0 };
    }
    const row = result.rows[0];
    if (row.locked_until) {
        const lockedUntil = new Date(row.locked_until);
        const now = new Date();
        const remainingMs = lockedUntil.getTime() - now.getTime();
        if (remainingMs > 0) {
            return { locked: true, retryAfter: Math.ceil(remainingMs / 1000) };
        }
    }
    return { locked: false, retryAfter: 0 };
}
/**
 * Record a failed login attempt and apply progressive lockout if threshold reached.
 * pool: pre-auth helper — called from login before authentication/tenant context
 */
async function recordFailedAttempt(username) {
    const result = await pool.query(`INSERT INTO login_attempts (username, attempt_count, last_failed_at, updated_at)
     VALUES ($1, 1, NOW(), NOW())
     ON CONFLICT (username)
     DO UPDATE SET
       attempt_count = login_attempts.attempt_count + 1,
       last_failed_at = NOW(),
       updated_at = NOW()
     RETURNING attempt_count`, [username]);
    const attemptCount = result.rows[0].attempt_count;
    const lockoutSeconds = getLockoutDuration(attemptCount);
    if (lockoutSeconds > 0) {
        await pool.query(`UPDATE login_attempts
       SET locked_until = NOW() + INTERVAL '1 second' * $1, updated_at = NOW()
       WHERE username = $2`, [lockoutSeconds, username]);
    }
}
/**
 * Reset login attempts after a successful login.
 * pool: pre-auth helper — called from login before tenant context is established
 */
async function resetLoginAttempts(username) {
    await pool.query(`UPDATE login_attempts
     SET attempt_count = 0, locked_until = NULL, updated_at = NOW()
     WHERE username = $1`, [username]);
}
// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
/**
 * POST /api/v1/auth/login
 * Authenticate user and return tokens
 * pool: pre-auth endpoint — runs before authentication, no tenant context available
 */
router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    // Check if account is locked before attempting authentication
    const lockStatus = await checkAccountLock(username);
    if (lockStatus.locked) {
        res.status(429).json({
            success: false,
            error: 'Account is temporarily locked due to too many failed login attempts',
            code: 'ACCOUNT_LOCKED',
            retryAfter: lockStatus.retryAfter,
        });
        return;
    }
    // Find user by username
    const userResult = await pool.query(`SELECT u.id, u.username, u.password_hash, u.role, u.permissions,
              u.is_active, u.employee_id, u.totp_enabled,
              e.tenant_id, e.first_name, e.last_name, e.email,
              e.job_title, COALESCE(ou.name, e.department) AS department,
              t.code AS tenant_code, t.name AS tenant_name
       FROM users u
       LEFT JOIN employees e ON u.employee_id = e.id
       LEFT JOIN tenants t ON e.tenant_id = t.id
       LEFT JOIN org_units ou ON ou.code = e.department AND ou.tenant_id = e.tenant_id
       WHERE u.username = $1`, [username]);
    if (userResult.rows.length === 0) {
        // Record failed attempt even for non-existent users to prevent username enumeration
        await recordFailedAttempt(username);
        throw Errors.unauthorized('Invalid credentials');
    }
    const user = userResult.rows[0];
    // Check if user is active
    if (!user.is_active) {
        throw Errors.unauthorized('Account is disabled');
    }
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
        // Record failed attempt and apply progressive lockout
        await recordFailedAttempt(username);
        throw Errors.unauthorized('Invalid credentials');
    }
    // Successful login: reset failure counter
    await resetLoginAttempts(username);
    // 2FA check: if TOTP is enabled, return temporary token instead of full tokens
    if (user.totp_enabled) {
        const tempToken = jwt.sign({ userId: user.id, requires_2fa: true }, config.jwt.secret, {
            expiresIn: '5m',
        });
        res.json({
            success: true,
            data: {
                requires2FA: true,
                tempToken,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                },
            },
        });
        return;
    }
    // Generate tokens
    const accessToken = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions || [],
        employeeId: user.employee_id,
        tenantId: user.tenant_id,
    });
    const refreshToken = generateRefreshToken(user.id);
    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    // Set httpOnly cookies (dual-mode: cookies + JSON body)
    setAuthCookies(res, accessToken, refreshToken);
    res.json({
        success: true,
        data: {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: user.permissions,
                employeeId: user.employee_id,
                tenantId: user.tenant_id,
                tenant_code: user.tenant_code,
                tenant_name: user.tenant_name,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                jobTitle: user.job_title,
                department: user.department,
            },
        },
    });
}));
/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 * pool: pre-auth endpoint — runs with refresh token only, no tenant context available
 */
router.post('/refresh', validate(refreshTokenSchema), asyncHandler(async (req, res) => {
    // Read refresh token from body or httpOnly cookie (dual-mode)
    const refreshToken = req.body.refreshToken || req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
        throw Errors.unauthorized('Refresh token is required');
    }
    // Verify refresh token using the dedicated refresh secret
    let payload;
    try {
        payload = verifyRefreshToken(refreshToken);
    }
    catch (_error) {
        throw Errors.unauthorized('Invalid refresh token');
    }
    // Check if it's actually a refresh token
    if (payload.type !== 'refresh') {
        throw Errors.unauthorized('Invalid token type');
    }
    // Fetch user data for new token
    const userResult = await pool.query(`SELECT u.id, u.username, u.role, u.permissions,
              u.is_active, u.employee_id, e.tenant_id
       FROM users u
       LEFT JOIN employees e ON u.employee_id = e.id
       WHERE u.id = $1`, [payload.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
        throw Errors.unauthorized('User not found or disabled');
    }
    const user = userResult.rows[0];
    // Blacklist the old refresh token to prevent reuse
    if (payload.jti && payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        const remainingTTL = payload.exp - now;
        if (remainingTTL > 0) {
            await blacklistToken(payload.jti, remainingTTL);
        }
    }
    // Generate new access token
    const accessToken = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions || [],
        employeeId: user.employee_id,
        tenantId: user.tenant_id,
    });
    // Generate new refresh token to replace the blacklisted one
    const newRefreshToken = generateRefreshToken(user.id);
    // Set httpOnly cookies (dual-mode)
    setAuthCookies(res, accessToken, newRefreshToken);
    res.json({
        success: true,
        data: { accessToken, refreshToken: newRefreshToken },
    });
}));
/**
 * POST /api/v1/auth/logout
 * Logout and blacklist the current access token.
 * Requires a valid Bearer token in the Authorization header.
 */
router.post('/logout', authMiddleware, asyncHandler(async (req, res) => {
    const authReq = req;
    const { jti, exp } = authReq.user;
    if (jti && exp) {
        const now = Math.floor(Date.now() / 1000);
        const remainingTTL = exp - now;
        if (remainingTTL > 0) {
            const blacklisted = await blacklistToken(jti, remainingTTL);
            if (!blacklisted) {
                logger.warn(`[Auth] Failed to blacklist token on logout (Redis unavailable) - jti: ${jti}`);
            }
        }
    }
    // Also blacklist the refresh token if provided in the request body
    const { refreshToken } = req.body;
    if (refreshToken) {
        try {
            // Decode without full verification to extract jti and exp
            // (the refresh token might belong to a different signing context)
            const refreshPayload = jwt.decode(refreshToken);
            if (refreshPayload?.jti && refreshPayload?.exp) {
                const now = Math.floor(Date.now() / 1000);
                const refreshTTL = refreshPayload.exp - now;
                if (refreshTTL > 0) {
                    await blacklistToken(refreshPayload.jti, refreshTTL);
                }
            }
        }
        catch (_err) {
            logger.warn({ err: _err }, 'Silent catch in routes.auth');
        }
    }
    // Clear httpOnly cookies
    clearAuthCookies(res);
    res.json({
        success: true,
        message: 'Logged out successfully',
    });
}));
/**
 * GET /api/v1/auth/me
 * Get current user information
 */
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
    const authReq = req;
    // pool: /me must work for ALL users including TENANT_OWNER (no tenant context).
    // The auth routes are mounted without tenantContextMiddleware, so req.dbClient
    // is not available here. Using pool is correct and consistent.
    const userResult = await pool.query(`SELECT u.id, u.username, u.role, u.permissions,
              u.is_active, u.last_login, u.employee_id,
              e.tenant_id, e.first_name, e.last_name, e.email,
              e.job_title, COALESCE(ou.name, e.department) AS department,
              t.code AS tenant_code, t.name AS tenant_name
       FROM users u
       LEFT JOIN employees e ON u.employee_id = e.id
       LEFT JOIN tenants t ON e.tenant_id = t.id
       LEFT JOIN org_units ou ON ou.code = e.department AND ou.tenant_id = e.tenant_id
       WHERE u.id = $1`, [authReq.user.userId]);
    if (userResult.rows.length === 0) {
        throw Errors.notFound('User');
    }
    const user = userResult.rows[0];
    res.json({
        success: true,
        data: {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions,
            isActive: user.is_active,
            lastLogin: user.last_login,
            employeeId: user.employee_id,
            tenantId: user.tenant_id,
            tenant_code: user.tenant_code,
            tenant_name: user.tenant_name,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            jobTitle: user.job_title,
            department: user.department,
        },
    });
}));
/**
 * POST /api/v1/auth/change-password
 * Change user's own password
 */
router.post('/change-password', authMiddleware, validate(changePasswordSchema), asyncHandler(async (req, res) => {
    const authReq = req;
    const { currentPassword, newPassword } = req.body;
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
        throw Errors.badRequest('Password does not meet policy requirements', {
            validationErrors: validation.errors,
        });
    }
    // pool: auth routes are mounted without tenantContextMiddleware
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [
        authReq.user.userId,
    ]);
    if (userResult.rows.length === 0) {
        throw Errors.notFound('User');
    }
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0]?.password_hash);
    if (!isValidPassword) {
        throw Errors.unauthorized('Current password is incorrect');
    }
    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    // Update password
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
        newPasswordHash,
        authReq.user.userId,
    ]);
    res.json({
        success: true,
        message: 'Password changed successfully',
    });
}));
/**
 * POST /api/v1/auth/verify
 * Verify if a token is valid
 */
router.post('/verify', (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            res.status(400).json({
                success: false,
                error: 'Token is required',
            });
            return;
        }
        const payload = verifyToken(token);
        res.json({
            success: true,
            data: {
                valid: true,
                userId: payload.userId,
                username: payload.username,
                role: payload.role,
                expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
            },
        });
    }
    catch (_error) {
        res.json({
            success: true,
            data: { valid: false },
        });
    }
});
/**
 * POST /api/v1/auth/unlock-account
 * Unlock a locked account (TENANT_OWNER only)
 * Resets the attempt_count and clears locked_until for the specified username.
 */
router.post('/unlock-account', authMiddleware, requirePermission('SECURITY', 'CREATE'), asyncHandler(async (req, res) => {
    const { username } = req.body;
    if (!username) {
        throw Errors.badRequest('Username is required');
    }
    // pool: auth routes are mounted without tenantContextMiddleware
    const result = await pool.query(`UPDATE login_attempts
       SET attempt_count = 0, locked_until = NULL, updated_at = NOW()
       WHERE username = $1
       RETURNING username`, [username]);
    if (result.rows.length === 0) {
        res.json({
            success: true,
            message: `No lockout record found for user '${username}'. Account is not locked.`,
        });
        return;
    }
    res.json({
        success: true,
        message: `Account '${result.rows[0].username}' has been unlocked successfully`,
    });
}));
export default router;
//# sourceMappingURL=auth.js.map