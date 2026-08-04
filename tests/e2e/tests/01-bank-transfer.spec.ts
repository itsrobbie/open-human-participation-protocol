import { test, expect } from '@playwright/test'
import { BANK_URL } from '../test-urls'

test.describe.serial('Bank — Transfer without OHPP', () => {
  test('8. transfer without OHPP completes immediately', async ({ page }) => {
    await page.goto(BANK_URL)

    // Wait for account to load
    await expect(page.locator('#balance')).not.toHaveText('Loading...')
    await page.getByTestId('nav-payments').click()

    // Select a payee and enter amount
    await page.selectOption('#payee-select', { index: 0 })
    await page.fill('#amount', '25.00')
    await page.fill('#reference', 'E2E test transfer')

    // Submit
    await page.click('#transfer-form button[type="submit"]')
    await expect(page.locator('#transfer-review')).toContainText('E2E test transfer')
    await expect(page.locator('#transfer-review')).toContainText('£25.00')
    await page.click('#confirm-transfer')

    // Should complete immediately (no OHPP connected)
    await expect(page.locator('#transfer-result')).toContainText('Transfer completed')
  })

  test('9. balance updates after transfer', async ({ page }) => {
    await page.goto(BANK_URL)
    await expect(page.locator('#balance')).not.toHaveText('Loading...')
    await page.getByTestId('nav-payments').click()

    // Get initial balance
    const balanceBefore = await page.locator('#balance').textContent()
    const amountBefore = parseFloat(balanceBefore!.replace('£', '').replace(',', ''))

    // Transfer
    await page.selectOption('#payee-select', { index: 0 })
    await page.fill('#amount', '10.00')
    await page.click('#transfer-form button[type="submit"]')
    await page.click('#confirm-transfer')
    await expect(page.locator('#transfer-result')).toContainText('Transfer completed')

    // Balance should have decreased
    const balanceAfter = await page.locator('#balance').textContent()
    const amountAfter = parseFloat(balanceAfter!.replace('£', '').replace(',', ''))
    expect(amountAfter).toBeLessThan(amountBefore)
  })

  test('account navigation, payee management, and history filters are durable', async ({ page }) => {
    await page.goto(BANK_URL)
    await expect(page.locator('#account-list')).toContainText('Demo Savings Account')
    await expect(page.locator('#account-list')).toContainText('Demo Current Account')

    await page.locator('#active-account').selectOption('demo-current')
    await expect(page.locator('#balance')).toHaveText('£1,250.00')
    await page.locator('#active-account').selectOption('demo-account')

    await page.getByTestId('nav-payees').click()
    await page.getByText('Add a payee', { exact: true }).click()
    await page.fill('#payee-name', 'Test Plumber')
    await page.fill('#payee-sort-code', '11-22-33')
    await page.fill('#payee-account-number', '12345678')
    await page.click('#add-payee-form button[type="submit"]')
    await expect(page.locator('#payee-list')).toContainText('Test Plumber')
    await page.reload()
    await page.getByTestId('nav-payees').click()
    await expect(page.locator('#payee-list')).toContainText('Test Plumber')

    await page.getByTestId('nav-transactions').click()
    await page.fill('#transaction-search', 'E2E test transfer')
    await expect(page.locator('#transaction-list')).toContainText('E2E test transfer')
    await expect(page.locator('#transaction-list')).not.toContainText('No transactions match')
    await page.locator('#transaction-status-filter').selectOption('Denied')
    await expect(page.locator('#transaction-list')).toContainText('No transactions match')
  })

  test('date and datetime transfers are scheduled without changing the balance', async ({ page }) => {
    await page.goto(BANK_URL)
    await expect(page.locator('#balance')).not.toHaveText('Loading...')
    const balanceBefore = await page.locator('#balance').textContent()

    await page.getByTestId('nav-payments').click()
    await page.selectOption('#payee-select', { index: 0 })
    await page.fill('#amount', '15.00')
    await page.selectOption('#schedule-mode', 'date')
    await page.fill('#schedule-date', '2026-08-10')
    await page.click('#transfer-form button[type="submit"]')
    await expect(page.locator('#review-schedule')).toContainText(/8\/10\/2026|10\/08\/2026/)
    await page.click('#confirm-transfer')
    await expect(page.locator('#transfer-result')).toContainText('Transfer scheduled')

    await page.fill('#amount', '20.00')
    await page.selectOption('#schedule-mode', 'datetime')
    await page.fill('#schedule-datetime', '2026-08-11T14:30')
    await page.click('#transfer-form button[type="submit"]')
    await expect(page.locator('#review-schedule')).toContainText(/8\/11\/2026|11\/08\/2026/)
    await page.click('#confirm-transfer')
    await expect(page.locator('#transfer-result')).toContainText('Transfer scheduled')

    await expect(page.locator('#balance')).toHaveText(balanceBefore!)
    await page.getByTestId('nav-transactions').click()
    await page.locator('#transaction-status-filter').selectOption('Scheduled')
    await expect(page.locator('#transaction-list')).toContainText('Scheduled')
    await expect(page.locator('#transaction-list')).toContainText('£15.00')
    await expect(page.locator('#transaction-list')).toContainText('£20.00')
  })
})
