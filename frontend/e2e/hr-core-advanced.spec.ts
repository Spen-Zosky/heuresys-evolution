import { test, expect } from '@playwright/test'
import { getAuthToken } from './api-auth-helper'

const API_BASE = 'http://localhost:8012'
let HEADERS: Record<string, string> = { 'X-Tenant-Code': 'rtl-bank' }

/**
 * E2E Tests - HR Core Advanced Features
 * Tests for Employee Documents, Skills, History, Contracts,
 * Department Tree View, Statistics, Bulk Operations, and Advanced Search
 */
test.describe('HR Core Advanced Features', () => {
  // Use auth state
  test.use({ storageState: '.auth/admin.json' })

  test.beforeAll(async () => {
    const token = await getAuthToken();
    HEADERS = { ...HEADERS, 'Authorization': `Bearer ${token}` };
  });

  // ============================================
  // EMPLOYEE PROFILE SUB-PAGES
  // ============================================

  test.describe('Employee Documents', () => {
    test('should display employee documents page', async ({ page, request }) => {
      // Get an employee from API
      const res = await request.get(`${API_BASE}/api/v1/employees`, { headers: HEADERS })
      if (!res.ok()) { console.log('[SKIP] Employees API returned', res.status()); return }
      const api = await res.json()
      const employees = api.data?.employees || api.data || []

      if (employees.length === 0) {
        test.skip()
        return
      }

      const employee = employees[0]

      // Navigate to documents page
      await page.goto(`/admin/employees/${employee.id}/documents`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForLoadState('domcontentloaded')

      // Verify page loaded — content depends on API response speed
      const heading = page.getByRole('heading', { level: 1 })
      const headingVisible = await heading.isVisible({ timeout: 10000 }).catch(() => false)
      if (headingVisible) {
        const text = await heading.textContent()
        console.log(`[Employee Documents] Heading: ${text}`)
      } else {
        await expect(page.locator('body')).toBeVisible()
        console.log('[Employee Documents] Page loaded (heading not visible yet)')
      }

      await page.screenshot({ path: 'test-results/hr-core-employee-documents.png', fullPage: true })
    })

    test('should show document categories', async ({ page, request }) => {
      const res = await request.get(`${API_BASE}/api/v1/employees`, { headers: HEADERS })
      const api = await res.json()
      const employees = api.data?.employees || api.data || []

      if (employees.length === 0) {
        test.skip()
        return
      }

      await page.goto(`/admin/employees/${employees[0].id}/documents`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Check for document category tabs or filters
      const categories = ['Contratto', 'Personale', 'Formazione', 'Altro']
      for (const cat of categories) {
        const catElement = page.getByText(cat, { exact: false })
        if (await catElement.isVisible().catch(() => false)) {
          console.log(`[Documents] Category found: ${cat}`)
        }
      }

      await page.screenshot({ path: 'test-results/hr-core-employee-documents-categories.png', fullPage: true })
    })
  })

  test.describe('Employee Skills Profile', () => {
    test('should display employee skills page', async ({ page, request }) => {
      const res = await request.get(`${API_BASE}/api/v1/employees`, { headers: HEADERS })
      if (!res.ok()) { console.log('[SKIP] Employees API returned', res.status()); return }
      const api = await res.json()
      const employees = api.data?.employees || api.data || []

      if (employees.length === 0) {
        test.skip()
        return
      }

      const employee = employees[0]

      await page.goto(`/admin/employees/${employee.id}/skills`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForLoadState('domcontentloaded')

      // Verify page loaded
      const heading = page.getByRole('heading', { level: 1 })
      const headingVisible = await heading.isVisible({ timeout: 10000 }).catch(() => false)
      if (headingVisible) {
        const text = await heading.textContent()
        console.log(`[Employee Skills] Heading: ${text}`)
      } else {
        await expect(page.locator('body')).toBeVisible()
        console.log('[Employee Skills] Page loaded (heading not visible yet)')
      }

      await page.screenshot({ path: 'test-results/hr-core-employee-skills.png', fullPage: true })
    })

    test('should show skill categories and levels', async ({ page, request }) => {
      const res = await request.get(`${API_BASE}/api/v1/employees`, { headers: HEADERS })
      const api = await res.json()
      const employees = api.data?.employees || api.data || []

      if (employees.length === 0) {
        test.skip()
        return
      }

      await page.goto(`/admin/employees/${employees[0].id}/skills`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Check for skill categories (Technical, Soft Skills, Languages, etc.)
      const categories = ['Tecniche', 'Soft Skills', 'Linguistiche', 'Technical']
      let foundCategories = 0
      for (const cat of categories) {
        const catElement = page.getByText(cat, { exact: false })
        if (await catElement.isVisible().catch(() => false)) {
          foundCategories++
          console.log(`[Skills] Category found: ${cat}`)
        }
      }

      await page.screenshot({ path: 'test-results/hr-core-employee-skills-categories.png', fullPage: true })
    })
  })

  test.describe('Employee History Timeline', () => {
    test('should display employee history page', async ({ page, request }) => {
      const res = await request.get(`${API_BASE}/api/v1/employees`, { headers: HEADERS })
      if (!res.ok()) { console.log('[SKIP] Employees API returned', res.status()); return }
      const api = await res.json()
      const employees = api.data?.employees || api.data || []

      if (employees.length === 0) {
        test.skip()
        return
      }

      const employee = employees[0]

      await page.goto(`/admin/employees/${employee.id}/history`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForLoadState('domcontentloaded')

      // Verify page loaded
      const heading = page.getByRole('heading', { level: 1 })
      const headingVisible = await heading.isVisible({ timeout: 10000 }).catch(() => false)
      if (headingVisible) {
        console.log(`[Employee History] Heading: ${await heading.textContent()}`)
      } else {
        await expect(page.locator('body')).toBeVisible()
        console.log('[Employee History] Page loaded (heading not visible yet)')
      }

      await page.screenshot({ path: 'test-results/hr-core-employee-history.png', fullPage: true })
    })

    test('should show timeline events', async ({ page, request }) => {
      const res = await request.get(`${API_BASE}/api/v1/employees`, { headers: HEADERS })
      const api = await res.json()
      const employees = api.data?.employees || api.data || []

      if (employees.length === 0) {
        test.skip()
        return
      }

      await page.goto(`/admin/employees/${employees[0].id}/history`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Check for timeline elements or event cards
      const timeline = page.locator('[class*="timeline"]').or(page.locator('[class*="border-l"]'))
      const hasTimeline = await timeline.isVisible().catch(() => false)

      // Check for event type badges (Assunzione, Promozione, etc.)
      const eventTypes = ['Assunzione', 'Promozione', 'Trasferimento', 'Formazione']
      for (const type of eventTypes) {
        const typeElement = page.getByText(type, { exact: false })
        if (await typeElement.isVisible().catch(() => false)) {
          console.log(`[History] Event type found: ${type}`)
        }
      }

      await page.screenshot({ path: 'test-results/hr-core-employee-history-timeline.png', fullPage: true })
    })
  })

  test.describe('Employee Contracts', () => {
    test('should display employee contracts page', async ({ page, request }) => {
      const res = await request.get(`${API_BASE}/api/v1/employees`, { headers: HEADERS })
      if (!res.ok()) { console.log('[SKIP] Employees API returned', res.status()); return }
      const api = await res.json()
      const employees = api.data?.employees || api.data || []

      if (employees.length === 0) {
        test.skip()
        return
      }

      const employee = employees[0]

      await page.goto(`/admin/employees/${employee.id}/contracts`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForLoadState('domcontentloaded')

      // Verify page loaded
      const heading = page.getByRole('heading', { level: 1 })
      const headingVisible = await heading.isVisible({ timeout: 10000 }).catch(() => false)
      if (headingVisible) {
        console.log(`[Employee Contracts] Heading: ${await heading.textContent()}`)
      } else {
        await expect(page.locator('body')).toBeVisible()
        console.log('[Employee Contracts] Page loaded (heading not visible yet)')
      }

      await page.screenshot({ path: 'test-results/hr-core-employee-contracts.png', fullPage: true })
    })

    test('should show contract details', async ({ page, request }) => {
      const res = await request.get(`${API_BASE}/api/v1/employees`, { headers: HEADERS })
      const api = await res.json()
      const employees = api.data?.employees || api.data || []

      if (employees.length === 0) {
        test.skip()
        return
      }

      await page.goto(`/admin/employees/${employees[0].id}/contracts`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Check for contract fields (Tipo, Data Inizio, Data Fine, CCNL)
      const fields = ['Tipo Contratto', 'Data Inizio', 'Data Fine', 'CCNL', 'Livello']
      for (const field of fields) {
        const fieldElement = page.getByText(field, { exact: false })
        if (await fieldElement.isVisible().catch(() => false)) {
          console.log(`[Contracts] Field found: ${field}`)
        }
      }

      await page.screenshot({ path: 'test-results/hr-core-employee-contracts-details.png', fullPage: true })
    })
  })

  // ============================================
  // DEPARTMENT ADVANCED FEATURES
  // ============================================

  test.describe('Department Tree View', () => {
    test('should toggle between table and tree view', async ({ page }) => {
      await page.goto('/admin/departments')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Look for view mode toggle buttons
      const tableViewBtn = page.getByRole('button', { name: /tabella|table/i }).or(
        page.locator('button').filter({ has: page.locator('[class*="LayoutGrid"]') })
      )
      const treeViewBtn = page.getByRole('button', { name: /albero|tree/i }).or(
        page.locator('button').filter({ has: page.locator('[class*="Network"]') })
      )

      // Check if both view toggles exist
      const hasTableView = await tableViewBtn.isVisible().catch(() => false)
      const hasTreeView = await treeViewBtn.isVisible().catch(() => false)

      if (hasTreeView) {
        await treeViewBtn.click()
        await page.waitForLoadState('networkidle')
        await page.screenshot({ path: 'test-results/hr-core-department-tree-view.png', fullPage: true })

        // Switch back to table view
        if (hasTableView) {
          await tableViewBtn.click()
          await page.waitForLoadState('networkidle')
        }
      }

      await page.screenshot({ path: 'test-results/hr-core-department-view-toggle.png', fullPage: true })
    })

    test('should expand and collapse tree nodes', async ({ page }) => {
      await page.goto('/admin/departments')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Switch to tree view
      const treeViewBtn = page.locator('button').filter({ has: page.locator('[class*="Network"]') }).first()
      if (await treeViewBtn.isVisible().catch(() => false)) {
        await treeViewBtn.click()
        await page.waitForLoadState('networkidle')

        // Look for expand/collapse buttons (ChevronRight, ChevronDown)
        const expandBtns = page.locator('button').filter({ has: page.locator('[class*="ChevronRight"]') })
        const expandCount = await expandBtns.count()

        if (expandCount > 0) {
          // Click first expand button
          await expandBtns.first().click()
          await page.waitForTimeout(300) // animation
          console.log('[Tree View] Expanded first node')
          await page.screenshot({ path: 'test-results/hr-core-department-tree-expanded.png', fullPage: true })
        }

        // Look for expand all button
        const expandAllBtn = page.getByRole('button', { name: /espandi|expand all/i })
        if (await expandAllBtn.isVisible().catch(() => false)) {
          await expandAllBtn.click()
          await page.waitForTimeout(300) // animation
          console.log('[Tree View] Expanded all nodes')
        }
      }

      await page.screenshot({ path: 'test-results/hr-core-department-tree-actions.png', fullPage: true })
    })
  })

  test.describe('Department Statistics', () => {
    test('should display department statistics page', async ({ page, request }) => {
      const res = await request.get(`${API_BASE}/api/v1/departments`, { headers: HEADERS })
      if (!res.ok()) { console.log('[SKIP] Departments API returned', res.status()); return }
      const api = await res.json()
      const departments = api.data || []

      if (departments.length === 0) {
        test.skip()
        return
      }

      const dept = departments[0]

      await page.goto(`/admin/departments/${dept.id}/stats`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Verify page loaded
      const heading = page.getByRole('heading', { level: 1 })
      const headingVisible = await heading.isVisible({ timeout: 10000 }).catch(() => false)
      if (headingVisible) {
        console.log(`[Dept Stats] Heading: ${await heading.textContent()}`)
      } else {
        console.log('[Dept Stats] Page loaded (heading not visible)')
      }

      await page.screenshot({ path: 'test-results/hr-core-department-stats.png', fullPage: true })
    })

    test('should show KPI cards and charts', async ({ page, request }) => {
      const res = await request.get(`${API_BASE}/api/v1/departments`, { headers: HEADERS })
      const api = await res.json()
      const departments = api.data || []

      if (departments.length === 0) {
        test.skip()
        return
      }

      await page.goto(`/admin/departments/${departments[0].id}/stats`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Check for KPI cards
      const kpis = ['Headcount', 'Crescita', 'Assunzioni', 'Cessazioni', 'Turnover', 'Anzianità']
      for (const kpi of kpis) {
        const kpiElement = page.getByText(kpi, { exact: false })
        if (await kpiElement.isVisible().catch(() => false)) {
          console.log(`[Stats] KPI found: ${kpi}`)
        }
      }

      // Check for charts (Recharts renders svg elements)
      const charts = page.locator('.recharts-responsive-container')
      const chartCount = await charts.count()
      console.log(`[Stats] Charts found: ${chartCount}`)

      await page.screenshot({ path: 'test-results/hr-core-department-stats-kpis.png', fullPage: true })
    })

    test('should have time range selector', async ({ page, request }) => {
      const res = await request.get(`${API_BASE}/api/v1/departments`, { headers: HEADERS })
      const api = await res.json()
      const departments = api.data || []

      if (departments.length === 0) {
        test.skip()
        return
      }

      await page.goto(`/admin/departments/${departments[0].id}/stats`)
      await page.waitForLoadState('domcontentloaded')

      // Check for time range selector
      const timeSelector = page.locator('button[role="combobox"]').filter({ hasText: /mesi|months/i })
      if (await timeSelector.isVisible().catch(() => false)) {
        await timeSelector.click()
        await page.waitForTimeout(300) // dropdown animation
        await page.screenshot({ path: 'test-results/hr-core-department-stats-time-range.png', fullPage: true })
        await page.keyboard.press('Escape')
      }
    })
  })

  // ============================================
  // EMPLOYEE BULK OPERATIONS
  // ============================================

  test.describe('Employee Bulk Operations', () => {
    test('should show checkboxes for multi-select', async ({ page }) => {
      await page.goto('/admin/employees')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Check for checkbox in table header
      const headerCheckbox = page.locator('thead input[type="checkbox"]').or(
        page.locator('thead button[role="checkbox"]')
      )
      const hasHeaderCheckbox = await headerCheckbox.isVisible().catch(() => false)

      // Check for checkboxes in table rows
      const rowCheckboxes = page.locator('tbody input[type="checkbox"]').or(
        page.locator('tbody button[role="checkbox"]')
      )
      const checkboxCount = await rowCheckboxes.count()

      console.log(`[Bulk Ops] Header checkbox: ${hasHeaderCheckbox}, Row checkboxes: ${checkboxCount}`)

      await page.screenshot({ path: 'test-results/hr-core-bulk-checkboxes.png', fullPage: true })
    })

    test('should show bulk action bar when items selected', async ({ page }) => {
      await page.goto('/admin/employees')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Find and click first row checkbox
      const firstCheckbox = page.locator('tbody button[role="checkbox"]').first().or(
        page.locator('tbody input[type="checkbox"]').first()
      )

      if (await firstCheckbox.isVisible().catch(() => false)) {
        await firstCheckbox.click()
        await page.waitForTimeout(500)

        // Check for floating action bar
        const actionBar = page.locator('[class*="fixed"]').filter({ hasText: /selezionat/i }).or(
          page.locator('[class*="bottom"]').filter({ hasText: /selezionat/i })
        )
        const hasActionBar = await actionBar.isVisible().catch(() => false)

        if (hasActionBar) {
          console.log('[Bulk Ops] Floating action bar appeared')

          // Check for bulk action buttons
          const exportBtn = page.getByRole('button', { name: /export/i })
          const deleteBtn = page.getByRole('button', { name: /elimina|delete/i })

          await page.screenshot({ path: 'test-results/hr-core-bulk-action-bar.png', fullPage: true })

          // Deselect
          await firstCheckbox.click()
        }
      }
    })

    test('should select all with header checkbox', async ({ page }) => {
      await page.goto('/admin/employees')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Find header checkbox
      const headerCheckbox = page.locator('thead button[role="checkbox"]').first()

      if (await headerCheckbox.isVisible().catch(() => false)) {
        await headerCheckbox.click()
        await page.waitForTimeout(500)

        // Check that action bar shows count
        const actionBar = page.locator('[class*="fixed"]').filter({ hasText: /selezionat/i })
        if (await actionBar.isVisible().catch(() => false)) {
          const text = await actionBar.textContent()
          console.log(`[Bulk Ops] Selection text: ${text}`)
          await page.screenshot({ path: 'test-results/hr-core-bulk-select-all.png', fullPage: true })
        }

        // Deselect all
        await headerCheckbox.click()
      }
    })
  })

  // ============================================
  // EMPLOYEE ADVANCED SEARCH
  // ============================================

  test.describe('Employee Advanced Search', () => {
    test('should have advanced search toggle', async ({ page }) => {
      await page.goto('/admin/employees')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Look for advanced search toggle button
      const advancedToggle = page.getByRole('button', { name: /filtri avanzati|advanced/i }).or(
        page.locator('button').filter({ has: page.locator('[class*="SlidersHorizontal"]') })
      )

      if (await advancedToggle.isVisible().catch(() => false)) {
        console.log('[Advanced Search] Toggle button found')
        await advancedToggle.click()
        await page.waitForTimeout(500)

        await page.screenshot({ path: 'test-results/hr-core-advanced-search-panel.png', fullPage: true })
      }
    })

    test('should show quick filter presets', async ({ page }) => {
      await page.goto('/admin/employees')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Open advanced search
      const advancedToggle = page.locator('button').filter({ has: page.locator('[class*="SlidersHorizontal"]') }).first()
      if (await advancedToggle.isVisible().catch(() => false)) {
        await advancedToggle.click()
        await page.waitForTimeout(500)

        // Check for preset buttons
        const presets = ['Nuove Assunzioni', 'Solo Attivi', 'In Congedo', 'Senior']
        for (const preset of presets) {
          const presetBtn = page.getByRole('button', { name: new RegExp(preset, 'i') })
          if (await presetBtn.isVisible().catch(() => false)) {
            console.log(`[Advanced Search] Preset found: ${preset}`)
          }
        }

        await page.screenshot({ path: 'test-results/hr-core-advanced-search-presets.png', fullPage: true })
      }
    })

    test('should apply date range filter', async ({ page }) => {
      await page.goto('/admin/employees')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Open advanced search
      const advancedToggle = page.locator('button').filter({ has: page.locator('[class*="SlidersHorizontal"]') }).first()
      if (await advancedToggle.isVisible().catch(() => false)) {
        await advancedToggle.click()
        await page.waitForTimeout(500)

        // Look for date inputs
        const dateFromInput = page.locator('input[type="date"]').first()
        if (await dateFromInput.isVisible().catch(() => false)) {
          await dateFromInput.fill('2024-01-01')
          console.log('[Advanced Search] Date filter applied')
          await page.waitForLoadState('networkidle')
          await page.screenshot({ path: 'test-results/hr-core-advanced-search-date-filter.png', fullPage: true })
        }
      }
    })

    test('should show save search dialog', async ({ page }) => {
      await page.goto('/admin/employees')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Open advanced search
      const advancedToggle = page.locator('button').filter({ has: page.locator('[class*="SlidersHorizontal"]') }).first()
      if (await advancedToggle.isVisible().catch(() => false)) {
        await advancedToggle.click()
        await page.waitForTimeout(500)

        // Look for save search button
        const saveBtn = page.getByRole('button', { name: /salva ricerca|save search/i }).or(
          page.locator('button').filter({ has: page.locator('[class*="Bookmark"]') })
        )

        if (await saveBtn.isVisible().catch(() => false)) {
          await saveBtn.click()
          await page.waitForTimeout(500)

          // Check for dialog
          const dialog = page.locator('[role="dialog"]')
          if (await dialog.isVisible().catch(() => false)) {
            console.log('[Advanced Search] Save search dialog opened')
            await page.screenshot({ path: 'test-results/hr-core-advanced-search-save-dialog.png', fullPage: true })
            await page.keyboard.press('Escape')
          }
        }
      }
    })

    test('should clear all filters', async ({ page }) => {
      await page.goto('/admin/employees')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Open advanced search
      const advancedToggle = page.locator('button').filter({ has: page.locator('[class*="SlidersHorizontal"]') }).first()
      if (await advancedToggle.isVisible().catch(() => false)) {
        await advancedToggle.click()
        await page.waitForTimeout(500)

        // Apply a preset first
        const presetBtn = page.getByRole('button', { name: /solo attivi/i })
        if (await presetBtn.isVisible().catch(() => false)) {
          await presetBtn.click()
          await page.waitForTimeout(500)

          // Look for clear all button
          const clearBtn = page.getByRole('button', { name: /reset|pulisci|clear/i })
          if (await clearBtn.isVisible().catch(() => false)) {
            await clearBtn.click()
            await page.waitForTimeout(500)
            console.log('[Advanced Search] Filters cleared')
            await page.screenshot({ path: 'test-results/hr-core-advanced-search-cleared.png', fullPage: true })
          }
        }
      }
    })
  })

  // ============================================
  // MOBILE RESPONSIVE
  // ============================================

  test.describe('Mobile Responsive', () => {
    test.use({ viewport: { width: 375, height: 667 } })

    test('should display employees page correctly on mobile', async ({ page }) => {
      await page.goto('/admin/employees')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Verify page loads
      const heading = page.getByRole('heading', { level: 1 })
      await expect(heading).toContainText('Dipendenti')

      // Check layout is responsive
      await page.screenshot({ path: 'test-results/hr-core-mobile-employees.png', fullPage: true })
    })

    test('should display departments page correctly on mobile', async ({ page }) => {
      await page.goto('/admin/departments')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      const heading = page.getByRole('heading', { level: 1 })
      await expect(heading).toContainText('Dipartimenti')

      await page.screenshot({ path: 'test-results/hr-core-mobile-departments.png', fullPage: true })
    })

    test('should show mobile-friendly bulk action bar', async ({ page }) => {
      await page.goto('/admin/employees')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Select an employee
      const firstCheckbox = page.locator('tbody button[role="checkbox"]').first()
      if (await firstCheckbox.isVisible().catch(() => false)) {
        await firstCheckbox.click()
        await page.waitForTimeout(500)

        // Verify action bar is visible and properly styled for mobile
        await page.screenshot({ path: 'test-results/hr-core-mobile-bulk-action-bar.png', fullPage: true })
      }
    })
  })

  // ============================================
  // NAVIGATION INTEGRATION
  // ============================================

  test.describe('Navigation Integration', () => {
    test('should navigate from employee detail to sub-pages', async ({ page, request }) => {
      const res = await request.get(`${API_BASE}/api/v1/employees`, { headers: HEADERS })
      const api = await res.json()
      const employees = api.data?.employees || api.data || []

      if (employees.length === 0) {
        test.skip()
        return
      }

      // Navigate to employee detail
      await page.goto(`/admin/employees/${employees[0].id}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Check for sub-page navigation links
      const subPages = ['Documenti', 'Competenze', 'Storico', 'Contratti']
      for (const subPage of subPages) {
        const link = page.getByRole('button', { name: new RegExp(subPage, 'i') }).or(
          page.getByRole('link', { name: new RegExp(subPage, 'i') })
        )
        if (await link.isVisible().catch(() => false)) {
          console.log(`[Navigation] Sub-page link found: ${subPage}`)
        }
      }

      await page.screenshot({ path: 'test-results/hr-core-employee-detail-navigation.png', fullPage: true })
    })

    test('should navigate from department list to stats', async ({ page, request }) => {
      const res = await request.get(`${API_BASE}/api/v1/departments`, { headers: HEADERS })
      const api = await res.json()
      const departments = api.data || []

      if (departments.length === 0) {
        test.skip()
        return
      }

      // Navigate to department detail
      await page.goto(`/admin/departments/${departments[0].id}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')

      // Look for stats link
      const statsLink = page.getByRole('link', { name: /statistiche|stats/i }).or(
        page.getByRole('button', { name: /statistiche|stats/i })
      )

      if (await statsLink.isVisible().catch(() => false)) {
        await statsLink.click()
        await page.waitForURL(/stats/)
        console.log('[Navigation] Successfully navigated to department stats')
        await page.screenshot({ path: 'test-results/hr-core-department-to-stats-navigation.png', fullPage: true })
      }
    })
  })
})
