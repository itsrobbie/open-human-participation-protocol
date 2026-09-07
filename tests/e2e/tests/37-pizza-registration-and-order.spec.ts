import { test, expect } from '@playwright/test'

/**
 * Isolated Playwright test proving the full flow:
 * 1. Sign into Portal
 * 2. Sign into Pizza app
 * 3. Register Pizza app via Portal (challenge ceremony)
 * 4. Pizza shows connected
 * 5. Place an order (triggers OHPP participation request)
 * 6. Request succeeds (no error) and shows as pending
 *
 * Runs against the dev stack (localhost ports).
 */
const PORTAL_URL = 'http://localhost:3000'
const PIZZA_URL = 'http://localhost:5030'

test('full flow: register pizza app then place order with OHPP', async ({ page, context }) => {
  test.setTimeout(120_000)

  // 1. Sign into Pizza app
  await page.goto(PIZZA_URL)
  await page.getByTestId('login-button').click()
  await page.waitForURL(/realms\/ohpp-pizza/, { timeout: 15000 })
  await page.fill('#username', 'demo')
  await page.fill('#password', 'demo')
  await page.click('#kc-login')
  await page.waitForURL(new RegExp('localhost:5030'), { timeout: 15000 })
  await expect(page.getByTestId('order-mode-standard')).toBeVisible({ timeout: 10000 })

  // 2. Go to settings and check/establish OHPP connection
  await page.getByTestId('nav-settings').click()
  const isConnected = await page.getByTestId('ohpp-connection-status').textContent().then(t => t?.includes('Connected')).catch(() => false)

  if (!isConnected) {
    // Generate challenge and register via Portal
    await page.getByTestId('connect-ohpp-button').click()
    await expect(page.getByTestId('challenge-uri')).toBeVisible({ timeout: 5000 })
    const challengeUri = await page.getByTestId('challenge-uri').textContent()
    expect(challengeUri).toContain('ohpp://register?challenge=')

    const portal = await context.newPage()
    await portal.goto(`${PORTAL_URL}/login`)
    await portal.fill('input[placeholder="demo"]', 'demo')
    await portal.fill('input[type="password"]', 'demo')
    await portal.click('button[type="submit"]')
    await expect(portal).toHaveURL(PORTAL_URL + '/')
    await portal.click('nav >> text=Connect App')
    await portal.fill('textarea', challengeUri!)
    await portal.click('button:has-text("Connect app")')
    await expect(portal.locator('.bg-green-50')).toContainText('App registered', { timeout: 15000 })
    await portal.close()

    await page.waitForTimeout(2000)
    await page.reload()
    await page.getByTestId('nav-settings').click()
    await expect(page.getByTestId('ohpp-connection-status')).toContainText('Connected', { timeout: 10000 })
  }

  // 3. Place an order (should trigger OHPP request, NOT error)
  await page.getByTestId('nav-menu').click()
  await page.locator('[data-testid^="menu-item-"]').first().click()
  await page.getByTestId('add-to-cart-button').click()
  await page.getByTestId('nav-cart').click()
  await page.fill('[data-testid="address-line1"]', '1 Test St')
  await page.fill('[data-testid="address-city"]', 'London')
  await page.fill('[data-testid="address-postcode"]', 'E1 1AA')
  await page.getByTestId('place-order-button').click()

  // 4. Should show pending state (OHPP request sent successfully, waiting for resolution)
  // NOT an error like "No registration for user"
  await expect(page.locator('text=Pending').first()).toBeVisible({ timeout: 10000 })

  // 5. Portal should reflect the pending request. Which channel handles it
  // depends on shared account state: if a device with a key is registered
  // (e.g. from another test in the suite), web approvals are disabled and the
  // request is routed to that device; otherwise the request is answerable in
  // the browser. Both outcomes prove the participation request was accepted
  // and is pending, so accept either.
  const portal = await context.newPage()
  await portal.goto(`${PORTAL_URL}/login`)
  await portal.fill('input[placeholder="demo"]', 'demo')
  await portal.fill('input[type="password"]', 'demo')
  await portal.click('button[type="submit"]')
  await expect(portal).toHaveURL(PORTAL_URL + '/')
  await portal.click('nav >> text=Pending')

  const browserConfirm = portal.getByText(/Confirm/).first()
  const routedToDevice = portal.getByText(/Web approvals disabled/i).first()
  await expect(browserConfirm.or(routedToDevice)).toBeVisible({ timeout: 15000 })
  await portal.close()
})
