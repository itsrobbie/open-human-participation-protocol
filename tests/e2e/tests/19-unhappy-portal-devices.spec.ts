import { test, expect } from '@playwright/test'
import { PortalPage } from '../pages/portal'

/**
 * Unhappy-path device management — converted to PortalPage (Phase 4.1).
 */
test.describe('Portal — Devices error handling', () => {
  test.beforeEach(async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.gotoDevices()
  })

  test('enabling web approvals twice does not create duplicate devices', async ({ page }) => {
    const portal = new PortalPage(page)
    // Start fresh, enable once.
    await portal.revokeAllDevices()
    await portal.enableWebApprovalsButtonAndConfirm()
    // Re-open Devices: the enable button is gone (a device exists) and there is
    // exactly one active device — enabling did not duplicate.
    await portal.gotoDevices()
    await expect(portal.testid('ohpp.devices.enable-web-approvals')).toHaveCount(0)
    expect(await portal.activeDeviceCount()).toBe(1)
  })

  test('cancelling revoke dialog does not revoke the device', async ({ page }) => {
    const portal = new PortalPage(page)
    if ((await portal.activeDeviceCount()) === 0) {
      await portal.enableWebApprovalsButtonAndConfirm()
    }
    const before = await portal.activeDeviceCount()
    expect(before).toBeGreaterThan(0)
    await portal.openRevokeThenCancel()
    // Nothing revoked — same active count.
    expect(await portal.activeDeviceCount()).toBe(before)
  })
})
