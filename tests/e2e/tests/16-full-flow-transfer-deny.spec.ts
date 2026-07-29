import { test, expect } from '@playwright/test'
import { PORTAL_URL, BANK_URL } from '../test-urls'

/**
 * Tests the deny path: user denies a transfer in the portal,
 * bank should show "Transfer denied by user" (not "approved and completed").
 *
 * Preconditions: tests 15 has already set up the OHPP connection between portal and bank.
 */
test.describe('Bank — Transfer denied by user', () => {
  test.setTimeout(60000)

  test('deny transfer shows denied in bank', async ({ context }) => {
    const portalPage = await context.newPage()
    const bankPage = await context.newPage()

    // --- Login to portal ---
    await portalPage.goto(`${PORTAL_URL}/login`)
    await portalPage.fill('input[placeholder="demo"]', 'demo')
    await portalPage.fill('input[type="password"]', 'demo')
    await portalPage.click('button[type="submit"]')
    await expect(portalPage).toHaveURL(PORTAL_URL + '/')

    // --- Ensure web approvals are enabled (device without key) ---
    await portalPage.click('nav >> text=Devices')
    await portalPage.waitForTimeout(1000)

    // Revoke any keyed devices
    while (await portalPage.locator('button:has-text("Revoke")').first().isVisible()) {
      await portalPage.locator('button:has-text("Revoke")').first().click()
      await portalPage.locator('[role="dialog"] button:has-text("Revoke")').click()
      await portalPage.waitForTimeout(500)
    }

    // Enable web approvals if not already enabled
    const enableBtn = portalPage.locator('button:has-text("Enable web approvals")')
    if (await enableBtn.isVisible()) {
      await enableBtn.click()
      await expect(portalPage.getByText('Browser registered', { exact: true })).toBeVisible({ timeout: 10000 })
    }

    // --- Ensure bank is connected ---
    await bankPage.goto(BANK_URL)
    await expect(bankPage.locator('#balance')).not.toHaveText('Loading...')

    // If not connected, connect it
    const badge = bankPage.locator('.ohpp-badge')
    if (!(await badge.isVisible().catch(() => false))) {
      // Generate challenge and register in portal
      await bankPage.click('#generate-challenge-btn')
      const challengeTextarea = bankPage.locator('#challenge-uri')
      await expect(challengeTextarea).toBeVisible({ timeout: 10000 })
      const challengeUri = await challengeTextarea.inputValue()

      await portalPage.click('nav >> text=Connect App')
      await portalPage.fill('textarea', challengeUri)
      await portalPage.click('button:has-text("Connect app")')
      await expect(portalPage.locator('.bg-green-50').first()).toBeVisible({ timeout: 15000 })

      await bankPage.waitForTimeout(3000)
      await bankPage.goto(BANK_URL)
      await expect(bankPage.locator('#balance')).not.toHaveText('Loading...')
    }

    await expect(bankPage.locator('.ohpp-badge')).toBeVisible({ timeout: 10000 })

    // --- Make a transfer ---
    await bankPage.selectOption('#payee-select', { index: 0 })
    await bankPage.fill('#amount', '25.00')
    await bankPage.fill('#reference', 'E2E deny test')
    await bankPage.click('#transfer-form button[type="submit"]')

    const transferResult = bankPage.locator('#transfer-result')
    await expect(transferResult).toBeVisible({ timeout: 15000 })
    await expect(transferResult).toContainText('Waiting for approval', { timeout: 15000 })

    // --- Go to portal and DENY the request ---
    await portalPage.click('nav >> text=Pending')

    // The bank sends Select options with labels "Approve transfer" and "Deny transfer"
    const denyBtn = portalPage.locator('button:has-text("Deny transfer")')
    await expect(denyBtn).toBeVisible({ timeout: 15000 })

    await denyBtn.click()

    // Request should disappear
    await expect(denyBtn).not.toBeVisible({ timeout: 10000 })

    // --- Bank should show DENIED, not approved ---
    await expect(transferResult).toContainText('denied', { timeout: 30000 })
    await expect(transferResult).not.toContainText('approved')

    await portalPage.close()
    await bankPage.close()
  })
})
