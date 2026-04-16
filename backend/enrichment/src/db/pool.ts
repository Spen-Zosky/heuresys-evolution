import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
});

pool.on('error', (err) => {
  logger.error({ err }, 'pg pool error');
});

export type Queryable = pg.Pool | pg.PoolClient;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertTenantId(tenantId: string): void {
  if (!tenantId || !UUID_RE.test(tenantId)) {
    throw new Error(`invalid tenantId: expected UUID, got '${tenantId}'`);
  }
}

/**
 * Run `fn` inside a transaction scoped to a tenant.
 * Sets `app.current_tenant_id` via `SET LOCAL`, so RLS policies that read
 * `current_setting('app.current_tenant_id')` apply to every query issued
 * on the provided client.
 *
 * Do NOT hold the client across long-running operations (LLM calls, HTTP
 * fetches). Use multiple short blocks instead.
 */
export async function withTenantClient<T>(
  tenantId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  assertTenantId(tenantId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // SET LOCAL does not accept parameter binding — UUID is validated above.
    await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // rollback failure is shadowed by original error
    }
    throw err;
  } finally {
    client.release();
  }
}
