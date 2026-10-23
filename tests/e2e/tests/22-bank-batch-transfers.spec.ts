import { test, expect } from '@playwright/test'
import { BANK_URL } from '../test-urls'
import { PortalPage } from '../pages/portal'
import { PortalAttester } from '../pages/portal-attester'
import { BankPage } from '../pages/bank'

/**
 * Batch scenario: several transfers created before any are resolved (a day's
 * transactions, then a batch approval session). Validates:
 * - multiple pending requests coexist
 * - the bank's transaction history shows all of them
 * - each is individually approved or denied
 * - the balance only deducts for approved transfers
 *
 * Phase 4.1 conversion: setup via PortalPage, attester actions via
 * PortalAttester (scheme controls + wait-for-detach, no raw selectors / sleeps),
 * each OHPP surface on its OWN page (bank + portal both live). The batch-specific
 * assertions (history statuses, balance math) stay in the spec.
 */
test.describe('Bank — Batch transfers (multiple pending, then resolve)', () => {
  test.setTimeout(180_000)

  test('create 3 transfers, approve 2, deny 1 — all appear in history', async ({ context }) => {
    const portalPage = await context.newPage()
    const bankPage = await context.newPage()

    const portal = new PortalPage(portalPage)
    const attester = new PortalAttester(portalPage)
    const bank = new BankPage(bankPage)

    // --- Portal setup: login + web approvals, then connect the bank app ---
    await portal.login()
    await portal.enableWebApprovals()
    const challengeUri = await bank.generateChallengeUri()
    await portal.connectApp(challengeUri)
    await bank.confirmConnected()

    // --- Record starting balance (bank page is on the Overview after connect) ---
    await bankPage.goto(BANK_URL)
    await expect(bankPage.locator('#balance')).not.toHaveText('Loading...', { timeout: 15_000 })
    const startBalanceText = await bankPage.locator('#balance').textContent()
    const startBalance = parseFloat(startBalanceText!.replace('£', '').replace(',', ''))

    // Capture any pre-existing pending cards. The suite resets the DB ONCE at
    // global-setup, so earlier specs' unresolved requests can still be pending
    // for the demo user. We must resolve ONLY this spec's three transfers —
    // approving a leftover (a different amount) is exactly what made the balance
    // delta wrong (150 instead of 20). Steering forbids a per-spec DB reset
    // (DB calls are global-setup only), so we isolate by request id instead.
    await attester.openPending()
    const preExistingIds = await attester.pendingCardIds()

    // --- Create 3 transfers WITHOUT resolving any ---
    const transfers = [
      { amount: '10.00', reference: 'Batch test 1' },
      { amount: '10.00', reference: 'Batch test 2' },
      { amount: '10.00', reference: 'Batch test 3' },
    ]
    for (const t of transfers) {
      await bankPage.getByTestId('nav-payments').click()
      await bankPage.getByTestId('transfer-payee').selectOption({ index: 0 })
      await bankPage.getByTestId('transfer-amount').fill(t.amount)
      await bankPage.getByTestId('transfer-reference').fill(t.reference)
      await bankPage.getByTestId('review-transfer').click()
      await bankPage.getByTestId('confirm-transfer').click()
      const result = bankPage.locator('#transfer-result')
      await expect(result).toBeVisible({ timeout: 15_000 })
      await expect(result).toContainText('Waiting for approval', { timeout: 15_000 })
    }

    // --- Verify transaction history shows at least 3 pending ---
    await bankPage.goto(BANK_URL)
    await expect(bankPage.locator('#balance')).not.toHaveText('Loading...', { timeout: 15_000 })
    await bankPage.getByTestId('nav-transactions').click()
    await expect(bankPage.locator('.txn-item').first()).toBeVisible({ timeout: 10_000 })
    expect(await bankPage.locator('.txn-status.pendingapproval').count()).toBeGreaterThanOrEqual(3)

    // --- Resolve on the Portal: approve 2, deny 1 of THIS SPEC'S OWN cards ---
    await attester.openPending()
    // Wait until this spec's three new cards have propagated to the Pending page
    // (cards present now that were not present before we created the transfers).
    await expect
      .poll(async () => (await attester.pendingCardIds()).filter((id) => !preExistingIds.includes(id)).length, {
        timeout: 70_000,
        intervals: [1_000, 2_000, 5_000],
      })
      .toBeGreaterThanOrEqual(3)

    const myCardIds = (await attester.pendingCardIds()).filter((id) => !preExistingIds.includes(id))
    await attester.answerCard(myCardIds[0], { kind: 'select', option: 'approve' })
    await attester.answerCard(myCardIds[1], { kind: 'select', option: 'approve' })
    await attester.answerCard(myCardIds[2], { kind: 'select', option: 'deny' })

    // --- Verify final statuses in bank history (bank polls the resolver) ---
    // Poll (reload + re-read) until the async resolver->bank status propagation
    // lands 2 completed + 1 denied, then assert — never a one-shot read.
    await expect
      .poll(
        async () => {
          await bankPage.goto(BANK_URL)
          await expect(bankPage.locator('#balance')).not.toHaveText('Loading...', { timeout: 15_000 })
          await bankPage.getByTestId('nav-transactions').click()
          await expect(bankPage.locator('.txn-item').first()).toBeVisible({ timeout: 10_000 })
          const completed = await bankPage.locator('.txn-status.completed').count()
          const denied = await bankPage.locator('.txn-status.denied').count()
          return completed >= 2 && denied >= 1
        },
        { timeout: 40_000, intervals: [2_000, 3_000, 5_000] },
      )
      .toBe(true)

    // --- Balance deducted once per approved transfer (2 x £10) ---
    const endBalanceText = await bankPage.locator('#balance').textContent()
    const endBalance = parseFloat(endBalanceText!.replace('£', '').replace(',', ''))
    expect(startBalance - endBalance).toBeCloseTo(20, 2)

    await portalPage.close()
    await bankPage.close()
  })
})
