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
   * Ensure web approvals are enabled: revoke any key-bearing devices (which
   * would disable web approvals), then register a keyless browser device.
   * Deterministic — each step waits on a keyed element.
   */
  async enableWebApprovals(): Promise<void> {
    await this.goto('/devices')
    const revokeButtons = this.page.locator('[data-testid^="ohpp.devices.revoke."]')
    const enable = this.testid('ohpp.devices.enable-web-approvals')
    const browserCard = this.page.locator('[data-testid^="ohpp.devices.card."]').first()

    // The portal renders "Enable web approvals" ONLY when there are zero active
    // devices. A device left by an earlier spec (browser OR key-bearing) hides
    // it, and a key-bearing device actively DISABLES web approvals. So the
    // deterministic end state the attester needs is: no active devices, then a
    // freshly-registered keyless browser device.
    //
    // Drain every active device. revokeButtons.count() is re-evaluated each
    // loop; we assert the card detaches with a web-first expect (retries until
    // gone — P2, never a sleep, never a silently-swallowed timeout). After the
    // last revoke the list is drained.
    for (let guard = 0; guard < 20; guard++) {
      if ((await revokeButtons.count()) === 0) break
      const first = revokeButtons.first()
      await first.click()
      await this.clickTestId('ohpp.confirm.confirm')
      // Deterministic: wait until the active-device count actually drops.
      await expect(first).toBeHidden({ timeout: 10_000 })
    }
    // Defeat any react-query list staleness: reload so the zero-device render
    // (which shows the enable button) is guaranteed fresh.
    await this.page.reload()
    await expect(revokeButtons).toHaveCount(0, { timeout: 10_000 })

    await this.waitFor('ohpp.devices.enable-web-approvals')
    await enable.click()
    // Registration succeeds -> a browser device card appears.
    await browserCard.waitFor({ state: 'visible', timeout: 15_000 })
  }

  /** Connect a requester app by pasting its ohpp:// challenge URI. */
  async connectApp(challengeUri: string): Promise<void> {
    await this.goto('/register-app')
    await this.fillTestId('ohpp.registerapp.uri', challengeUri)
    await this.clickTestId('ohpp.registerapp.connect')
  }
}
