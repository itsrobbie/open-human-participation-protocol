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
    const anyCard = this.page.locator('[data-testid^="ohpp.devices.card."]').first()

    // The Devices list loads ASYNCHRONOUSLY (react-query) after the page mounts,
    // so an instant isVisible() right after goto() loses the race and reports
    // false before the card renders. Instead wait for whichever terminal state
    // settles first:
    //   - a device card appears  -> web approvals already live, nothing to do
    //   - the enable button appears (zero devices) -> click it to register one
    // The portal renders the enable button ONLY when activeDevices.length === 0,
    // so exactly one of these two becomes visible. Racing their waitFor()s is
    // deterministic (auto-retrying locators, no sleep, no instant snapshot).
    await Promise.race([
      anyCard.waitFor({ state: 'visible', timeout: 15_000 }),
      enable.waitFor({ state: 'visible', timeout: 15_000 }),
    ])

    if (await anyCard.isVisible().catch(() => false)) {
      // A device already exists -> approvals live. (Reset test tenant only ever
      // yields a browser device here.)
      return
    }
    // Zero devices: the enable button is the one that resolved. Click it and
    // confirm a device card appears.
    await enable.click()
    await anyCard.waitFor({ state: 'visible', timeout: 15_000 })
  }

  /** Connect a requester app by pasting its ohpp:// challenge URI. */
  async connectApp(challengeUri: string): Promise<void> {
    await this.goto('/register-app')
    await this.fillTestId('ohpp.registerapp.uri', challengeUri)
    await this.clickTestId('ohpp.registerapp.connect')
  }
}
