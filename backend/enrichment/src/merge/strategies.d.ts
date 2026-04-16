import type { FieldStrategy } from './policies.js';
/**
 * SEE Fase 7 — per-field merge strategies.
 *
 * Each strategy is a pure decision function: given the candidate value,
 * the current value on the target row, the candidate confidence, and the
 * source trust score, it returns a MergeDecision:
 *   - apply: boolean → should we UPDATE the target column?
 *   - newValue: the value to write (may differ from candidate.value, e.g.
 *     for append strategies)
 *   - reason: short string explaining the decision (logged + audit)
 *
 * The strategies never mutate their inputs. The apply engine runs this
 * in a tight loop and batches UPDATEs per target_record_id.
 */
export interface MergeDecisionInput {
    strategy: FieldStrategy;
    fieldName: string;
    candidateValue: unknown;
    currentValue: unknown;
    confidence: number;
    trustScore: number;
    /** policy top-level mode — 'merge' auto-applies, 'suggest' previews only */
    policyMode: 'suggest' | 'merge' | 'observe';
    /** operator explicitly approved this candidate via the commit endpoint */
    operatorApproved: boolean;
}
export interface MergeDecision {
    apply: boolean;
    newValue: unknown;
    reason: string;
}
/**
 * Decides what to do with a single candidate for a single field.
 */
export declare function decideMerge(input: MergeDecisionInput): MergeDecision;
//# sourceMappingURL=strategies.d.ts.map