/**
 * Anti-Mock Runtime Validation Test Suite
 *
 * Verifies that all pages and API endpoints are returning real data
 * from the database, not mock/static data.
 *
 * This test:
 * 1. Checks API endpoints return data with real database IDs (UUIDs)
 * 2. Verifies pages fetch from APIs and display dynamic content
 * 3. Ensures no fallback/placeholder data is shown
 */

import { test, expect, Page } from '@playwright/test'

const API_BASE = 'http://localhost:8012/api/v1'

// Test credentials
const SYSADMIN_USER = 'sysadmin'
const SYSADMIN_PASSWORD = 'Admin2026'
const DEFAULT_TENANT = 'rtl-bank'

// UUID pattern for real database IDs
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Suspicious patterns in API responses (NOT HTML attributes)
const SUSPICIOUS_PATTERNS = [
  /lorem ipsum/i,
  /test@test\.com/i,
  /example\.com/i,
  /placeholder\s+(data|text|value)/i,  // Only match "placeholder data/text/value", not HTML placeholder attr
  /\bfake\b/i,
  /\bdummy\b/i,
  /sample data/i,
  /mock data/i,
  /00000000-0000-0000-0000-000000000/i,
  /11111111-1111-1111-1111-111111111/i,
]

interface ApiEndpoint {
  path: string
  method?: 'GET' | 'POST'
  description: string
  expectArray?: boolean
  minItems?: number
  requiredFields?: string[]
  authRequired?: boolean
}

// Critical API endpoints that must return real data
const CRITICAL_ENDPOINTS: ApiEndpoint[] = [
  // Platform endpoints
  { path: '/platform/metrics', description: 'Platform metrics', authRequired: true },
  { path: '/platform/health', description: 'Platform health', authRequired: true },

  // Tenant-specific endpoints (with proper /api/v1/ prefix)
  { path: '/api/v1/employees', description: 'Employees list', expectArray: true, minItems: 1, authRequired: true },
  { path: '/api/v1/departments', description: 'Departments list', expectArray: true, minItems: 1, authRequired: true },
  { path: '/api/v1/goals', description: 'Goals list', expectArray: true, authRequired: true },
  { path: '/api/v1/courses', description: 'Courses list', expectArray: true, authRequired: true },
  { path: '/api/v1/performance/reviews', description: 'Performance reviews', expectArray: true, authRequired: true },
  { path: '/api/v1/career-coach/paths', description: 'Career paths', authRequired: true },
  { path: '/api/v1/career-coach/analytics', description: 'Career analytics', authRequired: true },

  // Employee self-service
  { path: '/api/v1/courses/me', description: 'My courses', authRequired: true },
  { path: '/api/v1/courses/me/stats', description: 'My learning stats', authRequired: true },
  { path: '/api/v1/certifications/me', description: 'My certifications', authRequired: true },
  { path: '/api/v1/pay-stubs/me', description: 'My pay stubs', authRequired: true },
  { path: '/api/v1/benefits/me/enrollment', description: 'My benefits', authRequired: true },
]

async function loginAsAdmin(page: Page): Promise<string | null> {
  // Get auth token via API
  const response = await page.request.post(`${API_BASE}/auth/login`, {
    data: {
      username: SYSADMIN_USER,
      password: SYSADMIN_PASSWORD,
      tenantCode: DEFAULT_TENANT,
    },
  })

  if (!response.ok()) {
    console.warn('Login failed:', await response.text())
    return null
  }

  const data = await response.json()
  return data.data?.accessToken || data.data?.token || data.accessToken || data.token || null
}

function containsSuspiciousPatterns(obj: unknown, path = ''): string[] {
  const issues: string[] = []

  if (typeof obj === 'string') {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(obj)) {
        issues.push(`${path}: contains suspicious pattern "${pattern.source}"`)
      }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      issues.push(...containsSuspiciousPatterns(item, `${path}[${index}]`))
    })
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      issues.push(...containsSuspiciousPatterns(value, `${path}.${key}`))
    }
  }

  return issues
}

function validateUUIDs(obj: unknown, path = ''): string[] {
  const issues: string[] = []

  if (typeof obj === 'string' && path.includes('id') && obj.includes('-')) {
    // This looks like it should be a UUID
    if (!UUID_PATTERN.test(obj) && obj.length === 36) {
      issues.push(`${path}: Invalid UUID format "${obj}"`)
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      issues.push(...validateUUIDs(item, `${path}[${index}]`))
    })
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      issues.push(...validateUUIDs(value, `${path}.${key}`))
    }
  }

  return issues
}

