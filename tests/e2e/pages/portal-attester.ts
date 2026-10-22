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
   * Answer the single currently-pending step. Deterministic: waits for the
   * type-specific keyed control, then acts. Returns when the control has been
   * actioned (the request leaves the pending list on success).
   */
  async answerCurrentStep(answer: StepAnswer): Promise<void> {
    switch (answer.kind) {
      case 'select': {
        await this.clickTestId(`ohpp.pending.option.${answer.option}`)
        return
      }
      case 'multiselect': {
        for (const opt of answer.options) {
          await this.clickTestId(`ohpp.pending.multioption.${opt}`)
        }
        await this.clickTestId('ohpp.pending.multiselect.submit')
        return
      }
      case 'input': {
        await this.fillTestId('ohpp.pending.input.field', answer.value)
        await this.clickTestId('ohpp.pending.input.submit')
        return
      }
      case 'signature': {
        await this.clickTestId('ohpp.pending.signature.submit')
        return
      }
    }
  }

  /** Wait until some pending request's select option is present (a card arrived). */
  async waitForOption(optionKey: string, timeoutMs = 20_000): Promise<void> {
    await waitForTestId(this.page, `ohpp.pending.option.${optionKey}`, { timeout: timeoutMs })
  }
}
