import { test } from '@playwright/test'
import { PizzaPage } from '../pages/pizza'
import { runWholeCaseWithPortalAttester } from '../fixtures/whole-case-scenario'

/**
 * Pizza whole-case ceremony (Phase 3.3) — the SAME reusable WholeCaseScenario
 * the Bank and Insurance ride (P4 pluggable attester, P5 audit by construction),
 * with the Pizza (Slice & Dice) app as the requester, driving its STANDARD
 * single-confirm order flow via the portal web attester.
 *
 * Flow: portal enables web approvals -> connect the Pizza app -> place a
 * standard order (raises one `confirm` select request) -> the portal attester
 * answers `confirm` -> the order reaches `confirmed` -> the ceremony appears in
 * Participation History.
 *
 * Runs LAST among the pizza specs (38, after 30/31/37) because the whole-case
 * ceremony mutates shared order/connection state.
 *
 * NOTE: this is the STANDARD order flow (one portal-answerable request), not the
 * 7-step ohpp-pizza modal — that heterogeneous flow is the Flutter app-attester
 * surface (historically undrivable headlessly), covered separately if at all.
 */
test.describe('Pizza — whole-case ceremony (WholeCaseScenario + portal attester)', () => {
  test.setTimeout(240_000)

  test('register -> place order -> confirm in portal -> order confirmed -> audit recorded', async ({
    context,
  }) => {
    const requesterPage = await context.newPage()
    const portalPage = await context.newPage()

    const pizza = new PizzaPage(requesterPage)

    await runWholeCaseWithPortalAttester(portalPage, {
      requester: pizza,
      firstOptionKey: 'confirm',
      answers: [{ kind: 'select', option: 'confirm' }],
    })

    await portalPage.close()
    await requesterPage.close()
  })
})
