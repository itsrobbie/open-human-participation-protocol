import { expect, type Page } from '@playwright/test'
import { BANK_URL } from '../test-urls'

export type BankPageName = 'overview' | 'payments' | 'payees' | 'transactions' | 'settings'

/**
 * BankUiPage — page object for the Bank demo SPA's own UI (Phase 4.1), distinct
 * from the whole-case RequesterDriver in bank.ts. Wraps the bank's stable keyed
 * testids (bank-login, login-*, nav-*, bank-page-*, transfer-*, review-transfer,
 * confirm-transfer, show-add-payee, payee-*, transaction-*, generate-challenge,
 * disconnect-ohpp, logout) and its pre-existing bare #ids (#balance,
 * #transfer-review, #review-schedule, #transfer-result, #account-list,
 * #payee-list, #transaction-list, #schedule-*) — both stable, never text/order.
 */
export class BankUiPage {
  constructor(private readonly page: Page) {}

  private tid(id: string) {
    return this.page.locator(`[data-testid="${id}"]`)
  }

  /** Open the bank and wait for the account to finish loading. */
  async gotoAndWaitLoaded(): Promise<void> {
    await this.page.goto(BANK_URL)
    await expect(this.page.locator('#balance')).not.toHaveText('Loading...', { timeout: 15_000 })
  }

  /** From a clean (logged-out) state, log in via the keyed bank login form. */
  async loginFromScratch(): Promise<void> {
    await this.page.goto(BANK_URL)
    await this.page.evaluate(() => localStorage.removeItem('ohpp-bank-access-token'))
    await this.page.reload()
    await expect(this.tid('bank-login')).toBeVisible()
    await expect(this.tid('bank-shell')).toBeHidden()
    await this.tid('login-username').fill('demo')
    await this.tid('login-password').fill('demo')
    await this.tid('login-submit').click()
    await expect(this.tid('bank-login')).toBeHidden()
    await expect(this.tid('bank-page-overview')).toBeVisible()
  }

  async gotoNav(page: BankPageName): Promise<void> {
    await this.tid(`nav-${page}`).click()
    await expect(this.tid(`bank-page-${page}`)).toBeVisible()
  }

  page_(name: BankPageName) {
    return this.tid(`bank-page-${name}`)
  }

  async readBalance(): Promise<string> {
    return (await this.page.locator('#balance').textContent()) ?? ''
  }

  async balanceAmount(): Promise<number> {
    const t = await this.readBalance()
    return parseFloat(t.replace('£', '').replace(',', ''))
  }

  async selectActiveAccount(value: string): Promise<void> {
    await this.page.locator('#active-account').selectOption(value)
  }

  /**
   * Fill and submit the transfer form, then confirm. Pass a schedule mode +
   * date/datetime to schedule instead of transferring immediately.
   */
  async makeTransfer(opts: {
    payeeIndex?: number
    amount: string
    reference?: string
    schedule?: { mode: 'date'; date: string } | { mode: 'datetime'; datetime: string }
  }): Promise<void> {
    await this.tid('transfer-payee').selectOption({ index: opts.payeeIndex ?? 0 })
    await this.tid('transfer-amount').fill(opts.amount)
    if (opts.reference !== undefined) await this.tid('transfer-reference').fill(opts.reference)
    if (opts.schedule?.mode === 'date') {
      await this.page.locator('#schedule-mode').selectOption('date')
      await this.page.locator('#schedule-date').fill(opts.schedule.date)
    } else if (opts.schedule?.mode === 'datetime') {
      await this.page.locator('#schedule-mode').selectOption('datetime')
      await this.page.locator('#schedule-datetime').fill(opts.schedule.datetime)
    }
    await this.tid('review-transfer').click()
  }

  async confirmTransfer(): Promise<void> {
    await this.tid('confirm-transfer').click()
  }

  reviewText() {
    return this.page.locator('#transfer-review')
  }

