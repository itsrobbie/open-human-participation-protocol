import { test, expect } from '@playwright/test'
import { PORTAL_URL, BANK_URL } from '../test-urls'

/**
 * Full end-to-end test: the complete OHPP user journey with zero API calls.
 *
 * 1. Log into portal, register a device (no key — enables web approvals)
 * 2. Go to bank, generate connection link
 * 3. Go to portal, paste the link, register the app
 * 4. Bank auto-connects via callback
 * 5. Make a transfer in the bank — it shows "Waiting for approval"
 * 6. Go to portal Pending page — see the request — click Approve
 * 7. Bank shows "Transfer approved and completed"
 */
test.describe('Bank — Transfer with OHPP (full ceremony + approval)', () => {
  test.setTimeout(60000)

  test('full flow: register, transfer, approve in portal, see completion in bank', async ({ context }) => {
    const portalPage = await context.newPage()
    const bankPage = await context.newPage()

    // --- Step 1: Log into the portal and ensure user + device exist ---
    await portalPage.goto(`${PORTAL_URL}/login`)
    await portalPage.fill('input[placeholder="demo"]', 'demo')
    await portalPage.fill('input[type="password"]', 'demo')
    await portalPage.click('button[type="submit"]')
    await expect(portalPage).toHaveURL(PORTAL_URL + '/')

    // Register a device (no key — keeps web approvals enabled)
    // First, revoke any existing devices that might have keys (from prior tests)
    await portalPage.click('nav >> text=Devices')
    await portalPage.waitForTimeout(1000)

    // Revoke all active devices (they may have keys from earlier tests)
    while (await portalPage.locator('button:has-text("Revoke")').first().isVisible()) {
      await portalPage.locator('button:has-text("Revoke")').first().click()
      // Confirm in the dialog
      await portalPage.locator('[role="dialog"] button:has-text("Revoke")').click()
      await portalPage.waitForTimeout(500)
    }

    // Now enable web approvals (registers browser device without a key)
    const enableBtn = portalPage.locator('button:has-text("Enable web approvals")')
    if (await enableBtn.isVisible()) {
      await enableBtn.click()
      await expect(portalPage.getByText('Browser registered', { exact: true })).toBeVisible({ timeout: 10000 })
    }

    // --- Step 2: Go to bank, generate connection link ---
    await bankPage.goto(BANK_URL)
    await expect(bankPage.locator('#balance')).not.toHaveText('Loading...')
    await expect(bankPage.locator('#generate-challenge-btn')).toBeVisible({ timeout: 10000 })

    await bankPage.click('#generate-challenge-btn')

    const challengeTextarea = bankPage.locator('#challenge-uri')
    await expect(challengeTextarea).toBeVisible({ timeout: 10000 })
    await expect(challengeTextarea).not.toHaveValue('')

    const challengeUri = await challengeTextarea.inputValue()
    expect(challengeUri).toContain('ohpp://register?challenge=')

    // --- Step 3: Go to portal, paste the link, connect the app ---
    await portalPage.click('nav >> text=Connect App')
    await expect(portalPage.locator('h1')).toContainText('Connect an app')

    await portalPage.fill('textarea', challengeUri)
    await portalPage.click('button:has-text("Connect app")')

    const successMsg = portalPage.locator('.bg-green-50').first()
    await expect(successMsg).toBeVisible({ timeout: 15000 })
    await expect(successMsg).toContainText('App registered')

    // --- Step 4: Wait for bank to auto-connect via callback ---
    await bankPage.waitForTimeout(5000)
    await bankPage.goto(BANK_URL)
    await expect(bankPage.locator('#balance')).not.toHaveText('Loading...')
    await expect(bankPage.locator('.ohpp-badge')).toBeVisible({ timeout: 10000 })
    await expect(bankPage.locator('.ohpp-badge')).toContainText('OHPP Connected')

    // --- Step 5: Make a transfer — should require approval ---
    await bankPage.selectOption('#payee-select', { index: 0 })
    await bankPage.fill('#amount', '50.00')
    await bankPage.fill('#reference', 'E2E full approval test')
    await bankPage.click('#transfer-form button[type="submit"]')

    const transferResult = bankPage.locator('#transfer-result')
    await expect(transferResult).toBeVisible({ timeout: 15000 })
    await expect(transferResult).not.toContainText('Processing...', { timeout: 15000 })
    await expect(transferResult).toContainText('Waiting for approval')

    // --- Step 6: Go to portal Pending page and approve the request ---
    await portalPage.click('nav >> text=Pending')

    // Wait for the pending request to appear — the bank sends Select options ["Approve transfer", "Deny transfer"]
    const approveBtn = portalPage.locator('button:has-text("Approve transfer")')
    await expect(approveBtn).toBeVisible({ timeout: 15000 })

    // Verify the request summary is visible
    await expect(portalPage.locator('text=bank.demo.test')).toBeVisible()

    // Click the approve option
    await approveBtn.click()

    // The request should disappear (or show empty state)
    await expect(approveBtn).not.toBeVisible({ timeout: 10000 })

    // --- Step 7: Bank should show transfer completed ---
    // The bank polls every 2s for status updates
    await expect(transferResult).toContainText('approved and completed', { timeout: 30000 })

    await portalPage.close()
    await bankPage.close()
  })
})
