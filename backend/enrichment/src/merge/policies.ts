import type { Queryable } from '../db/pool.js';
import { pool } from '../db/pool.js';

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

export type FieldStrategy =
  | 'authoritative_only'
  | 'update_if_empty'
  | 'update_if_empty_or_verified'
  | 'prefer_latest_high_confidence'
  | 'prefer_authoritative'
  | 'suggest_only'
  | 'append_observation_not_overwrite'
  | 'unknown';

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

function coerceStrategy(value: unknown): FieldStrategy {
  if (typeof value !== 'string') return 'unknown';
  const allowed: FieldStrategy[] = [
    'authoritative_only',
    'update_if_empty',
    'update_if_empty_or_verified',
    'prefer_latest_high_confidence',
    'prefer_authoritative',
    'suggest_only',
    'append_observation_not_overwrite',
  ];
  return (allowed.includes(value as FieldStrategy) ? value : 'unknown') as FieldStrategy;
}

function coerceMode(value: unknown): MergeMode {
  if (value === 'merge' || value === 'observe') return value;
  return 'suggest';
}

function parsePolicyRow(row: {
  id: string;
  code: string;
  version: number;
  rules_jsonb: unknown;
  budget_cap_eur: string;
  current_usage_eur: string;
  description: string | null;
}): MergePolicy {
  const rulesObj = (row.rules_jsonb ?? {}) as {
    mode?: unknown;
    rules?: Record<string, unknown>;
  };
  const mode = coerceMode(rulesObj.mode);
  const fieldStrategies: Record<string, FieldStrategy> = {};
  for (const [k, v] of Object.entries(rulesObj.rules ?? {})) {
    fieldStrategies[k] = coerceStrategy(v);
  }
  return {
    id: row.id,
    code: row.code,
    version: row.version,
    mode,
    fieldStrategies,
    budgetCapEur: Number(row.budget_cap_eur),
    currentUsageEur: Number(row.current_usage_eur),
    description: row.description,
  };
}

export async function loadPolicyById(
  policyId: string,
  db: Queryable = pool,
): Promise<MergePolicy | null> {
  const result = await db.query(
    `SELECT id, code, version, rules_jsonb, budget_cap_eur::text, current_usage_eur::text, description
       FROM enrichment_merge_policies
      WHERE id = $1
        AND is_active = true
      LIMIT 1`,
    [policyId],
  );
  if (result.rows.length === 0) return null;
  return parsePolicyRow(result.rows[0]);
}

/**
 * Look up the policy for a given descriptor id. Descriptors have a
 * default_merge_policy_id column; this helper follows that link.
 */
export async function loadPolicyForDescriptor(
  descriptorId: string,
  db: Queryable = pool,
): Promise<MergePolicy | null> {
  const result = await db.query(
    `SELECT p.id, p.code, p.version, p.rules_jsonb, p.budget_cap_eur::text,
            p.current_usage_eur::text, p.description
       FROM enrichment_entity_descriptors d
       JOIN enrichment_merge_policies p ON p.id = d.default_merge_policy_id
      WHERE d.id = $1
        AND p.is_active = true
      LIMIT 1`,
    [descriptorId],
  );
  if (result.rows.length === 0) return null;
  return parsePolicyRow(result.rows[0]);
}

// Exposed for unit tests so we can validate parsing without hitting the DB.
export const __test = { parsePolicyRow, coerceStrategy, coerceMode };
