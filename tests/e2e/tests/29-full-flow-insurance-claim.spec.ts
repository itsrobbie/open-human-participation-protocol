import { test } from '@playwright/test'
import { InsurancePage } from '../pages/insurance'
import { runWholeCaseWithPortalAttester } from '../fixtures/whole-case-scenario'

/**
 * Insurance whole-case ceremony (Phase 3.2) — the SAME reusable
 * WholeCaseScenario the Bank rides (P4 pluggable attester, P5 audit by
 * construction), with the Insurance Claims app as the requester.
 *
 * Flow: logged-in portal enables web approvals -> connect the Insurance app ->
 * submit a claim and request human participation (raises the OHPP request) ->
 * the portal web attester answers `continue` -> the claim reaches
 * ApprovedForNextStep -> the ceremony appears in Participation History.
 *
 * Architecture (locked): each surface gets its OWN Playwright page in one
 * context — the Insurance requester on its page, the portal/attester on theirs,
 * both live. No shared-page navigation.
 */
test.describe('Insurance — whole-case ceremony (WholeCaseScenario + portal attester)', () => {
  // Insurance's ceremony has more round-trips than Bank's single-step transfer
  // (submit claim -> disposition -> async resolver callback -> on-demand refresh
  // to surface the resolved status), so it needs more headroom than 180s.
  test.setTimeout(240_000)

  test('register -> claim + request participation -> approve in portal -> ApprovedForNextStep -> audit recorded', async ({
    context,
  }) => {
    const requesterPage = await context.newPage()
    const portalPage = await context.newPage()

    const insurance = new InsurancePage(requesterPage)

    await runWholeCaseWithPortalAttester(portalPage, {
      requester: insurance,
      // Insurance disposition options: continue / more-information / escalate.
      // `continue` resolves the claim to ApprovedForNextStep (the done-state the
      // InsurancePage driver asserts).
      firstOptionKey: 'continue',
      answers: [{ kind: 'select', option: 'continue' }],
    })

    await portalPage.close()
    await requesterPage.close()
  })
})
