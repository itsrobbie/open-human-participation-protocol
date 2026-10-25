import { expect, type Page } from '@playwright/test'
import { BasePage } from './base'
import { PORTAL_URL } from '../test-urls'

/**
 * PortalPage: the portal account-setup driver (P3). Login, enable web approvals
 * (register a keyless browser device), connect a requester app by challenge URI.
 * Uses the ohpp.* testids added in Phase 1.1 — no sleeps, no text/CSS selectors.
 */
export class PortalPage extends BasePage {
  constructor(page: Page) {
    super(page, PORTAL_URL)
  }

  async login(username = 'demo', password = 'demo'): Promise<void> {
    await this.goto('/login')
    await this.fillTestId('ohpp.login.username', username)
    await this.fillTestId('ohpp.login.password', password)
    await this.clickTestId('ohpp.login.submit')
    // Landing on the dashboard means auth succeeded.
    await this.page.waitForURL(`${PORTAL_URL}/`, { timeout: 15_000 })
  }

  /**
   * Native Portal sign-up (Phase 4.1): from the login page, open the register
   * form, create a brand-new account through the resolver broker (IdP hidden),
   * and land authenticated on the dashboard. Returns the username created.
   */
  async registerNewUser(): Promise<string> {
    const unique = Date.now()
    const username = `e2e_portal_${unique}`
    await this.goto('/login')
    await this.clickTestId('ohpp.login.create-account')
    await this.page.waitForURL(`${PORTAL_URL}/register`, { timeout: 15_000 })
    await this.fillTestId('ohpp.register.username', username)
    await this.fillTestId('ohpp.register.email', `${username}@example.com`)
    await this.fillTestId('ohpp.register.password', `Pw-${unique}!`)
    await this.clickTestId('ohpp.register.submit')
    // Auto-signed-in on success -> dashboard.
    await this.page.waitForURL(`${PORTAL_URL}/`, { timeout: 20_000 })
    return username
  }

  /**
   * GUARANTEE web approvals are enabled for the web attester.
   *
   * The resolver disables web approvals whenever an ACTIVE KEYED device exists
   * (HasActiveDeviceWithKeyAsync) — the /resolve POST then 403s and the
   * requester stays stuck "Waiting for approval". The suite resets the DB only
   * once at global-setup, so by the time this runs, earlier specs (e.g. device
   * or CLI specs) can have left an active keyed device behind. The old
   * "a device card exists -> approvals live" shortcut was WRONG for exactly
   * that case: a leftover keyed card looks identical to a browser card but
   * disables approvals.
   *
   * So we restore a known-good state deterministically: revoke every active
   * device (leftovers this web-attester scenario does not own), then register a
   * fresh keyless browser device via the enable button (which the portal shows
   * only at zero active devices), then VERIFY on the Pending page that approvals
   * are actually enabled (no "Web approvals disabled" notice).
   */
  async enableWebApprovals(): Promise<void> {
    await this.goto('/devices')
    const enable = this.testid('ohpp.devices.enable-web-approvals')
    const anyCard = this.page.locator('[data-testid^="ohpp.devices.card."]')

    // Wait for the async device list to settle on one of the two terminal
    // states (a card, or the zero-devices enable button) — never an instant
    // post-goto snapshot.
    await Promise.race([
      anyCard.first().waitFor({ state: 'visible', timeout: 15_000 }),
      enable.waitFor({ state: 'visible', timeout: 15_000 }),
    ])

    // Revoke EVERY active device so no keyed leftover blocks web approvals.
    // Revoke buttons are keyed ohpp.devices.revoke.<id>; each opens a confirm
    // dialog (ohpp.confirm.confirm). A revoked device's button becomes DISABLED
    // and STAYS attached (the card moves to the "Revoked" section but keeps its
    // testid) — this is especially true for CLI/keyed devices left by spec 28 —
    // so waiting for the button to DETACH times out. Instead target only ENABLED
    // revoke buttons and, after confirming, wait for the clicked button to go
    // disabled (revocation accepted). Loop until no enabled revoke remains.
    for (;;) {
      const revoke = this.page
        .locator('[data-testid^="ohpp.devices.revoke."]:not([disabled])')
        .first()
      if (!(await revoke.isVisible().catch(() => false))) break
      await revoke.click()
      await this.clickTestId('ohpp.confirm.confirm')
      await expect(revoke).toBeDisabled({ timeout: 15_000 }).catch(() => {})
    }

    // Now at zero ACTIVE devices -> the enable button renders. Register a fresh
    // keyless browser device.
    await enable.waitFor({ state: 'visible', timeout: 15_000 })
    await enable.click()
    await anyCard.first().waitFor({ state: 'visible', timeout: 15_000 })

    // VERIFY approvals are truly enabled: the Pending page shows a "Web approvals
    // disabled" notice when the resolver still considers them off. Its absence
    // (and the pending surface being interactive) is the real precondition the
    // web attester depends on.
    await this.goto('/pending')
    await this.page.waitForLoadState('networkidle')
    const disabledNotice = this.page.getByText('Web approvals disabled', { exact: false })
    if (await disabledNotice.isVisible().catch(() => false)) {
      throw new Error(
        'web approvals are still DISABLED after registering a browser device — ' +
          'an active keyed device is blocking them (resolver HasActiveDeviceWithKey). ' +
          'The revoke-all step did not clear it.',
      )
    }
  }

