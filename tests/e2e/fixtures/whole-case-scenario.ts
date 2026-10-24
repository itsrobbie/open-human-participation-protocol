import { expect, type Page } from '@playwright/test'
import { PortalPage } from '../pages/portal'
import { PortalAttester, type StepAnswer } from '../pages/portal-attester'
import { PORTAL_URL } from '../test-urls'

/**
 * WholeCaseScenario — the one reusable cross-system flow (P4), audit by
 * construction (P5).
 *
 * Shape: logged-in requester -> initiate action -> participation request(s)
 * routed via the Resolver -> drive SOME attester -> assert requester done-state
 * -> assert the audit/proof record.
 *
 * The attester is pluggable: this web version uses PortalAttester. The Flutter
 * app version (OhppAttester) consumes the same conceptual steps. A new requester
 * app supplies a RequesterDriver and a list of StepAnswers; the scenario and the
 * audit assertion are shared.
 *
 * Steering compliance: all actions + assertions go through the UI (no direct
 * API calls as test logic). The audit record is asserted via the Portal History
 * page (keyed in Phase 1.1), which renders the Resolver's /api/history proof.
 */

export interface RequesterDriver {
  /** Human label for failure messages (e.g. "Bank"). */
  readonly name: string
  /** Generate the ohpp:// challenge URI the portal will connect with. */
  generateChallengeUri(): Promise<string>
  /** Confirm the app auto-connected (OHPP badge etc.). */
  confirmConnected(): Promise<void>
  /** Initiate the action that raises the participation request(s). */
  initiateAction(): Promise<void>
  /** Assert the requester reached its done-state (e.g. "approved and completed"). */
  assertDoneState(): Promise<void>
  /** A substring that identifies this ceremony's record in the History list. */
  readonly historyMatch: string
}

export interface WholeCaseOptions {
  requester: RequesterDriver
  /** The ordered answers the attester gives (one per participation step). */
  answers: StepAnswer[]
  /** For the attester to know when a card has arrived: the first step's select key. */
  firstOptionKey: string
}

/**
 * Run the full ceremony with the Portal web attester and assert the audit trail.
 * `portalPage` and `attesterPage` may be the same page or two tabs on one context.
 */
export async function runWholeCaseWithPortalAttester(
  portalPage: Page,
  opts: WholeCaseOptions,
): Promise<void> {
  const portal = new PortalPage(portalPage)
  const attester = new PortalAttester(portalPage)
  const { requester, answers, firstOptionKey } = opts

  // 1. Portal account setup: login + enable web approvals.
  await portal.login()
  await portal.enableWebApprovals()

  // 2. Requester issues a challenge; portal connects the app.
  const challengeUri = await requester.generateChallengeUri()
  await portal.connectApp(challengeUri)
  await requester.confirmConnected()

  // 3. Requester initiates the action -> participation request(s) raised.
  //
  // The suite resets the DB only ONCE at global-setup, and earlier specs (e.g.
  // 02-bank-ohpp "transfer with OHPP shows pending") leave UNRESOLVED requests
  // for the demo user. So the Pending page can already show stale cards before
  // this requester acts. We must answer THIS ceremony's own request, never "the
  // first card" — answering a leftover detaches it (looks like success) while
  // our real request stays pending and the requester never reaches done-state.
  // Capture the pre-existing card ids, initiate, then answer only the NEW ones.
  await attester.openPending()
  const preExistingIds = await attester.pendingCardIds()

  await requester.initiateAction()

  // 4. Attester answers each step on THIS ceremony's own card(s), by id.
  await attester.openPending()
  await attester.waitForOption(firstOptionKey)
  await expect
    .poll(async () => (await attester.pendingCardIds()).filter((id) => !preExistingIds.includes(id)).length, {
      timeout: 20_000,
      intervals: [500, 1_000, 2_000],
    })
    .toBeGreaterThanOrEqual(answers.length)
  const myIds = (await attester.pendingCardIds()).filter((id) => !preExistingIds.includes(id))
  for (let i = 0; i < answers.length; i++) {
    // For a single-step ceremony there is one new card; for multi-step the next
    // card appears as the prior resolves, so re-resolve the new-id set each time.
    const currentNew = (await attester.pendingCardIds()).filter((id) => !preExistingIds.includes(id))
    const targetId = currentNew[0] ?? myIds[i]
    await attester.answerCard(targetId, answers[i])
  }

  // 5. Requester reaches its done-state.
  await requester.assertDoneState()

  // 6. P5 — audit by construction: the ceremony appears in Participation
  // History with a resolved status (the proof record the Resolver stores).
  await portal.goto('/history')
  const historyRow = portalPage
    .locator('[data-testid^="ohpp.history"], :text("' + requester.historyMatch + '")')
    .first()
  await expect(
    portalPage.getByText(requester.historyMatch).first(),
    `audit: the ${requester.name} ceremony must appear in Participation History (P5 proof record)`,
  ).toBeVisible({ timeout: 15_000 })
  void historyRow
}

export { PORTAL_URL }
