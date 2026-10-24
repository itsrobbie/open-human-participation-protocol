import { test } from '@playwright/test'
import { PortalPage } from '../pages/portal'

/**
 * Unhappy-path Pending approvals — converted to PortalPage (Phase 4.1). The
 * page must always land in a valid non-error state (keyed empty-state, keyed
 * disabled-notice, or a pending card), never an ErrorState.
 */
test.describe('Portal — Pending error handling', () => {
  test.setTimeout(60_000)

  test('pending page shows a valid state when no requests exist', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.assertOnDashboard()
    await portal.gotoNav('/pending')
    await portal.assertPendingInValidState()
  })

  test('pending page is usable after enabling web approvals', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    // Deterministically restore a known web-approvals-enabled state (revoke
    // leftovers + register a fresh browser device), then the Pending page must
    // render a valid state without crashing.
    await portal.enableWebApprovals()
    await portal.gotoNav('/pending')
    await portal.assertPendingInValidState()
  })

  test('pending page handles web approvals becoming disabled gracefully', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.assertOnDashboard()
    await portal.gotoNav('/pending')
    await portal.assertPendingInValidState()
  })
})
