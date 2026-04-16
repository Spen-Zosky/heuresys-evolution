/**
 * SEE Fase 6 — match key resolver.
 *
 * Given the `match_keys` array declared on an enrichment_entity_descriptor
 * and the set of candidate field values extracted by the LLM, returns:
 *   - entityAnchor: a canonical string that uniquely identifies the entity
 *     (used as entity_anchor on enrichment_candidates and as the lookup
 *     key for L4 write idempotency)
 *   - matchedVia: which match_key produced the anchor
 *   - strength: confidence of the match in [0,1]
 *
 * Strategy:
 *   - Iterate match_keys in the order declared on the descriptor (highest
 *     priority first). For tenant_profile this is typically
 *     ['vat_id','website_domain','legal_name']. Stop at the first match
 *     that is non-empty.
 *   - For `website_domain` specifically, derive it from the `website` URL
 *     by extracting the host and stripping leading 'www.' — this mirrors
 *     how a human would compare two companies that share a domain.
 *   - Match strength decays with position: the first match_key is 0.95,
 *     the second 0.85, the third 0.75, etc. If no match_keys produce a
 *     value we fall back to the literal target_record_id with strength 0.5
 *     so the downstream pipeline always has an anchor to write under.
 */
export interface MatchKeyResult {
    entityAnchor: string;
    matchedVia: string | null;
    strength: number;
}
/**
 * Returns the canonical domain for a URL-like string. Strips protocol,
 * port, path, query, fragment, and any leading 'www.'. Returns null when
 * the input is not a parseable URL.
 */
export declare function deriveWebsiteDomain(value: unknown): string | null;
export declare function resolveMatchKey(matchKeys: string[], extracted: Record<string, unknown>, fallbackTargetRecordId: string): MatchKeyResult;
//# sourceMappingURL=match-keys.d.ts.map