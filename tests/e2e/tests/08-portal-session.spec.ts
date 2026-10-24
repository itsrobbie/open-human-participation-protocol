import { test, expect } from '@playwright/test'
import { PortalPage } from '../pages/portal'

/**
 * Portal session management — converted to PortalPage (Phase 4.1).
 */
test.describe('Portal — Session management', () => {
  test('expired token redirects to login', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.seedExpiredToken()
    // A protected page with an expired token must bounce to /login after the 401.
    await portal.assertRedirectsToLogin('/')
  })

  test('clearing token manually redirects to login on next navigation', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.assertOnDashboard()
    await portal.clearDeviceToken()
    await portal.assertRedirectsToLogin('/devices')
  })

  test('login persists across page reload', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.assertOnDashboard()

    await page.reload()

    // Still authenticated: dashboard heading + keyed logout control present.
    await portal.assertOnDashboard()
    await expect(portal.testid('ohpp.nav.logout')).toBeVisible()
  })
})
