import { test, expect } from '@playwright/test'
import { PORTAL_URL } from '../test-urls'

test.describe('Portal — History', () => {
  test('13. history page loads without error', async ({ page }) => {
    // Login
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')

    // Navigate to history
    await page.click('text=History')

    // Page should load (may have records or "No participation records yet")
    await expect(page.locator('h1')).toContainText('Participation History')
  })
})
