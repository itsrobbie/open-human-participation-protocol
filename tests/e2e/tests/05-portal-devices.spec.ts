import { test, expect } from '@playwright/test'
import { PORTAL_URL } from '../test-urls'

test.describe('Portal — Device management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')

    // Navigate to Devices page
    await page.click('nav >> text=Devices')
    await expect(page.locator('h1')).toContainText('Devices')
  })

  test('5. enable web approvals registers browser device', async ({ page }) => {
    // Click "Enable web approvals" button if visible
    const enableBtn = page.locator('button:has-text("Enable web approvals")')
    if (await enableBtn.isVisible()) {
      await enableBtn.click()

      // Should show success message
      await expect(page.getByText('Browser registered', { exact: true })).toBeVisible({ timeout: 10000 })
    } else {
      // Browser device already exists from prior test — verify a device card is shown
      await expect(page.locator('button:has-text("Revoke")').first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('6. revoke device removes it from active section', async ({ page }) => {
    // Ensure there's a device to revoke — enable web approvals if needed
    const enableBtn = page.locator('button:has-text("Enable web approvals")')
    if (await enableBtn.isVisible()) {
      await enableBtn.click()
      await expect(page.locator('text=Browser registered')).toBeVisible({ timeout: 10000 })
      // Reload to see the device in the list
      await page.click('nav >> text=Devices')
      await expect(page.locator('h1')).toContainText('Devices')
    }

    // Find a Revoke button
    const revokeBtn = page.locator('button:has-text("Revoke")').first()
    await expect(revokeBtn).toBeVisible({ timeout: 5000 })

    // Revoke it
    await revokeBtn.click()

    // Confirm in the dialog
    await page.locator('[role="dialog"] button:has-text("Revoke")').click()

    // Device should move to the "Revoked" section
    await expect(page.locator('h2:has-text("Revoked")')).toBeVisible({ timeout: 10000 })
  })
})
