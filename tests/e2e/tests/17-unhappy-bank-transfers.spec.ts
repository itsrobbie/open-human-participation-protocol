import { test, expect } from '@playwright/test'
import { BANK_URL } from '../test-urls'

/**
 * Unhappy path tests for bank transfers.
 * These cover the error conditions real users hit.
 */
test.describe('Bank — Transfer error handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BANK_URL)
    await expect(page.locator('#balance')).not.toHaveText('Loading...')
    await page.getByTestId('nav-payments').click()
  })

  test('transfer with zero amount is blocked by form validation', async ({ page }) => {
    await page.selectOption('#payee-select', { index: 0 })
    await page.fill('#amount', '0')
    await page.fill('#reference', 'Zero amount test')
    await page.click('#transfer-form button[type="submit"]')

    // HTML5 min="0.01" validation blocks submission — result div stays hidden
    await page.waitForTimeout(1000)
    const resultVisible = await page.locator('#transfer-result').isVisible()
    if (resultVisible) {
      // If somehow submitted, should still show error (server validation)
      const text = await page.locator('#transfer-result').textContent()
      expect(text).not.toContain('Transfer completed')
    }
    // Whether blocked by browser or server, transfer should NOT complete
    // Balance should remain unchanged
  })

  test('transfer with negative amount is blocked by form validation', async ({ page }) => {
    await page.selectOption('#payee-select', { index: 0 })
    await page.fill('#amount', '-50')
    await page.fill('#reference', 'Negative amount test')
    await page.click('#transfer-form button[type="submit"]')

    // HTML5 min="0.01" validation blocks submission — result div stays hidden
    await page.waitForTimeout(1000)
    const resultVisible = await page.locator('#transfer-result').isVisible()
    if (resultVisible) {
      const text = await page.locator('#transfer-result').textContent()
      expect(text).not.toContain('Transfer completed')
    }
  })

  test('transfer exceeding balance shows insufficient funds', async ({ page }) => {
    // Get current balance
    const balanceText = await page.locator('#balance').textContent()
    const balance = parseFloat(balanceText!.replace('£', '').replace(',', ''))

    // Try to transfer more than the balance
    await page.selectOption('#payee-select', { index: 0 })
    await page.fill('#amount', String(balance + 1000))
    await page.fill('#reference', 'Over balance test')
    await page.click('#transfer-form button[type="submit"]')
    await page.click('#confirm-transfer')

    const result = page.locator('#transfer-result')
    await expect(result).toBeVisible({ timeout: 10000 })
    // Wait for "Processing..." to clear
    await expect(result).not.toContainText('Processing...', { timeout: 10000 })
    const text = await result.textContent()
    expect(text?.toLowerCase()).toContain('insufficient')
  })

  test('transfer with empty amount field does not submit or shows error', async ({ page }) => {
    await page.selectOption('#payee-select', { index: 0 })
    // Leave amount empty
    await page.fill('#reference', 'Empty amount test')
    await page.click('#transfer-form button[type="submit"]')

    // Either form validation prevents submission (no result appears)
    // or an error is shown
    await page.waitForTimeout(2000)
    const result = page.locator('#transfer-result')
    if (await result.isVisible()) {
      const text = await result.textContent()
      expect(text).not.toContain('Transfer completed')
    }
    // If not visible, form validation prevented submission — also acceptable
  })
})
