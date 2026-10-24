import { test, expect } from '@playwright/test'
import { PIZZA_URL } from '../test-urls'

/**
 * Pizza App — Page rendering tests.
 * Each test is fully isolated: signs in fresh, doesn't depend on prior test state.
 */
test.describe('Pizza — Pages', () => {
  test('menu page shows items with testids', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-menu').click()
    await expect(page.getByTestId('menu-grid')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid^="menu-item-"]').first()).toBeVisible()
  })

  test('menu item detail page shows add-to-cart button and price', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-menu').click()
    await page.locator('[data-testid^="menu-item-"]').first().click()
    await expect(page.getByTestId('add-to-cart-button')).toBeVisible()
    await expect(page.getByTestId('item-total')).toBeVisible()
  })

  test('adding item to cart shows cart badge', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-menu').click()
    await page.locator('[data-testid^="menu-item-"]').first().click()
    await page.getByTestId('add-to-cart-button').click()
    await expect(page.getByTestId('cart-badge')).toBeVisible()
  })

  test('cart page shows items and total', async ({ page }) => {
    await signIn(page)
    // Add something to cart first
    await page.getByTestId('nav-menu').click()
    await page.locator('[data-testid^="menu-item-"]').first().click()
    await page.getByTestId('add-to-cart-button').click()
    // Navigate to cart
    await page.getByTestId('nav-cart').click()
    await expect(page.getByTestId('cart-items')).toBeVisible()
    await expect(page.getByTestId('cart-total')).toBeVisible()
  })

  test('placing order without OHPP shows confirmed status', async ({ page }) => {
    test.setTimeout(45_000)
    await signIn(page)
    await page.getByTestId('nav-menu').click()
    await page.locator('[data-testid^="menu-item-"]').first().click()
    await page.getByTestId('add-to-cart-button').click()
    await page.getByTestId('nav-cart').click()
    await page.fill('[data-testid="address-line1"]', '1 Test St')
    await page.fill('[data-testid="address-city"]', 'London')
    await page.fill('[data-testid="address-postcode"]', 'E1 1AA')
    await page.getByTestId('place-order-button').click()
    await expect(page.getByTestId('status-badge-confirmed').first()).toBeVisible({ timeout: 10000 })
  })

  test('orders page renders', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-orders').click()
    await expect(page.getByTestId('orders-list')).toBeVisible({ timeout: 5000 })
  })

  test('settings page shows OHPP connection UI', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-settings').click()
    await expect(page.getByTestId('connect-ohpp-button')).toBeVisible()
  })
})

async function signIn(page: import('@playwright/test').Page) {
  await page.goto(PIZZA_URL)
  const dashboard = page.getByTestId('order-mode-standard')
  const loginBtn = page.getByTestId('login-button')
  await expect(dashboard.or(loginBtn)).toBeVisible({ timeout: 10000 })
  if (await dashboard.isVisible()) return
  await loginBtn.click()
  await page.waitForURL(/realms\/ohpp-pizza/, { timeout: 15000 })
  await page.fill('#username', 'demo')
  await page.fill('#password', 'demo')
  await page.click('#kc-login')
  await page.waitForURL(new RegExp(`${PIZZA_URL.replace('http://', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`), { timeout: 15000 })
  await expect(dashboard).toBeVisible({ timeout: 10000 })
}
