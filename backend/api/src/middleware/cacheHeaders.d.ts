/**
 * HTTP Cache Headers Middleware
 * Overrides the global no-store policy for specific endpoint categories.
 * Works alongside Redis server-side caching.
 */
import { Request, Response, NextFunction } from 'express';
type CacheProfile = 'static' | 'reference' | 'short' | 'private-short';
export declare function cacheControl(profile: CacheProfile): (_req: Request, res: Response, next: NextFunction) => void;
export declare function withETag(_req: Request, res: Response, next: NextFunction): void;
export {};
//# sourceMappingURL=cacheHeaders.d.ts.map