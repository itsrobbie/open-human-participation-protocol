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
    // Revoke any active devices (prior runs). A key-bearing device DISABLES web
    // approvals, so we must clear them first. Each card is keyed by id; loop
    // until none remain.
    for (;;) {
      const revoke = this.page.locator('[data-testid^="ohpp.devices.revoke."]').first()
      if (!(await revoke.isVisible().catch(() => false))) break
      await revoke.click()
      await this.clickTestId('ohpp.confirm.confirm')
      await revoke.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
    }
    // After all devices are revoked the "Enable web approvals" button renders
    // (it only shows when there are zero active devices). Wait for it, click it,
    // and confirm a browser device now exists — otherwise web approvals are not
    // actually live and the attester's Pending page would show the disabled
    // notice (the failure mode seen on the first CI run).
    await this.waitFor('ohpp.devices.enable-web-approvals')
    await this.clickTestId('ohpp.devices.enable-web-approvals')
    // A browser device card appears once registration succeeds.
    await this.page
      .locator('[data-testid^="ohpp.devices.card."]')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
  }

  /** Connect a requester app by pasting its ohpp:// challenge URI. */
  async connectApp(challengeUri: string): Promise<void> {
    await this.goto('/register-app')
    await this.fillTestId('ohpp.registerapp.uri', challengeUri)
    await this.clickTestId('ohpp.registerapp.connect')
  }
}
