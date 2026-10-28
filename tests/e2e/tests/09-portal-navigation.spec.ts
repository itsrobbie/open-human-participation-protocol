import { test, expect } from '@playwright/test'
import { PortalPage } from '../pages/portal'

/**
 * Portal navigation — converted to PortalPage (Phase 4.1). Nav links and page
 * headings are addressed by keyed testids, never 'nav >> text='.
 */
test.describe('Portal — Navigation', () => {
  test.beforeEach(async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.assertOnDashboard()
  })

  test('all navigation links are visible', async ({ page }) => {
    await new PortalPage(page).assertAllNavLinksVisible()
  })

  test('navigate to Pending page', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.gotoNav('/pending')
    await portal.assertHeading('pending')
  })

  test('navigate to History page', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.gotoNav('/history')
    await portal.assertHeading('history')
  })

  test('navigate to Devices page', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.gotoNav('/devices')
    await portal.assertHeading('devices')
  })

  test('navigate to Apps page', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.gotoNav('/apps')
    await portal.assertHeading('apps')
  })

  test('navigate to Connect App page', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.gotoNav('/register-app')
    await portal.assertHeading('registerapp')
  })

  test('navigate to Settings page via direct URL', async ({ page }) => {
    await new PortalPage(page).gotoSettings()
  })

  test('sign out button visible in nav', async ({ page }) => {
    const portal = new PortalPage(page)
    await expect(portal.testid('ohpp.nav.logout')).toBeVisible()
  })
})
