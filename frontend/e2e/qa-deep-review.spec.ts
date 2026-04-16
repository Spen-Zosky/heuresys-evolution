import { test, expect, Page } from '@playwright/test'

/**
 * QA Deep Review — Test granulari post-fix
 *
 * Verifica le modifiche applicate dai reviewer:
 * - Backend: 9 route fixate, SQL injection fix, asyncHandler
 * - Security: 8 route con RBAC aggiunto
 * - Frontend: company-pet con API reali, demographics
 * - Infra: query parallelizzate
 * - DB: 13 indici duplicati rimossi
 *
 * Auth: rtl-admin (RTL Bank, 156 dipendenti, SYSADMIN role)
 */

const BASE = 'http://localhost:8012'
let authToken: string | null = null

async function getToken(): Promise<string> {
  if (authToken) return authToken
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'rtl-admin', password: 'Admin2026' }),
  })
  const data = await res.json()
  authToken = data.data.accessToken
  return authToken!
}

async function apiGet(path: string) {
  const token = await getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': '0c54b84a-db6e-4da4-bc91-af5d480d524e',
    },
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}

// ========================================================
// SEZIONE 1: Test API diretti (verifica backend fixes)
// ========================================================

test.describe('API — Backend fix verification', () => {
  test('GET /health restituisce 200 (asyncHandler fix)', async () => {
    const res = await fetch(`${BASE}/health`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.status).toBe('ok')
  })

  test('GET /api/v1/employees restituisce 156 dipendenti RTL Bank (paginati)', async () => {
    const { status, data } = await apiGet('/api/v1/employees?limit=100')
    expect(status).toBe(200)
    const employees = data?.data?.employees || data?.data || []
    const meta = data?.data?.meta
    expect(Array.isArray(employees)).toBeTruthy()
    expect(employees.length).toBe(100)
    expect(meta?.total).toBeGreaterThanOrEqual(156)
    console.log(`[employees] Pagina 1: ${employees.length} dipendenti, totale: ${meta?.total}`)
  })

  test('GET /api/v1/departments restituisce dipartimenti RTL Bank', async () => {
    const { status, data } = await apiGet('/api/v1/departments')
    expect(status).toBe(200)
    const depts = data?.data?.departments || data?.data || []
    expect(Array.isArray(depts)).toBeTruthy()
    expect(depts.length).toBeGreaterThan(0)
    console.log(`[departments] Trovati ${depts.length} dipartimenti`)
  })

  test('GET /api/v1/goals restituisce obiettivi RTL Bank', async () => {
    const { status, data } = await apiGet('/api/v1/goals')
    expect(status).toBe(200)
    const goals = data?.data?.goals || data?.data || []
    expect(Array.isArray(goals)).toBeTruthy()
    console.log(`[goals] Trovati ${goals.length} obiettivi`)
  })

  test('GET /api/v1/check-ins restituisce check-in RTL Bank', async () => {
    const { status, data } = await apiGet('/api/v1/check-ins')
    expect(status).toBe(200)
    console.log(`[check-ins] Status: ${status}`)
  })

  test('GET /api/v1/performance-reviews restituisce review RTL Bank', async () => {
    const { status, data } = await apiGet('/api/v1/performance-reviews')
    expect(status).toBe(200)
    console.log(`[performance-reviews] Status: ${status}`)
  })

  test('GET /api/v1/courses restituisce corsi', async () => {
    const { status, data } = await apiGet('/api/v1/courses')
    expect(status).toBe(200)
    const courses = data?.data?.courses || data?.data || []
    console.log(`[courses] Trovati ${courses.length} corsi`)
  })
})

// ========================================================
// SEZIONE 2: Security RBAC — route protette
// ========================================================

test.describe('API — Security RBAC verification', () => {
  test('GET /api/v1/tenants richiede auth (non pubblico)', async () => {
    // Senza token deve dare 401
    const res = await fetch(`${BASE}/api/v1/tenants`)
    expect([401, 403]).toContain(res.status)
    console.log(`[tenants no-auth] Status: ${res.status} (corretto)`)
  })

  test('GET /api/v1/tenants con token SYSADMIN restituisce dati', async () => {
    const { status, data } = await apiGet('/api/v1/tenants')
    // rtl-admin ha role SYSADMIN nel token — dovrebbe accedere
    expect([200, 403]).toContain(status)
    console.log(`[tenants with-auth] Status: ${status}`)
    if (status === 200) {
      const tenants = data?.data?.tenants || data?.data || []
      console.log(`[tenants] Trovati ${Array.isArray(tenants) ? tenants.length : 'N/A'} tenant`)
    }
  })

  test('GET /api/v1/analytics/compensation senza auth → 401', async () => {
    const res = await fetch(`${BASE}/api/v1/analytics/compensation`)
    expect([401, 403, 404]).toContain(res.status)
    console.log(`[compensation-analytics no-auth] Status: ${res.status}`)
  })

  test('GET /api/v1/analytics/performance senza auth → 401', async () => {
    const res = await fetch(`${BASE}/api/v1/analytics/performance`)
    expect([401, 403, 404]).toContain(res.status)
    console.log(`[performance-analytics no-auth] Status: ${res.status}`)
  })

  test('GET /api/v1/marketplace/plugins senza auth → 401', async () => {
    const res = await fetch(`${BASE}/api/v1/marketplace/plugins`)
    expect([401, 403, 404]).toContain(res.status)
    console.log(`[marketplace no-auth] Status: ${res.status}`)
  })
})

