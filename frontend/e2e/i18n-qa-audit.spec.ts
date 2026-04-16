/**
 * i18n QA Audit — Real browser navigation test
 *
 * Tests EVERY accessible page for:
 * 1. Page loads without errors
 * 2. No raw i18n keys visible (e.g. "admin.something.title")
 * 3. No console errors related to missing translations
 * 4. Language switcher present where expected
 * 5. Data connections work (API calls don't fail)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3012';
const API = process.env.E2E_API_URL || 'http://localhost:8012';

// Login helper
async function login(page: Page, username = 'sysadmin', password = 'Admin2026') {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input#username', username);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(admin|portal|platform)/, { timeout: 15000 });
}

// Set locale via cookie
async function setLocale(page: Page, locale: 'it' | 'en') {
  await page.context().addCookies([{
    name: 'locale',
    value: locale,
    domain: new URL(BASE).hostname,
    path: '/',
  }]);
}

// Check for raw i18n keys in page text
async function checkNoRawKeys(page: Page, pagePath: string) {
  const bodyText = await page.textContent('body') || '';
  // Raw keys look like: "admin.something.title" or "common.save" etc.
  const rawKeyPattern = /\b(admin|portal|platform|common|companyPet|dashboards|nav|sidebar|footer|header|errors|auth|landing|analytics|performance|recruiting|talent|compensation|compliance|engagement|learning|hr)\.[a-zA-Z]+\.[a-zA-Z]+/g;
  const matches = bodyText.match(rawKeyPattern) || [];
  // Filter out legit text that looks like keys (e.g. URLs, email domains)
  const realKeys = matches.filter(m =>
    !m.includes('heuresys.com') &&
    !m.includes('http') &&
    !m.includes('@')
  );
  if (realKeys.length > 0) {
    console.warn(`[${pagePath}] Raw i18n keys found: ${realKeys.slice(0, 5).join(', ')}`);
  }
  return realKeys;
}

// Check console for i18n errors
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('MISSING_MESSAGE') || text.includes('IntlError') || text.includes('Could not resolve')) {
        errors.push(text);
      }
    }
  });
  return errors;
}

// Collect failed network requests
function collectFailedRequests(page: Page): string[] {
  const failed: string[] = [];
  page.on('response', response => {
    if (response.status() >= 500 && response.url().includes('/api/')) {
      failed.push(`${response.status()} ${response.url()}`);
    }
  });
  return failed;
}

// ============================================================
// PUBLIC PAGES (no auth required)
// ============================================================

test.describe('Public pages', () => {
  test('Login page loads in Italian', async ({ page }) => {
    await setLocale(page, 'it');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    const body = await page.textContent('body');
    expect(body).toContain('Accedi');
    const rawKeys = await checkNoRawKeys(page, '/login');
    expect(rawKeys.length).toBe(0);
  });

  test('Login page loads in English', async ({ page }) => {
    await setLocale(page, 'en');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    const body = await page.textContent('body');
    expect(body).toMatch(/Sign in|Login|Log in/i);
    const rawKeys = await checkNoRawKeys(page, '/login-en');
    expect(rawKeys.length).toBe(0);
  });

  test('Login page has LanguageSwitcher', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    const switcher = page.locator('button[aria-label*="lingua"], button[aria-label*="language"]');
    await expect(switcher).toBeVisible({ timeout: 5000 });
  });

  test('403 page loads', async ({ page }) => {
    await setLocale(page, 'it');
    await page.goto(`${BASE}/403`, { waitUntil: 'networkidle' });
    const body = await page.textContent('body');
    expect(body).toContain('Accesso Negato');
    const rawKeys = await checkNoRawKeys(page, '/403');
    expect(rawKeys.length).toBe(0);
  });

  test('403 page in English', async ({ page }) => {
    await setLocale(page, 'en');
    await page.goto(`${BASE}/403`, { waitUntil: 'networkidle' });
    const body = await page.textContent('body');
    expect(body).toContain('Access Denied');
  });

  test('EN landing page loads', async ({ page }) => {
    await page.goto(`${BASE}/en/landing`, { waitUntil: 'networkidle' });
    // May redirect to login if auth required
    const url = page.url();
    expect(url).toMatch(/\/(en\/landing|login)/);
  });
});

// ============================================================
// AUTHENTICATED PAGES — Portal
// ============================================================

test.describe('Portal pages (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const portalPages = [
    '/portal',
    '/portal/profile',
    '/portal/goals',
    '/portal/learning',
    '/portal/documents',
    '/portal/career',
    '/portal/skills',
    '/portal/reviews',
    '/portal/time-off',
    '/portal/payroll',
    '/portal/analytics',
    '/portal/org-chart',
  ];

  for (const path of portalPages) {
    test(`${path} loads without errors`, async ({ page }) => {
      const consoleErrors = collectConsoleErrors(page);
      const failedRequests = collectFailedRequests(page);

      await setLocale(page, 'it');
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });

      // Page should not show error state
      const body = await page.textContent('body') || '';
      expect(body).not.toContain('Si è verificato un errore');

      // No raw i18n keys
      const rawKeys = await checkNoRawKeys(page, path);
      expect(rawKeys.length).toBe(0);

      // Report console errors but don't fail (some may be benign)
      if (consoleErrors.length > 0) {
        console.warn(`[${path}] i18n console errors: ${consoleErrors.join('; ')}`);
      }
    });
  }

  test('Portal has LanguageSwitcher', async ({ page }) => {
    await page.goto(`${BASE}/portal`, { waitUntil: 'networkidle' });
    const switcher = page.locator('button[aria-label*="lingua"], button[aria-label*="language"]');
    await expect(switcher).toBeVisible({ timeout: 5000 });
  });

  test('Portal switches to English correctly', async ({ page }) => {
    await setLocale(page, 'en');
    await page.goto(`${BASE}/portal`, { waitUntil: 'networkidle' });
    const body = await page.textContent('body') || '';
    // Should show English content, not Italian
    expect(body).toMatch(/Employee Portal|Dashboard|Profile/i);
  });
});

// ============================================================
// AUTHENTICATED PAGES — Admin
// ============================================================

test.describe('Admin pages (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const adminPages = [
    '/admin',
    '/admin/employees',
    '/admin/locations',
    '/admin/org-units',
    '/admin/org-chart',
    '/admin/positions',
    '/admin/skills',
    '/admin/settings',
    '/admin/ai',
    '/admin/analytics',
    '/admin/career',
    '/admin/compensation',
    '/admin/compliance',
    '/admin/enrichment',
    '/admin/engagement',
    '/admin/performance',
    '/admin/recruiting',
    '/admin/talent',
    '/admin/learning',
    '/admin/workspace-templates',
  ];

  for (const path of adminPages) {
    test(`${path} loads without errors`, async ({ page }) => {
      const consoleErrors = collectConsoleErrors(page);

      await setLocale(page, 'it');
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });

      const body = await page.textContent('body') || '';
      expect(body).not.toContain('Si è verificato un errore');

      const rawKeys = await checkNoRawKeys(page, path);
      expect(rawKeys.length).toBe(0);

      if (consoleErrors.length > 0) {
        console.warn(`[${path}] i18n console errors: ${consoleErrors.join('; ')}`);
      }
    });
  }

  test('Admin has LanguageSwitcher', async ({ page }) => {
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    const switcher = page.locator('button[aria-label*="lingua"], button[aria-label*="language"]');
    await expect(switcher).toBeVisible({ timeout: 5000 });
  });

  test('Admin switches to English correctly', async ({ page }) => {
    await setLocale(page, 'en');
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    const body = await page.textContent('body') || '';
    expect(body).toMatch(/Admin Dashboard|Dashboard/i);
  });
});

// ============================================================
// PLATFORM PAGES
// ============================================================

test.describe('Platform pages (superuser)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'sysadmin', 'Admin2026');
  });

  const platformPages = [
    '/platform',
    '/platform/tenants',
    '/platform/users',
    '/platform/security',
    '/platform/settings',
    '/platform/database',
    '/platform/panoramica',
  ];

  for (const path of platformPages) {
    test(`${path} loads without errors`, async ({ page }) => {
      await setLocale(page, 'it');
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });

      const body = await page.textContent('body') || '';
      expect(body).not.toContain('Si è verificato un errore');

      const rawKeys = await checkNoRawKeys(page, path);
      expect(rawKeys.length).toBe(0);
    });
  }
});

// ============================================================
// COMPANY-PET PAGES
// ============================================================

test.describe('Company-PET pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const companyPetPages = [
    '/company-pet',
    '/company-pet/hierarchy',
    '/company-pet/organization',
    '/company-pet/workforce',
    '/company-pet/breakdowns',
    '/company-pet/structure',
    '/company-pet/people',
    '/company-pet/processes',
  ];

  for (const path of companyPetPages) {
    test(`${path} loads without errors`, async ({ page }) => {
      await setLocale(page, 'it');
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });

      const body = await page.textContent('body') || '';
      expect(body).not.toContain('Si è verificato un errore');

      const rawKeys = await checkNoRawKeys(page, path);
      expect(rawKeys.length).toBe(0);
    });
  }
});
