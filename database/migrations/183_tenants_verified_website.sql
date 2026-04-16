-- Migration 183: tenants.verified_website (SEE Fase 7.5 — source verification gate)
--
-- Addresses a conceptual flaw in Fase 7: the merge layer trusted any URL
-- passed to POST /api/v1/jobs as the target tenant's "official_website"
-- with trust_score=1.00. Live smoke on 2026-04-12 applied facts extracted
-- from https://www.rtl.it (RTL 102.5 radio, no relation to the fictional
-- RTL Bank test tenant) to the rtl-bank record, writing legal_name="RTL
-- 102.5" before the operator caught it and rolled back.
--
-- Fix: every tenant_profile enrichment job's seed URL is now cross-checked
-- against this column. Only URLs whose canonical host matches
-- verified_website get source_type='official_website' with trust_score=1.00.
-- Everything else is downgraded to source_type='unknown' with trust_score=0.10,
-- which the merge strategies (authoritative_only / update_if_empty_or_verified)
-- will then refuse to apply.
--
-- Format: canonical domain without scheme, without leading www., lowercase.
-- Examples: "rtl-bank.example", "acme.com", "enel.it"
-- NULL means "no verification set yet" → no URL can ever be trusted as
-- official for this tenant.

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS verified_website varchar(255);

COMMENT ON COLUMN tenants.verified_website IS
'SEE Fase 7.5 — canonical domain (lowercase, no scheme, no www) used by the enrichment source verification gate. Set during onboarding. NULL blocks all official_website source classification for this tenant.';

CREATE INDEX IF NOT EXISTS idx_tenants_verified_website
    ON tenants (verified_website)
    WHERE verified_website IS NOT NULL;

-- Intentionally NOT backfilled. rtl-bank etc. stay NULL so the first
-- post-migration enrichment job correctly fails open (blocks the commit
-- instead of silently applying unverified data). Onboarding flow / admin
-- UI will populate this column going forward.
