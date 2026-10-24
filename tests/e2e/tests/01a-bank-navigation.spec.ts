import { expect, test } from '@playwright/test'
import { BankUiPage } from '../pages/bank-ui'
import { BANK_URL } from '../test-urls'

/**
 * Bank navigation — converted to BankUiPage (Phase 4.1). Pages and controls are
 * addressed by the bank's keyed testids (bank-page-*, nav-*, review-transfer,
 * show-add-payee, transaction-*, generate-challenge, disconnect-ohpp), never
 * headings/text.
 */
test.describe('Bank navigation', () => {
  test('login is a separate surface and opens Overview', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await new BankUiPage(page).loginFromScratch()
    await context.close()
  })

  test.beforeEach(async ({ page }) => {
    await new BankUiPage(page).gotoAndWaitLoaded()
    await expect(page.getByTestId('bank-page-overview')).toBeVisible()
  })

  test('Overview is the landing page', async ({ page }) => {
    await expect(new BankUiPage(page).page_('overview')).toBeVisible()
  })

  test('Payments contains the transfer and review flow', async ({ page }) => {
    const bank = new BankUiPage(page)
    await bank.gotoNav('payments')
    await expect(bank.page_('payments').locator('#transfer-form')).toBeVisible()
    await expect(bank.page_('payments').getByTestId('review-transfer')).toBeVisible()
    await expect(bank.page_('transactions')).toBeHidden()
  })

  test('Payees contains the durable list and add form', async ({ page }) => {
    const bank = new BankUiPage(page)
    await bank.gotoNav('payees')
    await expect(bank.page_('payees').locator('#payee-list')).toBeVisible()
    await expect(bank.page_('payees').getByTestId('show-add-payee')).toBeVisible()
  })

  test('Transactions contains filters without payment controls', async ({ page }) => {
    const bank = new BankUiPage(page)
    await bank.gotoNav('transactions')
    await expect(bank.page_('transactions').getByTestId('transaction-search')).toBeVisible()
    await expect(bank.page_('transactions').getByTestId('transaction-status-filter')).toBeVisible()
    await expect(bank.page_('transactions').locator('#transfer-form')).toHaveCount(0)
  })

  test('Settings contains registration, scenarios, and revoke controls', async ({ page }) => {
    const bank = new BankUiPage(page)
    await bank.gotoNav('settings')
    await expect(bank.page_('settings').getByTestId('generate-challenge')).toBeVisible()
    await expect(bank.page_('settings').getByTestId('protocol-scenario')).toBeVisible()
    await expect(bank.page_('settings').getByTestId('disconnect-ohpp')).toBeAttached()
  })

  test('direct hash routes and browser back restore the selected page', async ({ page }) => {
    const bank = new BankUiPage(page)
    await page.goto(`${BANK_URL}/#transactions`)
    await expect(bank.page_('transactions')).toBeVisible()
    await bank.gotoNav('settings')
    await expect(page).toHaveURL(/#settings$/)
    await page.goBack()
    await expect(page).toHaveURL(/#transactions$/)
    await expect(bank.page_('transactions')).toBeVisible()
  })
})