  /** Connect a requester app by pasting its ohpp:// challenge URI. */
  async connectApp(challengeUri: string): Promise<void> {
    await this.goto('/register-app')
    await this.fillTestId('ohpp.registerapp.uri', challengeUri)
    await this.clickTestId('ohpp.registerapp.connect')
  }

  // --- Phase 4.1 conversion helpers (03/03a/04/08) ---

  /** Fill the login form and submit without asserting the outcome. */
  async submitLogin(username = 'demo', password = 'demo'): Promise<void> {
    await this.goto('/login')
    await this.fillTestId('ohpp.login.username', username)
    await this.fillTestId('ohpp.login.password', password)
    await this.clickTestId('ohpp.login.submit')
  }

  /** Attempt login expecting it to FAIL: the keyed error shows and we stay on /login. */
  async loginExpectingError(username = 'demo', password = 'wrongpassword'): Promise<void> {
    await this.submitLogin(username, password)
    await expect(this.testid('ohpp.login.error')).toBeVisible()
    await expect(this.page).toHaveURL(`${PORTAL_URL}/login`)
  }

  /** Log out via the keyed nav control; lands back on /login. */
  async logout(): Promise<void> {
    await this.clickTestId('ohpp.nav.logout')
    await expect(this.page).toHaveURL(`${PORTAL_URL}/login`)
  }

  /** Navigate via a keyed nav link, e.g. gotoNav('/devices'). */
  async gotoNav(to: string): Promise<void> {
    await this.clickTestId(`ohpp.nav.link.${to}`)
  }

  /** Assert the dashboard rendered (keyed heading), i.e. we are logged in on /. */
  async assertOnDashboard(): Promise<void> {
    await expect(this.page).toHaveURL(`${PORTAL_URL}/`)
    await expect(this.testid('ohpp.dashboard.heading')).toBeVisible({ timeout: 10_000 })
  }

  /** Assert a keyed page heading is visible, e.g. assertHeading('devices'). */
  async assertHeading(area: string): Promise<void> {
    await expect(this.testid(`ohpp.${area}.heading`)).toBeVisible({ timeout: 10_000 })
  }

  /** Assert the ErrorState "Failed to load" banner is NOT shown on the current page. */
  async assertNoErrorState(): Promise<void> {
    await expect(this.testid('ohpp.errorstate.message')).toHaveCount(0)
  }

  /** Assert navigating to a protected path redirects to /login. */
  async assertRedirectsToLogin(path: string): Promise<void> {
    await this.goto(path)
    await expect(this.page).toHaveURL(`${PORTAL_URL}/login`, { timeout: 10_000 })
  }

  /** Clear the stored device token (simulate expiry/logout at the storage layer). */
  async clearDeviceToken(): Promise<void> {
    await this.page.evaluate(() => localStorage.removeItem('ohpp_device_token'))
  }

  /** Seed a deliberately-expired JWT so the next protected call 401s. */
  async seedExpiredToken(): Promise<void> {
    await this.goto('/login')
    await this.page.evaluate(() => {
      localStorage.setItem(
        'ohpp_device_token',
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjEwMDAwMDAwMDAsInN1YiI6InRlc3QifQ.fake',
      )
    })
  }

  // --- Phase 4.1 batch-2a (06/09/13) ---

  /** Assert every primary nav link + the logout control is visible (keyed). */
  async assertAllNavLinksVisible(): Promise<void> {
    for (const to of ['/pending', '/history', '/devices', '/apps', '/register-app']) {
      await expect(this.testid(`ohpp.nav.link.${to}`)).toBeVisible()
    }
    await expect(this.testid('ohpp.nav.home')).toBeVisible()
    await expect(this.testid('ohpp.nav.logout')).toBeVisible()
  }

  /** Open the Developer Settings page (not in nav — direct route). */
  async gotoSettings(): Promise<void> {
    await this.goto('/settings')
    await expect(this.testid('ohpp.settings.heading')).toBeVisible({ timeout: 10_000 })
  }

  /** Read the developer token textarea value. */
  async readSettingsToken(): Promise<string> {
    return (await this.testid('ohpp.settings.token').inputValue()).trim()
  }

  /** Click Save on Settings and assert the keyed confirmation shows. */
  async saveSettingsAndConfirm(): Promise<void> {
    await this.clickTestId('ohpp.settings.save')
    await expect(this.testid('ohpp.settings.saved')).toBeVisible()
  }

  // --- Phase 4.1 batch-2b (20/21 unhappy portal) ---

  /** Submit the login form as-is (no fill), for empty/validation cases. */
  async submitLoginAsIs(): Promise<void> {
    await this.goto('/login')
    await this.clickTestId('ohpp.login.submit')
  }