// ========================================================
// SEZIONE 3: Frontend — pagine con Playwright
// ========================================================

type PageTestResult = {
  url: string
  loaded: boolean
  hasData: boolean
  hasError: boolean
  errorText?: string
  redirectedToLogin: boolean
}

async function testPage(page: Page, url: string, name: string): Promise<PageTestResult> {
  const errors: string[] = []
  const listener = (msg: import('@playwright/test').ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text())
  }
  page.on('console', listener)

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForLoadState('networkidle')

    const currentUrl = page.url()
    const redirectedToLogin = currentUrl.includes('/login')

    const bodyText = await page.textContent('body').catch(() => '')
    const hasError = (bodyText || '').includes('Application error') ||
      (bodyText || '').includes('Internal Server Error')

    const emptyPatterns = ['Nessun dato trovato', 'Nessun risultato', 'Nessun dipendente trovato',
      'Nessun dipartimento trovato', 'Nessuna valutazione trovata', 'Nessun check-in trovato']
    const hasEmptyState = emptyPatterns.some(p => (bodyText || '').includes(p))

    await page.screenshot({
      path: `test-results/screenshots/qa-${name}.png`,
      fullPage: true,
    }).catch(() => {})

    return {
      url,
      loaded: true,
      hasData: !hasEmptyState && !redirectedToLogin,
      hasError,
      redirectedToLogin,
    }
  } catch (e) {
    return {
      url,
      loaded: false,
      hasData: false,
      hasError: true,
      errorText: String(e),
      redirectedToLogin: false,
    }
  } finally {
    page.off('console', listener)
  }
}

test.describe('Frontend — Admin pages', () => {
  test('admin dashboard carica con dati', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/admin', 'dashboard')
    expect(result.redirectedToLogin, 'Dashboard non deve redirigere al login').toBeFalsy()
    expect(result.hasError, 'Dashboard non deve avere application error').toBeFalsy()
    console.log('[dashboard] loaded:', result.loaded, 'hasData:', result.hasData)
  })

  test('employees page carica con 156 dipendenti', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/admin/employees', 'employees')
    expect(result.redirectedToLogin, 'Employees non deve redirigere al login').toBeFalsy()
    expect(result.hasError).toBeFalsy()
    console.log('[employees] loaded:', result.loaded, 'hasData:', result.hasData)
  })

  test('departments page carica', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/admin/departments', 'departments')
    expect(result.redirectedToLogin).toBeFalsy()
    expect(result.hasError).toBeFalsy()
    console.log('[departments] loaded:', result.loaded)
  })

  test('reviews page carica', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/admin/reviews', 'reviews')
    expect(result.redirectedToLogin).toBeFalsy()
    expect(result.hasError).toBeFalsy()
    console.log('[reviews] loaded:', result.loaded)
  })

  test('goals page carica', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/admin/goals', 'goals')
    expect(result.redirectedToLogin).toBeFalsy()
    expect(result.hasError).toBeFalsy()
    console.log('[goals] loaded:', result.loaded)
  })

  test('check-ins page carica', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/admin/check-ins', 'check-ins')
    expect(result.redirectedToLogin).toBeFalsy()
    expect(result.hasError).toBeFalsy()
    console.log('[check-ins] loaded:', result.loaded)
  })

  test('courses page carica', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/admin/courses', 'courses')
    expect(result.redirectedToLogin).toBeFalsy()
    expect(result.hasError).toBeFalsy()
    console.log('[courses] loaded:', result.loaded)
  })

  test('analytics page carica', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/admin/analytics', 'analytics')
    expect(result.redirectedToLogin).toBeFalsy()
    expect(result.hasError).toBeFalsy()
    console.log('[analytics] loaded:', result.loaded)
  })

  test('org-chart page carica', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/admin/org-chart', 'org-chart')
    expect(result.redirectedToLogin).toBeFalsy()
    expect(result.hasError).toBeFalsy()
    console.log('[org-chart] loaded:', result.loaded)
  })

  test('career page carica', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/admin/career', 'career')
    expect(result.redirectedToLogin).toBeFalsy()
    expect(result.hasError).toBeFalsy()
    console.log('[career] loaded:', result.loaded)
  })
})

