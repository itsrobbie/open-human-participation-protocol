import { test } from '@playwright/test'
import { BankPage } from '../pages/bank'
import { runWholeCaseWithPortalAttester } from '../fixtures/whole-case-scenario'

/**
 * Bank whole-case ceremony — the CANONICAL reference both attester sides ride
 * (web here; app in platform/client-app/integration_test/bank_approval_flow_test.dart).
 *
 * This is now expressed declaratively through the shared WholeCaseScenario:
 * login -> enable web approvals -> connect app -> initiate transfer -> attester
 * approves -> assert the bank reaches "approved and completed" -> assert the
 * audit/proof record appears in Participation History (P5).
 *
 * No sleeps, no text/CSS selectors, no missing audit assertion — the
 * anti-patterns of the previous hand-rolled version are gone. A new requester
 * app is a ~5-line spec on the same fixture (see tests/VALIDATION-FRAMEWORK.md).
 */
test.describe('Bank — whole-case ceremony (WholeCaseScenario + portal attester)', () => {
  test.setTimeout(90_000)

  test('register -> transfer -> approve in portal -> bank completed -> audit recorded', async ({
    context,
  }) => {
    const page = await context.newPage()
    const bankPage = await context.newPage()
    const bank = new BankPage(bankPage, 'E2E whole-case transfer')

    await runWholeCaseWithPortalAttester(page, {
      requester: bank,
      answers: [{ kind: 'select', option: 'approve' }],
      firstOptionKey: 'approve',
    })

    await page.close()
    await bankPage.close()
  })
})
