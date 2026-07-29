import { test, expect } from '@playwright/test'
import { PORTAL_URL } from '../test-urls'

test.describe('Portal — Authentication', () => {
  test('1. login with valid credentials', async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL(PORTAL_URL + '/')
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('2. login with invalid credentials shows error', async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error message
    await expect(page.locator('.text-red-600')).toBeVisible()
    await expect(page).toHaveURL(`${PORTAL_URL}/login`)
  })

  test('3. logout redirects to login', async ({ page }) => {
    // Login first
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')

    // Logout
    await page.click('text=Sign out')
    await expect(page).toHaveURL(`${PORTAL_URL}/login`)
  })

  test('4. protected routes redirect to login when unauthenticated', async ({ page }) => {
    // Clear any stored tokens
    await page.goto(PORTAL_URL)
    await page.evaluate(() => localStorage.removeItem('ohpp_device_token'))

    await page.goto(`${PORTAL_URL}/devices`)
    await expect(page).toHaveURL(`${PORTAL_URL}/login`)
  })
})
