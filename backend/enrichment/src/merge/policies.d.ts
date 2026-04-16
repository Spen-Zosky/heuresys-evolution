import type { Queryable } from '../db/pool.js';
/**
 * SEE Fase 7 — merge policy loader.
 *
 * A policy row in enrichment_merge_policies carries:
 *   - mode: 'suggest' | 'merge' | 'observe' (top-level default)
 *   - rules[field_name]: per-field strategy string
 *   - budget_cap_eur / current_usage_eur: tenant LLM budget
 *
 * This module loads the policy for a given enrichment_jobs row and parses
 * rules_jsonb into a typed shape so the strategies module can make
 * decisions per candidate.
 */
export type MergeMode = 'suggest' | 'merge' | 'observe';
export type FieldStrategy = 'authoritative_only' | 'update_if_empty' | 'update_if_empty_or_verified' | 'prefer_latest_high_confidence' | 'prefer_authoritative' | 'suggest_only' | 'append_observation_not_overwrite' | 'unknown';
export interface MergePolicy {
    id: string;
    code: string;
    version: number;
    mode: MergeMode;
    fieldStrategies: Record<string, FieldStrategy>;
    budgetCapEur: number;
    currentUsageEur: number;
    description: string | null;
}
declare function coerceStrategy(value: unknown): FieldStrategy;
declare function coerceMode(value: unknown): MergeMode;
declare function parsePolicyRow(row: {
    id: string;
    code: string;
    version: number;
    rules_jsonb: unknown;
    budget_cap_eur: string;
    current_usage_eur: string;
    description: string | null;
}): MergePolicy;
export declare function loadPolicyById(policyId: string, db?: Queryable): Promise<MergePolicy | null>;
/**
 * Look up the policy for a given descriptor id. Descriptors have a
 * default_merge_policy_id column; this helper follows that link.
 */
export declare function loadPolicyForDescriptor(descriptorId: string, db?: Queryable): Promise<MergePolicy | null>;
export declare const __test: {
    parsePolicyRow: typeof parsePolicyRow;
    coerceStrategy: typeof coerceStrategy;
    coerceMode: typeof coerceMode;
};
export {};
//# sourceMappingURL=policies.d.ts.map