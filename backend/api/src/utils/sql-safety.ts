/**
 * SQL Safety Utilities
 *
 * Validates dynamic table names and column identifiers against strict allowlists
 * to prevent SQL injection via dynamic interpolation in queries.
 *
 * Security Task: S1-007
 * @date 2026-02-03
 */

// =============================================================================
// TABLE NAME ALLOWLIST
// =============================================================================

/**
 * Complete set of tables that may be dynamically referenced in SQL queries.
 * Any table name interpolated into a query string MUST be validated against this set.
 *
 * Organized by service/domain:
 *
 * SAP Migration targets:
 *   employees, contracts, departments, org_units, locations, cost_centers
 *
 * SAP Migration lookup tables:
 *   departments, org_units, locations, cost_centers, job_templates
 *
 * Embedding Queue entity tables:
 *   employees, departments, org_units, locations, performance_reviews,
 *   check_ins, feedback_360, skill_gap_analyses, career_paths,
 *   learning_paths, recruiting_candidates
 *
 * Cross-Entity Embedding tables:
 *   esco_skills, esco_occupations, job_templates, courses, goals,
 *   industry_classifications (levels 1-6)
 *
 * Dashboard Widget query tables:
 *   employees, departments, goals, performance_reviews, courses,
 *   enrollments, requisitions, candidates, leave_requests, surveys,
 *   recognition, check_ins
 */
const ALLOWED_TABLES: ReadonlySet<string> = new Set([
  // Core HR tables (SAP migration targets + general use)
  'employees',
  'contracts',
  'departments',
  'org_units',
  'locations',
  'cost_centers',

  // Performance & Development
  'performance_reviews',
  'check_ins',
  'feedback_360',
  'goals',
  'skill_gap_analyses',
  'career_paths',
  'learning_paths',
  'courses',
  'enrollments',

  // Recruiting
  'recruiting_candidates',
  'candidates',
  'requisitions',

  // Leave & Surveys
  'leave_requests',
  'surveys',
  'recognition',

  // ESCO Ontology
  'esco_skills',
  'esco_occupations',

  // Job Templates
  'job_templates',

  // Industry Classification (Enterprise Taxonomy)
  'industry_classifications',
  'industry_profiles',
  'company_sizes',
  'tenant_industry_classifications',
  'occupation_industry_classifications',
]);

/**
 * Validates that a table name is in the allowed list.
 * Prevents SQL injection via dynamic table name interpolation.
 *
 * @param tableName - The table name to validate
 * @param context - Descriptive context for the error message (e.g. "SAPMigration.rollback")
 * @returns The validated table name (unchanged)
 * @throws Error if the table name is not in the allowlist
 */
export function validateTableName(tableName: string, context: string): string {
  if (!ALLOWED_TABLES.has(tableName)) {
    throw new Error(
      `[SQL_SAFETY] Invalid table name '${tableName}' in ${context}. ` +
        `Table is not in the allowlist. This may indicate a configuration error or an injection attempt.`
    );
  }
  return tableName;
}

// =============================================================================
// COLUMN IDENTIFIER VALIDATION
// =============================================================================

/**
 * Pattern for valid SQL identifiers: lowercase letters and underscores,
 * starting with a letter or underscore.
 * This covers standard PostgreSQL unquoted identifier rules.
 */
const ALLOWED_IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/;

/**
 * Validates that a SQL identifier (column name, alias, etc.) matches the safe pattern.
 * Prevents SQL injection via dynamic column name interpolation.
 *
 * @param identifier - The identifier to validate
 * @param context - Descriptive context for the error message
 * @returns The validated identifier (unchanged)
 * @throws Error if the identifier does not match the safe pattern
 */
export function validateIdentifier(identifier: string, context: string): string {
  if (!ALLOWED_IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(
      `[SQL_SAFETY] Invalid SQL identifier '${identifier}' in ${context}. ` +
        `Identifiers must match pattern: ${ALLOWED_IDENTIFIER_PATTERN.source}`
    );
  }
  return identifier;
}

// =============================================================================
// COLUMN NAME ALLOWLIST (for known column interpolation patterns)
// =============================================================================

/**
 * Set of column names that may be dynamically selected in embedding/ontology queries.
 * These are language-variant columns that switch between _en and _it suffixes.
 */
const ALLOWED_EMBEDDING_COLUMNS: ReadonlySet<string> = new Set([
  // Embedding columns
  'embedding',
  'embedding_en',
  'embedding_it',

  // Label columns (ESCO)
  'preferred_label_en',
  'preferred_label_it',

  // Description columns (ESCO)
  'description_en',
  'description_it',

  // NACE name columns
  'name_en',
  'name_it',

  // Job template columns
  'title_en',
  'title_it',

  // Course columns
  'title',
  'description',
]);

/**
 * Validates that a column name used in embedding/semantic queries is allowed.
 *
 * @param columnName - The column name to validate
 * @param context - Descriptive context for the error message
 * @returns The validated column name (unchanged)
 * @throws Error if the column name is not in the allowlist
 */
export function validateEmbeddingColumn(columnName: string, context: string): string {
  if (!ALLOWED_EMBEDDING_COLUMNS.has(columnName)) {
    throw new Error(
      `[SQL_SAFETY] Invalid embedding column '${columnName}' in ${context}. ` +
        `Column is not in the allowlist.`
    );
  }
  return columnName;
}

// =============================================================================
// ILIKE PATTERN ESCAPING
// =============================================================================

/**
 * Escapes special characters in ILIKE patterns.
 * PostgreSQL ILIKE treats %, _, and \ as special pattern characters:
 *   % - matches any sequence of characters
 *   _ - matches any single character
 *   \ - escape character
 *
 * Without escaping, user input containing these characters can cause
 * unexpected search results or performance issues.
 *
 * The escaped value should still be passed through parameterized queries
 * ($1, $2, etc.) -- this function handles pattern-level escaping only,
 * not SQL injection prevention.
 *
 * Security Task: S1-009
 * @param input - The raw user search input
 * @returns The input with ILIKE special characters escaped
 */
export function escapeILIKE(input: string): string {
  return input
    .replace(/\\/g, '\\\\') // Must be first (escape the escape char)
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}
