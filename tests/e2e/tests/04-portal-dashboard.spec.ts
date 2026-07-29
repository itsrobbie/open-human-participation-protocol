import { test, expect } from '@playwright/test'
import { PORTAL_URL } from '../test-urls'

test.describe('Portal — Dashboard', () => {
  test('7. dashboard shows stats after login', async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')

    // Wait for dashboard to load data
    await expect(page.locator('h1')).toContainText('Dashboard')

    // Dashboard should show stat cards (wait for API data)
    await expect(page.getByText('Devices').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Pending Requests')).toBeVisible({ timeout: 10000 })

    // Welcome message
    await expect(page.getByText('Welcome')).toBeVisible({ timeout: 10000 })
  })
})
