import { test, expect } from '@playwright/test'
import { PortalPage } from '../pages/portal'
import { BankPage } from '../pages/bank'

/**
 * Unhappy-path Connect-App — converted to PortalPage (Phase 4.1). The connect
 * outcome banners are keyed (ohpp.registerapp.success/error); no .bg-red-50.
 */
test.describe('Portal — Connect App error handling', () => {
  test.beforeEach(async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.login()
    await portal.assertOnDashboard()
    await portal.gotoNav('/register-app')
    await portal.assertHeading('registerapp')
  })

  test('pasting random text shows error', async ({ page }) => {
    const portal = new PortalPage(page)
    const text = (await portal.connectAppExpectingError('hello world this is not a link')).toLowerCase()
    expect(text).toMatch(/failed|error|invalid/)
  })

  test('pasting an ohpp:// URI with corrupted base64 shows error', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.connectAppExpectingError('ohpp://register?challenge=!!!not-valid-base64!!!')
  })

  test('pasting a valid-looking but expired challenge shows error', async ({ page }) => {
    const portal = new PortalPage(page)
    const expiredPayload = Buffer.from(
      JSON.stringify({ appId: 'test.app', id: 'expired-123', exp: 1000000000 }),
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
    await portal.connectAppExpectingError(`ohpp://register?challenge=${expiredPayload}`)
  })

  test('submitting the same challenge twice shows error on the second attempt', async ({ page, context }) => {
    const portal = new PortalPage(page)

    // Generate a real challenge from the bank (its own page object).
    const bankPage = await context.newPage()
    const challengeUri = await new BankPage(bankPage).generateChallengeUri()
    await bankPage.close()

    // First submission resolves (success or error — either is a valid outcome).
    await portal.connectAppExpectingResolution(challengeUri)

    // Second submission with the SAME challenge must show the keyed error.
    await portal.gotoNav('/') // reset the form via navigation
    await portal.gotoNav('/register-app')
    await portal.connectAppExpectingError(challengeUri)
  })

  test('whitespace-only input keeps the connect button disabled', async ({ page }) => {
    const portal = new PortalPage(page)
    await portal.testid('ohpp.registerapp.uri').fill('   \n\n   ')
    await portal.assertConnectDisabled()
  })
})
