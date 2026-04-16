/**
 * SQL Safety Utilities
 *
 * Validates dynamic table names and column identifiers against strict allowlists
 * to prevent SQL injection via dynamic interpolation in queries.
 *
 * Security Task: S1-007
 * @date 2026-02-03
 */
/**
 * Validates that a table name is in the allowed list.
 * Prevents SQL injection via dynamic table name interpolation.
 *
 * @param tableName - The table name to validate
 * @param context - Descriptive context for the error message (e.g. "SAPMigration.rollback")
 * @returns The validated table name (unchanged)
 * @throws Error if the table name is not in the allowlist
 */
export declare function validateTableName(tableName: string, context: string): string;
/**
 * Validates that a SQL identifier (column name, alias, etc.) matches the safe pattern.
 * Prevents SQL injection via dynamic column name interpolation.
 *
 * @param identifier - The identifier to validate
 * @param context - Descriptive context for the error message
 * @returns The validated identifier (unchanged)
 * @throws Error if the identifier does not match the safe pattern
 */
export declare function validateIdentifier(identifier: string, context: string): string;
/**
 * Validates that a column name used in embedding/semantic queries is allowed.
 *
 * @param columnName - The column name to validate
 * @param context - Descriptive context for the error message
 * @returns The validated column name (unchanged)
 * @throws Error if the column name is not in the allowlist
 */
export declare function validateEmbeddingColumn(columnName: string, context: string): string;
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
export declare function escapeILIKE(input: string): string;
//# sourceMappingURL=sql-safety.d.ts.map