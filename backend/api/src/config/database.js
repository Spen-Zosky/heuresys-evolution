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
import { Pool } from 'pg';
import { requiredEnv } from './env.js';
import { logger } from './logger.js';
// =============================================================================
// Admin pool (superuser) - for migrations, admin tasks, BYPASSRLS operations
// =============================================================================
const adminPoolConfig = {
    host: process.env.PLATFORM_DB_HOST || 'localhost',
    port: parseInt(process.env.PLATFORM_DB_PORT || '5433', 10),
    user: process.env.PLATFORM_DB_USER || 'heuresys',
    password: requiredEnv('PLATFORM_DB_PASSWORD', 'heuresys'),
    database: process.env.PLATFORM_DB_NAME || 'heuresys_platform',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    application_name: 'heuresys-api-gateway-admin',
    statement_timeout: 10000, // 10s max query time
};
export const pool = new Pool(adminPoolConfig);
pool.on('error', (err) => {
    logger.error({ err: err }, '[DB:admin] Unexpected error on idle client');
});
// =============================================================================
// Application pool (RLS-enforced) - for all tenant-scoped queries
// =============================================================================
const appPoolConfig = {
    host: process.env.PLATFORM_DB_HOST || 'localhost',
    port: parseInt(process.env.PLATFORM_DB_PORT || '5433', 10),
    user: process.env.PLATFORM_DB_APP_USER || 'heuresys_app',
    password: requiredEnv('PLATFORM_DB_APP_PASSWORD', 'heuresys_app_secure'),
    database: process.env.PLATFORM_DB_NAME || 'heuresys_platform',
    max: 30,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    application_name: 'heuresys-api-gateway',
    statement_timeout: 10000, // 10s max query time
};
export const appPool = new Pool(appPoolConfig);
appPool.on('error', (err) => {
    logger.error({ err: err }, '[DB:app] Unexpected error on idle client');
});
// =============================================================================
// Per-request client helpers (transaction-scoped RLS)
// =============================================================================
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
export async function getAppClient() {
    return appPool.connect();
}
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
export async function withTenantClient(tenantId, callback) {
    const client = await appPool.connect();
    try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        return await callback(client);
    }
    finally {
        client.release();
    }
}
// =============================================================================
// Connection testing
// =============================================================================
/**
 * Test admin database connection (superuser pool)
 */
export async function testConnection() {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return true;
    }
    catch (error) {
        logger.error({ err: error }, '[DB:admin] Database connection failed:');
        return false;
    }
}
/**
 * Test application database connection (RLS-enforced pool)
 */
export async function testAppConnection() {
    try {
        const client = await appPool.connect();
        const result = await client.query("SELECT current_user, current_setting('is_superuser') AS is_super");
        const row = result.rows[0];
        client.release();
        if (row.is_super === 'on') {
            logger.error('[DB:app] SECURITY WARNING: appPool connected as superuser! RLS will NOT be enforced.');
            return false;
        }
        logger.info(`[DB:app] Connected as ${row.current_user} (superuser: ${row.is_super})`);
        return true;
    }
    catch (error) {
        logger.error({ err: error }, '[DB:app] Application database connection failed:');
        return false;
    }
}
// =============================================================================
// Graceful shutdown
// =============================================================================
/**
 * Close all database pools gracefully
 */
export async function closePool() {
    await Promise.all([pool.end(), appPool.end()]);
}
//# sourceMappingURL=database.js.map