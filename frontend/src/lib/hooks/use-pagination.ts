'use client';

import { useState, useCallback, useMemo } from 'react';

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

interface UsePaginationOptions {
  /** Initial page (1-based). Default: 1 */
  initialPage?: number;
  /** Items per page. Default: 20 */
  initialPageSize?: number;
  /** Maximum page size allowed. Default: 100 */
  maxPageSize?: number;
}

interface UsePaginationReturn extends PaginationState {
  /** Calculated offset for API queries */
  offset: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPreviousPage: boolean;
  /** Go to a specific page */
  goToPage: (page: number) => void;
  /** Go to next page */
  nextPage: () => void;
  /** Go to previous page */
  previousPage: () => void;
  /** Change page size (resets to page 1) */
  setPageSize: (size: number) => void;
  /** Update total count (typically from API response) */
  setTotal: (total: number) => void;
  /** Reset to first page */
  resetPage: () => void;
  /** Query params object ready for API calls */
  queryParams: { limit: number; offset: number };
}

/**
 * usePagination - Manage pagination state for list views.
 *
 * @example
 * const pagination = usePagination({ initialPageSize: 25 });
 *
 * const { data } = useApi(() =>
 *   api.employees.list(pagination.queryParams),
 *   { deps: [pagination.page, pagination.pageSize] }
 * );
 *
 * useEffect(() => {
 *   if (data?.meta?.total) pagination.setTotal(data.meta.total);
 * }, [data]);
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { initialPage = 1, initialPageSize = 20, maxPageSize = 100 } = options;

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  const goToPage = useCallback(
    (p: number) => setPage(Math.max(1, Math.min(p, totalPages))),
    [totalPages]
  );

  const nextPage = useCallback(() => {
    if (hasNextPage) setPage((p) => p + 1);
  }, [hasNextPage]);

  const previousPage = useCallback(() => {
    if (hasPreviousPage) setPage((p) => p - 1);
  }, [hasPreviousPage]);

  const setPageSize = useCallback(
    (size: number) => {
      setPageSizeState(Math.max(1, Math.min(size, maxPageSize)));
      setPage(1); // Reset to first page on size change
    },
    [maxPageSize]
  );

  const resetPage = useCallback(() => setPage(1), []);

  const queryParams = useMemo(() => ({ limit: pageSize, offset }), [pageSize, offset]);

  return {
    page,
    pageSize,
    total,
    offset,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    goToPage,
    nextPage,
    previousPage,
    setPageSize,
    setTotal,
    resetPage,
    queryParams,
  };
}
