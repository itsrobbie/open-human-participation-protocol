import { test, expect } from '@playwright/test'
import { PORTAL_URL, BANK_URL } from '../test-urls'

/**
 * Tests the "batch" scenario: multiple transfers created before any are resolved.
 * This simulates a day's worth of transactions followed by a batch approval session.
 * Validates:
 * - Multiple pending requests can coexist
 * - Transaction history shows all of them
 * - Each can be individually approved or denied
 * - The bank's balance only deducts for approved ones
 */
test.describe('Bank — Batch transfers (multiple pending, then resolve)', () => {
  test.setTimeout(180000)

  test('create 3 transfers, approve 2, deny 1 — all appear in history', async ({ context }) => {
    const portalPage = await context.newPage()
    const bankPage = await context.newPage()

    // --- Setup: Ensure portal is logged in with web approvals enabled ---
    await portalPage.goto(`${PORTAL_URL}/login`)
    await portalPage.fill('input[placeholder="demo"]', 'demo')
    await portalPage.fill('input[type="password"]', 'demo')
    await portalPage.click('button[type="submit"]')
    await expect(portalPage).toHaveURL(PORTAL_URL + '/')

    await portalPage.click('nav >> text=Devices')
    await portalPage.waitForTimeout(1000)

    // Revoke any keyed devices
    while (await portalPage.locator('button:has-text("Revoke")').first().isVisible()) {
      await portalPage.locator('button:has-text("Revoke")').first().click()
      await portalPage.locator('[role="dialog"] button:has-text("Revoke")').click()
      await portalPage.waitForTimeout(500)
    }

    const enableBtn = portalPage.locator('button:has-text("Enable web approvals")')
    if (await enableBtn.isVisible()) {
      await enableBtn.click()
      await expect(portalPage.locator('button:has-text("Enable web approvals")')).toBeHidden({ timeout: 10000 })
    }

    // --- Setup: Ensure bank is OHPP-connected ---
    await bankPage.goto(BANK_URL)
    await expect(bankPage.locator('#balance')).not.toHaveText('Loading...')
    await bankPage.getByTestId('nav-transactions').click()
    if (!(await bankPage.locator('.ohpp-badge').isVisible())) {
      await bankPage.getByTestId('nav-settings').click()
      await bankPage.click('#generate-challenge-btn')
      const challengeTextarea = bankPage.locator('#challenge-uri')
      await expect(challengeTextarea).toBeVisible({ timeout: 10000 })
      const challengeUri = await challengeTextarea.inputValue()

      await portalPage.click('nav >> text=Connect App')
      await portalPage.fill('textarea', challengeUri)
      await portalPage.click('button:has-text("Connect app")')
      await expect(portalPage.locator('.bg-green-50').first()).toBeVisible({ timeout: 15000 })

      await expect.poll(async () => {
        await bankPage.reload()
        return await bankPage.locator('.ohpp-badge').isVisible()
      }, { timeout: 15_000 }).toBe(true)
    }
    await expect(bankPage.locator('.ohpp-badge')).toBeVisible({ timeout: 10000 })

    // --- Record starting balance ---
    const startBalanceText = await bankPage.locator('#balance').textContent()
    const startBalance = parseFloat(startBalanceText!.replace('£', '').replace(',', ''))

    // --- Create 3 transfers WITHOUT resolving any ---
    const transfers = [
      { amount: '10.00', reference: 'Batch test 1' },
      { amount: '10.00', reference: 'Batch test 2' },
      { amount: '10.00', reference: 'Batch test 3' },
    ]

    for (const t of transfers) {
      await bankPage.getByTestId('nav-payments').click()
      await bankPage.selectOption('#payee-select', { index: 0 })
      await bankPage.fill('#amount', t.amount)
      await bankPage.fill('#reference', t.reference)
      await bankPage.click('#transfer-form button[type="submit"]')
      await bankPage.click('#confirm-transfer')

      // Wait for the pending result
      const result = bankPage.locator('#transfer-result')
      await expect(result).toBeVisible({ timeout: 10000 })
      await expect(result).toContainText('Waiting for approval', { timeout: 10000 })

      // Small delay before next transfer
      await bankPage.waitForTimeout(500)
    }

    // --- Verify transaction history shows all 3 as pending ---
    // Reload to get fresh transaction list
    await bankPage.goto(BANK_URL)
    await expect(bankPage.locator('#balance')).not.toHaveText('Loading...')
    await bankPage.getByTestId('nav-transactions').click()

    // Check that batch transfers appear in the transaction list (there may be others from prior tests)
    const allTxns = bankPage.locator('.txn-item')
    await expect(allTxns.first()).toBeVisible({ timeout: 5000 })
    const txnCount = await allTxns.count()
    expect(txnCount).toBeGreaterThanOrEqual(3)

    // At least 3 should be pending (from this test's batch)
    const pendingBadges = bankPage.locator('.txn-status.pendingapproval')
    expect(await pendingBadges.count()).toBeGreaterThanOrEqual(3)

    // --- Now go to portal and resolve them: approve first 2, deny the 3rd ---
    await portalPage.click('nav >> text=Pending')
    await portalPage.waitForTimeout(2000)

    // Should see pending requests (including our 3 batch transfers)
    const approveButtons = portalPage.locator('button:has-text("Approve transfer")')
    await expect.poll(async () => {
      const retry = portalPage.getByRole('button', { name: 'Try again' })
      if (await retry.isVisible()) await retry.click()
      return await approveButtons.count()
    }, { timeout: 70_000, intervals: [1_000, 2_000, 5_000] }).toBeGreaterThanOrEqual(3)

    // Approve the first one
    await approveButtons.first().click()
    await portalPage.waitForTimeout(1000)

    // Approve the second one (now first in the list after the first disappears)
    await expect(approveButtons.first()).toBeVisible({ timeout: 10000 })
    await approveButtons.first().click()
    await portalPage.waitForTimeout(1000)

    // Deny the third one
    const denyButtons = portalPage.locator('button:has-text("Deny transfer")')
    await expect(denyButtons.first()).toBeVisible({ timeout: 10000 })
    await denyButtons.first().click()
    await portalPage.waitForTimeout(1000)

    // --- Wait for bank to poll and update ---
    await bankPage.waitForTimeout(8000)

    // Reload bank to see final state
    await bankPage.goto(BANK_URL)
    await expect(bankPage.locator('#balance')).not.toHaveText('Loading...')
    await bankPage.getByTestId('nav-transactions').click()

    // Wait for transactions to load and refresh their statuses
    await bankPage.waitForTimeout(3000)

    // --- Verify transaction history shows correct statuses ---
    // The status class is lowercase: completed, denied, pendingapproval
    const finalTxns = bankPage.locator('.txn-item')
    await expect(finalTxns.first()).toBeVisible({ timeout: 10000 })

    const completedBadges = bankPage.locator('.txn-status.completed')
    const deniedBadges = bankPage.locator('.txn-status.denied')

    // Should have at least 2 completed and 1 denied
    expect(await completedBadges.count()).toBeGreaterThanOrEqual(2)
    expect(await deniedBadges.count()).toBeGreaterThanOrEqual(1)

    // --- Verify balance deducted once for each approved transfer ---
    const endBalanceText = await bankPage.locator('#balance').textContent()
    const endBalance = parseFloat(endBalanceText!.replace('£', '').replace(',', ''))

    expect(startBalance - endBalance).toBeCloseTo(20, 2)

    await portalPage.close()
    await bankPage.close()
  })
})
