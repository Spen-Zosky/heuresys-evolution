/**
 * Field Policy Helper — RBP Step 2.2 foundation (TASK-08)
 *
 * Applies SHOW / MASK / HIDE rules to fields of a row based on the requesting
 * user's role and the field's data classification. Sources of truth:
 *   - rbp_data_classifications (PUBLIC / INTERNAL / CONFIDENTIAL / RESTRICTED / SENSITIVE)
 *   - rbp_field_policies        (role × classification → action)
 *
 * The mapping of *which field of which table* belongs to which classification
 * is currently expressed via FIELD_CLASSIFICATION_REGISTRY below. The
 * intention is to migrate this constant into a DB table (e.g.
 * `rbp_field_classifications`) so the registry becomes data-driven (P9).
 * The helper signature stays the same after that migration — only the way
 * we resolve field -> classification will change.
 *
 * The helper is intentionally pure and synchronous. The caller is expected
 * to load the policy map once per request and pass it in.
 */

import { pool } from '../config/database.js';

export type FieldAction = 'SHOW' | 'MASK' | 'HIDE';

export type Classification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' | 'SENSITIVE';

/**
 * Per-table mapping of column name -> classification. Add new tables as
 * routes start consuming applyFieldPolicy(). Fields not listed default to
 * PUBLIC (always SHOWn). This map is the foundation -- future migration
 * will move it into a DB table.
 */
export const FIELD_CLASSIFICATION_REGISTRY: Record<string, Record<string, Classification>> = {
  employees: {
    // PUBLIC defaults: id, first_name, last_name, job_title, employee_code
    email: 'INTERNAL',
    phone: 'INTERNAL',
    manager_id: 'INTERNAL',
    org_unit_id: 'INTERNAL',
    location_id: 'INTERNAL',
    hire_date: 'CONFIDENTIAL',
    employment_status: 'CONFIDENTIAL',
    performance_box: 'CONFIDENTIAL',
    potential_box: 'CONFIDENTIAL',
    birth_date: 'SENSITIVE',
    fiscal_code: 'SENSITIVE',
    gender: 'SENSITIVE',
    nationality: 'SENSITIVE',
  },
  employee_contracts: {
    annual_salary: 'RESTRICTED',
    currency: 'RESTRICTED',
    ccnl_code: 'RESTRICTED',
    level: 'RESTRICTED',
    contract_type: 'RESTRICTED',
  },
};

/**
 * Mask value used when an action is MASK. Strings get bullet replacement,
 * numbers become null, booleans become null, dates become null.
 */
function maskValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return '\u2022\u2022\u2022\u2022';
  return null;
}

interface PolicyEntry {
  classification: Classification;
  action: FieldAction;
}

/**
 * Loads field->classification overrides from rbp_field_classifications
 * (DB) for the given tenant. Platform defaults (tenant_id NULL) are layered
 * first, tenant-specific rows override. Falls back to the hardcoded
 * FIELD_CLASSIFICATION_REGISTRY if the query fails (e.g. table missing
 * during migration window).
 *
 * The result shape matches FIELD_CLASSIFICATION_REGISTRY so existing call
 * sites remain unchanged. Cached per-tenant in a Map keyed by tenant_id.
 */
type ClassificationMap = Record<string, Record<string, Classification>>;

const fieldClassificationsCache = new Map<string, ClassificationMap>();
const FIELD_CLASSIFICATIONS_TTL_MS = Number(process.env.FIELD_CLASSIFICATIONS_TTL_MS ?? 300000);
const fieldClassificationsLastLoad = new Map<string, number>();

export async function loadFieldClassifications(
  tenantId: string | null
): Promise<ClassificationMap> {
  const key = tenantId ?? '__platform__';
  const now = Date.now();
  const cached = fieldClassificationsCache.get(key);
  const loadedAt = fieldClassificationsLastLoad.get(key) ?? 0;
  if (cached && now - loadedAt < FIELD_CLASSIFICATIONS_TTL_MS) return cached;

  try {
    const result = await pool.query<{
      table_name: string;
      column_name: string;
      classification: Classification;
      tenant_id: string | null;
    }>(
      `SELECT table_name, column_name, classification, tenant_id
         FROM rbp_field_classifications
        WHERE tenant_id IS NULL
           OR tenant_id = $1
        ORDER BY tenant_id NULLS FIRST`,
      [tenantId]
    );
    const map: ClassificationMap = {};
    for (const row of result.rows) {
      if (!map[row.table_name]) map[row.table_name] = {};
      map[row.table_name]![row.column_name] = row.classification;
    }
    fieldClassificationsCache.set(key, map);
    fieldClassificationsLastLoad.set(key, now);
    return map;
  } catch (err) {
    console.error(
      '[field-policy] failed to load field classifications from DB, falling back to static registry',
      err
    );
    return FIELD_CLASSIFICATION_REGISTRY;
  }
}

