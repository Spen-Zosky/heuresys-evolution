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
export type FieldAction = 'SHOW' | 'MASK' | 'HIDE';
export type Classification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' | 'SENSITIVE';
/**
 * Per-table mapping of column name -> classification. Add new tables as
 * routes start consuming applyFieldPolicy(). Fields not listed default to
 * PUBLIC (always SHOWn). This map is the foundation -- future migration
 * will move it into a DB table.
 */
export declare const FIELD_CLASSIFICATION_REGISTRY: Record<string, Record<string, Classification>>;
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
export declare function loadFieldClassifications(tenantId: string | null): Promise<ClassificationMap>;
/**
 * Invalidate the cached field classifications for a given tenant (or all
 * tenants when called with no argument). Call this after rbp_field_classifications
 * is mutated via the admin UI.
 */
export declare function invalidateFieldClassifications(tenantId?: string | null): void;
/**
 * Loads the policy map for a given role from rbp_field_policies. Returns
 * a Map<Classification, FieldAction> with PUBLIC defaulting to SHOW.
 */
export declare function loadPolicyForRole(roleCode: string): Promise<Map<Classification, FieldAction>>;
/**
 * Applies field policy to a single row. Returns a NEW object -- does not
 * mutate the input. Fields with HIDE action are removed; fields with MASK
 * are replaced with maskValue(); fields with SHOW are passed through.
 *
 * Fields not registered in FIELD_CLASSIFICATION_REGISTRY[table] default to
 * PUBLIC and are passed through unmodified.
 */
export declare function applyFieldPolicy<T extends Record<string, unknown>>(row: T, table: string, policyMap: Map<Classification, FieldAction>): Partial<T>;
/**
 * Vectorised version for arrays of rows.
 */
export declare function applyFieldPolicyAll<T extends Record<string, unknown>>(rows: T[], table: string, policyMap: Map<Classification, FieldAction>): Partial<T>[];
/**
 * Variant of applyFieldPolicy that resolves the classification map from the
 * DB (rbp_field_classifications) instead of the hardcoded registry, layering
 * tenant overrides on top of platform defaults. This is the P9-compliant
 * entry point -- new callers should prefer this.
 */
export declare function applyFieldPolicyDb<T extends Record<string, unknown>>(row: T, table: string, policyMap: Map<Classification, FieldAction>, tenantId: string | null): Promise<Partial<T>>;
export declare function applyFieldPolicyAllDb<T extends Record<string, unknown>>(rows: T[], table: string, policyMap: Map<Classification, FieldAction>, tenantId: string | null): Promise<Partial<T>[]>;
export {};
//# sourceMappingURL=field-policy.d.ts.map