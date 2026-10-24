import { test, expect } from '@playwright/test'
import { PortalPage } from '../pages/portal'

/**
 * Portal dashboard — converted to PortalPage (Phase 4.1). Asserts the keyed
 * stat cards and welcome block rather than visible text.
 */
test.describe('Portal — Dashboard', () => {
  test('7. dashboard shows stats after login', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.assertOnDashboard()

    // Keyed stat cards (ohpp.dashboard.stat.<slug>) + welcome block.
    await expect(portal.testid('ohpp.dashboard.stat.devices')).toBeVisible({ timeout: 10_000 })
    await expect(portal.testid('ohpp.dashboard.stat.pending-requests')).toBeVisible({ timeout: 10_000 })
    await expect(portal.testid('ohpp.dashboard.welcome')).toBeVisible({ timeout: 10_000 })
  })
})
