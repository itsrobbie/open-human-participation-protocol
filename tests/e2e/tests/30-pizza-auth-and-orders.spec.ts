import { test, expect } from '@playwright/test'
import { PIZZA_URL, KEYCLOAK_URL } from '../test-urls'

test.describe.serial('Pizza — Auth, Navigation & Standard Orders', () => {
  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto(PIZZA_URL)
    // App shows its own login page first
    await expect(page.getByTestId('login-button')).toBeVisible({ timeout: 10000 })
    await page.getByTestId('login-button').click()

    // Now redirects to Keycloak
    await page.waitForURL(/realms\/ohpp-pizza/, { timeout: 15000 })
    await page.fill('#username', 'demo')
    await page.fill('#password', 'demo')
    await page.click('#kc-login')

    // Should redirect back to app dashboard
    await page.waitForURL(new RegExp(`${PIZZA_URL.replace('http://', '')}.*`), { timeout: 15000 })
    await expect(page.getByTestId('order-mode-standard')).toBeVisible({ timeout: 10000 })
  })

  test('login with invalid credentials shows Keycloak error', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto(PIZZA_URL)
    await expect(page.getByTestId('login-button')).toBeVisible({ timeout: 10000 })
    await page.getByTestId('login-button').click()
    await page.waitForURL(/realms\/ohpp-pizza/, { timeout: 15000 })
    await page.fill('#username', 'demo')
    await page.fill('#password', 'wrongpassword')
    await page.click('#kc-login')

    await expect(page.locator('#input-error')).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/realms\/ohpp-pizza/)
  })

  test('navigation - all pages accessible when logged in', async ({ page }) => {
    await signIn(page)

    await page.getByTestId('nav-menu').click()
    await expect(page.locator('h1')).toContainText('Menu')

    await page.getByTestId('nav-orders').click()
    await expect(page.locator('h1')).toContainText('Orders')

    await page.getByTestId('nav-settings').click()
    await expect(page.locator('h1')).toContainText('Settings')

    await page.getByTestId('nav-dashboard').click()
    await expect(page.getByTestId('order-mode-standard')).toBeVisible()
  })

  test('dark mode toggle applies theme', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('dark-mode-toggle').click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByTestId('dark-mode-toggle').click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('menu - browse categories shows items', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-menu').click()

    // Should show menu categories or items
    await expect(page.locator('[data-testid^="menu-item-"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('standard order - place order without OHPP confirms directly', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-menu').click()

    // Click on first available menu item
    await page.locator('[data-testid^="menu-item-"]').first().click()

    // Add to cart
    const addButton = page.getByTestId('add-to-cart-button')
    await expect(addButton).toBeVisible({ timeout: 5000 })
    await addButton.click()

    // Go to cart
    await page.getByTestId('nav-cart').click()
    await expect(page.getByTestId('cart-total')).toBeVisible()

    // Fill delivery address and place order (all on one page)
    await page.fill('[data-testid="address-line1"]', '1 Pizza Lane')
    await page.fill('[data-testid="address-city"]', 'London')
    await page.fill('[data-testid="address-postcode"]', 'E1 1AA')
    await page.getByTestId('place-order-button').click()

    // Should navigate to order detail or show confirmation
    await expect(page.locator('text=Confirmed').first().or(page.getByTestId('status-timeline'))).toBeVisible({ timeout: 10000 })
  })

  test('orders page shows order history', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-orders').click()
    // Should show orders list or empty state
    await expect(page.getByTestId('orders-list').or(page.locator('text=No orders'))).toBeVisible({ timeout: 5000 })
  })

  test('logout clears session and redirects', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('logout-button').click()
    // Should be back at login
    await page.waitForURL(/login|realms\/ohpp-pizza/)
  })
})

async function signIn(page: import('@playwright/test').Page) {
  await page.goto(PIZZA_URL)
  // Wait for either the app dashboard (already authenticated) or the login button
  const dashboard = page.getByTestId('order-mode-standard')
  const loginBtn = page.getByTestId('login-button')
  await expect(dashboard.or(loginBtn)).toBeVisible({ timeout: 10000 })

  // If already on dashboard, we're done
  if (await dashboard.isVisible()) return

  // Click login and handle Keycloak
  await loginBtn.click()
  await page.waitForURL(/realms\/ohpp-pizza/, { timeout: 15000 })
  await page.fill('#username', 'demo')
  await page.fill('#password', 'demo')
  await page.click('#kc-login')
  await page.waitForURL(new RegExp(`${PIZZA_URL.replace('http://', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`), { timeout: 15000 })
  await expect(dashboard).toBeVisible({ timeout: 10000 })
}
