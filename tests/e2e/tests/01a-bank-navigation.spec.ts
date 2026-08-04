import { expect, test } from '@playwright/test'
import { BANK_URL } from '../test-urls'

test.describe('Bank navigation', () => {
  test('login is a separate surface and opens Overview', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(BANK_URL)
    await page.evaluate(() => localStorage.removeItem('ohpp-bank-access-token'))
    await page.reload()

    await expect(page.getByTestId('bank-login')).toBeVisible()
    await expect(page.getByTestId('bank-shell')).toBeHidden()
    await page.getByTestId('login-username').fill('demo')
    await page.getByTestId('login-password').fill('demo')
    await page.getByTestId('login-submit').click()

    await expect(page.getByTestId('bank-login')).toBeHidden()
    await expect(page.getByTestId('bank-page-overview')).toBeVisible()
    await context.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(BANK_URL)
    await expect(page.getByTestId('bank-page-overview')).toBeVisible()
  })

  test('Overview presents balances, recent activity, and OHPP state', async ({ page }) => {
    const overview = page.getByTestId('bank-page-overview')
    await expect(overview.getByRole('heading', { name: 'Overview' })).toBeVisible()
    await expect(overview.getByText('Available balance')).toBeVisible()
    await expect(overview.getByText('Recent activity')).toBeVisible()
    await expect(overview.getByText('Participation protection')).toBeVisible()
  })

  test('Payments contains the transfer and review flow', async ({ page }) => {
    await page.getByTestId('nav-payments').click()
    const payments = page.getByTestId('bank-page-payments')
    await expect(payments).toBeVisible()
    await expect(payments.locator('#transfer-form')).toBeVisible()
    await expect(payments.getByTestId('review-transfer')).toBeVisible()
    await expect(page.getByTestId('bank-page-transactions')).toBeHidden()
  })

  test('Payees contains the durable list and add form', async ({ page }) => {
    await page.getByTestId('nav-payees').click()
    const payees = page.getByTestId('bank-page-payees')
    await expect(payees.locator('#payee-list')).toBeVisible()
    await expect(payees.getByTestId('show-add-payee')).toBeVisible()
  })

  test('Transactions contains filters without payment controls', async ({ page }) => {
    await page.getByTestId('nav-transactions').click()
    const transactions = page.getByTestId('bank-page-transactions')
    await expect(transactions.getByTestId('transaction-search')).toBeVisible()
    await expect(transactions.getByTestId('transaction-status-filter')).toBeVisible()
    await expect(transactions.locator('#transfer-form')).toHaveCount(0)
  })

  test('Settings contains registration, scenarios, reconnect, and revoke controls', async ({ page }) => {
    await page.getByTestId('nav-settings').click()
    const settings = page.getByTestId('bank-page-settings')
    await expect(settings.getByTestId('generate-challenge')).toBeVisible()
    await expect(settings.getByTestId('protocol-scenario')).toBeVisible()
    await expect(settings.getByTestId('disconnect-ohpp')).toBeAttached()
  })

  test('direct hash routes and browser back restore the selected page', async ({ page }) => {
    await page.goto(`${BANK_URL}/#transactions`)
    await expect(page.getByTestId('bank-page-transactions')).toBeVisible()
    await page.getByTestId('nav-settings').click()
    await expect(page).toHaveURL(/#settings$/)
    await page.goBack()
    await expect(page).toHaveURL(/#transactions$/)
    await expect(page.getByTestId('bank-page-transactions')).toBeVisible()
  })
})
