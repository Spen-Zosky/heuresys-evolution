import { pool } from '../db/pool.js';
import { deriveWebsiteDomain } from '../resolution/match-keys.js';
export async function loadTenantVerifiedWebsite(tenantId, db = pool) {
    const r = await db.query(`SELECT verified_website FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
    return r.rows[0]?.verified_website ?? null;
}
/**
 * Classifies a URL as either verified (authoritative) or unknown for the
 * given tenant. Runs the domain check against tenants.verified_website.
 * Note: this does NOT perform any HTTP call — it is a pure
 * string-comparison gate. Caller is responsible for passing the
 * already-canonicalised URL (post-redirect-follow) if needed.
 */
export async function classifySourceUrl(tenantId, url, db = pool) {
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
export function classifySourceUrlPure(url, verifiedWebsite) {
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
//# sourceMappingURL=verification.js.map