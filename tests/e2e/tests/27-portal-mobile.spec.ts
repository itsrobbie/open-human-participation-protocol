import { expect, test } from '@playwright/test'
import { PortalPage } from '../pages/portal'

/**
 * Portal mobile navigation at 375px — converted to PortalPage (Phase 4.1).
 * Every page reachable via the keyed mobile menu, keyed heading present, and no
 * horizontal overflow.
 */
test('Portal_MobileNavigation_375ViewportHasNoHorizontalOverflowAndAllPagesAreReachable', async ({ page }) => {
  const portal = new PortalPage(page)
  await portal.login()
  await portal.assertOnDashboard()

  const pages: { to: string; area: string }[] = [
    { to: '/pending', area: 'pending' },
    { to: '/history', area: 'history' },
    { to: '/devices', area: 'devices' },
    { to: '/apps', area: 'apps' },
    { to: '/register-app', area: 'registerapp' },
  ]

  for (const { to, area } of pages) {
    await portal.gotoNavMobile(to)
    await portal.assertHeading(area)
    expect(await portal.hasHorizontalOverflow(), `${to} has horizontal overflow at 375px`).toBe(false)
  }
})
