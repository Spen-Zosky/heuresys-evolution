import type { PoolClient } from 'pg';
export interface FreshSnapshot {
    sourceId: string;
    snapshotId: string;
    markdown: string;
    httpStatus: number;
    bytesSize: number;
    crawlerUsed: string;
    language: string;
    retrievedAt: Date;
    ageHours: number;
}
/**
 * SEE Fase 6 — L2 freshness window reuse.
 *
 * Before hitting Firecrawl, look up the most recent snapshot for
 * (tenant_id, canonical_url) and return it if it was retrieved within
 * `freshnessDays`. This saves Firecrawl credits on every re-run of a job
 * for the same seed URL and discovery path — the L1 idempotency key on
 * enrichment_jobs already dedupes entire job payloads, but this L2 layer
 * catches the case where a new job with a different semantic_scope reuses
 * the same URL (e.g. different target_record_id, same public website).
 *
 * Returns null when no fresh snapshot exists. Caller must still persist a
 * brand-new enrichment_sources row referencing the existing snapshot so
 * the job lineage is tracked.
 */
export declare function findFreshSnapshot(client: PoolClient, tenantId: string, canonicalUrl: string, freshnessDays: number): Promise<FreshSnapshot | null>;
/**
 * Convenience wrapper for callers that don't already hold a PoolClient.
 */
export declare function findFreshSnapshotForTenant(tenantId: string, canonicalUrl: string, freshnessDays: number): Promise<FreshSnapshot | null>;
export declare function logFreshnessHit(canonicalUrl: string, fresh: FreshSnapshot): void;
//# sourceMappingURL=freshness.d.ts.map