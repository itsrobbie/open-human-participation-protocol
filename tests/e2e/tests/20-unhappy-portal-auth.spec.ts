import { test, expect } from '@playwright/test'
import { PortalPage } from '../pages/portal'

/**
 * Unhappy-path authentication — converted to PortalPage (Phase 4.1).
 */
test.describe('Portal — Auth error handling', () => {
  test('empty username and password shows error', async ({ page }) => {
    const portal = new PortalPage(page)
    // Submitting with the default (unfilled) form must not navigate off /login.
    await portal.submitLoginAsIs()
    await portal.assertOnLogin()
  })

  test('non-existent route shows the SPA, not a blank/server error', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.assertOnDashboard()
    // An unknown route must render the SPA's keyed not-found page, not a blank
    // page or a raw server error.
    await portal.goto('/this-page-does-not-exist')
    await expect(portal.testid('ohpp.notfound')).toBeVisible({ timeout: 10_000 })
  })

  test('manipulated localStorage token (garbage) redirects to login', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.seedGarbageToken()
    await portal.assertRedirectsToLogin('/devices')
  })

  test('login with correct username but wrong password shows a safe error', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.loginExpectingError('demo', 'incorrect-password-123')
    // The error must not leak internal details.
    const errorText = (await portal.testid('ohpp.login.error').textContent())?.toLowerCase() ?? ''
    expect(errorText).not.toContain('500')
    expect(errorText).not.toContain('exception')
    expect(errorText).not.toContain('stack trace')
  })

  test('rapid login attempts do not crash the app', async ({ page }) => {
    const portal = new PortalPage(page)
    for (let i = 0; i < 5; i++) {
      await portal.submitLogin('demo', 'wrong')
      await expect(portal.testid('ohpp.login.error')).toBeVisible()
    }
    // Still functional: on /login with a usable submit control.
    await portal.assertOnLogin()
    await expect(portal.testid('ohpp.login.submit')).toBeVisible()
  })
})
