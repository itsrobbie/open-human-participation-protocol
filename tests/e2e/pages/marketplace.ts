import { expect, type Page } from '@playwright/test'
import { MARKETPLACE_URL } from '../test-urls'
import type { RequesterDriver } from '../fixtures/whole-case-scenario'

/**
 * MarketplacePage — the Marketplace (NeonMarket) requester driver for
 * WholeCaseScenario.
 *
 * Drives the STANDARD (non-high-value) purchase, which raises a SINGLE `select`
 * participation request with one option `confirm` ("Confirm Purchase");
 * answering `confirm` transitions the purchase pending_confirmation -> confirmed.
 * This is the portal-web-attester-drivable path. (A >= £100 product raises a
 * `signature` request, and bundle/delivery/total flows raise multiselect/
 * datetime/number — those are separate request-type coverage, not this
 * single-confirm whole-case.)
 *
 * The product `cotton-tshirt` is £24.99 (< the £100 HIGH_VALUE_THRESHOLD) and is
 * stocked, so buying it while OHPP-connected raises exactly one `confirm` select.
 *
 * Marketplace signs in via a Keycloak redirect (login-button -> #username/
 * #password/#kc-login -> back to the app, hero-section is the authed landing
 * marker). Connect is via the portal "Connect App" paste (the scenario's
 * PortalPage.connectApp handles the portal side); the challenge is read from the
 * Settings page. The OHPP connection persists in the once-reset shared DB, so
 * isAlreadyConnected reports the live state and the scenario reuses it rather
 * than disconnect+reconnect (which does not round-trip resolver-side).
 *
 * NOTE the testid names differ from pizza: generate-challenge-button (not
 * connect-ohpp-button) and disconnect-button (not disconnect-ohpp-button).
 */
export class MarketplacePage implements RequesterDriver {
  readonly name = 'Marketplace'
  readonly historyMatch = 'marketplace'

  constructor(private readonly page: Page) {}

  private async signIn(): Promise<void> {
    await this.page.goto(MARKETPLACE_URL)
    // The Keycloak SSO session can already be live by this spec (earlier
    // marketplace specs logged in), so login-button is absent and the authed
    // app shell renders instead — clicking a missing login-button would hang.
    // hero-section is the authed landing marker; if present, the session is live.
    if (await this.page.getByTestId('hero-section').isVisible({ timeout: 3_000 }).catch(() => false)) {
      return
    }
    await this.page.getByTestId('login-button').click()
    await this.page.waitForURL(/realms\/ohpp-marketplace/, { timeout: 15_000 })
    await this.page.fill('#username', 'demo')
    await this.page.fill('#password', 'demo')
    await this.page.click('#kc-login')
    await this.page.waitForURL(
      new RegExp(MARKETPLACE_URL.replace('http://', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      { timeout: 15_000 },
    )
    await expect(this.page.getByTestId('hero-section')).toBeVisible({ timeout: 10_000 })
  }

  async isAlreadyConnected(): Promise<boolean> {
    // Marketplace's OHPP connection persists across the once-only reset, and a
    // mid-suite disconnect+reconnect does not round-trip resolver-side. Sign in
    // (so the later initiateAction has a session) and report whether it is
    // already connected.
    //
    // isConnected is a react-query cache (['ohpp-status'] from /api/ohpp/status)
    // that resolves AFTER first paint, so a one-shot check races it. Settle
    // deterministically: the Settings page renders EXACTLY one of
    // generate-challenge-button (!isConnected) or disconnect-button (isConnected).
    // Poll reload-until one of them is visible, then return which.
    await this.signIn()
    await this.page.getByTestId('nav-settings').click()
    const generateBtn = this.page.getByTestId('generate-challenge-button')
    const disconnectBtn = this.page.getByTestId('disconnect-button')
    const deadline = Date.now() + 20_000
    for (;;) {
      if (await disconnectBtn.isVisible().catch(() => false)) return true
      if (await generateBtn.isVisible().catch(() => false)) return false
      if (Date.now() > deadline) return false // unsettled -> treat as not-connected; connect path follows
      await this.page.waitForTimeout(500)
    }
  }

  async generateChallengeUri(): Promise<string> {
    await this.signIn()
    await this.page.getByTestId('nav-settings').click()
    // Clean slate for the NOT-already-connected path: disconnect any stale
    // connection, then generate a fresh challenge. generate-challenge-button +
    // challenge-uri render ONLY when !isConnected; isConnected is a react-query
    // cache (['ohpp-status']) so after the disconnect mutation the UI flips only
    // once that query refetches — poll reload-until the generate button appears.
    const disconnect = this.page.getByTestId('disconnect-button')
    if (await disconnect.isVisible().catch(() => false)) {
      await disconnect.click()
    }
    const generateBtn = this.page.getByTestId('generate-challenge-button')
    const deadline = Date.now() + 30_000
    for (;;) {
      if (await generateBtn.isVisible().catch(() => false)) break
      if (Date.now() > deadline) {
        await expect(generateBtn).toBeVisible({ timeout: 5_000 })
        break
      }
      await this.page.reload()
      await this.page.getByTestId('nav-settings').click()
      await this.page.waitForTimeout(1_000) // between polls only; disconnect is async server-side
    }
    await generateBtn.click()
    const uri = this.page.getByTestId('challenge-uri')
    await expect(uri).toBeVisible({ timeout: 10_000 })
    const value = (await uri.textContent())?.trim() ?? ''
    expect(value).toContain('ohpp://register?challenge=')
    return value
  }

  async confirmConnected(): Promise<void> {
    // The marketplace app reflects the async resolver->app callback on the
    // Settings page; poll reload-then-check until connected, bounded, no fixed
    // sleep. Connected is signalled by disconnect-button rendering (renders only
    // when isConnected).
    const connectedSignal = this.page.getByTestId('disconnect-button')
    const deadline = Date.now() + 30_000
    for (;;) {
      await this.page.getByTestId('nav-settings').click()
      if (await connectedSignal.isVisible().catch(() => false)) return
      if (Date.now() > deadline) {
        await expect(connectedSignal).toBeVisible({ timeout: 5_000 })
        return
      }
      await this.page.reload()
      await this.page.waitForTimeout(1_000) // between polls only; connect is async server-side
    }
  }

  async initiateAction(): Promise<void> {
    // Buy a sub-£100 product (cotton-tshirt, £24.99) -> raises ONE `confirm`
    // select participation request. The buy navigates to /purchases/{id}
    // (the detail page), which starts Pending.
    await this.page.goto(`${MARKETPLACE_URL}/products/cotton-tshirt`)
    const buy = this.page.getByTestId('buy-button')
    await expect(buy).toBeEnabled({ timeout: 10_000 })
    await buy.click()
    // Lands on the purchase detail page, Pending.
    await this.page.waitForURL(/\/purchases\//, { timeout: 15_000 })
    await expect(
      this.page.getByTestId('status-badge-pending_confirmation'),
    ).toBeVisible({ timeout: 15_000 })
  }

  async assertDoneState(): Promise<void> {
    // The purchase DETAIL page auto-polls /api/purchases/{id} every 3s while
    // status === 'pending_confirmation' (react-query refetchInterval), and
    // GET /api/purchases/{id} reconciles the resolved participation outcome
    // server-side. So after the attester answers `confirm`, this page advances
    // to confirmed on its own — just wait for the confirmed badge on the page
    // the buy already landed us on.
    await expect(
      this.page.getByTestId('status-badge-confirmed'),
    ).toBeVisible({ timeout: 30_000 })
  }
}
