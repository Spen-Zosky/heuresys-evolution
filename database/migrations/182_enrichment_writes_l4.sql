-- Migration 182: enrichment_writes table (SEE Fase 6 — L4 idempotency)
--
-- Tracks facts that have been committed into the real business tables by
-- the enrichment engine's merge layer (Fase 7). Each row represents one
-- field value applied to one target record under one policy — re-applying
-- the same fact (same fact_hash) is a no-op via the unique constraint,
-- so the commit path can be safely retried end-to-end.
--
-- The table is write-once by design: rollback is modelled as a separate
-- rolled_back_at timestamp, never a DELETE. This lets audit queries
-- reconstruct "what did we write and when" across the lifetime of the
-- tenant.

CREATE TABLE IF NOT EXISTS enrichment_writes (
    id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_id             uuid NOT NULL REFERENCES enrichment_jobs(id) ON DELETE RESTRICT,
    candidate_id       uuid REFERENCES enrichment_candidates(id) ON DELETE SET NULL,
    entity_name        varchar(100) NOT NULL,
    target_table       varchar(100) NOT NULL,
    target_record_id   text         NOT NULL,
    entity_anchor      varchar(500) NOT NULL,
    field_name         varchar(100) NOT NULL,
    written_value      jsonb        NOT NULL,
    previous_value     jsonb,
    fact_hash          char(64)     NOT NULL,
    committed_at       timestamptz  NOT NULL DEFAULT NOW(),
    committed_by_job   uuid         NOT NULL,
    rolled_back_at     timestamptz,
    rolled_back_by     uuid REFERENCES enrichment_jobs(id) ON DELETE SET NULL,
    CONSTRAINT enrichment_writes_unique_fact
      UNIQUE (tenant_id, target_table, target_record_id, field_name, fact_hash)
);

CREATE INDEX IF NOT EXISTS idx_enrichment_writes_target
    ON enrichment_writes (tenant_id, target_table, target_record_id);

CREATE INDEX IF NOT EXISTS idx_enrichment_writes_job
    ON enrichment_writes (job_id);

CREATE INDEX IF NOT EXISTS idx_enrichment_writes_anchor
    ON enrichment_writes (tenant_id, entity_anchor);

-- RLS: tenant isolation. committed_by_job + rolled_back_by are NOT FK to
-- users because enrichment jobs may run as the system user.
ALTER TABLE enrichment_writes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enrichment_writes_tenant_policy ON enrichment_writes;
CREATE POLICY enrichment_writes_tenant_policy ON enrichment_writes
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE enrichment_writes IS
'SEE Fase 6 — L4 write idempotency ledger. Unique on (tenant,target_table,target_record_id,field_name,fact_hash) so re-applying an identical fact is a no-op. Rollback is modelled via rolled_back_at/by, never DELETE.';
