import { expect, type Locator, type Page } from '@playwright/test'
import { INSURANCE_URL } from '../test-urls'

/**
 * InsuranceUiPage — the general Insurance Claims UI driver for spec 23
 * (separate from the whole-case InsurancePage RequesterDriver, mirroring the
 * bank / bank-ui split). It drives the full app surface the browser journey
 * exercises: login/logout, nav, the claim form (submit + draft), the claim
 * summaries, the status filter, and the OHPP settings panel.
 *
 * Claim cards are keyed per claim id (the app sets data-testid="claim-<id>" and
 * each card control "request-participation-<id>" / "submit-draft-<id>" /
 * "refresh-participation-<id>" / "participation-scenario-<id>"). A test knows a
 * claim by its unique description, not its id, so cardByReference(ref) finds the
 * card by description text, reads its data-testid to recover the id, and returns
 * keyed accessors for that card's controls — no getByRole / render-order.
 *
 * Bare-id state containers (#claim-summary, #policy-summary, #claim-result,
 * #ohpp-status, #claims-empty, #login-result) are pre-existing stable domain
 * ids, accepted by the framework as stable anchors (not text / render-order).
 */

type NavArea = 'dashboard' | 'new-claim' | 'claim-history' | 'ohpp-settings'

export interface ClaimCard {
  readonly id: string
  readonly card: Locator
  requestParticipation(): Promise<void>
  submitDraft(): Promise<void>
  refreshParticipation(): Promise<void>
  selectScenario(value: string): Promise<void>
}

export class InsuranceUiPage {
  constructor(private readonly page: Page) {}

  private tid(id: string): Locator {
    return this.page.getByTestId(id)
  }

  async goto(): Promise<void> {
    await this.page.goto(INSURANCE_URL)
  }

  /** Fill and submit the login form. Does not assert the outcome (callers do). */
  async submitLogin(username: string, password: string): Promise<void> {
    await this.goto()
    await this.tid('login-username').fill(username)
    await this.tid('login-password').fill(password)
    await this.tid('login-submit').click()
  }

  /** Log in as demo and wait for the authenticated app shell. */
  async login(): Promise<void> {
    await this.submitLogin('demo', 'demo')
    await expect(this.page.locator('#app')).toBeVisible({ timeout: 15_000 })
  }

  async logout(): Promise<void> {
    await this.tid('logout').click()
  }

  nav(area: NavArea): Promise<void> {
    return this.tid(`nav-${area}`).click()
  }

  loginScreen(): Locator {
    return this.page.locator('#login')
  }

  loginResult(): Locator {
    return this.page.locator('#login-result')
  }

  appShell(): Locator {
    return this.page.locator('#app')
  }

  claimSummary(): Locator {
    return this.page.locator('#claim-summary')
  }

  policySummary(): Locator {
    return this.page.locator('#policy-summary')
  }

  claimResult(): Locator {
    return this.page.locator('#claim-result')
  }

  claimsEmpty(): Locator {
    return this.page.locator('#claims-empty')
  }

  ohppStatus(): Locator {
    return this.page.locator('#ohpp-status')
  }

  ohppResult(): Locator {
    return this.page.locator('#ohpp-result')
  }

  statusFilter(): Locator {
    return this.tid('claim-status-filter')
  }

  async filterBy(status: string): Promise<void> {
    await this.statusFilter().selectOption(status)
  }

  /** Fill the new-claim form. Must already be on the New claim view. */
  async fillClaim(fields: {
    policy?: string
    incidentDate?: string
    incidentAt?: string
    description: string
    note?: string
    affected?: Array<'building' | 'contents' | 'accommodation'>
    amount: string
  }): Promise<void> {
    if (fields.policy) await this.tid('claim-policy').selectOption(fields.policy)
    if (fields.incidentDate) await this.tid('claim-incident-date').fill(fields.incidentDate)
    if (fields.incidentAt) await this.tid('claim-incident-at').fill(fields.incidentAt)
    await this.tid('claim-description').fill(fields.description)
    if (fields.note) await this.tid('claim-note').fill(fields.note)
    for (const a of fields.affected ?? []) await this.tid(`claim-affected-${a}`).check()
    await this.tid('claim-amount').fill(fields.amount)
  }

  submitClaim(): Promise<void> {
    return this.tid('submit-claim').click()
  }

