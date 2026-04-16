/**
 * Rate Limiting Middleware
 * Protects API from abuse and ensures fair usage
 */

import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { RedisReply } from 'rate-limit-redis';
import { config } from '../config/index.js';
import { getRedis } from '../config/redis.js';

/**
 * Normalize IP address for consistent rate limiting
 * Handles IPv6 addresses by extracting the prefix
 */
function normalizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';

  // For IPv6, normalize by taking the /64 prefix (first 4 groups)
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return parts.slice(0, 4).join(':');
    }
  }

  return ip;
}

/**
 * Get client IP from request with IPv6 normalization.
 * Uses req.ip (set by Express based on trust proxy setting) to prevent
 * IP spoofing via X-Forwarded-For header manipulation.
 * X-Forwarded-For is only trusted when Express trust proxy is configured.
 */
function getClientIp(req: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string | undefined;
}): string {
  return normalizeIp(req.ip);
}

/**
 * Standard API rate limiter
 * Applies to all API routes
 */
export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: process.env.NODE_ENV === 'production' ? config.rateLimit.max : 10000, // Relaxed in development
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/db-health';
  },
  validate: { xForwardedForHeader: false },
});

/**
 * Strict rate limiter for sensitive endpoints (auth, password reset)
 * More restrictive to prevent brute force attacks
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 1000, // Relaxed in development for E2E tests
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: 900, // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Combine IP and username for more precise limiting
    const ip = getClientIp(req);
    const username = req.body?.username || 'unknown';
    return `${ip}:${username}`;
  },
  validate: { xForwardedForHeader: false },
});

/**
 * Login-specific rate limiter — stricter than authRateLimiter.
 * Max 5 login attempts per minute per IP to prevent credential stuffing.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 5 : 1000, // Relaxed in development for E2E tests
  message: {
    success: false,
    error: 'Too many login attempts, please try again in 1 minute',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const username = req.body?.username || 'unknown';
    return `login:${ip}:${username}`;
  },
  validate: { xForwardedForHeader: false },
});

/**
 * AI endpoint rate limiter
 * Protects expensive AI operations
 */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 AI requests per minute
  message: {
    success: false,
    error: 'Too many AI requests, please try again later',
    code: 'AI_RATE_LIMIT_EXCEEDED',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use tenant + user for AI rate limiting
    const tenantId = req.headers['x-tenant-code'] || 'unknown';
    const ip = getClientIp(req);
    return `${tenantId}:${ip}`;
  },
  validate: { xForwardedForHeader: false },
});

/**
 * Export rate limiter
 * Protects data export operations
 */
export const exportRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 exports per 5 minutes
  message: {
    success: false,
    error: 'Too many export requests, please try again later',
    code: 'EXPORT_RATE_LIMIT_EXCEEDED',
    retryAfter: 300,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Heavy compute rate limiter
 * Protects CPU/DB-intensive operations (SAP migration, payroll, predictions)
 */
export const heavyComputeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 10 : 1000,
  message: {
    success: false,
    error: 'Too many compute-intensive requests, please try again later',
    code: 'HEAVY_COMPUTE_RATE_LIMIT_EXCEEDED',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const tenantId = req.headers['x-tenant-code'] || 'unknown';
    const ip = getClientIp(req);
    return `heavy:${tenantId}:${ip}`;
  },
  validate: { xForwardedForHeader: false },
});

/**
 * Public API rate limiter — per API key, backed by Redis.
 * Falls back to in-memory store if Redis is unavailable.
 */
function createPublicApiStore(): RedisStore {
  const redis = getRedis();
  return new RedisStore({
    sendCommand: (...args: string[]) =>
      redis.call(args[0]!, ...args.slice(1)) as Promise<RedisReply>,
    prefix: 'rl:pubapi:',
  });
}

export const publicApiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => req.apiKeyRateLimit ?? 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `pubapi:${req.apiKeyId ?? getClientIp(req)}`,
  store: createPublicApiStore(),
  message: {
    success: false,
    error: 'Public API rate limit exceeded',
    code: 'PUBLIC_API_RATE_LIMIT_EXCEEDED',
    retryAfter: 3600,
  },
  validate: { xForwardedForHeader: false },
});
