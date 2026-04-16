'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { useAuth } from './use-auth';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface TenantContextValue {
  /** Currently active tenant */
  activeTenant: Tenant | null;
  /** All tenants accessible to the user */
  availableTenants: Tenant[];
  /** Whether tenant data is loading */
  isLoading: boolean;
  /** Switch to a different tenant */
  switchTenant: (tenantId: string) => void;
  /** Active tenant ID shorthand */
  tenantId: string | null;
}

const TenantContext = createContext<TenantContextValue | null>(null);

interface TenantProviderProps {
  children: ReactNode;
}

/**
 * TenantProvider - Manages active tenant context for multi-tenant views.
 * Wraps the application to provide tenant switching and context to all children.
 *
 * SUPERUSER users can see and switch between all tenants.
 * Regular users are locked to their assigned tenant.
 */
export function TenantProvider({ children }: TenantProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load tenant info from user context
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setActiveTenant(null);
      setAvailableTenants([]);
      setIsLoading(false);
      return;
    }

    // For non-SUPERUSER, tenant is fixed from JWT
    if (user.tenantId) {
      const tenant: Tenant = {
        id: user.tenantId,
        name: user.tenant_name || 'Tenant',
        slug: user.tenant_code || '',
      };
      setActiveTenant(tenant);
      setAvailableTenants([tenant]);
    }

    setIsLoading(false);
  }, [isAuthenticated, user]);

  const switchTenant = useCallback(
    (tenantId: string) => {
      const tenant = availableTenants.find((t) => t.id === tenantId);
      if (tenant) {
        setActiveTenant(tenant);
      }
    },
    [availableTenants]
  );

  return (
    <TenantContext.Provider
      value={{
        activeTenant,
        availableTenants,
        isLoading,
        switchTenant,
        tenantId: activeTenant?.id ?? null,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

/**
 * Access tenant context. Must be used within a TenantProvider.
 */
export function useTenantContext(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenantContext must be used within a TenantProvider');
  }
  return context;
}

/**
 * Shorthand hook to get just the active tenant ID.
 */
export function useActiveTenantId(): string | null {
  const { tenantId } = useTenantContext();
  return tenantId;
}
