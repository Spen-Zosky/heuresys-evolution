/**
 * Prometheus Metrics Endpoint
 *
 * Exposes /metrics for Prometheus scraping.
 * Protected by bearer token (METRICS_TOKEN env) or IP allowlist.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=metrics.d.ts.map