import { test, expect } from '@playwright/test'
import { PORTAL_URL } from '../test-urls'

test.describe('Portal — Web Approvals (full ceremony)', () => {
  test('14. web approvals enabled when no devices with keys', async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')

    await page.click('nav >> text=Devices')
    while (await page.getByRole('button', { name: 'Revoke' }).first().isVisible()) {
      await page.getByRole('button', { name: 'Revoke' }).first().click()
      await page.locator('[role="dialog"]').getByRole('button', { name: 'Revoke' }).click()
      await expect(page.locator('[role="dialog"]')).toBeHidden()
      await page.waitForTimeout(300)
    }
    const enable = page.getByRole('button', { name: 'Enable web approvals' })
    await expect(enable).toBeVisible()
    await enable.click()
    await expect(page.getByText('Browser registered', { exact: true })).toBeVisible()

    await page.click('nav >> text=Pending')
    await expect(page.getByRole('heading', { name: 'Pending Requests' })).toBeVisible()
    await expect(page.getByText('Web approvals disabled')).toHaveCount(0)
  })
})
