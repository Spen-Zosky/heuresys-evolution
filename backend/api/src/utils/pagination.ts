/**
 * Pagination utility — standardized meta response format.
 */

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Build a standardized pagination meta object.
 */
export function buildMeta(total: number, limit: number, offset: number): PaginationMeta {
  return {
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

/**
 * Maximum limit for standard list endpoints.
 */
export const MAX_LIST_LIMIT = 200;

/**
 * Maximum limit for export endpoints.
 */
export const MAX_EXPORT_LIMIT = 200;

/**
 * Cap a limit value to the maximum allowed.
 */
export function capLimit(
  requestedLimit: number | undefined,
  defaultLimit = 100,
  maxLimit = MAX_LIST_LIMIT
): number {
  return Math.min(requestedLimit || defaultLimit, maxLimit);
}
