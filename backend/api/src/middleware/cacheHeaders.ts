/**
 * HTTP Cache Headers Middleware
 * Overrides the global no-store policy for specific endpoint categories.
 * Works alongside Redis server-side caching.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

type CacheProfile = 'static' | 'reference' | 'short' | 'private-short';

const CACHE_PROFILES: Record<CacheProfile, string> = {
  // Taxonomy, ESCO, NACE — data changes very rarely
  static: 'public, max-age=86400, stale-while-revalidate=3600',
  // Reference data — dropdown options, categories
  reference: 'public, max-age=3600, stale-while-revalidate=600',
  // Short-lived — dashboard summaries, stats
  short: 'public, max-age=300, stale-while-revalidate=60',
  // Private short — user-specific data with brief cache
  'private-short': 'private, max-age=60',
};

export function cacheControl(profile: CacheProfile) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', CACHE_PROFILES[profile]);
    res.removeHeader('Pragma');
    res.removeHeader('Expires');
    next();
  };
}

export function withETag(_req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    const content = JSON.stringify(body);
    const etag = `"${crypto.createHash('md5').update(content).digest('hex').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    return originalJson(body);
  } as typeof res.json;
  next();
}
