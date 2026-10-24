import { expect, test } from '@playwright/test'
import { PortalPage } from '../pages/portal'
import { PortalAttester, type StepAnswer } from '../pages/portal-attester'
import { BankUiPage } from '../pages/bank-ui'

/**
 * All seven protocol types resolved and interpreted by the Bank — converted to
 * page objects (Phase 4.1). Each scenario is created in the bank Settings, then
 * answered on the Portal via PortalAttester (by this scenario's own new card id,
 * diffed against pre-existing cards), and the bank's interpretation is verified.
 */
test('all seven protocol types are resolved and interpreted by the Bank', async ({ page, context }) => {
  test.setTimeout(150_000)

  const portalPage = await context.newPage()
  const portal = new PortalPage(portalPage)
  const attester = new PortalAttester(portalPage)
  const bank = new BankUiPage(page)

  await portal.login()
  await portal.enableWebApprovals()

  await bank.gotoAndWaitLoaded()
  if (!(await bank.connectedBadge().isVisible().catch(() => false))) {
    const challenge = await bank.generateChallenge()
    await portal.connectApp(challenge)
    await bank.assertOhppConnected()
  }

  const scenarios: { scenario: string; answer: StepAnswer; interpreted: string }[] = [
    { scenario: 'TransferDecision', answer: { kind: 'select', option: 'continue' }, interpreted: 'continue' },
    { scenario: 'TransferControls', answer: { kind: 'multiselect', options: ['urgent', 'international'] }, interpreted: 'urgent, international' },
    { scenario: 'PaymentReference', answer: { kind: 'input', value: 'Bank browser reference' }, interpreted: 'Bank browser reference' },
    { scenario: 'TransferAmount', answer: { kind: 'input', value: '425' }, interpreted: '425' },
    { scenario: 'PaymentDate', answer: { kind: 'input', value: '2026-08-15' }, interpreted: '2026-08-15' },
    { scenario: 'PaymentDateTime', answer: { kind: 'input', value: '2026-08-16T10:30' }, interpreted: '2026-08-16T10:30' },
    { scenario: 'HighValueAcknowledgement', answer: { kind: 'signature' }, interpreted: 'acknowledged' },
  ]

  for (const item of scenarios) {
    await attester.openPending()
    const preExisting = await attester.pendingCardIds()

    await bank.createProtocolScenario(item.scenario)

    await attester.openPending()
    await expect
      .poll(async () => (await attester.pendingCardIds()).filter((id) => !preExisting.includes(id)).length, {
        timeout: 20_000,
        intervals: [500, 1_000, 2_000],
      })
      .toBeGreaterThanOrEqual(1)
    const myId = (await attester.pendingCardIds()).filter((id) => !preExisting.includes(id))[0]
    await attester.answerCard(myId, item.answer)

    await bank.assertProtocolInterpreted(item.interpreted)
  }

  await portalPage.close()
})
