import { test } from '@playwright/test'
import { PortalPage } from '../pages/portal'

/**
 * Portal history — converted to PortalPage (Phase 4.1).
 */
test.describe('Portal — History', () => {
  test('13. history page loads without error', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.assertOnDashboard()
    await portal.gotoNav('/history')
    await portal.assertHeading('history')
    await portal.assertNoErrorState()
  })
})
