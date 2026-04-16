/**
 * Prometheus Metrics Endpoint
 *
 * Exposes /metrics for Prometheus scraping.
 * Protected by bearer token (METRICS_TOKEN env) or IP allowlist.
 */
import { Router } from 'express';
import { register } from '../middleware/metricsCollector.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
const router = Router();
const METRICS_TOKEN = process.env.METRICS_TOKEN;
const METRICS_ALLOWED_IPS = (process.env.METRICS_ALLOWED_IPS || '127.0.0.1,::1,::ffff:127.0.0.1')
    .split(',')
    .map((ip) => ip.trim());
function isMetricsAuthorized(req) {
    // If a token is configured, check Authorization header
    if (METRICS_TOKEN) {
        const authHeader = req.headers.authorization;
        if (authHeader === `Bearer ${METRICS_TOKEN}`)
            return true;
    }
    // Check IP allowlist
    const clientIp = req.ip || req.socket.remoteAddress || '';
    if (METRICS_ALLOWED_IPS.includes(clientIp))
        return true;
    // In development without METRICS_TOKEN, allow all (backwards compat)
    if (!METRICS_TOKEN && process.env.NODE_ENV !== 'production')
        return true;
    return false;
}
router.get('/metrics', asyncHandler(async (req, res) => {
    if (!isMetricsAuthorized(req)) {
        throw Errors.forbidden('metrics', 'access');
    }
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
}));
export default router;
//# sourceMappingURL=metrics.js.map