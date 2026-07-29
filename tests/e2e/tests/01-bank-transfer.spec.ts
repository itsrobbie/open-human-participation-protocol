import { test, expect } from '@playwright/test'
import { BANK_URL } from '../test-urls'

test.describe.serial('Bank — Transfer without OHPP', () => {
  test('8. transfer without OHPP completes immediately', async ({ page }) => {
    await page.goto(BANK_URL)

    // Wait for account to load
    await expect(page.locator('#balance')).not.toHaveText('Loading...')

    // Select a payee and enter amount
    await page.selectOption('#payee-select', { index: 0 })
    await page.fill('#amount', '25.00')
    await page.fill('#reference', 'E2E test transfer')

    // Submit
    await page.click('button[type="submit"]')

    // Should complete immediately (no OHPP connected)
    await expect(page.locator('#transfer-result')).toContainText('Transfer completed')
  })

  test('9. balance updates after transfer', async ({ page }) => {
    await page.goto(BANK_URL)
    await expect(page.locator('#balance')).not.toHaveText('Loading...')

    // Get initial balance
    const balanceBefore = await page.locator('#balance').textContent()
    const amountBefore = parseFloat(balanceBefore!.replace('£', '').replace(',', ''))

    // Transfer
    await page.selectOption('#payee-select', { index: 0 })
    await page.fill('#amount', '10.00')
    await page.click('button[type="submit"]')
    await expect(page.locator('#transfer-result')).toContainText('Transfer completed')

    // Balance should have decreased
    const balanceAfter = await page.locator('#balance').textContent()
    const amountAfter = parseFloat(balanceAfter!.replace('£', '').replace(',', ''))
    expect(amountAfter).toBeLessThan(amountBefore)
  })
})
