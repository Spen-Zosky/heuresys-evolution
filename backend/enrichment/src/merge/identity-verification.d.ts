/**
 * SEE Fase 7.5 extended — strong identity pre-flight verification.
 *
 * Runs BEFORE the per-candidate strategy loop in commitJob. Checks a
 * small set of "strong identity" fields — those whose values uniquely
 * identify an entity in the real world:
 *   - vat_id          vs tenants.tax_id
 *   - website domain  vs tenants.verified_website
 *
 * Unlike checkEntityMismatch (which does fuzzy token overlap on each
 * match_key field individually), this pre-flight uses STRICT equality
 * and, crucially, blocks the ENTIRE job when it fails — not just the
 * offending field. Rationale: if the extracted vat_id does not match
 * the tenant's stored tax_id, every other candidate in the same
 * extraction is suspect because they all came from the same source
 * document.
 *
 * Pure module — takes the candidate set + current target row values +
 * tenant identity columns as explicit inputs. No DB access, fully
 * testable with node:test.
 */
export interface IdentityVerificationInput {
    /** extracted candidate values by field name */
    extractedValues: Record<string, unknown>;
    /** canonical domain from tenants.verified_website, or null */
    tenantVerifiedWebsite: string | null;
    /** tenants.tax_id value, or null */
    tenantTaxId: string | null;
    /** tenants.name as an extra sanity signal, or null */
    tenantName: string | null;
}
export interface IdentityBlock {
    field: string;
    reason: string;
    extracted: string;
    expected: string;
}
export interface IdentityVerificationResult {
    verified: boolean;
    blocks: IdentityBlock[];
    /** human-readable summary used in the commit response */
    summary: string;
}
/**
 * Normalises a VAT/tax-id for strict comparison: uppercase, strip all
 * non-alphanumeric characters (dots, spaces, hyphens that appear in some
 * national formats).
 */
declare function normaliseVatId(value: unknown): string | null;
/**
 * Normalises a legal name for comparison: lowercase, collapse whitespace,
 * strip legal-form suffixes (s.p.a., srl, ltd, gmbh, inc) and punctuation.
 */
declare function normaliseLegalName(value: unknown): string | null;
/**
 * Runs the strict pre-flight. Returns verified=false with a list of
 * blocks when any strong identity field conflicts with the stored
 * tenant identity. Fields that are absent from either side are
 * ignored — a missing VAT extracted value does NOT fail the check.
 */
export declare function verifyEntityIdentity(input: IdentityVerificationInput): IdentityVerificationResult;
export declare const __test: {
    normaliseVatId: typeof normaliseVatId;
    normaliseLegalName: typeof normaliseLegalName;
};
export {};
//# sourceMappingURL=identity-verification.d.ts.map