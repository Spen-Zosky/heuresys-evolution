/**
 * HTTP Cache Headers Middleware
 * Overrides the global no-store policy for specific endpoint categories.
 * Works alongside Redis server-side caching.
 */
import crypto from 'crypto';
const CACHE_PROFILES = {
    // Taxonomy, ESCO, NACE — data changes very rarely
    static: 'public, max-age=86400, stale-while-revalidate=3600',
    // Reference data — dropdown options, categories
    reference: 'public, max-age=3600, stale-while-revalidate=600',
    // Short-lived — dashboard summaries, stats
    short: 'public, max-age=300, stale-while-revalidate=60',
    // Private short — user-specific data with brief cache
    'private-short': 'private, max-age=60',
};
export function cacheControl(profile) {
    return (_req, res, next) => {
        res.setHeader('Cache-Control', CACHE_PROFILES[profile]);
        res.removeHeader('Pragma');
        res.removeHeader('Expires');
        next();
    };
}
export function withETag(_req, res, next) {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
        const content = JSON.stringify(body);
        const etag = `"${crypto.createHash('md5').update(content).digest('hex').slice(0, 16)}"`;
        res.setHeader('ETag', etag);
        return originalJson(body);
    };
    next();
}
//# sourceMappingURL=cacheHeaders.js.map