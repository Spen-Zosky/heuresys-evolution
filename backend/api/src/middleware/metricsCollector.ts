/**
 * Prometheus Metrics Collector Middleware
 *
 * Collects HTTP request metrics for Prometheus scraping:
 * - Default Node.js metrics (heap, event loop, GC)
 * - HTTP request duration histogram
 * - Active connections gauge
 * - Total requests counter
 */

import { Request, Response, NextFunction } from 'express';
import { Registry, Histogram, Gauge, Counter, collectDefaultMetrics } from 'prom-client';

// Dedicated registry to avoid polluting the global default
export const register = new Registry();

// Collect default Node.js metrics (heap, event loop, GC)
collectDefaultMetrics({ register });

// HTTP request duration histogram
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Active connections gauge
export const activeConnections = new Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [register],
});

// Total requests counter
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

/**
 * Normalize route path to avoid high-cardinality label values.
 * Uses the matched Express route pattern when available,
 * otherwise falls back to the raw path with UUID-like segments replaced.
 */
function normalizeRoute(req: Request): string {
  // Prefer the matched route pattern (e.g. /api/v1/employees/:id)
  if (req.route?.path) {
    return req.baseUrl + req.route.path;
  }
  // Fallback: replace UUIDs and numeric IDs to keep cardinality low
  return req.path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+/g, '/:id');
}

/**
 * Express middleware that tracks request metrics.
 * Should be mounted early in the middleware chain (after CORS, before auth).
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip metrics endpoint itself to avoid self-referential noise
  if (req.path === '/metrics') {
    next();
    return;
  }

  const startTime = process.hrtime.bigint();
  activeConnections.inc();

  res.on('finish', () => {
    activeConnections.dec();

    const durationNs = Number(process.hrtime.bigint() - startTime);
    const durationSec = durationNs / 1e9;

    const route = normalizeRoute(req);
    const method = req.method;
    const statusCode = String(res.statusCode);

    httpRequestDuration.observe({ method, route, status_code: statusCode }, durationSec);
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
  });

  next();
}
