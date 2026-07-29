import { test, expect } from '@playwright/test'
import { PORTAL_URL } from '../test-urls'

test.describe('Portal — Settings page (developer)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')
    // Settings is not in nav — access directly
    await page.goto(`${PORTAL_URL}/settings`)
  })

  test('settings page shows current token', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Developer Settings')
    await expect(page.locator('textarea')).toBeVisible()

    // Token textarea should contain the current JWT
    const tokenValue = await page.locator('textarea').inputValue()
    expect(tokenValue.length).toBeGreaterThan(10)
    expect(tokenValue).toContain('eyJ') // JWT prefix
  })

  test('save button shows confirmation', async ({ page }) => {
    await page.click('button:has-text("Save")')
    await expect(page.locator('text=Saved')).toBeVisible()
  })

  test('resolver info section visible', async ({ page }) => {
    await expect(page.locator('text=Resolver Info')).toBeVisible()
  })
})
