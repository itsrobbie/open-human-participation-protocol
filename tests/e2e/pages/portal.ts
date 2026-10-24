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
}