  /** Seed an arbitrary garbage device token (invalid, not a JWT). */
  async seedGarbageToken(): Promise<void> {
    await this.goto('/login')
    await this.page.evaluate(() => localStorage.setItem('ohpp_device_token', 'not-a-jwt-at-all'))
  }

  /** Assert we are on the login page (unauthenticated / bounced). */
  async assertOnLogin(): Promise<void> {
    await expect(this.page).toHaveURL(`${PORTAL_URL}/login`, { timeout: 10_000 })
  }

  /**
   * Assert the Pending page is in one of its valid non-error states: a keyed
   * empty-state, the keyed web-approvals-disabled notice, or at least one
   * pending card. Never an ErrorState.
   */
  async assertPendingInValidState(): Promise<void> {
    const empty = this.testid('ohpp.pending.empty')
    const disabled = this.testid('ohpp.pending.disabled-notice')
    const anyCard = this.page.locator('[data-testid^="ohpp.pending.card."]')
    await expect(empty.or(disabled).or(anyCard).first()).toBeVisible({ timeout: 10_000 })
    await this.assertNoErrorState()
  }

  // --- Phase 4.1 batch-2c (05/07/19 device flows) ---

  /** Open the Devices page (keyed heading present). */
  async gotoDevices(): Promise<void> {
    await this.goto('/devices')
    await expect(this.testid('ohpp.devices.heading')).toBeVisible({ timeout: 10_000 })
  }

  private activeRevokeButtons() {
    return this.page.locator('[data-testid^="ohpp.devices.revoke."]:not([disabled])')
  }

  /** Count ACTIVE device cards (via enabled revoke buttons). */
  async activeDeviceCount(): Promise<number> {
    return this.activeRevokeButtons().count()
  }

  /** Revoke every active device (confirm each), leaving zero active. */
  async revokeAllDevices(): Promise<void> {
    for (;;) {
      const revoke = this.activeRevokeButtons().first()
      if (!(await revoke.isVisible().catch(() => false))) break
      await revoke.click()
      await this.clickTestId('ohpp.confirm.confirm')
      await expect(revoke).toBeDisabled({ timeout: 15_000 }).catch(() => {})
    }
  }

  /** Click Enable web approvals (must be at zero active devices) and confirm the toast. */
  async enableWebApprovalsButtonAndConfirm(): Promise<void> {
    await this.clickTestId('ohpp.devices.enable-web-approvals')
    await expect(this.testid('ohpp.devices.registered-toast')).toBeVisible({ timeout: 10_000 })
    // The device LIST refetches (react-query) after registration, so the new
    // active revoke button lags the toast. Wait for it, else an immediate
    // activeDeviceCount() races and reads 0.
    await expect(this.activeRevokeButtons().first()).toBeVisible({ timeout: 15_000 })
  }

  /** Open a device revoke confirm dialog then CANCEL it (device stays active). */
  async openRevokeThenCancel(): Promise<void> {
    await this.activeRevokeButtons().first().click()
    await this.clickTestId('ohpp.confirm.cancel')
  }

  /** On the Connect-App page, paste a URI, submit, and expect the keyed error banner. */
  async connectAppExpectingError(uri: string): Promise<string> {
    await this.goto('/register-app')
    await this.fillTestId('ohpp.registerapp.uri', uri)
    await this.clickTestId('ohpp.registerapp.connect')
    const err = this.testid('ohpp.registerapp.error')
    await expect(err).toBeVisible({ timeout: 15_000 })
    return (await err.textContent()) ?? ''
  }

  /** On the Connect-App page, paste a URI, submit, and expect either banner (success OR error). */
  async connectAppExpectingResolution(uri: string): Promise<void> {
    await this.goto('/register-app')
    await this.fillTestId('ohpp.registerapp.uri', uri)
    await this.clickTestId('ohpp.registerapp.connect')
    await expect(
      this.testid('ohpp.registerapp.success').or(this.testid('ohpp.registerapp.error')).first(),
    ).toBeVisible({ timeout: 15_000 })
  }

  /** Assert the Connect-App submit button is disabled (e.g. empty/whitespace input). */
  async assertConnectDisabled(): Promise<void> {
    await expect(this.testid('ohpp.registerapp.connect')).toBeDisabled()
  }

  // --- Phase 4.1 batch-2d (27 mobile) ---

  /** Open the mobile menu and navigate via the visible keyed mobile nav link. */
  async gotoNavMobile(to: string): Promise<void> {
    await this.clickTestId('ohpp.nav.mobile-menu-toggle')
    // Desktop + mobile both render ohpp.nav.link.<to>; at 375px the desktop copy
    // is display:none, so target the visible one to avoid a strict-mode match.
    const link = this.page.locator(`[data-testid="ohpp.nav.link.${to}"]`).locator('visible=true')
    await link.first().click()
  }

  /** True if the document overflows horizontally at the current viewport. */
  async hasHorizontalOverflow(): Promise<boolean> {
    return this.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  }
}
