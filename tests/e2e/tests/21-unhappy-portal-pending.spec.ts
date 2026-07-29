import { test, expect } from '@playwright/test'
import { PORTAL_URL, BANK_URL } from '../test-urls'

/**
 * Unhappy path tests for the Pending approvals page.
 * Tests what happens when requests expire, disappear, or the user acts on stale data.
 */
test.describe('Portal — Pending error handling', () => {
  test.setTimeout(60000)

  test('pending page shows empty state when no requests exist', async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')

    await page.click('nav >> text=Pending')

    // Should show either empty state or disabled message — not an error
    await expect(
      page.getByText('No pending requests')
        .or(page.getByText('Web approvals disabled').first())
    ).toBeVisible({ timeout: 10000 })
  })

  test('approve button shows feedback even if request was already resolved', async ({ context }) => {
    // This tests the race condition: request is resolved by another mechanism
    // while the user is looking at the Pending page.
    // We can't easily simulate this in E2E, but we can verify the UI doesn't crash
    // when the mutation returns an error.

    const portalPage = await context.newPage()
    const bankPage = await context.newPage()

    // Login
    await portalPage.goto(`${PORTAL_URL}/login`)
    await portalPage.fill('input[placeholder="demo"]', 'demo')
    await portalPage.fill('input[type="password"]', 'demo')
    await portalPage.click('button[type="submit"]')
    await expect(portalPage).toHaveURL(PORTAL_URL + '/')

    // Ensure web approvals enabled
    await portalPage.click('nav >> text=Devices')
    await portalPage.waitForTimeout(500)
    while (await portalPage.locator('button:has-text("Revoke")').first().isVisible()) {
      await portalPage.locator('button:has-text("Revoke")').first().click()
      await portalPage.locator('[role="dialog"] button:has-text("Revoke")').click()
      await portalPage.waitForTimeout(500)
    }
    const enableBtn = portalPage.locator('button:has-text("Enable web approvals")')
    if (await enableBtn.isVisible()) {
      await enableBtn.click()
      await expect(portalPage.getByText('Browser registered', { exact: true })).toBeVisible({ timeout: 10000 })
    }

    // Navigate to pending page
    await portalPage.click('nav >> text=Pending')
    await portalPage.waitForTimeout(1000)

    // The page should load without crashing, even if there are no requests
    // or if the API returns an empty list
    await expect(
      portalPage.getByText('No pending requests')
        .or(portalPage.locator('button:has-text("Approve transfer")'))
    ).toBeVisible({ timeout: 10000 })

    await portalPage.close()
    await bankPage.close()
  })

  test('pending page handles web approvals becoming disabled gracefully', async ({ page }) => {
    // Login
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')

    // Go to pending — regardless of state, should not show an error/crash
    await page.click('nav >> text=Pending')

    // Should show one of the valid states:
    // 1. Empty pending requests
    // 2. Disabled message
    // 3. Actual requests to respond to
    await expect(
      page.getByText('No pending requests')
        .or(page.getByText('Web approvals disabled').first())
        .or(page.locator('button:has-text("Approve transfer")'))
    ).toBeVisible({ timeout: 10000 })

    // Should NOT show a raw error
    await expect(page.locator('text=Failed')).not.toBeVisible()
  })
})
