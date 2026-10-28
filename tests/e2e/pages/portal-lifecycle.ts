import { expect, type Page } from '@playwright/test'
import { BasePage } from './base'
import { PORTAL_URL } from '../test-urls'

/**
 * Portal LIFECYCLE page object (production-lifecycle plan, Phase 1.3). The
 * existing PortalPage covers login, enableWebApprovals (revoke-all + register a
 * browser device), and connectApp (the web-attester path). This one covers the
 * Portal's OWN lifecycle not yet encapsulated: Keycloak-hosted registration
 * handoff, settings lifecycle, history/audit navigation, and device-management
 * reads.
 *
 * All OHPP-surface lookups are by data-testid (P1); deterministic waits via the
 * BasePage helpers (P2). Grounded in testids verified present 2026-10-25:
 *   devices:  ohpp.devices.heading/-enable-web-approvals, ohpp.devices.revoke.<id>
 *   history:  ohpp.history.heading/-search/-status-filter/-next-page/-prev-page/
 *             -page-indicator/-clear-filters
 *   settings: ohpp.settings.heading/-token/-save/-saved/-resolver-info
 *
 * KNOWN GAP (addressed in Phase 4.4): the history page has no per-row or
 * attestation-detail testid yet (ohpp.history.row.<requestId> +
 * ohpp.history.attestation.<requestId>); the cross-surface audit assertion adds
 * those keys when 4.4 builds that flow.
 */
export class PortalLifecyclePage extends BasePage {
  constructor(page: Page) {
    super(page, PORTAL_URL)
  }

  // --- Account creation (Keycloak-hosted registration, decided model) --------

  /**
   * Drive the Keycloak-hosted registration path from the Portal login screen.
   * With realm "User registration" enabled, the Keycloak login page renders a
   * "Register" link; this follows it, fills the form, and returns to the Portal
   * authenticated. Keycloak's page is a third-party IdP origin, NOT an OHPP
   * surface we key, so role/label lookups there are the one allowed exception.
   */
  async registerViaKeycloak(user: {
    username: string
    email: string
    password: string
    firstName?: string
    lastName?: string
  }): Promise<void> {
    await this.goto('/login')
    await this.clickTestId('ohpp.login.submit').catch(() => {})
    const register = this.page.getByRole('link', { name: /register/i })
    await register.waitFor({ state: 'visible', timeout: 15_000 })
    await register.click()
    await this.page.getByLabel(/username/i).fill(user.username)
    await this.page.getByLabel(/email/i).fill(user.email)
    if (user.firstName) await this.page.getByLabel(/first name/i).fill(user.firstName)
    if (user.lastName) await this.page.getByLabel(/last name/i).fill(user.lastName)
    await this.page.getByLabel(/^password$/i).fill(user.password)
    await this.page.getByLabel(/confirm password/i).fill(user.password)
    await this.page.getByRole('button', { name: /register/i }).click()
    // Back on the Portal, authenticated: the dashboard (or pending) renders.
    await this.waitFor('ohpp.dashboard.heading', { timeout: 20_000 }).catch(
      async () => {
        await this.waitFor('ohpp.pending.heading', { timeout: 20_000 })
      },
    )
  }

  // --- History / audit --------------------------------------------------------

  async gotoHistory(): Promise<void> {
    await this.goto('/history')
    await this.waitFor('ohpp.history.heading')
  }

  async filterHistory(status: string): Promise<void> {
    await this.gotoHistory()
    await this.testid('ohpp.history.status-filter')
      .selectOption(status)
      .catch(async () => {
        await this.clickTestId(`ohpp.history.filter-${status}`)
      })
  }

  // --- Settings ---------------------------------------------------------------

  async gotoSettings(): Promise<void> {
    await this.goto('/settings')
    await this.waitFor('ohpp.settings.heading')
  }

  async readResolverInfo(): Promise<string> {
    await this.gotoSettings()
    return (await this.testid('ohpp.settings.resolver-info').textContent()) ?? ''
  }

  // --- Device management (reads; PortalPage owns enable/revoke mutation) ------

  async gotoDevices(): Promise<void> {
    await this.goto('/devices')
    await this.waitFor('ohpp.devices.heading')
  }

  async activeDeviceCount(): Promise<number> {
    await this.gotoDevices()
    return this.page
      .locator('[data-testid^="ohpp.devices.revoke."]:not([disabled])')
      .count()
  }

  /** Assert web approvals are usable (no disabled notice on the Pending page). */
  async expectWebApprovalsEnabled(): Promise<void> {
    await this.goto('/pending')
    await expect(
      this.page.locator('[data-testid="ohpp.pending.web-approvals-disabled"]'),
    ).toHaveCount(0)
  }
}
