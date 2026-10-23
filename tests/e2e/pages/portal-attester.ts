import type { Page } from '@playwright/test'
import { BasePage, waitForTestId } from './base'
import { PORTAL_URL } from '../test-urls'

/**
 * PortalAttester: the web-attester driver (P3/P4).
 *
 * Drives the Portal's web-approval surface to answer a pending participation
 * request. One intent method `answerCurrentStep(...)` dispatches on the request
 * type using the keyed controls added in Phase 1.1 (ohpp.pending.*). The
 * WholeCaseScenario swaps this for the Flutter OhppAttester without changing the
 * scenario.
 *
 * Preconditions (handled by the scenario / Devices page): the logged-in user has
 * web approvals enabled (a browser device registered) so the Pending page shows
 * the server's pending requests.
 */
export type StepAnswer =
  | { kind: 'select'; option: string }
  | { kind: 'multiselect'; options: string[] }
  | { kind: 'input'; value: string }
  | { kind: 'signature' }

export class PortalAttester extends BasePage {
  constructor(page: Page) {
    super(page, PORTAL_URL)
  }

  /** Navigate to the Pending page and wait for it to be interactive. */
  async openPending(): Promise<void> {
    await this.goto('/pending')
    // Either the list renders, or the "web approvals disabled" notice does.
    // Wait for the page heading region to settle; the scenario asserts a card
    // appears via waitForOption below.
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Answer the single currently-pending step. Deterministic AND card-scoped:
   * every ohpp.pending.* control is rendered once PER CARD (non-unique across
   * cards), so a page-wide locator strict-mode-violates the moment more than
   * one card is pending. The suite resets the DB only once at global-setup, so
   * by the time a later spec runs, earlier specs' unresolved requests linger
   * and the current user can have several cards. We therefore resolve the FIRST
   * card's id, scope the control locators INSIDE that card, act, then wait for
   * THAT card to DETACH — the card leaves the pending list only once the
   * Resolver accepts the answer. Scoping kills the ambiguity; waiting for the
   * specific card's detach (never a page-wide control) is what keeps it
   * deterministic on the slower, cold CI runner.
   */
  async answerCurrentStep(answer: StepAnswer): Promise<void> {
    const first = this.page.locator('[data-testid^="ohpp.pending.card."]').first()
    await first.waitFor({ state: 'visible', timeout: 20_000 })
    const testid = await first.getAttribute('data-testid')
    if (!testid) throw new Error('first pending card has no data-testid')
    const requestId = testid.replace('ohpp.pending.card.', '')
    const card = this.page.locator(`[data-testid="ohpp.pending.card.${requestId}"]`)

    switch (answer.kind) {
      case 'select': {
        await card.getByTestId(`ohpp.pending.option.${answer.option}`).click()
        break
      }
      case 'multiselect': {
        for (const opt of answer.options) {
          await card.getByTestId(`ohpp.pending.multioption.${opt}`).click()
        }
        await card.getByTestId('ohpp.pending.multiselect.submit').click()
        break
      }
      case 'input': {
        await card.getByTestId('ohpp.pending.input.field').fill(answer.value)
        await card.getByTestId('ohpp.pending.input.submit').click()
        break
      }
      case 'signature': {
        await card.getByTestId('ohpp.pending.signature.submit').click()
        break
      }
    }

    // The specific card detaches once the Resolver accepts the answer.
    await card.waitFor({ state: 'detached', timeout: 20_000 })
  }

  /** Wait until some pending request's select option is present (a card arrived). */
  async waitForOption(optionKey: string, timeoutMs = 20_000): Promise<void> {
    await waitForTestId(this.page, `ohpp.pending.option.${optionKey}`, { timeout: timeoutMs })
  }

  /** How many pending cards are currently shown (keyed ohpp.pending.card.<id>). */
  async pendingCardCount(): Promise<number> {
    return this.page.locator('[data-testid^="ohpp.pending.card."]').count()
  }

  /** Request ids of all currently-pending cards (from ohpp.pending.card.<id>). */
  async pendingCardIds(): Promise<string[]> {
    const cards = this.page.locator('[data-testid^="ohpp.pending.card."]')
    const n = await cards.count()
    const ids: string[] = []
    for (let i = 0; i < n; i++) {
      const testid = await cards.nth(i).getAttribute('data-testid')
      if (testid) ids.push(testid.replace('ohpp.pending.card.', ''))
    }
    return ids
  }

  /**
   * Answer a SPECIFIC pending card by request id — for scenarios where several
   * cards coexist (the suite resets the DB once, so prior specs' unresolved
   * requests linger) and the caller KNOWS which request is its own. Scopes
   * every control inside that card and waits for the card to detach (the
   * Resolver accepted the answer). Prefer this over answerCurrentStep whenever
   * the request id is in hand — answering "the first card" is wrong when a
   * stale card from another spec precedes your own.
   */
  async answerCard(requestId: string, answer: StepAnswer): Promise<void> {
    const card = this.page.locator(`[data-testid="ohpp.pending.card.${requestId}"]`)
    await card.waitFor({ state: 'visible', timeout: 20_000 })
    switch (answer.kind) {
      case 'select':
        await card.getByTestId(`ohpp.pending.option.${answer.option}`).click()
        break
      case 'multiselect':
        for (const opt of answer.options) {
          await card.getByTestId(`ohpp.pending.multioption.${opt}`).click()
        }
        await card.getByTestId('ohpp.pending.multiselect.submit').click()
        break
      case 'input':
        await card.getByTestId('ohpp.pending.input.field').fill(answer.value)
        await card.getByTestId('ohpp.pending.input.submit').click()
        break
      case 'signature':
        await card.getByTestId('ohpp.pending.signature.submit').click()
        break
    }
    await card.waitFor({ state: 'detached', timeout: 20_000 })
  }

  /**
   * Answer the FIRST pending card with the given option key (batch convenience
   * when the exact id is not tracked). Resolves the first card's specific id
   * BEFORE clicking, then waits for THAT id to detach — a bare `.first()`
   * locator over a set that still has members is never 'detached' (the next
   * card becomes first), which would hang.
   */
  async answerFirstCard(optionKey: string): Promise<void> {
    const first = this.page.locator('[data-testid^="ohpp.pending.card."]').first()
    await first.waitFor({ state: 'visible', timeout: 20_000 })
    const testid = await first.getAttribute('data-testid')
    if (!testid) throw new Error('first pending card has no data-testid')
    const requestId = testid.replace('ohpp.pending.card.', '')
    await this.answerCard(requestId, { kind: 'select', option: optionKey })
  }
}
