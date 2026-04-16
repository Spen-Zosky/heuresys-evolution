/**
 * Scope Filter Helpers — RBP Phase 2
 *
 * Bridges the gap between existing `tenant_id = $1` queries
 * and the RBP scope filter middleware (`req.scopeFilter`).
 *
 * When USE_RBP_SCOPE=true and req.scopeFilter is set by applyScopeFilter(),
 * these helpers return the RBP-driven WHERE clause.
 * Otherwise, they fall back to the legacy tenant_id filter.
 */

import { Request } from 'express';

const USE_RBP_SCOPE = process.env.USE_RBP_SCOPE === 'true';

interface ScopeCondition {
  where: string;
  params: unknown[];
}

/**
 * Returns the scope WHERE condition for a query.
 *
 * Usage in route handler:
 * ```ts
 * const scope = getScopeCondition(req, 'e');  // 'e' = table alias
 * const result = await db.query(
 *   `SELECT * FROM employees e WHERE ${scope.where} AND e.is_active = true`,
 *   scope.params
 * );
 * ```
 *
 * With RBP scope: returns data-driven filter (TENANT/DEPARTMENT/HIERARCHY/SELF)
 * Without RBP scope: returns legacy `tenant_id = $1`
 */
export function getScopeCondition(req: Request, tableAlias?: string): ScopeCondition {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authReq = req as any;

  // If RBP scope is enabled and filter is available, use it
  if (USE_RBP_SCOPE && authReq.scopeFilter) {
    const prefix = tableAlias ? `${tableAlias}.` : '';
    // Prefix each column reference in the WHERE clause with the table alias
    const where = tableAlias
      ? prefixColumnsInWhere(authReq.scopeFilter.where, prefix)
      : authReq.scopeFilter.where;
    return { where, params: authReq.scopeFilter.params };
  }

  // Legacy fallback: tenant_id filter only
  const tenantId = authReq.tenantId;
  const prefix = tableAlias ? `${tableAlias}.` : '';
  return {
    where: `${prefix}tenant_id = $1`,
    params: [tenantId],
  };
}

/**
 * Returns the next parameter index after scope params.
 * Use this to continue parameterized queries after scope conditions.
 *
 * Usage:
 * ```ts
 * const scope = getScopeCondition(req);
 * const nextParam = getNextParamIndex(scope);
 * const result = await db.query(
 *   `SELECT * FROM employees WHERE ${scope.where} AND org_unit_id = $${nextParam}`,
 *   [...scope.params, orgUnitId]
 * );
 * ```
 */
export function getNextParamIndex(scope: ScopeCondition): number {
  return scope.params.length + 1;
}

/**
 * Merges scope condition with additional WHERE conditions.
 * Handles parameter index rebasing automatically.
 *
 * Usage:
 * ```ts
 * const scope = getScopeCondition(req);
 * const merged = mergeScopeWith(scope, 'is_active = $NEXT AND name ILIKE $NEXT', [true, '%john%']);
 * // Result: { where: 'tenant_id = $1 AND is_active = $2 AND name ILIKE $3', params: [tenantId, true, '%john%'] }
 * ```
 */
export function mergeScopeWith(
  scope: ScopeCondition,
  additionalWhere: string,
  additionalParams: unknown[]
): ScopeCondition {
  let nextIdx = scope.params.length + 1;
  let rebasedWhere = additionalWhere;

  // Replace $NEXT placeholders with sequential indices
  while (rebasedWhere.includes('$NEXT')) {
    rebasedWhere = rebasedWhere.replace('$NEXT', `$${nextIdx}`);
    nextIdx++;
  }

  return {
    where: `${scope.where} AND ${rebasedWhere}`,
    params: [...scope.params, ...additionalParams],
  };
}

/**
 * Prefix column names in a WHERE clause with a table alias.
 * Handles: tenant_id, org_unit_id, employee_id, manager_id
 */
function prefixColumnsInWhere(where: string, prefix: string): string {
  const columns = ['tenant_id', 'org_unit_id', 'employee_id', 'manager_id'];
  let result = where;
  for (const col of columns) {
    // Only prefix if not already prefixed
    const regex = new RegExp(`(?<!\\.)\\b${col}\\b`, 'g');
    result = result.replace(regex, `${prefix}${col}`);
  }
  return result;
}

export { USE_RBP_SCOPE };
