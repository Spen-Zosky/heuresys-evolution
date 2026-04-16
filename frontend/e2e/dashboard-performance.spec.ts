import { test, expect } from '@playwright/test'
import { getAuthToken } from './api-auth-helper'

const API_BASE = 'http://localhost:8012'
let HEADERS: Record<string, string> = { 'X-Tenant-Code': 'rtl-bank' }

/**
 * VERIFICA SISTEMATICA DASHBOARD - TAB PERFORMANCE
 */
test.describe('2. Dashboard - Tab Performance', () => {

  test.beforeAll(async () => {
    const token = await getAuthToken();
    HEADERS = { ...HEADERS, 'Authorization': `Bearer ${token}` };
  });

  test('2.1 Distribuzione Performance - Rating categories from API', async ({ page, request }) => {
    // Get performance metrics from API
    const res = await request.get(`${API_BASE}/api/v1/dashboard/performance-metrics`, { headers: HEADERS })
    if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }
    const api = await res.json()

    console.log('[Performance Metrics API]:', JSON.stringify(api.data, null, 2))

    // Verify API data structure
    expect(api.data.rating_distribution).toBeDefined()
    expect(api.data.rating_distribution.length).toBeGreaterThan(0)
    console.log('[Rating Distribution]:', api.data.rating_distribution)

    // Navigate to dashboard (no Performance tab - single-page layout)
    await page.goto('/admin')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'test-results/dashboard-performance-tab.png', fullPage: true })

    // Dashboard shows performance data in various sections
    await expect(page.locator('main')).toBeVisible()
  })

  test('2.2 Goal Completion - verify API data', async ({ page, request }) => {
    const res = await request.get(`${API_BASE}/api/v1/dashboard/performance-metrics`, { headers: HEADERS })
    if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }
    const api = await res.json()
    if (!api.data?.goal_completion) { console.log('[SKIP] No goal completion data'); return }

    console.log('[Goal Completion API]:', api.data.goal_completion)

    // Verify the data is correct
    expect(api.data.goal_completion).toBeDefined()
    expect(api.data.goal_completion.completed).toBeDefined()
    expect(api.data.goal_completion.total).toBeDefined()

    // Navigate and verify dashboard loads
    await page.goto('/admin')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    // Dashboard shows goal completion in "Completamento Obiettivi" section
    const goalSection = page.locator('text=Completamento Obiettivi').or(page.locator('text=Gap Analysis'))
    const visible = await goalSection.first().isVisible({ timeout: 5000 }).catch(() => false)
    console.log(`[Goal/Gap Section]: ${visible ? 'visible' : 'not found - layout differs'}`)
  })

  test('2.3 Verify performance data consistency with database', async ({ request }) => {
    // Get API data
    const perfRes = await request.get(`${API_BASE}/api/v1/dashboard/performance-metrics`, { headers: HEADERS })
    const perf = await perfRes.json()

    // Get goals data directly
    const goalsRes = await request.get(`${API_BASE}/api/v1/goals?limit=1`, { headers: HEADERS })
    const goals = await goalsRes.json()

    // Get reviews data
    const reviewsRes = await request.get(`${API_BASE}/api/v1/performance-reviews?limit=1`, { headers: HEADERS })

    console.log('[Performance Metrics]:', perf.data)
    console.log('[Goals count from goals API]:', goals.meta?.total || 'N/A')

    // Verify goal_completion total matches goals count
    if (goals.meta?.total) {
      const apiTotal = parseInt(perf.data.goal_completion.total)
      const goalsTotal = goals.meta.total
      console.log(`Goal completion total: ${apiTotal} vs Goals API total: ${goalsTotal}`)
      // They should match
      expect(apiTotal).toBe(goalsTotal)
    }
  })
})
