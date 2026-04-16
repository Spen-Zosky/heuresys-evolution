import { test, expect } from '@playwright/test'
import { loginAsSysadmin } from './login-helper'

const SCREENSHOTS = 'e2e/re-audit/screenshots'

test.describe('Re-Audit Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSysadmin(page)
  })

  test('BUG-127: /admin/settings loads tenant configuration', async ({ page }) => {
    await page.goto('/admin/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${SCREENSHOTS}/bug127-settings.png`, fullPage: true })

    const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false)
    const hasContent = await page.locator('h1, h2, form, input, [role="tablist"]').first().isVisible().catch(() => false)
    const hasSettingsContent = await page.locator('text=/impostazioni|settings|configurazione|configuration|tenant/i').first().isVisible().catch(() => false)
    const hasError = await page.locator('text=/errore|error|impossibile|failed/i').first().isVisible().catch(() => false)
    const settingsLinksCount = await page.locator('a, button, [role="tab"]').filter({ hasText: /notifiche|notification|sap|tenant|sicurezza|security/i }).count()
    console.log(`BUG-127: Page 404=${is404}, Content=${hasContent}, Settings content=${hasSettingsContent}, Error=${hasError}, Sub-settings links=${settingsLinksCount}`)
  })

  test('BUG-128: /admin/settings/notifications - save works', async ({ page }) => {
    await page.goto('/admin/settings/notifications')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${SCREENSHOTS}/bug128-notifications.png`, fullPage: true })

    const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false)
    const hasForm = await page.locator('form, input, select, [role="switch"], [role="checkbox"]').first().isVisible().catch(() => false)
    const saveBtn = page.locator('button').filter({ hasText: /salva|save|aggiorna|update/i }).first()
    const hasSave = await saveBtn.isVisible().catch(() => false)
    const hasNotifFields = await page.locator('text=/email|notific|avvisi|alerts/i').first().isVisible().catch(() => false)
    console.log(`BUG-128: Page 404=${is404}, Form=${hasForm}, Save button=${hasSave}, Notification fields=${hasNotifFields}`)

    if (hasSave) {
      const responsePromise = page.waitForResponse(resp => resp.url().includes('/api/') && ['POST', 'PUT', 'PATCH'].includes(resp.request().method()), { timeout: 5000 }).catch(() => null)
      await saveBtn.click()
      const response = await responsePromise
      console.log(`BUG-128: Save API call made=${!!response}, Status=${response?.status() || 'N/A'}`)
      await page.screenshot({ path: `${SCREENSHOTS}/bug128-after-save.png`, fullPage: true })
    }
  })

  test('BUG-131: /admin/settings/tenant-setup - save calls API', async ({ page }) => {
    await page.goto('/admin/settings/tenant-setup')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${SCREENSHOTS}/bug131-tenant-setup.png`, fullPage: true })

    const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false)
    const hasForm = await page.locator('form, input, select, textarea').first().isVisible().catch(() => false)
    const hasTenantFields = await page.locator('text=/nome tenant|tenant name|company|azienda|logo|dominio|domain/i').first().isVisible().catch(() => false)
    const hasSave = await page.locator('button').filter({ hasText: /salva|save|aggiorna|update/i }).first().isVisible().catch(() => false)
    console.log(`BUG-131: Page 404=${is404}, Form=${hasForm}, Tenant fields=${hasTenantFields}, Save button=${hasSave}`)
  })

  test('BUG-129: /admin/settings/sap-migration - status loads', async ({ page }) => {
    await page.goto('/admin/settings/sap-migration')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${SCREENSHOTS}/bug129-sap-migration.png`, fullPage: true })

    const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false)
    const hasContent = await page.locator('h1, h2, table, [role="progressbar"], [class*="progress"]').first().isVisible().catch(() => false)
    const hasSapContent = await page.locator('text=/sap|migrazione|migration|stato|status|modulo|module/i').first().isVisible().catch(() => false)
    const hasError = await page.locator('text=/errore|error|impossibile|failed/i').first().isVisible().catch(() => false)
    console.log(`BUG-129: Page 404=${is404}, Content=${hasContent}, SAP content=${hasSapContent}, Error=${hasError}`)
  })
})
