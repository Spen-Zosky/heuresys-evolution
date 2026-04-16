import { pool } from './pool.js';
/**
 * Look up the platform-level trust score for a given source_type.
 * Falls back to the "unknown" rule (0.10) if the source_type is not registered.
 *
 * Note: deliberately scoped to platform rules (tenant_id IS NULL) for now.
 * Tenant-specific overrides can be layered on in a follow-up slice.
 */
export async function getTrustScoreForSourceType(sourceType) {
    const result = await pool.query(`SELECT trust_score::text
       FROM enrichment_trust_rules
      WHERE tenant_id IS NULL
        AND source_type = $1
        AND domain_pattern IS NULL
      LIMIT 1`, [sourceType]);
    if (result.rows.length > 0) {
        return Number(result.rows[0].trust_score);
    }
    const fallback = await pool.query(`SELECT trust_score::text
       FROM enrichment_trust_rules
      WHERE tenant_id IS NULL AND source_type = 'unknown'
      LIMIT 1`);
    return fallback.rows.length > 0 ? Number(fallback.rows[0].trust_score) : 0.1;
}
//# sourceMappingURL=trust-rules.js.map