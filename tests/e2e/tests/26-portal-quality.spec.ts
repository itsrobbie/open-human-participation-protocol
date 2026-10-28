import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { PortalPage } from '../pages/portal'
import { ProtocolLabPage } from '../pages/protocol-lab'

/**
 * Portal quality evidence — converted to page objects (Phase 4.1). Navigation
 * and assertions go through PortalPage/ProtocolLabPage keyed controls. Axe's
 * analyze() is accessibility INFRA (not a UI selector) and stays as-is per the
 * framework contract.
 */
test.describe.serial('Portal quality evidence', () => {
  test.describe.configure({ timeout: 300_000 })

  test('Portal_Accessibility_AllProductionPagesHaveNoSeriousOrCriticalAxeViolations', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    const routes: { path: string; area: string }[] = [
      { path: '/', area: 'dashboard' },
      { path: '/pending', area: 'pending' },
      { path: '/history', area: 'history' },
      { path: '/devices', area: 'devices' },
      { path: '/apps', area: 'apps' },
      { path: '/register-app', area: 'registerapp' },
    ]
    for (const { path, area } of routes) {
      await portal.goto(path)
      await portal.assertHeading(area)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      const blocking = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')
      expect(blocking, `${path}: ${blocking.map(({ id }) => id).join(', ')}`).toEqual([])
    }
  })

  test('Portal_ActiveSession_RefreshesBeforeAccessTokenExpiry', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    const refreshResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/protocol/openid-connect/token') &&
        response.request().postData()?.includes('grant_type=refresh_token') === true,
    )
    await page.evaluate(() => {
      const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 30 }))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '')
      localStorage.setItem('ohpp_device_token', `header.${payload}.signature`)
    })
    await page.reload()
    expect((await refreshResponse).ok()).toBe(true)
    await portal.assertOnDashboard()
  })

  test('Portal_DeviceRegistration_DoubleActivationCreatesOneDevice', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.gotoDevices()
    await portal.revokeAllDevices()
    // Double-click Enable: still exactly one active device (idempotent).
    await portal.testid('ohpp.devices.enable-web-approvals').dblclick()
    await expect(portal.testid('ohpp.devices.registered-toast')).toBeVisible({ timeout: 10_000 })
    await portal.gotoDevices()
    expect(await portal.activeDeviceCount()).toBe(1)
  })

  test('Portal_ApiUnavailable_ShowsRetryableErrorState', async ({ page }) => {
    const portal = new PortalPage(page)
    await page.route('**/api/users/me/summary', (route) => route.abort('connectionrefused'))
    await portal.login()
    // The dashboard summary query fails -> keyed ErrorState with a retry control.
    await expect(portal.testid('ohpp.errorstate.message')).toBeVisible({ timeout: 15_000 })
    await expect(portal.testid('ohpp.errorstate.retry')).toBeVisible()
  })

  test('Portal_HistoryPagination_NextAndPreviousChangeVisibleRecords', async ({ page }) => {
    test.setTimeout(300_000)
    const portal = new PortalPage(page)
    const lab = new ProtocolLabPage(page)
    await portal.login()
    await lab.openAndRegister()

    // Create enough resolved records to paginate (>20 per page).
    let prior: string | null = await lab.currentRequestId()
    for (let i = 0; i < 21; i++) {
      await lab.selectType('Select')
      await lab.loadPreset()
      const payload = JSON.parse(await lab.payloadValue())
      payload.action.summary = `Pagination request ${i.toString().padStart(2, '0')}`
      await lab.setPayload(JSON.stringify(payload, null, 2))
      const requestId = await lab.send(prior)
      prior = requestId
      await lab.resolveViaAttester(requestId, { kind: 'select', option: 'approve' })
      await lab.assertStatusContains('resolved')
    }

    await portal.gotoNav('/history')
    const firstPage = await page.locator('main').textContent()
    await portal.clickTestId('ohpp.history.next-page')
    await expect(portal.testid('ohpp.history.page-indicator')).toContainText('Page 2 of')
    expect(await page.locator('main').textContent()).not.toBe(firstPage)
    await portal.clickTestId('ohpp.history.prev-page')
    await expect(portal.testid('ohpp.history.page-indicator')).toContainText('Page 1 of')
  })
})
