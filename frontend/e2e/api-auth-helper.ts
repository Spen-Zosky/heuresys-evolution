/**
 * Shared authentication helper for API-only E2E tests
 * Provides a valid JWT token for authenticated API calls
 */

const API_BASE = 'http://localhost:8012';

let cachedToken: string | null = null;

export async function getAuthToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'rtl-admin', password: 'Admin2026' })
  });
  
  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  cachedToken = data.data?.accessToken || data.data?.token || data.accessToken || data.token;

  if (!cachedToken) {
    throw new Error(`No token in auth response. Keys: ${JSON.stringify(Object.keys(data.data || data))}`);
  }
  
  return cachedToken;
}

export function getAuthHeaders(tenantCode: string = 'rtl-bank'): Record<string, string> {
  return {
    'X-Tenant-Code': tenantCode,
    'Content-Type': 'application/json',
  };
}

/**
 * Returns headers including Authorization Bearer token
 */
export async function getAuthenticatedHeaders(tenantCode: string = 'rtl-bank'): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return {
    'X-Tenant-Code': tenantCode,
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}
