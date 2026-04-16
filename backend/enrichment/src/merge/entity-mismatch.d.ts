/**
 * SEE Fase 7.5 — entity anchor sanity check.
 *
 * Second line of defence after the source verification gate. Before
 * applying any candidate to the target row, cross-check the extracted
 * match-key values against the target row's existing values. If the
 * existing legal name is "RTL Bank" and the extracted legal name is
 * "RTL 102.5", the content we extracted is almost certainly NOT about
 * this tenant even if the submitter claimed it was.
 *
 * Uses a simple normalised-token-overlap score: we split each value
 * into lowercase alphanumeric tokens and compute
 *   overlap = |intersection| / |smaller set|
 * If the smaller set has length 0 we return 1.0 (no signal, caller
 * decides). Below MIN_OVERLAP the pair is declared a mismatch.
 *
 * This heuristic is intentionally cheap and deterministic. More
 * sophisticated entity resolution (embeddings, fuzzy string distance)
 * can plug in later — the caller shape stays the same.
 */
declare function tokenise(value: unknown): Set<string>;
export declare function tokenOverlap(a: unknown, b: unknown): number;
export interface EntityMismatchInput {
    fieldName: string;
    candidateValue: unknown;
    currentValue: unknown;
    /** set of match-key field names declared on the descriptor */
    matchKeyFields: string[];
}
export interface EntityMismatchResult {
    mismatch: boolean;
    overlap: number;
    reason: string;
}
/**
 * Decides whether a single candidate should be blocked by entity
 * mismatch. Only applies to fields that appear in match_keys — those
 * are the ones that define the entity's identity. Non-identity fields
 * (e.g. description) are not gated because they can legitimately change.
 *
 * If `currentValue` is empty the check passes through (overlap=1) —
 * nothing to mismatch against.
 */
export declare function checkEntityMismatch(input: EntityMismatchInput): EntityMismatchResult;
export declare const __test: {
    tokenise: typeof tokenise;
    MIN_OVERLAP: number;
};
export {};
//# sourceMappingURL=entity-mismatch.d.ts.map