/**
 * Query helper utilities for safe row access and input parsing.
 */

import { Errors } from '../errors/factory.js';

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
export function firstRowOrThrow<T = Record<string, unknown>>(
  result: { rows: T[]; rowCount: number | null },
  entity: string,
  id?: string
): T {
  if (!result.rows[0]) {
    throw Errors.notFound(entity, id ?? 'unknown');
  }
  return result.rows[0];
}

/**
 * Extract the first row or return null (no throw).
 * Use for optional lookups where absence is expected.
 */
export function firstRowOrNull<T = Record<string, unknown>>(result: { rows: T[] }): T | null {
  return result.rows[0] ?? null;
}

/**
 * Safely parse an integer from a string query parameter.
 * Returns the fallback value if the input is missing, NaN, or out of range.
 *
 * @param val - The raw string value (typically from req.query)
 * @param opts - Configuration: min, max, fallback
 * @returns A validated integer within [min, max]
 */
export function safeParseInt(
  val: string | undefined | null,
  opts: { min?: number; max?: number; fallback: number }
): number {
  if (val === undefined || val === null || val === '') return opts.fallback;
  const n = parseInt(val, 10);
  if (isNaN(n)) return opts.fallback;
  if (opts.min !== undefined && n < opts.min) return opts.min;
  if (opts.max !== undefined && n > opts.max) return opts.max;
  return n;
}
