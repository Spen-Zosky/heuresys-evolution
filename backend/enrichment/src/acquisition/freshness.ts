import type { PoolClient } from 'pg';
import { withTenantClient } from '../db/pool.js';
import { logger } from '../lib/logger.js';

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
export async function findFreshSnapshot(
  client: PoolClient,
  tenantId: string,
  canonicalUrl: string,
  freshnessDays: number,
): Promise<FreshSnapshot | null> {
  const result = await client.query<{
    source_id: string;
    snapshot_id: string;
    content_markdown: string;
    http_status: number | null;
    bytes_size: number | null;
    crawler_used: string;
    retrieved_at: Date;
    language: string | null;
  }>(
    `SELECT s.id AS source_id,
            ss.id AS snapshot_id,
            ss.content_markdown,
            ss.http_status,
            ss.bytes_size,
            ss.crawler_used,
            ss.retrieved_at,
            s.language
       FROM enrichment_sources s
       JOIN enrichment_source_snapshots ss ON ss.source_id = s.id
      WHERE s.tenant_id = $1
        AND ss.tenant_id = $1
        AND s.canonical_url = $2
        AND ss.retrieved_at >= NOW() - ($3::int || ' days')::interval
        AND ss.content_markdown IS NOT NULL
      ORDER BY ss.retrieved_at DESC
      LIMIT 1`,
    [tenantId, canonicalUrl, freshnessDays],
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0]!;
  const ageHours = Math.round((Date.now() - new Date(row.retrieved_at).getTime()) / 3600_000);
  return {
    sourceId: row.source_id,
    snapshotId: row.snapshot_id,
    markdown: row.content_markdown,
    httpStatus: row.http_status ?? 200,
    bytesSize: row.bytes_size ?? Buffer.byteLength(row.content_markdown, 'utf8'),
    crawlerUsed: row.crawler_used,
    language: row.language ?? 'en',
    retrievedAt: new Date(row.retrieved_at),
    ageHours,
  };
}

/**
 * Convenience wrapper for callers that don't already hold a PoolClient.
 */
export async function findFreshSnapshotForTenant(
  tenantId: string,
  canonicalUrl: string,
  freshnessDays: number,
): Promise<FreshSnapshot | null> {
  return withTenantClient(tenantId, (client) =>
    findFreshSnapshot(client, tenantId, canonicalUrl, freshnessDays),
  );
}

export function logFreshnessHit(canonicalUrl: string, fresh: FreshSnapshot): void {
  logger.info(
    {
      url: canonicalUrl,
      source_id: fresh.sourceId,
      snapshot_id: fresh.snapshotId,
      age_hours: fresh.ageHours,
      bytes: fresh.bytesSize,
      crawler: fresh.crawlerUsed,
    },
    'L2 freshness hit — reusing cached snapshot',
  );
}
