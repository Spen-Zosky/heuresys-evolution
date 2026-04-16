/**
 * Pagination utility — standardized meta response format.
 */
/**
 * Build a standardized pagination meta object.
 */
export function buildMeta(total, limit, offset) {
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
export function capLimit(requestedLimit, defaultLimit = 100, maxLimit = MAX_LIST_LIMIT) {
    return Math.min(requestedLimit || defaultLimit, maxLimit);
}
//# sourceMappingURL=pagination.js.map