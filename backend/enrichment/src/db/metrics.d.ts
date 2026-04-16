import type { PoolClient } from 'pg';
import { pool } from './pool.js';
/**
 * SEE Fase 10 — tenant-scoped metrics aggregator.
 *
 * Returns counters the admin UI needs to show the operator how the
 * engine is performing for a given tenant: job counts by status,
 * total candidates, applied/rolled-back writes, cumulative LLM spend
 * vs policy budget cap, and a freshness-hit count (L2 cache reuses).
 *
 * The implementation uses pg's FILTER clause to do everything in a
 * single round-trip where possible.
 */
export interface EnrichmentMetrics {
    tenantId: string;
    generatedAt: string;
    jobs: {
        total: number;
        byStatus: Record<string, number>;
        lastCompletedAt: string | null;
    };
    candidates: {
        total: number;
        avgConfidence: number;
    };
    writes: {
        total: number;
        activeWrites: number;
        rolledBack: number;
        identityBlockedLast30d: number;
    };
    acquisition: {
        sourcesTotal: number;
        freshnessHits: number;
    };
    budget: {
        capEur: number;
        usedEur: number;
        remainingEur: number;
        percentUsed: number;
    };
}
export declare function getEnrichmentMetrics(tenantId: string, db?: PoolClient | typeof pool): Promise<EnrichmentMetrics>;
//# sourceMappingURL=metrics.d.ts.map