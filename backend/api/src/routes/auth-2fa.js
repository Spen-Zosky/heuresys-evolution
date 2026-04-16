/**
 * 2FA TOTP Routes
 * Setup, verification, and management of two-factor authentication
 */
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { NobleCryptoPlugin, ScureBase32Plugin, generateSecret, generateURI, verify as otplibVerify, } from 'otplib';
import QRCode from 'qrcode';
import { pool } from '../config/database.js';
import { config } from '../config/index.js';
import { authMiddleware, generateToken, generateRefreshToken, setAuthCookies, } from '../middleware/auth.js';
import { asyncHandler } from '../errors/middleware.js';
import { validate } from '../middleware/validate.js';
import { Errors } from '../errors/factory.js';
const VerifySetupSchema = z.object({
    code: z.string().min(1),
});
const DisableSchema = z.object({
    password: z.string().min(1),
});
const VerifySchema = z.object({
    code: z.string().min(1),
    tempToken: z.string().min(1),
});
const router = Router();
const TOTP_ISSUER = 'Heuresys Platform';
const MAX_TOTP_ATTEMPTS = 5;
const LOCKOUT_DURATION_MIN = 10;
// Shared plugins for otplib
const otplibPlugins = {
    crypto: new NobleCryptoPlugin(),
    base32: new ScureBase32Plugin(),
};
// TOTP class imported but instance created on-demand if needed
// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function generateRecoveryCodes() {
    const codes = [];
    for (let i = 0; i < 8; i++) {
        const bytes = crypto.randomBytes(5);
        const raw = bytes.toString('hex').toUpperCase().slice(0, 10);
        codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    }
    return codes;
}
async function hashRecoveryCodes(codes) {
    return Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
}
function isLockedOut(user) {
    if (user.totp_lockout_until) {
        const lockoutEnd = new Date(user.totp_lockout_until);
        if (lockoutEnd > new Date())
            return true;
    }
    return false;
}
async function verifyTotpCode(token, secret) {
    const result = await otplibVerify({ token, secret, ...otplibPlugins });
    return result.valid;
}
// ══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES (require full JWT)
// ══════════════════════════════════════════════════════════════════════════════
/**
 * POST /api/v1/auth/2fa/setup
 * Generate TOTP secret + QR code. Does NOT activate 2FA yet.
 */
