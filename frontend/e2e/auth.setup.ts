import { test as setup, expect } from '@playwright/test'
import path from 'path'

export const STORAGE_STATE = path.join(__dirname, '../.auth/admin.json')

setup('authenticate as rtl-admin', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login', { waitUntil: 'domcontentloaded' })

  // Wait for username field to be visible and enabled
  const usernameField = page.locator('#username')
  await usernameField.waitFor({ state: 'visible', timeout: 15000 })

  // Wait a bit for animations to settle
  await page.waitForLoadState('networkidle')

  // Clear and fill credentials — rtl-admin has 156 employees in RTL Bank tenant
  // Use fill() for React controlled inputs (more reliable than pressSequentially)
  await usernameField.click()
  await usernameField.fill('rtl-admin')

  const passwordField = page.locator('#password')
  await passwordField.click()
  await passwordField.fill('Admin2026')

  // Verify fields are filled
  await expect(usernameField).toHaveValue('rtl-admin', { timeout: 5000 })
  await expect(passwordField).toHaveValue('Admin2026', { timeout: 5000 })

  // Click submit
  await page.click('button[type="submit"]')

  // Wait for navigation — Next.js uses client-side routing
  // The login page sets token in localStorage then calls router.push('/admin')
  // We wait for the URL to change OR for admin content to appear
  await page.waitForURL('**/admin**', { timeout: 45000, waitUntil: 'domcontentloaded' })

  // Wait for page to settle
  await page.waitForLoadState('networkidle')

  // Verify we're on admin page
  const currentUrl = page.url()
  if (!currentUrl.includes('/admin')) {
    // Take debug screenshot
    await page.screenshot({ path: 'test-results/auth-debug.png' })
    throw new Error(`Authentication failed - expected /admin URL, got: ${currentUrl}`)
  }

  // Save the authenticated browser context state
  await page.context().storageState({ path: STORAGE_STATE })

  console.log('Authentication setup complete - storage state saved to:', STORAGE_STATE)
})
