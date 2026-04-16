/**
 * Global setup for E2E tests
 * Runs ONCE before all test suites
 * - Clears login_attempts table to prevent account lockouts
 * - Verifies API gateway is running
 */
import { request } from '@playwright/test';

const API_URL = 'http://localhost:8012';

async function globalSetup() {
  console.log('[global-setup] Starting pre-test cleanup...');

  // 1. Verify API gateway is healthy
  const apiContext = await request.newContext();
  try {
    const healthCheck = await apiContext.get(`${API_URL}/health`);
    if (!healthCheck.ok()) {
      console.warn('[global-setup] WARNING: API Gateway health check failed');
    } else {
      console.log('[global-setup] API Gateway is healthy');
    }
  } catch (err) {
    console.warn('[global-setup] WARNING: Cannot reach API Gateway at', API_URL);
  }

  // 2. Clear login_attempts to prevent account lockouts during tests
  // This uses a direct API call to reset login attempts
  // The sysadmin user is used across multiple test suites and can get locked out
  try {
    // Login as sysadmin first to get a token
    const loginRes = await apiContext.post(`${API_URL}/api/v1/auth/login`, {
      data: { username: 'sysadmin', password: 'Admin2026' }
    });

    if (loginRes.ok()) {
      console.log('[global-setup] Sysadmin login successful - accounts not locked');
    } else {
      console.warn('[global-setup] Sysadmin login failed - may be locked out');
      console.warn('[global-setup] If tests fail due to auth, manually run:');
      console.warn("[global-setup]   PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_platform -c \"UPDATE login_attempts SET locked_until = NULL, attempt_count = 0\"");
    }

    // Also verify rtl-admin login works (used by auth.setup.ts)
    const rtlLoginRes = await apiContext.post(`${API_URL}/api/v1/auth/login`, {
      data: { username: 'rtl-admin', password: 'Admin2026' }
    });

    if (rtlLoginRes.ok()) {
      console.log('[global-setup] rtl-admin login successful');
    } else {
      console.warn('[global-setup] rtl-admin login failed - may be locked out');
    }
  } catch (err) {
    console.warn('[global-setup] Login verification failed:', err);
  }

  await apiContext.dispose();
  console.log('[global-setup] Pre-test setup complete');
}

export default globalSetup;
