import { test, expect } from '@playwright/test'
import { getAuthToken } from './api-auth-helper'

const API_BASE = 'http://localhost:8012'
let HEADERS: Record<string, string> = { 'X-Tenant-Code': 'rtl-bank' }

/**
 * VERIFICA SISTEMATICA - PERFORMANCE (8 sottopagine)
 */
test.describe('7. Performance Section', () => {

  test.beforeAll(async () => {
    const token = await getAuthToken();
    HEADERS = { ...HEADERS, 'Authorization': `Bearer ${token}` };
  });

  test('7.1 Performance Main Page', async ({ page }) => {
    await page.goto('/admin/performance')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'test-results/performance-main.png', fullPage: true })

    const title = page.locator('h1').or(page.locator('h2'))
    await expect(title.first()).toBeVisible()
    console.log('[Performance Main]: loaded')
  })

  test('7.2 Goals Page - Verify goals data', async ({ page, request }) => {
    const res = await request.get(`${API_BASE}/api/v1/goals?limit=5`, { headers: HEADERS })

    if (res.ok()) {
      const api = await res.json()
      console.log(`[Goals API]: ${api.meta?.total || api.data?.length || 0} goals`)
    } else {
      console.log('[Goals API]: not available or requires auth')
    }

    await page.goto('/admin/performance/goals')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'test-results/performance-goals.png', fullPage: true })

    const title = page.locator('h1').or(page.locator('h2')).or(page.locator('text=Obiettivi'))
    await expect(title.first()).toBeVisible()
    console.log('[Goals Page]: loaded')
  })

  test('7.3 Reviews Page - Verify reviews data', async ({ page, request }) => {
    const res = await request.get(`${API_BASE}/api/v1/performance-reviews?limit=5`, { headers: HEADERS })

    if (res.ok()) {
      const api = await res.json()
      console.log(`[Reviews API]: ${api.meta?.total || api.data?.length || 0} reviews`)
    } else {
      console.log('[Reviews API]: not available or requires auth')
    }

    await page.goto('/admin/performance/reviews')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'test-results/performance-reviews.png', fullPage: true })

    const title = page.locator('h1').or(page.locator('h2')).or(page.locator('text=Valutazioni'))
    await expect(title.first()).toBeVisible()
    console.log('[Reviews Page]: loaded')
  })

  test('7.4 OKRs Page', async ({ page }) => {
    await page.goto('/admin/performance/okrs')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'test-results/performance-okrs.png', fullPage: true })

    const title = page.locator('h1').or(page.locator('h2')).or(page.locator('text=OKR'))
    await expect(title.first()).toBeVisible()
    console.log('[OKRs Page]: loaded')
  })

  test('7.5 Feedback Page', async ({ page }) => {
    await page.goto('/admin/performance/feedback')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'test-results/performance-feedback.png', fullPage: true })

    const title = page.locator('h1').or(page.locator('h2')).or(page.locator('text=Feedback'))
    await expect(title.first()).toBeVisible()
    console.log('[Feedback Page]: loaded')
  })

  test('7.6 Check-ins Page', async ({ page, request }) => {
    const res = await request.get(`${API_BASE}/api/v1/check-ins?limit=5`, { headers: HEADERS })

    if (res.ok()) {
      const api = await res.json()
      console.log(`[Check-ins API]: ${api.meta?.total || api.data?.length || 0} check-ins`)
    } else {
      console.log('[Check-ins API]: not available or requires auth')
    }

    await page.goto('/admin/performance/check-ins')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'test-results/performance-check-ins.png', fullPage: true })

    const title = page.locator('h1').or(page.locator('h2')).or(page.locator('text=Check-in'))
    await expect(title.first()).toBeVisible()
    console.log('[Check-ins Page]: loaded')
  })

  test('7.7 Review Cycles Page', async ({ page }) => {
    await page.goto('/admin/performance/review-cycles')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'test-results/performance-review-cycles.png', fullPage: true })

    const title = page.locator('h1').or(page.locator('h2')).or(page.locator('text=Cicli'))
    await expect(title.first()).toBeVisible()
    console.log('[Review Cycles Page]: loaded')
  })

  test('7.8 Calibration Page', async ({ page }) => {
    await page.goto('/admin/performance/calibration')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'test-results/performance-calibration.png', fullPage: true })

    const title = page.locator('h1').or(page.locator('h2')).or(page.locator('text=Calibr'))
    await expect(title.first()).toBeVisible()
    console.log('[Calibration Page]: loaded')
  })
})
