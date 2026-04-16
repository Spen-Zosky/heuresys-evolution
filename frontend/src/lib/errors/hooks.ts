'use client';

/**
 * Heuresys Error Hooks
 *
 * Hook personalizzati per la gestione di operazioni async con error handling.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useError } from './context';
import { AppError, ApiErrorResponse, FrontendErrorCodes } from './types';
import {
  createAppError,
  fromApiError,
  fromFetchError,
  isApiErrorResponse,
  CreateErrorOptions,
} from './factory';

/**
 * Stato di un'operazione async
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
  isSuccess: boolean;
  isError: boolean;
}

/**
 * Opzioni per useAsync
 */
export interface UseAsyncOptions<T> {
  /**
   * Valore iniziale dei dati
   */
  initialData?: T | null;

  /**
   * Esegui automaticamente al mount
   */
  immediate?: boolean;

  /**
   * Callback su successo
   */
  onSuccess?: (data: T) => void;

  /**
   * Callback su errore
   */
  onError?: (error: AppError) => void;

  /**
   * Mostra toast automaticamente
   */
  showErrorToast?: boolean;

  /**
   * Contesto per l'errore
   */
  context?: CreateErrorOptions['context'];

  /**
   * Numero massimo di retry automatici
   */
  maxRetries?: number;

  /**
   * Delay tra retry (ms)
   */
  retryDelay?: number;
}

/**
 * Hook per gestire operazioni async con error handling
 */
export function useAsync<T, Args extends unknown[] = []>(
  asyncFn: (...args: Args) => Promise<T>,
  options: UseAsyncOptions<T> = {}
) {
  const {
    initialData = null,
    immediate = false,
    onSuccess,
    onError,
    showErrorToast = true,
    context,
    maxRetries = 0,
    retryDelay = 1000,
  } = options;

  const { addError } = useError();
  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    loading: immediate,
    error: null,
    isSuccess: false,
    isError: false,
  });

  const retryCount = useRef(0);
  const abortController = useRef<AbortController | null>(null);
  const lastArgs = useRef<Args | null>(null);

  /**
   * Esegue l'operazione async
   */
  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      // Cancella eventuali richieste precedenti
      abortController.current?.abort();
      abortController.current = new AbortController();

      lastArgs.current = args;

      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        isSuccess: false,
        isError: false,
      }));

      try {
        const data = await asyncFn(...args);

        // Verifica se è una risposta API di errore
        if (isApiErrorResponse(data)) {
          throw data;
        }

        setState({
          data,
          loading: false,
          error: null,
          isSuccess: true,
          isError: false,
        });

        onSuccess?.(data);
        retryCount.current = 0;

        return data;
      } catch (error) {
        // Ignora errori di abort
        if (error instanceof Error && error.name === 'AbortError') {
          return null;
        }

        let appError: AppError;

        if (isApiErrorResponse(error)) {
          appError = fromApiError(error as ApiErrorResponse, context);
        } else if (error instanceof Error) {
          appError = fromFetchError(error, undefined, context);
        } else {
          appError = createAppError({
            code: FrontendErrorCodes.API_ERROR,
            message: String(error),
            context,
          });
        }

        // Retry automatico se abilitato
        if (appError.retryable && retryCount.current < maxRetries) {
          retryCount.current++;
          await new Promise((resolve) => setTimeout(resolve, retryDelay * retryCount.current));
          return execute(...args);
        }

        setState({
          data: null,
          loading: false,
          error: appError,
          isSuccess: false,
          isError: true,
        });

        if (showErrorToast) {
          addError(appError);
        }

        onError?.(appError);

        return null;
      }
    },
    [asyncFn, onSuccess, onError, showErrorToast, context, maxRetries, retryDelay, addError]
  );

  /**
   * Reset dello stato
   */
  const reset = useCallback(() => {
    abortController.current?.abort();
    setState({
      data: initialData,
      loading: false,
      error: null,
      isSuccess: false,
      isError: false,
    });
    retryCount.current = 0;
  }, [initialData]);

  /**
   * Retry manuale
   */

  const executeRef = useRef(execute);
  executeRef.current = execute;

  const retry = useCallback(() => {
    if (lastArgs.current) {
      return execute(...lastArgs.current);
    }
    return Promise.resolve(null);
  }, [execute]);

  /**
   * Esecuzione immediata se richiesto
   */
  useEffect(() => {
    if (immediate) {
      executeRef.current(...([] as unknown as Args));
    }
    return () => {
      abortController.current?.abort();
    };
  }, [immediate]);

  return {
    ...state,
    execute,
    reset,
    retry,
  };
}

