import { test, expect } from '@playwright/test'
import { BANK_URL, PORTAL_URL } from '../test-urls'

test.describe.serial('Bank — OHPP connection', () => {
  test('10. connect OHPP shows success', async ({ page, context }) => {
    const portal = await context.newPage()
    await portal.goto(`${PORTAL_URL}/login`)
    await portal.fill('input[placeholder="demo"]', 'demo')
    await portal.fill('input[type="password"]', 'demo')
    await portal.click('button[type="submit"]')
    await expect(portal).toHaveURL(PORTAL_URL + '/')

    await portal.click('nav >> text=Devices')
    while (await portal.getByRole('button', { name: 'Revoke' }).first().isVisible()) {
      await portal.getByRole('button', { name: 'Revoke' }).first().click()
      await portal.locator('[role="dialog"]').getByRole('button', { name: 'Revoke' }).click()
      await expect(portal.locator('[role="dialog"]')).toBeHidden()
    }
    await portal.getByRole('button', { name: 'Enable web approvals' }).click()
    await expect(portal.getByText('Browser registered', { exact: true })).toBeVisible()

    await page.goto(BANK_URL)
    await expect(page.locator('#balance')).not.toHaveText('Loading...')
    await page.getByTestId('nav-settings').click()
    await page.click('#generate-challenge-btn')
    await expect(page.locator('#challenge-uri')).toHaveValue(/ohpp:\/\/register\?challenge=/)
    const challenge = await page.locator('#challenge-uri').inputValue()

    await portal.click('nav >> text=Connect App')
    await portal.fill('textarea', challenge)
    await portal.getByRole('button', { name: 'Connect app' }).click()
    await expect(portal.locator('.bg-green-50')).toContainText('App registered', { timeout: 15000 })
    await page.reload()
    await expect(page.locator('.ohpp-badge')).toContainText('OHPP Connected')
    await portal.close()
  })

  test('11. OHPP badge visible when connected', async ({ page }) => {
    await page.goto(BANK_URL)
    await expect(page.locator('#balance')).not.toHaveText('Loading...')
    await expect(page.locator('.ohpp-badge')).toBeVisible()
    await expect(page.locator('.ohpp-badge')).toContainText('OHPP Connected')
  })

  test('12. transfer with OHPP shows pending', async ({ page }) => {
    await page.goto(BANK_URL)
    await expect(page.locator('#balance')).not.toHaveText('Loading...')
    await page.getByTestId('nav-payments').click()

    await page.selectOption('#payee-select', { index: 0 })
    await page.fill('#amount', '100.00')
    await page.click('#transfer-form button[type="submit"]')
    await page.click('#confirm-transfer')

    const result = page.locator('#transfer-result')
    await expect(result).toContainText('Waiting for approval', { timeout: 10000 })
  })

})
