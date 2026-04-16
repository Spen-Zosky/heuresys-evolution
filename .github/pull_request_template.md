## What

<!-- One-sentence summary of the change. -->

## Why

<!-- Motivation. Link to issue / decision / spec. -->
Closes #

## Change type

- [ ] feat (new capability)
- [ ] fix (bug fix)
- [ ] chore (infra, tooling, housekeeping)
- [ ] docs
- [ ] refactor (no behavior change)
- [ ] test
- [ ] perf

## How to test

- [ ] Step 1
- [ ] Step 2

## Checklist

- [ ] Conventional Commit title (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`)
- [ ] Tests added / updated (`npm test`)
- [ ] Lint & typecheck pass locally (`npm run lint`, `npm run typecheck`)
- [ ] No secrets committed (verified with `gitleaks detect`)
- [ ] No hardcoded IPs / hostnames (use env vars)
- [ ] CI green

## Heuresys-specific impact

- [ ] **RBP impact**: new/changed permissions, roles, or scope rules
  - If yes, link SOT update: `docs/RBP_PERMISSIONS_SOURCE_OF_TRUTH.md`
- [ ] **DB migration**: schema change, new table, RLS policy
  - If yes, backup taken before apply (`backup-manual.sh <label>`)
- [ ] **Docker compose**: change to `docker-compose*.yml` or volumes
  - If yes, used `dc` wrapper (not raw `docker compose`)
- [ ] **Breaking API change**: request/response shape, auth contract
  - If yes, documented in commit body with `BREAKING CHANGE:` footer

## Deploy notes

<!-- Anything ops needs to know: env vars, migrations, feature flags, rollback plan. -->
