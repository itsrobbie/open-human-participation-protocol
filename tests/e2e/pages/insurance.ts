import { expect, type Page } from '@playwright/test'
import { INSURANCE_URL } from '../test-urls'
import type { RequesterDriver } from '../fixtures/whole-case-scenario'

/**
 * InsurancePage — the Insurance Claims requester driver (RequesterDriver for
 * WholeCaseScenario).
 *
 * Insurance raises its participation request differently from Bank: a claim is
 * submitted first, then a DISPOSITION action on the claim card ("Request human
 * participation") is what raises the OHPP request. The option keys are
 * continue / more-information / escalate (NOT approve/deny); `continue` resolves
 * the claim to ApprovedForNextStep. The app reflects the resolved status only
 * when the card's "Refresh participation status" button is clicked, so
 * assertDoneState polls refresh-then-check (bounded, no fixed sleep).
 *
 * Existing stable testids are used where present (login-*, nav-*,
 * generate-challenge, challenge-uri, submit-claim, #claim-result, #ohpp-status).
 * The claim-card controls (disposition select, the two participation buttons,
 * the status text) have no scheme testid yet, so they are addressed by the
 * stable role+exact-name / unique-reference-text selectors spec 23 already
 * proves — stable, not render-order.
 */
export class InsurancePage implements RequesterDriver {
  readonly name = 'Insurance'
  readonly historyMatch = 'Insurance claim'

  constructor(
    private readonly page: Page,
    // Unique per run so the claim card is addressable without render-order.
    private readonly reference = `whole-case insurance ${Date.now()}`,
  ) {}

  private async signIn(): Promise<void> {
    await this.page.goto(INSURANCE_URL)
    await this.page.getByTestId('login-username').fill('demo')
    await this.page.getByTestId('login-password').fill('demo')
    await this.page.getByTestId('login-submit').click()
    await expect(this.page.getByTestId('nav-new-claim')).toBeVisible({ timeout: 15_000 })
  }

  async generateChallengeUri(): Promise<string> {
    await this.signIn()
    await this.page.getByTestId('nav-ohpp-settings').click()
    // The insurance app's OHPP connection persists in the once-reset shared DB
    // (e.g. spec 23 connects it earlier). When already connected,
    // generate-challenge errors ("Already connected to OHPP") and never reveals
    // the challenge-uri panel. So reset to a clean slate first: if a connection
    // exists, disconnect it (DELETE /api/ohpp/disconnect), then generate fresh.
    const disconnect = this.page.getByTestId('disconnect-ohpp')
    if (await disconnect.isEnabled().catch(() => false)) {
      await disconnect.click()
      // After disconnect the app re-loads status; the challenge panel hides.
      await expect(this.page.locator('#ohpp-status')).not.toContainText('Connected to the Resolver', {
        timeout: 10_000,
      })
    }
    const gen = this.page.getByTestId('generate-challenge')
    await expect(gen).toBeVisible({ timeout: 10_000 })
    await gen.click()
    const uri = this.page.getByTestId('challenge-uri')
    await expect(uri).toBeVisible({ timeout: 10_000 })
    await expect(uri).toHaveValue(/ohpp:\/\/register\?challenge=/, { timeout: 10_000 })
    return uri.inputValue()
  }

  async confirmConnected(): Promise<void> {
    // #ohpp-status flips to "Connected" after the async resolver->app callback.
    // Poll refresh-then-check, bounded; no fixed sleep.
    const status = this.page.locator('#ohpp-status')
    const deadline = Date.now() + 30_000
    for (;;) {
      if (await status.filter({ hasText: 'Connected' }).isVisible().catch(() => false)) return
      if (Date.now() > deadline) {
        await expect(status).toContainText('Connected', { timeout: 5_000 })
        return
      }
      await this.page.getByTestId('refresh-connection').click().catch(() => {})
      await this.page.waitForTimeout(1_000) // between polls only; connect is async server-side
    }
  }

  async initiateAction(): Promise<void> {
    // Submit a uniquely-referenced claim.
    await this.page.getByTestId('nav-new-claim').click()
    await this.page.getByTestId('claim-incident-date').fill('2026-07-30')
    await this.page.getByTestId('claim-description').fill(this.reference)
    await this.page.getByTestId('claim-amount').fill('500')
    await this.page.getByTestId('submit-claim').click()
    await expect(this.page.locator('#claim-result')).toContainText('submitted', { timeout: 15_000 })

    // Trigger the disposition -> this raises the OHPP participation request.
    await this.page.getByTestId('nav-claim-history').click()
    const card = this.page.locator('.claim-card', { hasText: this.reference })
    await expect(card).toBeVisible({ timeout: 15_000 })
    await card.locator('select').selectOption('SelectDisposition')
    await card.getByRole('button', { name: 'Request human participation' }).click()
    await expect(card).toContainText('AwaitingParticipation', { timeout: 15_000 })
  }

  async assertDoneState(): Promise<void> {
    // The claim-history list reflects the resolved status only after a RE-FETCH:
    // re-navigating to the history view reloads the cards, and while still
    // AwaitingParticipation the card shows a "Refresh participation status"
    // button (which disappears once resolved). So each poll: re-open claim
    // history, click refresh if it is still there, then check the reference
    // card's status. Bounded; no reliance on a button that vanishes on success.
    const deadline = Date.now() + 45_000
    for (;;) {
      await this.page.getByTestId('nav-claim-history').click()
      const card = this.page.locator('.claim-card', { hasText: this.reference })
      await expect(card).toBeVisible({ timeout: 10_000 })
      await card
        .getByRole('button', { name: 'Refresh participation status' })
        .click({ timeout: 2_000 })
        .catch(() => {})
      if ((await card.getByText('ApprovedForNextStep').count()) > 0) return
      if (Date.now() > deadline) {
        await expect(card).toContainText('ApprovedForNextStep', { timeout: 5_000 })
        return
      }
      await this.page.waitForTimeout(1_500) // between re-fetches; resolution is async server-side
    }
  }
}
