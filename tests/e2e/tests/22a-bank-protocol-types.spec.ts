import { test, expect } from '@playwright/test'
import { BANK_URL, PORTAL_URL } from '../test-urls'

test('all seven protocol types are resolved and interpreted by the Bank', async ({ page, context }) => {
  test.setTimeout(150_000)
  const portal = await context.newPage()
  await portal.goto(`${PORTAL_URL}/login`)
  await portal.fill('input[placeholder="demo"]', 'demo')
  await portal.fill('input[type="password"]', 'demo')
  await portal.click('button[type="submit"]')

  await portal.click('nav >> text=Devices')
  const enable = portal.getByRole('button', { name: 'Enable web approvals' })
  if (await enable.isVisible()) {
    await enable.click()
    await expect(portal.getByText('Browser registered', { exact: true })).toBeVisible()
  }

  await page.goto(BANK_URL)
  await expect(page.locator('#balance')).not.toHaveText('Loading...')
  await page.getByTestId('nav-settings').click()
  if (!(await page.locator('.ohpp-badge').isVisible())) {
    await page.click('#generate-challenge-btn')
    const challenge = await page.locator('#challenge-uri').inputValue()
    await portal.click('nav >> text=Connect App')
    await portal.fill('textarea', challenge)
    await portal.getByRole('button', { name: 'Connect app' }).click()
    await expect(portal.locator('.bg-green-50')).toContainText('App registered', { timeout: 15_000 })
    await expect.poll(async () => {
      await page.reload()
      return await page.locator('.ohpp-badge').isVisible()
    }, { timeout: 15_000 }).toBe(true)
  }

  const scenarios = [
    { scenario: 'TransferDecision', prompt: 'Choose how the bank should proceed with this transfer.', kind: 'select', value: 'continue' },
    { scenario: 'TransferControls', prompt: 'Select the controls that should apply to this transfer.', kind: 'multiselect', value: 'urgent, international' },
    { scenario: 'PaymentReference', prompt: 'Enter the reference the bank should attach to this payment.', kind: 'value', value: 'Bank browser reference' },
    { scenario: 'TransferAmount', prompt: 'Enter the amount the bank should use for this transfer.', kind: 'value', value: '425' },
    { scenario: 'PaymentDate', prompt: 'Choose the date on which the bank should make this payment.', kind: 'value', value: '2026-08-15' },
    { scenario: 'PaymentDateTime', prompt: 'Choose the date and time at which the bank should make this payment.', kind: 'value', value: '2026-08-16T10:30' },
    { scenario: 'HighValueAcknowledgement', prompt: 'Acknowledge that you reviewed the high-value transfer details.', kind: 'signature', value: 'acknowledged' },
  ] as const

  for (const item of scenarios) {
    await page.locator('#protocol-scenario').selectOption(item.scenario)
    await page.locator('#create-protocol-scenario').click()
    await expect(page.locator('#protocol-scenario-result')).toContainText('Awaiting human participation')

    await portal.click('nav >> text=Pending')
    const prompt = portal.getByText(item.prompt, { exact: true })
    await expect(prompt).toBeVisible({ timeout: 15_000 })
    const pendingCard = prompt.locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
    if (item.kind === 'select') {
      await pendingCard.getByRole('button', { name: 'Continue', exact: true }).click()
    } else if (item.kind === 'multiselect') {
      await pendingCard.locator('input[type="checkbox"]').nth(0).check()
      await pendingCard.locator('input[type="checkbox"]').nth(1).check()
      await pendingCard.getByRole('button', { name: 'Submit', exact: true }).click()
    } else if (item.kind === 'signature') {
      await pendingCard.getByRole('button', { name: 'I acknowledge' }).click()
    } else {
      await pendingCard.locator('input').fill(item.value)
      await pendingCard.getByRole('button', { name: 'Submit', exact: true }).click()
    }
    await expect(prompt).toBeHidden({ timeout: 10_000 })

    await expect.poll(async () => {
      await page.locator('#refresh-protocol-scenario').click()
      return await page.locator('#protocol-scenario-result').textContent()
    }, { timeout: 15_000 }).toContain('Verified bank interpretation')
    await expect(page.locator('#protocol-scenario-result')).toContainText(item.value)
  }
  await portal.close()
})
