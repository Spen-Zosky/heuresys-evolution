-- Migration 196: Registry for canonical demo users (env-driven)
--
-- Creates the `canonical_demo_users` table. The table is POPULATED out-of-band
-- by scripts/apply-canonical-users.sh (which reads username/hash values from
-- .env — never hardcoded in SQL). Seeds and other code reference this table
-- via subquery instead of hardcoding username lists.
--
-- See docs/DEMO_CREDENTIALS.md for the full spec.

BEGIN;

CREATE TABLE IF NOT EXISTS canonical_demo_users (
  role        VARCHAR(50) PRIMARY KEY,
  username    VARCHAR(100) NOT NULL UNIQUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE canonical_demo_users IS
  'Registry of stable demo users per RBP role. Populated from .env by scripts/apply-canonical-users.sh. Do not INSERT/UPDATE manually.';

COMMIT;
