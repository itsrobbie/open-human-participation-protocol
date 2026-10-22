import type { Page } from '@playwright/test'
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
   * Ensure web approvals are enabled: revoke any key-bearing devices (which
   * would disable web approvals), then register a keyless browser device.
   * Deterministic — each step waits on a keyed element.
   */
  async enableWebApprovals(): Promise<void> {
    await this.goto('/devices')
    // Idempotent: the portal shows the "Enable web approvals" button ONLY when
    // there are zero active devices (it is hidden once any device, browser or
    // key-bearing, exists). So we cannot blindly wait for that button.
    //   - If a browser device card already exists, web approvals are already
    //     live — nothing to do.
    //   - Otherwise revoke every active device (a key-bearing device disables
    //     web approvals), which makes the enable button render; click it; then
    //     confirm a browser device card appears.
    const browserCard = this.page.locator('[data-testid^="ohpp.devices.card."]').first()
    const enable = this.testid('ohpp.devices.enable-web-approvals')

    if (await enable.isVisible().catch(() => false)) {
      // Zero devices: enable directly.
      await enable.click()
      await browserCard.waitFor({ state: 'visible', timeout: 15_000 })
      return
    }
    // A device already exists. If it is a browser device, approvals are live.
    // We cannot tell type from the card testid alone, so revoke all and
    // re-enable to guarantee a keyless browser device (the deterministic state
    // the attester needs).
    for (;;) {
      const revoke = this.page.locator('[data-testid^="ohpp.devices.revoke."]').first()
      if (!(await revoke.isVisible().catch(() => false))) break
      await revoke.click()
      await this.clickTestId('ohpp.confirm.confirm')
      await revoke.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
    }
    // All devices gone -> the enable button now renders.
    await this.waitFor('ohpp.devices.enable-web-approvals')
    await this.clickTestId('ohpp.devices.enable-web-approvals')
    await browserCard.waitFor({ state: 'visible', timeout: 15_000 })
  }

  /** Connect a requester app by pasting its ohpp:// challenge URI. */
  async connectApp(challengeUri: string): Promise<void> {
    await this.goto('/register-app')
    await this.fillTestId('ohpp.registerapp.uri', challengeUri)
    await this.clickTestId('ohpp.registerapp.connect')
  }
}
