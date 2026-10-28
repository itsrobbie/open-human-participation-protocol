import { test } from '@playwright/test'
import { PortalPage } from '../pages/portal'

/**
 * Every portal page loads without an error state on a fresh account (Phase 4.1,
 * converted to PortalPage). After global setup wipes the DB, the portal must
 * handle the clean slate gracefully — keyed heading present, no ErrorState.
 */
test.describe('Portal — Page load (no errors)', () => {
  test.beforeEach(async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.assertOnDashboard()
  })

  test('dashboard loads without error', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.assertHeading('dashboard')
    await portal.assertNoErrorState()
  })

  test('devices page loads without error', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.gotoNav('/devices')
    await portal.assertHeading('devices')
    await portal.assertNoErrorState()
  })

  test('apps page loads without error', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.gotoNav('/apps')
    await portal.assertHeading('apps')
    await portal.assertNoErrorState()
  })

  test('history page loads without error', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.gotoNav('/history')
    await portal.assertHeading('history')
    await portal.assertNoErrorState()
  })

  test('pending page loads without error', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.gotoNav('/pending')
    await portal.assertHeading('pending')
    await portal.assertNoErrorState()
  })
})
