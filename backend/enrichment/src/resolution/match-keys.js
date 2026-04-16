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
/**
 * Returns the canonical domain for a URL-like string. Strips protocol,
 * port, path, query, fragment, and any leading 'www.'. Returns null when
 * the input is not a parseable URL.
 */
export function deriveWebsiteDomain(value) {
    if (typeof value !== 'string' || value.length === 0)
        return null;
    let raw = value.trim();
    if (!/^https?:\/\//i.test(raw))
        raw = `https://${raw}`;
    try {
        const u = new URL(raw);
        return u.hostname.replace(/^www\./i, '').toLowerCase();
    }
    catch {
        return null;
    }
}
/**
 * Normalises a candidate value for comparison:
 *   - strings: trim + lowercase (or uppercase for vat-style fields)
 *   - numbers: String()
 *   - null/undefined/empty-string: null
 */
function canonicalise(key, value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value !== 'string') {
        const s = String(value);
        return s.length === 0 ? null : s;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0)
        return null;
    // VAT and country codes are uppercase; everything else is lowercased so
    // "Acme S.p.A." and "ACME S.p.A." land on the same anchor.
    if (/vat|tax_id|country/i.test(key))
        return trimmed.toUpperCase();
    return trimmed.toLowerCase();
}
export function resolveMatchKey(matchKeys, extracted, fallbackTargetRecordId) {
    for (let i = 0; i < matchKeys.length; i++) {
        const key = matchKeys[i];
        let value;
        if (key === 'website_domain') {
            // website_domain is a derived key — the extraction schema still
            // emits `website`, we compute the domain here.
            value = deriveWebsiteDomain(extracted.website);
        }
        else {
            value = extracted[key];
        }
        const canon = canonicalise(key, value);
        if (canon) {
            const strength = Math.max(0.95 - i * 0.1, 0.5);
            return {
                entityAnchor: `${key}:${canon}`,
                matchedVia: key,
                strength,
            };
        }
    }
    return {
        entityAnchor: fallbackTargetRecordId,
        matchedVia: null,
        strength: 0.5,
    };
}
//# sourceMappingURL=match-keys.js.map