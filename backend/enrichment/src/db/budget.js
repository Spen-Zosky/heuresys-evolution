import { pool } from './pool.js';
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
export class BudgetExceededError extends Error {
    policyId;
    capEur;
    usedEur;
    constructor(policyId, capEur, usedEur) {
        super(`Budget cap exceeded for policy ${policyId}: €${usedEur.toFixed(4)} / €${capEur.toFixed(2)}`);
        this.name = 'BudgetExceededError';
        this.policyId = policyId;
        this.capEur = capEur;
        this.usedEur = usedEur;
    }
}
export async function assertBudgetAvailable(policyId, db = pool) {
    const result = await db.query(`SELECT id,
            budget_cap_eur::text AS cap,
            current_usage_eur::text AS used
       FROM enrichment_merge_policies
      WHERE id = $1
      LIMIT 1`, [policyId]);
    if (result.rows.length === 0) {
        throw new Error(`enrichment_merge_policies row not found: ${policyId}`);
    }
    const row = result.rows[0];
    const capEur = Number(row.cap);
    const usedEur = Number(row.used);
    if (usedEur >= capEur) {
        throw new BudgetExceededError(policyId, capEur, usedEur);
    }
    return { capEur, usedEur, remainingEur: capEur - usedEur };
}
/**
 * Rough cost model — each provider has its own per-1k-token pricing.
 * MVP uses conservative ballpark:
 *   OpenAI gpt-4o-mini: input $0.150 / output $0.600 per 1M tokens
 *   Anthropic Haiku 4.5: input $1.00 / output $5.00 per 1M tokens
 * Converted to EUR with 1:1 ratio for simplicity (MVP).
 */
export function estimateCostEur(providerCode, inputTokens, outputTokens) {
    const lc = providerCode.toLowerCase();
    let inputPerM = 0.15;
    let outputPerM = 0.6;
    if (lc === 'anthropic') {
        inputPerM = 1.0;
        outputPerM = 5.0;
    }
    else if (lc === 'gemini') {
        inputPerM = 0.075;
        outputPerM = 0.30;
    }
    const cost = (inputTokens / 1_000_000) * inputPerM + (outputTokens / 1_000_000) * outputPerM;
    return Math.round(cost * 1_000_000) / 1_000_000;
}
export async function incrementBudgetUsage(policyId, amountEur, db = pool) {
    if (amountEur <= 0)
        return 0;
    const result = await db.query(`UPDATE enrichment_merge_policies
        SET current_usage_eur = current_usage_eur + $2,
            updated_at = NOW()
      WHERE id = $1
    RETURNING current_usage_eur::text AS used`, [policyId, amountEur.toFixed(6)]);
    return Number(result.rows[0]?.used ?? 0);
}
//# sourceMappingURL=budget.js.map