import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getApiBaseUrl,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  setCurrentTenant,
  getCurrentTenant,
  getDefaultHeaders,
  isAuthenticated,
  logout,
  DEFAULT_TENANT_CODE,
} from '@/lib/api-config';

// ---------------------------------------------------------------------------
// Helpers - mock localStorage for a jsdom environment
// ---------------------------------------------------------------------------
function resetLocalStorage() {
  localStorage.clear();
}

// ---------------------------------------------------------------------------
// getApiBaseUrl
// ---------------------------------------------------------------------------
describe('getApiBaseUrl', () => {
  it('returns URL using current window hostname and default port', () => {
    // jsdom sets window.location to http://localhost by default
    const url = getApiBaseUrl();
    expect(url).toMatch(/^https?:\/\/.+:\d+$/);
    expect(url).toContain('8012');
  });

  it('uses the protocol and hostname from window.location', () => {
    const url = getApiBaseUrl();
    const { protocol, hostname } = window.location;
    expect(url).toBe(`${protocol}//${hostname}:8012`);
  });
});

// ---------------------------------------------------------------------------
// Auth token management
// ---------------------------------------------------------------------------
describe('setAuthToken / getAuthToken / clearAuthToken', () => {
  beforeEach(resetLocalStorage);

  it('stores and retrieves a token', () => {
    setAuthToken('jwt-abc-123');
    expect(getAuthToken()).toBe('jwt-abc-123');
  });

  it('returns null when no token is set', () => {
    expect(getAuthToken()).toBeNull();
  });

  it('clearAuthToken removes the stored token', () => {
    setAuthToken('jwt-abc-123');
    clearAuthToken();
    expect(getAuthToken()).toBeNull();
  });

  it('overwrites previous token on re-set', () => {
    setAuthToken('token-old');
    setAuthToken('token-new');
    expect(getAuthToken()).toBe('token-new');
  });
});

// ---------------------------------------------------------------------------
// Tenant management
// ---------------------------------------------------------------------------
describe('setCurrentTenant / getCurrentTenant', () => {
  beforeEach(resetLocalStorage);

  it('returns null when nothing is set (SUPERUSER all-tenants mode)', () => {
    expect(getCurrentTenant()).toBeNull();
  });

  it('stores and retrieves a custom tenant code', () => {
    setCurrentTenant('smartfood');
    expect(getCurrentTenant()).toBe('smartfood');
  });

  it('overwrites previous tenant code', () => {
    setCurrentTenant('rtl-bank');
    setCurrentTenant('econova');
    expect(getCurrentTenant()).toBe('econova');
  });
});

// ---------------------------------------------------------------------------
// isAuthenticated
// ---------------------------------------------------------------------------
describe('isAuthenticated', () => {
  beforeEach(resetLocalStorage);

  it('returns false when no token exists', () => {
    expect(isAuthenticated()).toBe(false);
  });

  it('returns true after a token is set', () => {
    setAuthToken('some-token');
    expect(isAuthenticated()).toBe(true);
  });

  it('returns false after token is cleared', () => {
    setAuthToken('some-token');
    clearAuthToken();
    expect(isAuthenticated()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------
describe('logout', () => {
  beforeEach(resetLocalStorage);

  it('removes the auth token', () => {
    setAuthToken('token-to-clear');
    logout();
    expect(getAuthToken()).toBeNull();
  });

  it('removes the tenant key', () => {
    setCurrentTenant('econova');
    logout();
    // After logout, getCurrentTenant returns null (no tenant selected)
    expect(getCurrentTenant()).toBeNull();
  });

  it('clears both token and tenant in a single call', () => {
    setAuthToken('my-token');
    setCurrentTenant('smartfood');
    logout();
    expect(isAuthenticated()).toBe(false);
    expect(getCurrentTenant()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getDefaultHeaders
// ---------------------------------------------------------------------------
describe('getDefaultHeaders', () => {
  beforeEach(resetLocalStorage);

  it('includes Content-Type header', () => {
    const headers = getDefaultHeaders() as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('includes X-Tenant-Code from current tenant', () => {
    setCurrentTenant('rtl-bank');
    const headers = getDefaultHeaders() as Record<string, string>;
    expect(headers['X-Tenant-Code']).toBe('rtl-bank');
  });

  it('uses explicit tenantCode parameter over stored value', () => {
    setCurrentTenant('rtl-bank');
    const headers = getDefaultHeaders('econova') as Record<string, string>;
    expect(headers['X-Tenant-Code']).toBe('econova');
  });

  it('includes Authorization header when token is set', () => {
    setAuthToken('my-jwt-token');
    const headers = getDefaultHeaders() as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-jwt-token');
  });

  it('omits Authorization header when no token is set', () => {
    const headers = getDefaultHeaders() as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });
});
