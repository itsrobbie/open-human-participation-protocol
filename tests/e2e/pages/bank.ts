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
    // Bank auto-connects via callback; reload and wait for the OHPP badge.
    await this.page.goto(BANK_URL)
    await expect(this.page.locator('#balance')).not.toHaveText('Loading...', { timeout: 15_000 })
    await expect(this.page.locator('.ohpp-badge')).toContainText('OHPP Connected', { timeout: 15_000 })
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
