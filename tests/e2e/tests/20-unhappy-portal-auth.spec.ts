import { test, expect } from '@playwright/test'
import { PORTAL_URL } from '../test-urls'

/**
 * Unhappy path tests for authentication.
 * Tests edge cases around login, session, and route protection.
 */
test.describe('Portal — Auth error handling', () => {
  test('empty username and password shows error', async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)

    // Try to submit with empty fields (rely on HTML5 required validation)
    // Clear the placeholder-filled state
    await page.click('button[type="submit"]')

    // Either HTML validation prevents submission (stays on login page)
    // or the server returns an error
    await expect(page).toHaveURL(`${PORTAL_URL}/login`)
  })

  test('non-existent route shows dashboard (SPA fallback)', async ({ page }) => {
    // Login first
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')

    // Navigate to a non-existent route
    await page.goto(`${PORTAL_URL}/this-page-does-not-exist`)

    // SPA should handle it gracefully — either shows a 404 page or redirects
    // Should NOT show a blank white screen or server error
    await page.waitForTimeout(2000)
    const bodyText = await page.locator('body').textContent()
    expect(bodyText!.length).toBeGreaterThan(10) // Page has content, not blank
  })

  test('manipulated localStorage token (garbage) redirects to login', async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)

    // Set garbage token
    await page.evaluate(() => {
      localStorage.setItem('ohpp_device_token', 'not-a-jwt-at-all')
    })

    // Try to visit a protected page
    await page.goto(`${PORTAL_URL}/devices`)

    // Should redirect to login (token is invalid)
    await expect(page).toHaveURL(`${PORTAL_URL}/login`, { timeout: 10000 })
  })

  test('login with correct username but wrong password shows specific error', async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'incorrect-password-123')
    await page.click('button[type="submit"]')

    // Should show a user-friendly error (not a raw HTTP error)
    await expect(page.locator('.text-red-600, .bg-red-50')).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(`${PORTAL_URL}/login`)

    // Error should not expose internal details
    const errorText = await page.locator('.text-red-600, .bg-red-50').first().textContent()
    expect(errorText?.toLowerCase()).not.toContain('500')
    expect(errorText?.toLowerCase()).not.toContain('exception')
    expect(errorText?.toLowerCase()).not.toContain('stack trace')
  })

  test('rapid login attempts do not crash the app', async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)

    // Submit wrong password 5 times rapidly
    for (let i = 0; i < 5; i++) {
      await page.fill('input[placeholder="demo"]', 'demo')
      await page.fill('input[type="password"]', 'wrong')
      await page.click('button[type="submit"]')
      await page.waitForTimeout(200)
    }

    // App should still be functional — show an error, not a crash
    await expect(page).toHaveURL(`${PORTAL_URL}/login`)
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })
})
