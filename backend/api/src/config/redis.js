/**
 * Redis Client Configuration
 * Provides a singleton Redis client for token blacklisting and caching.
 * Graceful degradation: if Redis is unavailable, operations fail open
 * (log warnings but do not block requests).
 */
import { Redis } from 'ioredis';
import { logger } from './logger.js';
let redis = null;
/**
 * Get or create the singleton Redis client.
 * Uses lazy connection so the server starts even if Redis is down.
 */
export function getRedis() {
    if (!redis) {
        const redisPassword = process.env.REDIS_PASSWORD;
        const options = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => Math.min(times * 200, 5000),
        };
        if (redisPassword) {
            options.password = redisPassword;
        }
        redis = new Redis(options);
        redis.on('error', (err) => {
            logger.error(`[Redis] Connection error: ${String(err.message)}`);
        });
        redis.on('connect', () => {
            logger.info('[Redis] Connected successfully');
        });
        // Initiate the connection (non-blocking due to lazyConnect)
        redis.connect().catch((err) => {
            logger.warn(`[Redis] Initial connection failed (will retry): ${String(err.message)}`);
        });
    }
    return redis;
}
/**
 * Check if the Redis client is connected and ready.
 */
export function isRedisReady() {
    return redis !== null && redis.status === 'ready';
}
/**
 * Add a token JTI to the blacklist with automatic expiration.
 * @param jti - The JWT ID to blacklist
 * @param ttlSeconds - Time-to-live in seconds (should match token remaining life)
 */
export async function blacklistToken(jti, ttlSeconds) {
    const client = getRedis();
    if (!isRedisReady()) {
        // Fail-closed: blacklist is a write operation — callers MUST know it failed
        // so they can take compensating action (e.g. force-expire, alert).
        throw new Error(`[Redis] Not ready - CANNOT blacklist token jti: ${jti}. Redis must be available for token revocation.`);
    }
    // Store with TTL so entries auto-expire when the token would have expired anyway
    await client.set(`blacklist:${jti}`, '1', 'EX', Math.max(ttlSeconds, 1));
    return true;
}
/**
 * Check if a token JTI is blacklisted.
 *
 * @param jti - The JWT ID to check
 * @param failClosed - If true, returns true (blocked) when Redis is unavailable.
 *   Use failClosed=true for sensitive operations (logout, password change, role change)
 *   where allowing a revoked token is worse than a temporary 401.
 *   Default: false (fail-open) for normal request flow.
 */
export async function isTokenBlacklisted(jti, failClosed = false) {
    try {
        const client = getRedis();
        if (!isRedisReady()) {
            if (failClosed) {
                logger.error(`[Redis] Not ready - blacklist check BLOCKED (fail-closed for sensitive op). jti: ${jti}`);
                return true;
            }
            logger.warn('[Redis] Not ready - blacklist check skipped (fail-open). Ensure Redis is running.');
            return false;
        }
        const result = await client.get(`blacklist:${jti}`);
        return result !== null;
    }
    catch (err) {
        logger.error({ err: err }, '[Redis] Failed to check blacklist: %s', err.message);
        if (failClosed) {
            return true; // Block request when Redis is down for sensitive operations
        }
        // Fail-open: if Redis is down, allow the request through.
        // Tokens are short-lived so the risk window is minimal.
        return false;
    }
}
/**
 * Gracefully close the Redis connection (for shutdown hooks).
 */
export async function closeRedis() {
    if (redis) {
        await redis.quit();
        redis = null;
    }
}
//# sourceMappingURL=redis.js.map