/**
 * Hooks Module - Heuresys Platform
 */

export {
  useApi,
  useMutation,
  formatApiError,
  isNetworkError,
  isAuthError,
  isNotFoundError,
  isForbiddenError,
} from './use-api';

export {
  AuthProvider,
  useAuth,
  useIsAuthenticated,
  useCurrentUser,
  usePermission,
  useRole,
  useRequireAuth,
} from './use-auth';

export { useDebounce } from './use-debounce';

export { usePagination } from './use-pagination';

export { TenantProvider, useTenantContext, useActiveTenantId } from './use-tenant-context';

export { useWidgetSwr } from './use-widget-swr';
export type { UseWidgetSwrOptions, UseWidgetSwrResult } from './use-widget-swr';
