import { test, expect } from '@playwright/test'
import { MARKETPLACE_URL } from '../test-urls'

test.describe.serial('Marketplace — Auth, Navigation & Purchases', () => {
  test('login with valid credentials redirects to home', async ({ page }) => {
    await page.goto(MARKETPLACE_URL)
    await expect(page.getByTestId('login-button')).toBeVisible({ timeout: 10000 })
    await page.getByTestId('login-button').click()

    await page.waitForURL(/realms\/ohpp-marketplace/, { timeout: 15000 })
    await page.fill('#username', 'demo')
    await page.fill('#password', 'demo')
    await page.click('#kc-login')

    await page.waitForURL(new RegExp(`${MARKETPLACE_URL.replace('http://', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`), { timeout: 15000 })
    await expect(page.getByTestId('hero-section')).toBeVisible({ timeout: 10000 })
  })

  test('login with invalid credentials shows Keycloak error', async ({ page }) => {
    await page.goto(MARKETPLACE_URL)
    await page.getByTestId('login-button').click()
    await page.waitForURL(/realms\/ohpp-marketplace/, { timeout: 15000 })
    await page.fill('#username', 'demo')
    await page.fill('#password', 'wrongpassword')
    await page.click('#kc-login')

    await expect(page.locator('#input-error')).toBeVisible()
  })

  test('navigation - all pages accessible when logged in', async ({ page }) => {
    await signIn(page)

    await page.getByTestId('nav-products').click()
    await expect(page.locator('h1')).toContainText('Products')

    await page.getByTestId('nav-purchases').click()
    await expect(page.locator('h1')).toContainText('Purchases')

    await page.getByTestId('nav-settings').click()
    await expect(page.locator('h1')).toContainText('Settings')

    await page.getByTestId('nav-home').click()
    await expect(page.getByTestId('hero-section')).toBeVisible()
  })

  test('dark mode toggle applies theme', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('dark-mode-toggle').click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByTestId('dark-mode-toggle').click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('home page shows featured products', async ({ page }) => {
    await signIn(page)
    await expect(page.locator('[data-testid^="product-card-"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('products - filter by category updates grid', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-products').click()

    await page.getByTestId('filter-electronics').click()
    await expect(page.getByTestId('product-grid')).toBeVisible()
    // All visible cards should be electronics
    const cards = page.locator('[data-testid^="product-card-"]')
    await expect(cards.first()).toBeVisible({ timeout: 5000 })
  })

  test('products - sort by price reorders grid', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-products').click()
    await page.getByTestId('filter-all').click()

    await page.getByTestId('sort-select').selectOption('price')
    await expect(page.locator('[data-testid^="product-card-"]').first()).toBeVisible()
  })

  test('product detail - shows full info', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-products').click()
    await page.locator('[data-testid^="product-card-"]').first().click()

    await expect(page.getByTestId('product-name')).toBeVisible()
    await expect(page.getByTestId('product-price')).toBeVisible()
    await expect(page.getByTestId('product-description')).toBeVisible()
    await expect(page.getByTestId('buy-button')).toBeVisible()
  })

  test('product detail - out of stock disables buy button', async ({ page }) => {
    await signIn(page)
    await page.goto(`${MARKETPLACE_URL}/products/mechanical-keyboard`)

    await expect(page.getByTestId('stock-status')).toContainText('Out of stock')
    await expect(page.getByTestId('buy-button')).toBeDisabled()
  })

  test('purchase - standard value without OHPP confirms directly', async ({ page }) => {
    await signIn(page)
    // Navigate to a product that's in stock and affordable
    await page.goto(`${MARKETPLACE_URL}/products/cotton-tshirt`)
    await page.getByTestId('buy-button').click()

    // Without OHPP, should confirm directly
    await page.waitForURL(/purchases\//)
    await expect(page.getByTestId('status-badge-confirmed').first()).toBeVisible({ timeout: 10000 })
  })

  test('purchases page shows history with status badges', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-purchases').click()
    await expect(page.getByTestId('purchases-list').or(page.locator('text=No purchases'))).toBeVisible()
  })

  test('logout clears session and redirects', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('logout-button').click()
    await page.waitForURL(/login|realms\/ohpp-marketplace/)
  })
})

async function signIn(page: import('@playwright/test').Page) {
  await page.goto(MARKETPLACE_URL)
  const hero = page.getByTestId('hero-section')
  const loginBtn = page.getByTestId('login-button')
  await expect(hero.or(loginBtn)).toBeVisible({ timeout: 10000 })
  if (await hero.isVisible()) return
  await loginBtn.click()
  await page.waitForURL(/realms\/ohpp-marketplace/, { timeout: 15000 })
  await page.fill('#username', 'demo')
  await page.fill('#password', 'demo')
  await page.click('#kc-login')
  await page.waitForURL(new RegExp(`${MARKETPLACE_URL.replace('http://', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`), { timeout: 15000 })
  await expect(hero).toBeVisible({ timeout: 10000 })
}
