import { test, expect } from '@playwright/test'
import { PortalPage } from '../pages/portal'
import { BankPage } from '../pages/bank'

/**
 * Portal Connect-App full user journey — converted to page objects (Phase 4.1).
 */
test.describe('Portal — Connect App (full user journey)', () => {
  test.beforeEach(async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.assertOnDashboard()
  })

  test('connect app page shows the form', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.gotoNav('/register-app')
    await portal.assertHeading('registerapp')
    await expect(portal.testid('ohpp.registerapp.uri')).toBeVisible()
    await expect(portal.testid('ohpp.registerapp.connect')).toBeVisible()
  })

  test('connect app button disabled without input', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.gotoNav('/register-app')
    await portal.assertConnectDisabled()
  })

  test('invalid URI shows error', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.gotoNav('/register-app')
    await portal.connectAppExpectingError('not-a-valid-uri')
  })

  test('end-to-end: generate link in bank, paste in portal, connect app', async ({ page, context }) => {
    // Generate a real challenge in the bank via its page object.
    const bankPage = await context.newPage()
    const challengeUri = await new BankPage(bankPage).generateChallengeUri()
    await bankPage.close()
    expect(challengeUri).toContain('ohpp://register?challenge=')

    // Paste in the portal and connect — resolves (success or error), never a
    // decode crash (which would surface as neither banner appearing).
    const portal = new PortalPage(page)
    await portal.connectAppExpectingResolution(challengeUri)
  })
})
