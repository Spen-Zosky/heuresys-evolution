import { deriveWebsiteDomain } from '../resolution/match-keys.js';

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
function normaliseVatId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Normalises a legal name for comparison: lowercase, collapse whitespace,
 * strip legal-form suffixes (s.p.a., srl, ltd, gmbh, inc) and punctuation.
 */
function normaliseLegalName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const lowered = value
    .toLowerCase()
    .replace(/[\.,']/g, ' ')
    .replace(/\b(s\s*p\s*a|s\s*r\s*l|s\s*a\s*s|s\s*n\s*c|ltd|limited|gmbh|inc|corp|corporation|bv|nv|llc|ag)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return lowered.length > 0 ? lowered : null;
}

/**
 * Runs the strict pre-flight. Returns verified=false with a list of
 * blocks when any strong identity field conflicts with the stored
 * tenant identity. Fields that are absent from either side are
 * ignored — a missing VAT extracted value does NOT fail the check.
 */
export function verifyEntityIdentity(
  input: IdentityVerificationInput,
): IdentityVerificationResult {
  const blocks: IdentityBlock[] = [];

  // ---- vat_id strict equality -----------------------------------------
  const extractedVat = normaliseVatId(input.extractedValues['vat_id']);
  const tenantVat = normaliseVatId(input.tenantTaxId);
  if (extractedVat && tenantVat && extractedVat !== tenantVat) {
    blocks.push({
      field: 'vat_id',
      reason: 'strict identity fail: extracted vat_id differs from tenants.tax_id',
      extracted: extractedVat,
      expected: tenantVat,
    });
  }

  // ---- website domain strict equality --------------------------------
  const websiteValue = input.extractedValues['website'];
  const extractedDomain = deriveWebsiteDomain(websiteValue);
  const tenantDomain = input.tenantVerifiedWebsite
    ? input.tenantVerifiedWebsite.trim().toLowerCase()
    : null;
  if (extractedDomain && tenantDomain && extractedDomain !== tenantDomain) {
    blocks.push({
      field: 'website',
      reason: 'strict identity fail: extracted website domain differs from tenants.verified_website',
      extracted: extractedDomain,
      expected: tenantDomain,
    });
  }

  // ---- legal_name normalised equality --------------------------------
  // Weaker than vat/domain — only blocks when BOTH values are present and
  // their normalised forms are completely unrelated. Helps catch cases
  // where vat_id and website are both missing but the name itself is
  // obviously different (e.g. "Banca Popolare" vs "Acme Spa").
  const extractedName = normaliseLegalName(input.extractedValues['legal_name']);
  const tenantNameN = normaliseLegalName(input.tenantName);
  if (extractedName && tenantNameN && extractedName !== tenantNameN) {
    // Tokenise post-normalisation and check NO token overlap at all.
    const a = new Set(extractedName.split(/\s+/).filter((t) => t.length >= 3));
    const b = new Set(tenantNameN.split(/\s+/).filter((t) => t.length >= 3));
    let shared = 0;
    for (const t of a) if (b.has(t)) shared++;
    if (shared === 0 && a.size > 0 && b.size > 0) {
      blocks.push({
        field: 'legal_name',
        reason: 'strict identity fail: extracted legal_name has zero token overlap with tenants.name',
        extracted: extractedName,
        expected: tenantNameN,
      });
    }
  }

  if (blocks.length === 0) {
    return {
      verified: true,
      blocks: [],
      summary: 'identity verification passed',
    };
  }

  const summary = `identity verification FAILED: ${blocks
    .map((b) => `${b.field} (${b.extracted} != ${b.expected})`)
    .join('; ')}`;
  return {
    verified: false,
    blocks,
    summary,
  };
}

export const __test = { normaliseVatId, normaliseLegalName };
