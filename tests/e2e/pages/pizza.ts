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

  async generateChallengeUri(): Promise<string> {
    await this.signIn()
    await this.page.getByTestId('nav-settings').click()
    // Clean slate: the pizza app's OHPP connection persists across the once-only
    // reset, so disconnect an existing connection before generating a fresh
    // challenge (otherwise connect-ohpp / challenge rendering differs).
    const disconnect = this.page.getByTestId('disconnect-ohpp-button')
    if (await disconnect.isVisible().catch(() => false)) {
      await disconnect.click()
      await expect(this.page.getByTestId('ohpp-connection-status')).not.toContainText('Connected', {
        timeout: 10_000,
      })
    }
    await this.page.getByTestId('connect-ohpp-button').click()
    const uri = this.page.getByTestId('challenge-uri')
    await expect(uri).toBeVisible({ timeout: 10_000 })
    const value = (await uri.textContent())?.trim() ?? ''
    expect(value).toContain('ohpp://register?challenge=')
    return value
  }

  async confirmConnected(): Promise<void> {
    // The pizza app reflects the async resolver->app callback on the settings
    // page; poll reload-then-check until Connected, bounded, no fixed sleep.
    const deadline = Date.now() + 30_000
    for (;;) {
      await this.page.getByTestId('nav-settings').click()
      if (
        await this.page
          .getByTestId('ohpp-connection-status')
          .filter({ hasText: 'Connected' })
          .isVisible()
          .catch(() => false)
      ) {
        return
      }
      if (Date.now() > deadline) {
        await expect(this.page.getByTestId('ohpp-connection-status')).toContainText('Connected', {
          timeout: 5_000,
        })
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
