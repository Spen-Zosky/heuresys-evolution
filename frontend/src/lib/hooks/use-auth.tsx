/**
 * useAuth Hook - Authentication state management
 *
 * Provides:
 * - Current user state
 * - Login/logout functions
 * - Authentication status
 * - Permission checking
 */

'use client';

import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useContext,
  ReactNode,
} from 'react';
import { api, AuthenticationError } from '../api';
import type { User, LoginRequest, AuthState, UserRole } from '../api/types';
import { getAuthToken, clearAuthToken } from '../api-config';
import { ROLE_LEVELS } from '../navigation';

// ============================================
// AUTH CONTEXT
// ============================================

interface AuthContextValue extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  rbpDashboards: string[];
  defaultDashboardPath: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ROLE_LEVELS imported from ../navigation (single source of truth)

// ============================================
// AUTH PROVIDER
// ============================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Check authentication on mount
  const checkAuthentication = useCallback(async () => {
    const token = getAuthToken();

    if (!token) {
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return;
    }

    try {
      const user = await api.auth.getCurrentUser();
      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        // 401 — token invalid/expired: clear stored token and auth state
        clearAuthToken();
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      } else {
        // 500/network error — keep token, stop loading
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    }
  }, []);

  useEffect(() => {
    checkAuthentication();
  }, [checkAuthentication]);

  // Login
  const login = useCallback(async (credentials: LoginRequest) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const { accessToken, user } = await api.auth.login(credentials);
      setState({
        user,
        token: accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    await api.auth.logout();
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // Redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, []);

  // Check if user has specific permission
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!state.user) return false;

      // SUPERUSER has all permissions
      if (state.user.role === 'SUPERUSER') return true;

      return state.user.permissions?.includes(permission) ?? false;
    },
    [state.user]
  );

  // Check if user has specific role(s)
  const hasRole = useCallback(
    (role: UserRole | UserRole[]): boolean => {
      if (!state.user) return false;

      const roles = Array.isArray(role) ? role : [role];
      const userLevel = ROLE_LEVELS[state.user.role];

      // Check if user role level is <= any of the required roles
      return roles.some((r) => userLevel <= ROLE_LEVELS[r]);
    },
    [state.user]
  );

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    checkAuth: checkAuthentication,
    hasPermission,
    hasRole,
    rbpDashboards: [],
    defaultDashboardPath: '/admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================
// HOOK
// ============================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

// ============================================
// UTILITY HOOKS
// ============================================

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

/**
 * Hook to get current user
 */
export function useCurrentUser(): User | null {
  const { user } = useAuth();
  return user;
}

/**
 * Hook to check permissions
 */
export function usePermission(permission: string): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

/**
 * Hook to check role
 */
export function useRole(role: UserRole | UserRole[]): boolean {
  const { hasRole } = useAuth();
  return hasRole(role);
}

/**
 * Hook for protected routes
 */
export function useRequireAuth(redirectTo: string = '/login'): AuthState & {
  isReady: boolean;
} {
  const { isAuthenticated, isLoading, user, token } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
  }, [isLoading, isAuthenticated, redirectTo]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    isReady: !isLoading && isAuthenticated,
  };
}
