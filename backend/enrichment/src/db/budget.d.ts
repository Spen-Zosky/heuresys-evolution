import type { Queryable } from './pool.js';
/**
 * SEE Fase 10 — policy budget enforcement.
 *
 * Each enrichment_merge_policy row has budget_cap_eur (hard cap) and
 * current_usage_eur (accumulated spend). The pipeline:
 *   1. Calls assertBudgetAvailable() BEFORE the LLM extraction step.
 *      If the cap has been reached, the job is failed with
 *      code=BUDGET_EXCEEDED and no LLM call happens.
 *   2. On successful extraction, calls incrementBudgetUsage() with the
 *      actual spend estimate (inputTokens + outputTokens → €).
 *
 * Budget is scoped per-policy (which itself is per-tenant or platform).
 * Resetting the counter is a separate admin action — the cap is a hard
 * stop, not a soft warning.
 */
export declare class BudgetExceededError extends Error {
    readonly policyId: string;
    readonly capEur: number;
    readonly usedEur: number;
    constructor(policyId: string, capEur: number, usedEur: number);
}
export declare function assertBudgetAvailable(policyId: string, db?: Queryable): Promise<{
    capEur: number;
    usedEur: number;
    remainingEur: number;
}>;
/**
 * Rough cost model — each provider has its own per-1k-token pricing.
 * MVP uses conservative ballpark:
 *   OpenAI gpt-4o-mini: input $0.150 / output $0.600 per 1M tokens
 *   Anthropic Haiku 4.5: input $1.00 / output $5.00 per 1M tokens
 * Converted to EUR with 1:1 ratio for simplicity (MVP).
 */
export declare function estimateCostEur(providerCode: string, inputTokens: number, outputTokens: number): number;
export declare function incrementBudgetUsage(policyId: string, amountEur: number, db?: Queryable): Promise<number>;
//# sourceMappingURL=budget.d.ts.map