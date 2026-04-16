/**
 * Redis Cache Service
 * Provides TTL-based caching for reference/taxonomy data that changes infrequently.
 */
import { getRedis, isRedisReady } from '../config/redis.js';
import { logger } from '../config/logger.js';
const DEFAULT_TTL = 300; // 5 minutes
/** Pre-defined TTL tiers for different data volatility levels */
export const CACHE_TTL = {
    /** Static reference data: ESCO taxonomies, NACE codes (1 hour) */
    STATIC: 3600,
    /** Slowly changing data: departments, org-units, locations, cost-centers (15 min) */
    REFERENCE: 900,
    /** Moderate: skills, competency frameworks, review cycles (5 min) */
    MODERATE: 300,
    /** Short-lived: dashboard stats, aggregations (1 min) */
    SHORT: 60,
};
/**
 * Get a cached value, or compute and store it.
 * Falls through to the compute function if Redis is unavailable.
 */
export async function cached(key, compute, ttlSeconds = DEFAULT_TTL) {
    if (!isRedisReady()) {
        return compute();
    }
    try {
        const client = getRedis();
        const raw = await client.get(`cache:${key}`);
        if (raw !== null) {
            return JSON.parse(raw);
        }
    }
    catch (_err) {
        logger.warn({ err: _err }, 'Silent catch in services.cache');
    }
    const result = await compute();
    // Store in background — don't block the response
    try {
        const client = getRedis();
        await client.set(`cache:${key}`, JSON.stringify(result), 'EX', ttlSeconds);
    }
    catch (_err) {
        logger.warn({ err: _err }, 'Silent catch in services.cache');
    }
    return result;
}
/**
 * Invalidate a specific cache key.
 */
export async function invalidateCache(key) {
    if (!isRedisReady())
        return;
    try {
        await getRedis().del(`cache:${key}`);
    }
    catch (_err) {
        logger.warn({ err: _err }, 'Silent catch in services.cache');
    }
}
/**
 * Invalidate all cache keys matching a pattern (e.g., "skills:*").
 */
export async function invalidateCachePattern(pattern) {
    if (!isRedisReady())
        return;
    try {
        const client = getRedis();
        const keys = await client.keys(`cache:${pattern}`);
        if (keys.length > 0) {
            await client.del(...keys);
        }
    }
    catch (_err) {
        logger.warn({ err: _err }, 'Silent catch in services.cache');
    }
}
/**
 * Tenant-scoped cache helper.
 * Automatically prefixes keys with the tenant ID to prevent cross-tenant data leakage.
 */
export async function cachedForTenant(tenantId, key, compute, ttlSeconds = DEFAULT_TTL) {
    return cached(`t:${tenantId}:${key}`, compute, ttlSeconds);
}
/**
 * Invalidate all cache entries for a specific tenant.
 */
export async function invalidateTenantCache(tenantId) {
    return invalidateCachePattern(`t:${tenantId}:*`);
}
/**
 * Get cache statistics (for monitoring/debugging).
 */
export async function getCacheStats() {
    if (!isRedisReady()) {
        return { connected: false, keyCount: 0, memoryUsed: '0' };
    }
    try {
        const client = getRedis();
        const keys = await client.keys('cache:*');
        const info = await client.info('memory');
        const memMatch = info.match(/used_memory_human:(\S+)/);
        return {
            connected: true,
            keyCount: keys.length,
            memoryUsed: memMatch?.[1] ?? 'unknown',
        };
    }
    catch {
        return { connected: false, keyCount: 0, memoryUsed: '0' };
    }
}
//# sourceMappingURL=cache.js.map