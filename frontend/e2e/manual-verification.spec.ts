import { test, expect, type Page } from '@playwright/test'

test.describe('Manual Verification — Login Rotation', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  async function loginAs(page: Page, username: string, password: string) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.context().clearCookies()
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    const usernameField = page.locator('#username')
    await usernameField.waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(500)
    await usernameField.click()
    await usernameField.fill('')
    await usernameField.pressSequentially(username, { delay: 30 })
    const passwordField = page.locator('#password')
    await passwordField.click()
    await passwordField.fill('')
    await passwordField.pressSequentially(password, { delay: 30 })
    await page.click('button[type="submit"]')
    // Wait for redirect away from /login
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 30000 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')
  }

  test('1. rtl-admin: dashboard con dipendenti', async ({ page }) => {
    await loginAs(page, 'rtl-admin', 'Admin2026')

    // Should be on /admin
    expect(page.url()).toContain('/admin')

    // Wait for dashboard to load
    await page.waitForLoadState('networkidle')

    // Screenshot the dashboard
    await page.screenshot({ path: 'e2e/screenshots/verify-rtl-admin-dashboard.png', fullPage: true })

    // Check headcount number
    const headcountCard = page.locator('text=Headcount').first()
    await expect(headcountCard).toBeVisible({ timeout: 10000 })

    // Get the headcount value
    const pageContent = await page.textContent('body')
    console.log('=== RTL-ADMIN DASHBOARD ===')
    console.log('URL:', page.url())

    // Find headcount number
    const headcountMatch = pageContent?.match(/Headcount\s*(\d+)/)
    console.log('Headcount:', headcountMatch ? headcountMatch[1] : 'NOT FOUND')

    // Check turnover rate
    const turnoverMatch = pageContent?.match(/Turnover Rate\s*([\d.]+%?)/)
    console.log('Turnover Rate:', turnoverMatch ? turnoverMatch[1] : 'NOT FOUND')

    // Check engagement
    const engagementMatch = pageContent?.match(/Engagement\s*([\d./]+)/)
    console.log('Engagement:', engagementMatch ? engagementMatch[1] : 'NOT FOUND')

    // Navigate to employees page
    await page.goto('/admin/employees', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'e2e/screenshots/verify-rtl-admin-employees.png', fullPage: true })

    const empContent = await page.textContent('body')
    console.log('\n=== RTL-ADMIN EMPLOYEES PAGE ===')
    console.log('URL:', page.url())
    // Look for employee count indicator
    const empCountMatch = empContent?.match(/(\d+)\s*dipendenti/i) || empContent?.match(/Totale[:\s]*(\d+)/i)
    console.log('Employee count text:', empCountMatch ? empCountMatch[0] : 'checking table...')

    // Count table rows
    const rows = page.locator('table tbody tr, [role="row"]')
    const rowCount = await rows.count()
    console.log('Table rows visible:', rowCount)
  })

  test('2. sysadmin: platform pages e switch tenant', async ({ page }) => {
    await loginAs(page, 'sysadmin', 'Admin2026')

    console.log('=== SYSADMIN PLATFORM ===')
    console.log('URL:', page.url())
    expect(page.url()).toContain('/platform')

    // Wait for platform dashboard to load
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'e2e/screenshots/verify-sysadmin-platform.png', fullPage: true })

    const platformContent = await page.textContent('body')
    console.log('Platform Dashboard content:')
    const tenantCount = platformContent?.match(/Tenant\s*(\d+)/)
    console.log('  Tenants:', tenantCount ? tenantCount[1] : 'NOT FOUND')
    const tablesCount = platformContent?.match(/Tabelle DB\s*(\d+)/)
    console.log('  Tabelle DB:', tablesCount ? tablesCount[1] : 'NOT FOUND')

    // Check header shows "Tutti i Tenant"
    const header = page.locator('header[role="banner"]')
    const tenantButton = header.locator('button:has-text("Tutti i Tenant")')
    const hasTutti = await tenantButton.isVisible()
    console.log('  Header shows "Tutti i Tenant":', hasTutti)

    // Navigate to platform/tenants
    await page.goto('/platform/tenants', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'e2e/screenshots/verify-sysadmin-tenants.png', fullPage: true })
    console.log('\n=== PLATFORM TENANTS PAGE ===')
    console.log('URL:', page.url())

    // Navigate to platform/users
    await page.goto('/platform/users', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'e2e/screenshots/verify-sysadmin-users.png', fullPage: true })
    console.log('\n=== PLATFORM USERS PAGE ===')
    console.log('URL:', page.url())

    // Now switch to RTL Bank tenant
    console.log('\n=== SWITCHING TO RTL BANK ===')
    await page.goto('/platform', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    const tenantBtn = header.locator('button:has-text("Tutti i Tenant")')
    await tenantBtn.click()
    await page.waitForTimeout(500)
    const rtlOption = page.locator('[role="menuitem"]:has-text("RTL Bank")')
    await rtlOption.click()

    // Page reloads
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    console.log('After RTL Bank selection:')
    console.log('URL:', page.url())
    await page.screenshot({ path: 'e2e/screenshots/verify-sysadmin-rtlbank.png', fullPage: true })

    const afterContent = await page.textContent('body')
    const afterTenantCount = afterContent?.match(/Tenant\s*(\d+)/)
    console.log('  Tenants:', afterTenantCount ? afterTenantCount[1] : 'NOT FOUND')

    // Check header now shows "RTL Bank"
    const rtlButton = header.locator('button:has-text("RTL Bank")')
    const hasRtl = await rtlButton.isVisible()
    console.log('  Header shows "RTL Bank":', hasRtl)

    // Navigate to admin/employees with RTL Bank filter
    await page.goto('/admin/employees', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'e2e/screenshots/verify-sysadmin-rtlbank-employees.png', fullPage: true })
    console.log('\n=== SUPERUSER → ADMIN/EMPLOYEES (RTL Bank filtered) ===')
    console.log('URL:', page.url())
    const empRows = page.locator('table tbody tr, [role="row"]')
    const empRowCount = await empRows.count()
    console.log('Table rows visible:', empRowCount)

    // Now switch to SmartFood
    console.log('\n=== SWITCHING TO SMARTFOOD ===')
    const currentTenantBtn = header.locator('button:has-text("RTL Bank")')
    await currentTenantBtn.click()
    await page.waitForTimeout(500)
    const sfOption = page.locator('[role="menuitem"]:has-text("SmartFood")')
    await sfOption.click()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    console.log('After SmartFood selection:')
    console.log('URL:', page.url())

    // Check header shows SmartFood
    const sfButton = header.locator('button:has-text("SmartFood")')
    const hasSf = await sfButton.isVisible()
    console.log('  Header shows "SmartFood":', hasSf)

    await page.goto('/admin/employees', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'e2e/screenshots/verify-sysadmin-smartfood-employees.png', fullPage: true })
    console.log('\n=== SUPERUSER → ADMIN/EMPLOYEES (SmartFood filtered) ===')
    const sfRows = page.locator('table tbody tr, [role="row"]')
    const sfRowCount = await sfRows.count()
    console.log('Table rows visible:', sfRowCount)

    // Switch back to "Tutti i Tenant"
    console.log('\n=== SWITCHING BACK TO TUTTI I TENANT ===')
    const sfTenantBtn = header.locator('button:has-text("SmartFood")')
    await sfTenantBtn.click()
    await page.waitForTimeout(500)
    const tuttiOption = page.locator('[role="menuitem"]:has-text("Tutti i Tenant")')
    await tuttiOption.click()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    const tuttiButton = header.locator('button:has-text("Tutti i Tenant")')
    const hasTuttiAgain = await tuttiButton.isVisible()
    console.log('Header shows "Tutti i Tenant":', hasTuttiAgain)
    await page.screenshot({ path: 'e2e/screenshots/verify-sysadmin-tutti-restored.png', fullPage: true })
  })
})
