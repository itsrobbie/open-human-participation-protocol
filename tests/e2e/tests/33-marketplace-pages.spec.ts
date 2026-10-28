import { test, expect } from '@playwright/test'
import { MARKETPLACE_URL } from '../test-urls'

/**
 * Marketplace App — Page rendering tests.
 * Each test is fully isolated: signs in fresh, doesn't depend on prior test state.
 */
test.describe('Marketplace — Pages', () => {
  test('home page shows hero and featured products', async ({ page }) => {
    await signIn(page)
    await expect(page.getByTestId('hero-section')).toBeVisible()
    await expect(page.locator('[data-testid^="product-card-"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('products page shows grid and filter controls', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-products').click()
    await expect(page.getByTestId('product-grid')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('product-filters')).toBeVisible()
    await expect(page.getByTestId('sort-select')).toBeVisible()
  })

  test('filtering by category shows filtered results', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-products').click()
    await page.getByTestId('filter-electronics').click()
    await expect(page.locator('[data-testid^="product-card-"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('product detail page shows name, price, stock, and buy button', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-products').click()
    await page.locator('[data-testid^="product-card-"]').first().click()
    await expect(page.getByTestId('product-name')).toBeVisible()
    await expect(page.getByTestId('product-price')).toBeVisible()
    await expect(page.getByTestId('stock-status')).toBeVisible()
    await expect(page.getByTestId('buy-button')).toBeVisible()
  })

  test('out of stock product disables buy button', async ({ page }) => {
    await signIn(page)
    await page.goto(`${MARKETPLACE_URL}/products/mechanical-keyboard`)
    await expect(page.getByTestId('stock-status')).toContainText('Out of stock')
    await expect(page.getByTestId('buy-button')).toBeDisabled()
  })

  test('buying a product without OHPP confirms directly', async ({ page }) => {
    test.setTimeout(45_000)
    await signIn(page)
    await page.goto(`${MARKETPLACE_URL}/products/cotton-tshirt`)
    await page.getByTestId('buy-button').click()
    await page.waitForURL(/purchases\//)
    await expect(page.getByTestId('status-badge-confirmed').first()).toBeVisible({ timeout: 10000 })
  })

  test('purchases page renders', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-purchases').click()
    await expect(page.getByTestId('purchases-list').or(page.getByTestId('ohpp.marketplace.purchases.empty'))).toBeVisible({ timeout: 5000 })
  })

  test('settings page shows OHPP connection UI', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('nav-settings').click()
    await expect(page.getByTestId('generate-challenge-button')).toBeVisible()
  })

  test('search navigates to products with query', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('search-input').fill('headphones')
    await page.getByTestId('search-input').press('Enter')
    await page.waitForURL(/products\?search=headphones/)
    await expect(page.locator('[data-testid^="product-card-"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('category link from home navigates to filtered products', async ({ page }) => {
    await signIn(page)
    await page.getByTestId('category-electronics').click()
    await page.waitForURL(/products\?category=electronics/)
    await expect(page.getByTestId('product-grid')).toBeVisible()
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
