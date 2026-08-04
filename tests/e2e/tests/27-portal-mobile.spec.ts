import { expect, test } from '@playwright/test'
import { PORTAL_URL } from '../test-urls'

test('Portal_MobileNavigation_375ViewportHasNoHorizontalOverflowAndAllPagesAreReachable', async ({ page }) => {
  await page.goto(`${PORTAL_URL}/login`)
  await page.fill('input[placeholder="demo"]', 'demo')
  await page.fill('input[type="password"]', 'demo')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(PORTAL_URL + '/')

  for (const pageName of ['Pending', 'History', 'Devices', 'Apps', 'Connect App']) {
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('navigation').getByRole('link', { name: pageName, exact: true }).click()
    await expect(page.locator('h1')).toBeVisible()
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasOverflow, `${pageName} has horizontal overflow at 375px`).toBe(false)
  }
})
