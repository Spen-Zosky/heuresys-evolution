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
declare const USE_RBP_SCOPE: boolean;
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
export declare function getScopeCondition(req: Request, tableAlias?: string): ScopeCondition;
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
export declare function getNextParamIndex(scope: ScopeCondition): number;
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
export declare function mergeScopeWith(scope: ScopeCondition, additionalWhere: string, additionalParams: unknown[]): ScopeCondition;
export { USE_RBP_SCOPE };
//# sourceMappingURL=scope-helpers.d.ts.map