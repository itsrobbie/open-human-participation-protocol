import { test, expect } from '@playwright/test'
import { PortalPage } from '../pages/portal'

/**
 * Portal developer Settings — converted to PortalPage (Phase 4.1).
 */
test.describe('Portal — Settings page (developer)', () => {
  test.beforeEach(async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.assertOnDashboard()
    await portal.gotoSettings()
  })

  test('settings page shows current token', async ({ page }) => {
    const portal = new PortalPage(page)
    const token = await portal.readSettingsToken()
    expect(token.length).toBeGreaterThan(10)
    expect(token).toContain('eyJ') // JWT prefix
  })

  test('save button shows confirmation', async ({ page }) => {
    await new PortalPage(page).saveSettingsAndConfirm()
  })

  test('resolver info section visible', async ({ page }) => {
    const portal = new PortalPage(page)
    await expect(portal.testid('ohpp.settings.resolver-info')).toBeVisible()
  })
})
