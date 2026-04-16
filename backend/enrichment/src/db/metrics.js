import { pool } from './pool.js';
export async function getEnrichmentMetrics(tenantId, db = pool) {
    const generatedAt = new Date().toISOString();
    // ---- jobs ----
    const jobsRes = await db.query(`SELECT status,
            COUNT(*)::text AS c,
            MAX(completed_at)::text AS last_completed
       FROM enrichment_jobs
      WHERE tenant_id = $1
      GROUP BY status`, [tenantId]);
    const byStatus = {};
    let jobsTotal = 0;
    let lastCompletedAt = null;
    for (const r of jobsRes.rows) {
        const n = Number(r.c);
        byStatus[r.status] = n;
        jobsTotal += n;
        if (r.last_completed && (!lastCompletedAt || r.last_completed > lastCompletedAt)) {
            lastCompletedAt = r.last_completed;
        }
    }
    // ---- candidates ----
    const candRes = await db.query(`SELECT COUNT(*)::text AS c,
            AVG(confidence)::text AS avg_conf
       FROM enrichment_candidates
      WHERE tenant_id = $1`, [tenantId]);
    const candidateTotal = Number(candRes.rows[0]?.c ?? 0);
    const avgConfidence = Number(candRes.rows[0]?.avg_conf ?? 0);
    // ---- writes (L4 ledger) ----
    const writesRes = await db.query(`SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE rolled_back_at IS NULL)::text AS active,
            COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL)::text AS rolled
       FROM enrichment_writes
      WHERE tenant_id = $1`, [tenantId]);
    const writesTotal = Number(writesRes.rows[0]?.total ?? 0);
    const writesActive = Number(writesRes.rows[0]?.active ?? 0);
    const writesRolled = Number(writesRes.rows[0]?.rolled ?? 0);
    // ---- identity-block events (last 30d, from enrichment_job_events)
    const identityBlockRes = await db.query(`SELECT COUNT(*)::text AS c
       FROM enrichment_job_events
      WHERE tenant_id = $1
        AND event_type IN ('identity.blocked', 'identity_pre_flight_block', 'budget.exceeded')
        AND created_at > NOW() - INTERVAL '30 days'`, [tenantId]);
    const identityBlockedLast30d = Number(identityBlockRes.rows[0]?.c ?? 0);
    // ---- acquisition / freshness hits ----
    const srcRes = await db.query(`SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE discovered_via = 'l2_cache')::text AS l2
       FROM enrichment_sources
      WHERE tenant_id = $1`, [tenantId]);
    const sourcesTotal = Number(srcRes.rows[0]?.total ?? 0);
    const freshnessHits = Number(srcRes.rows[0]?.l2 ?? 0);
    // ---- budget ----
    const policyRes = await db.query(`SELECT
       COALESCE(SUM(p.budget_cap_eur), 0)::text AS cap,
       COALESCE(SUM(p.current_usage_eur), 0)::text AS used
     FROM enrichment_merge_policies p
     WHERE p.tenant_id = $1 OR p.tenant_id IS NULL`, [tenantId]);
    const capEur = Number(policyRes.rows[0]?.cap ?? 0);
    const usedEur = Number(policyRes.rows[0]?.used ?? 0);
    const remainingEur = Math.max(capEur - usedEur, 0);
    const percentUsed = capEur > 0 ? Math.min(Math.round((usedEur / capEur) * 100), 100) : 0;
    return {
        tenantId,
        generatedAt,
        jobs: {
            total: jobsTotal,
            byStatus,
            lastCompletedAt,
        },
        candidates: {
            total: candidateTotal,
            avgConfidence: Math.round(avgConfidence * 100) / 100,
        },
        writes: {
            total: writesTotal,
            activeWrites: writesActive,
            rolledBack: writesRolled,
            identityBlockedLast30d,
        },
        acquisition: {
            sourcesTotal,
            freshnessHits,
        },
        budget: {
            capEur,
            usedEur,
            remainingEur,
            percentUsed,
        },
    };
}
//# sourceMappingURL=metrics.js.map