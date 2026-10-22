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
    const enable = this.testid('ohpp.devices.enable-web-approvals')
    const browserCard = this.page.locator('[data-testid^="ohpp.devices.card."]').first()

    // The deterministic end state the attester needs is: an active device card
    // exists (web approvals live). The portal renders the "Enable web approvals"
    // button ONLY when there are zero active devices.
    //
    // IDEMPOTENT: if an active device card already exists, web approvals are
    // already live — return. (The CI failure screenshot showed a "This browser"
    // card present while the code still waited for the enable button, which is
    // correctly HIDDEN whenever any device exists — so waiting for it hangs.)
    // The demo account in the reset test tenant only ever yields a browser
    // device here, so an existing card means approvals are live.
    if (await browserCard.isVisible().catch(() => false)) {
      return
    }
    // Zero devices: the enable button renders. Click it and confirm a card.
    await this.waitFor('ohpp.devices.enable-web-approvals')
    await enable.click()
    await browserCard.waitFor({ state: 'visible', timeout: 15_000 })
  }

  /** Connect a requester app by pasting its ohpp:// challenge URI. */
  async connectApp(challengeUri: string): Promise<void> {
    await this.goto('/register-app')
    await this.fillTestId('ohpp.registerapp.uri', challengeUri)
    await this.clickTestId('ohpp.registerapp.connect')
  }
}
