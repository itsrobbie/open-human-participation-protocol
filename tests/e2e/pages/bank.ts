import { expect, type Page } from '@playwright/test'
import { BANK_URL } from '../test-urls'
import type { RequesterDriver } from '../fixtures/whole-case-scenario'

/**
 * BankPage — the Bank requester driver (a RequesterDriver for WholeCaseScenario).
 *
 * Wraps the Bank SPA's existing stable testids/ids (nav-settings, nav-payments,
 * generate-challenge-btn/#challenge-uri, #payee-select, #amount, #reference,
 * review-transfer, confirm-transfer, #transfer-result, .ohpp-badge). These are
 * the pre-existing bare-named identifiers accepted by the contract — stable, not
 * text/order. No sleeps; waits on the keyed elements.
 */
export class BankPage implements RequesterDriver {
  readonly name = 'Bank'
  readonly historyMatch = 'bank'

  constructor(
    private readonly page: Page,
    private readonly reference = 'whole-case transfer',
  ) {}

  private async open(): Promise<void> {
    await this.page.goto(BANK_URL)
    await expect(this.page.locator('#balance')).not.toHaveText('Loading...', { timeout: 15_000 })
  }

  async generateChallengeUri(): Promise<string> {
    await this.open()
    await this.page.getByTestId('nav-settings').click()
    const genBtn = this.page.locator('#generate-challenge-btn')
    await expect(genBtn).toBeVisible({ timeout: 10_000 })
    await genBtn.click()
    const uri = this.page.locator('#challenge-uri')
    await expect(uri).toBeVisible({ timeout: 10_000 })
    await expect(uri).not.toHaveValue('')
    const value = await uri.inputValue()
    expect(value).toContain('ohpp://register?challenge=')
    return value
  }

  async confirmConnected(): Promise<void> {
    // The bank learns it is connected via an ASYNC server->server callback:
    // the resolver POSTs /ohpp/callback once the Portal registers the challenge,
    // and only then does the account gain an OhppRegistration that flips the
    // badge to "OHPP Connected". That callback lags the Portal's "App registered
    // successfully" banner, and the demo bank reflects connection state only on
    // load/poll — it does NOT hold it reactively. So poll: reload the bank and
    // re-check the badge until it flips, bounded, no fixed sleep.
    const badge = this.page.locator('.ohpp-badge')
    const deadline = Date.now() + 30_000
    for (;;) {
      await this.page.goto(BANK_URL)
      await expect(this.page.locator('#balance')).not.toHaveText('Loading...', { timeout: 15_000 })
      if (
        await badge
          .filter({ hasText: 'OHPP Connected' })
          .isVisible()
          .catch(() => false)
      ) {
        return
      }
      if (Date.now() > deadline) {
        // One last authoritative wait so the failure message is the badge
        // assertion (shows the actual badge text), not a bare loop timeout.
        await expect(badge).toContainText('OHPP Connected', { timeout: 5_000 })
        return
      }
      await this.page.waitForTimeout(1_000) // between reloads only; the connect is async server-side
    }
  }

  async initiateAction(): Promise<void> {
    await this.page.getByTestId('nav-payments').click()
    await this.page.getByTestId('transfer-payee').selectOption({ index: 0 })
    await this.page.getByTestId('transfer-amount').fill('50.00')
    await this.page.getByTestId('transfer-reference').fill(this.reference)
    await this.page.getByTestId('review-transfer').click()
    await this.page.getByTestId('confirm-transfer').click()
    const result = this.page.locator('#transfer-result')
    await expect(result).toBeVisible({ timeout: 15_000 })
    await expect(result).toContainText('Waiting for approval', { timeout: 15_000 })
  }

  async assertDoneState(): Promise<void> {
    const result = this.page.locator('#transfer-result')
    await expect(result).toContainText('approved and completed', { timeout: 30_000 })
  }
}
