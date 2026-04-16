import pg from 'pg';
export declare const pool: pg.Pool;
export type Queryable = pg.Pool | pg.PoolClient;
export declare function assertTenantId(tenantId: string): void;
/**
 * Run `fn` inside a transaction scoped to a tenant.
 * Sets `app.current_tenant_id` via `SET LOCAL`, so RLS policies that read
 * `current_setting('app.current_tenant_id')` apply to every query issued
 * on the provided client.
 *
 * Do NOT hold the client across long-running operations (LLM calls, HTTP
 * fetches). Use multiple short blocks instead.
 */
export declare function withTenantClient<T>(tenantId: string, fn: (client: pg.PoolClient) => Promise<T>): Promise<T>;
//# sourceMappingURL=pool.d.ts.map