import { test, expect } from '@playwright/test'
import { PORTAL_URL } from '../test-urls'

test.describe('Portal — Session management', () => {
  test('expired token redirects to login', async ({ page }) => {
    // Set an expired JWT in localStorage
    await page.goto(`${PORTAL_URL}/login`)
    await page.evaluate(() => {
      // This is a deliberately expired token (exp in the past)
      localStorage.setItem('ohpp_device_token', 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjEwMDAwMDAwMDAsInN1YiI6InRlc3QifQ.fake')
    })

    // Try to access a protected page — API will return 401
    await page.goto(`${PORTAL_URL}/`)

    // Should redirect to login after the 401 response
    await expect(page).toHaveURL(`${PORTAL_URL}/login`, { timeout: 10000 })
  })

  test('clearing token manually redirects to login on next navigation', async ({ page }) => {
    // Login normally
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')

    // Clear the token (simulating expiry)
    await page.evaluate(() => localStorage.removeItem('ohpp_device_token'))

    // Navigate to another page
    await page.goto(`${PORTAL_URL}/devices`)

    // Should redirect to login
    await expect(page).toHaveURL(`${PORTAL_URL}/login`)
  })

  test('login persists across page reload', async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')

    // Reload the page
    await page.reload()

    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL(PORTAL_URL + '/')
    // Nav should still be visible (proving we're authenticated)
    await expect(page.locator('nav >> text=Dashboard')).toBeVisible()
    await expect(page.locator('text=Sign out')).toBeVisible()
  })
})
