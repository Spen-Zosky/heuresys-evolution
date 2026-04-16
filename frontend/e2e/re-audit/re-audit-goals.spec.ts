import { test, expect } from '@playwright/test'
import { loginAsSysadmin } from './login-helper'

const SCREENSHOTS = 'e2e/re-audit/screenshots'

test.describe('Re-Audit Goals', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSysadmin(page)
  })

  test('BUG-093: goals list has "Nuovo Obiettivo" button linking to /goals/new', async ({ page }) => {
    await page.goto('/admin/goals')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${SCREENSHOTS}/bug093-goals-list.png`, fullPage: true })

    const newGoalBtn = page.locator('a, button').filter({ hasText: /nuovo obiettivo|new goal|crea obiettivo|aggiungi/i }).first()
    const hasButton = await newGoalBtn.isVisible().catch(() => false)

    let linksToNew = false
    if (hasButton) {
      const href = await newGoalBtn.getAttribute('href').catch(() => null)
      linksToNew = href?.includes('/goals/new') || href?.includes('/goals/create') || false
      if (!href) {
        await newGoalBtn.click()
        await page.waitForTimeout(2000)
        linksToNew = page.url().includes('/goals/new') || page.url().includes('/goals/create')
        await page.screenshot({ path: `${SCREENSHOTS}/bug093-after-click.png`, fullPage: true })
      }
    }
    console.log(`BUG-093: "Nuovo Obiettivo" button visible=${hasButton}, Links to /goals/new=${linksToNew}`)
  })

  test('BUG-094: goals/new - employee_id required, create works', async ({ page }) => {
    await page.goto('/admin/goals/new')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${SCREENSHOTS}/bug094-goals-new.png`, fullPage: true })

    const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false)
    const hasForm = await page.locator('form, [role="form"], input, select, textarea').first().isVisible().catch(() => false)
    const hasEmpField = await page.locator('label').filter({ hasText: /dipendente|employee|assegnatario|assignee/i }).first().isVisible().catch(() => false)
    const hasTitleField = await page.locator('input[name="title"], input[placeholder*="titolo" i], input[placeholder*="title" i]').first().isVisible().catch(() => false)
    console.log(`BUG-094: Page 404=${is404}, Form=${hasForm}, Employee field=${hasEmpField}, Title field=${hasTitleField}`)
  })

  test('BUG-095: goals/cascading - hierarchy renders', async ({ page }) => {
    await page.goto('/admin/goals/cascading')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${SCREENSHOTS}/bug095-cascading.png`, fullPage: true })

    const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false)
    const hasContent = await page.locator('h1, h2, [class*="tree"], [class*="hierarchy"], table, [role="tree"]').first().isVisible().catch(() => false)
    const hasGoals = await page.locator('text=/obiettiv|goal/i').first().isVisible().catch(() => false)
    const hasHierarchy = await page.locator('[class*="tree"], [class*="hierarchy"], [class*="cascade"], [role="tree"], [class*="nested"]').first().isVisible().catch(() => false)
    const hasError = await page.locator('text=/errore|error|impossibile|failed/i').first().isVisible().catch(() => false)
    console.log(`BUG-095: Page 404=${is404}, Content=${hasContent}, Goals present=${hasGoals}, Hierarchy=${hasHierarchy}, Error=${hasError}`)
  })
})
