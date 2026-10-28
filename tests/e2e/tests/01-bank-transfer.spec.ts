import { expect, test } from '@playwright/test'
import { BankUiPage } from '../pages/bank-ui'

/**
 * Bank transfers without OHPP — converted to BankUiPage (Phase 4.1).
 */
test.describe.serial('Bank — Transfer without OHPP', () => {
  test('8. transfer without OHPP completes immediately', async ({ page }) => {
    const bank = new BankUiPage(page)
    await bank.gotoAndWaitLoaded()
    await bank.gotoNav('payments')
    await bank.makeTransfer({ amount: '25.00', reference: 'E2E test transfer' })
    await expect(bank.reviewText()).toContainText('E2E test transfer')
    await expect(bank.reviewText()).toContainText('£25.00')
    await bank.confirmTransfer()
    await bank.assertTransferResult('Transfer completed')
  })

  test('9. balance updates after transfer', async ({ page }) => {
    const bank = new BankUiPage(page)
    await bank.gotoAndWaitLoaded()
    await bank.gotoNav('payments')
    const before = await bank.balanceAmount()
    await bank.makeTransfer({ amount: '10.00' })
    await bank.confirmTransfer()
    await bank.assertTransferResult('Transfer completed')
    expect(await bank.balanceAmount()).toBeLessThan(before)
  })

  test('account navigation, payee management, and history filters are durable', async ({ page }) => {
    const bank = new BankUiPage(page)
    await bank.gotoAndWaitLoaded()
    await expect(bank.accountList()).toContainText('Demo Savings Account')
    await expect(bank.accountList()).toContainText('Demo Current Account')

    await bank.selectActiveAccount('demo-current')
    await expect(page.locator('#balance')).toHaveText('£1,250.00')
    await bank.selectActiveAccount('demo-account')

    await bank.gotoNav('payees')
    await bank.addPayee('Test Plumber', '11-22-33', '12345678')
    await expect(bank.payeeList()).toContainText('Test Plumber')
    await page.reload()
    await bank.gotoNav('payees')
    await expect(bank.payeeList()).toContainText('Test Plumber')

    await bank.gotoNav('transactions')
    await bank.searchTransactions('E2E test transfer')
    await expect(bank.transactionList()).toContainText('E2E test transfer')
    await expect(bank.transactionList()).not.toContainText('No transactions match')
    await bank.filterTransactionStatus('Denied')
    await expect(bank.transactionList()).toContainText('No transactions match')
  })

  test('date and datetime transfers are scheduled without changing the balance', async ({ page }) => {
    const bank = new BankUiPage(page)
    const pad = (n: number) => String(n).padStart(2, '0')
    const future = (daysAhead: number) => {
      const d = new Date()
      d.setDate(d.getDate() + daysAhead)
      return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() }
    }
    const dateRegex = ({ y, m, day }: { y: number; m: number; day: number }) =>
      new RegExp(`${m}\\/${day}\\/${y}|${day}\\/${m}\\/${y}`)
    const isoDate = (d: { y: number; m: number; day: number }) => `${d.y}-${pad(d.m)}-${pad(d.day)}`
    const d1 = future(14)
    const d2 = future(15)

    await bank.gotoAndWaitLoaded()
    const before = await bank.readBalance()

    await bank.gotoNav('payments')
    await bank.makeTransfer({ amount: '15.00', schedule: { mode: 'date', date: isoDate(d1) } })
    await expect(bank.reviewScheduleText()).toContainText(dateRegex(d1))
    await bank.confirmTransfer()
    await bank.assertTransferResult('Transfer scheduled')

    await bank.makeTransfer({ amount: '20.00', schedule: { mode: 'datetime', datetime: `${isoDate(d2)}T14:30` } })
    await expect(bank.reviewScheduleText()).toContainText(dateRegex(d2))
    await bank.confirmTransfer()
    await bank.assertTransferResult('Transfer scheduled')

    await expect(page.locator('#balance')).toHaveText(before)
    await bank.gotoNav('transactions')
    await bank.filterTransactionStatus('Scheduled')
    await expect(bank.transactionList()).toContainText('Scheduled')
    await expect(bank.transactionList()).toContainText('£15.00')
    await expect(bank.transactionList()).toContainText('£20.00')
  })
})