  reviewScheduleText() {
    return this.page.locator('#review-schedule')
  }

  async assertTransferResult(text: string): Promise<void> {
    await expect(this.page.locator('#transfer-result')).toContainText(text, { timeout: 15_000 })
  }

  // --- Payees ---
  async addPayee(name: string, sortCode: string, accountNumber: string): Promise<void> {
    await this.tid('show-add-payee').click()
    await this.tid('payee-name').fill(name)
    await this.tid('payee-sort-code').fill(sortCode)
    await this.tid('payee-account-number').fill(accountNumber)
    await this.page.locator('#add-payee-form button[type="submit"]').click()
  }

  payeeList() {
    return this.page.locator('#payee-list')
  }

  // --- Transactions ---
  async searchTransactions(term: string): Promise<void> {
    await this.tid('transaction-search').fill(term)
  }

  async filterTransactionStatus(status: string): Promise<void> {
    await this.tid('transaction-status-filter').selectOption(status)
  }

  transactionList() {
    return this.page.locator('#transaction-list')
  }

  accountList() {
    return this.page.locator('#account-list')
  }

  // --- OHPP connection (spec 02) ---

  /** On Settings, generate the challenge and return the ohpp:// URI. */
  async generateChallenge(): Promise<string> {
    await this.gotoNav('settings')
    await this.tid('generate-challenge').click()
    const uri = this.tid('challenge-uri')
    await expect(uri).toHaveValue(/ohpp:\/\/register\?challenge=/, { timeout: 10_000 })
    return uri.inputValue()
  }

  /** Poll reload-until the keyed OHPP-connected badge appears (resolver->bank
   * callback is async and lags a single reload). */
  async assertOhppConnected(): Promise<void> {
    const badge = this.tid('ohpp.bank.connected-badge')
    const deadline = Date.now() + 30_000
    for (;;) {
      await this.gotoAndWaitLoaded()
      if (await badge.isVisible().catch(() => false)) return
      if (Date.now() > deadline) {
        await expect(badge).toBeVisible({ timeout: 5_000 })
        return
      }
      await this.page.waitForTimeout(1_000) // between reloads only; connect is async server-side
    }
  }

  connectedBadge() {
    return this.tid('ohpp.bank.connected-badge')
  }

  // --- Raw form submit (spec 17 validation cases) ---

  /** Fill payee/amount/reference and click the form submit (no review step). */
  async fillTransferForm(opts: { payeeIndex?: number; amount: string; reference?: string }): Promise<void> {
    await this.tid('transfer-payee').selectOption({ index: opts.payeeIndex ?? 0 })
    await this.tid('transfer-amount').fill(opts.amount)
    if (opts.reference !== undefined) await this.tid('transfer-reference').fill(opts.reference)
  }

  async submitTransferForm(): Promise<void> {
    await this.page.locator('#transfer-form button[type="submit"]').click()
  }

  transferResult() {
    return this.page.locator('#transfer-result')
  }

  // --- Protocol scenarios (spec 22a) ---

  /** On Settings, create a protocol scenario; asserts it is awaiting participation. */
  async createProtocolScenario(scenario: string): Promise<void> {
    await this.gotoNav('settings')
    await this.page.locator('#protocol-scenario').selectOption(scenario)
    await this.tid('create-protocol-scenario').click()
    await expect(this.page.locator('#protocol-scenario-result')).toContainText('Awaiting human participation', {
      timeout: 15_000,
    })
  }

  /** Poll refresh-until the scenario result reports a verified interpretation containing `value`. */
  async assertProtocolInterpreted(value: string): Promise<void> {
    await expect
      .poll(
        async () => {
          await this.tid('refresh-protocol-scenario').click()
          return this.page.locator('#protocol-scenario-result').textContent()
        },
        { timeout: 15_000 },
      )
      .toContain('Verified bank interpretation')
    await expect(this.page.locator('#protocol-scenario-result')).toContainText(value)
  }
}
