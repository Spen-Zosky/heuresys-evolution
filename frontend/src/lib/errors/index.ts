/**
 * Heuresys Frontend Error Handling Module
 *
 * Sistema centralizzato di gestione errori per il frontend React/Next.js.
 *
 * @example
 * // In _app.tsx o layout.tsx
 * import { ErrorProvider, Toaster } from '@/lib/errors'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <ErrorProvider>
 *       {children}
 *       <Toaster />
 *     </ErrorProvider>
 *   )
 * }
 *
 * @example
 * // In un componente
 * import { useAsync, Errors, SafeSection } from '@/lib/errors'
 *
 * function UserProfile() {
 *   const { data, loading, error, retry } = useFetch<User>('/api/v1/users/me')
 *
 *   if (loading) return <Skeleton />
 *   if (error) return <ErrorDisplay error={error} onRetry={retry} />
 *   return <ProfileCard user={data} />
 * }
 *
 * @example
 * // Error Boundary
 * import { ErrorBoundary, SafeSection } from '@/lib/errors'
 *
 * function Dashboard() {
 *   return (
 *     <ErrorBoundary>
 *       <SafeSection name="Charts">
 *         <ChartComponent />
 *       </SafeSection>
 *     </ErrorBoundary>
 *   )
 * }
 */

// Types
export type {
  AppError,
  ApiError,
  ApiErrorResponse,
  ApiSuccessResponse,
  ApiResponse,
  ErrorState,
  ErrorAction,
  ErrorSeverity,
  ErrorCategory
} from './types'

export {
  FrontendErrorCodes,
  ErrorMessages,
  HttpStatusToErrorCode,
  CategorySeverity
} from './types'

// Factory
export {
  createAppError,
  fromApiError,
  fromNativeError,
  fromFetchError,
  isApiErrorResponse,
  isRetryable,
  requiresReauth,
  isCritical,
  isNetworkError,
  formatErrorForLog,
  generateErrorId,
  Errors
} from './factory'

export type { CreateErrorOptions } from './factory'

// Context
export {
  ErrorProvider,
  useError,
  useErrorState
} from './context'

// Boundary
export {
  ErrorBoundary,
  SafeSection,
  withErrorBoundary,
  useErrorBoundary
} from './boundary'

// Hooks
export {
  useAsync,
  useFetch,
  useMutation,
  usePolling,
  useForm
} from './hooks'

export type {
  AsyncState,
  UseAsyncOptions,
  UseFormOptions
} from './hooks'

// Re-export Toaster from sonner for convenience
export { Toaster } from 'sonner'
