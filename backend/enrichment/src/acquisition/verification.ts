import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import { deriveWebsiteDomain } from '../resolution/match-keys.js';

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

export type SourceClassification =
  | {
      verified: true;
      sourceType: 'official_website';
      trustScore: 1.0;
      matchedDomain: string;
      reason: 'domain matches tenants.verified_website';
    }
  | {
      verified: false;
      sourceType: 'unknown';
      trustScore: 0.1;
      matchedDomain: string | null;
      reason: string;
    };

interface TenantVerificationRow {
  verified_website: string | null;
}

export async function loadTenantVerifiedWebsite(
  tenantId: string,
  db: PoolClient | typeof pool = pool,
): Promise<string | null> {
  const r = await db.query<TenantVerificationRow>(
    `SELECT verified_website FROM tenants WHERE id = $1 LIMIT 1`,
    [tenantId],
  );
  return r.rows[0]?.verified_website ?? null;
}

/**
 * Classifies a URL as either verified (authoritative) or unknown for the
 * given tenant. Runs the domain check against tenants.verified_website.
 * Note: this does NOT perform any HTTP call — it is a pure
 * string-comparison gate. Caller is responsible for passing the
 * already-canonicalised URL (post-redirect-follow) if needed.
 */
export async function classifySourceUrl(
  tenantId: string,
  url: string,
  db: PoolClient | typeof pool = pool,
): Promise<SourceClassification> {
  const derived = deriveWebsiteDomain(url);
  if (!derived) {
    return {
      verified: false,
      sourceType: 'unknown',
      trustScore: 0.1,
      matchedDomain: null,
      reason: 'unable to derive domain from URL',
    };
  }
  const verifiedWebsite = await loadTenantVerifiedWebsite(tenantId, db);
  if (!verifiedWebsite) {
    return {
      verified: false,
      sourceType: 'unknown',
      trustScore: 0.1,
      matchedDomain: derived,
      reason: 'tenants.verified_website not set — cannot classify as official',
    };
  }
  const stored = verifiedWebsite.trim().toLowerCase();
  if (derived === stored) {
    return {
      verified: true,
      sourceType: 'official_website',
      trustScore: 1.0,
      matchedDomain: derived,
      reason: 'domain matches tenants.verified_website',
    };
  }
  return {
    verified: false,
    sourceType: 'unknown',
    trustScore: 0.1,
    matchedDomain: derived,
    reason: `domain ${derived} does not match verified_website ${stored}`,
  };
}

/**
 * Pure version used by unit tests: same logic but takes the stored
 * verified_website as an explicit argument so no DB is needed.
 */
export function classifySourceUrlPure(
  url: string,
  verifiedWebsite: string | null,
): SourceClassification {
  const derived = deriveWebsiteDomain(url);
  if (!derived) {
    return {
      verified: false,
      sourceType: 'unknown',
      trustScore: 0.1,
      matchedDomain: null,
      reason: 'unable to derive domain from URL',
    };
  }
  if (!verifiedWebsite) {
    return {
      verified: false,
      sourceType: 'unknown',
      trustScore: 0.1,
      matchedDomain: derived,
      reason: 'tenants.verified_website not set — cannot classify as official',
    };
  }
  const stored = verifiedWebsite.trim().toLowerCase();
  if (derived === stored) {
    return {
      verified: true,
      sourceType: 'official_website',
      trustScore: 1.0,
      matchedDomain: derived,
      reason: 'domain matches tenants.verified_website',
    };
  }
  return {
    verified: false,
    sourceType: 'unknown',
    trustScore: 0.1,
    matchedDomain: derived,
    reason: `domain ${derived} does not match verified_website ${stored}`,
  };
}
