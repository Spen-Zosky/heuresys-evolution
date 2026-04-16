/**
 * Rate Limiting Middleware
 * Protects API from abuse and ensures fair usage
 */
/**
 * Standard API rate limiter
 * Applies to all API routes
 */
export declare const apiRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Strict rate limiter for sensitive endpoints (auth, password reset)
 * More restrictive to prevent brute force attacks
 */
export declare const authRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Login-specific rate limiter — stricter than authRateLimiter.
 * Max 5 login attempts per minute per IP to prevent credential stuffing.
 */
export declare const loginRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * AI endpoint rate limiter
 * Protects expensive AI operations
 */
export declare const aiRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Export rate limiter
 * Protects data export operations
 */
export declare const exportRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Heavy compute rate limiter
 * Protects CPU/DB-intensive operations (SAP migration, payroll, predictions)
 */
export declare const heavyComputeRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const publicApiRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
//# sourceMappingURL=rateLimit.d.ts.map