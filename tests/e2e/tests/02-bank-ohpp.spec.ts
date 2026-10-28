import { expect, test } from '@playwright/test'
import { BankUiPage } from '../pages/bank-ui'
import { PortalPage } from '../pages/portal'

/**
 * Bank OHPP connection — converted to BankUiPage + PortalPage (Phase 4.1).
 *
 * Test 12 deliberately initiates an OHPP transfer and leaves it "Waiting for
 * approval" (a leftover pending request the suite's once-only reset keeps for
 * later specs). That behaviour is preserved.
 */
test.describe.serial('Bank — OHPP connection', () => {
  test('10. connect OHPP shows success', async ({ page, context }) => {
    const portalPage = await context.newPage()
    const portal = new PortalPage(portalPage)
    await portal.login()
    await portal.enableWebApprovals()

    const bank = new BankUiPage(page)
    await bank.gotoAndWaitLoaded()
    const challenge = await bank.generateChallenge()

    await portal.connectApp(challenge)
    await bank.assertOhppConnected()
    await portalPage.close()
  })

  test('11. OHPP badge visible when connected', async ({ page }) => {
    const bank = new BankUiPage(page)
    await bank.gotoAndWaitLoaded()
    await expect(bank.connectedBadge()).toBeVisible()
  })

  test('12. transfer with OHPP shows pending', async ({ page }) => {
    const bank = new BankUiPage(page)
    await bank.gotoAndWaitLoaded()
    await bank.gotoNav('payments')
    await bank.makeTransfer({ amount: '100.00' })
    await bank.confirmTransfer()
    await bank.assertTransferResult('Waiting for approval')
  })
})
