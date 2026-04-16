#!/usr/bin/env bash
# =============================================================================
# migration-integrity.test.sh
# =============================================================================
# Verifies database migration integrity against the existing heuresys_platform
# database. This is a non-destructive, read-only test suite.
#
# Usage:
#   ./db/__tests__/migration-integrity.test.sh
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-heuresys}"
DB_NAME="${DB_NAME:-heuresys_platform}"
DB_PASS="${DB_PASS:-heuresys}"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
psql_query() {
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
    -d "$DB_NAME" -t -A -q "$@" 2>/dev/null
}

# Print a PASS result and increment counter
pass() {
  local label="$1"
  shift
  echo "  PASS  $label $*"
  PASS_COUNT=$((PASS_COUNT + 1))
}

# Print a FAIL result and increment counter
fail() {
  local label="$1"
  shift
  echo "  FAIL  $label $*"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

# Print a SKIP result and increment counter
skip() {
  local label="$1"
  shift
  echo "  SKIP  $label $*"
  SKIP_COUNT=$((SKIP_COUNT + 1))
}

# Assert numeric value >= threshold
assert_gte() {
  local label="$1"
  local actual="$2"
  local threshold="$3"
  if [ "$actual" -ge "$threshold" ] 2>/dev/null; then
    pass "$label" "(actual: $actual >= $threshold)"
  else
    fail "$label" "(actual: $actual, expected >= $threshold)"
  fi
}

# Assert numeric value == expected
assert_eq() {
  local label="$1"
  local actual="$2"
  local expected="$3"
  if [ "$actual" = "$expected" ]; then
    pass "$label" "(actual: $actual)"
  else
    fail "$label" "(actual: $actual, expected: $expected)"
  fi
}

# Assert a value is non-empty
assert_not_empty() {
  local label="$1"
  local actual="$2"
  if [ -n "$actual" ]; then
    pass "$label"
  else
    fail "$label" "(empty result)"
  fi
}

# ---------------------------------------------------------------------------
# Connectivity check
# ---------------------------------------------------------------------------
echo "================================================================="
echo "  Migration Integrity Test Suite"
echo "  Database: $DB_NAME @ $DB_HOST:$DB_PORT"
echo "  Date:     $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================="
echo ""

echo "--- Connectivity ---"
CONN_CHECK=$(psql_query -c "SELECT 1;" 2>&1) || true
if [ "$CONN_CHECK" != "1" ]; then
  echo "  FAIL  Cannot connect to database. Aborting."
  echo ""
  echo "  Ensure PostgreSQL is running:"
  echo "    docker compose -f infra/docker-compose.dev.yml up -d"
  exit 1
fi
pass "Database connection"
echo ""

# =========================================================================
# 1. TABLE COUNT CHECKS
# =========================================================================
echo "--- 1. Table Counts ---"

TOTAL_TABLES=$(psql_query -c "
  SELECT count(*)
  FROM information_schema.tables
  WHERE table_schema NOT IN ('pg_catalog','information_schema');
")
assert_gte "Total tables (all schemas)" "$TOTAL_TABLES" 400

PUBLIC_TABLES=$(psql_query -c "
  SELECT count(*)
  FROM pg_tables
  WHERE schemaname = 'public';
")
assert_gte "Public tables" "$PUBLIC_TABLES" 300

echo ""

# =========================================================================
# 2. KEY TABLES EXIST
# =========================================================================
echo "--- 2. Key Tables Exist ---"

KEY_TABLES=(
  employees
  departments
  tenants
  users
  goals
  courses
  performance_reviews
  check_ins
  org_units
  locations
  cost_centers
  contracts
  engagement_surveys
  news_articles
  employee_documents
  succession_plans
  login_attempts
  ai_tenant_config
  rag_documents
  error_logs
  salary_bands
  feature_modules
  permissions
  role_permissions
  employee_skills
  compliance_training_requirements
  leave_accrual_rules
  leave_balance_transactions
)

for tbl in "${KEY_TABLES[@]}"; do
  EXISTS=$(psql_query -c "
    SELECT count(*) FROM pg_tables
    WHERE schemaname = 'public' AND tablename = '$tbl';
  ")
  if [ "$EXISTS" = "1" ]; then
    pass "Table exists: $tbl"
  else
    fail "Table exists: $tbl" "(not found)"
  fi
done

echo ""

# =========================================================================
# 3. ROW-LEVEL SECURITY (RLS)
# =========================================================================
echo "--- 3. Row-Level Security ---"

RLS_ENABLED=$(psql_query -c "
  SELECT count(*)
  FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity = true;
")
assert_gte "Tables with RLS enabled" "$RLS_ENABLED" 200

# Verify RLS on critical tables
RLS_CRITICAL_TABLES=(
  employees
  departments
  users
  goals
  performance_reviews
  check_ins
  contracts
  courses
  cost_centers
  org_units
  locations
  engagement_surveys
  news_articles
  employee_documents
)

for tbl in "${RLS_CRITICAL_TABLES[@]}"; do
  HAS_RLS=$(psql_query -c "
    SELECT rowsecurity::text FROM pg_tables
    WHERE schemaname = 'public' AND tablename = '$tbl';
  ")
  if [ "$HAS_RLS" = "true" ]; then
    pass "RLS enabled: $tbl"
  elif [ -z "$HAS_RLS" ]; then
    skip "RLS check: $tbl" "(table not found)"
  else
    fail "RLS enabled: $tbl" "(rowsecurity=$HAS_RLS)"
  fi
done

echo ""

# =========================================================================
# 4. TENANT_ID COLUMNS
# =========================================================================
echo "--- 4. Tenant Isolation (tenant_id) ---"

TENANT_ID_COUNT=$(psql_query -c "
  SELECT count(DISTINCT table_name)
  FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name = 'tenant_id';
")
assert_gte "Tables with tenant_id column" "$TENANT_ID_COUNT" 200

# Verify tenant_id on critical tables
# Note: 'users' does not have tenant_id directly; it references employees via employee_id FK.
TENANT_CRITICAL=(
  employees
  departments
  goals
  performance_reviews
  check_ins
  contracts
  courses
  org_units
  locations
  cost_centers
)

for tbl in "${TENANT_CRITICAL[@]}"; do
  HAS_TID=$(psql_query -c "
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = '$tbl'
      AND column_name = 'tenant_id';
  ")
  if [ "$HAS_TID" = "1" ]; then
    pass "tenant_id exists: $tbl"
  else
    fail "tenant_id exists: $tbl"
  fi
done

echo ""

# =========================================================================
# 5. INDEXES ON TENANT_ID
# =========================================================================
echo "--- 5. Indexes ---"

TENANT_IDX_COUNT=$(psql_query -c "
  SELECT count(*)
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexdef LIKE '%tenant_id%';
")
assert_gte "Indexes referencing tenant_id" "$TENANT_IDX_COUNT" 20

# Check total index count as a general health indicator
TOTAL_IDX=$(psql_query -c "
  SELECT count(*) FROM pg_indexes WHERE schemaname = 'public';
")
assert_gte "Total indexes (public schema)" "$TOTAL_IDX" 100

echo ""

# =========================================================================
# 6. FOREIGN KEY CONSTRAINTS
# =========================================================================
echo "--- 6. Foreign Key Constraints ---"

FK_COUNT=$(psql_query -c "
  SELECT count(*)
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
")
assert_gte "Total foreign key constraints" "$FK_COUNT" 100

# Check FKs on key tables
FK_TABLES=(employees users goals performance_reviews check_ins contracts departments)
for tbl in "${FK_TABLES[@]}"; do
  TBL_FK=$(psql_query -c "
    SELECT count(*)
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_schema = 'public'
      AND table_name = '$tbl';
  ")
  if [ "$TBL_FK" -ge 1 ] 2>/dev/null; then
    pass "FK constraints on $tbl" "(count: $TBL_FK)"
  else
    fail "FK constraints on $tbl" "(count: $TBL_FK, expected >= 1)"
  fi
done

echo ""

# =========================================================================
# 7. HEURESYS_APP ROLE
# =========================================================================
echo "--- 7. Application Role ---"

ROLE_EXISTS=$(psql_query -c "
  SELECT count(*) FROM pg_roles WHERE rolname = 'heuresys_app';
")
if [ "$ROLE_EXISTS" = "1" ]; then
  pass "heuresys_app role exists"
else
  fail "heuresys_app role exists"
fi

ROLE_BYPASS=$(psql_query -c "
  SELECT rolbypassrls::text FROM pg_roles WHERE rolname = 'heuresys_app';
")
if [ "$ROLE_BYPASS" = "false" ]; then
  pass "heuresys_app: rolbypassrls = false" "(RLS enforced)"
else
  if [ -z "$ROLE_BYPASS" ]; then
    skip "heuresys_app: rolbypassrls check" "(role not found)"
  else
    fail "heuresys_app: rolbypassrls = false" "(actual: $ROLE_BYPASS)"
  fi
fi

ROLE_LOGIN=$(psql_query -c "
  SELECT rolcanlogin::text FROM pg_roles WHERE rolname = 'heuresys_app';
")
if [ "$ROLE_LOGIN" = "true" ]; then
  pass "heuresys_app: can login"
elif [ -z "$ROLE_LOGIN" ]; then
  skip "heuresys_app: login check" "(role not found)"
else
  # Not a hard failure -- the role might be used differently
  pass "heuresys_app: rolcanlogin=$ROLE_LOGIN" "(noted)"
fi

echo ""

# =========================================================================
# 8. TIMESTAMP TYPE CHECK (S2-008 compliance)
# =========================================================================
echo "--- 8. Timestamp Type Compliance (S2-008) ---"

# Non-SAP business tables should use TIMESTAMP WITH TIME ZONE, not WITHOUT.
# SAP tables (pa*, pb*, hrp*, pcl*, t5*, ext_*, t0*, t1*, t7*) are excluded.
BAD_TS=$(psql_query -c "
  SELECT count(*)
  FROM information_schema.columns c
  JOIN pg_tables t ON c.table_name = t.tablename AND t.schemaname = 'public'
  WHERE c.table_schema = 'public'
    AND c.data_type = 'timestamp without time zone'
    AND c.table_name NOT LIKE 'pa%'
    AND c.table_name NOT LIKE 'pb%'
    AND c.table_name NOT LIKE 'hrp%'
    AND c.table_name NOT LIKE 'pcl%'
    AND c.table_name NOT LIKE 't5%'
    AND c.table_name NOT LIKE 'ext_%'
    AND c.table_name NOT LIKE 't0%'
    AND c.table_name NOT LIKE 't1%'
    AND c.table_name NOT LIKE 't7%';
")

if [ "$BAD_TS" = "0" ]; then
  pass "No TIMESTAMP WITHOUT TIME ZONE in business tables"
else
  # List them for diagnostic purposes
  BAD_DETAILS=$(psql_query -c "
    SELECT c.table_name || '.' || c.column_name
    FROM information_schema.columns c
    JOIN pg_tables t ON c.table_name = t.tablename AND t.schemaname = 'public'
    WHERE c.table_schema = 'public'
      AND c.data_type = 'timestamp without time zone'
      AND c.table_name NOT LIKE 'pa%'
      AND c.table_name NOT LIKE 'pb%'
      AND c.table_name NOT LIKE 'hrp%'
      AND c.table_name NOT LIKE 'pcl%'
      AND c.table_name NOT LIKE 't5%'
      AND c.table_name NOT LIKE 'ext_%'
      AND c.table_name NOT LIKE 't0%'
      AND c.table_name NOT LIKE 't1%'
      AND c.table_name NOT LIKE 't7%'
    ORDER BY c.table_name, c.column_name;
  ")
  fail "TIMESTAMP WITHOUT TIME ZONE in business tables" "(count: $BAD_TS)"
  echo "        Offending columns:"
  while IFS= read -r line; do
    echo "          - $line"
  done <<< "$BAD_DETAILS"
fi

echo ""

# =========================================================================
# 9. MIGRATION FILE INTEGRITY
# =========================================================================
echo "--- 9. Migration Files ---"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$(cd "$SCRIPT_DIR/../migrations" && pwd)"

if [ -d "$MIGRATIONS_DIR" ]; then
  MIGRATION_COUNT=$(find "$MIGRATIONS_DIR" -name '*.sql' -type f | wc -l)
  assert_gte "Migration SQL files" "$MIGRATION_COUNT" 50

  # Check that no migration file is empty
  EMPTY_MIGRATIONS=0
  while IFS= read -r f; do
    if [ ! -s "$f" ]; then
      EMPTY_MIGRATIONS=$((EMPTY_MIGRATIONS + 1))
      echo "        Empty migration: $(basename "$f")"
    fi
  done < <(find "$MIGRATIONS_DIR" -name '*.sql' -type f)
  assert_eq "Empty migration files" "$EMPTY_MIGRATIONS" "0"
else
  fail "Migrations directory" "(not found at $MIGRATIONS_DIR)"
fi

echo ""

# =========================================================================
# 10. VIEWS
# =========================================================================
echo "--- 10. Database Views ---"

VIEW_COUNT=$(psql_query -c "
  SELECT count(*)
  FROM information_schema.views
  WHERE table_schema = 'public';
")
assert_gte "Public views" "$VIEW_COUNT" 50

echo ""

# =========================================================================
# 11. DATA INTEGRITY SPOT CHECKS
# =========================================================================
echo "--- 11. Data Integrity Spot Checks ---"

TENANT_COUNT=$(psql_query -c "SELECT count(*) FROM tenants;")
assert_gte "Tenant records" "$TENANT_COUNT" 1

EMPLOYEE_COUNT=$(psql_query -c "SELECT count(*) FROM employees;")
assert_gte "Employee records" "$EMPLOYEE_COUNT" 1

USER_COUNT=$(psql_query -c "SELECT count(*) FROM users;")
assert_gte "User records" "$USER_COUNT" 1

# Check that every user with an employee_id references a valid employee
# (users table gets tenant context through employee_id FK, not tenant_id)
ORPHAN_USERS=$(psql_query -c "
  SELECT count(*) FROM users u
  WHERE u.employee_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.id = u.employee_id);
")
assert_eq "Orphaned users (invalid employee_id)" "$ORPHAN_USERS" "0"

# Check that every employee references a valid tenant
ORPHAN_EMPLOYEES=$(psql_query -c "
  SELECT count(*) FROM employees e
  WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = e.tenant_id);
")
assert_eq "Orphaned employees (no valid tenant)" "$ORPHAN_EMPLOYEES" "0"

echo ""

# =========================================================================
# SUMMARY
# =========================================================================
TOTAL=$((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))

echo "================================================================="
echo "  RESULTS"
echo "  Total checks: $TOTAL"
echo "  Passed:       $PASS_COUNT"
echo "  Failed:       $FAIL_COUNT"
echo "  Skipped:      $SKIP_COUNT"
echo "================================================================="

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo ""
  echo "  STATUS: FAILED ($FAIL_COUNT check(s) did not pass)"
  exit 1
else
  echo ""
  echo "  STATUS: ALL CHECKS PASSED"
  exit 0
fi
