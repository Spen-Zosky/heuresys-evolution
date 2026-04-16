/**
 * Application configuration
 */
import dotenv from 'dotenv';
import crypto from 'crypto';
import { requiredEnv } from './env.js';
import { logger } from './logger.js';
// Load environment variables
dotenv.config();
const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isDevelopment = nodeEnv === 'development';
function resolveJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (isDevelopment) {
            const devSecret = crypto.randomBytes(32).toString('hex');
            logger.warn('[CONFIG] JWT_SECRET not set — using random ephemeral secret (development only)');
            return devSecret;
        }
        throw new Error('JWT_SECRET environment variable is required');
    }
    const weakPatterns = ['change', 'secret', 'development', 'your-', 'placeholder'];
    const isWeak = weakPatterns.some((p) => secret.toLowerCase().includes(p));
    if (isWeak && isProduction) {
        throw new Error('JWT_SECRET matches a known placeholder pattern — set a strong secret for production');
    }
    if (isWeak && isDevelopment) {
        logger.warn('[CONFIG] JWT_SECRET appears weak — acceptable in development, must be changed for production');
    }
    return secret;
}
function resolveRefreshSecret() {
    const secret = process.env.REFRESH_TOKEN_SECRET;
    if (!secret) {
        if (isDevelopment) {
            const devSecret = crypto.randomBytes(32).toString('hex');
            logger.warn('[CONFIG] REFRESH_TOKEN_SECRET not set — using random ephemeral secret (development only)');
            return devSecret;
        }
        throw new Error('REFRESH_TOKEN_SECRET environment variable is required');
    }
    const weakPatterns = ['change', 'secret', 'development', 'your-', 'placeholder'];
    const isWeak = weakPatterns.some((p) => secret.toLowerCase().includes(p));
    if (isWeak && isProduction) {
        throw new Error('REFRESH_TOKEN_SECRET matches a known placeholder pattern — set a strong secret for production');
    }
    if (isWeak && isDevelopment) {
        logger.warn('[CONFIG] REFRESH_TOKEN_SECRET appears weak — acceptable in development, must be changed for production');
    }
    return secret;
}
function resolveCorsOrigin() {
    const origin = process.env.CORS_ORIGIN || 'http://localhost:3012';
    if (origin === '*' && isProduction) {
        throw new Error('CORS_ORIGIN wildcard (*) is not allowed in production');
    }
    // Support comma-separated origins for multi-host access
    if (origin.includes(',')) {
        return origin.split(',').map((o) => o.trim());
    }
    return origin;
}
export const config = {
    // Server
    port: parseInt(process.env.API_GATEWAY_PORT || '3000', 10),
    nodeEnv,
    baseUrl: process.env.BASE_URL || 'http://localhost:8012',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3012',
    // Database
    database: {
        host: process.env.PLATFORM_DB_HOST || 'localhost',
        port: parseInt(process.env.PLATFORM_DB_PORT || '5433', 10),
        user: process.env.PLATFORM_DB_USER || 'heuresys',
        password: requiredEnv('PLATFORM_DB_PASSWORD', 'heuresys'),
        name: process.env.PLATFORM_DB_NAME || 'heuresys_platform',
    },
    // JWT
    jwt: {
        secret: resolveJwtSecret(),
        refreshSecret: resolveRefreshSecret(),
        accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
        refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
    },
    // CORS
    cors: {
        origin: resolveCorsOrigin(),
        credentials: true,
    },
    // Rate Limiting
    rateLimit: {
        windowMs: 60 * 1000, // 1 minute
        max: 100, // requests per window
    },
    // Redis
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
    },
    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'dev',
    },
};
//# sourceMappingURL=index.js.map