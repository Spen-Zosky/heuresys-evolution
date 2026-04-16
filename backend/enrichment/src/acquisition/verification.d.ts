import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
/**
 * SEE Fase 7.5 — source verification gate.
 *
 * Given a seed URL and a target tenant, determines whether the URL
 * genuinely represents that tenant's official website. The result drives
 * the source_type / trust_score classification downstream:
 *
 *   verified=true  → source_type='official_website', trust_score=1.00
 *   verified=false → source_type='unknown',          trust_score=0.10
 *
 * The verification source of truth is tenants.verified_website — the
 * canonical domain captured at onboarding. A URL is verified iff its
 * derived domain (via deriveWebsiteDomain) equals the stored value.
 *
 * This module exists because Fase 7's merge engine would otherwise
 * trust any submitter-supplied URL at face value (see the rtl.it/
 * rtl-bank incident recorded in migration 183).
 */
export type SourceClassification = {
    verified: true;
    sourceType: 'official_website';
    trustScore: 1.0;
    matchedDomain: string;
    reason: 'domain matches tenants.verified_website';
} | {
    verified: false;
    sourceType: 'unknown';
    trustScore: 0.1;
    matchedDomain: string | null;
    reason: string;
};
export declare function loadTenantVerifiedWebsite(tenantId: string, db?: PoolClient | typeof pool): Promise<string | null>;
/**
 * Classifies a URL as either verified (authoritative) or unknown for the
 * given tenant. Runs the domain check against tenants.verified_website.
 * Note: this does NOT perform any HTTP call — it is a pure
 * string-comparison gate. Caller is responsible for passing the
 * already-canonicalised URL (post-redirect-follow) if needed.
 */
export declare function classifySourceUrl(tenantId: string, url: string, db?: PoolClient | typeof pool): Promise<SourceClassification>;
/**
 * Pure version used by unit tests: same logic but takes the stored
 * verified_website as an explicit argument so no DB is needed.
 */
export declare function classifySourceUrlPure(url: string, verifiedWebsite: string | null): SourceClassification;
//# sourceMappingURL=verification.d.ts.map