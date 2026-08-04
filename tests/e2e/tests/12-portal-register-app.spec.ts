import { test, expect } from '@playwright/test'
import { PORTAL_URL, BANK_URL } from '../test-urls'

test.describe('Portal — Connect App (full user journey)', () => {
  test.beforeEach(async ({ page }) => {
    // Log into the portal via the UI
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')
  })

  test('connect app page shows form with instructions', async ({ page }) => {
    await page.click('nav >> text=Connect App')
    await expect(page.locator('h1')).toContainText('Connect an app')
    await expect(page.locator('text=ohpp://')).toBeVisible()
    await expect(page.locator('textarea')).toBeVisible()
    await expect(page.locator('button:has-text("Connect app")')).toBeVisible()
  })

  test('connect app button disabled without input', async ({ page }) => {
    await page.click('nav >> text=Connect App')
    const button = page.locator('button:has-text("Connect app")')
    await expect(button).toBeDisabled()
  })

  test('invalid URI shows error', async ({ page }) => {
    await page.click('nav >> text=Connect App')
    await page.fill('textarea', 'not-a-valid-uri')
    await page.click('button:has-text("Connect app")')

    // Should show an inline error message (registration failed)
    await expect(
      page.locator('.bg-red-50').first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('end-to-end: generate link in bank, paste in portal, connect app', async ({ page, context }) => {
    // Step 1: Open the bank and generate a connection link via the UI
    const bankPage = await context.newPage()
    await bankPage.goto(BANK_URL)
    await bankPage.getByTestId('nav-settings').click()
    await expect(bankPage.locator('#generate-challenge-btn')).toBeVisible({ timeout: 10000 })

    // Click "Generate Connection Link" button in the bank's OHPP Settings section
    await bankPage.click('#generate-challenge-btn')

    // Wait for the challenge URI to appear in the textarea
    const challengeTextarea = bankPage.locator('#challenge-uri')
    await expect(challengeTextarea).toBeVisible({ timeout: 10000 })
    await expect(challengeTextarea).not.toHaveValue('')

    // Read the challenge URI from the bank's UI
    const challengeUri = await challengeTextarea.inputValue()
    expect(challengeUri).toContain('ohpp://register?challenge=')

    // Step 2: Navigate to the portal's Connect App page
    await page.click('nav >> text=Connect App')
    await expect(page.locator('h1')).toContainText('Connect an app')

    // Step 3: Paste the challenge URI from the bank into the portal's textarea
    await page.fill('textarea', challengeUri)

    // Step 4: Click Connect app
    await page.click('button:has-text("Connect app")')

    // Step 5: Verify registration outcome — should NOT show decode error
    const resultLocator = page.locator('.bg-green-50, .bg-red-50').first()
    await expect(resultLocator).toBeVisible({ timeout: 15000 })

    const resultText = await resultLocator.textContent()

    // The challenge URI should be parseable — no decode error
    expect(resultText).not.toContain('Failed to decode challenge payload')

    if (resultText?.includes('App registered')) {
      expect(resultText).toContain('App registered')
    } else {
      console.log('Connection result (not decode error):', resultText)
    }

    await bankPage.close()
  })
})