/**
 * Invalidate the cached field classifications for a given tenant (or all
 * tenants when called with no argument). Call this after rbp_field_classifications
 * is mutated via the admin UI.
 */
export function invalidateFieldClassifications(tenantId?: string | null): void {
  if (tenantId === undefined) {
    fieldClassificationsCache.clear();
    fieldClassificationsLastLoad.clear();
    return;
  }
  const key = tenantId ?? '__platform__';
  fieldClassificationsCache.delete(key);
  fieldClassificationsLastLoad.delete(key);
}

/**
 * Loads the policy map for a given role from rbp_field_policies. Returns
 * a Map<Classification, FieldAction> with PUBLIC defaulting to SHOW.
 */
export async function loadPolicyForRole(
  roleCode: string
): Promise<Map<Classification, FieldAction>> {
  const map = new Map<Classification, FieldAction>([
    ['PUBLIC', 'SHOW'],
    ['INTERNAL', 'SHOW'],
    ['CONFIDENTIAL', 'SHOW'],
    ['RESTRICTED', 'SHOW'],
    ['SENSITIVE', 'SHOW'],
  ]);
  try {
    const result = await pool.query<PolicyEntry>(
      `SELECT dc.code AS classification, fp.action
         FROM rbp_field_policies fp
         JOIN rbp_roles r ON fp.role_id = r.id
         JOIN rbp_data_classifications dc ON fp.data_classification_id = dc.id
        WHERE r.code = $1`,
      [roleCode]
    );
    for (const row of result.rows) {
      map.set(row.classification, row.action);
    }
  } catch (err) {
    console.error('[field-policy] failed to load policy for role', roleCode, err);
  }
  return map;
}

/**
 * Applies field policy to a single row. Returns a NEW object -- does not
 * mutate the input. Fields with HIDE action are removed; fields with MASK
 * are replaced with maskValue(); fields with SHOW are passed through.
 *
 * Fields not registered in FIELD_CLASSIFICATION_REGISTRY[table] default to
 * PUBLIC and are passed through unmodified.
 */
export function applyFieldPolicy<T extends Record<string, unknown>>(
  row: T,
  table: string,
  policyMap: Map<Classification, FieldAction>
): Partial<T> {
  if (!row) return row;
  const classMap = FIELD_CLASSIFICATION_REGISTRY[table] || {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const classification = classMap[key] || 'PUBLIC';
    const action = policyMap.get(classification) || 'SHOW';
    if (action === 'HIDE') continue;
    if (action === 'MASK') {
      out[key] = maskValue(value);
      continue;
    }
    out[key] = value;
  }
  return out as Partial<T>;
}

/**
 * Vectorised version for arrays of rows.
 */
export function applyFieldPolicyAll<T extends Record<string, unknown>>(
  rows: T[],
  table: string,
  policyMap: Map<Classification, FieldAction>
): Partial<T>[] {
  return rows.map((row) => applyFieldPolicy(row, table, policyMap));
}

/**
 * Variant of applyFieldPolicy that resolves the classification map from the
 * DB (rbp_field_classifications) instead of the hardcoded registry, layering
 * tenant overrides on top of platform defaults. This is the P9-compliant
 * entry point -- new callers should prefer this.
 */
export async function applyFieldPolicyDb<T extends Record<string, unknown>>(
  row: T,
  table: string,
  policyMap: Map<Classification, FieldAction>,
  tenantId: string | null
): Promise<Partial<T>> {
  if (!row) return row;
  const classMap = (await loadFieldClassifications(tenantId))[table] || {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const classification = classMap[key] || 'PUBLIC';
    const action = policyMap.get(classification) || 'SHOW';
    if (action === 'HIDE') continue;
    if (action === 'MASK') {
      out[key] = maskValue(value);
      continue;
    }
    out[key] = value;
  }
  return out as Partial<T>;
}

export async function applyFieldPolicyAllDb<T extends Record<string, unknown>>(
  rows: T[],
  table: string,
  policyMap: Map<Classification, FieldAction>,
  tenantId: string | null
): Promise<Partial<T>[]> {
  // Single DB fetch, then loop — avoid O(n) DB hits inside map().
  const classMap = (await loadFieldClassifications(tenantId))[table] || {};
  return rows.map((row) => {
    if (!row) return row as Partial<T>;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const classification = classMap[key] || 'PUBLIC';
      const action = policyMap.get(classification) || 'SHOW';
      if (action === 'HIDE') continue;
      if (action === 'MASK') {
        out[key] = maskValue(value);
        continue;
      }
      out[key] = value;
    }
    return out as Partial<T>;
  });
}
