import { createHash } from 'node:crypto';
import { pool } from './pool.js';
function canonicalize(value) {
    if (value === null || value === undefined)
        return 'null';
    if (typeof value === 'string')
        return value.trim().toLowerCase();
    return JSON.stringify(value);
}
export function computeFactHash(input) {
    const canonical = [
        input.entityType,
        input.entityAnchor ?? '',
        input.fieldName,
        canonicalize(input.candidateValue),
        input.sourceUrl,
    ].join('|');
    return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
export async function insertCandidate(input, db = pool) {
    const factHash = computeFactHash(input);
    const result = await db.query(`INSERT INTO enrichment_candidates
       (tenant_id, job_id, source_snapshot_id, entity_type, entity_anchor,
        field_name, candidate_value, confidence, extraction_method,
        llm_provider_code, fact_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (tenant_id, fact_hash) DO NOTHING
     RETURNING id`, [
        input.tenantId,
        input.jobId,
        input.snapshotId,
        input.entityType,
        input.entityAnchor,
        input.fieldName,
        JSON.stringify(input.candidateValue),
        input.confidence,
        input.extractionMethod,
        input.llmProviderCode,
        factHash,
    ]);
    if (result.rows.length > 0) {
        return { id: result.rows[0].id, factHash, isNew: true };
    }
    const existing = await db.query(`SELECT id FROM enrichment_candidates
      WHERE tenant_id = $1 AND fact_hash = $2
      LIMIT 1`, [input.tenantId, factHash]);
    return { id: existing.rows[0].id, factHash, isNew: false };
}
//# sourceMappingURL=candidates.js.map