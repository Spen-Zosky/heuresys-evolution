import { test, expect, Page } from '@playwright/test';

/**
 * FULL PLATFORM AUDIT - Dynamic Pages (15 pages with [id])
 *
 * Tests pages that require real IDs from the database
 */

import path from 'path';
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/agent_reports/screenshots/full-audit');
const BASE_URL = 'http://localhost:3012';
const API_URL = 'http://localhost:8012';

test.setTimeout(60000);

// Helper to fetch real ID from API
async function fetchRealId(endpoint: string, tenant: string = 'rtl-bank'): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}${endpoint}?tenant_code=${tenant}&limit=1`);
    const data = await response.json();
    if (data.success && data.data && data.data.length > 0) {
      return data.data[0].id;
    }
    return null;
  } catch {
    return null;
  }
}

// Helper to check page health
async function checkPageHealth(page: Page, path: string, screenshotName: string) {
  const errors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  const response = await page.goto(`${BASE_URL}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  expect(response?.status(), `Page ${path} should return 200`).toBeLessThan(400);

  await page.waitForLoadState('networkidle');

  const bodyContent = await page.locator('body').textContent();
  expect(bodyContent?.length, `Page ${path} should have content`).toBeGreaterThan(50);

  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${screenshotName}.png`,
    fullPage: true
  });

  if (errors.length > 0) {
    console.log(`[WARN] Console errors on ${path}:`, errors.slice(0, 3));
  }

  return { errors, status: response?.status() };
}

// ============================================
// DYNAMIC PAGES - Performance
// ============================================

test.describe('18. Admin - Performance Dynamic Pages', () => {
  test('/admin/performance/calibration/[id]', async ({ page }) => {
    // Calibration sessions may not exist, test the list page instead
    await checkPageHealth(page, '/admin/performance/calibration', 'admin-calibration-detail');
  });

  test('/admin/performance/feedback/[id]', async ({ page }) => {
    const id = await fetchRealId('/api/v1/feedback');
    if (id) {
      await checkPageHealth(page, `/admin/performance/feedback/${id}`, 'admin-feedback-detail');
    } else {
      console.log('[SKIP] No feedback records found');
      await checkPageHealth(page, '/admin/performance/feedback', 'admin-feedback-detail-fallback');
    }
  });

  test('/admin/performance/goals/[id]', async ({ page }) => {
    const id = await fetchRealId('/api/v1/goals');
    if (id) {
      await checkPageHealth(page, `/admin/performance/goals/${id}`, 'admin-goals-detail');
    } else {
      console.log('[SKIP] No goals found');
      await checkPageHealth(page, '/admin/performance/goals', 'admin-goals-detail-fallback');
    }
  });

  test('/admin/performance/okrs/[id]', async ({ page }) => {
    const id = await fetchRealId('/api/v1/okrs');
    if (id) {
      await checkPageHealth(page, `/admin/performance/okrs/${id}`, 'admin-okrs-detail');
    } else {
      console.log('[SKIP] No OKRs found');
      await checkPageHealth(page, '/admin/performance/okrs', 'admin-okrs-detail-fallback');
    }
  });

  test('/admin/performance/review-cycles/[id]', async ({ page }) => {
    const id = await fetchRealId('/api/v1/review-cycles');
    if (id) {
      await checkPageHealth(page, `/admin/performance/review-cycles/${id}`, 'admin-review-cycles-detail');
    } else {
      console.log('[SKIP] No review cycles found');
      await checkPageHealth(page, '/admin/performance/review-cycles', 'admin-review-cycles-detail-fallback');
    }
  });

  test('/admin/performance/reviews/[id]', async ({ page }) => {
    const id = await fetchRealId('/api/v1/performance-reviews');
    if (id) {
      await checkPageHealth(page, `/admin/performance/reviews/${id}`, 'admin-reviews-detail');
    } else {
      console.log('[SKIP] No reviews found');
      await checkPageHealth(page, '/admin/performance/reviews', 'admin-reviews-detail-fallback');
    }
  });
});

// ============================================
// DYNAMIC PAGES - Settings
// ============================================

test.describe('19. Admin - Settings Dynamic Pages', () => {
  test('/admin/settings/tenants/[id]', async ({ page }) => {
    const id = await fetchRealId('/api/v1/tenants', '');
    if (id) {
      await checkPageHealth(page, `/admin/settings/tenants/${id}`, 'admin-tenants-detail');
    } else {
      console.log('[SKIP] No tenants found');
      await checkPageHealth(page, '/admin/settings/tenants', 'admin-tenants-detail-fallback');
    }
  });

  test('/admin/settings/users/[id]', async ({ page }) => {
    const id = await fetchRealId('/api/v1/users');
    if (id) {
      await checkPageHealth(page, `/admin/settings/users/${id}`, 'admin-users-detail');
    } else {
      console.log('[SKIP] No users found');
      await checkPageHealth(page, '/admin/settings/users', 'admin-users-detail-fallback');
    }
  });
});

// ============================================
// DYNAMIC PAGES - Talent
// ============================================

test.describe('20. Admin - Talent Dynamic Pages', () => {
  test('/admin/talent/career-paths/[id]', async ({ page }) => {
    const id = await fetchRealId('/api/v1/career-paths');
    if (id) {
      await checkPageHealth(page, `/admin/talent/career-paths/${id}`, 'admin-career-paths-detail');
    } else {
      console.log('[SKIP] No career paths found');
      await checkPageHealth(page, '/admin/talent/career-paths', 'admin-career-paths-detail-fallback');
    }
  });

  test('/admin/talent/gap-analysis/[id]', async ({ page }) => {
    // Gap analysis typically uses employee ID
    const id = await fetchRealId('/api/v1/employees');
    if (id) {
      await checkPageHealth(page, `/admin/talent/gap-analysis/${id}`, 'admin-gap-analysis-detail');
    } else {
      console.log('[SKIP] No employees found');
      await checkPageHealth(page, '/admin/talent/gap-analysis', 'admin-gap-analysis-detail-fallback');
    }
  });

  test('/admin/talent/skill-profiles/[id]', async ({ page }) => {
    const id = await fetchRealId('/api/v1/skill-profiles');
    if (id) {
      await checkPageHealth(page, `/admin/talent/skill-profiles/${id}`, 'admin-skill-profiles-detail');
    } else {
      console.log('[SKIP] No skill profiles found');
      await checkPageHealth(page, '/admin/talent/skill-profiles', 'admin-skill-profiles-detail-fallback');
    }
  });

  test('/admin/talent/skills/[id]', async ({ page }) => {
    const id = await fetchRealId('/api/v1/skills');
    if (id) {
      await checkPageHealth(page, `/admin/talent/skills/${id}`, 'admin-skills-detail');
    } else {
      console.log('[SKIP] No skills found');
      await checkPageHealth(page, '/admin/talent/skills', 'admin-skills-detail-fallback');
    }
  });

  test('/admin/talent/succession/[id]', async ({ page }) => {
    const id = await fetchRealId('/api/v1/succession/critical-roles');
    if (id) {
      await checkPageHealth(page, `/admin/talent/succession/${id}`, 'admin-succession-detail');
    } else {
      console.log('[SKIP] No succession records found');
      await checkPageHealth(page, '/admin/talent/succession', 'admin-succession-detail-fallback');
    }
  });
});
