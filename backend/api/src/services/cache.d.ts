/**
 * Redis Cache Service
 * Provides TTL-based caching for reference/taxonomy data that changes infrequently.
 */
/** Pre-defined TTL tiers for different data volatility levels */
export declare const CACHE_TTL: {
    /** Static reference data: ESCO taxonomies, NACE codes (1 hour) */
    readonly STATIC: 3600;
    /** Slowly changing data: departments, org-units, locations, cost-centers (15 min) */
    readonly REFERENCE: 900;
    /** Moderate: skills, competency frameworks, review cycles (5 min) */
    readonly MODERATE: 300;
    /** Short-lived: dashboard stats, aggregations (1 min) */
    readonly SHORT: 60;
};
/**
 * Get a cached value, or compute and store it.
 * Falls through to the compute function if Redis is unavailable.
 */
export declare function cached<T>(key: string, compute: () => Promise<T>, ttlSeconds?: number): Promise<T>;
/**
 * Invalidate a specific cache key.
 */
export declare function invalidateCache(key: string): Promise<void>;
/**
 * Invalidate all cache keys matching a pattern (e.g., "skills:*").
 */
export declare function invalidateCachePattern(pattern: string): Promise<void>;
/**
 * Tenant-scoped cache helper.
 * Automatically prefixes keys with the tenant ID to prevent cross-tenant data leakage.
 */
export declare function cachedForTenant<T>(tenantId: string, key: string, compute: () => Promise<T>, ttlSeconds?: number): Promise<T>;
/**
 * Invalidate all cache entries for a specific tenant.
 */
export declare function invalidateTenantCache(tenantId: string): Promise<void>;
/**
 * Get cache statistics (for monitoring/debugging).
 */
export declare function getCacheStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsed: string;
}>;
//# sourceMappingURL=cache.d.ts.map