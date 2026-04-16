/**
 * Public API Key Authentication Middleware
 * Horizon O2.4 — validates X-API-Key header, sets tenant context + dbClient
 */
import crypto from 'crypto';
import { pool, appPool } from '../config/database.js';
import { logger } from '../config/logger.js';
const CLIENT_RELEASE_TIMEOUT_MS = 30_000;
function hashApiKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}
export async function requirePublicApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        res.status(401).json({ success: false, error: 'Missing X-API-Key header' });
        return;
    }
    const keyHash = hashApiKey(apiKey);
    let row;
    try {
        const result = await pool.query(`SELECT id, tenant_id, is_active, rate_limit_per_hour, expires_at
       FROM api_keys WHERE key_hash = $1`, [keyHash]);
        row = result.rows[0];
    }
    catch (err) {
        logger.error({ err }, '[PublicAPI] Failed to lookup API key');
        res.status(500).json({ success: false, error: 'Internal server error' });
        return;
    }
    if (!row) {
        res.status(401).json({ success: false, error: 'Invalid API key' });
        return;
    }
    if (!row.is_active) {
        res.status(401).json({ success: false, error: 'API key is inactive' });
        return;
    }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
        res.status(401).json({ success: false, error: 'API key has expired' });
        return;
    }
    // Set properties for downstream rate limiter
    req.apiKeyId = row.id;
    req.apiKeyRateLimit = row.rate_limit_per_hour;
    req.tenantId = row.tenant_id;
    // Acquire RLS-scoped client from appPool
    let client;
    try {
        client = await appPool.connect();
        await client.query("SELECT set_config('app.current_tenant_id', $1, false)", [row.tenant_id]);
    }
    catch (err) {
        logger.error({ err }, '[PublicAPI] Failed to acquire tenant client');
        res.status(500).json({ success: false, error: 'Internal server error' });
        return;
    }
    req.dbClient = client;
    // Release client on response finish/close (same pattern as tenantContextMiddleware)
    let released = false;
    const releaseClient = () => {
        if (!released) {
            released = true;
            client.release();
        }
    };
    res.on('finish', releaseClient);
    res.on('close', releaseClient);
    const safetyTimer = setTimeout(() => {
        if (!released) {
            logger.warn('[PublicAPI] Safety timeout — releasing dbClient after 30s');
            releaseClient();
        }
    }, CLIENT_RELEASE_TIMEOUT_MS);
    // Don't block process exit
    safetyTimer.unref();
    // Fire-and-forget: update last_used_at
    pool
        .query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.id])
        .catch((err) => logger.warn({ err }, '[PublicAPI] Failed to update last_used_at'));
    next();
}
//# sourceMappingURL=requirePublicApiKey.js.map