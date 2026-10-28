import { test, expect } from '@playwright/test'
import { PortalPage } from '../pages/portal'

/**
 * Portal device management — converted to PortalPage (Phase 4.1). Device
 * enable/revoke go through keyed controls (ohpp.devices.*, ohpp.confirm.*),
 * never button text or role dialogs.
 */
test.describe('Portal — Device management', () => {
  test.beforeEach(async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.gotoDevices()
  })

  test('5. enable web approvals registers a browser device', async ({ page }) => {
    const portal = new PortalPage(page)
    // Known-good: start from zero active devices, then enabling registers one.
    await portal.revokeAllDevices()
    await portal.enableWebApprovalsButtonAndConfirm()
    expect(await portal.activeDeviceCount()).toBeGreaterThan(0)
  })

  test('6. revoke device removes it from the active set', async ({ page }) => {
    const portal = new PortalPage(page)
    // Ensure an active device exists.
    if ((await portal.activeDeviceCount()) === 0) {
      await portal.enableWebApprovalsButtonAndConfirm()
    }
    const before = await portal.activeDeviceCount()
    expect(before).toBeGreaterThan(0)
    await portal.revokeAllDevices()
    expect(await portal.activeDeviceCount()).toBe(0)
  })
})