router.post('/setup', authMiddleware, asyncHandler(async (req, res) => {
    const authReq = req;
    const userId = authReq.user.userId;
    const userResult = await pool.query('SELECT totp_enabled FROM users WHERE id = $1', [userId]);
    if (userResult.rows[0]?.totp_enabled) {
        throw Errors.badRequest('2FA is already enabled. Disable it first to reconfigure.');
    }
    const secret = generateSecret();
    await pool.query('UPDATE users SET totp_secret = $1, totp_enabled = false WHERE id = $2', [
        secret,
        userId,
    ]);
    const otpauth = generateURI({
        issuer: TOTP_ISSUER,
        label: `${TOTP_ISSUER}:${authReq.user.username}`,
        secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);
    res.json({
        success: true,
        data: {
            secret,
            qrCode: qrCodeDataUrl,
            otpauthUrl: otpauth,
        },
    });
}));
/**
 * POST /api/v1/auth/2fa/verify-setup
 * Confirm 2FA setup by verifying a TOTP code. Returns 8 recovery codes.
 */
router.post('/verify-setup', authMiddleware, validate(VerifySetupSchema), asyncHandler(async (req, res) => {
    const authReq = req;
    const userId = authReq.user.userId;
    const { code } = req.body;
    const userResult = await pool.query('SELECT totp_secret, totp_enabled FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    if (!user?.totp_secret) {
        throw Errors.badRequest('No 2FA setup in progress. Call /2fa/setup first.');
    }
    if (user.totp_enabled) {
        throw Errors.badRequest('2FA is already enabled.');
    }
    const isValid = await verifyTotpCode(code, user.totp_secret);
    if (!isValid) {
        throw Errors.badRequest('Invalid TOTP code. Check your authenticator app and try again.');
    }
    const recoveryCodes = generateRecoveryCodes();
    const hashedCodes = await hashRecoveryCodes(recoveryCodes);
    await pool.query(`UPDATE users
       SET totp_enabled = true,
           totp_recovery_codes = $1,
           totp_failed_attempts = 0,
           totp_lockout_until = NULL
       WHERE id = $2`, [hashedCodes, userId]);
    res.json({
        success: true,
        data: {
            recoveryCodes,
            message: 'Save these recovery codes now. They will not be shown again.',
        },
    });
}));
/**
 * POST /api/v1/auth/2fa/disable
 * Disable 2FA. Requires current password.
 */
router.post('/disable', authMiddleware, validate(DisableSchema), asyncHandler(async (req, res) => {
    const authReq = req;
    const userId = authReq.user.userId;
    const { password } = req.body;
    const userResult = await pool.query('SELECT password_hash, totp_enabled FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    if (!user)
        throw Errors.notFound('User not found');
    if (!user.totp_enabled) {
        throw Errors.badRequest('2FA is not currently enabled');
    }
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
        throw Errors.unauthorized('Invalid password');
    }
    await pool.query(`UPDATE users
       SET totp_enabled = false,
           totp_secret = NULL,
           totp_recovery_codes = NULL,
           totp_failed_attempts = 0,
           totp_lockout_until = NULL
       WHERE id = $1`, [userId]);
    res.json({
        success: true,
        message: '2FA has been disabled successfully',
    });
}));
// ══════════════════════════════════════════════════════════════════════════════
// PRE-AUTH ROUTE: 2FA verification during login
// ══════════════════════════════════════════════════════════════════════════════
/**
 * POST /api/v1/auth/2fa/verify
 * Verify TOTP code during login. Accepts temporary JWT with requires_2fa.
 */
router.post('/verify', validate(VerifySchema), asyncHandler(async (req, res) => {
    const { code, tempToken } = req.body;
    let payload;
    try {
        payload = jwt.verify(tempToken, config.jwt.secret);
    }
    catch {
        throw Errors.unauthorized('Invalid or expired temporary token. Please login again.');
    }
    if (!payload.requires_2fa) {
        throw Errors.badRequest('This token does not require 2FA verification');
    }
    const userResult = await pool.query(`SELECT u.id, u.username, u.role, u.permissions, u.is_active,
              u.employee_id, u.totp_secret, u.totp_enabled,
              u.totp_recovery_codes, u.totp_failed_attempts, u.totp_lockout_until,
              e.tenant_id, t.code AS tenant_code
       FROM users u
       LEFT JOIN employees e ON u.employee_id = e.id
       LEFT JOIN tenants t ON e.tenant_id = t.id
       WHERE u.id = $1`, [payload.userId]);
    const user = userResult.rows[0];
    if (!user || !user.totp_enabled || !user.totp_secret) {
        throw Errors.badRequest('2FA is not configured for this user');
    }
    if (isLockedOut(user)) {
        const lockoutEnd = new Date(user.totp_lockout_until);
        const minutesRemaining = Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000);
        res.status(429).json({
            success: false,
            error: `Account temporarily locked. Try again in ${minutesRemaining} minutes.`,
            code: 'TOTP_LOCKED',
        });
        return;
    }
    const cleanCode = code.replace(/\s/g, '');
    let verified = false;
    // Try TOTP code (6 digits only)
    const digitsOnly = cleanCode.replace(/-/g, '');
    if (/^\d{6}$/.test(digitsOnly)) {
        verified = await verifyTotpCode(digitsOnly, user.totp_secret);
    }
    // Try recovery code (compare with original format including dashes)
    if (!verified && user.totp_recovery_codes?.length > 0) {
        for (let i = 0; i < user.totp_recovery_codes.length; i++) {
            const hashedCode = user.totp_recovery_codes[i];
            if (!hashedCode)
                continue;
            // Try both with and without dashes
            const match = (await bcrypt.compare(cleanCode, hashedCode)) ||
                (await bcrypt.compare(cleanCode.toUpperCase(), hashedCode));
            if (match) {
                verified = true;
                const updatedCodes = [...user.totp_recovery_codes];
                updatedCodes[i] = '';
                await pool.query('UPDATE users SET totp_recovery_codes = $1 WHERE id = $2', [
                    updatedCodes,
                    user.id,
                ]);
                break;
            }
        }
    }
    if (!verified) {
        const attempts = (user.totp_failed_attempts || 0) + 1;
        if (attempts >= MAX_TOTP_ATTEMPTS) {
            const lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MIN * 60 * 1000);
            await pool.query('UPDATE users SET totp_failed_attempts = $1, totp_lockout_until = $2 WHERE id = $3', [attempts, lockoutUntil, user.id]);
            res.status(429).json({
                success: false,
                error: `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MIN} minutes.`,
                code: 'TOTP_LOCKED',
            });
            return;
        }
        await pool.query('UPDATE users SET totp_failed_attempts = $1 WHERE id = $2', [
            attempts,
            user.id,
        ]);
        throw Errors.unauthorized(`Invalid code. ${MAX_TOTP_ATTEMPTS - attempts} attempts remaining.`);
    }
    // Success
    await pool.query('UPDATE users SET totp_failed_attempts = 0, totp_lockout_until = NULL, last_login = NOW() WHERE id = $1', [user.id]);
    const accessToken = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions || [],
        employeeId: user.employee_id,
        tenantId: user.tenant_id,
    });
    const refreshToken = generateRefreshToken(user.id);
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
            },
        },
    });
}));
export default router;
//# sourceMappingURL=auth-2fa.js.map