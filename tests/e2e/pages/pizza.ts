import { expect, type Page } from '@playwright/test'
import { PIZZA_URL } from '../test-urls'
import type { RequesterDriver } from '../fixtures/whole-case-scenario'

/**
 * PizzaPage — the Pizza (Slice & Dice) requester driver for WholeCaseScenario.
 *
 * Drives the STANDARD order flow, which raises a SINGLE `select` participation
 * request with one option `confirm` ("Confirm Order"); answering `confirm`
 * transitions the order pending_confirmation -> confirmed. This is the
 * portal-web-attester-drivable path. (The separate 7-step ohpp-pizza modal flow
 * is the Flutter app-attester surface, not this web whole-case.)
 *
 * Pizza signs in via a Keycloak redirect (login-button -> #username/#password/
 * #kc-login -> back to the app). Connect is via the portal "Connect App" paste
 * (the scenario's PortalPage.connectApp handles the portal side); the challenge
 * is read from the pizza settings page. The OHPP connection persists in the
 * once-reset shared DB, so generateChallengeUri disconnects first for a clean
 * slate (mirrors Insurance + the device revoke-all pattern).
 */
export class PizzaPage implements RequesterDriver {
  readonly name = 'Pizza'
  // History rows for pizza orders surface the app id / order summary; the
  // Participation History UI shows the app, which the fixture matches loosely.
  readonly historyMatch = 'pizza'

  constructor(private readonly page: Page) {}

