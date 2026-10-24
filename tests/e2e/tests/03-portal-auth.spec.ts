import { test } from '@playwright/test'
import { PortalPage } from '../pages/portal'

/**
 * Portal authentication — converted to the PortalPage page object (Phase 4.1).
 * No raw selectors: every action/assertion goes through keyed page-object
 * methods (P1/P3).
 */
test.describe('Portal — Authentication', () => {
  test('1. login with valid credentials', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.assertOnDashboard()
  })

  test('2. login with invalid credentials shows error', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.loginExpectingError('demo', 'wrongpassword')
  })

  test('3. logout redirects to login', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.assertOnDashboard()
    await portal.logout()
  })

  test('4. protected routes redirect to login when unauthenticated', async ({ page }) => {
    const portal = new PortalPage(page)
    // Clear any stored token, then a protected route must bounce to /login.
    await portal.goto('/')
    await portal.clearDeviceToken()
    await portal.assertRedirectsToLogin('/devices')
  })
})
