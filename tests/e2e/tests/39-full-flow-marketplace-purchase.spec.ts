import { test } from '@playwright/test'
import { MarketplacePage } from '../pages/marketplace'
import { runWholeCaseWithPortalAttester } from '../fixtures/whole-case-scenario'

/**
 * Marketplace whole-case ceremony (Phase 3.4) — the SAME reusable
 * WholeCaseScenario the Bank, Insurance and Pizza ride (P4 pluggable attester,
 * P5 audit by construction), with the Marketplace (NeonMarket) app as the
 * requester, driving its STANDARD single-confirm purchase via the portal web
 * attester.
 *
 * Flow: portal enables web approvals -> connect the Marketplace app -> buy a
 * sub-£100 product (raises one `confirm` select request) -> the portal attester
 * answers `confirm` -> the purchase reaches `confirmed` -> the ceremony appears
 * in Participation History.
 *
 * Runs LAST among the marketplace specs (39, after 32/33) because the whole-case
 * ceremony mutates shared purchase/connection state.
 *
 * NOTE: this is the STANDARD (sub-threshold) purchase — one portal-answerable
 * `confirm` select. A >= £100 product raises a `signature` request, and the
 * bundle/delivery/total flows raise multiselect/datetime/number; those are
 * separate request-type coverage, not this single-confirm whole-case.
 */
test.describe('Marketplace — whole-case ceremony (WholeCaseScenario + portal attester)', () => {
  test.setTimeout(240_000)

  test('register -> buy -> confirm in portal -> purchase confirmed -> audit recorded', async ({
    context,
  }) => {
    const requesterPage = await context.newPage()
    const portalPage = await context.newPage()

    const marketplace = new MarketplacePage(requesterPage)

    await runWholeCaseWithPortalAttester(portalPage, {
      requester: marketplace,
      firstOptionKey: 'confirm',
      answers: [{ kind: 'select', option: 'confirm' }],
    })

    await portalPage.close()
    await requesterPage.close()
  })
})