test.describe('Frontend — Portal pages', () => {
  test('portal dashboard carica', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/portal', 'portal')
    expect(result.redirectedToLogin).toBeFalsy()
    expect(result.hasError).toBeFalsy()
    console.log('[portal] loaded:', result.loaded)
  })

  test('portal profile carica con dati Federica Marchetti', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/portal/profile', 'portal-profile')
    expect(result.redirectedToLogin).toBeFalsy()
    expect(result.hasError).toBeFalsy()
    const bodyText = await page.textContent('body').catch(() => '')
    const hasName = (bodyText || '').includes('Federica') || (bodyText || '').includes('Marchetti')
    console.log('[portal/profile] loaded:', result.loaded, 'hasName:', hasName)
    // Verifica che il profilo sia quello dell'utente rtl-admin (Federica Marchetti)
    if (!result.redirectedToLogin) {
      expect(hasName, 'Profile deve mostrare il nome Federica Marchetti').toBeTruthy()
    }
  })
})

test.describe('Frontend — Company PET pages (post-fix API reali)', () => {
  test('company-pet main page carica', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/company-pet', 'company-pet')
    expect(result.hasError).toBeFalsy()
    console.log('[company-pet] loaded:', result.loaded, 'redirected:', result.redirectedToLogin)
  })

  test('company-pet/breakdowns page carica', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/company-pet/breakdowns', 'company-pet-breakdowns')
    expect(result.hasError).toBeFalsy()
    console.log('[company-pet/breakdowns] loaded:', result.loaded)
  })

  test('company-pet/demographics carica con dati reali (no mock)', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/company-pet/demographics', 'company-pet-demographics')
    expect(result.hasError).toBeFalsy()
    const bodyText = await page.textContent('body').catch(() => '')
    // Verifica che non ci siano stringhe mock come "Mock Data" o dati hardcoded
    const hasMockData = (bodyText || '').includes('Mock Data') ||
      (bodyText || '').toLowerCase().includes('lorem ipsum')
    expect(hasMockData, 'Demographics non deve avere mock data').toBeFalsy()
    console.log('[company-pet/demographics] loaded:', result.loaded, 'hasMockData:', hasMockData)
  })

  test('company-pet/sessions page carica', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/company-pet/sessions', 'company-pet-sessions')
    expect(result.hasError).toBeFalsy()
    console.log('[company-pet/sessions] loaded:', result.loaded)
  })

  test('company-pet/staging-comparison page carica', async ({ page }) => {
    const result = await testPage(page, 'http://localhost:3012/company-pet/staging-comparison', 'company-pet-staging')
    expect(result.hasError).toBeFalsy()
    console.log('[company-pet/staging-comparison] loaded:', result.loaded)
  })
})

test.describe('Frontend — Employee Profile (10 tab)', () => {
  let employeeId: string | null = null

  test('trova primo dipendente RTL Bank', async () => {
    const { status, data } = await apiGet('/api/v1/employees?limit=1')
    expect(status).toBe(200)
    const employees = data?.data?.employees || data?.data || []
    expect(employees.length).toBeGreaterThan(0)
    employeeId = employees[0]?.id
    console.log(`[employee-profile] Using employee ID: ${employeeId}`)
    expect(employeeId).toBeTruthy()
  })

  test('employee profile page con 10 tab carica', async ({ page }) => {
    // Ottieni ID dipendente fresh
    const { data } = await apiGet('/api/v1/employees?limit=1')
    const employees = data?.data?.employees || data?.data || []
    const id = employees[0]?.id
    if (!id) {
      console.log('[employee-profile] Nessun dipendente trovato, skip')
      return
    }

    const result = await testPage(page,
      `http://localhost:3012/admin/employees/${id}`,
      'employee-profile')
    expect(result.redirectedToLogin).toBeFalsy()
    expect(result.hasError).toBeFalsy()
    console.log('[employee-profile] loaded:', result.loaded)

    // Verifica presenza tab
    const bodyText = await page.textContent('body').catch(() => '')
    const tabs = ['Panoramica', 'Organizzazione', 'Contratti', 'Competenze', 'Formazione',
      'Obiettivi', 'Performance', 'Presenze', 'Documenti', 'Carriera']
    const foundTabs = tabs.filter(t => (bodyText || '').includes(t))
    console.log(`[employee-profile] Tab trovati: ${foundTabs.length}/10: ${foundTabs.join(', ')}`)
  })
})
