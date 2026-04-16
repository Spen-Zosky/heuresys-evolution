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
export declare function buildMeta(total: number, limit: number, offset: number): PaginationMeta;
/**
 * Maximum limit for standard list endpoints.
 */
export declare const MAX_LIST_LIMIT = 200;
/**
 * Maximum limit for export endpoints.
 */
export declare const MAX_EXPORT_LIMIT = 200;
/**
 * Cap a limit value to the maximum allowed.
 */
export declare function capLimit(requestedLimit: number | undefined, defaultLimit?: number, maxLimit?: number): number;
//# sourceMappingURL=pagination.d.ts.map