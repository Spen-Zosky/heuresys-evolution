import { test, expect } from '@playwright/test'
import { loginAsSysadmin } from './login-helper'

const SCREENSHOTS = 'e2e/re-audit/screenshots'

test.describe('Re-Audit HR Core', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSysadmin(page)
  })

  test('BUG-071: employees filter by department works (no DB error)', async ({ page }) => {
    await page.goto('/admin/employees')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${SCREENSHOTS}/bug071-employees-initial.png`, fullPage: true })

    const deptFilter = page.locator('select, [role="combobox"], [data-testid*="department"], button:has-text("Dipartimento"), button:has-text("Reparto"), button:has-text("Filtra")')
    const hasDeptFilter = await deptFilter.first().isVisible().catch(() => false)

    if (hasDeptFilter) {
      await deptFilter.first().click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${SCREENSHOTS}/bug071-dept-filter-open.png`, fullPage: true })
      const option = page.locator('[role="option"], option, [role="menuitem"], li').filter({ hasText: /Direzione|Operations|Risk|IT/ }).first()
      const hasOption = await option.isVisible().catch(() => false)
      if (hasOption) {
        await option.click()
        await page.waitForTimeout(2000)
      }
    }

    const hasError = await page.locator('text=/errore|error|500|Database/i').first().isVisible().catch(() => false)
    await page.screenshot({ path: `${SCREENSHOTS}/bug071-after-filter.png`, fullPage: true })
    console.log(`BUG-071: Department filter present=${hasDeptFilter}, Error after filter=${hasError}`)
  })

  test('BUG-072: department column shows name not raw code', async ({ page }) => {
    await page.goto('/admin/employees')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (hasTable) {
      const hasDeptHeader = await page.locator('th').filter({ hasText: /dipartimento|department|reparto/i }).first().isVisible().catch(() => false)
      const cells = page.locator('td')
      const cellCount = await cells.count()
      let foundUUID = false
      for (let i = 0; i < Math.min(cellCount, 50); i++) {
        const text = await cells.nth(i).textContent().catch(() => '')
        if (text && /^[0-9a-f]{8}-[0-9a-f]{4}/.test(text.trim())) { foundUUID = true; break }
      }
      console.log(`BUG-072: Table present=${hasTable}, Dept header=${hasDeptHeader}, UUID in cells=${foundUUID}`)
    } else {
      console.log('BUG-072: No table found, may use card layout')
    }
    await page.screenshot({ path: `${SCREENSHOTS}/bug072-dept-column.png`, fullPage: true })
  })

  test('BUG-076: employee creation - department dropdown works', async ({ page }) => {
    await page.goto('/admin/employees/new')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${SCREENSHOTS}/bug076-new-employee-form.png`, fullPage: true })

    const hasForm = await page.locator('form, [role="form"]').first().isVisible().catch(() => false)
    const hasLabel = await page.locator('label').filter({ hasText: /dipartimento|department|reparto/i }).first().isVisible().catch(() => false)
    const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false)
    console.log(`BUG-076: Form present=${hasForm}, Dept label=${hasLabel}, Is 404=${is404}`)
  })

  test('BUG-074: employee detail time-off section', async ({ page }) => {
    await page.goto('/admin/employees')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const empLink = page.locator('table tbody tr a, table tbody tr td:first-child a').first()
    const hasLink = await empLink.isVisible().catch(() => false)
    if (hasLink) {
      await empLink.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
    }
    await page.screenshot({ path: `${SCREENSHOTS}/bug074-employee-detail.png`, fullPage: true })

    const timeOffTab = page.locator('button, a, [role="tab"]').filter({ hasText: /ferie|assenze|time.off|presenze|attendance/i })
    const hasTimeOffTab = await timeOffTab.first().isVisible().catch(() => false)
    if (hasTimeOffTab) {
      await timeOffTab.first().click()
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `${SCREENSHOTS}/bug074-timeoff-section.png`, fullPage: true })
    }
    console.log(`BUG-074: Time-off tab present=${hasTimeOffTab}`)
  })

  test('BUG-077/078: onboarding list loads', async ({ page }) => {
    await page.goto('/admin/employees/onboarding')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${SCREENSHOTS}/bug077-onboarding.png`, fullPage: true })

    const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false)
    const hasContent = await page.locator('h1, h2, table, [role="table"]').first().isVisible().catch(() => false)
    const hasError = await page.locator('text=/errore|error|impossibile/i').first().isVisible().catch(() => false)
    console.log(`BUG-077/078: Onboarding page 404=${is404}, Content=${hasContent}, Error=${hasError}`)
  })

  test('BUG-079: departments tree view with hierarchy', async ({ page }) => {
    await page.goto('/admin/departments')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${SCREENSHOTS}/bug079-departments.png`, fullPage: true })

    const hasTree = await page.locator('[class*="tree"], [role="tree"], [data-testid*="tree"], [class*="hierarchy"]').first().isVisible().catch(() => false)
    const deptCount = await page.locator('text=/Direzione|Operations|Risk|IT|Commercial/i').count()
    const hasToggles = await page.locator('[class*="expand"], [class*="collapse"], [aria-expanded], button svg').first().isVisible().catch(() => false)
    console.log(`BUG-079: Tree view=${hasTree}, Departments found=${deptCount}, Toggles=${hasToggles}`)
  })

  test('BUG-080/081: departments detail - employee count (API + UI)', async ({ page }) => {
    await page.goto('/admin/departments')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const deptLink = page.locator('a, tr, [role="row"], button').filter({ hasText: /Direzione Generale|Risk Management|Operations/i }).first()
    const hasLink = await deptLink.isVisible().catch(() => false)

    if (hasLink) {
      await deptLink.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      await page.screenshot({ path: `${SCREENSHOTS}/bug080-dept-detail.png`, fullPage: true })
      const hasEmpCount = await page.locator('text=/dipendenti|employees|membri|members/i').first().isVisible().catch(() => false)
      const hasNumber = await page.locator('text=/\\d+\\s*(dipendenti|employees|membri)/i').first().isVisible().catch(() => false)
      console.log(`BUG-080/081: Dept detail loaded=${hasLink}, Employee count shown=${hasEmpCount}, Number visible=${hasNumber}`)
    } else {
      console.log('BUG-080/081: Could not navigate to department detail')
      await page.screenshot({ path: `${SCREENSHOTS}/bug080-dept-no-detail.png`, fullPage: true })
    }
  })
})
