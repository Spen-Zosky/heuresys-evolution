/**
 * Public API Key Authentication Middleware
 * Horizon O2.4 — validates X-API-Key header, sets tenant context + dbClient
 */
import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            apiKeyId?: string;
            apiKeyRateLimit?: number;
        }
    }
}
export declare function requirePublicApiKey(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=requirePublicApiKey.d.ts.map