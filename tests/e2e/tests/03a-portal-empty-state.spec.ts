import { test, expect } from '@playwright/test'
import { PORTAL_URL } from '../test-urls'

/**
 * Tests that all pages load without errors on a fresh account.
 * After global setup wipes DB, verifies the portal handles the clean-slate gracefully.
 */
test.describe('Portal — Page load (no errors)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')
  })

  test('dashboard loads without error', async ({ page }) => {
    // Should NOT show the "Failed to load" error
    await expect(page.locator('text=Failed to load')).not.toBeVisible({ timeout: 5000 })
    // Dashboard heading should appear
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 })
  })

  test('devices page loads without error', async ({ page }) => {
    await page.click('nav >> text=Devices')
    await expect(page.locator('h1')).toContainText('Devices')
    // Should show either devices list or empty state — not an error
    await expect(page.locator('text=Failed')).not.toBeVisible()
  })

  test('apps page loads without error', async ({ page }) => {
    await page.click('nav >> text=Apps')
    await expect(page.locator('h1')).toContainText('Registered Apps')
    await expect(page.locator('text=Failed')).not.toBeVisible()
  })

  test('history page loads without error', async ({ page }) => {
    await page.click('nav >> text=History')
    await expect(page.locator('h1')).toContainText('Participation History')
    await expect(page.locator('text=Failed')).not.toBeVisible()
  })

  test('pending page loads without error', async ({ page }) => {
    await page.click('nav >> text=Pending')
    await expect(page.locator('h1')).toContainText('Pending Requests')
    await expect(page.locator('text=Failed')).not.toBeVisible()
  })
})
