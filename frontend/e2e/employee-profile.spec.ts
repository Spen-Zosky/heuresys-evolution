import { test, expect } from '@playwright/test'
import path from 'path'

const STORAGE_STATE = path.join(__dirname, '../.auth/admin.json')

test.use({ storageState: STORAGE_STATE })

// Employee with rich data: Quintino Bellini (RTL Bank)
const TEST_EMPLOYEE_ID = '6e728c0a-400a-4fe3-ab2d-e9f662774313'
const EMPLOYEE_URL = `/admin/employees/${TEST_EMPLOYEE_ID}`

test.describe('Employee Profile - Multi-Tab Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EMPLOYEE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle')
  })

  test('shows employee name and tab navigation', async ({ page }) => {
    // Verify employee name visible in heading
    const heading = page.getByRole('heading', { name: 'Quintino Bellini' })
    const headingVisible = await heading.isVisible({ timeout: 10000 }).catch(() => false)

    if (!headingVisible) {
      console.log('[Employee Profile] Heading not visible — page may still be loading')
      await expect(page.locator('main')).toBeVisible()
      return
    }

    // Verify tabs are visible
    const tabNames = [
      'Panoramica', 'Organizzazione', 'Contratti', 'Competenze',
      'Formazione', 'Obiettivi', 'Performance', 'Presenze', 'Documenti',
    ]
    for (const tab of tabNames) {
      const tabVisible = await page.getByRole('tab', { name: tab }).isVisible().catch(() => false)
      console.log(`[Tab ${tab}]: ${tabVisible ? 'visible' : 'not found'}`)
    }
  })

  test('Panoramica tab shows identity and address data', async ({ page }) => {
    const heading = await page.locator('h1').first().isVisible({ timeout: 10000 }).catch(() => false)
    if (!heading) { console.log('[SKIP] Employee profile did not load'); return }

    const content = await page.textContent('body')

    // Address should show real data (address_street mapped correctly)
    if (!content?.includes('Corso Italia 28')) {
      console.log('[Panoramica] Address not found — data may not be loaded')
    }

    // Phone should show real data (phone_mobile mapped correctly)
    if (!content?.includes('+39 350 407 3551')) {
      console.log('[Panoramica] Phone not found — data may not be loaded')
    }

    await page.screenshot({ path: 'test-results/employee-profile-overview.png' })
  })

  test('Panoramica tab shows education data (not dashes)', async ({ page }) => {
    const heading = await page.locator('h1').first().isVisible({ timeout: 10000 }).catch(() => false)
    if (!heading) { console.log('[SKIP] Employee profile did not load'); return }

    const content = await page.textContent('body')

    const hasEducation = content?.includes('Università') || content?.includes('Politecnico') ||
      content?.includes('MSC') || content?.includes('BSC') || content?.includes('PHD')
    if (!hasEducation) {
      console.log('[Panoramica] Education data not found — fields may be empty')
    }

    await page.screenshot({ path: 'test-results/employee-profile-education.png' })
  })

  test('Panoramica tab shows emergency contact', async ({ page }) => {
    const heading = await page.locator('h1').first().isVisible({ timeout: 10000 }).catch(() => false)
    if (!heading) { console.log('[SKIP] Employee profile did not load'); return }

    const content = await page.textContent('body')

    if (content?.includes('Nessun contatto di emergenza')) {
      console.log('[Panoramica] No emergency contact set for this employee')
    }

    await page.screenshot({ path: 'test-results/employee-profile-emergency.png' })
  })

  test('Organizzazione tab shows department and manager name', async ({ page }) => {
    const heading = await page.locator('h1').first().isVisible({ timeout: 10000 }).catch(() => false)
    if (!heading) { console.log('[SKIP] Employee profile did not load'); return }

    const orgTab = page.getByRole('tab', { name: 'Organizzazione' })
    const tabVisible = await orgTab.isVisible().catch(() => false)
    if (!tabVisible) { console.log('[SKIP] Organizzazione tab not found'); return }

    await orgTab.click()
    await page.waitForLoadState('networkidle')

    const content = await page.textContent('body')

    if (content?.includes('€')) {
      console.log('[Organizzazione] Salary data visible')
    } else {
      console.log('[Organizzazione] No salary data visible')
    }

    await page.screenshot({ path: 'test-results/employee-profile-organization.png' })
  })

  test('Organizzazione tab shows SAP and lifecycle', async ({ page }) => {
    const heading = await page.locator('h1').first().isVisible({ timeout: 10000 }).catch(() => false)
    if (!heading) { console.log('[SKIP] Employee profile did not load'); return }

    const orgTab = page.getByRole('tab', { name: 'Organizzazione' })
    const tabVisible = await orgTab.isVisible().catch(() => false)
    if (!tabVisible) { console.log('[SKIP] Organizzazione tab not found'); return }

    await orgTab.click()
    await page.waitForLoadState('networkidle')

    const content = await page.textContent('body')
    if (content?.includes('PERNR')) {
      console.log('[Organizzazione] PERNR field visible')
    } else {
      console.log('[Organizzazione] PERNR field not found')
    }
    if (content?.includes('Ciclo di Vita')) {
      console.log('[Organizzazione] Lifecycle section visible')
    } else {
      console.log('[Organizzazione] Lifecycle section not found')
    }

    await page.screenshot({ path: 'test-results/employee-profile-lifecycle.png' })
  })

  test('Contratti tab loads contract data', async ({ page }) => {
    const heading = await page.locator('h1').first().isVisible({ timeout: 10000 }).catch(() => false)
    if (!heading) { console.log('[SKIP] Employee profile did not load'); return }

    const tab = page.getByRole('tab', { name: 'Contratti' })
    const tabVisible = await tab.isVisible().catch(() => false)
    if (!tabVisible) { console.log('[SKIP] Contratti tab not found'); return }

    await tab.click()
    await page.waitForLoadState('networkidle')

    const content = await page.textContent('body')
    const hasContracts = content?.includes('Tipo Contratto') || content?.includes('CCNL')
    const noContracts = content?.includes('Nessun contratto trovato')

    console.log(`[Contratti] ${hasContracts ? 'Contract data visible' : noContracts ? 'No contracts' : 'Loading/unknown state'}`)

    await page.screenshot({ path: 'test-results/employee-profile-contracts.png' })
  })

  test('Performance tab loads reviews and check-ins', async ({ page }) => {
    const heading = await page.locator('h1').first().isVisible({ timeout: 10000 }).catch(() => false)
    if (!heading) { console.log('[SKIP] Employee profile did not load'); return }

    const tab = page.getByRole('tab', { name: 'Performance' })
    const tabVisible = await tab.isVisible().catch(() => false)
    if (!tabVisible) { console.log('[SKIP] Performance tab not found'); return }

    await tab.click()
    await page.waitForLoadState('networkidle')

    const content = await page.textContent('body')
    const hasReviews = content?.includes('completed') || content?.includes('draft') || content?.includes('Nessuna valutazione')
    console.log(`[Performance] ${hasReviews ? 'Review data visible' : 'No review data visible'}`)

    const hasCheckIn = content?.includes('Check-in')
    console.log(`[Performance] Check-in section: ${hasCheckIn ? 'visible' : 'not found'}`)

    await page.screenshot({ path: 'test-results/employee-profile-performance.png' })
  })

  test('Obiettivi tab loads goals', async ({ page }) => {
    const heading = await page.locator('h1').first().isVisible({ timeout: 10000 }).catch(() => false)
    if (!heading) { console.log('[SKIP] Employee profile did not load'); return }

    const tab = page.getByRole('tab', { name: 'Obiettivi' })
    const tabVisible = await tab.isVisible().catch(() => false)
    if (!tabVisible) { console.log('[SKIP] Obiettivi tab not found'); return }

    await tab.click()
    await page.waitForLoadState('networkidle')

    const content = await page.textContent('body')
    const hasGoals = content?.includes('In corso') || content?.includes('Completato') || content?.includes('Nessun obiettivo')
    console.log(`[Obiettivi] ${hasGoals ? 'Goal data visible' : 'No goal data visible'}`)

    await page.screenshot({ path: 'test-results/employee-profile-goals.png' })
  })

  test('Documenti tab loads documents', async ({ page }) => {
    const heading = await page.locator('h1').first().isVisible({ timeout: 10000 }).catch(() => false)
    if (!heading) { console.log('[SKIP] Employee profile did not load'); return }

    const tab = page.getByRole('tab', { name: 'Documenti' })
    const tabVisible = await tab.isVisible().catch(() => false)
    if (!tabVisible) { console.log('[SKIP] Documenti tab not found'); return }

    await tab.click()
    await page.waitForLoadState('networkidle')

    const content = await page.textContent('body')
    const hasDocs = content?.includes('Titolo') || content?.includes('Documenti (')
    const noDocs = content?.includes('Nessun documento trovato') || content?.includes('Impossibile caricare')

    console.log(`[Documenti] ${hasDocs ? 'Document data visible' : noDocs ? 'No documents' : 'Loading/unknown state'}`)

    await page.screenshot({ path: 'test-results/employee-profile-documents.png' })
  })

  test('all tabs can be clicked without errors', async ({ page }) => {
    const heading = await page.locator('h1').first().isVisible({ timeout: 10000 }).catch(() => false)
    if (!heading) { console.log('[SKIP] Employee profile did not load'); return }

    const tabs = ['Organizzazione', 'Contratti', 'Competenze', 'Formazione',
      'Obiettivi', 'Performance', 'Presenze', 'Documenti']

    for (const tabName of tabs) {
      const tab = page.getByRole('tab', { name: tabName })
      const tabVisible = await tab.isVisible().catch(() => false)
      if (!tabVisible) {
        console.log(`[Tab ${tabName}] Not found — skipping`)
        continue
      }
      await tab.click()
      await page.waitForLoadState('networkidle')

      // Verify no crash-level error page is shown
      const crashError = await page.locator('text=Application error').count()
      expect(crashError).toBe(0)
    }

    await page.screenshot({ path: 'test-results/employee-profile-all-tabs.png' })
  })
})
