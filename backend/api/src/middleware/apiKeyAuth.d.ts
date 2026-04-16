/**
 * API Key Authentication Middleware
 * Checks X-API-Key header for plugin API key authentication.
 * If present, validates the key and sets user context.
 * If absent, passes through to JWT auth.
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Generate a new API key with prefix 'heu_'
 * Returns { raw, hash, prefix }
 */
export declare function generateApiKey(): {
    raw: string;
    hash: string;
    prefix: string;
};
/**
 * API Key authentication middleware.
 * If X-API-Key header is present, validates and sets user context.
 * If not present, calls next() to allow JWT auth to handle it.
 */
export declare function apiKeyAuthMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=apiKeyAuth.d.ts.map