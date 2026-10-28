import { expect, test } from '@playwright/test'
import { PortalPage } from '../pages/portal'
import { PortalAttester } from '../pages/portal-attester'
import { BankUiPage } from '../pages/bank-ui'

/**
 * Bank transfer DENY path — converted to page objects (Phase 4.1). The attester
 * denies this spec's own transfer card (by request id, diffed against any
 * pre-existing pending cards), and the bank must show "denied", not "approved".
 */
test.describe('Bank — Transfer denied by user', () => {
  test.setTimeout(60_000)

  test('deny transfer shows denied in bank', async ({ context }) => {
    const portalPage = await context.newPage()
    const bankPage = await context.newPage()

    const portal = new PortalPage(portalPage)
    const attester = new PortalAttester(portalPage)
    const bank = new BankUiPage(bankPage)

    // Portal: login + web approvals. Ensure the bank is OHPP-connected.
    await portal.login()
    await portal.enableWebApprovals()

    await bank.gotoAndWaitLoaded()
    if (!(await bank.connectedBadge().isVisible().catch(() => false))) {
      const challenge = await bank.generateChallenge()
      await portal.connectApp(challenge)
      await bank.assertOhppConnected()
    }

    // Snapshot pre-existing cards so we deny only THIS transfer.
    await attester.openPending()
    const preExisting = await attester.pendingCardIds()

    // Make an OHPP transfer -> pending.
    await bank.gotoNav('payments')
    await bank.makeTransfer({ amount: '25.00', reference: 'E2E deny test' })
    await bank.confirmTransfer()
    await bank.assertTransferResult('Waiting for approval')

    // Deny this spec's new card by id.
    await attester.openPending()
    await expect
      .poll(async () => (await attester.pendingCardIds()).filter((id) => !preExisting.includes(id)).length, {
        timeout: 20_000,
        intervals: [500, 1_000, 2_000],
      })
      .toBeGreaterThanOrEqual(1)
    const myId = (await attester.pendingCardIds()).filter((id) => !preExisting.includes(id))[0]
    await attester.answerCard(myId, { kind: 'select', option: 'deny' })

    // Bank shows DENIED, not approved.
    await expect(bank.transferResult()).toContainText('denied', { timeout: 30_000 })
    await expect(bank.transferResult()).not.toContainText('approved')

    await portalPage.close()
    await bankPage.close()
  })
})