  saveDraft(): Promise<void> {
    return this.tid('save-claim-draft').click()
  }

  /** Create a claim end-to-end: nav to new-claim, fill, submit. */
  async createClaim(fields: Parameters<InsuranceUiPage['fillClaim']>[0]): Promise<void> {
    await this.nav('new-claim')
    await this.fillClaim(fields)
    await this.submitClaim()
  }

  /**
   * Resolve a claim card by its unique description text and return keyed
   * accessors for its controls (recovered from the card's data-testid id).
   */
  async cardByReference(reference: string): Promise<ClaimCard> {
    const card = this.page.locator('[data-testid^="claim-"]', { hasText: reference }).first()
    await expect(card).toBeVisible({ timeout: 15_000 })
    const testid = await card.getAttribute('data-testid')
    const id = (testid ?? '').replace(/^claim-/, '')
    const page = this.page
    return {
      id,
      card,
      requestParticipation: () => page.getByTestId(`request-participation-${id}`).click(),
      submitDraft: () => page.getByTestId(`submit-draft-${id}`).click(),
      refreshParticipation: () => page.getByTestId(`refresh-participation-${id}`).click(),
      selectScenario: (value: string) => page.getByTestId(`participation-scenario-${id}`).selectOption(value),
    }
  }

  /**
   * Poll a claim's participation status until it shows `status`. The claim
   * history list reflects a resolved status only after a RE-FETCH: re-navigating
   * to the history view reloads the cards, and while still awaiting the card
   * shows a "Refresh participation status" button (which disappears once
   * resolved). So each iteration: re-open claim history, re-locate the card by
   * reference, click its refresh button if still present, then check the status.
   * Bounded; no reliance on a button that vanishes on success. Mirrors the green
   * whole-case driver (spec 29). Returns the resolved card for further asserts.
   */
  async assertCardStatus(reference: string, status: string, timeoutMs = 45_000): Promise<Locator> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      await this.nav('claim-history')
      const card = this.page.locator('[data-testid^="claim-"]', { hasText: reference }).first()
      await expect(card).toBeVisible({ timeout: 10_000 })
      const testid = await card.getAttribute('data-testid')
      const id = (testid ?? '').replace(/^claim-/, '')
      await this.page
        .getByTestId(`refresh-participation-${id}`)
        .click({ timeout: 2_000 })
        .catch(() => {})
      if ((await card.getByText(status).count()) > 0) return card
      if (Date.now() > deadline) {
        await expect(card).toContainText(status, { timeout: 5_000 })
        return card
      }
      await this.page.waitForTimeout(1_500)
    }
  }

  // --- OHPP settings ---

  async generateChallenge(): Promise<string> {
    await this.nav('ohpp-settings')
    await this.tid('generate-challenge').click()
    const uri = this.tid('challenge-uri')
    await expect(uri).toHaveValue(/ohpp:\/\/register\?challenge=/, { timeout: 10_000 })
    return uri.inputValue()
  }

  refreshConnection(): Promise<void> {
    return this.tid('refresh-connection').click()
  }

  /**
   * Poll refresh-then-check until #ohpp-status reads Connected. The
   * resolver -> insurance callback is async and lags a single refresh, so a
   * one-shot refresh + immediate assert races to "Not connected". Bounded; the
   * 1s gap is between polls only (the connect is async server-side).
   */
  async assertConnected(timeoutMs = 30_000): Promise<void> {
    const status = this.ohppStatus()
    const deadline = Date.now() + timeoutMs
    for (;;) {
      if (await status.filter({ hasText: 'Connected' }).isVisible().catch(() => false)) return
      if (Date.now() > deadline) {
        await expect(status).toContainText('Connected', { timeout: 5_000 })
        return
      }
      await this.refreshConnection().catch(() => {})
      await this.page.waitForTimeout(1_000)
    }
  }

  disconnectOhpp(): Promise<void> {
    return this.tid('disconnect-ohpp').click()
  }

  /** Read (or set) the insurance session token in sessionStorage — infra only. */
  getToken(): Promise<string | null> {
    return this.page.evaluate(() => sessionStorage.getItem('ohpp-insurance-token'))
  }

  setToken(value: string): Promise<void> {
    return this.page.evaluate((v) => sessionStorage.setItem('ohpp-insurance-token', v), value)
  }
}
