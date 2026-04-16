/**
 * useApi Hook - Generic data fetching hook
 *
 * Features:
 * - Loading state management
 * - Error handling
 * - Automatic refetch
 * - Request cancellation
 * - Cache support (optional)
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiClientError, NetworkError } from '../api';

interface UseApiState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
}

interface UseApiOptions {
  /** Skip initial fetch */
  skip?: boolean;
  /** Refetch interval in ms */
  refetchInterval?: number;
  /** Dependencies that trigger refetch */
  deps?: unknown[];
  /** Callback on success */
  onSuccess?: (data: unknown) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

interface UseApiReturn<T> extends UseApiState<T> {
  /** Manually trigger refetch */
  refetch: () => Promise<void>;
  /** Mutate data locally */
  mutate: (data: T | ((prev: T | null) => T)) => void;
}

/**
 * Generic hook for API data fetching
 */
export function useApi<T>(fetcher: () => Promise<T>, options: UseApiOptions = {}): UseApiReturn<T> {
  const { skip = false, refetchInterval, deps = [], onSuccess, onError } = options;

  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    isLoading: !skip,
    isValidating: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(
    async (isRefetch = false) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setState((prev) => ({
        ...prev,
        isLoading: !isRefetch && prev.data === null,
        isValidating: isRefetch,
        error: null,
      }));

      try {
        const data = await fetcher();

        if (mountedRef.current) {
          setState({
            data,
            error: null,
            isLoading: false,
            isValidating: false,
          });
          onSuccess?.(data);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return; // Request was cancelled
        }

        if (mountedRef.current) {
          const err = error as Error;
          setState((prev) => ({
            ...prev,
            error: err,
            isLoading: false,
            isValidating: false,
          }));
          onError?.(err);
        }
      }
    },
    [fetcher, onSuccess, onError]
  );

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  const mutate = useCallback((data: T | ((prev: T | null) => T)) => {
    setState((prev) => ({
      ...prev,
      data: typeof data === 'function' ? (data as (prev: T | null) => T)(prev.data) : data,
    }));
  }, []);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (!skip) {
      fetchData();
    }

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is a user-provided array, cannot be statically analyzed
  }, [skip, ...deps]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || skip) return;

    const intervalId = setInterval(() => {
      if (mountedRef.current) {
        fetchData(true);
      }
    }, refetchInterval);

    return () => clearInterval(intervalId);
  }, [refetchInterval, skip, fetchData]);

  return {
    ...state,
    refetch,
    mutate,
  };
}

/**
 * Hook for mutations (POST, PUT, DELETE)
 */
export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>
) {
  const [state, setState] = useState<{
    data: TData | null;
    error: Error | null;
    isLoading: boolean;
  }>({
    data: null,
    error: null,
    isLoading: false,
  });

  const mutate = useCallback(
    async (
      variables: TVariables,
      options?: {
        onSuccess?: (data: TData) => void;
        onError?: (error: Error) => void;
      }
    ) => {
      setState({ data: null, error: null, isLoading: true });

      try {
        const data = await mutationFn(variables);
        setState({ data, error: null, isLoading: false });
        options?.onSuccess?.(data);
        return data;
      } catch (error) {
        const err = error as Error;
        setState({ data: null, error: err, isLoading: false });
        options?.onError?.(err);
        throw err;
      }
    },
    [mutationFn]
  );

  const reset = useCallback(() => {
    setState({ data: null, error: null, isLoading: false });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}

/**
 * Format API error for display
 */
export function formatApiError(error: Error | null): string {
  if (!error) return '';

  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof NetworkError) {
    return 'Errore di connessione. Verifica la tua connessione internet.';
  }

  return error.message || 'Si è verificato un errore. Riprova.';
}

/**
 * Check if error is a specific type
 */
export function isNetworkError(error: Error | null): boolean {
  return error instanceof NetworkError;
}

export function isAuthError(error: Error | null): boolean {
  return error instanceof ApiClientError && error.status === 401;
}

export function isNotFoundError(error: Error | null): boolean {
  return error instanceof ApiClientError && error.status === 404;
}

export function isForbiddenError(error: Error | null): boolean {
  return error instanceof ApiClientError && error.status === 403;
}
