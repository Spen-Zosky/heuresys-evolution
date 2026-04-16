/**
 * Tenant Setup Routes - Behavioral Tests
 * Note: Uses authMiddleware + requirePermission('PLATFORM', 'VIEW').
 * Imports from @heuresys/shared (CCNL_TYPES, CCNL_LEAVE_DEFAULTS).
 *
 * The route file mounts its own authMiddleware and requirePermission.
 * In the test environment USE_RBP_FRAMEWORK=false (set in setup.ts),
 * so requirePermission('PLATFORM', 'VIEW') falls back to
 * legacyRequireRole('SUPERUSER'). We therefore use a SUPERUSER token.
 *
 * pool.query (poolQuery) and req.dbClient.query (routeQuery) are
 * separate mocks so the legacy requireRole DB verification (skipped
 * in NODE_ENV=test) doesn't interfere with route-handler mocks.
 */
export {};
//# sourceMappingURL=tenant-setup.test.d.ts.map