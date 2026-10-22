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
    // Revoke any active devices (prior runs). Each revoke card is keyed by id;
    // loop until no revoke buttons remain.
    for (;;) {
      const revoke = this.page.locator('[data-testid^="ohpp.devices.revoke."]').first()
      if (!(await revoke.isVisible().catch(() => false))) break
      await revoke.click()
      await this.clickTestId('ohpp.confirm.confirm')
      // Wait for this card's revoke to detach before re-checking.
      await revoke.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
    }
    const enable = this.testid('ohpp.devices.enable-web-approvals')
    if (await enable.isVisible().catch(() => false)) {
      await enable.click()
    }
  }

  /** Connect a requester app by pasting its ohpp:// challenge URI. */
  async connectApp(challengeUri: string): Promise<void> {
    await this.goto('/register-app')
    await this.fillTestId('ohpp.registerapp.uri', challengeUri)
    await this.clickTestId('ohpp.registerapp.connect')
  }
}
