#!/usr/bin/env bash
# SEE Fase 2 — smoke test for the enrichment engine jobs API.
#
# Usage:
#   scripts/smoke.sh                          # uses rtl-bank + https://www.rtl.it/
#   TENANT_CODE=smartfood scripts/smoke.sh
#   URL=https://example.com scripts/smoke.sh
#   BASE_URL=http://your-host:8020 scripts/smoke.sh   # remote
#
# The script:
#   1. resolves the tenant UUID from `tenants.code`
#   2. POST /api/v1/jobs → expects 202 queued or 200 cached
#   3. polls GET /api/v1/jobs/:id until terminal status or 60s timeout
#   4. exits 0 on previewing/committed/cached, non-zero otherwise
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8020}"
TENANT_CODE="${TENANT_CODE:-rtl-bank}"
ENTITY_NAME="${ENTITY_NAME:-tenant_profile}"
URL="${URL:-https://www.rtl.it/}"
POLL_TIMEOUT="${POLL_TIMEOUT:-60}"
POLL_INTERVAL="${POLL_INTERVAL:-2}"

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required" >&2
  exit 2
fi

DB_CONTAINER="${DB_CONTAINER:-heuresys_evo_platform_db}"
DB_USER="${DB_USER:-heuresys}"
DB_NAME="${DB_NAME:-heuresys_platform}"

TENANT_ID=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT id FROM tenants WHERE code='$TENANT_CODE' LIMIT 1")
if [[ -z "$TENANT_ID" ]]; then
  echo "error: tenant code '$TENANT_CODE' not found in $DB_NAME" >&2
  exit 3
fi
echo "tenant $TENANT_CODE = $TENANT_ID"

# 1. health
HEALTH=$(curl -sS "$BASE_URL/health")
echo "health: $HEALTH"
echo "$HEALTH" | jq -e '.data.status == "ok"' >/dev/null

# 2. create job
echo
echo "POST $BASE_URL/api/v1/jobs"
CREATE=$(curl -sS -X POST "$BASE_URL/api/v1/jobs" \
  -H "content-type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d "$(jq -n --arg en "$ENTITY_NAME" --arg trid "$TENANT_ID" --arg url "$URL" \
    '{entity_name: $en, target_record_id: $trid, url: $url}')")
echo "$CREATE" | jq .

JOB_ID=$(echo "$CREATE" | jq -r '.data.jobId // empty')
CACHED=$(echo "$CREATE" | jq -r '.data.cached // false')
if [[ -z "$JOB_ID" ]]; then
  echo "error: no jobId in response" >&2
  exit 4
fi

if [[ "$CACHED" == "true" ]]; then
  echo "job was cached — exiting with success"
  exit 0
fi

# 3. poll
echo
echo "polling $BASE_URL/api/v1/jobs/$JOB_ID (timeout ${POLL_TIMEOUT}s)"
DEADLINE=$(( $(date +%s) + POLL_TIMEOUT ))
while true; do
  STATUS_RESP=$(curl -sS "$BASE_URL/api/v1/jobs/$JOB_ID" -H "x-tenant-id: $TENANT_ID")
  STATUS=$(echo "$STATUS_RESP" | jq -r '.data.status // "unknown"')
  printf '  status=%s\n' "$STATUS"
  case "$STATUS" in
    previewing|committed|cached)
      echo "terminal success: $STATUS"
      echo "$STATUS_RESP" | jq .
      exit 0
      ;;
    failed|rolled_back)
      echo "terminal failure: $STATUS"
      echo "$STATUS_RESP" | jq .
      exit 5
      ;;
  esac
  if (( $(date +%s) > DEADLINE )); then
    echo "error: poll timeout after ${POLL_TIMEOUT}s, last status=$STATUS" >&2
    exit 6
  fi
  sleep "$POLL_INTERVAL"
done