  private async signIn(): Promise<void> {
    await this.page.goto(PIZZA_URL)
    // The Keycloak SSO session can already be live by this spec (earlier pizza
    // specs logged in), so login-button is absent and the authed app shell
    // renders instead — clicking a missing login-button would hang. If the
    // authed landing marker is already present, the session is live; skip login.
    if (await this.page.getByTestId('order-mode-standard').isVisible({ timeout: 3_000 }).catch(() => false)) {
      return
    }
    await this.page.getByTestId('login-button').click()
    await this.page.waitForURL(/realms\/ohpp-pizza/, { timeout: 15_000 })
    await this.page.fill('#username', 'demo')
    await this.page.fill('#password', 'demo')
    await this.page.click('#kc-login')
    await this.page.waitForURL(
      new RegExp(PIZZA_URL.replace('http://', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      { timeout: 15_000 },
    )
    await expect(this.page.getByTestId('order-mode-standard')).toBeVisible({ timeout: 10_000 })
  }

  async isAlreadyConnected(): Promise<boolean> {
    // Pizza's OHPP connection persists across the once-only reset (legacy specs
    // 30/31/37 connect it), and a mid-suite disconnect+reconnect does not
    // round-trip resolver-side. Sign in (so the later initiateAction has a
    // session) and report whether pizza is already connected.
    //
    // isConnected is a react-query cache (['ohpp-status'] from /api/ohpp/status)
    // that resolves AFTER first paint, so a one-shot check races it: on a slow
    // settle disconnect-ohpp-button is not visible yet and we would wrongly
    // report "not connected", then fall through to the connect path which hangs
    // waiting for a connect-ohpp-button that never appears (pizza IS connected).
    // Instead settle deterministically: the Settings page renders EXACTLY one of
    // connect-ohpp-button (!isConnected) or disconnect-ohpp-button (isConnected).
    // Poll reload-until one of them is visible, then return which.
    await this.signIn()
    await this.page.getByTestId('nav-settings').click()
    const connectBtn = this.page.getByTestId('connect-ohpp-button')
    const disconnectBtn = this.page.getByTestId('disconnect-ohpp-button')
    const deadline = Date.now() + 20_000
    for (;;) {
      if (await disconnectBtn.isVisible().catch(() => false)) return true
      if (await connectBtn.isVisible().catch(() => false)) return false
      if (Date.now() > deadline) return false // treat an unsettled page as not-connected; connect path follows
      await this.page.waitForTimeout(500)
    }
  }

  async generateChallengeUri(): Promise<string> {
    await this.signIn()
    await this.page.getByTestId('nav-settings').click()
    // Clean slate for the NOT-already-connected path: disconnect any stale
    // connection, then generate a fresh challenge. connect-ohpp-button +
    // challenge-uri render ONLY when !isConnected; isConnected is a react-query
    // cache (['ohpp-status']) so after the disconnect mutation the UI flips only
    // once that query refetches — poll reload-until the connect button appears
    // (the status reads "Disconnected", which CONTAINS "Connected" as a
    // substring, so a not.toContainText('Connected') wait can never settle).
    const disconnect = this.page.getByTestId('disconnect-ohpp-button')
    if (await disconnect.isVisible().catch(() => false)) {
      await disconnect.click()
    }
    const connectBtn = this.page.getByTestId('connect-ohpp-button')
    const deadline = Date.now() + 30_000
    for (;;) {
      if (await connectBtn.isVisible().catch(() => false)) break
      if (Date.now() > deadline) {
        await expect(connectBtn).toBeVisible({ timeout: 5_000 })
        break
      }
      await this.page.reload()
      await this.page.getByTestId('nav-settings').click()
      await this.page.waitForTimeout(1_000) // between polls only; disconnect is async server-side
    }
    await connectBtn.click()
    const uri = this.page.getByTestId('challenge-uri')
    await expect(uri).toBeVisible({ timeout: 10_000 })
    const value = (await uri.textContent())?.trim() ?? ''
    expect(value).toContain('ohpp://register?challenge=')
    return value
  }

  async confirmConnected(): Promise<void> {
    // The pizza app reflects the async resolver->app callback on the settings
    // page; poll reload-then-check until connected, bounded, no fixed sleep.
    // Connected is signalled unambiguously by disconnect-ohpp-button rendering
    // (it renders only when isConnected) — the status text "Disconnected"
    // contains the substring "Connected", so a hasText:'Connected' filter is
    // not a reliable connected signal.
    const connectedSignal = this.page.getByTestId('disconnect-ohpp-button')
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
    // Place a standard order -> raises ONE `confirm` select participation
    // request; the app lands on the orders list with the order Pending.
    await this.page.getByTestId('nav-menu').click()
    await this.page.locator('[data-testid^="menu-item-"]').first().click()
    await this.page.getByTestId('add-to-cart-button').click()
    await this.page.getByTestId('nav-cart').click()
    await this.page.getByTestId('address-line1').fill('1 Test St')
    await this.page.getByTestId('address-city').fill('London')
    await this.page.getByTestId('address-postcode').fill('E1 1AA')
    await this.page.getByTestId('place-order-button').click()
    // Orders list shows the new order Pending (status-badge-pending_confirmation).
    await expect(this.page.getByTestId('orders-list')).toBeVisible({ timeout: 15_000 })
    await expect(
      this.page.getByTestId('orders-list').getByTestId('status-badge-pending_confirmation').first(),
    ).toBeVisible({ timeout: 15_000 })
  }

  async assertDoneState(): Promise<void> {
    // The orders LIST shows the status at load and does NOT poll — the standard
    // order's pending_confirmation -> confirmed transition is computed on demand
    // when the client polls /api/orders/{id}/status, which only the ORDER DETAIL
    // page does (its query is enabled while status === 'pending_confirmation').
    // So open the order's detail page and wait there: its polling drives the
    // transition and renders status-badge-confirmed.
    await this.page.getByTestId('nav-orders').click()
    const list = this.page.getByTestId('orders-list')
    await expect(list).toBeVisible({ timeout: 10_000 })
    await list.locator('[data-testid^="order-row-"]').first().click()
    // On the detail page the status timeline / badge advances to Confirmed as
    // the page polls the resolved participation outcome.
    await expect(this.page.getByTestId('status-badge-confirmed')).toBeVisible({ timeout: 30_000 })
  }
}
