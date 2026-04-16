/**
 * Query helper utilities for safe row access and input parsing.
 */
/**
 * Extract the first row from a query result, or throw 404.
 * Eliminates the unsafe `result.rows[0]` pattern that returns undefined
 * when no rows match.
 *
 * @param result - pg QueryResult
 * @param entity - Human-readable entity name for the error message
 * @param id - The ID that was queried (for error context)
 * @returns The first row, guaranteed non-null
 * @throws NotFoundError if result has zero rows
 */
export declare function firstRowOrThrow<T = Record<string, unknown>>(result: {
    rows: T[];
    rowCount: number | null;
}, entity: string, id?: string): T;
/**
 * Extract the first row or return null (no throw).
 * Use for optional lookups where absence is expected.
 */
export declare function firstRowOrNull<T = Record<string, unknown>>(result: {
    rows: T[];
}): T | null;
/**
 * Safely parse an integer from a string query parameter.
 * Returns the fallback value if the input is missing, NaN, or out of range.
 *
 * @param val - The raw string value (typically from req.query)
 * @param opts - Configuration: min, max, fallback
 * @returns A validated integer within [min, max]
 */
export declare function safeParseInt(val: string | undefined | null, opts: {
    min?: number;
    max?: number;
    fallback: number;
}): number;
//# sourceMappingURL=query-helpers.d.ts.map