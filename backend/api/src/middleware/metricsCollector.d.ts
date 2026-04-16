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
import { Registry, Histogram, Gauge, Counter } from 'prom-client';
export declare const register: Registry<"text/plain; version=0.0.4; charset=utf-8">;
export declare const httpRequestDuration: Histogram<"route" | "method" | "status_code">;
export declare const activeConnections: Gauge<string>;
export declare const httpRequestsTotal: Counter<"route" | "method" | "status_code">;
/**
 * Express middleware that tracks request metrics.
 * Should be mounted early in the middleware chain (after CORS, before auth).
 */
export declare function metricsMiddleware(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=metricsCollector.d.ts.map