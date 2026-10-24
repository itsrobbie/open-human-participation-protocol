import { test, expect } from '@playwright/test'
import { PortalPage } from '../pages/portal'

/**
 * Portal web-approvals full ceremony — converted to PortalPage (Phase 4.1).
 * This IS the PortalAttester precondition: revoke every device, register a
 * fresh keyless browser device, then Pending must be enabled (no disabled
 * notice). enableWebApprovals() encapsulates exactly that ceremony.
 */
test.describe('Portal — Web Approvals (full ceremony)', () => {
  test('14. web approvals enabled when no devices with keys', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.enableWebApprovals()
    // enableWebApprovals already asserts the Pending page carries no
    // "Web approvals disabled" notice; re-affirm the keyed heading is present.
    await portal.assertHeading('pending')
    await expect(portal.testid('ohpp.pending.disabled-notice')).toHaveCount(0)
  })
})