/**
 * Hook semplificato per fetch di dati
 */
export function useFetch<T>(url: string, options?: RequestInit & UseAsyncOptions<T>) {
  const {
    showErrorToast,
    context,
    onSuccess,
    onError,
    immediate = true,
    ...fetchOptions
  } = options || {};

  const fetchFn = useCallback(async () => {
    const tenantCode =
      typeof window !== 'undefined' ? localStorage.getItem('heuresys_tenant') : null;

    const response = await fetch(url, {
      ...fetchOptions,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(tenantCode ? { 'X-Tenant-Code': tenantCode } : {}),
        ...fetchOptions?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      if (isApiErrorResponse(errorData)) {
        throw errorData;
      }
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();

    if (isApiErrorResponse(data)) {
      throw data;
    }

    // Estrai data dalla risposta API standard
    if ('success' in data && data.success && 'data' in data) {
      return data.data as T;
    }

    return data as T;
  }, [url, fetchOptions]);

  return useAsync(fetchFn, {
    immediate,
    showErrorToast,
    context,
    onSuccess,
    onError,
  });
}

/**
 * Hook per mutazioni (POST, PUT, DELETE)
 */
export function useMutation<T, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<T>,
  options?: UseAsyncOptions<T> & {
    successMessage?: string;
  }
) {
  const { successMessage, onSuccess, ...asyncOptions } = options || {};
  const { showSuccess } = useError();

  const handleSuccess = useCallback(
    (data: T) => {
      if (successMessage) {
        showSuccess(successMessage);
      }
      onSuccess?.(data);
    },
    [successMessage, showSuccess, onSuccess]
  );

  const { execute, ...rest } = useAsync(mutationFn, {
    ...asyncOptions,
    immediate: false,
    onSuccess: handleSuccess,
  });

  return {
    ...rest,
    mutate: execute,
    mutateAsync: execute,
  };
}

/**
 * Hook per polling con error handling
 */
export function usePolling<T>(
  asyncFn: () => Promise<T>,
  interval: number,
  options?: UseAsyncOptions<T> & {
    enabled?: boolean;
    stopOnError?: boolean;
  }
) {
  const { enabled = true, stopOnError = false, ...asyncOptions } = options || {};
  const { execute, error, ...rest } = useAsync(asyncFn, {
    ...asyncOptions,
    immediate: enabled,
  });

  useEffect(() => {
    if (!enabled) return;
    if (stopOnError && error) return;

    const id = setInterval(() => {
      execute();
    }, interval);

    return () => clearInterval(id);
  }, [enabled, interval, execute, error, stopOnError]);

  return { ...rest, error, refresh: execute };
}

/**
 * Hook per gestire form con validazione
 */
export interface UseFormOptions<T> {
  initialValues: T;
  validate?: (values: T) => Record<keyof T, string | undefined> | null;
  onSubmit: (values: T) => Promise<void>;
  onSuccess?: () => void;
  onError?: (error: AppError) => void;
}

export function useForm<T extends Record<string, unknown>>({
  initialValues,
  validate,
  onSubmit,
  onSuccess,
  onError,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const {
    execute,
    loading,
    error: submitError,
  } = useAsync(onSubmit, {
    showErrorToast: true,
    onSuccess,
    onError,
  });

  const handleChange = useCallback((field: keyof T, value: unknown) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear error when field changes
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const handleBlur = useCallback(
    (field: keyof T) => {
      setTouched((prev) => ({ ...prev, [field]: true }));

      // Validate single field
      if (validate) {
        const allErrors = validate(values);
        if (allErrors && allErrors[field]) {
          setErrors((prev) => ({ ...prev, [field]: allErrors[field] }));
        }
      }
    },
    [values, validate]
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      // Validate all fields
      if (validate) {
        const allErrors = validate(values);
        if (allErrors && Object.values(allErrors).some(Boolean)) {
          setErrors(allErrors as Partial<Record<keyof T, string>>);
          // Mark all fields as touched
          setTouched(
            Object.keys(values).reduce(
              (acc, key) => ({ ...acc, [key]: true }),
              {} as Partial<Record<keyof T, boolean>>
            )
          );
          return;
        }
      }

      await execute(values);
    },
    [values, validate, execute]
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    loading,
    submitError,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setValues,
    setErrors,
  };
}