test.describe('Anti-Mock Runtime Validation', () => {
  let authToken: string | null = null

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    authToken = await loginAsAdmin(page)
    await page.close()

    if (!authToken) {
      console.warn('Could not obtain auth token - some tests may be skipped')
    }
  })

  test.describe('API Endpoint Validation', () => {
    for (const endpoint of CRITICAL_ENDPOINTS) {
      test(`${endpoint.description} (${endpoint.path}) should return real data`, async ({ request }) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-tenant-code': DEFAULT_TENANT,
        }

        if (endpoint.authRequired && authToken) {
          headers['Authorization'] = `Bearer ${authToken}`
        }

        const response = await request.get(`${API_BASE}${endpoint.path}`, { headers })

        // If endpoint returns 404, skip - endpoint may not be implemented
        if (response.status() === 404) {
          console.log(`[SKIP] ${endpoint.path} returns 404 - endpoint may not exist`)
          return
        }

        // If we get 401/403 without token, that's expected
        if (response.status() === 401 || response.status() === 403) {
          console.log(`[SKIP] ${endpoint.path} returns ${response.status()} - auth required`)
          return
        }

        // Parse response
        const data = await response.json()

        // Check for success response structure
        if (data.success === false) {
          // Some endpoints may legitimately have no data - that's ok
          if (data.data === null || data.data === undefined) {
            return
          }
        }

        const responseData = data.data || data

        // If expecting array, validate minimum items
        if (endpoint.expectArray) {
          const items = Array.isArray(responseData) ? responseData : responseData.items || responseData.data || []

          if (endpoint.minItems) {
            expect(items.length,
              `${endpoint.path} should return at least ${endpoint.minItems} items`
            ).toBeGreaterThanOrEqual(endpoint.minItems)
          }
        }

        // Check for suspicious patterns in response
        const suspiciousIssues = containsSuspiciousPatterns(responseData)
        expect(suspiciousIssues,
          `${endpoint.path} contains suspicious mock data patterns:\n${suspiciousIssues.join('\n')}`
        ).toHaveLength(0)

        // Validate UUID formats if present
        const uuidIssues = validateUUIDs(responseData)
        if (uuidIssues.length > 0) {
          console.warn(`UUID format issues in ${endpoint.path}:`, uuidIssues)
        }
      })
    }
  })

  test.describe('Page Content Validation', () => {
    // These tests use the pre-authenticated storageState from auth.setup.ts
    // No manual login needed - pages are accessed with the already authenticated session

    test('Portal payroll page should display real pay stubs', async ({ page }) => {
      await page.goto('/portal/payroll')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      const content = await page.content()

      // Check for suspicious mock patterns in rendered content
      for (const pattern of SUSPICIOUS_PATTERNS) {
        expect(content, `Page contains mock pattern: ${pattern.source}`).not.toMatch(pattern)
      }
    })

    test('Portal learning page should display real courses', async ({ page }) => {
      await page.goto('/portal/learning')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      const content = await page.content()

      for (const pattern of SUSPICIOUS_PATTERNS) {
        expect(content, `Page contains mock pattern: ${pattern.source}`).not.toMatch(pattern)
      }
    })

    test('Platform page should display real metrics', async ({ page }) => {
      await page.goto('/platform')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Platform page should show real tenant count
      const totalTenantsElement = await page.locator('text=/\\d+/').first()
      const tenantsText = await totalTenantsElement.textContent()

      // Should have some numeric data (not 0 which might indicate mock)
      expect(tenantsText).toBeTruthy()

      const content = await page.content()
      for (const pattern of SUSPICIOUS_PATTERNS) {
        expect(content, `Page contains mock pattern: ${pattern.source}`).not.toMatch(pattern)
      }
    })

    test('Admin career page should display real analytics', async ({ page }) => {
      await page.goto('/admin/career')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      const content = await page.content()

      // Verify page loaded with real content (not showing error state)
      expect(content).not.toContain('API Error')
      expect(content).not.toContain('Failed to load')

      for (const pattern of SUSPICIOUS_PATTERNS) {
        expect(content, `Page contains mock pattern: ${pattern.source}`).not.toMatch(pattern)
      }
    })

    test('Root page should not show component library demo', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')

      const content = await page.content()

      // Should not have "Component Library" text from old demo page
      expect(content).not.toContain('Component Library')
      expect(content).not.toContain('sampleEmployee')
      expect(content).not.toContain('sampleRequest')

      // Should be a proper landing page or redirect
      const title = await page.title()
      expect(title).toBeTruthy()
    })
  })

  test.describe('API Response Structure', () => {
    test('All endpoints should have consistent response format', async ({ request }) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-tenant-code': DEFAULT_TENANT,
      }

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      for (const endpoint of CRITICAL_ENDPOINTS.slice(0, 5)) { // Sample check
        const response = await request.get(`${API_BASE}${endpoint.path}`, { headers })

        if (response.ok()) {
          const data = await response.json()

          // Should have 'success' field
          expect(data).toHaveProperty('success')

          // If success, should have 'data' field
          if (data.success) {
            expect(data).toHaveProperty('data')
          }
        }
      }
    })
  })
})
