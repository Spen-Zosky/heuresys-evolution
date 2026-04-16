'use client';

/**
 * Heuresys Error Context
 *
 * Context React per la gestione centralizzata degli errori.
 * Fornisce stato globale degli errori e metodi per gestirli.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { AppError, ErrorState, ErrorAction } from './types';
import {
  createAppError,
  fromApiError,
  fromNativeError,
  isApiErrorResponse,
  requiresReauth,
  isCritical,
  formatErrorForLog,
  CreateErrorOptions,
} from './factory';

/**
 * Stato iniziale
 */
const initialState: ErrorState = {
  errors: [],
  lastError: null,
  hasErrors: false,
  hasCriticalError: false,
};

/**
 * Reducer per gestire lo stato degli errori
 */
function errorReducer(state: ErrorState, action: ErrorAction): ErrorState {
  switch (action.type) {
    case 'ADD_ERROR': {
      const newErrors = [...state.errors, action.payload];
      return {
        errors: newErrors,
        lastError: action.payload,
        hasErrors: true,
        hasCriticalError: newErrors.some((e) => e.severity === 'CRITICAL' && !e.dismissed),
      };
    }
    case 'DISMISS_ERROR': {
      const newErrors = state.errors.map((e) =>
        e.id === action.payload ? { ...e, dismissed: true } : e
      );
      return {
        ...state,
        errors: newErrors,
        hasErrors: newErrors.some((e) => !e.dismissed),
        hasCriticalError: newErrors.some((e) => e.severity === 'CRITICAL' && !e.dismissed),
      };
    }
    case 'DISMISS_ALL': {
      return {
        ...state,
        errors: state.errors.map((e) => ({ ...e, dismissed: true })),
        hasErrors: false,
        hasCriticalError: false,
      };
    }
    case 'CLEAR_ERRORS': {
      return initialState;
    }
    default:
      return state;
  }
}

/**
 * Tipo del context
 */
interface ErrorContextType {
  state: ErrorState;
  addError: (error: AppError | Error | unknown) => AppError;
  dismissError: (id: string) => void;
  dismissAll: () => void;
  clearErrors: () => void;
  showError: (options: CreateErrorOptions | string) => void;
  showSuccess: (message: string, description?: string) => void;
  showWarning: (message: string, description?: string) => void;
  showInfo: (message: string, description?: string) => void;
}

/**
 * Context
 */
const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

/**
 * Opzioni del provider
 */
interface ErrorProviderProps {
  children: React.ReactNode;
  onError?: (error: AppError) => void;
  onCriticalError?: (error: AppError) => void;
  enableToasts?: boolean;
  logErrors?: boolean;
}

/**
 * Provider per la gestione errori
 */
export function ErrorProvider({
  children,
  onError,
  onCriticalError,
  enableToasts = true,
  logErrors = true,
}: ErrorProviderProps) {
  const [state, dispatch] = useReducer(errorReducer, initialState);

  /**
   * Mostra un toast in base alla severità
   */
  const showToast = useCallback(
    (error: AppError) => {
      if (!enableToasts) return;

      const toastOptions = {
        description: error.suggestion,
        duration: error.severity === 'CRITICAL' ? Infinity : 5000,
        action: error.retryable
          ? {
              label: 'Riprova',
              onClick: () => {
                // Il componente che ha causato l'errore deve gestire il retry
                window.dispatchEvent(
                  new CustomEvent('heuresys:retry-error', {
                    detail: { errorId: error.id },
                  })
                );
              },
            }
          : undefined,
      };

      switch (error.severity) {
        case 'CRITICAL':
          toast.error(error.userMessage, toastOptions);
          break;
        case 'ERROR':
          toast.error(error.userMessage, toastOptions);
          break;
        case 'WARNING':
          toast.warning(error.userMessage, toastOptions);
          break;
        case 'INFO':
          toast.info(error.userMessage, toastOptions);
          break;
      }
    },
    [enableToasts]
  );

  /**
   * Aggiunge un errore allo stato
   */
  const addError = useCallback(
    (error: AppError | Error | unknown): AppError => {
      let appError: AppError;

      if (error instanceof Error) {
        appError = fromNativeError(error);
      } else if (isApiErrorResponse(error)) {
        appError = fromApiError(error);
      } else if (typeof error === 'object' && error !== null && 'id' in error && 'code' in error) {
        appError = error as AppError;
      } else {
        appError = createAppError({
          code: 'A100',
          message: String(error),
          userMessage: 'Si è verificato un errore imprevisto',
        });
      }

      // Log dell'errore
      if (logErrors) {
        console.error('[Heuresys Error]', formatErrorForLog(appError));
      }

      // Dispatch
      dispatch({ type: 'ADD_ERROR', payload: appError });

      // Mostra toast
      showToast(appError);

      // Callback
      onError?.(appError);

      // Gestione errori critici
      if (isCritical(appError)) {
        onCriticalError?.(appError);
      }

      // Redirect per autenticazione
      if (requiresReauth(appError)) {
        // Salva la route corrente per redirect dopo login
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          if (currentPath !== '/login') {
            sessionStorage.setItem('redirectAfterLogin', currentPath);
            window.location.href = '/login?reason=session_expired';
          }
        }
      }

      return appError;
    },
    [onError, onCriticalError, showToast, logErrors]
  );

  /**
   * Dismiss un errore
   */
  const dismissError = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_ERROR', payload: id });
  }, []);

  /**
   * Dismiss tutti gli errori
   */
  const dismissAll = useCallback(() => {
    dispatch({ type: 'DISMISS_ALL' });
  }, []);

  /**
   * Pulisce tutti gli errori
   */
  const clearErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ERRORS' });
  }, []);

  /**
   * Mostra un errore con toast
   */
  const showError = useCallback(
    (options: CreateErrorOptions | string) => {
      const errorOptions =
        typeof options === 'string'
          ? { code: 'A100', message: options, userMessage: options }
          : options;
      const error = createAppError(errorOptions);
      addError(error);
    },
    [addError]
  );

  /**
   * Mostra un toast di successo
   */
  const showSuccess = useCallback(
    (message: string, description?: string) => {
      if (enableToasts) {
        toast.success(message, { description });
      }
    },
    [enableToasts]
  );

  /**
   * Mostra un toast di warning
   */
  const showWarning = useCallback(
    (message: string, description?: string) => {
      if (enableToasts) {
        toast.warning(message, { description });
      }
    },
    [enableToasts]
  );

  /**
   * Mostra un toast informativo
   */
  const showInfo = useCallback(
    (message: string, description?: string) => {
      if (enableToasts) {
        toast.info(message, { description });
      }
    },
    [enableToasts]
  );

  /**
   * Listener per errori non gestiti
   */
  useEffect(() => {
    const handleUnhandledError = (event: ErrorEvent) => {
      addError(event.error || new Error(event.message));
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      addError(event.reason);
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [addError]);

  /**
   * Listener per stato offline
   */
  useEffect(() => {
    const handleOffline = () => {
      toast.error('Connessione di rete persa', {
        description: 'Alcune funzionalità potrebbero non essere disponibili',
        duration: Infinity,
        id: 'offline-toast',
      });
    };

    const handleOnline = () => {
      toast.dismiss('offline-toast');
      toast.success('Connessione ristabilita');
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const value: ErrorContextType = {
    state,
    addError,
    dismissError,
    dismissAll,
    clearErrors,
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };

  return <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>;
}

/**
 * Hook per usare il context
 */
export function useError(): ErrorContextType {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

/**
 * Hook per gli errori (readonly)
 */
export function useErrorState(): ErrorState {
  const { state } = useError();
  return state;
}
