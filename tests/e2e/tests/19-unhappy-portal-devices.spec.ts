import { test, expect } from '@playwright/test'
import { PORTAL_URL } from '../test-urls'

/**
 * Unhappy path tests for device management.
 * Tests double-clicks, repeated actions, and edge cases.
 */
test.describe('Portal — Devices error handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')
    await page.click('nav >> text=Devices')
    await expect(page.locator('h1')).toContainText('Devices')
  })

  test('enabling web approvals twice does not create duplicate devices', async ({ page }) => {
    // Ensure we start fresh — revoke existing devices
    while (await page.locator('button:has-text("Revoke")').first().isVisible()) {
      await page.locator('button:has-text("Revoke")').first().click()
      await page.locator('[role="dialog"] button:has-text("Revoke")').click()
      await page.waitForTimeout(500)
    }

    // Enable web approvals
    const enableBtn = page.locator('button:has-text("Enable web approvals")')
    await expect(enableBtn).toBeVisible({ timeout: 5000 })
    await enableBtn.click()
    await expect(page.getByText('Browser registered', { exact: true })).toBeVisible({ timeout: 10000 })

    // Reload the page
    await page.click('nav >> text=Devices')
    await page.waitForTimeout(1000)

    // The "Enable web approvals" button should no longer be visible
    // (since there's now an active device)
    await expect(page.locator('button:has-text("Enable web approvals")')).not.toBeVisible({ timeout: 5000 })

    // Should only have one active device card
    const revokeButtons = page.locator('button:has-text("Revoke")')
    const count = await revokeButtons.count()
    expect(count).toBe(1)
  })

  test('cancelling revoke dialog does not revoke the device', async ({ page }) => {
    // Ensure there's a device to test with
    const enableBtn = page.locator('button:has-text("Enable web approvals")')
    if (await enableBtn.isVisible()) {
      await enableBtn.click()
      await expect(page.getByText('Browser registered', { exact: true })).toBeVisible({ timeout: 10000 })
      await page.click('nav >> text=Devices')
      await page.waitForTimeout(1000)
    }

    // Count active devices (Revoke buttons) before
    const revokeButtons = page.locator('button:has-text("Revoke")')
    const countBefore = await revokeButtons.count()
    expect(countBefore).toBeGreaterThan(0)

    // Click Revoke to open the dialog
    await revokeButtons.first().click()

    // Dialog should appear
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Click Cancel instead of confirming
    await page.locator('[role="dialog"] button:has-text("Cancel")').click()

    // Dialog should close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()

    // Same number of active devices — nothing was revoked
    const countAfter = await page.locator('button:has-text("Revoke")').count()
    expect(countAfter).toBe(countBefore)
  })
})
