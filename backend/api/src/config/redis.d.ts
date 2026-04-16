/**
 * Redis Client Configuration
 * Provides a singleton Redis client for token blacklisting and caching.
 * Graceful degradation: if Redis is unavailable, operations fail open
 * (log warnings but do not block requests).
 */
import { Redis } from 'ioredis';
/**
 * Get or create the singleton Redis client.
 * Uses lazy connection so the server starts even if Redis is down.
 */
export declare function getRedis(): Redis;
/**
 * Check if the Redis client is connected and ready.
 */
export declare function isRedisReady(): boolean;
/**
 * Add a token JTI to the blacklist with automatic expiration.
 * @param jti - The JWT ID to blacklist
 * @param ttlSeconds - Time-to-live in seconds (should match token remaining life)
 */
export declare function blacklistToken(jti: string, ttlSeconds: number): Promise<boolean>;
/**
 * Check if a token JTI is blacklisted.
 *
 * @param jti - The JWT ID to check
 * @param failClosed - If true, returns true (blocked) when Redis is unavailable.
 *   Use failClosed=true for sensitive operations (logout, password change, role change)
 *   where allowing a revoked token is worse than a temporary 401.
 *   Default: false (fail-open) for normal request flow.
 */
export declare function isTokenBlacklisted(jti: string, failClosed?: boolean): Promise<boolean>;
/**
 * Gracefully close the Redis connection (for shutdown hooks).
 */
export declare function closeRedis(): Promise<void>;
//# sourceMappingURL=redis.d.ts.map