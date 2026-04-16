/**
 * Database transaction helper
 *
 * Provides a simple wrapper for executing multiple queries within
 * a single database transaction, ensuring atomicity.
 *
 * IMPORTANT: Uses appPool and sets tenant context on the transaction
 * client to ensure RLS policies are enforced within transactions.
 */

import { appPool } from '../config/database.js';
import type { PoolClient } from 'pg';

/**
 * Execute a callback within a database transaction with proper tenant context.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 * Sets the tenant RLS context on the transaction client to ensure
 * Row-Level Security policies are enforced.
 *
 * @param callback - Async function receiving a PoolClient to execute queries on
 * @param tenantId - The tenant ID to set in the RLS context (required for security)
 * @returns The value returned by the callback
 * @throws Re-throws any error from the callback after rolling back
 *
 * @example
 * ```ts
 * const result = await withTransaction(async (client) => {
 *   await client.query('UPDATE foo SET bar = $1 WHERE id = $2', [val, id]);
 *   await client.query('INSERT INTO log (action) VALUES ($1)', ['updated']);
 *   return { success: true };
 * }, req.tenantId!);
 * ```
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  tenantId?: string
): Promise<T> {
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    // Set tenant context within the transaction for RLS enforcement
    if (tenantId) {
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    }
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
