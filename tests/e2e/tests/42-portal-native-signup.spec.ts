import { test } from '@playwright/test'
import { PortalPage } from '../pages/portal'

/**
 * Portal native sign-up whole-case (production-lifecycle plan, Phase 4.1).
 *
 * On the settled account-creation model, the IdP is hidden behind the resolver
 * and sign-up happens IN the Portal (not on Keycloak's hosted page) — the Portal
 * equivalent of the app's 2.0 in-app sign-up. This drives the real UI: from the
 * login page, open "Create an account", fill the form, submit (which calls the
 * resolver's /api/auth/register broker), and land authenticated on the
 * dashboard. No raw selectors; all through the keyed PortalPage driver (P1/P3).
 */
test.describe('Portal — native sign-up (IdP hidden)', () => {
  test('a brand-new user registers in the Portal and lands authenticated', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.registerNewUser()
    await portal.assertOnDashboard()
  })
})
