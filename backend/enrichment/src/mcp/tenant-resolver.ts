import { pool, assertTenantId } from '../db/pool.js';

/**
 * Resolve a tenant by either its code (e.g. "rtl-bank") or UUID.
 * Throws if no match.
 */
export async function resolveTenant(codeOrId: string): Promise<{ id: string; code: string; name: string }> {
  if (!codeOrId || typeof codeOrId !== 'string') {
    throw new Error('tenant code or id is required');
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codeOrId);
  if (isUuid) {
    assertTenantId(codeOrId);
    const result = await pool.query(
      `SELECT id, code, name FROM tenants WHERE id = $1::uuid LIMIT 1`,
      [codeOrId],
    );
    if (result.rows.length === 0) {
      throw new Error(`tenant with id '${codeOrId}' not found`);
    }
    return result.rows[0];
  }

  const result = await pool.query(
    `SELECT id, code, name FROM tenants WHERE code = $1 LIMIT 1`,
    [codeOrId],
  );
  if (result.rows.length === 0) {
    throw new Error(`tenant with code '${codeOrId}' not found`);
  }
  return result.rows[0];
}
