import { execSync } from 'child_process'
import { resolve } from 'path'
import { test, expect } from '@playwright/test'
import { BANK_URL, INSURANCE_URL } from '../test-urls'

const composeFile = resolve(__dirname, '../../../docker-compose.test.yml')
const composeCommand = `docker compose -p ohpp-test -f ${composeFile}`

test('Bank and Insurance state survive application restarts', async ({ browser }) => {
  test.setTimeout(240_000)
  const bankContext = await browser.newContext({ storageState: resolve(__dirname, '../.auth-state.json') })
  const bank = await bankContext.newPage()
  await bank.goto(BANK_URL)
  await expect(bank.locator('#balance')).not.toHaveText('Loading...')
  await bank.getByTestId('nav-payees').click()
  await bank.getByText('Add a payee', { exact: true }).click()
  await bank.fill('#payee-name', 'Restart Test Payee')
  await bank.fill('#payee-sort-code', '22-33-44')
  await bank.fill('#payee-account-number', '87654321')
  await bank.click('#add-payee-form button[type="submit"]')
  await expect(bank.locator('#payee-list')).toContainText('Restart Test Payee')

  const insuranceContext = await browser.newContext()
  const insurance = await insuranceContext.newPage()
  await insurance.goto(INSURANCE_URL)
  await insurance.fill('#username', 'demo')
  await insurance.fill('#password', 'demo')
  await insurance.click('#login-form button[type="submit"]')
  await expect(insurance.locator('#app')).toBeVisible()
  await insurance.click('[data-testid="nav-new-claim"]')
  await insurance.fill('#date', '2026-07-30')
  await insurance.fill('#description', 'Restart persistence claim')
  await insurance.fill('#amount', '750')
  await insurance.click('#claim-form button[type="submit"]')
  await insurance.click('[data-testid="nav-claim-history"]')
  await expect(insurance.locator('#claims')).toContainText('Restart persistence claim')

  execSync(`${composeCommand} restart bank insurance-claims`, {
    cwd: __dirname,
    stdio: 'pipe',
    timeout: 60_000,
  })

  await expect.poll(async () => {
    try {
      await bank.goto(BANK_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
      if (await bank.locator('#login-card').isVisible()) {
        await bank.fill('#login-username', 'demo')
        await bank.fill('#login-password', 'demo')
        await bank.click('#login-form button[type="submit"]')
      }
      await bank.getByTestId('nav-payees').click()
      return (await bank.locator('#payee-list').textContent())?.includes('Restart Test Payee') ?? false
    } catch {
      return false
    }
  }, { timeout: 90_000, intervals: [1_000, 2_000, 5_000] }).toBe(true)

  await expect.poll(async () => {
    try {
      await insurance.goto(INSURANCE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
      if (await insurance.locator('#login').isVisible()) {
        await insurance.fill('#username', 'demo')
        await insurance.fill('#password', 'demo')
        await insurance.click('#login-form button[type="submit"]')
      }
      await insurance.click('[data-testid="nav-claim-history"]')
      await insurance.locator('#claims').waitFor({ state: 'attached', timeout: 5_000 })
      return (await insurance.locator('#claims').textContent())?.includes('Restart persistence claim') ?? false
    } catch {
      return false
    }
  }, { timeout: 90_000, intervals: [1_000, 2_000, 5_000] }).toBe(true)

  await bankContext.close()
  await insuranceContext.close()
})
