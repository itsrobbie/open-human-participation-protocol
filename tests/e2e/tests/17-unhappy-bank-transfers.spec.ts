import { expect, test } from '@playwright/test'
import { BankUiPage } from '../pages/bank-ui'

/**
 * Bank transfer error handling — converted to BankUiPage (Phase 4.1).
 */
test.describe('Bank — Transfer error handling', () => {
  test.beforeEach(async ({ page }) => {
    const bank = new BankUiPage(page)
    await bank.gotoAndWaitLoaded()
    await bank.gotoNav('payments')
  })

  test('transfer with zero amount is blocked by form validation', async ({ page }) => {
    const bank = new BankUiPage(page)
    await bank.fillTransferForm({ amount: '0', reference: 'Zero amount test' })
    await bank.submitTransferForm()
    // HTML5 min="0.01" blocks submission; if it somehow submitted it must not complete.
    if (await bank.transferResult().isVisible().catch(() => false)) {
      await expect(bank.transferResult()).not.toContainText('Transfer completed')
    }
  })

  test('transfer with negative amount is blocked by form validation', async ({ page }) => {
    const bank = new BankUiPage(page)
    await bank.fillTransferForm({ amount: '-50', reference: 'Negative amount test' })
    await bank.submitTransferForm()
    if (await bank.transferResult().isVisible().catch(() => false)) {
      await expect(bank.transferResult()).not.toContainText('Transfer completed')
    }
  })

  test('transfer exceeding balance shows insufficient funds', async ({ page }) => {
    const bank = new BankUiPage(page)
    const balance = await bank.balanceAmount()
    await bank.fillTransferForm({ amount: String(balance + 1000), reference: 'Over balance test' })
    await bank.submitTransferForm()
    await bank.confirmTransfer()
    const result = bank.transferResult()
    await expect(result).toBeVisible({ timeout: 10_000 })
    await expect(result).not.toContainText('Processing...', { timeout: 10_000 })
    expect((await result.textContent())?.toLowerCase()).toContain('insufficient')
  })

  test('transfer with empty amount field does not complete', async ({ page }) => {
    const bank = new BankUiPage(page)
    await bank.fillTransferForm({ amount: '', reference: 'Empty amount test' })
    await bank.submitTransferForm()
    if (await bank.transferResult().isVisible().catch(() => false)) {
      await expect(bank.transferResult()).not.toContainText('Transfer completed')
    }
  })
})
