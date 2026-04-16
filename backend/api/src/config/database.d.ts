/**
 * Database configuration and connection pools
 *
 * Two pools are provided:
 *
 * - `pool` (admin): Connects as the heuresys superuser.
 *   Used for migrations, admin tasks, and operations that need BYPASSRLS.
 *   Should NOT be used for tenant-scoped application queries.
 *
 * - `appPool` (application): Connects as heuresys_app (non-superuser, no BYPASSRLS).
 *   All RLS policies are enforced on this connection.
 *   Should be used for all tenant-scoped application queries.
 *   Requires set_config('app.current_tenant_id', ...) to be called per-query.
 */
import { Pool, PoolClient } from 'pg';
export declare const pool: Pool;
export declare const appPool: Pool;
/**
 * Get a dedicated client from the application pool.
 *
 * The caller is responsible for releasing the client via `client.release()`
 * in a finally block. Use this when you need fine-grained control over the
 * client lifecycle (e.g., in middleware that attaches the client to a request).
 *
 * For simpler use cases, prefer `withTenantClient()` which handles
 * acquisition, tenant context setup, and release automatically.
 */
export declare function getAppClient(): Promise<PoolClient>;
/**
 * Execute a callback with a tenant-scoped application client.
 *
 * Acquires a client from `appPool`, sets `app.current_tenant_id` as a
 * transaction-local parameter (the `true` argument to `set_config` makes
 * the setting local to the current transaction), executes the callback,
 * and guarantees the client is released back to the pool.
 *
 * @param tenantId - The UUID of the tenant to scope queries to
 * @param callback - Async function receiving the tenant-scoped PoolClient
 * @returns The value returned by the callback
 */
export declare function withTenantClient<T>(tenantId: string, callback: (client: PoolClient) => Promise<T>): Promise<T>;
/**
 * Test admin database connection (superuser pool)
 */
export declare function testConnection(): Promise<boolean>;
/**
 * Test application database connection (RLS-enforced pool)
 */
export declare function testAppConnection(): Promise<boolean>;
/**
 * Close all database pools gracefully
 */
export declare function closePool(): Promise<void>;
//# sourceMappingURL=database.d.ts.map